/**
 * backend/src/scripts/ensure-indexes.js
 *
 * Creates compound indexes that the analytics aggregation pipelines need.
 * Safe to run multiple times — MongoDB skips existing indexes.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/ensure-indexes.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI not set');
        process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;

    const indexes = [
        // ── Issues ────────────────────────────────────────────────────────────
        {
            collection: 'issues',
            indexes: [
                { key: { regionCode: 1, districtId: 1 }, name: 'issues_region_district' },
                { key: { districtId: 1, status: 1 },     name: 'issues_district_status' },
                { key: { districtId: 1, severity: 1 },   name: 'issues_district_severity' },
                { key: { regionCode: 1, createdAt: -1 }, name: 'issues_region_created' },
                { key: { category: 1, regionCode: 1 },   name: 'issues_category_region' },
                { key: { status: 1, createdAt: -1 },     name: 'issues_status_created' },
                { key: { votes: -1 },                    name: 'issues_votes_desc' },
                { key: { objectId: 1 },                  name: 'issues_object_id' },
            ]
        },
        // ── Objects (unified facility collection) ─────────────────────────────
        {
            collection: 'objects',
            indexes: [
                { key: { regionCode: 1, districtId: 1 },  name: 'objects_region_district' },
                { key: { districtId: 1, objectType: 1 },  name: 'objects_district_type' },
                { key: { objectType: 1, regionCode: 1 },  name: 'objects_type_region' },
                { key: { viloyat: 1 },                    name: 'objects_viloyat' },
                { key: { lat: 1, lng: 1 },                name: 'objects_latlng' },
                { key: { inn: 1, code: 1, sourceApi: 1 }, name: 'objects_upsert_key', sparse: true },
            ]
        },
        // ── Tasks ─────────────────────────────────────────────────────────────
        {
            collection: 'tasks',
            indexes: [
                { key: { targetId: 1, status: 1 },   name: 'tasks_target_status' },
                { key: { programId: 1, status: 1 },  name: 'tasks_program_status' },
                { key: { allocationId: 1 },          name: 'tasks_allocation' },
                { key: { deadline: 1 },              name: 'tasks_deadline' },
            ]
        },
        // ── Programs ──────────────────────────────────────────────────────────
        {
            collection: 'programs',
            indexes: [
                { key: { status: 1 },                    name: 'programs_status' },
                { key: { 'scope.regionCode': 1 },        name: 'programs_scope_region' },
            ]
        },
        // ── Budget Allocations ────────────────────────────────────────────────
        {
            collection: 'budgetallocations',
            indexes: [
                { key: { targetType: 1, targetId: 1 }, name: 'allocations_target' },
            ]
        },
        // ── Districts ─────────────────────────────────────────────────────────
        {
            collection: 'districts',
            indexes: [
                { key: { regionCode: 1 },   name: 'districts_region' },
                { key: { 'name.en': 1 },    name: 'districts_name_en' },
                { key: { code: 1 },         name: 'districts_code' },
            ]
        },
        // ── Comments ──────────────────────────────────────────────────────────
        {
            collection: 'comments',
            indexes: [
                { key: { issueId: 1, createdAt: 1 }, name: 'comments_issue_created' },
            ]
        }
    ];

    let created = 0;
    let skipped = 0;

    for (const { collection, indexes: idxList } of indexes) {
        console.log(`📋 ${collection}:`);
        const col = db.collection(collection);

        for (const { key, name, ...opts } of idxList) {
            try {
                await col.createIndex(key, { name, background: true, ...opts });
                console.log(`   ✅ ${name}`);
                created++;
            } catch (err) {
                if (err.code === 85 || err.code === 86) {
                    console.log(`   ⏭  ${name} (already exists)`);
                    skipped++;
                } else {
                    console.error(`   ❌ ${name}: ${err.message}`);
                }
            }
        }
    }

    console.log(`\n✅ Done: ${created} created, ${skipped} skipped`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
});