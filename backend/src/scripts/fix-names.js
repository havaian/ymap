/**
 * Fix EN/RU names on existing regions and districts.
 * 
 * Re-translates all name.en and name.ru fields using the updated
 * geo-translations map. Does NOT re-fetch from API — just updates names.
 * 
 * Usage:
 *   node src/scripts/fix-names.js [--dry-run]
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';
import {
    translateRegion, translateDistrict,
    TASHKENT_CITY
} from './geo-translations.js';

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    console.log('═══════════════════════════════════════');
    console.log('  Fix Region & District Names');
    if (dryRun) console.log('  ⚠ DRY RUN — no changes will be saved');
    console.log('═══════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Regions ──
    const regions = await Region.find({});
    let regionFixed = 0;

    console.log(`📍 Regions (${regions.length}):`);
    for (const region of regions) {
        const uz = region.name.uz;
        const isTashkentCity = /shaxri|shahri/i.test(uz) && /toshkent/i.test(uz);
        const translated = isTashkentCity ? TASHKENT_CITY : translateRegion(uz);

        const oldEn = region.name.en;
        const newEn = translated.en;
        const newRu = translated.ru;

        if (oldEn !== newEn || region.name.ru !== newRu) {
            console.log(`  🔄 ${oldEn} → ${newEn}`);
            if (!dryRun) {
                await Region.updateOne(
                    { _id: region._id },
                    { $set: { 'name.en': newEn, 'name.ru': newRu } }
                );
            }
            regionFixed++;
        } else {
            console.log(`  ✅ ${newEn}`);
        }
    }

    // ── Districts ──
    const districts = await District.find({});
    let districtFixed = 0;
    let unchanged = 0;

    console.log(`\n📍 Districts (${districts.length}):`);
    for (const district of districts) {
        const uz = district.name.uz;
        const translated = translateDistrict(uz);

        const oldEn = district.name.en;
        const newEn = translated.en;
        const newRu = translated.ru;

        if (oldEn !== newEn || district.name.ru !== newRu) {
            console.log(`  🔄 ${oldEn} → ${newEn} (${uz})`);
            if (!dryRun) {
                await District.updateOne(
                    { _id: district._id },
                    { $set: { 'name.en': newEn, 'name.ru': newRu } }
                );
            }
            districtFixed++;
        } else {
            unchanged++;
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`  Regions:   ${regionFixed} fixed / ${regions.length} total`);
    console.log(`  Districts: ${districtFixed} fixed / ${districts.length} total`);
    console.log(`  Unchanged: ${unchanged}`);
    if (dryRun) console.log('  ⚠ DRY RUN — run without --dry-run to apply');
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
}

main().catch(err => { console.error('❌', err); process.exit(1); });