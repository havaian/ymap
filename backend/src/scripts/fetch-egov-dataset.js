/**
 * Fetches dataset rows from data.egov.uz and repairs the coordinate columns.
 *
 * Endpoint and request shape, taken from the portal front-end:
 *   POST /apiClient/Main/GetMainData?GuidId=<structId>
 *   body: { "guidId": "<structId>", "fields": {}, "limit": 20, "offset": 0 }
 *   -> { result: { tableFields: [...], count: <int>, data: [ { tableColumn: {...} } ] } }
 *
 * The portal sits behind a Huawei WAF. If HTTP 400 or 403 starts coming back on
 * requests that used to work, take the Cookie header from a live browser session
 * and pass it through:
 *   node ... --cookie="HWWAFSESID=...; HWWAFSESTIME=..."
 *   EGOV_COOKIE="..." node ...
 *
 * Known defects in the source data, handled here:
 *   - `latitude` holds longitude and `longitude` holds latitude (columns swapped)
 *   - some values lost their decimal point, e.g. 69291688 instead of 69.291688
 *   - some rows carry 0 / 0
 *   - the dedicated `Geopozitsiyasi` column exists but is empty everywhere, which
 *     is why the catalogue geoType flag misses datasets that do have coordinates
 *   - multilingual labels are shuffled between languages, so the orientation is
 *     decided by value range and not by column names
 *
 * Usage:
 *   node backend/src/scripts/fetch-egov-dataset.js --guid=6107f0572a2e256d868e8766
 *   node backend/src/scripts/fetch-egov-dataset.js --scan=egov-catalog.json --match=геопозиц
 *   node backend/src/scripts/fetch-egov-dataset.js --scan=egov-catalog.json
 *
 * Requires Node 18+ (global fetch).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const BASE_URL = 'https://data.egov.uz';
const DATA_PATH = '/apiClient/Main/GetMainData';

const DEFAULT_LIMIT = 200;
const DEFAULT_DELAY = 400;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 3000;
const MAX_PAGES = 5000;

// Stop a long scan instead of grinding through hundreds of identical failures.
const SCAN_FAILFAST_AFTER = 5;

// Uzbekistan bounding box, used to decide which column is which.
const UZ = { lonMin: 55.9, lonMax: 73.3, latMin: 37.1, latMax: 45.7 };

// ─────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────

function parseArgs() {
    const argv = process.argv.slice(2);
    const value = (name, fallback) => {
        const found = argv.find(a => a.startsWith(`--${name}=`));
        return found ? found.split('=').slice(1).join('=') : fallback;
    };
    return {
        guid: value('guid', null),
        scan: value('scan', null),
        match: value('match', null),
        cookie: value('cookie', process.env.EGOV_COOKIE || ''),
        limit: parseInt(value('limit', DEFAULT_LIMIT), 10),
        delay: parseInt(value('delay', DEFAULT_DELAY), 10),
        out: value('out', null)
    };
}

// ─────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl(guidId) {
    const url = new URL(BASE_URL + DATA_PATH);
    url.searchParams.set('GuidId', guidId);
    return url.toString();
}

function headersFor(guidId, cookie) {
    // Mirrors the portal front-end. Note accept is text/plain, not application/json.
    const h = {
        'accept': 'text/plain, */*',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        'referer': BASE_URL + '/ru/data/' + guidId,
        'origin': BASE_URL
    };
    if (cookie) h['cookie'] = cookie;
    return h;
}

class HttpError extends Error {
    constructor(status, bodyText) {
        super('HTTP ' + status);
        this.status = status;
        this.bodyText = bodyText;
    }
}

function isRetryable(err) {
    // Only transient failures. A 4xx answers the same way every time, so
    // repeating it just burns minutes.
    if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
    return true; // network level failure
}

async function getPage({ guidId, limit, offset, cookie }, attempt = 1) {
    const body = { guidId, fields: {}, limit, offset };
    try {
        const res = await fetch(buildUrl(guidId), {
            method: 'POST',
            headers: headersFor(guidId, cookie),
            body: JSON.stringify(body)
        });
        const text = await res.text();
        if (!res.ok) throw new HttpError(res.status, text);
        const payload = JSON.parse(text);
        const r = payload?.result;
        if (!r || !Array.isArray(r.data)) return null;
        return {
            fields: Array.isArray(r.tableFields) ? r.tableFields : [],
            count: Number.isInteger(r.count) ? r.count : r.data.length,
            rows: r.data
        };
    } catch (err) {
        if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
        const wait = RETRY_BACKOFF * attempt;
        console.warn('    retry ' + attempt + '/' + (MAX_RETRIES - 1) + ' in ' + wait + 'ms (' + err.message + ')');
        await sleep(wait);
        return getPage({ guidId, limit, offset, cookie }, attempt + 1);
    }
}

function explain(err) {
    if (!(err instanceof HttpError)) return err.message;
    let hint = '';
    if (err.status === 400) hint = '  (сервер не принял тело запроса)';
    if (err.status === 401 || err.status === 403) hint = '  (нужны куки живой сессии, --cookie=)';
    if (err.status === 429) hint = '  (слишком часто, поднимите --delay)';
    const body = (err.bodyText || '').replace(/\s+/g, ' ').slice(0, 400);
    return err.message + hint + (body ? '\n    ответ сервера: ' + body : '');
}

// ─────────────────────────────────────────────
// Flattening
// ─────────────────────────────────────────────

/**
 * tableColumn values look like { text: {uzbText,...}|null, number, data, default }.
 * `default` carries the usable value for every type seen so far. The multilingual
 * block is kept as is, without trusting the language labels: in this source the
 * Uzbek and Russian fields are frequently swapped.
 */
function flatten(record) {
    const out = { _id: record.id, _dateTime: record.dateTime, _userId: record.userId };
    for (const [name, cell] of Object.entries(record.tableColumn || {})) {
        out[name] = cell?.default ?? null;
        if (cell?.text && typeof cell.text === 'object') out[name + '__i18n'] = cell.text;
    }
    return out;
}

// ─────────────────────────────────────────────
// Coordinate repair
// ─────────────────────────────────────────────

/**
 * Numeric columns are not always typed as numbers. The private preschool dataset
 * stores coordinates as strings ("60.650146484375"), so coerce before anything.
 */
function toNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const n = parseFloat(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function rescale(v) {
    const n = toNumber(v);
    if (n === null || n === 0) return { value: n, repaired: false };
    let x = Math.abs(n);
    let steps = 0;
    while (x > 180 && steps < 12) { x /= 10; steps++; }
    if (steps === 0) return { value: n, repaired: false };
    return { value: Math.sign(n) * x, repaired: true };
}

const inLon = v => v >= UZ.lonMin && v <= UZ.lonMax;
const inLat = v => v >= UZ.latMin && v <= UZ.latMax;

/**
 * Column names for coordinates are not consistent across publishers. Observed so
 * far: latitude/longitude, Latitude/Longitude, Kenglik/Uzunlik, Uzunligi.
 * Some datasets carry two pairs at once (Agrobank), so candidate pairs are scored
 * by how many rows actually hold a usable number and the best pair wins.
 */
function detectCoordFields(fields, rows) {
    const names = fields.map(f => f.name);
    const latRe = /^lat|kenglik|широт/i;
    const lonRe = /^lon|^lng|uzunli|долгот/i;

    const lats = names.filter(n => latRe.test(n));
    const lons = names.filter(n => lonRe.test(n));
    if (lats.length === 0 || lons.length === 0) return null;

    let best = null;
    for (const a of lats) {
        for (const b of lons) {
            let filled = 0;
            for (const r of rows) {
                const va = toNumber(r[a]);
                const vb = toNumber(r[b]);
                if (va !== null && vb !== null && va !== 0 && vb !== 0) filled++;
            }
            if (!best || filled > best.filled) best = { a, b, filled };
        }
    }
    return best;
}

function repairCoordinates(rows, fieldA = 'latitude', fieldB = 'longitude') {
    let repaired = 0;
    const pairs = [];

    for (const r of rows) {
        const a = rescale(r[fieldA]);
        const b = rescale(r[fieldB]);
        if (a.repaired || b.repaired) repaired++;
        r[fieldA + '_raw'] = r[fieldA];
        r[fieldB + '_raw'] = r[fieldB];
        pairs.push({ row: r, a: a.value, b: b.value });
    }

    // Uzbekistan spans latitude 37.1-45.7 and longitude 55.9-73.3. The two ranges
    // do not overlap, so for any given row only one orientation can be valid and
    // the decision is made per row rather than for the whole dataset. In the state
    // preschool registry 450 rows of 6780 are stored correctly while the rest are
    // swapped, and a dataset-wide decision throws those 450 away.
    let asIs = 0, swapped = 0, valid = 0, zero = 0, outside = 0;

    for (const p of pairs) {
        const a = p.a;
        const b = p.b;
        if (a === null || b === null || (a === 0 && b === 0)) {
            p.row.lat = null; p.row.lon = null; p.row.coordStatus = 'missing'; zero++; continue;
        }
        if (inLat(a) && inLon(b)) {
            p.row.lat = a; p.row.lon = b; p.row.coordStatus = 'ok'; asIs++; valid++; continue;
        }
        if (inLon(a) && inLat(b)) {
            p.row.lat = b; p.row.lon = a; p.row.coordStatus = 'ok_swapped'; swapped++; valid++; continue;
        }
        p.row.lat = null; p.row.lon = null; p.row.coordStatus = 'outside_uz'; outside++;
    }

    return { asIs, swapped, repaired, valid, zero, outside, total: rows.length };
}

// ─────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────

const fieldNames = fields => fields.map(f => f.name);

function looksGeographic(fields) {
    const names = fieldNames(fields).map(n => n.toLowerCase());
    const hasLat = names.some(n => n.includes('lat') || n.includes('kenglik') || n.includes('широт'));
    const hasLon = names.some(n => n.includes('lon') || n.includes('uzunlik') || n.includes('долгот'));
    return hasLat && hasLon;
}

/**
 * Scan mode: asks each dataset for a single row and reports which ones really
 * carry coordinate columns. This replaces the catalogue geoType flag, which keys
 * off the empty Geopozitsiyasi column and therefore misses most of them.
 */
async function runScan({ scan, match, delay, cookie }) {
    const catalogPath = path.isAbsolute(scan) ? scan : path.join(DATA_DIR, scan);
    const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));

    const ru = f => (f || {}).rusText || (f || {}).uzbText || '';
    let targets = catalog;
    if (match) {
        const re = new RegExp(match, 'i');
        targets = catalog.filter(r => re.test(ru(r.dataName)));
    }
    console.log('Проверяю ' + targets.length + ' наборов из ' + catalog.length);

    const found = [];
    let consecutiveFailures = 0;
    let failedTotal = 0;
    let lastError = null;

    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        process.stdout.write('\r  ' + (i + 1) + '/' + targets.length + '  с координатами: ' + found.length + '   ');
        try {
            const page = await getPage({ guidId: t.structId, limit: 1, offset: 0, cookie });
            consecutiveFailures = 0;
            if (page && looksGeographic(page.fields)) {
                found.push({
                    structId: t.structId,
                    name: t.name,
                    dataName: ru(t.dataName),
                    orgName: ru(t.orgName),
                    rows: t.fullCount,
                    lastUpdate: t.lastUpdate,
                    fields: fieldNames(page.fields)
                });
            }
        } catch (err) {
            consecutiveFailures++;
            failedTotal++;
            lastError = err;
            if (consecutiveFailures >= SCAN_FAILFAST_AFTER) {
                process.stdout.write('\n');
                console.error('\nОстановлено: ' + consecutiveFailures + ' отказов подряд.');
                console.error(explain(err));
                return;
            }
        }
        await sleep(delay);
    }
    process.stdout.write('\n');

    await fs.mkdir(DATA_DIR, { recursive: true });
    const outPath = path.join(DATA_DIR, 'egov-datasets-with-coords.json');
    await fs.writeFile(outPath, JSON.stringify(found, null, 2), 'utf8');

    console.log('\nНаборы с колонками координат: ' + found.length);
    const top = found.sort((a, b) => (b.rows || 0) - (a.rows || 0)).slice(0, 40);
    for (const f of top) {
        console.log('  ' + String(f.rows).padStart(7) + '  ' + (f.lastUpdate || '').slice(0, 10) +
            '  ' + f.name + '  ' + f.dataName.slice(0, 70));
        console.log('           ' + f.orgName.slice(0, 85));
    }
    if (failedTotal > 0) {
        console.log('\nНе ответили: ' + failedTotal + '. Последняя ошибка: ' + explain(lastError).split('\n')[0]);
    }
    console.log('\nЗаписано: ' + outPath);
}

async function runFetch({ guid, limit, delay, out, cookie }) {
    console.log('Набор ' + guid);

    const first = await getPage({ guidId: guid, limit, offset: 0, cookie });
    if (!first) throw new Error('неожиданная форма ответа');

    const total = first.count;
    console.log('  count=' + total + ', первая страница ' + first.rows.length + ' строк');
    console.log('  колонки: ' + fieldNames(first.fields).join(', '));

    const rows = [...first.rows];
    let offset = rows.length;

    for (let page = 0; page < MAX_PAGES && offset < total; page++) {
        await sleep(delay);
        const got = await getPage({ guidId: guid, limit, offset, cookie });
        if (!got || got.rows.length === 0) break;
        rows.push(...got.rows);
        offset += got.rows.length;
        process.stdout.write('\r  ' + rows.length + '/' + total + '   ');
    }
    process.stdout.write('\n');

    const byId = new Map();
    for (const r of rows.map(flatten)) byId.set(r._id, r);
    const unique = [...byId.values()];
    if (unique.length !== rows.length) {
        console.log('  отброшено дубликатов: ' + (rows.length - unique.length));
    }

    const names = fieldNames(first.fields);
    const coordFields = detectCoordFields(first.fields, unique);
    if (coordFields) {
        const s = repairCoordinates(unique, coordFields.a, coordFields.b);
        console.log('\n  координаты: колонки ' + coordFields.a + ' / ' + coordFields.b);
        console.log('    ориентация построчно: как есть ' + s.asIs + ', переставлено ' + s.swapped);
        console.log('    восстановлено с потерянной точкой: ' + s.repaired);
        console.log('    пригодных: ' + s.valid + ' из ' + s.total + ' (' + (100 * s.valid / s.total).toFixed(1) + ' %)');
        console.log('    нули или пустые: ' + s.zero);
        console.log('    вне границ Узбекистана: ' + s.outside);
    } else {
        console.log('\n  колонок с координатами не найдено');
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    const outPath = out
        ? (path.isAbsolute(out) ? out : path.join(DATA_DIR, out))
        : path.join(DATA_DIR, 'egov-' + guid + '.json');
    await fs.writeFile(outPath, JSON.stringify(unique), 'utf8');

    console.log('\n  получено ' + unique.length + ' из ' + total);
    console.log('  записано: ' + outPath);
    if (unique.length < total) {
        console.log('\n  ВНИМАНИЕ: выкачано меньше, чем сообщил сервер.');
    }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
    const args = parseArgs();

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее: глобального fetch нет.');
        process.exit(1);
    }
    if (!args.guid && !args.scan) {
        console.error('Укажите --guid=<structId> или --scan=<файл каталога>');
        process.exit(1);
    }

    if (args.scan) return runScan(args);
    return runFetch(args);
}

main().catch(err => {
    console.error('\nОшибка: ' + explain(err));
    process.exit(1);
});