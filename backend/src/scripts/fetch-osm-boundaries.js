/**
 * backend/src/scripts/fetch-osm-boundaries.js
 *
 * Downloads administrative boundaries for Uzbekistan from OpenStreetMap through
 * Overpass and writes them to data/ as GeoJSON.
 *
 * Why not crop.agro.uz any more: the service moved to cyber-crop.digitagro.uz and
 * its API is now encrypted end to end. POST /sessions returns a 65-byte SEC1
 * public key and every response body comes back as ciphertext, so the old
 * /api/json/* endpoints no longer exist in a readable form. Reproducing that
 * handshake would mean working around a protection measure on a ministry system,
 * which is not a trade worth making for polygons that OSM gives away.
 *
 * Fetching is deliberately separated from importing. This script runs rarely and
 * writes files that get committed; import-geodata-osm.js reads only those files.
 * The database therefore never depends on Overpass being up.
 *
 * Licence: OSM data is ODbL. The resulting boundary layer is a derivative
 * database and is published under ODbL. Analytics built on facility attributes
 * and SOATO codes do not touch it. Attribution is required wherever the
 * boundaries are displayed.
 *
 * No external dependencies. Overpass `out geom` returns the coordinates of every
 * member way inline, so relations are assembled here. osmtogeojson was dropped on
 * purpose: it pulls in 378 packages and a version of @xmldom/xmldom with critical
 * advisories, all of it for parsing OSM XML that this script never asks for.
 *
 * Usage:
 *   node backend/src/scripts/fetch-osm-boundaries.js
 *   node backend/src/scripts/fetch-osm-boundaries.js --level=6
 *   node backend/src/scripts/fetch-osm-boundaries.js --endpoint=https://overpass.kumi.systems/api/interpreter
 *   node backend/src/scripts/fetch-osm-boundaries.js --debug --dump-raw
 *   node backend/src/scripts/fetch-osm-boundaries.js --out=/app/uploads
 *
 * Writes:
 *   data/osm-regions.geojson     admin_level=4
 *   data/osm-districts.geojson   admin_level=6
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Mirrors, tried in order. The main instance rate-limits aggressively.
const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.jp/api/interpreter'
];

const LEVELS = {
    // Karakalpakstan is an autonomous republic and sits at admin_level 3, the
    // other thirteen first-order units at 4. Both are needed for a complete set.
    4: { file: 'osm-regions.geojson', label: 'регионы', levels: ['3', '4'] },
    6: { file: 'osm-districts.geojson', label: 'районы', levels: ['6'] }
};

const TIMEOUT_S = 600;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 15000;

function query(levels) {
    // ISO3166-1=UZ pins the country area. `out geom` returns the coordinates of
    // each member way inline, which is what makes local assembly possible.
    const filter = levels.length === 1
        ? `["admin_level"="${levels[0]}"]`
        : `["admin_level"~"^(${levels.join('|')})$"]`;
    return `[out:json][timeout:${TIMEOUT_S}];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
relation(area.uz)["boundary"="administrative"]${filter};
out body geom;`;
}

// ── Assembling relations into polygons ───────────────────────────────────────

function ptKey(p) {
    return p[0].toFixed(7) + ',' + p[1].toFixed(7);
}

/**
 * Member ways arrive in arbitrary order and arbitrary direction. Segments are
 * chained end to end, reversing where needed, until each ring closes. Segments
 * that never close are dropped and counted.
 */
function stitchRings(segments) {
    const rings = [];
    const pool = segments.filter(s => Array.isArray(s) && s.length >= 2);
    let dropped = 0;

    while (pool.length) {
        let cur = pool.shift().slice();
        let closed = ptKey(cur[0]) === ptKey(cur[cur.length - 1]);
        let guard = 0;

        while (!closed && guard++ < 100000) {
            const end = ptKey(cur[cur.length - 1]);
            let hit = -1;
            let reverse = false;

            for (let i = 0; i < pool.length; i++) {
                if (ptKey(pool[i][0]) === end) { hit = i; reverse = false; break; }
                if (ptKey(pool[i][pool[i].length - 1]) === end) { hit = i; reverse = true; break; }
            }
            if (hit < 0) break;

            const seg = reverse ? pool[hit].slice().reverse() : pool[hit];
            pool.splice(hit, 1);
            cur = cur.concat(seg.slice(1));
            closed = ptKey(cur[0]) === ptKey(cur[cur.length - 1]);
        }

        if (closed && cur.length >= 4) rings.push(cur);
        else dropped++;
    }

    return { rings, dropped };
}

function ringArea(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a / 2);
}

function pointInRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > pt[1]) !== (yj > pt[1]) &&
            pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/**
 * Turns one Overpass relation into a GeoJSON Feature. Inner rings are attached to
 * whichever outer ring contains them; an inner ring with no container is kept as
 * its own polygon rather than discarded, since that usually means the relation is
 * tagged inconsistently upstream and losing the area would be worse.
 */
function relationToFeature(rel, index) {
    // Two response shapes are possible and both are supported, because which one
    // Overpass returns depends on the print mode and the mirror:
    //   1. `out geom` puts the coordinates inline on each member
    //   2. plain `out body` returns ways and nodes as separate elements and the
    //      member carries only a ref
    const toCoords = m => {
        if (Array.isArray(m.geometry) && m.geometry.length) {
            return m.geometry
                .filter(p => p && typeof p.lon === 'number' && typeof p.lat === 'number')
                .map(p => [p.lon, p.lat]);
        }
        const way = index.ways.get(m.ref);
        if (!way || !Array.isArray(way.nodes)) return [];
        const out = [];
        for (const nid of way.nodes) {
            const n = index.nodes.get(nid);
            if (n && typeof n.lon === 'number' && typeof n.lat === 'number') out.push([n.lon, n.lat]);
        }
        return out;
    };

    const outerSegs = [];
    const innerSegs = [];
    for (const m of rel.members || []) {
        if (m.type !== 'way') continue;
        const c = toCoords(m);
        if (c.length < 2) continue;
        if (m.role === 'inner') innerSegs.push(c);
        else outerSegs.push(c);
    }

    const outer = stitchRings(outerSegs);
    const inner = stitchRings(innerSegs);
    index.stats.segments += outerSegs.length + innerSegs.length;
    if (outer.rings.length === 0) return { feature: null, dropped: outer.dropped + inner.dropped };

    const sorted = outer.rings.slice().sort((a, b) => ringArea(b) - ringArea(a));
    const polygons = sorted.map(r => [r]);

    for (const hole of inner.rings) {
        const idx = polygons.findIndex(poly => pointInRing(hole[0], poly[0]));
        if (idx >= 0) polygons[idx].push(hole);
        else polygons.push([hole]);
    }

    const geometry = polygons.length === 1
        ? { type: 'Polygon', coordinates: polygons[0] }
        : { type: 'MultiPolygon', coordinates: polygons };

    return {
        feature: {
            type: 'Feature',
            id: `relation/${rel.id}`,
            properties: { ...(rel.tags || {}), id: `relation/${rel.id}`, osmId: rel.id },
            geometry
        },
        dropped: outer.dropped + inner.dropped
    };
}

function buildIndex(payload) {
    const ways = new Map();
    const nodes = new Map();
    for (const el of payload.elements) {
        if (el.type === 'way') ways.set(el.id, el);
        else if (el.type === 'node') nodes.set(el.id, el);
    }
    return { ways, nodes, stats: { segments: 0 } };
}

function toGeoJSON(payload, debug = false) {
    const index = buildIndex(payload);
    const features = [];
    let droppedRings = 0;
    let noGeometry = 0;
    const relations = payload.elements.filter(el => el.type === 'relation');

    if (debug && relations.length) {
        const r = relations[0];
        console.log('    [debug] поля отношения:', Object.keys(r).join(', '));
        console.log('    [debug] членов:', (r.members || []).length);
        const firstWay = (r.members || []).find(m => m.type === 'way');
        console.log('    [debug] первый член-way:', firstWay
            ? JSON.stringify({ ...firstWay, geometry: Array.isArray(firstWay.geometry)
                ? `[${firstWay.geometry.length} точек] ${JSON.stringify(firstWay.geometry[0])}`
                : firstWay.geometry }).slice(0, 400)
            : 'нет');
        console.log(`    [debug] отдельных way в ответе: ${index.ways.size}, node: ${index.nodes.size}`);
    }

    for (const el of relations) {
        const { feature, dropped } = relationToFeature(el, index);
        droppedRings += dropped;
        if (feature) features.push(feature);
        else noGeometry++;
    }

    console.log(`    отрезков разобрано: ${index.stats.segments}`);
    if (droppedRings > 0) console.log(`    незамкнутых цепочек отброшено: ${droppedRings}`);
    if (noGeometry > 0) {
        console.log(`    отношений без пригодной геометрии: ${noGeometry}`);
        if (index.stats.segments === 0) {
            console.log('    ⚠️  ни одного отрезка. В ответе нет ни inline geometry, ни отдельных way/node.');
            console.log('       Запустите с --debug и пришлите вывод.');
        }
    }

    return { type: 'FeatureCollection', features };
}

/**
 * Checks that the output directory is writable before anything is downloaded.
 *
 * Without this the script spends two minutes on Overpass, assembles a thousand
 * way segments, reports a clean result, and only then discovers it cannot open
 * the file. Everything it did is thrown away and the operator is left with a
 * permission error where a success message was one line earlier.
 *
 * The check writes and removes a probe file rather than reading the mode bits,
 * because the mode alone does not answer the question: the container runs as an
 * unprivileged user, the directory belongs to whoever checked the repository out,
 * and on a relabelled bind mount SELinux can refuse a write that the bits allow.
 */
function assertWritable(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    try {
        fs.writeFileSync(probe, '');
        fs.unlinkSync(probe);
        return;
    } catch (err) {
        console.error(`❌ Каталог не доступен на запись: ${dir}`);
        console.error(`   ${err.code || err.message}`);
        console.error('');
        console.error('   Контейнер работает под пользователем без прав на этот каталог.');
        console.error('   Узнать, под кем он работает:');
        console.error('     docker compose exec backend id');
        console.error('   Выдать права на хосте, подставив UID и GID из вывода выше:');
        console.error('     chown -R <UID>:<GID> backend/src/data');
        console.error('');
        console.error('   Либо разово записать от root и вернуть владельца:');
        console.error('     docker compose exec -u root backend node src/scripts/fetch-osm-boundaries.js');
        console.error('     chown -R $(stat -c "%u:%g" backend/src) backend/src/data');
        console.error('');
        console.error('   Либо положить файлы в другое место: --out=/app/uploads');
        process.exit(1);
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runQuery(levels, endpoints) {
    let lastErr = null;

    for (const endpoint of endpoints) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`  → ${endpoint} (попытка ${attempt}/${MAX_RETRIES})`);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded',
                        'user-agent': 'YMap-boundaries/1.0 (infrastructure analytics, Uzbekistan)'
                    },
                    body: 'data=' + encodeURIComponent(query(levels))
                });

                const text = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

                let payload;
                try {
                    payload = JSON.parse(text);
                } catch {
                    // Overpass answers with HTML when it is overloaded or the query
                    // failed to compile.
                    throw new Error(`не JSON: ${text.slice(0, 200)}`);
                }

                if (!Array.isArray(payload.elements)) throw new Error('в ответе нет elements');
                if (payload.elements.length === 0) throw new Error('пустой ответ, 0 элементов');

                return payload;
            } catch (err) {
                lastErr = err;
                console.warn(`    ${err.message}`);
                if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF * attempt);
            }
        }
    }

    throw lastErr || new Error('все зеркала недоступны');
}

/**
 * Reports what actually came back, so a partial or wrong result is visible
 * before it reaches the database.
 */
/**
 * Vertices across every outer ring of a feature. This is the number that separates
 * a traced administrative boundary from a bounding box wearing one.
 *
 * It is checked here because the earlier failure mode was silent: the buggy query
 * `out geom tags;` suppressed member output, whatever built the file fell back to
 * the relation's `bounds`, and the result was 175 perfectly valid five-point
 * rectangles. Every downstream check passed - they were polygons, they had names,
 * they matched the crosswalk, they imported cleanly - and the defect only surfaced
 * when somebody looked at the map.
 */
function vertexCount(geometry) {
    if (!geometry) return 0;
    if (geometry.type === 'Polygon') return (geometry.coordinates?.[0] || []).length;
    if (geometry.type === 'MultiPolygon') {
        return (geometry.coordinates || []).reduce((n, poly) => n + (poly[0] || []).length, 0);
    }
    return 0;
}

// A closed quadrilateral is five points: four corners and the repeat that closes
// the ring. Nothing traced from OSM is that simple, so anything at or below this
// is a box.
const RECTANGLE_MAX_VERTICES = 6;

function describe(geojson, label) {
    const feats = geojson.features || [];
    const byType = {};
    let withName = 0;
    let withRu = 0;
    let polygonal = 0;

    for (const f of feats) {
        const t = f.geometry?.type || 'null';
        byType[t] = (byType[t] || 0) + 1;
        if (t === 'Polygon' || t === 'MultiPolygon') polygonal++;
        if (f.properties?.name) withName++;
        if (f.properties?.['name:ru']) withRu++;
    }

    console.log(`  ${label}: ${feats.length} объектов`);
    console.log(`    по геометрии: ${JSON.stringify(byType)}`);
    console.log(`    полигональных: ${polygonal}`);
    console.log(`    с тегом name: ${withName}, с name:ru: ${withRu}`);

    const counts = feats.map(f => vertexCount(f.geometry)).filter(n => n > 0).sort((a, b) => a - b);
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
    const rectangles = feats.filter(f => {
        const n = vertexCount(f.geometry);
        return n > 0 && n <= RECTANGLE_MAX_VERTICES;
    }).length;
    console.log(`    вершин: минимум ${counts[0] ?? 0}, медиана ${median}, максимум ${counts[counts.length - 1] ?? 0}`);
    if (rectangles > 0) console.log(`    ⚠️  прямоугольных (<= ${RECTANGLE_MAX_VERTICES} вершин): ${rectangles}`);

    const sample = feats.slice(0, 8).map(f => f.properties?.name).filter(Boolean);
    if (sample.length) console.log(`    примеры имён: ${sample.join(', ')}`);

    return { count: feats.length, polygonal, rectangles, medianVertices: median };
}

async function main() {
    const args = process.argv.slice(2);
    const onlyLevel = args.find(a => a.startsWith('--level='))?.split('=')[1];
    const customEndpoint = args.find(a => a.startsWith('--endpoint='))?.split('=')[1];
    const debug = args.includes('--debug');
    // Dumps the raw Overpass answer next to the output so the shape can be checked
    // without another round trip.
    const dumpRaw = args.includes('--dump-raw');
    // Escape hatch for the case where the data directory cannot be made writable:
    // write somewhere that is, then move the files in from the host.
    const outArg = args.find(a => a.startsWith('--out='))?.split('=')[1];
    const outDir = outArg ? path.resolve(outArg) : DATA_DIR;
    const endpoints = customEndpoint ? [customEndpoint] : ENDPOINTS;

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее.');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════');
    console.log('  Границы из OpenStreetMap (Overpass)');
    console.log('═══════════════════════════════════════');

    // Before Overpass, not after. A permission error is cheap to hit now and
    // expensive to hit once the data is already downloaded and parsed.
    assertWritable(outDir);
    if (outDir !== DATA_DIR) console.log(`  каталог вывода: ${outDir}`);

    const levels = onlyLevel ? [Number(onlyLevel)] : Object.keys(LEVELS).map(Number);

    for (const level of levels) {
        const cfg = LEVELS[level];
        if (!cfg) { console.warn(`  admin_level=${level} не поддерживается`); continue; }

        console.log(`\nadmin_level=${cfg.levels.join(', ')} (${cfg.label})`);
        const payload = await runQuery(cfg.levels, endpoints);
        console.log(`  получено элементов OSM: ${payload.elements.length}`);
        const kinds = {};
        for (const el of payload.elements) kinds[el.type] = (kinds[el.type] || 0) + 1;
        console.log(`    по типам: ${JSON.stringify(kinds)}`);
        if (dumpRaw) {
            const raw = path.join(outDir, `osm-raw-${cfg.levels.join('-')}.json`);
            fs.writeFileSync(raw, JSON.stringify(payload));
            console.log(`    сырой ответ: ${raw}`);
        }

        const geojson = toGeoJSON(payload, debug);
        const stats = describe(geojson, cfg.label);

        if (stats.polygonal === 0) {
            console.error('  ❌ ни одного полигона. Файл не записан.');
            continue;
        }

        // The check that was missing. A bounding box is a valid polygon, so the
        // test above passes it, and so does every step after it. Refusing here is
        // the only place where a degenerate file is still cheap to throw away.
        if (stats.rectangles > 0) {
            console.error(`  ❌ ${stats.rectangles} из ${stats.count} объектов - прямоугольники (медиана вершин ${stats.medianVertices}).`);
            console.error('     Это bbox, а не границы. Скорее всего в запросе снова стоит `out geom tags;`:');
            console.error('     `tags` подавляет вывод членов отношения, остаются только bounds.');
            console.error('     Файл не записан. Запустите с --debug --dump-raw и посмотрите ответ.');
            continue;
        }

        const out = path.join(outDir, cfg.file);
        fs.writeFileSync(out, JSON.stringify(geojson), 'utf8');
        const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ записано: ${out} (${mb} МБ)`);
    }

    console.log('\nДальше: node src/scripts/import-geodata-osm.js --dry-run');
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});