/**
 * backend/src/scripts/import-objects.js
 *
 * Reads the three local JSON files (ssv, bogcha, maktab44),
 * resolves each record's district via tuman name → DB centroid lookup,
 * jitters coordinates ±1200m, and bulk-upserts into the Object collection.
 *
 * Usage (run once, or whenever the JSON files are updated):
 *   docker compose exec backend node src/scripts/import-objects.js
 *
 * Options:
 *   --dry-run      Print counts without writing to DB
 *   --source=ssv   Only process one source (ssv | bogcha | maktab44)
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

// ── Jitter constants (Uzbekistan latitude ~41°N) ─────────────────────────────
// ±1200 m expressed in degrees
const LAT_JITTER = 0.0108;  // 1200 / 111000
const LNG_JITTER = 0.0144;  // 1200 / (111000 * cos(41°)) ≈ 1200 / 83800

function jitter(center, range) {
    return center + (Math.random() * 2 - 1) * range;
}

// ── Tuman name normaliser ─────────────────────────────────────────────────────
// Strips common suffixes so "Izboskan tumani", "Izboskan t.", "Янгиқўрғон т."
// all reduce to the same key.
function normalizeTuman(raw) {
    if (!raw) return '';
    return raw
        .toLowerCase()
        .replace(/\s+tumani\s*$/i, '')     // "Izboskan tumani"
        .replace(/\s+t\.\s*$/i, '')      // "Izboskan t."
        .replace(/\s+т\.\s*$/i, '')      // "Янгиқўрғон т." (Cyrillic)
        .replace(/\s+shahri\s*$/i, '')     // city districts
        .replace(/\s+shaxri\s*$/i, '')
        .replace(/\s+rayoni\s*$/i, '')
        .replace(/[''`'']/g, "'")    // normalise apostrophes
        .replace(/ʻ/g, "'")    // Uzbek turned comma
        .trim();
}

// ── Build district lookup cache from DB ───────────────────────────────────────
// Returns: Map<normalizedName, { lat, lng, regionCode, _id }>
async function buildDistrictCache() {
    const districts = await District.find({}, {
        'name.uz': 1, 'name.ru': 1, 'name.en': 1,
        centroid: 1, regionCode: 1
    }).lean();

    const cache = new Map();

    for (const d of districts) {
        const [lng, lat] = d.centroid.coordinates;
        const entry = { lat, lng, regionCode: d.regionCode, _id: d._id };

        // Index by all available name variants
        for (const name of [d.name?.uz, d.name?.ru, d.name?.en]) {
            if (!name) continue;
            const key = normalizeTuman(name);
            if (key && !cache.has(key)) cache.set(key, entry);
        }
    }

    console.log(`  📍 District cache: ${cache.size} entries from ${districts.length} districts`);
    return cache;
}

// ── Field transform helpers ───────────────────────────────────────────────────

function str(v) {
    return (v != null && v !== '') ? String(v) : null;
}

function num(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

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

// ── Core import function (exportable for admin controller) ────────────────────

/**
 * @param {object} options
 * @param {string|null}  options.source    'ssv' | 'bogcha' | 'maktab44' | null (all)
 * @param {boolean}      options.dryRun    If true, skip DB writes
 * @param {function}     options.onProgress  (phase, done, total) callback
 */
export async function importObjects({ source = null, dryRun = false, onProgress = () => { } } = {}) {
    const SOURCES = [
        { key: 'ssv', file: 'ssv.json', transform: transformSSV },
        { key: 'bogcha', file: 'bogcha.json', transform: transformBogcha },
        { key: 'maktab44', file: 'maktab44.json', transform: transformMaktab },
    ];

    const targets = source ? SOURCES.filter(s => s.key === source) : SOURCES;

    if (targets.length === 0) {
        throw new Error(`Unknown source: ${source}`);
    }

    onProgress('loading_districts', 0, 1);
    const districtCache = await buildDistrictCache();

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
            if (!row.code) { totals.skipped++; continue; }

            // Resolve district from tuman name
            const tumanKey = normalizeTuman(row.tuman);
            const district = districtCache.get(tumanKey);

            let coords;
            if (district) {
                coords = {
                    lat: jitter(district.lat, LAT_JITTER),
                    lng: jitter(district.lng, LNG_JITTER),
                    regionCode: district.regionCode,
                    districtId: district._id,
                };
            } else {
                // No district match — place at Uzbekistan centre with no assignment
                // This happens for very few records with unusual tuman spellings
                coords = { lat: 41.2, lng: 69.2, regionCode: null, districtId: null };
                noDistrict++;
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
            console.warn(`  ⚠️  ${noDistrict} records had no district match`);
        }

        if (dryRun) {
            console.log(`  🔍 Dry run — would upsert ${bulkOps.length} records`);
            totals.upserted += bulkOps.length;
            continue;
        }

        // Bulk write in batches
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

    console.log(`\n✅ Import complete — ${totals.upserted} upserted, ${totals.skipped} skipped, ${totals.noDistrict} no-district`);
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

// Run only when executed directly, not when imported
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err); process.exit(1); });
}