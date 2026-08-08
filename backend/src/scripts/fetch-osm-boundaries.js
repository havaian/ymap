/**
 * backend/src/scripts/fetch-osm-boundaries.js
 *
 * Downloads administrative boundaries for Uzbekistan from OpenStreetMap through
 * Overpass and writes them to data/ as GeoJSON.
 *
 * Why not crop.agro.uz any more: the service moved to cyber-crop.digitagro.uz and
 * its API is now encrypted end to end. POST /sessions returns a 65-byte SEC1
 * public key and every response body comes back as ciphertext, so the old
 * /api/json/* endpoints no longer exist in a readable form. Reproducing that
 * handshake would mean working around a protection measure on a ministry system,
 * which is not a trade worth making for polygons that OSM gives away.
 *
 * Fetching is deliberately separated from importing. This script runs rarely and
 * writes files that get committed; import-geodata-osm.js reads only those files.
 * The database therefore never depends on Overpass being up.
 *
 * Licence: OSM data is ODbL. The resulting boundary layer is a derivative
 * database and is published under ODbL. Analytics built on facility attributes
 * and SOATO codes do not touch it. Attribution is required wherever the
 * boundaries are displayed.
 *
 * Requires: npm i osmtogeojson
 *
 * Usage:
 *   node backend/src/scripts/fetch-osm-boundaries.js
 *   node backend/src/scripts/fetch-osm-boundaries.js --level=6
 *   node backend/src/scripts/fetch-osm-boundaries.js --endpoint=https://overpass.kumi.systems/api/interpreter
 *
 * Writes:
 *   data/osm-regions.geojson     admin_level=4
 *   data/osm-districts.geojson   admin_level=6
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import osmtogeojson from 'osmtogeojson';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Mirrors, tried in order. The main instance rate-limits aggressively.
const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.jp/api/interpreter'
];

const LEVELS = {
    4: { file: 'osm-regions.geojson', label: 'регионы' },
    6: { file: 'osm-districts.geojson', label: 'районы' }
};

const TIMEOUT_S = 600;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 15000;

function query(level) {
    // ISO3166-1=UZ pins the country area. `out geom` gives member way geometry so
    // osmtogeojson can assemble the multipolygons without extra node lookups.
    return `[out:json][timeout:${TIMEOUT_S}];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
relation(area.uz)["boundary"="administrative"]["admin_level"="${level}"];
out geom tags;`;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runQuery(level, endpoints) {
    let lastErr = null;

    for (const endpoint of endpoints) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`  → ${endpoint} (попытка ${attempt}/${MAX_RETRIES})`);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded',
                        'user-agent': 'YMap-boundaries/1.0 (infrastructure analytics, Uzbekistan)'
                    },
                    body: 'data=' + encodeURIComponent(query(level))
                });

                const text = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

                let payload;
                try {
                    payload = JSON.parse(text);
                } catch {
                    // Overpass answers with HTML when it is overloaded or the query
                    // failed to compile.
                    throw new Error(`не JSON: ${text.slice(0, 200)}`);
                }

                if (!Array.isArray(payload.elements)) throw new Error('в ответе нет elements');
                if (payload.elements.length === 0) throw new Error('пустой ответ, 0 элементов');

                return payload;
            } catch (err) {
                lastErr = err;
                console.warn(`    ${err.message}`);
                if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF * attempt);
            }
        }
    }

    throw lastErr || new Error('все зеркала недоступны');
}

/**
 * Reports what actually came back, so a partial or wrong result is visible
 * before it reaches the database.
 */
function describe(geojson, label) {
    const feats = geojson.features || [];
    const byType = {};
    let withName = 0;
    let withRu = 0;
    let polygonal = 0;

    for (const f of feats) {
        const t = f.geometry?.type || 'null';
        byType[t] = (byType[t] || 0) + 1;
        if (t === 'Polygon' || t === 'MultiPolygon') polygonal++;
        if (f.properties?.name) withName++;
        if (f.properties?.['name:ru']) withRu++;
    }

    console.log(`  ${label}: ${feats.length} объектов`);
    console.log(`    по геометрии: ${JSON.stringify(byType)}`);
    console.log(`    полигональных: ${polygonal}`);
    console.log(`    с тегом name: ${withName}, с name:ru: ${withRu}`);

    const sample = feats.slice(0, 8).map(f => f.properties?.name).filter(Boolean);
    if (sample.length) console.log(`    примеры имён: ${sample.join(', ')}`);

    return { count: feats.length, polygonal };
}

async function main() {
    const args = process.argv.slice(2);
    const onlyLevel = args.find(a => a.startsWith('--level='))?.split('=')[1];
    const customEndpoint = args.find(a => a.startsWith('--endpoint='))?.split('=')[1];
    const endpoints = customEndpoint ? [customEndpoint] : ENDPOINTS;

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее.');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════');
    console.log('  Границы из OpenStreetMap (Overpass)');
    console.log('═══════════════════════════════════════');

    fs.mkdirSync(DATA_DIR, { recursive: true });

    const levels = onlyLevel ? [Number(onlyLevel)] : Object.keys(LEVELS).map(Number);

    for (const level of levels) {
        const cfg = LEVELS[level];
        if (!cfg) { console.warn(`  admin_level=${level} не поддерживается`); continue; }

        console.log(`\nadmin_level=${level} (${cfg.label})`);
        const payload = await runQuery(level, endpoints);
        console.log(`  получено элементов OSM: ${payload.elements.length}`);

        const geojson = osmtogeojson(payload);
        const stats = describe(geojson, cfg.label);

        if (stats.polygonal === 0) {
            console.error('  ❌ ни одного полигона. Файл не записан.');
            continue;
        }

        const out = path.join(DATA_DIR, cfg.file);
        fs.writeFileSync(out, JSON.stringify(geojson), 'utf8');
        const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ записано: ${out} (${mb} МБ)`);
    }

    console.log('\nДальше: node src/scripts/import-geodata-osm.js --dry-run');
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});