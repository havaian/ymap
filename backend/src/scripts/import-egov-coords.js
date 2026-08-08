/**
 * backend/src/scripts/import-egov-coords.js
 *
 * Attaches real coordinates to Object records by joining the data.egov.uz
 * preschool registries on the tax id.
 *
 * Input: the files produced by fetch-egov-dataset.js, any data/egov-*.json.
 * Those already carry repaired `lat` / `lon` / `coordStatus` fields, so this
 * script does no coordinate arithmetic of its own.
 *
 * Why the tax id works here: on the bogcha side `inn` is unique (395 of 395
 * populated values are distinct), and 342 of 400 records find a row with a usable
 * coordinate. It does NOT work the same way for ssv and maktab44, where `inn`
 * repeats - 392 ssv records share 166 tax ids because rural health posts sit under
 * one legal entity. Those sources are matched only when the tax id resolves to a
 * single egov row.
 *
 * Ambiguity rule: when one tax id points at several egov rows, the coordinates are
 * accepted only if all candidates fall inside AMBIGUITY_RADIUS_M of each other.
 * They usually do not - the observed spread reaches 885 km - so such records keep
 * a null coordinate and are flagged instead of being given a plausible-looking
 * wrong position.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/import-egov-coords.js
 *   docker compose exec backend node src/scripts/import-egov-coords.js --dry-run
 *
 * Options:
 *   --dry-run     Report what would change without writing
 *   --file=NAME   Use one specific file from data/ instead of every egov-*.json
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import Object_ from '../object/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 500;

// Candidates further apart than this are treated as different places.
const AMBIGUITY_RADIUS_M = 500;

// Coordinates set by a person are never overwritten by an automated join.
const PROTECTED_SOURCES = ['field_verified', 'manual'];

// ── Distance ─────────────────────────────────────────────────────────────────

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

// ── Load egov files ──────────────────────────────────────────────────────────

function listEgovFiles(only) {
    if (only) {
        const p = path.join(DATA_DIR, only);
        if (!fs.existsSync(p)) throw new Error(`${only} not found in ${DATA_DIR}`);
        return [only];
    }
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('egov-') && f.endsWith('.json'))
        // The catalogue dumps are metadata about datasets, not rows of one.
        .filter(f => !f.startsWith('egov-catalog') && !f.startsWith('egov-datasets'));
}

/**
 * Builds Map<inn, { candidates, sharedWith }>.
 * `sharedWith` counts how many other objects sit on the exact same coordinate in
 * the source. In the non-state registry 640 coordinates carry 1441 objects, one of
 * them 30 at once, which is a single map click copied across records.
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

    console.log(`  📂 ${files.length} file(s), ${rowsRead} rows, ${rowsUsable} with a usable coordinate`);
    console.log(`  🔑 ${byInn.size} distinct tax ids`);

    return { byInn, pointUse };
}

// ── Core ─────────────────────────────────────────────────────────────────────

export async function importEgovCoords({ dryRun = false, file = null, onProgress = () => { } } = {}) {
    const files = listEgovFiles(file);
    if (files.length === 0) {
        console.warn('⚠️  No egov-*.json files in data/. Run fetch-egov-dataset.js first.');
        return { matched: 0, ambiguous: 0, unmatched: 0, protectedSkipped: 0 };
    }

    const { byInn, pointUse } = buildIndex(files);

    const objects = await Object_.find(
        {},
        { _id: 1, inn: 1, sourceApi: 1, objectType: 1, coordSource: 1, qualityFlags: 1 }
    ).lean();

    console.log(`  🗂  ${objects.length} objects in the collection\n`);

    const stats = {
        matched: 0,
        ambiguous: 0,
        unmatched: 0,
        noInn: 0,
        protectedSkipped: 0,
        shared: 0,
    };
    const perType = new Map();
    const bulkOps = [];

    for (const obj of objects) {
        const bucket = perType.get(obj.objectType) || { total: 0, matched: 0 };
        bucket.total++;
        perType.set(obj.objectType, bucket);

        if (PROTECTED_SOURCES.includes(obj.coordSource)) { stats.protectedSkipped++; continue; }
        if (!obj.inn) { stats.noInn++; continue; }

        const candidates = byInn.get(String(obj.inn));
        if (!candidates || candidates.length === 0) { stats.unmatched++; continue; }

        let chosen = candidates[0];
        if (candidates.length > 1) {
            const spread = maxSpreadM(candidates);
            if (spread > AMBIGUITY_RADIUS_M) {
                stats.ambiguous++;
                const flags = new Set(obj.qualityFlags || []);
                flags.add('coord_ambiguous');
                bulkOps.push({
                    updateOne: {
                        filter: { _id: obj._id },
                        update: { $set: { qualityFlags: [...flags] } },
                    }
                });
                continue;
            }
        }

        const shared = (pointUse.get(chosen.pointKey) || 1) > 1;
        if (shared) stats.shared++;

        const flags = new Set(obj.qualityFlags || []);
        flags.delete('coord_ambiguous');

        bulkOps.push({
            updateOne: {
                filter: { _id: obj._id },
                update: {
                    $set: {
                        lat: chosen.lat,
                        lng: chosen.lon,
                        location: { type: 'Point', coordinates: [chosen.lon, chosen.lat] },
                        coordSource: 'egov_inn',
                        // Shared coordinates are valid numbers pointing at an unknown
                        // place, so they are not called exact.
                        coordPrecision: shared ? 'approximate' : 'exact',
                        coordShared: shared,
                        qualityFlags: [...flags],
                    }
                }
            }
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
    console.log(`    получили координату   ${stats.matched}`);
    console.log(`    из них общая точка    ${stats.shared}`);
    console.log(`    неоднозначный ИНН     ${stats.ambiguous}`);
    console.log(`    ИНН не найден         ${stats.unmatched}`);
    console.log(`    без ИНН               ${stats.noInn}`);
    console.log(`    защищено от перезаписи ${stats.protectedSkipped}`);

    if (dryRun) {
        console.log(`\n  🔍 Dry run - ${bulkOps.length} documents would be updated`);
        return stats;
    }

    let done = 0;
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BATCH_SIZE);
        const result = await Object_.bulkWrite(batch, { ordered: false });
        done += result.modifiedCount;
        onProgress('updating', i + batch.length, bulkOps.length);
    }

    console.log(`\n✅ ${done} documents updated`);
    return stats;
}

// ── Standalone entry point ───────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const file = args.find(a => a.startsWith('--file='))?.split('=')[1] || null;

    console.log('═══════════════════════════════════════');
    console.log('  Coordinates from data.egov.uz by tax id');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - no writes');
    if (file) console.log(`  File: ${file}`);
    console.log('');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    try {
        await importEgovCoords({ dryRun, file });
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err); process.exit(1); });
}