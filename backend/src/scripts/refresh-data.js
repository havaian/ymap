/**
 * backend/src/scripts/refresh-data.js
 *
 * Один прогон всего локального конвейера данных: скачать, собрать, проверить,
 * отчитаться о том, что изменилось на диске.
 *
 * ── Что это такое и чем не является ──────────────────────────────────────────
 *
 * В базу этот скрипт не ходит и ни одного запроса к MongoDB не делает. Раскладка
 * проекта: скрипты готовят жсонки, жсонки коммитятся и приезжают внутрь образа,
 * а services/data-bootstrap.js разливает их в базу при старте контейнера.
 * Мастер-скрипт - это первая половина, целиком. Вторая половина запускается сама.
 *
 * Поэтому здесь нет ни import-geodata-osm.js, ни import-objects.js, ни
 * simplify-boundaries.js: это этапы бутстрапа, а не шаги конвейера. Запускать их
 * руками нужно только при разборе поломки.
 *
 * ── Порядок ──────────────────────────────────────────────────────────────────
 *
 * Порядок не переставляется: границы нужны справочнику районов, справочник нужен
 * сборке координат, координаты нужны облаку точек на лендинге. Каждый этап
 * объявляет, какие файлы читает и какие пишет, и отчёт строится из этих списков,
 * а не из того, что этап напечатал.
 *
 * Сетевые этапы по умолчанию выключены. Пересобрать производные файлы после
 * правки кода нужно часто, а долбить Overpass при каждой пересборке - нет.
 *
 * Запуск:
 *   node backend/src/scripts/refresh-data.js               только сборка и проверки
 *   node backend/src/scripts/refresh-data.js --fetch       вместе со скачиванием
 *   node backend/src/scripts/refresh-data.js --only=coords,landing
 *   node backend/src/scripts/refresh-data.js --skip=verify
 *   node backend/src/scripts/refresh-data.js --list        показать этапы и выйти
 *
 * Ключи:
 *   --fetch                     включить сетевые этапы (Overpass, data.egov.uz)
 *   --only=a,b                  выполнить только указанные этапы
 *   --skip=a,b                  пропустить указанные этапы
 *   --extra-district-levels=7   передаётся в fetch-osm-boundaries.js
 *   --continue                  не останавливаться на первом упавшем этапе
 *   --list                      напечатать список этапов и выйти
 *
 * Код возврата ненулевой, если хотя бы один этап упал: скрипт рассчитан на то,
 * что его можно поставить в конвейер и не разглядывать вывод глазами.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = __dirname;
const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const LANDING_FILE = path.join(REPO_ROOT, 'frontend', 'public', 'data', 'facility-points.json');

// ── Аргументы ────────────────────────────────────────────────────────────────

const ARGV = process.argv.slice(2);
const has = name => ARGV.includes(`--${name}`);
const arg = name => {
    const hit = ARGV.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
};
const list = name => (arg(name) ?? '').split(',').map(s => s.trim()).filter(Boolean);

const WITH_FETCH = has('fetch');
const ONLY = list('only');
const SKIP = list('skip');
const KEEP_GOING = has('continue');

// ── Этапы ────────────────────────────────────────────────────────────────────
//
// `reads` и `writes` - это не украшение отчёта. По ним считается, что этап
// действительно изменил, и они же показывают, почему порядок именно такой:
// выход одного этапа стоит во входе следующего.
//
// Имена выгрузок data.egov.uz содержат идентификатор набора, поэтому там, где
// список файлов заранее неизвестен, стоит функция.

const egovFiles = () => {
    try {
        return fs.readdirSync(DATA_DIR)
            .filter(f => f.startsWith('egov-') && f.endsWith('.json'))
            .filter(f => !f.startsWith('egov-catalog') && !f.startsWith('egov-datasets'))
            .sort()
            .map(f => path.join(DATA_DIR, f));
    } catch {
        return [];
    }
};

/**
 * Идентификаторы наборов, которые уже качали: они зашиты в имена лежащих файлов.
 * Повторное скачивание обновляет ровно то, что есть, и не требует ни списка в
 * коде, ни ключа в командной строке.
 */
const knownEgovGuids = () =>
    egovFiles()
        .map(p => path.basename(p).replace(/^egov-/, '').replace(/\.json$/, ''))
        .filter(Boolean);

const STAGES = [
    {
        key: 'osm',
        title: 'Границы регионов и районов из OpenStreetMap',
        network: true,
        script: 'fetch-osm-boundaries.js',
        args: () => {
            const extra = arg('extra-district-levels');
            return extra ? [`--extra-district-levels=${extra}`] : [];
        },
        reads: [],
        writes: () => [
            path.join(DATA_DIR, 'osm-regions.geojson'),
            path.join(DATA_DIR, 'osm-districts.geojson')
        ],
        note: 'Overpass - живая служба: отвечает медленно, ограничивает частоту и иногда отдаёт HTML вместо данных. Упавший этап оставляет прежние файлы нетронутыми.'
    },
    {
        key: 'egov',
        title: 'Выгрузки data.egov.uz',
        network: true,
        script: 'fetch-egov-dataset.js',
        // По одному прогону на набор: скрипт качает один набор за раз.
        repeat: () => knownEgovGuids().map(guid => ({ label: guid, args: [`--guid=${guid}`] })),
        reads: [],
        writes: egovFiles,
        note: 'Качаются те наборы, что уже лежат в data/. Новый набор добавляется отдельно: fetch-egov-catalog.js, затем fetch-egov-dataset.js --guid=...'
    },
    {
        key: 'crosswalk',
        title: 'Проверка справочника районов',
        script: 'validate-crosswalk.js',
        reads: () => [
            path.join(DATA_DIR, 'district-crosswalk.json'),
            path.join(DATA_DIR, 'osm-districts.geojson')
        ],
        // Без --fix ничего не пишет; ключ сюда намеренно не пробрасывается -
        // переписывание справочника это отдельное решение, а не побочный
        // результат обновления данных.
        writes: () => [],
        note: 'Только проверка. Переписать справочник: validate-crosswalk.js --fix, отдельным запуском.'
    },
    {
        key: 'coords',
        title: 'Координаты объектов по ИНН',
        script: 'build-egov-coords.js',
        reads: () => [
            path.join(DATA_DIR, 'ssv.json'),
            path.join(DATA_DIR, 'bogcha.json'),
            path.join(DATA_DIR, 'maktab44.json'),
            ...egovFiles()
        ],
        writes: () => [path.join(DATA_DIR, 'object-coords.json')]
    },
    {
        key: 'landing',
        title: 'Облако точек для лендинга',
        script: 'build-landing-data.js',
        reads: egovFiles,
        writes: () => [LANDING_FILE]
    },
    {
        key: 'verify',
        title: 'Пересчёт индекса депривации по файлам',
        script: 'verify-deprivation.js',
        reads: () => [
            path.join(DATA_DIR, 'ssv.json'),
            path.join(DATA_DIR, 'bogcha.json'),
            path.join(DATA_DIR, 'maktab44.json')
        ],
        writes: () => [],
        note: 'Считает те же числа, что отдаёт /api/analytics/deprivation, но из файлов и без базы. Расхождение с сайтом означает, что в базе лежит не то, что в репозитории.'
    }
];

// ── Отпечатки файлов ─────────────────────────────────────────────────────────

function digest(file) {
    try {
        return {
            exists: true,
            size: fs.statSync(file).size,
            sha: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
        };
    } catch {
        return { exists: false, size: 0, sha: null };
    }
}

function snapshot(files) {
    const out = new Map();
    for (const f of files) out.set(f, digest(f));
    return out;
}

// Пути в отчёте всегда через прямой слэш. На Windows path.relative отдаёт
// обратные, и строка `git add backend\\src\\data\\...` копируется в Git Bash как
// имя файла с экранированными символами, а не как путь.
const rel = p => path.relative(REPO_ROOT, p).split(path.sep).join('/');
const kb = n => `${(n / 1024).toFixed(0)} КБ`;

// ── Прогон ───────────────────────────────────────────────────────────────────

function resolveList(v) {
    return typeof v === 'function' ? v() : (v ?? []);
}

/**
 * Пакеты, которых не хватает этапу.
 *
 * Большинство скриптов конвейера не зависит ни от чего, кроме Node: их можно
 * запустить на чистом клоне репозитория. Меньшинство тянет модели, а те -
 * mongoose. Разница проверяется до запуска, чтобы отсутствие node_modules
 * выглядело как пропуск с причиной, а не как трассировка посреди отчёта.
 */
function missingPackages(stage) {
    const need = stage.requires ?? [];
    return need.filter(pkg => !fs.existsSync(path.join(BACKEND_ROOT, 'node_modules', pkg)));
}

function runOnce(scriptName, args, label) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    if (!fs.existsSync(scriptPath)) {
        return { ok: false, code: null, error: `нет файла ${scriptName}` };
    }
    if (label) console.log(`   · ${label}`);

    const started = Date.now();
    // Отдельный процесс, а не импорт: упавший этап не должен уносить с собой
    // остальные, а вывод скриптов рассчитан на терминал и печатается как есть.
    const res = spawnSync(process.execPath, [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: REPO_ROOT
    });
    const ms = Date.now() - started;

    if (res.error) return { ok: false, code: null, ms, error: res.error.message };
    return { ok: res.status === 0, code: res.status, ms };
}

function runStage(stage) {
    const writesBefore = snapshot(resolveList(stage.writes));

    console.log(`\n━━ ${stage.key}  ${stage.title}`);
    if (stage.note) console.log(`   ${stage.note}`);

    const lacking = missingPackages(stage);
    if (lacking.length) {
        console.log(`   ⏭ пропуск: нет пакетов - ${lacking.join(', ')}`);
        console.log('     поставить: cd backend && npm install');
        return { key: stage.key, status: 'skipped', reason: `нет пакетов: ${lacking.join(', ')}`, changed: [] };
    }

    // Отсутствующий вход - это не падение этапа, а причина его не запускать:
    // половина конвейера, прошедшая по пустым файлам, хуже непройденной.
    const reads = resolveList(stage.reads);
    const missing = reads.filter(f => !fs.existsSync(f));
    if (missing.length) {
        console.log(`   ⏭ пропуск: нет входных файлов - ${missing.map(rel).join(', ')}`);
        return { key: stage.key, status: 'skipped', reason: 'нет входных файлов', changed: [] };
    }

    const runs = stage.repeat ? stage.repeat() : [{ label: null, args: resolveList(stage.args) }];
    if (runs.length === 0) {
        console.log('   ⏭ пропуск: нечего запускать');
        return { key: stage.key, status: 'skipped', reason: 'нечего запускать', changed: [] };
    }

    let ms = 0;
    let failure = null;
    for (const r of runs) {
        const out = runOnce(stage.script, r.args, r.label);
        ms += out.ms ?? 0;
        if (!out.ok) {
            failure = out.error || `код возврата ${out.code}`;
            break;
        }
    }

    const writesAfter = snapshot(resolveList(stage.writes));
    const changed = [];
    for (const [file, after] of writesAfter) {
        const before = writesBefore.get(file);
        if (!before || !before.exists) {
            if (after.exists) changed.push({ file, kind: 'new', size: after.size });
        } else if (before.sha !== after.sha) {
            changed.push({ file, kind: 'changed', size: after.size, wasSize: before.size });
        }
    }

    if (failure) {
        console.log(`   ❌ ${failure}`);
        return { key: stage.key, status: 'failed', reason: failure, ms, changed };
    }

    console.log(`   ✅ за ${(ms / 1000).toFixed(1)} с`);
    return { key: stage.key, status: 'ok', ms, changed };
}

// ── Отчёт ────────────────────────────────────────────────────────────────────

function report(results) {
    console.log('\n');
    console.log('═'.repeat(64));
    console.log('ОТЧЁТ');
    console.log('═'.repeat(64));

    const MARK = { ok: '✅', failed: '❌', skipped: '⏭ ' };
    for (const r of results) {
        const time = r.ms ? `${(r.ms / 1000).toFixed(1)} с` : '-';
        const tail = r.reason ? `  ${r.reason}` : '';
        console.log(`  ${MARK[r.status]} ${r.key.padEnd(11)} ${time.padStart(8)}${tail}`);
    }

    const changed = results.flatMap(r => r.changed);
    console.log('');
    if (changed.length === 0) {
        console.log('  Ни один файл не изменился.');
        console.log('  Это ожидаемо, если входные данные те же: сборка повторяема, и');
        console.log('  повторный прогон на тех же данных даёт побайтово тот же результат.');
    } else {
        console.log(`  Изменённых файлов: ${changed.length}`);
        for (const c of changed) {
            const delta = c.kind === 'new'
                ? 'новый'
                // Размер может совпасть при другом содержимом - правка в исходных
                // данных без изменения длины записи. Молчать об этом нельзя:
                // «было 4225 КБ, стало 4225 КБ» читается как «ничего не поменялось».
                : c.wasSize === c.size
                    ? `${kb(c.size)}, размер тот же, содержимое другое`
                    : `было ${kb(c.wasSize)}, стало ${kb(c.size)}`;
            console.log(`    ${c.kind === 'new' ? '+' : 'M'} ${rel(c.file)}  (${delta})`);
        }
        console.log('');
        console.log('  Закоммитить:');
        console.log(`    git add ${changed.map(c => rel(c.file)).join(' ')}`);
        console.log('');
        console.log('  После деплоя бутстрап увидит новый отпечаток файлов и разольёт их');
        console.log('  в базу сам. Смотреть: docker compose logs -f backend');
    }

    const failed = results.filter(r => r.status === 'failed');
    if (failed.length) {
        console.log('');
        console.log(`  Упало этапов: ${failed.length} (${failed.map(r => r.key).join(', ')})`);
        console.log('  Файлы упавших этапов остались в прежнем виде.');
    }
    console.log('═'.repeat(64));

    return failed.length === 0;
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
    if (has('list')) {
        console.log('Этапы конвейера, в порядке выполнения:\n');
        for (const s of STAGES) {
            const net = s.network ? '  [сеть, нужен --fetch]' : '';
            console.log(`  ${s.key.padEnd(11)} ${s.title}${net}`);
        }
        console.log('\nВ базу ни один из них не пишет: это делает бутстрап при старте контейнера.');
        return true;
    }

    const selected = STAGES.filter(s => {
        if (ONLY.length) return ONLY.includes(s.key);
        if (SKIP.includes(s.key)) return false;
        if (s.network && !WITH_FETCH) return false;
        return true;
    });

    if (selected.length === 0) {
        console.log('Нечего запускать: под выбранные ключи не подошёл ни один этап.');
        console.log('Список этапов: --list');
        return true;
    }

    console.log('Локальный конвейер данных Y.Map');
    console.log(`Этапов к выполнению: ${selected.length} из ${STAGES.length}`);
    if (!WITH_FETCH && !ONLY.length) {
        console.log('Сетевые этапы выключены. Включить: --fetch');
    }
    console.log('В базу ничего не пишется: это делает бутстрап при старте контейнера.');

    const results = [];
    for (const stage of selected) {
        const r = runStage(stage);
        results.push(r);
        if (r.status === 'failed' && !KEEP_GOING) {
            console.log('\n   Остановка. Продолжить несмотря на падение: --continue');
            // Этапы, до которых не дошли, показываются в отчёте как пропущенные:
            // молча исчезнувший этап читался бы как выполненный.
            for (const rest of selected.slice(selected.indexOf(stage) + 1)) {
                results.push({ key: rest.key, status: 'skipped', reason: 'не дошли', changed: [] });
            }
            break;
        }
    }

    return report(results);
}

const ok = main();
process.exit(ok ? 0 : 1);
