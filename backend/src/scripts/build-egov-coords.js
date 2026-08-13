/**
 * backend/src/scripts/build-egov-coords.js
 *
 * Соединяет объекты реестров duasr.uz с координатами из выгрузок data.egov.uz по
 * ИНН и пишет результат файлом. В базу не ходит вообще.
 *
 * Раскладка та же, что у остальных данных проекта: скрипт готовит жсонку
 * локально, жсонка коммитится и приезжает внутрь образа, а этап `coords` в
 * services/data-bootstrap.js разливает её в Mongo при старте контейнера. Ни один
 * скрипт в базу не пишет; ни один этап бутстрапа ничего не вычисляет.
 *
 * Что это даёт помимо соблюдения раскладки: назначение координаты становится
 * проверяемым. Строка в git показывает, какой объект получил какую точку и
 * почему, и подмена координаты видна в diff, а не только в состоянии базы.
 *
 * Вход:
 *   data/ssv.json, data/bogcha.json, data/maktab44.json   - объекты с ИНН
 *   data/egov-*.json                                      - строки с координатами
 *
 * Выход:
 *   data/object-coords.json
 *
 * Запуск:
 *   node backend/src/scripts/build-egov-coords.js
 *   node backend/src/scripts/build-egov-coords.js --file=egov-6107f0572a2e256d868e8766.json
 *   node backend/src/scripts/build-egov-coords.js --out=/tmp/coords.json
 *
 * ── Почему ИНН, и почему не везде ────────────────────────────────────────────
 *
 * У bogcha `inn` уникален: 395 заполненных значений, все различны, и 342 из 400
 * записей находят строку с пригодной координатой. У ssv и maktab44 он
 * повторяется - 392 записи ssv делят 166 ИНН, потому что сельские пункты сидят
 * под одним юридическим лицом. Такие записи принимаются только тогда, когда ИНН
 * указывает на одну строку.
 *
 * Правило неоднозначности: когда один ИНН указывает на несколько строк,
 * координата принимается, только если все кандидаты лежат в пределах
 * AMBIGUITY_RADIUS_M друг от друга. Обычно не лежат - наблюдаемый разброс
 * доходит до 885 км, - и тогда запись остаётся без координаты и получает отметку
 * вместо правдоподобной неверной точки.
 *
 * ── Чего этот скрипт не решает ───────────────────────────────────────────────
 *
 * Защита координат, выставленных человеком (field_verified, manual), сюда не
 * входит: их источник известен только базе. Это проверка времени записи, и она
 * живёт в этапе бутстрапа, где выражена условием запроса, а не сравнением после
 * чтения.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Кандидаты дальше этого расстояния считаются разными местами.
const AMBIGUITY_RADIUS_M = 500;

// Файл объектов -> ключ источника и тип. Те же значения, что проставляет
// import-objects.js: пара (sourceApi, sourceId) - это ключ документа в Mongo, и
// расхождение здесь развалило бы соединение молча.
const SOURCES = [
    { file: 'ssv.json', sourceApi: 'ssv', objectType: 'health_post' },
    { file: 'bogcha.json', sourceApi: 'bogcha', objectType: 'kindergarten' },
    { file: 'maktab44.json', sourceApi: 'maktab44', objectType: 'school' }
];

function arg(name) {
    const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
}

// ── Расстояние ───────────────────────────────────────────────────────────────

function haversineM(a, b) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function maxSpreadM(points) {
    let max = 0;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const d = haversineM(points[i], points[j]);
            if (d > max) max = d;
        }
    }
    return max;
}

// ── Выгрузки egov ────────────────────────────────────────────────────────────

function listEgovFiles(only) {
    if (only) {
        const p = path.join(DATA_DIR, only);
        if (!fs.existsSync(p)) throw new Error(`${only} нет в ${DATA_DIR}`);
        return [only];
    }
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('egov-') && f.endsWith('.json'))
        // Выгрузки каталога - это метаданные о наборах, а не строки набора.
        .filter(f => !f.startsWith('egov-catalog') && !f.startsWith('egov-datasets'))
        .sort();
}

/**
 * Строит Map<ИНН, кандидаты> и счётчик использования точек.
 *
 * Счётчик нужен затем, что в негосударственном реестре 640 координат несут 1441
 * объект, а одна из них - тридцать сразу: это один клик по карте, размноженный
 * по записям. Такая координата - действительная пара чисел, указывающая на
 * неизвестное место, и точной она не называется.
 */
function buildIndex(files) {
    const byInn = new Map();
    const pointUse = new Map();
    let rowsRead = 0;
    let rowsUsable = 0;

    for (const file of files) {
        const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
        for (const r of rows) {
            rowsRead++;
            // Ориентация координат чинится на этапе выгрузки, здесь читается
            // готовый признак: столбцы у разных публикаторов местами меняются.
            if (r.coordStatus !== 'ok' && r.coordStatus !== 'ok_swapped') continue;
            if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
            rowsUsable++;

            const inn = r.ID != null ? String(r.ID) : null;
            if (!inn) continue;

            const key = `${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
            pointUse.set(key, (pointUse.get(key) || 0) + 1);

            if (!byInn.has(inn)) byInn.set(inn, []);
            byInn.get(inn).push({ lat: r.lat, lon: r.lon, pointKey: key, file, name: r.Nomi });
        }
    }

    console.log(`  📂 файлов ${files.length}, строк ${rowsRead}, с пригодной координатой ${rowsUsable}`);
    console.log(`  🔑 различных ИНН ${byInn.size}`);

    return { byInn, pointUse };
}

// ── Объекты реестров ─────────────────────────────────────────────────────────

function loadObjects() {
    const objects = [];
    const inputs = {};

    for (const src of SOURCES) {
        const p = path.join(DATA_DIR, src.file);
        if (!fs.existsSync(p)) {
            console.warn(`  ⚠️  ${src.file} не найден, источник пропущен`);
            inputs[src.file] = 0;
            continue;
        }
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        const rows = Array.isArray(raw) ? raw : (raw.data ?? []);
        inputs[src.file] = rows.length;

        for (const row of rows) {
            if (row.id == null) continue;
            objects.push({
                sourceApi: src.sourceApi,
                sourceId: row.id,
                objectType: src.objectType,
                inn: row.inn != null ? String(row.inn) : null
            });
        }
    }

    return { objects, inputs };
}

// ── Соединение ───────────────────────────────────────────────────────────────

export function buildEgovCoords({ file = null } = {}) {
    const egovFiles = listEgovFiles(file);
    if (egovFiles.length === 0) {
        throw new Error('в data/ нет ни одного egov-*.json - сначала fetch-egov-dataset.js');
    }

    const { byInn, pointUse } = buildIndex(egovFiles);
    const { objects, inputs } = loadObjects();
    console.log(`  🗂  объектов в реестрах ${objects.length}\n`);

    const coords = [];
    const ambiguous = [];
    const stats = { matched: 0, shared: 0, ambiguous: 0, unmatched: 0, noInn: 0 };
    const perType = new Map();

    for (const obj of objects) {
        const bucket = perType.get(obj.objectType) || { total: 0, matched: 0 };
        bucket.total++;
        perType.set(obj.objectType, bucket);

        if (!obj.inn) { stats.noInn++; continue; }

        const candidates = byInn.get(obj.inn);
        if (!candidates || candidates.length === 0) { stats.unmatched++; continue; }

        let chosen = candidates[0];
        if (candidates.length > 1) {
            const spread = maxSpreadM(candidates);
            if (spread > AMBIGUITY_RADIUS_M) {
                // Разброс записывается: по нему видно, насколько далеко разошлись
                // кандидаты, и это не то же самое, что «ИНН не найден».
                stats.ambiguous++;
                ambiguous.push({
                    sourceApi: obj.sourceApi,
                    sourceId: obj.sourceId,
                    candidates: candidates.length,
                    spreadM: Math.round(spread)
                });
                continue;
            }
        }

        const shared = (pointUse.get(chosen.pointKey) || 1) > 1;
        if (shared) stats.shared++;

        coords.push({
            sourceApi: obj.sourceApi,
            sourceId: obj.sourceId,
            lat: chosen.lat,
            lng: chosen.lon,
            // Общая координата - действительные числа, указывающие на неизвестное
            // место, поэтому точной она не называется.
            precision: shared ? 'approximate' : 'exact',
            shared
        });

        stats.matched++;
        bucket.matched++;
    }

    console.log('  Результат по типам объектов:');
    for (const [type, b] of perType) {
        const pct = b.total ? (100 * b.matched / b.total).toFixed(1) : '0.0';
        console.log(`    ${type.padEnd(14)} ${b.matched}/${b.total} (${pct} %)`);
    }
    console.log('');
    console.log(`    получили координату    ${stats.matched}`);
    console.log(`    из них общая точка     ${stats.shared}`);
    console.log(`    неоднозначный ИНН      ${stats.ambiguous}`);
    console.log(`    ИНН не найден          ${stats.unmatched}`);
    console.log(`    без ИНН                ${stats.noInn}`);

    return {
        // Метки времени здесь намеренно нет. Она меняла бы файл при каждом
        // прогоне даже на неизменных входных данных, а из этого следует три
        // неприятности разом: шум в diff, новый отпечаток для бутстрапа и лишний
        // переимпорт трёхсот сорока документов при старте контейнера. Когда файл
        // собран, знает git; что в нём лежит, знают поля ниже.
        //
        // Ровно то, из чего собран файл: по этим двум полям видно, устарел ли он
        // относительно того, что лежит рядом в каталоге.
        egovFiles,
        inputs,
        ambiguityRadiusM: AMBIGUITY_RADIUS_M,
        stats,
        // Порядок фиксирован, чтобы повторный прогон на тех же входных данных
        // давал побайтово тот же файл: иначе каждый прогон - это шум в diff и
        // новый отпечаток для бутстрапа.
        coords: coords.sort((a, b) =>
            a.sourceApi.localeCompare(b.sourceApi) || a.sourceId - b.sourceId),
        ambiguous: ambiguous.sort((a, b) =>
            a.sourceApi.localeCompare(b.sourceApi) || a.sourceId - b.sourceId)
    };
}

// ── Точка входа ──────────────────────────────────────────────────────────────

function main() {
    console.log('Соединение объектов с координатами data.egov.uz по ИНН');
    console.log('в базу ничего не пишется, результат кладётся файлом\n');

    const result = buildEgovCoords({ file: arg('file') });
    const outPath = arg('out') || path.join(DATA_DIR, 'object-coords.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`\n✅ ${outPath} (${kb} КБ)`);
    console.log('   закоммитьте файл: этап coords разольёт его в базу при старте контейнера');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (err) {
        console.error('❌', err.message);
        process.exit(1);
    }
}
