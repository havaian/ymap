/**
 * backend/src/scripts/import-objects.js
 *
 * Reads the three local JSON files (ssv, bogcha, maktab44),
 * resolves each record's district via parent_code → District.cadNum,
 * jitters coordinates ±1200m around the district centroid,
 * and bulk-upserts into the Object collection.
 *
 * parent_code (e.g. 1703) maps to cadNum (e.g. "17:03") in the District model.
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
import District from '../district/model.js';
import Object_ from '../object/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 500;

// ── Coordinate jitter ─────────────────────────────────────────────────────────
// ±1200 m in degrees at ~41°N latitude
const LAT_JITTER = 0.0108;   // 1200 / 111_000
const LNG_JITTER = 0.0144;   // 1200 / (111_000 * cos(41°)) ≈ 1200 / 83_800

function jitter(center, range) {
    return center + (Math.random() * 2 - 1) * range;
}

// ── parent_code → cadNum ──────────────────────────────────────────────────────
// 1703 → "17:03",  1710 → "17:10",  1735 → "17:35"
function toCadNum(parentCode) {
    const s = String(parentCode);
    // First 2 digits = region code, remaining = district number (zero-pad to 2)
    const region = s.slice(0, 2);
    const district = s.slice(2).padStart(2, '0');
    return `${region}:${district}`;
}

// ── Build district lookup cache from DB ───────────────────────────────────────
// Returns: Map<cadNum string, { lat, lng, regionCode, _id }>
async function buildDistrictCache() {
    const districts = await District.find(
        { cadNum: { $exists: true, $ne: null } },
        { cadNum: 1, centroid: 1, regionCode: 1 }
    ).lean();

    const cache = new Map();
    for (const d of districts) {
        if (!d.cadNum) continue;
        const [lng, lat] = d.centroid.coordinates;
        cache.set(d.cadNum, { lat, lng, regionCode: d.regionCode, _id: d._id });
    }

    console.log(`  📍 District cache: ${cache.size} entries`);
    return cache;
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
 * @param {function}      options.onProgress  (phase, done, total) progress callback
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
    const districtCache = await buildDistrictCache();
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

        const bulkOps = [];
        let noDistrict = 0;

        for (const row of rows) {
            // code is the unique key per record; skip if missing
            if (!row.code) { totals.skipped++; continue; }

            // Resolve district via parent_code → cadNum
            const cadNum = row.parent_code ? toCadNum(row.parent_code) : null;
            const district = cadNum ? districtCache.get(cadNum) : null;

            let coords;
            if (district) {
                coords = {
                    lat: jitter(district.lat, LAT_JITTER),
                    lng: jitter(district.lng, LNG_JITTER),
                    regionCode: district.regionCode,
                    districtId: district._id,
                };
            } else {
                // parent_code had no cadNum match — skip rather than place at wrong location
                noDistrict++;
                totals.skipped++;
                continue;
            }

            const doc = transform(row, coords);

            bulkOps.push({
                updateOne: {
                    filter: { code: doc.code, sourceApi: doc.sourceApi },
                    update: { $set: doc },
                    upsert: true,
                }
            });
        }

        totals.noDistrict += noDistrict;
        if (noDistrict > 0) {
            console.warn(`  ⚠️  ${noDistrict} records had no cadNum match (parent_code unresolved)`);
        }

        if (dryRun) {
            console.log(`  🔍 Dry run — would upsert ${bulkOps.length} records`);
            totals.upserted += bulkOps.length;
            continue;
        }

        // Bulk write in batches of BATCH_SIZE
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