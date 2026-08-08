/**
 * Fetches the open data catalogue from data.egov.uz.
 *
 * Endpoint (taken from the portal front-end):
 *   GET /apiClient/main/gettable?limit=<n>&offset=<n>&sphereId=<guid>
 *   -> { result: { count: <int>, data: [ ... ] }, status, code, error, errors }
 *
 * By default the script walks every sphere one by one. The sphere counts sum
 * up to the catalogue total shown on the portal, so sphere iteration covers
 * everything without gaps. Records are deduplicated by structId anyway.
 *
 * Usage:
 *   node backend/src/scripts/fetch-egov-catalog.js
 *   node backend/src/scripts/fetch-egov-catalog.js --limit=100 --delay=500
 *   node backend/src/scripts/fetch-egov-catalog.js --sphere=607fea9a7b6428eee08802b2
 *   node backend/src/scripts/fetch-egov-catalog.js --all
 *
 * Writes into backend/src/data/ :
 *   egov-catalog.json       full catalogue, compact, deduplicated by structId
 *   egov-catalog-geo.json   subset with a non-empty geoType, pretty printed
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
const CATALOG_PATH = '/apiClient/main/gettable';

const DEFAULT_LIMIT = 100;
const DEFAULT_DELAY = 400;      // ms between requests
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 3000;     // ms, multiplied by attempt number
const MAX_PAGES_PER_SPHERE = 500;

// Sphere ids and expected counts, read off the portal's sphere endpoint.
// `expected` is only used to report drift, it does not drive the loop.
const SPHERES = [
    { id: '6076e30d7b6428eee08802aa', ru: 'Территория', expected: 598 },
    { id: '607fe93e7b6428eee08802b0', ru: 'Экономика', expected: 5100 },
    { id: '607fea677b6428eee08802b1', ru: 'Здоровье', expected: 734 },
    { id: '607fea9a7b6428eee08802b2', ru: 'Образование', expected: 765 },
    { id: '607fed667b6428eee08802b3', ru: 'Культура', expected: 70 },
    { id: '607fedbd7b6428eee08802b4', ru: 'Бизнес', expected: 136 },
    { id: '607feecc7b6428eee08802b5', ru: 'Недвижимость', expected: 256 },
    { id: '607feffa7b6428eee08802b7', ru: 'ЦУР', expected: 127 },
    { id: '607ff03a7b6428eee08802b8', ru: 'Туризм и спорт', expected: 83 },
    { id: '607ff0997b6428eee08802b9', ru: 'Страхование', expected: 4 },
    { id: '607ff1137b6428eee08802ba', ru: 'Транспорт', expected: 272 },
    { id: '607ff2e57b6428eee08802bb', ru: 'Экология', expected: 157 },
    { id: '607ff3197b6428eee08802bc', ru: 'Занятость и соцзащита', expected: 1978 },
    { id: '607ff3627b6428eee08802bd', ru: 'Финансы', expected: 1085 },
    { id: '607ff39e7b6428eee08802be', ru: 'Торговля', expected: 305 },
    { id: '607ff3e67b6428eee08802bf', ru: 'Правонарушения', expected: 54 },
    { id: '607ff4227b6428eee08802c0', ru: 'Сельское хозяйство', expected: 1191 },
    { id: '607ff4557b6428eee08802c1', ru: 'ИКТ', expected: 156 },
    { id: '607ff4ba7b6428eee08802c2', ru: 'Юстиция и суд', expected: 24 }
];

// ─────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const value = (name, fallback) => {
        const found = args.find(a => a.startsWith(`--${name}=`));
        return found ? found.split('=').slice(1).join('=') : fallback;
    };
    return {
        limit: parseInt(value('limit', DEFAULT_LIMIT), 10),
        delay: parseInt(value('delay', DEFAULT_DELAY), 10),
        sphere: value('sphere', null),
        all: args.includes('--all')
    };
}

// ─────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl({ limit, offset, sphereId }) {
    const url = new URL(BASE_URL + CATALOG_PATH);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    if (sphereId) url.searchParams.set('sphereId', sphereId);
    return url.toString();
}

async function fetchJson(url, attempt = 1) {
    try {
        const res = await fetch(url, {
            headers: {
                'accept': 'application/json',
                'accept-language': 'ru',
                'user-agent': 'Mozilla/5.0 (compatible; YMap-catalog/1.0)',
                'referer': BASE_URL + '/'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
        const wait = RETRY_BACKOFF * attempt;
        console.warn(`    retry ${attempt}/${MAX_RETRIES - 1} in ${wait}ms (${err.message})`);
        await sleep(wait);
        return fetchJson(url, attempt + 1);
    }
}

/**
 * The portal reuses the same envelope for several endpoints. Some return
 * { result: { count, data } }, some return { result: [...] }. Handle both so a
 * wrong endpoint fails loudly instead of silently returning nothing.
 */
function normalizePage(payload) {
    const r = payload?.result;
    if (Array.isArray(r)) return { count: r.length, rows: r, shape: 'array' };
    if (r && Array.isArray(r.data)) {
        return { count: Number.isInteger(r.count) ? r.count : r.data.length, rows: r.data, shape: 'paged' };
    }
    return { count: 0, rows: [], shape: 'unknown' };
}

// ─────────────────────────────────────────────
// Paging
// ─────────────────────────────────────────────

async function fetchPaged({ sphereId, label, limit, delay }) {
    const collected = [];
    let offset = 0;
    let total = null;
    let effectiveLimit = limit;

    for (let page = 0; page < MAX_PAGES_PER_SPHERE; page++) {
        const url = buildUrl({ limit: effectiveLimit, offset, sphereId });
        const payload = await fetchJson(url);
        const { count, rows, shape } = normalizePage(payload);

        if (shape === 'unknown') {
            throw new Error(`unexpected response shape at offset ${offset}. Check the endpoint path.`);
        }
        if (total === null) {
            total = count;
            // The server may cap the page size below what we asked for.
            if (rows.length > 0 && rows.length < effectiveLimit && rows.length < total) {
                console.warn(`    server caps page size at ${rows.length}, continuing with that`);
                effectiveLimit = rows.length;
            }
        }
        if (rows.length === 0) break;

        collected.push(...rows);
        offset += rows.length;

        process.stdout.write(`\r  ${label}: ${collected.length}/${total}   `);

        if (collected.length >= total) break;
        await sleep(delay);
    }

    process.stdout.write('\n');
    return { rows: collected, reported: total };
}

// ─────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────

function geoValue(record) {
    const g = record?.geoType;
    if (!Array.isArray(g) || g.length === 0) return null;
    return g.join(',');
}

function ru(field) {
    return field?.rusText || field?.uzbText || field?.engText || '';
}

function report(records) {
    console.log('\n─────────────────────────────────────────────');
    console.log(`Всего записей после дедупликации: ${records.length}`);

    const geo = records.filter(r => geoValue(r) !== null);
    console.log(`С непустым geoType: ${geo.length}`);

    if (geo.length > 0) {
        const byType = new Map();
        for (const r of geo) {
            const k = geoValue(r);
            byType.set(k, (byType.get(k) || 0) + 1);
        }
        console.log('\nПо значению geoType:');
        for (const [k, n] of [...byType].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${k.padEnd(24)} ${n}`);
        }

        console.log('\nНаборы с географией (до 50, по числу строк):');
        const sorted = [...geo].sort((a, b) => (b.fullCount || 0) - (a.fullCount || 0)).slice(0, 50);
        for (const r of sorted) {
            const rows = String(r.fullCount ?? '?').padStart(8);
            const upd = (r.lastUpdate || '').slice(0, 10);
            console.log(`  ${rows}  ${upd}  ${geoValue(r).padEnd(12)} ${ru(r.dataName).slice(0, 70)}`);
            console.log(`            ${ru(r.orgName).slice(0, 90)}`);
        }
    }

    const withoutId = records.filter(r => !r.structId).length;
    if (withoutId > 0) console.log(`\nПредупреждение: записей без structId: ${withoutId}`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
    const { limit, delay, sphere, all } = parseArgs();

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее: глобального fetch нет.');
        process.exit(1);
    }

    console.log(`Каталог data.egov.uz`);
    console.log(`  limit=${limit} delay=${delay}ms`);

    // Probe: what does a sphere-less request return.
    const probe = normalizePage(await fetchJson(buildUrl({ limit: 1, offset: 0 })));
    console.log(`  запрос без sphereId сообщает count=${probe.count} (shape=${probe.shape})`);
    await sleep(delay);

    let targets;
    if (sphere) {
        const known = SPHERES.find(s => s.id === sphere);
        targets = [{ id: sphere, ru: known ? known.ru : sphere, expected: known ? known.expected : null }];
    } else if (all) {
        targets = [{ id: null, ru: 'весь каталог', expected: null }];
    } else {
        targets = SPHERES;
    }

    const byId = new Map();
    let duplicates = 0;

    for (const t of targets) {
        const { rows, reported } = await fetchPaged({
            sphereId: t.id,
            label: t.ru,
            limit,
            delay
        });

        if (t.expected !== null && reported !== t.expected) {
            console.log(`  ! ${t.ru}: сервер сообщил ${reported}, ожидалось ${t.expected}`);
        }

        for (const r of rows) {
            const key = r.structId || JSON.stringify(r);
            if (byId.has(key)) { duplicates++; continue; }
            byId.set(key, r);
        }
        await sleep(delay);
    }

    const records = [...byId.values()];
    if (duplicates > 0) console.log(`\nОтброшено дубликатов: ${duplicates}`);

    await fs.mkdir(DATA_DIR, { recursive: true });

    const fullPath = path.join(DATA_DIR, 'egov-catalog.json');
    const geoPath = path.join(DATA_DIR, 'egov-catalog-geo.json');

    // Full catalogue is written compact: pretty printing roughly doubles the file.
    await fs.writeFile(fullPath, JSON.stringify(records), 'utf8');
    const geo = records.filter(r => geoValue(r) !== null);
    await fs.writeFile(geoPath, JSON.stringify(geo, null, 2), 'utf8');

    report(records);

    console.log(`\nЗаписано:`);
    console.log(`  ${fullPath}`);
    console.log(`  ${geoPath}`);
}

main().catch(err => {
    console.error('\nОшибка:', err.message);
    process.exit(1);
});