/**
 * backend/src/scripts/prune-legacy-geodata.js
 *
 * Removes the district and region documents left behind by import-geodata.js
 * after import-geodata-osm.js started keying on a different identifier.
 *
 * Run audit-geodata.js first. This script deletes; it is dry-run by default and
 * needs --apply to write anything.
 *
 * STATUS, 2026-08-08. On the live database this script has nothing to do. The
 * audit came back with 163 districts, all of them keyed on an OSM relation id,
 * zero legacy documents and zero SOATO codes held twice. The duplicate hypothesis
 * this script was written for did not hold: the boundaries are wrong because they
 * are bounding boxes, not because there are two sets of them.
 *
 * It is kept, not deleted, for one reason: import-geodata.js is still in the
 * repository and still upserts on the crop.agro identifier. If anyone runs it, the
 * duplicate set appears for real, and this is the way back.
 *
 * Safety rules, in order:
 *   1. Nothing is deleted unless a replacement exists. If the OSM set is empty
 *      the script refuses outright: an empty collection draws no choropleth at
 *      all, which is worse than a wrong one.
 *   2. A legacy district is only deleted when its SOATO code is also held by an
 *      OSM document, or when it has no SOATO code at all and the OSM set already
 *      covers more districts than the legacy set.
 *   3. Objects referencing a deleted district by districtId are counted and
 *      reported. They are not touched: re-running import-objects.js reassigns
 *      districtId against the surviving boundaries, and clearing the field here
 *      would lose the link before the replacement is in place.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/prune-legacy-geodata.js
 *   docker compose exec backend node src/scripts/prune-legacy-geodata.js --apply
 *   docker compose exec backend node src/scripts/prune-legacy-geodata.js --apply --regions-only
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';
import Object_ from '../object/model.js';

const LEGACY_DISTRICT_MAX_APIID = 1_000_000;
const LEGACY_REGION_MAX_CODE = 1000;

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const regionsOnly = args.includes('--regions-only');
    const districtsOnly = args.includes('--districts-only');

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('═══════════════════════════════════════');
    console.log(apply ? '  Удаление старых границ' : '  Удаление старых границ (dry-run)');
    console.log('═══════════════════════════════════════');

    // ── Districts ─────────────────────────────────────────────────────────────
    if (!regionsOnly) {
        const districts = await District.find({}).select('apiId cadNum regionCode name').lean();
        const legacy = districts.filter(d => typeof d.apiId === 'number' && d.apiId < LEGACY_DISTRICT_MAX_APIID);
        const osm = districts.filter(d => typeof d.apiId === 'number' && d.apiId >= LEGACY_DISTRICT_MAX_APIID);

        console.log(`\nРайоны: всего ${districts.length}, старых ${legacy.length}, OSM ${osm.length}`);

        if (legacy.length === 0) {
            console.log('  старых документов нет, ничего не делаю');
        } else if (osm.length === 0) {
            console.log('  ❌ OSM-набор пуст. Удаление отменено: остались бы районы без границ.');
            console.log('     Сначала: fetch-osm-boundaries.js, затем import-geodata-osm.js');
        } else {
            const osmCodes = new Set(osm.map(d => d.cadNum).filter(Boolean));
            const covered = legacy.filter(d => d.cadNum && osmCodes.has(d.cadNum));
            const uncoded = legacy.filter(d => !d.cadNum);
            const orphan = legacy.filter(d => d.cadNum && !osmCodes.has(d.cadNum));

            console.log(`  под удаление, код перекрыт OSM: ${covered.length}`);
            console.log(`  под удаление, без кода СОАТО: ${uncoded.length}`);
            console.log(`  остаются, код не перекрыт OSM: ${orphan.length}`);
            for (const d of orphan.slice(0, 25)) {
                console.log(`    ${d.cadNum}  ${d.name?.ru || d.name?.uz || '(без имени)'}`);
            }

            const doomed = [...covered, ...uncoded];
            const doomedIds = doomed.map(d => d._id);

            const affectedObjects = doomedIds.length
                ? await Object_.countDocuments({ districtId: { $in: doomedIds } })
                : 0;
            if (affectedObjects > 0) {
                console.log(`  ⚠️  объектов с districtId на удаляемые районы: ${affectedObjects}`);
                console.log('     После удаления прогнать import-objects.js, чтобы districtId встал заново.');
            }

            if (apply && doomedIds.length) {
                const res = await District.deleteMany({ _id: { $in: doomedIds } });
                console.log(`  ✅ удалено районов: ${res.deletedCount}`);
            } else if (doomedIds.length) {
                console.log(`  (dry-run) удалило бы районов: ${doomedIds.length}`);
            }
        }
    }

    // ── Regions ───────────────────────────────────────────────────────────────
    if (!districtsOnly) {
        const regions = await Region.find({}).select('code name').lean();
        const legacy = regions.filter(r => typeof r.code === 'number' && r.code < LEGACY_REGION_MAX_CODE);
        const soato = regions.filter(r => typeof r.code === 'number' && r.code >= LEGACY_REGION_MAX_CODE);

        console.log(`\nРегионы: всего ${regions.length}, старых ${legacy.length}, СОАТО ${soato.length}`);

        if (legacy.length === 0) {
            console.log('  старых документов нет, ничего не делаю');
        } else if (soato.length === 0) {
            console.log('  ❌ СОАТО-набор пуст. Удаление отменено.');
        } else if (soato.length < legacy.length) {
            console.log(`  ❌ СОАТО-набор (${soato.length}) меньше старого (${legacy.length}). Удаление отменено:`);
            console.log('     похоже, повторный импорт прошёл не до конца.');
        } else if (apply) {
            const res = await Region.deleteMany({ _id: { $in: legacy.map(r => r._id) } });
            console.log(`  ✅ удалено регионов: ${res.deletedCount}`);
        } else {
            console.log(`  (dry-run) удалило бы регионов: ${legacy.length}`);
        }
    }

    if (!apply) console.log('\nНичего не записано. Повторить с --apply.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});
