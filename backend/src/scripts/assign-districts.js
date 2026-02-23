/**
 * Assign Districts Script
 * 
 * For each existing Organization, Infrastructure, and Issue document,
 * determines the district (via $geoIntersects) and assigns regionCode + districtId.
 * 
 * Usage:
 *   node src/scripts/assign-districts.js
 * 
 * Options:
 *   --force     Re-assign even if already assigned
 *   --dry-run   Show what would be updated without writing
 *   --collection=organizations|infrastructure|issues   Process only one collection
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import District from '../district/model.js';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import Issue from '../issue/model.js';

const BATCH_SIZE = 500;

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        force: args.includes('--force'),
        dryRun: args.includes('--dry-run'),
        collection: args.find(a => a.startsWith('--collection='))?.split('=')[1] || null
    };
}

/**
 * Find district for a given lat/lng point
 * First tries $geoIntersects (point-in-polygon), then falls back to nearest centroid
 */
async function findDistrictForPoint(lat, lng, districtCache) {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (districtCache.has(cacheKey)) {
        return districtCache.get(cacheKey);
    }

    const point = {
        type: 'Point',
        coordinates: [lng, lat]
    };

    // Try exact containment
    let district = await District.findOne({
        geometry: { $geoIntersects: { $geometry: point } }
    }).lean();

    // Fallback: nearest centroid within 200km (needed for large regions like Navoi, Karakalpakstan)
    if (!district) {
        district = await District.findOne({
            centroid: {
                $near: {
                    $geometry: point,
                    $maxDistance: 200000 // 200km fallback radius (needed for large regions like Navoi, Karakalpakstan)
                }
            }
        }).lean();
    }

    const result = district ? {
        districtId: district._id,
        regionCode: district.regionCode,
        districtName: district.name.en
    } : null;

    districtCache.set(cacheKey, result);
    return result;
}

/**
 * Process a collection: find unassigned docs, assign district+region
 */
async function processCollection(Model, collectionName, options) {
    const { force, dryRun } = options;

    // Build filter: only process docs that have coordinates
    const filter = {
        lat: { $exists: true, $ne: null },
        lng: { $exists: true, $ne: null }
    };

    // Unless --force, only process unassigned docs
    if (!force) {
        filter.districtId = { $exists: false };
    }

    const total = await Model.countDocuments(filter);
    if (total === 0) {
        console.log(`  ⏭  ${collectionName}: no documents to process`);
        return { total: 0, assigned: 0, failed: 0 };
    }

    console.log(`  📋 ${collectionName}: ${total} documents to process${force ? ' (force mode)' : ''}`);

    const districtCache = new Map();
    let assigned = 0;
    let failed = 0;
    let processed = 0;

    // Process in batches using cursor
    const cursor = Model.find(filter).select('lat lng').lean().cursor();

    const bulkOps = [];

    for await (const doc of cursor) {
        processed++;

        const result = await findDistrictForPoint(doc.lat, doc.lng, districtCache);

        if (result) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            districtId: result.districtId,
                            regionCode: result.regionCode
                        }
                    }
                }
            });
            assigned++;
        } else {
            failed++;
        }

        // Execute bulk ops in batches
        if (bulkOps.length >= BATCH_SIZE) {
            if (!dryRun) {
                await Model.bulkWrite(bulkOps, { ordered: false });
            }
            bulkOps.length = 0;
            process.stdout.write(`\r    Progress: ${processed}/${total} (assigned: ${assigned}, failed: ${failed})`);
        }
    }

    // Flush remaining ops
    if (bulkOps.length > 0 && !dryRun) {
        await Model.bulkWrite(bulkOps, { ordered: false });
    }

    console.log(`\r    ✅ ${collectionName}: ${assigned} assigned, ${failed} failed, ${districtCache.size} unique locations cached`);

    return { total, assigned, failed };
}

async function main() {
    const options = parseArgs();

    console.log('═══════════════════════════════════════');
    console.log('  Assign Districts Migration');
    console.log('═══════════════════════════════════════');
    if (options.force) console.log('  Mode: FORCE (re-assign all)');
    if (options.dryRun) console.log('  Mode: DRY RUN (no writes)');
    if (options.collection) console.log(`  Collection: ${options.collection}`);

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('\n❌ MONGODB_URI not set in environment');
        process.exit(1);
    }

    console.log(`\n🔌 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    // Verify districts exist
    const districtCount = await District.countDocuments();
    if (districtCount === 0) {
        console.error('\n❌ No districts found in database. Run import-geodata.js first.');
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log(`\n📍 ${districtCount} districts available for matching\n`);

    try {
        const results = {};

        const collections = {
            organizations: Organization,
            infrastructure: Infrastructure,
            issues: Issue
        };

        for (const [name, Model] of Object.entries(collections)) {
            if (options.collection && options.collection !== name) continue;
            results[name] = await processCollection(Model, name, options);
        }

        // Summary
        console.log('\n═══════════════════════════════════════');
        console.log('  Migration Complete');
        console.log('═══════════════════════════════════════');
        for (const [name, r] of Object.entries(results)) {
            console.log(`  ${name}: ${r.assigned}/${r.total} assigned (${r.failed} failed)`);
        }
        if (options.dryRun) console.log('\n  ⚠ DRY RUN — no changes were written');
        console.log('═══════════════════════════════════════\n');

    } catch (err) {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main();