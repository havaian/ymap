/**
 * backend/src/scripts/simplify-boundaries.js
 *
 * Fills District.geometrySimplified and Region.geometrySimplified.
 *
 * The choropleth used to ship full OSM resolution to the browser. Leaflet draws a
 * GeoJSON layer as SVG paths, so every vertex became a DOM coordinate; 163
 * districts at source resolution is on the order of a hundred thousand of them,
 * and the map stopped panning. At the zoom levels a district layer is read at, the
 * detail is invisible anyway - it costs frames and buys nothing.
 *
 * Douglas-Peucker, run per ring, tolerance in degrees. 0.002° is roughly 170 m of
 * longitude at 41°N, well under a pixel at the zoom where whole districts fit on
 * screen. Rings that would collapse below four points keep their original
 * coordinates: a district reduced to a triangle is worse than a district drawn
 * slowly, and this is exactly the failure that makes a shape look like a box.
 *
 * `geometry` is never touched. It stays the authoritative outline and keeps the
 * 2dsphere index; only the render copy is written here.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/simplify-boundaries.js --dry-run
 *   docker compose exec backend node src/scripts/simplify-boundaries.js
 *   docker compose exec backend node src/scripts/simplify-boundaries.js --tolerance=0.004
 *
 * Options:
 *   --dry-run          считает и печатает, ничего не пишет
 *   --tolerance=N      допуск в градусах, по умолчанию 0.002
 *   --min-points=N     минимум точек в кольце после упрощения, по умолчанию 12
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const TOLERANCE = Number(args.find(a => a.startsWith('--tolerance='))?.split('=')[1]) || 0.002;
const MIN_POINTS = Number(args.find(a => a.startsWith('--min-points='))?.split('=')[1]) || 12;

// ── Douglas-Peucker ──────────────────────────────────────────────────────────

function perpDistance(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    const cx = a[0] + t * dx;
    const cy = a[1] + t * dy;
    return Math.hypot(p[0] - cx, p[1] - cy);
}

function douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
        const d = perpDistance(points[i], points[0], points[points.length - 1]);
        if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist <= tolerance) return [points[0], points[points.length - 1]];
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
}

/**
 * A closed ring is simplified as an open chain and closed again, so the first and
 * last vertex cannot drift apart. Tolerance is stepped down when the result would
 * be too coarse: better a heavier ring than a district that turns into a triangle.
 */
function simplifyRing(ring, tolerance) {
    if (!Array.isArray(ring) || ring.length <= MIN_POINTS) return ring;
    const open = ring.slice(0, -1);
    let tol = tolerance;
    for (let attempt = 0; attempt < 4; attempt++) {
        const out = douglasPeucker(open, tol);
        if (out.length >= MIN_POINTS) {
            const closed = out.concat([out[0]]);
            return closed;
        }
        tol /= 3;
    }
    return ring;
}

function simplifyGeometry(geometry, tolerance) {
    if (!geometry) return null;
    if (geometry.type === 'Polygon') {
        return {
            type: 'Polygon',
            coordinates: geometry.coordinates.map(r => simplifyRing(r, tolerance))
        };
    }
    if (geometry.type === 'MultiPolygon') {
        return {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates.map(poly => poly.map(r => simplifyRing(r, tolerance)))
        };
    }
    return null;
}

function countVertices(geometry) {
    if (!geometry) return 0;
    if (geometry.type === 'Polygon') return geometry.coordinates.reduce((s, r) => s + r.length, 0);
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
    }
    return 0;
}

export async function run(Model, label) {
    const docs = await Model.find({ 'geometry.coordinates': { $exists: true } })
        .select('name geometry')
        .lean();

    if (!docs.length) {
        console.log(`\n${label}: пусто, пропущено`);
        return;
    }

    let before = 0;
    let after = 0;
    let untouched = 0;
    const ops = [];

    for (const d of docs) {
        const src = countVertices(d.geometry);
        const simplified = simplifyGeometry(d.geometry, TOLERANCE);
        if (!simplified) continue;
        const dst = countVertices(simplified);
        before += src;
        after += dst;
        if (dst >= src) untouched++;
        ops.push({
            updateOne: {
                filter: { _id: d._id },
                update: { $set: { geometrySimplified: simplified } }
            }
        });
    }

    const cut = before > 0 ? (1 - after / before) * 100 : 0;
    console.log(`\n${label}: ${docs.length} объектов`);
    console.log(`  вершин было:  ${before.toLocaleString('ru-RU')}`);
    console.log(`  вершин стало: ${after.toLocaleString('ru-RU')}  (-${cut.toFixed(1)} %)`);
    if (untouched) console.log(`  без выигрыша, оставлены как есть: ${untouched}`);

    if (dryRun) {
        console.log('  --dry-run, ничего не записано');
        return;
    }
    if (ops.length) {
        const res = await Model.bulkWrite(ops, { ordered: false });
        console.log(`  записано: ${res.modifiedCount ?? ops.length}`);
    }
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log(`  Упрощение границ, допуск ${TOLERANCE}°`);
    console.log('═══════════════════════════════════════');

    await mongoose.connect(process.env.MONGODB_URI);
    await run(Region, 'РЕГИОНЫ');
    await run(District, 'РАЙОНЫ');
    await mongoose.disconnect();

    console.log('\nПоле geometry не менялось. 2dsphere и пространственные запросы работают по нему.');
}

// Guarded so the module can be imported by services/data-bootstrap.js, which runs
// the same passes on the connection the server already has. Without the guard,
// importing this file would open a second mongoose connection and disconnect the
// first one out from under the API.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => {
        console.error('❌', err.message);
        process.exit(1);
    });
}

export async function simplifyAll() {
    await run(Region, 'РЕГИОНЫ');
    await run(District, 'РАЙОНЫ');
}
