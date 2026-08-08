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
 * CHANGED. District resolution no longer goes through the `tuman` string.
 * The `code` field is the 7-digit SOATO district code and it is consistent across
 * all three sources: 1703203 is Andijon tumani in maktab44 and Андижон т. in
 * bogcha. Records are resolved by that number and `tuman` becomes display text.
 * data/district-crosswalk.json holds the 198 observed districts with both spellings.
 * Name matching survives in one place only: mapping a crosswalk entry to the
 * District document once at startup, 198 lookups instead of one per record.
 *
 * CHANGED. Coordinate jitter is gone. A record with no real position keeps
 * lat/lng null and is shown through the district choropleth.
 *
 * Anomalies are no longer skipped silently. Every rejected record is counted by
 * reason and printed; --strict makes the run exit non-zero if any were rejected.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/import-objects.js
 *
 * Options:
 *   --dry-run            Print counts without writing to DB
 *   --source=ssv         Only process one source (ssv | bogcha | maktab44)
 *   --strict             Exit with code 1 if any record was rejected
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
import { compareNames } from './uz-name-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 500;
const CROSSWALK_FILE = path.join(DATA_DIR, 'district-crosswalk.json');
// A systemic failure would otherwise print one line per record.
const REJECT_PRINT_LIMIT = 20;

// ── Coordinate jitter ─────────────────────────────────────────────────────────
// DISABLED. Jittering a district centroid produced positions that look precise and
// are not. Kept here so the previous behaviour stays readable in history.
// ±1200 m in degrees at ~41°N latitude
// const LAT_JITTER = 0.0108;   // 1200 / 111_000
// const LNG_JITTER = 0.0144;   // 1200 / (111_000 * cos(41°))
//
// function jitter(center, range) {
//     return center + (Math.random() * 2 - 1) * range;
// }

// ── Build lookup structures from DB ──────────────────────────────────────────
//
// regionsByNorm:  Map<normalizedViloyat, regionCode>
// districtsByRegion: Map<regionCode, Array<{ normName, lat, lng, _id }>>
//
// Scoping district lookup by regionCode is critical - there are districts
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
        { regionCode: 1, cadNum: 1, 'name.uz': 1, 'name.ru': 1, 'name.en': 1, centroid: 1 }
    ).lean();

    // Map<regionCode, Array<{ normNames: string[], lat, lng, _id }>>
    const districtsByRegion = new Map();

    for (const d of districts) {
        const [lng, lat] = d.centroid.coordinates;
        const entry = {
            // cadNum is the SOATO code written by import-geodata-osm.js. It is the
            // key this binding should have used all along; the names below are the
            // fallback for documents that predate it.
            cadNum: d.cadNum ? String(d.cadNum) : null,
            rawNames: [d.name?.uz, d.name?.ru, d.name?.en].filter(Boolean),
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

// ── Crosswalk: SOATO district code → District document ───────────────────────
//
// REWRITTEN. The comment that used to stand here said District rows come from
// crop.agro.uz and carry no SOATO code, so the binding had to go through names.
// That stopped being true when import-geodata-osm.js started writing cadNum, and
// the name path it left behind was actively wrong.
//
// What it did: normalizeUzName() strips the administrative suffix, so
// "Shahrisabz shahar" and "Shahrisabz tumani" both reduce to "shahrisabz". The
// city and the district around it are in the same region, so the regionCode
// scoping did not separate them either, and a second pass accepted a bare prefix
// match on top of that. The result was five cities - Shahrisabz, Termiz, Bekobod,
// Yangiyoʻl, Xiva - whose facilities were counted inside the surrounding rural
// district. The district read as larger than it is and the city vanished from
// every figure computed per district.
//
// It was invisible because it produced no warning: the code bound, districtId was
// set, and the count came out plausible. It surfaced only when the list of codes
// with no District document disagreed with the list of crosswalk entries that
// found no boundary - nine on each side, four in common.
//
// Now: cadNum first, exact and unambiguous. Names are the fallback for documents
// written before cadNum existed, and that fallback uses compareNames from
// uz-name-match.js, which keeps the unit type as part of the key and therefore
// cannot collapse a city into its district.

function loadCrosswalk() {
    if (!fs.existsSync(CROSSWALK_FILE)) {
        throw new Error(`district-crosswalk.json not found at ${CROSSWALK_FILE}`);
    }
    const entries = JSON.parse(fs.readFileSync(CROSSWALK_FILE, 'utf-8'));
    const byCode = new Map();
    for (const e of entries) byCode.set(String(e.districtCode), e);
    return byCode;
}

function bindCrosswalkToDistricts(crosswalk, districtsByRegion) {
    const codeToDistrict = new Map();
    const unbound = [];
    let byCode = 0;
    let byName = 0;

    // One flat index over every district document that carries a SOATO code.
    const byCadNum = new Map();
    for (const list of districtsByRegion.values()) {
        for (const d of list) {
            if (d.cadNum && !byCadNum.has(d.cadNum)) byCadNum.set(d.cadNum, d);
        }
    }

    for (const [code, entry] of crosswalk) {
        const regionCode = Number(entry.regionCode);
        const candidates = districtsByRegion.get(regionCode) || [];

        // 1. The code itself. No names, no ambiguity, nothing to collapse.
        let match = byCadNum.get(String(code)) || null;
        if (match) byCode++;

        // 2. Names, and only for documents with no code of their own. Restricting
        //    it that way matters: a document that has a cadNum and did not match
        //    above belongs to a different district, and letting a name reach it
        //    would be the same error in a new place.
        if (!match) {
            const crosswalkNames = [...entry.nameLatin, ...entry.nameCyrillic].filter(Boolean);
            const codeless = candidates.filter(d => !d.cadNum);
            match = codeless.find(d =>
                d.rawNames.some(dn => crosswalkNames.some(cn => compareNames(dn, cn)))
            ) || null;
            if (match) byName++;
        }

        if (!match) {
            unbound.push({ code, names: [...entry.nameLatin, ...entry.nameCyrillic], regionCode });
            continue;
        }

        codeToDistrict.set(code, {
            regionCode: match.regionCode,
            districtId: match._id,
            nameKeys: [...entry.nameLatin, ...entry.nameCyrillic]
                .map(n => normalizeUzName(n))
                .filter(Boolean),
        });
    }

    console.log(`  🔗 Crosswalk: ${codeToDistrict.size}/${crosswalk.size} district codes bound to District docs`);
    console.log(`     по коду СОАТО: ${byCode}, по имени (документы без кода): ${byName}`);
    if (unbound.length > 0) {
        // Not fatal. districtCode is the canonical key and is written regardless;
        // districtId is an optional convenience for joins and only exists once the
        // District collection has been populated by import-geodata-osm.js.
        console.warn(`  ⚠️  ${unbound.length} district codes have no District document yet.`);
        console.warn('      Objects will still import, with districtCode set and districtId null.');
        console.warn('      Run import-geodata-osm.js to populate districts, then re-run this import.');
        for (const u of unbound.slice(0, REJECT_PRINT_LIMIT)) {
            console.warn(`       ${u.code}  region ${u.regionCode}  ${u.names.join(' | ')}`);
        }
        if (unbound.length > REJECT_PRINT_LIMIT) {
            console.warn(`       ... and ${unbound.length - REJECT_PRINT_LIMIT} more`);
        }
    }

    return codeToDistrict;
}

// ── Resolve a single record to a district ─────────────────────────────────────
//
// Returns { districtCode, regionCode, districtId, flags } or { error }.
// The record's own tuman string is not used to find the district. It is only
// compared against the crosswalk afterwards, so that a record filed under the
// wrong code is reported instead of quietly landing in another oblast. One such
// record exists in bogcha today: a Romitan (Bukhara) object carrying 1730224,
// which is Rishton in Fergana.

function resolveByCode(row, crosswalk, codeToDistrict) {
    const flags = [];
    const raw = row.code;

    if (raw === null || raw === undefined || raw === '') {
        return { error: 'code_missing', flags };
    }

    const code = String(raw);
    if (code.length !== 7) {
        return { error: 'code_length', code, flags };
    }

    if (row.parent_code !== null && row.parent_code !== undefined
        && code.slice(0, 4) !== String(row.parent_code)) {
        flags.push('parent_code_mismatch');
    }

    const entry = crosswalk.get(code);
    if (!entry) {
        return { error: 'code_unknown', code, flags };
    }

    // District documents are optional. When the District collection has not been
    // populated yet, the object still imports with districtCode set and districtId
    // null, and a later run fills the reference in.
    const bound = codeToDistrict.get(code) || null;

    // Consistency check only - never overrides the code.
    const nameKeys = [...entry.nameLatin, ...entry.nameCyrillic]
        .map(n => normalizeUzName(n))
        .filter(Boolean);
    const tumanKey = normalizeUzName(row.tuman);
    if (tumanKey && !nameKeys.includes(tumanKey)) {
        const near = nameKeys.some(n => n.startsWith(tumanKey) || tumanKey.startsWith(n));
        if (!near) flags.push('district_name_mismatch');
    }

    return {
        districtCode: code,
        regionCode: bound ? bound.regionCode : Number(entry.regionCode),
        districtId: bound ? bound.districtId : null,
        flags,
    };
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function str(v) { return (v != null && v !== '') ? String(v) : null; }
function num(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }

// kapital_tamir carries two different meanings. bogcha and maktab44 store a year,
// ssv stores a category. Parsing them apart keeps the wear model from reading
// "ha_kapital" as a number and from treating a missing year as year zero.
const REPAIR_STATUSES = ['ha_kapital', 'ha_joriy', 'ha_rekon', 'yuq_remont'];
const MIN_YEAR = 1850;
const MAX_YEAR = new Date().getFullYear();

function repairYear(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < MIN_YEAR || n > MAX_YEAR) return null;
    return n;
}

function repairStatus(v) {
    const s = str(v);
    return REPAIR_STATUSES.includes(s) ? s : null;
}

function buildYear(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < MIN_YEAR || n > MAX_YEAR) return null;
    return n;
}

// Record-level consistency checks. These do not reject anything, they annotate,
// so that the data quality report can be produced from the collection itself.
function qualityFlags(row, base) {
    const flags = [...base];
    const cap = num(row.sigimi);
    const enr = num(row.umumiy_uquvchi);
    const build = buildYear(row.qurilish_yili);
    const repair = repairYear(row.kapital_tamir);

    if (cap !== null && cap <= 0) flags.push('capacity_zero');
    if (enr !== null && enr <= 0) flags.push('enrolment_zero');
    if (build && repair && repair < build) flags.push('repair_before_build');
    if (cap && enr && cap > 0 && enr / cap > 3) flags.push('load_implausible');

    return flags;
}

function loadFactor(row) {
    const cap = num(row.sigimi);
    const enr = num(row.umumiy_uquvchi);
    if (!cap || cap <= 0 || enr === null) return null;
    return Number((enr / cap).toFixed(4));
}

// ── Per-source transforms ─────────────────────────────────────────────────────

function transformSSV(row, coords) {
    return {
        uid: row._uid_,
        sourceId: row.id,
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
        // Coordinates are not set here any more. import-egov-coords.js fills them
        // from the data.egov.uz registry by tax id; anything unmatched stays null
        // and is drawn through the district choropleth.
        regionCode: coords.regionCode,
        // districtCode is the canonical key. districtId is a convenience reference
        // and stays null until the District collection is populated.
        districtCode: coords.districtCode,
        districtId: coords.districtId,
        qualityFlags: qualityFlags(row, coords.flags),
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(row.internet),
            binoIchidaSuv: str(row.bino_ichida_suv),
            kapitalTamir: str(row.kapital_tamir),
            // ssv stores a category here, never a year
            lastCapitalRepairYear: null,
            repairStatus: repairStatus(row.kapital_tamir),
            qurilishYili: str(row.qurilish_yili),
        },
        sourceUpdatedAt: row.updated ? new Date(row.updated) : null,
        lastSyncedAt: new Date(),
    };
}

function transformBogcha(row, coords) {
    return {
        uid: row._uid_,
        sourceId: row.id,
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
        // Coordinates are not set here any more. import-egov-coords.js fills them
        // from the data.egov.uz registry by tax id; anything unmatched stays null
        // and is drawn through the district choropleth.
        regionCode: coords.regionCode,
        // districtCode is the canonical key. districtId is a convenience reference
        // and stays null until the District collection is populated.
        districtCode: coords.districtCode,
        districtId: coords.districtId,
        qualityFlags: qualityFlags(row, coords.flags),
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(row.internetga_ulanish_turi),
            aktivZalHolati: str(row.aktiv_zal_holati),
            oshhonaHolati: str(row.oshhona_holati),
            kapitalTamir: str(row.kapital_tamir),
            lastCapitalRepairYear: repairYear(row.kapital_tamir),
            repairStatus: null,
            qurilishYili: str(row.qurilish_yili),
            sigimi: num(row.sigimi),
            umumiyUquvchi: num(row.umumiy_uquvchi),
        },
        loadFactor: loadFactor(row),
        sourceUpdatedAt: row.updated ? new Date(row.updated) : null,
        lastSyncedAt: new Date(),
    };
}

function transformMaktab(row, coords) {
    return {
        uid: row._uid_,
        sourceId: row.id,
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
        // Coordinates are not set here any more. import-egov-coords.js fills them
        // from the data.egov.uz registry by tax id; anything unmatched stays null
        // and is drawn through the district choropleth.
        regionCode: coords.regionCode,
        // districtCode is the canonical key. districtId is a convenience reference
        // and stays null until the District collection is populated.
        districtCode: coords.districtCode,
        districtId: coords.districtId,
        qualityFlags: qualityFlags(row, coords.flags),
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
            lastCapitalRepairYear: repairYear(row.kapital_tamir),
            repairStatus: null,
            qurilishYili: str(row.qurilish_yili),
            sigimi: num(row.sigimi),
            umumiyUquvchi: num(row.umumiy_uquvchi),
        },
        loadFactor: loadFactor(row),
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
export async function importObjects({ source = null, dryRun = false, strict = false, onProgress = () => { } } = {}) {
    const SOURCES = [
        { key: 'ssv', file: 'ssv.json', transform: transformSSV },
        { key: 'bogcha', file: 'bogcha.json', transform: transformBogcha },
        { key: 'maktab44', file: 'maktab44.json', transform: transformMaktab },
    ];

    const targets = source ? SOURCES.filter(s => s.key === source) : SOURCES;
    if (targets.length === 0) throw new Error(`Unknown source: ${source}`);

    onProgress('loading_districts', 0, 1);
    const { regionsByNorm, districtsByRegion } = await buildCaches();
    const crosswalk = loadCrosswalk();
    const codeToDistrict = bindCrosswalkToDistricts(crosswalk, districtsByRegion);
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

        // Rejections are counted by reason and printed in full. Nothing is dropped
        // silently: an unresolved record is a defect in the source or in the
        // crosswalk, and both need to be visible.
        const rejected = { code_missing: [], code_length: [], code_unknown: [] };
        const flagCounts = new Map();
        const bulkOps = [];
        let withDistrictId = 0;

        for (const row of rows) {
            const resolved = resolveByCode(row, crosswalk, codeToDistrict);

            if (resolved.error) {
                rejected[resolved.error].push({
                    id: row.id,
                    code: row.code,
                    viloyat: row.viloyat,
                    tuman: row.tuman,
                });
                totals.skipped++;
                continue;
            }

            const doc = transform(row, resolved);
            for (const f of doc.qualityFlags) flagCounts.set(f, (flagCounts.get(f) || 0) + 1);
            if (doc.districtId) withDistrictId++;

            bulkOps.push({
                updateOne: {
                    filter: { sourceId: row.id, sourceApi: key },
                    update: { $set: doc },
                    upsert: true,
                }
            });
        }

        const noDistrict = rejected.code_missing.length
            + rejected.code_length.length
            + rejected.code_unknown.length;

        for (const [reason, list] of Object.entries(rejected)) {
            if (list.length === 0) continue;
            console.warn(`  ⚠️  ${reason}: ${list.length} records`);
            for (const r of list.slice(0, REJECT_PRINT_LIMIT)) {
                console.warn(`       id=${r.id} code=${r.code} ${r.viloyat} / ${r.tuman}`);
            }
            if (list.length > REJECT_PRINT_LIMIT) {
                console.warn(`       ... and ${list.length - REJECT_PRINT_LIMIT} more`);
            }
        }

        console.log(`  🗺  districtId resolved for ${withDistrictId}/${bulkOps.length} records`);

        if (flagCounts.size > 0) {
            console.log('  🏷  quality flags:');
            for (const [f, n] of [...flagCounts].sort((a, b) => b[1] - a[1])) {
                console.log(`       ${f}: ${n}`);
            }
        }

        totals.noDistrict += noDistrict;

        if (dryRun) {
            console.log(`  🔍 Dry run - would upsert ${bulkOps.length} records`);
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

    console.log(`\n✅ Import complete - ${totals.upserted} upserted, ${totals.skipped} rejected (${totals.noDistrict} unresolved district)`);

    if (strict && totals.skipped > 0) {
        throw new Error(`strict mode: ${totals.skipped} records rejected`);
    }

    return totals;
}

// ── Standalone script entry point ─────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const strict = args.includes('--strict');
    const srcArg = args.find(a => a.startsWith('--source='))?.split('=')[1] || null;

    console.log('═══════════════════════════════════════');
    console.log('  Object Import - local JSON files');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - no writes');
    if (strict) console.log('  STRICT - non-zero exit if anything is rejected');
    if (srcArg) console.log(`  Source filter: ${srcArg}`);

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    try {
        await importObjects({ source: srcArg, dryRun, strict });
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err); process.exit(1); });
}