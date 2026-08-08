/**
 * backend/src/scripts/audit-geodata.js
 *
 * Read-only. Reports what is actually in the Region and District collections and
 * why a choropleth may be drawing rectangles.
 *
 * The question it answers: import-geodata.js keyed districts by
 * `{ apiId: cropAgroDistrictId }`, a number in the low hundreds. Its replacement
 * import-geodata-osm.js keys them by `{ apiId: osmRelationId }`, a number in the
 * millions. Different key spaces means the second import never overwrote the
 * first - it inserted alongside it. If both sets are present, every district is
 * in the collection twice with two different shapes, and the layer draws both.
 *
 * The same applies to regions: Region.code used to be the crop.agro numbering
 * 10-23 and is now SOATO 1703-1735.
 *
 * Vertex counts are printed because they separate a real boundary from a coarse
 * one. A district polygon traced from OSM carries hundreds to thousands of
 * points; a shape with four or five is a bounding box, whatever it is labelled.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/audit-geodata.js
 *   docker compose exec backend node src/scripts/audit-geodata.js --list=40
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';

// Anything below this in an outer ring is not a traced boundary. Four points is a
// closed rectangle, five is a rectangle written with the closing vertex repeated.
const RECTANGLE_MAX_VERTICES = 6;

function outerRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates?.[0] || []];
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).map(p => p[0] || []);
    return [];
}

function vertexCount(geometry) {
    return outerRings(geometry).reduce((n, r) => n + (Array.isArray(r) ? r.length : 0), 0);
}

/**
 * True when every outer ring is a quadrilateral. Reported separately from a low
 * vertex count so a genuinely simple boundary is not mislabelled.
 */
function looksRectangular(geometry) {
    const rings = outerRings(geometry);
    if (rings.length === 0) return false;
    return rings.every(r => Array.isArray(r) && r.length > 0 && r.length <= RECTANGLE_MAX_VERTICES);
}

function summarize(docs, label, listLimit) {
    const total = docs.length;
    const rect = docs.filter(d => looksRectangular(d.geometry));
    const noGeom = docs.filter(d => !d.geometry || outerRings(d.geometry).length === 0);
    const counts = docs.map(d => vertexCount(d.geometry)).filter(n => n > 0).sort((a, b) => a - b);
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;

    console.log(`\n── ${label} ──`);
    console.log(`  документов: ${total}`);
    console.log(`  без геометрии: ${noGeom.length}`);
    console.log(`  прямоугольных (<= ${RECTANGLE_MAX_VERTICES} вершин на кольцо): ${rect.length}`);
    console.log(`  вершин: минимум ${counts[0] ?? 0}, медиана ${median}, максимум ${counts[counts.length - 1] ?? 0}`);

    if (rect.length) {
        console.log('  прямоугольные:');
        for (const d of rect.slice(0, listLimit)) {
            console.log(`    apiId=${d.apiId ?? '-'}  code=${d.regionCode ?? d.code ?? '-'}  ${d.name?.ru || d.name?.uz || d.name?.en || '(без имени)'}  вершин ${vertexCount(d.geometry)}`);
        }
        if (rect.length > listLimit) console.log(`    ... и ещё ${rect.length - listLimit}`);
    }

    return { total, rect: rect.length, noGeom: noGeom.length };
}

async function main() {
    const args = process.argv.slice(2);
    const listLimit = parseInt(args.find(a => a.startsWith('--list='))?.split('=')[1] || '25', 10);

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('═══════════════════════════════════════');
    console.log('  Аудит границ, только чтение');
    console.log('═══════════════════════════════════════');

    // ── Districts ─────────────────────────────────────────────────────────────
    const districts = await District.find({}).select('apiId cadNum regionCode name geometry').lean();

    // The split is by magnitude of apiId, which is what separates the two import
    // scripts. OSM relation ids for Uzbek districts are seven to eight digits.
    const legacy = districts.filter(d => typeof d.apiId === 'number' && d.apiId < 1_000_000);
    const osm = districts.filter(d => typeof d.apiId === 'number' && d.apiId >= 1_000_000);
    const noApiId = districts.filter(d => typeof d.apiId !== 'number');

    console.log(`\nРайоны: ${districts.length} документов`);
    console.log(`  apiId < 1 000 000 (ключ crop.agro): ${legacy.length}`);
    console.log(`  apiId >= 1 000 000 (ключ OSM relation): ${osm.length}`);
    console.log(`  без apiId: ${noApiId.length}`);

    if (legacy.length && osm.length) {
        console.log('\n  ⚠️  ОБА набора присутствуют. import-geodata-osm.js писал по другому ключу,');
        console.log('     старые документы crop.agro не перезаписаны. Хороплет отдаёт оба набора,');
        console.log('     и на карте районы нарисованы дважды.');
    }

    // Overlap by SOATO code: the same territory held by more than one document.
    const byCad = new Map();
    for (const d of districts) {
        const key = d.cadNum || `apiId:${d.apiId}`;
        if (!byCad.has(key)) byCad.set(key, []);
        byCad.get(key).push(d);
    }
    const dupes = [...byCad.entries()].filter(([, list]) => list.length > 1);
    console.log(`  кодов с более чем одним документом: ${dupes.length}`);
    for (const [code, list] of dupes.slice(0, listLimit)) {
        console.log(`    ${code}: ${list.map(d => `apiId=${d.apiId} вершин=${vertexCount(d.geometry)}`).join('  |  ')}`);
    }
    if (dupes.length > listLimit) console.log(`    ... и ещё ${dupes.length - listLimit}`);

    if (legacy.length) summarize(legacy, 'Районы, ключ crop.agro', listLimit);
    if (osm.length) summarize(osm, 'Районы, ключ OSM', listLimit);
    if (noApiId.length) summarize(noApiId, 'Районы без apiId', listLimit);

    // ── Regions ───────────────────────────────────────────────────────────────
    const regions = await Region.find({}).select('code apiId name geometry').lean();
    const legacyRegions = regions.filter(r => typeof r.code === 'number' && r.code < 1000);
    const soatoRegions = regions.filter(r => typeof r.code === 'number' && r.code >= 1000);

    console.log(`\nРегионы: ${regions.length} документов`);
    console.log(`  code < 1000 (нумерация crop.agro 10-23): ${legacyRegions.length}`);
    console.log(`  code >= 1000 (СОАТО 1703-1735): ${soatoRegions.length}`);
    if (legacyRegions.length && soatoRegions.length) {
        console.log('  ⚠️  Оба набора присутствуют. Выпадающий список регионов на карте покажет дубли.');
    }
    if (legacyRegions.length) summarize(legacyRegions, 'Регионы, нумерация crop.agro', listLimit);
    if (soatoRegions.length) summarize(soatoRegions, 'Регионы, СОАТО', listLimit);

    console.log('\nЕсли подтвердились дубли: node src/scripts/prune-legacy-geodata.js (по умолчанию dry-run)');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});
