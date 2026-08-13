/**
 * backend/src/scripts/probe-duasr-pagination.js
 *
 * Разведка выгрузок duasr.uz. Ничего не пишет в базу и ничего не качает целиком:
 * задаёт серию коротких вопросов трём эндпоинтам и складывает ответы в отчёт.
 *
 * Зачем отдельный шаг. Сейчас известно ровно одно: GET на голый адрес отдаёт
 * массив, и в нём 400 строк при заведомо большем реестре. Из этого нельзя
 * заключить, что 400 - потолок выдачи: столько же вернулось бы, если у реестра
 * есть постраничная выдача с таким размером страницы по умолчанию, и столько же
 * - если сервер режет ответ по времени. Разные причины требуют разных сборщиков,
 * а угадывать здесь нечего.
 *
 * Скрипт гоняется локально, как и остальные скрипты данных: у контейнера бэкенда
 * нет прав на запись в src/data, а duasr.uz может быть недоступен из сети
 * сборки.
 *
 * Запуск:
 *   node backend/src/scripts/probe-duasr-pagination.js
 *   node backend/src/scripts/probe-duasr-pagination.js --source=maktab44
 *   node backend/src/scripts/probe-duasr-pagination.js --delay=1500 --timeout=45000
 *
 * Параметры:
 *   --source=ssv|bogcha|maktab44|all   что опрашивать, по умолчанию all
 *   --delay=<мс>                       пауза между запросами, по умолчанию 800
 *   --timeout=<мс>                     таймаут одного запроса, по умолчанию 30000
 *   --out=<путь>                       куда положить отчёт
 *   --quiet                            без построчного вывода
 *
 * Зависимостей нет: глобальный fetch (Node 18+) и стандартная библиотека.
 *
 * ── Что именно выясняется ────────────────────────────────────────────────────
 *
 * 1. Опорный запрос. Сколько строк отдаёт голый адрес, какие заголовки приходят,
 *    сколько это занимает. Всё остальное сравнивается с ним.
 *
 * 2. Заголовки счёта: X-Total-Count, Content-Range, Link. Если сервер сам
 *    называет размер реестра, дальше гадать не о чем.
 *
 * 3. Понимает ли сервер параметры постраничной выдачи. Проверяются восемь
 *    распространённых пар имён.
 *
 *    Ключевая деталь - контрольный опыт. Отдельно задаётся запрос с заведомо
 *    несуществующим параметром (zzz_nonexistent=7). Без него нельзя отличить
 *    "limit не поддерживается" от "limit поддерживается, но упирается в тот же
 *    потолок": в обоих случаях приходит одно и то же число строк. Если мусорный
 *    параметр меняет ответ - сервер реагирует на что угодно, и совпадение по
 *    limit ничего не доказывает. Если не меняет, а limit меняет - параметр
 *    настоящий.
 *
 * 4. Устойчивость порядка строк. Один и тот же запрос задаётся дважды с паузой,
 *    и последовательности идентификаторов сравниваются. Постраничная сборка по
 *    смещению верна только при устойчивом порядке: если сервер тасует строки
 *    между запросами, страницы дадут пропуски и повторы, и такую выгрузку нужно
 *    собирать по разрезу, а не по смещению.
 *
 * 5. Разрез по территории: code, parent_code, viloyat, tuman. Если фильтр
 *    работает, постраничная выдача не нужна вовсе - реестр забирается 14
 *    порциями по областям или 198 по районам, и каждая порция заведомо меньше
 *    потолка. Это лучший исход разведки, и проверяется он раньше, чем строится
 *    сборщик.
 *
 * 6. Прочие имена параметров, которые встречаются у выгрузок на том же движке:
 *    all, full, format, fields.
 *
 * Отчёт ложится в backend/src/data/probe-duasr-report.json.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const SOURCES = {
    ssv: 'https://duasr.uz/api4/ssv',
    bogcha: 'https://duasr.uz/api4/bogcha',
    maktab44: 'https://duasr.uz/api4/maktab44'
};

function arg(name) {
    const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
}

function has(name) {
    return process.argv.slice(2).includes(`--${name}`);
}

const QUIET = has('quiet');
const DELAY = Number(arg('delay')) || 800;
const TIMEOUT = Number(arg('timeout')) || 30000;

const log = (...a) => { if (!QUIET) console.log(...a); };

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Один запрос. Возвращает описание ответа, а не бросает исключение: неудача -
 * такой же результат разведки, как удача, и она должна попасть в отчёт.
 */
async function ask(url, params = {}) {
    const target = new URL(url);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, String(v));

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
        const res = await fetch(target.toString(), {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        const text = await res.text();
        const ms = Date.now() - started;

        // Заголовки, которые могут назвать размер реестра или указать на
        // следующую страницу.
        const headers = {};
        for (const name of ['x-total-count', 'content-range', 'link', 'content-type', 'x-pagination-total']) {
            const v = res.headers.get(name);
            if (v) headers[name] = v;
        }

        let payload = null;
        let parseError = null;
        try {
            payload = JSON.parse(text);
        } catch (err) {
            parseError = err.message;
        }

        const rows = rowsOf(payload);

        return {
            url: target.toString(),
            ok: res.ok,
            status: res.status,
            ms,
            bytes: text.length,
            headers,
            parseError,
            // Форма ответа важна отдельно от содержимого: обёртка с полем total
            // решает задачу так же, как заголовок.
            shape: payload === null ? 'unparsed' : Array.isArray(payload) ? 'array' : typeof payload,
            envelopeKeys: payload && !Array.isArray(payload) && typeof payload === 'object'
                ? Object.keys(payload).slice(0, 20)
                : null,
            rowCount: rows ? rows.length : null,
            firstId: rows?.[0] ? idOf(rows[0]) : null,
            lastId: rows?.length ? idOf(rows[rows.length - 1]) : null,
            // Отпечаток порядка, а не всего ответа: сравнивать нужно
            // последовательность строк, а не их содержимое.
            idSample: rows ? rows.slice(0, 25).map(idOf) : null
        };
    } catch (err) {
        return {
            url: target.toString(),
            ok: false,
            status: null,
            ms: Date.now() - started,
            error: err.name === 'AbortError' ? `таймаут ${TIMEOUT} мс` : err.message
        };
    } finally {
        clearTimeout(timer);
    }
}

/** Строки из ответа. Голый массив сегодня, обёртки - на случай смены формата. */
function rowsOf(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ['data', 'result', 'items', 'rows', 'records']) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return null;
}

/**
 * Идентификатор строки. id - настоящий ключ реестра, code - территориальный,
 * _uid_ - порядковый номер в ответе и ключом не является: он меняется вместе с
 * порядком и для сравнения последовательностей бесполезен.
 */
function idOf(row) {
    if (row?.id != null) return row.id;
    if (row?.code != null) return row.code;
    if (row?.inn != null) return row.inn;
    return null;
}

const same = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

// ── Проверки ─────────────────────────────────────────────────────────────────

const PAGING_PARAMS = [
    { name: 'limit/offset', probe: { limit: 5 }, second: { limit: 5, offset: 5 } },
    { name: 'page/per_page', probe: { per_page: 5 }, second: { per_page: 5, page: 2 } },
    { name: 'page/size', probe: { size: 5 }, second: { size: 5, page: 2 } },
    { name: 'start/length', probe: { length: 5 }, second: { length: 5, start: 5 } },
    { name: 'skip/take', probe: { take: 5 }, second: { take: 5, skip: 5 } },
    { name: '_start/_limit', probe: { _limit: 5 }, second: { _limit: 5, _start: 5 } },
    { name: 'count/from', probe: { count: 5 }, second: { count: 5, from: 5 } },
    { name: 'rows/page', probe: { rows: 5 }, second: { rows: 5, page: 2 } }
];

const FILTER_PARAMS = [
    // Значения взяты из уже лежащих на диске выгрузок: 1735 - parent_code
    // Каракалпакстана в maktab44, 1735211 - code конкретной школы.
    { name: 'code', params: { code: 1735211 } },
    { name: 'parent_code', params: { parent_code: 1735 } },
    { name: 'viloyat', params: { viloyat: "Qoraqolpog'iston Respublikasi" } },
    { name: 'tuman', params: { tuman: 'Qorao‘zak tumani' } },
    { name: 'region', params: { region: 1735 } }
];

const MISC_PARAMS = [
    { name: 'all=1', params: { all: 1 } },
    { name: 'full=1', params: { full: 1 } },
    { name: 'format=json', params: { format: 'json' } },
    { name: 'fields=id', params: { fields: 'id' } }
];

async function probeSource(key, url) {
    log(`\n━━ ${key} ${url}`);
    const result = { source: key, url, checks: {} };

    // ── 1. Опорный запрос ────────────────────────────────────────────────────
    const base = await ask(url);
    result.baseline = base;
    log(`  опорный: ${base.status ?? '-'} · строк ${base.rowCount ?? '-'} · ${base.bytes ?? 0} байт · ${base.ms} мс`);
    if (Object.keys(base.headers ?? {}).length) {
        log(`  заголовки: ${JSON.stringify(base.headers)}`);
    }
    if (!base.ok || base.rowCount === null) {
        result.verdict = 'опорный запрос не удался, остальные проверки пропущены';
        log(`  ✗ ${base.error ?? 'ответ не разобран'} - дальше идти не с чем`);
        return result;
    }
    const baseCount = base.rowCount;
    await sleep(DELAY);

    // ── 2. Контрольный опыт ──────────────────────────────────────────────────
    // Мусорный параметр. Если ответ на него отличается от опорного, сервер
    // реагирует на любую примесь в строке запроса, и совпадения по настоящим
    // параметрам ничего не доказывают.
    const control = await ask(url, { zzz_nonexistent: 7 });
    result.checks.control = {
        rowCount: control.rowCount,
        changed: control.rowCount !== baseCount,
        note: control.rowCount !== baseCount
            ? 'мусорный параметр изменил ответ - выводы по остальным параметрам ненадёжны'
            : 'мусорный параметр ответ не изменил - реакция на настоящие параметры значима'
    };
    log(`  контроль (мусорный параметр): строк ${control.rowCount ?? '-'} → ${result.checks.control.note}`);
    const controlIsClean = !result.checks.control.changed;
    await sleep(DELAY);

    // ── 3. Устойчивость порядка ──────────────────────────────────────────────
    const repeat = await ask(url);
    result.checks.orderStable = {
        firstIdSame: repeat.firstId === base.firstId,
        sampleSame: same(repeat.idSample, base.idSample),
        rowCountSame: repeat.rowCount === baseCount
    };
    const stable = result.checks.orderStable.sampleSame && result.checks.orderStable.rowCountSame;
    result.checks.orderStable.note = stable
        ? 'порядок строк повторяется - сборка по смещению допустима'
        : 'порядок строк меняется между запросами - сборка по смещению даст пропуски и повторы, нужен разрез';
    log(`  порядок: ${stable ? 'устойчив' : 'ПЛАВАЕТ'} → ${result.checks.orderStable.note}`);
    await sleep(DELAY);

    // ── 4. Параметры постраничной выдачи ─────────────────────────────────────
    result.checks.paging = [];
    for (const p of PAGING_PARAMS) {
        const first = await ask(url, p.probe);
        await sleep(DELAY);

        // Параметр считается понятым, только если размер выдачи стал ровно
        // запрошенным. Просто "меньше опорного" не годится: столько же вернул бы
        // сервер, отдающий короткий ответ по любой другой причине.
        const respected = first.rowCount === 5;
        const entry = {
            name: p.name,
            probeParams: p.probe,
            status: first.status,
            rowCount: first.rowCount,
            respected
        };

        if (respected) {
            // Второй шаг: сдвиг. Параметр размера без работающего сдвига
            // бесполезен - он ограничивает выдачу, но не даёт дойти до конца.
            const second = await ask(url, p.second);
            await sleep(DELAY);
            entry.secondParams = p.second;
            entry.secondRowCount = second.rowCount;
            entry.secondFirstId = second.firstId;
            entry.offsetWorks = second.rowCount === 5 && second.firstId !== first.firstId;
            entry.note = entry.offsetWorks
                ? 'размер и сдвиг работают - страницы собираются этой парой'
                : 'размер работает, сдвиг нет - до конца реестра этим не дойти';
        } else {
            entry.note = 'параметр не влияет на размер выдачи';
        }

        result.checks.paging.push(entry);
        log(`  ${p.name}: строк ${first.rowCount ?? '-'} → ${entry.note}`);
    }

    // ── 5. Разрез по территории ──────────────────────────────────────────────
    // Лучший исход: реестр забирается порциями по областям или районам, и
    // постраничная выдача не нужна вовсе.
    result.checks.filters = [];
    for (const f of FILTER_PARAMS) {
        const res = await ask(url, f.params);
        await sleep(DELAY);
        const works = res.rowCount !== null && res.rowCount > 0 && res.rowCount < baseCount;
        const entry = {
            name: f.name,
            params: f.params,
            status: res.status,
            rowCount: res.rowCount,
            works,
            note: works
                ? 'фильтр сузил выдачу - реестр можно забирать порциями по территории'
                : res.rowCount === baseCount
                    ? 'выдача не изменилась - фильтр не поддерживается'
                    : 'выдача пуста или запрос не удался'
        };
        result.checks.filters.push(entry);
        log(`  фильтр ${f.name}: строк ${res.rowCount ?? '-'} → ${entry.note}`);
    }

    // ── 6. Прочие имена ──────────────────────────────────────────────────────
    result.checks.misc = [];
    for (const m of MISC_PARAMS) {
        const res = await ask(url, m.params);
        await sleep(DELAY);
        const entry = {
            name: m.name,
            status: res.status,
            rowCount: res.rowCount,
            changed: res.rowCount !== baseCount
        };
        result.checks.misc.push(entry);
        log(`  ${m.name}: строк ${res.rowCount ?? '-'}${entry.changed ? ' (ответ изменился)' : ''}`);
    }

    // ── Итог по источнику ────────────────────────────────────────────────────
    const workingPaging = result.checks.paging.filter(p => p.offsetWorks).map(p => p.name);
    const workingFilters = result.checks.filters.filter(f => f.works).map(f => f.name);
    const declaredTotal = base.headers?.['x-total-count'] || base.headers?.['content-range'] || null;

    result.verdict = {
        baselineRows: baseCount,
        declaredTotal,
        orderStable: stable,
        controlClean: controlIsClean,
        workingPaging,
        workingFilters,
        strategy: workingFilters.length
            ? `разрез по ${workingFilters[0]} - забирать порциями, постраничная выдача не нужна`
            : workingPaging.length
                ? stable
                    ? `постраничная сборка парой ${workingPaging[0]}`
                    : `пара ${workingPaging[0]} работает, но порядок строк плавает - страницы дадут пропуски`
                : declaredTotal
                    ? 'параметры не отвечают, но сервер называет размер реестра - см. заголовки'
                    : 'ни постраничной выдачи, ни разреза не обнаружено - сборщик строится на другом основании'
    };

    log(`  ▸ ${result.verdict.strategy}`);
    return result;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    const only = arg('source') || 'all';
    const keys = only === 'all' ? Object.keys(SOURCES) : [only];

    for (const k of keys) {
        if (!SOURCES[k]) {
            console.error(`❌ неизвестный источник: ${k}. Доступны: ${Object.keys(SOURCES).join(', ')}, all`);
            process.exit(1);
        }
    }

    if (typeof fetch !== 'function') {
        console.error('❌ глобальный fetch недоступен - нужен Node 18 или новее');
        process.exit(1);
    }

    log('Разведка выгрузок duasr.uz');
    log(`пауза между запросами ${DELAY} мс, таймаут ${TIMEOUT} мс`);
    log('в базу ничего не пишется, реестры целиком не качаются');

    const report = {
        probedAt: new Date().toISOString(),
        delayMs: DELAY,
        timeoutMs: TIMEOUT,
        nodeVersion: process.version,
        sources: []
    };

    for (const k of keys) {
        report.sources.push(await probeSource(k, SOURCES[k]));
        await sleep(DELAY);
    }

    const outPath = arg('out') || path.join(DATA_DIR, 'probe-duasr-report.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

    log('\n━━ Итог');
    for (const s of report.sources) {
        const v = s.verdict;
        if (typeof v === 'string') {
            log(`  ${s.source}: ${v}`);
            continue;
        }
        log(`  ${s.source}: строк ${v.baselineRows}, порядок ${v.orderStable ? 'устойчив' : 'плавает'}`);
        log(`    → ${v.strategy}`);
    }
    log(`\n✅ отчёт: ${outPath}`);
}

main().catch(err => {
    console.error('❌ разведка прервана:', err.message);
    process.exit(1);
});
