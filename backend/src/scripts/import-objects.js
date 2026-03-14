/**
 * backend/src/scripts/import-objects.js
 *
 * Reads the three local JSON files (ssv, bogcha, maktab44),
 * resolves each record's district by:
 *   1. Matching viloyat → Region.name.uz → regionCode
 *   2. Within that region, matching tuman → District.name.uz
 * Then jitters coordinates ±1200m around the district centroid.
 *
 * Uses normalizeUzName() from geo-translations.js (already in repo)
 * which handles Latin/Cyrillic apostrophe variants, mixed scripts, and
 * strips administrative suffixes like "tumani", "t.", "т.", etc.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/import-objects.js
 *
 * Options:
 *   --dry-run            Print counts without writing to DB
 *   --source=ssv         Only process one source (ssv | bogcha | maktab44)
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';
import Object_ from '../object/model.js';
import { normalizeUzName } from './geo-translations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 500;

// ── Coordinate jitter ─────────────────────────────────────────────────────────
// ±1200 m in degrees at ~41°N latitude
const LAT_JITTER = 0.0108;   // 1200 / 111_000
const LNG_JITTER = 0.0144;   // 1200 / (111_000 * cos(41°))

function jitter(center, range) {
    return center + (Math.random() * 2 - 1) * range;
}

// ── Build lookup structures from DB ──────────────────────────────────────────
//
// regionsByNorm:  Map<normalizedViloyat, regionCode>
// districtsByRegion: Map<regionCode, Array<{ normName, lat, lng, _id }>>
//
// Scoping district lookup by regionCode is critical — there are districts
// with identical names in different regions (e.g. "Shahrisabz" exists in
// multiple oblasts).

async function buildCaches() {
    // ── Regions ──
    const regions = await Region.find({}, { code: 1, 'name.uz': 1, 'name.ru': 1, 'name.en': 1 }).lean();

    const regionsByNorm = new Map();
    for (const r of regions) {
        // Index all available name variants so "Namangan" and "Namangan viloyati" both match
        for (const name of [r.name?.uz, r.name?.ru, r.name?.en]) {
            if (!name) continue;
            const key = normalizeUzName(name);
            if (key && !regionsByNorm.has(key)) regionsByNorm.set(key, r.code);
        }
    }

    // ── Districts ──
    const districts = await District.find(
        {},
        { regionCode: 1, 'name.uz': 1, 'name.ru': 1, 'name.en': 1, centroid: 1 }
    ).lean();

    // Map<regionCode, Array<{ normNames: string[], lat, lng, _id }>>
    const districtsByRegion = new Map();

    for (const d of districts) {
        const [lng, lat] = d.centroid.coordinates;
        const entry = {
            normNames: [d.name?.uz, d.name?.ru, d.name?.en]
                .filter(Boolean)
                .map(n => normalizeUzName(n))
                .filter(Boolean),
            lat,
            lng,
            regionCode: d.regionCode,
            _id: d._id,
        };

        if (!districtsByRegion.has(d.regionCode)) districtsByRegion.set(d.regionCode, []);
        districtsByRegion.get(d.regionCode).push(entry);
    }

    console.log(`  📍 Regions: ${regionsByNorm.size} normalized names`);
    console.log(`  📍 Districts: ${districts.length} across ${districtsByRegion.size} regions`);

    return { regionsByNorm, districtsByRegion };
}

// ── Resolve a single record to a district ─────────────────────────────────────

function resolveDistrict(viloyat, tuman, regionsByNorm, districtsByRegion) {
    // Step 1: viloyat → regionCode
    const regionKey = normalizeUzName(viloyat);
    const regionCode = regionsByNorm.get(regionKey);
    if (!regionCode) return null;

    // Step 2: tuman → district within that region
    const tumanKey = normalizeUzName(tuman);
    const candidates = districtsByRegion.get(regionCode) || [];

    // Try exact match first
    let match = candidates.find(d => d.normNames.includes(tumanKey));

    // Fallback: startsWith (handles minor suffix differences)
    if (!match) {
        match = candidates.find(d =>
            d.normNames.some(n => n.startsWith(tumanKey) || tumanKey.startsWith(n))
        );
    }

    if (!match) return null;

    return {
        lat: jitter(match.lat, LAT_JITTER),
        lng: jitter(match.lng, LNG_JITTER),
        regionCode: match.regionCode,
        districtId: match._id,
    };
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function str(v) { return (v != null && v !== '') ? String(v) : null; }
function num(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }

// ── Per-source transforms ─────────────────────────────────────────────────────

function transformSSV(row, coords) {
    return {
        uid: row._uid_,
        inn: str(row.inn),
        code: row.code,
        parentCode: row.parent_code,
        sourceApi: 'ssv',
        objectType: 'health_post',
        name: row.obekt_nomi,
        nameRu: null,
        nameEn: null,
        viloyat: row.viloyat,
        tuman: row.tuman,
        lat: coords.lat,
        lng: coords.lng,
        location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        regionCode: coords.regionCode,
        districtId: coords.districtId,
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(row.internet),
            binoIchidaSuv: str(row.bino_ichida_suv),
            kapitalTamir: str(row.kapital_tamir),
            qurilishYili: str(row.qurilish_yili),
        },
        sourceUpdatedAt: row.updated ? new Date(row.updated) : null,
        lastSyncedAt: new Date(),
    };
}

function transformBogcha(row, coords) {
    return {
        uid: row._uid_,
        inn: str(row.inn),
        code: row.code,
        parentCode: row.parent_code,
        sourceApi: 'bogcha',
        objectType: 'kindergarten',
        name: row.obekt_nomi,
        nameRu: null,
        nameEn: null,
        viloyat: row.viloyat,
        tuman: row.tuman,
        lat: coords.lat,
        lng: coords.lng,
        location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        regionCode: coords.regionCode,
        districtId: coords.districtId,
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(row.internetga_ulanish_turi),
            aktivZalHolati: str(row.aktiv_zal_holati),
            oshhonaHolati: str(row.oshhona_holati),
            kapitalTamir: str(row.kapital_tamir),
            qurilishYili: str(row.qurilish_yili),
            sigimi: num(row.sigimi),
            umumiyUquvchi: num(row.umumiy_uquvchi),
        },
        sourceUpdatedAt: row.updated ? new Date(row.updated) : null,
        lastSyncedAt: new Date(),
    };
}

function transformMaktab(row, coords) {
    return {
        uid: row._uid_,
        inn: str(row.inn),
        code: row.code,
        parentCode: row.parent_code,
        sourceApi: 'maktab44',
        objectType: 'school',
        name: row.obekt_nomi,
        nameRu: str(row.obekt_nomi_ru),
        nameEn: str(row.obekt_nomi_en),
        viloyat: row.viloyat,
        tuman: row.tuman,
        lat: coords.lat,
        lng: coords.lng,
        location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        regionCode: coords.regionCode,
        districtId: coords.districtId,
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(row.internetga_ulanish_turi),
            smena: num(row.smena),
            sportZalHolati: str(row.sport_zal_holati),
            aktivZalHolati: str(row.aktiv_zal_holati),
            oshhonaHolati: str(row.oshhona_holati),
            kapitalTamir: str(row.kapital_tamir),
            qurilishYili: str(row.qurilish_yili),
            sigimi: num(row.sigimi),
            umumiyUquvchi: num(row.umumiy_uquvchi),
        },
        sourceUpdatedAt: row.updated ? new Date(row.updated) : null,
        lastSyncedAt: new Date(),
    };
}

// ── Core import function (also called by admin controller) ────────────────────

/**
 * @param {object}        options
 * @param {string|null}   options.source      'ssv' | 'bogcha' | 'maktab44' | null (all three)
 * @param {boolean}       options.dryRun      Skip DB writes when true
 * @param {function}      options.onProgress  (phase, done, total) callback
 */
export async function importObjects({ source = null, dryRun = false, onProgress = () => { } } = {}) {
    const SOURCES = [
        { key: 'ssv', file: 'ssv.json', transform: transformSSV },
        { key: 'bogcha', file: 'bogcha.json', transform: transformBogcha },
        { key: 'maktab44', file: 'maktab44.json', transform: transformMaktab },
    ];

    const targets = source ? SOURCES.filter(s => s.key === source) : SOURCES;
    if (targets.length === 0) throw new Error(`Unknown source: ${source}`);

    onProgress('loading_districts', 0, 1);
    const { regionsByNorm, districtsByRegion } = await buildCaches();
    onProgress('loading_districts', 1, 1);

    const totals = { upserted: 0, skipped: 0, noDistrict: 0 };

    for (const { key, file, transform } of targets) {
        const filePath = path.join(DATA_DIR, file);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  ${file} not found at ${filePath}, skipping`);
            continue;
        }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const rows = Array.isArray(raw) ? raw : (raw.data ?? []);

        console.log(`\n📂 ${key}: ${rows.length} records`);
        onProgress(`processing_${key}`, 0, rows.length);

        // Collect unresolved pairs for diagnostics
        const unresolved = new Set();
        const bulkOps = [];
        let noDistrict = 0;

        for (const row of rows) {
            if (!row.code) { totals.skipped++; continue; }

            const coords = resolveDistrict(row.viloyat, row.tuman, regionsByNorm, districtsByRegion);

            if (!coords) {
                unresolved.add(`${row.viloyat} / ${row.tuman}`);
                noDistrict++;
                totals.skipped++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { code: row.code, sourceApi: key === 'ssv' ? 'ssv' : key === 'bogcha' ? 'bogcha' : 'maktab44' },
                    update: { $set: transform(row, coords) },
                    upsert: true,
                }
            });
        }

        totals.noDistrict += noDistrict;

        if (noDistrict > 0) {
            console.warn(`  ⚠️  ${noDistrict} unresolved (${unresolved.size} unique viloyat/tuman pairs):`);
            for (const pair of unresolved) console.warn(`       ${pair}`);
        }

        if (dryRun) {
            console.log(`  🔍 Dry run — would upsert ${bulkOps.length} records`);
            totals.upserted += bulkOps.length;
            continue;
        }

        let done = 0;
        for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
            const batch = bulkOps.slice(i, i + BATCH_SIZE);
            const result = await Object_.bulkWrite(batch, { ordered: false });
            done += result.upsertedCount + result.modifiedCount;
            onProgress(`processing_${key}`, i + batch.length, bulkOps.length);
        }

        totals.upserted += done;
        console.log(`  ✅ ${key}: ${done} upserted`);
    }

    console.log(`\n✅ Import complete — ${totals.upserted} upserted, ${totals.skipped} skipped (${totals.noDistrict} no-district)`);
    return totals;
}

// ── Standalone script entry point ─────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const srcArg = args.find(a => a.startsWith('--source='))?.split('=')[1] || null;

    console.log('═══════════════════════════════════════');
    console.log('  Object Import — local JSON files');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN — no writes');
    if (srcArg) console.log(`  Source filter: ${srcArg}`);

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    try {
        await importObjects({ source: srcArg, dryRun });
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err); process.exit(1); });
}