/**
 * backend/src/scripts/build-landing-data.js
 *
 * Builds the dataset the landing page draws: a thinned point cloud of real
 * preschool coordinates plus a few honest counts.
 *
 * The hero is not an illustration of a map. It is the map: every point is a
 * facility whose coordinate came out of the data.egov.uz preschool registries
 * after the orientation and type repairs in fetch-egov-dataset.js. The silhouette
 * of the country appears because facilities follow settlement, which is the
 * project's whole argument rendered without a word of copy.
 *
 * Thinned by a fixed-seed sample so the file stays small and the output is
 * reproducible: the same input always yields the same cloud.
 *
 * Usage:
 *   node backend/src/scripts/build-landing-data.js
 *
 * Writes:
 *   frontend/public/data/facility-points.json
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'data', 'facility-points.json');

const SOURCES = [
    'egov-6107f0572a2e256d868e8766.json',   // state preschools
    'egov-6107f0922a2e256d868e8768.json'    // non-state preschools
];

const TARGET_POINTS = 6000;

// Uzbekistan's ranges. They do not overlap, which is what made the per-row
// orientation repair unambiguous in the first place.
const LAT = [37.1, 45.7];
const LON = [55.9, 73.4];

// Real coordinates. Counts next to them are computed from the cloud, not written
// by hand, so a landing figure cannot drift from the data behind it.
// Названия по-русски: интерфейс русскоязычный, и подпись на карте - часть
// интерфейса, а не цитата из реестра.
const ANCHORS = [
    { name: 'Ташкент', lat: 41.311, lon: 69.279, radiusKm: 35 },
    { name: 'Самарканд', lat: 39.654, lon: 66.959, radiusKm: 35 },
    { name: 'Наманган', lat: 40.998, lon: 71.671, radiusKm: 30 },
    { name: 'Андижан', lat: 40.783, lon: 72.344, radiusKm: 30 },
    { name: 'Фергана', lat: 40.389, lon: 71.783, radiusKm: 30 },
    { name: 'Бухара', lat: 39.767, lon: 64.423, radiusKm: 35 },
    { name: 'Нукус', lat: 42.461, lon: 59.617, radiusKm: 45 },
    { name: 'Термез', lat: 37.224, lon: 67.278, radiusKm: 45 },
    { name: 'Карши', lat: 38.860, lon: 65.789, radiusKm: 35 },
    { name: 'Ургенч', lat: 41.550, lon: 60.631, radiusKm: 35 },
    { name: 'Джизак', lat: 40.116, lon: 67.842, radiusKm: 35 },
    { name: 'Навои', lat: 40.084, lon: 65.379, radiusKm: 35 },
    { name: 'Гулистан', lat: 40.489, lon: 68.791, radiusKm: 30 }
];

// Deterministic. A landing that reshuffles its own map on every build is a landing
// nobody can review.
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rowsOf(payload) {
    if (Array.isArray(payload)) return payload;
    for (const k of ['data', 'result', 'items', 'rows']) if (Array.isArray(payload?.[k])) return payload[k];
    return [];
}

function haversineKm(a, b) {
    const R = 6371;
    const rad = d => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function main() {
    const all = [];
    const perSource = {};

    for (const f of SOURCES) {
        const p = path.join(DATA_DIR, f);
        if (!fs.existsSync(p)) { console.warn(`  ${f} не найден, пропуск`); continue; }
        const rows = rowsOf(JSON.parse(fs.readFileSync(p, 'utf-8')));
        let kept = 0;
        for (const r of rows) {
            const lat = Number(r.lat);
            const lon = Number(r.lon);
            if (!isFinite(lat) || !isFinite(lon)) continue;
            if (lat < LAT[0] || lat > LAT[1] || lon < LON[0] || lon > LON[1]) continue;
            all.push({ lat, lon });
            kept++;
        }
        perSource[f] = { rows: rows.length, withCoords: kept };
        console.log(`  ${f}: ${kept} координат из ${rows.length}`);
    }

    if (all.length === 0) {
        console.error('❌ ни одной координаты. Сначала запустите fetch-egov-dataset.js');
        process.exit(1);
    }

    // Anchor counts are computed against the full set, before thinning, so the
    // figure on screen is the real one rather than a property of the sample.
    const anchors = ANCHORS.map(a => ({
        name: a.name,
        lat: a.lat,
        lon: a.lon,
        radiusKm: a.radiusKm,
        count: all.filter(p => haversineKm(a, p) <= a.radiusKm).length
    }));

    const rnd = mulberry32(20260808);
    const idx = all.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const take = Math.min(TARGET_POINTS, all.length);

    // Flat array of rounded pairs. Three decimals is about 100 m, far finer than a
    // point can be told apart at country scale, and it halves the file.
    const flat = [];
    for (let i = 0; i < take; i++) {
        const p = all[idx[i]];
        flat.push(Number(p.lat.toFixed(3)), Number(p.lon.toFixed(3)));
    }

    const out = {
        // Метки времени нет намеренно: она меняла бы файл при каждом прогоне на
        // неизменных данных и давала шум в diff. Дату сборки хранит git.
        source: 'data.egov.uz, реестры дошкольных организаций (государственные и негосударственные)',
        licence: 'Открытые данные data.egov.uz',
        totalWithCoords: all.length,
        sampled: take,
        bounds: { latMin: LAT[0], latMax: LAT[1], lonMin: LON[0], lonMax: LON[1] },
        anchors,
        perSource,
        points: flat
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out));
    const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
    console.log(`\n  ✅ ${OUT} (${kb} КБ)`);
    console.log(`  всего координат ${all.length}, в выборке ${take}`);
    for (const a of anchors) console.log(`    ${a.name}: ${a.count} объектов в радиусе ${a.radiusKm} км`);
}

main();
