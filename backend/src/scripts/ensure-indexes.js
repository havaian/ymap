/**
 * Ensure Indexes Script
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
        // ── Issues ──
        {
            collection: 'issues',
            indexes: [
                { key: { regionCode: 1, districtId: 1 }, name: 'issues_region_district' },
                { key: { districtId: 1, status: 1 }, name: 'issues_district_status' },
                { key: { districtId: 1, severity: 1 }, name: 'issues_district_severity' },
                { key: { regionCode: 1, createdAt: -1 }, name: 'issues_region_created' },
                { key: { category: 1, regionCode: 1 }, name: 'issues_category_region' },
                { key: { status: 1, createdAt: -1 }, name: 'issues_status_created' },
                { key: { votes: -1 }, name: 'issues_votes_desc' },
            ]
        },
        // ── Organizations ──
        {
            collection: 'organizations',
            indexes: [
                { key: { regionCode: 1, districtId: 1 }, name: 'orgs_region_district' },
                { key: { districtId: 1, type: 1 }, name: 'orgs_district_type' },
                { key: { type: 1, regionCode: 1 }, name: 'orgs_type_region' },
                { key: { lat: 1, lng: 1 }, name: 'orgs_latlng' },
            ]
        },
        // ── Infrastructure ──
        {
            collection: 'infrastructures',
            indexes: [
                { key: { regionCode: 1, districtId: 1 }, name: 'infra_region_district' },
                { key: { districtId: 1, type: 1 }, name: 'infra_district_type' },
                { key: { type: 1, regionCode: 1 }, name: 'infra_type_region' },
                { key: { lat: 1, lng: 1 }, name: 'infra_latlng' },
            ]
        },
        // ── Districts ──
        {
            collection: 'districts',
            indexes: [
                { key: { regionCode: 1 }, name: 'districts_region' },
                { key: { 'name.en': 1 }, name: 'districts_name_en' },
            ]
        },
        // ── Comments (for $lookup performance) ──
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

        for (const idx of idxList) {
            try {
                await col.createIndex(idx.key, { name: idx.name, background: true });
                console.log(`   ✅ ${idx.name}`);
                created++;
            } catch (err) {
                if (err.code === 85 || err.code === 86) {
                    // Index already exists (possibly with different options)
                    console.log(`   ⏭  ${idx.name} (already exists)`);
                    skipped++;
                } else {
                    console.error(`   ❌ ${idx.name}: ${err.message}`);
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