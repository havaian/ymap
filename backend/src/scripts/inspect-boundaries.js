/**
 * backend/src/scripts/inspect-boundaries.js
 *
 * Read-only. Answers one question: is the geometry in the database a real
 * administrative outline, or a bounding box wearing one.
 *
 * A district polygon from OSM has hundreds to thousands of vertices. A box has
 * five, and its ring area equals its bounding-box area exactly. Both are checked,
 * because a shape can also be a near-box: an outline that got simplified so hard
 * upstream that four corners survived out of nine hundred. The rectangularity
 * ratio catches that where a vertex count alone would not.
 *
 * Writes nothing, opens no cursor for update, touches no collection but districts
 * and regions.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/inspect-boundaries.js
 *   docker compose exec backend node src/scripts/inspect-boundaries.js --dump=Яшнабадский
 *
 * Options:
 *   --dump=<подстрока имени>   печатает геометрию одного района целиком
 *   --limit=N                  сколько худших случаев показать (по умолчанию 15)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';

const args = process.argv.slice(2);
const dumpName = args.find(a => a.startsWith('--dump='))?.split('=')[1] || null;
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 15;

function outerRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates?.[0]].filter(Boolean);
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).map(p => p[0]).filter(Boolean);
    return [];
}

function ringAreaAbs(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a / 2);
}

function bboxOf(rings) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rings) {
        for (const [x, y] of r) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    return { minX, minY, maxX, maxY, area: Math.max(0, (maxX - minX) * (maxY - minY)) };
}

/**
 * Vertices, rings, and how much of the bounding box the shape actually fills.
 * A true rectangle fills 1.00. A real district sits between 0.3 and 0.7 - it has
 * concavities, and its bounding box always contains empty corners.
 */
function describe(geometry) {
    const rings = outerRings(geometry);
    const vertices = rings.reduce((s, r) => s + r.length, 0);
    const area = rings.reduce((s, r) => s + ringAreaAbs(r), 0);
    const bb = bboxOf(rings);
    const fill = bb.area > 0 ? area / bb.area : 0;
    const allFive = rings.length > 0 && rings.every(r => r.length <= 5);
    return { rings: rings.length, vertices, fill, allFive, bb };
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const [label, Model] of [['РЕГИОНЫ', Region], ['РАЙОНЫ', District]]) {
        const docs = await Model.find({})
            .select('name code cadNum apiId regionCode geometry geometrySimplified')
            .lean();

        console.log(`\n═══ ${label}: ${docs.length} ═══`);
        if (!docs.length) continue;

        const rows = docs.map(d => ({
            name: d.name?.ru || d.name?.uz || d.name?.en || String(d.cadNum || d.code || d.apiId),
            code: d.cadNum || d.code || d.apiId,
            simplified: !!d.geometrySimplified?.coordinates,
            ...describe(d.geometry)
        }));

        const totalVertices = rows.reduce((s, r) => s + r.vertices, 0);
        const boxes = rows.filter(r => r.allFive || r.fill > 0.985);
        const withSimplified = rows.filter(r => r.simplified).length;

        console.log(`  вершин всего: ${totalVertices.toLocaleString('ru-RU')}`);
        console.log(`  вершин на объект: медиана ${median(rows.map(r => r.vertices))}, минимум ${Math.min(...rows.map(r => r.vertices))}, максимум ${Math.max(...rows.map(r => r.vertices))}`);
        console.log(`  заполнение bbox: медиана ${median(rows.map(r => r.fill)).toFixed(3)}`);
        console.log(`  упрощённая копия проставлена: ${withSimplified}/${rows.length}`);
        console.log(`  ПРЯМОУГОЛЬНИКОВ (<=5 вершин в каждом кольце или заполнение bbox > 0,985): ${boxes.length}`);

        if (boxes.length) {
            console.log('\n  Первые случаи:');
            for (const r of boxes.slice(0, limit)) {
                console.log(`    ${String(r.code).padEnd(10)} ${r.name.padEnd(28)} вершин ${String(r.vertices).padStart(6)}  колец ${r.rings}  заполнение ${r.fill.toFixed(3)}`);
            }
        }

        const worst = [...rows].sort((a, b) => a.vertices - b.vertices).slice(0, limit);
        console.log('\n  Самые бедные по вершинам:');
        for (const r of worst) {
            console.log(`    ${String(r.code).padEnd(10)} ${r.name.padEnd(28)} вершин ${String(r.vertices).padStart(6)}  заполнение ${r.fill.toFixed(3)}`);
        }
    }

    if (dumpName) {
        const doc = await District.findOne({
            $or: [
                { 'name.ru': new RegExp(dumpName, 'i') },
                { 'name.uz': new RegExp(dumpName, 'i') },
                { 'name.en': new RegExp(dumpName, 'i') }
            ]
        }).select('name geometry').lean();
        if (!doc) console.log(`\nРайон по «${dumpName}» не найден`);
        else {
            console.log(`\n═══ ГЕОМЕТРИЯ: ${doc.name?.ru || doc.name?.uz} ═══`);
            console.log(JSON.stringify(doc.geometry).slice(0, 4000));
        }
    }

    console.log('\nКак читать:');
    console.log('  вершин ~5 и заполнение ~1,000 → в базе лежат bbox, не границы.');
    console.log('    Лечится прогоном fetch-osm-boundaries.js → import-geodata-osm.js,');
    console.log('    либо fetch-geoboundaries.js как альтернативным источником.');
    console.log('  вершин сотни и тысячи → геометрия настоящая, «прямоугольники» на карте');
    console.log('    приходят с фронта. Лечится simplify-boundaries.js + canvas-рендером.');

    await mongoose.disconnect();
}

function median(xs) {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
