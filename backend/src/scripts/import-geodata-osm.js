/**
 * backend/src/scripts/import-geodata-osm.js
 *
 * Loads the GeoJSON written by fetch-osm-boundaries.js into the Region and
 * District collections, matching each boundary to its SOATO code through
 * data/region-crosswalk.json and data/district-crosswalk.json.
 *
 * Replaces import-geodata.js, which pulled from crop.agro.uz. That service moved
 * and closed its API behind an encrypted session, so it is no longer usable.
 * The old script is kept in the repository for reference.
 *
 * Note on Region.code: the previous source numbered regions 10-23 in its own
 * scheme, which never lined up with anything else. Regions are now keyed by their
 * SOATO code (1703 to 1735), the same four digits that start every district code
 * and every parent_code in the duasr.uz registries. One numbering across the
 * whole project.
 *
 * Name matching lives in uz-name-match.js. It keeps the unit type as part of the
 * key, so "Toshkent viloyati" and "Toshkent shahar" never collapse into one, and
 * it folds the spelling differences between the registries and OSM (x/h, oʻ/u/o,
 * v/w, apostrophes, Cyrillic, inserted spaces, abbreviated initials). Matches are
 * reported by tier and every boundary that fails is listed.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/import-geodata-osm.js --dry-run
 *   docker compose exec backend node src/scripts/import-geodata-osm.js
 *
 * Options:
 *   --dry-run    Report matches without writing
 *   --strict     Exit non-zero if any crosswalk entry found no boundary
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';
import { compareNames, TIER_ORDER } from './uz-name-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
    regions: 'osm-regions.geojson',
    districts: 'osm-districts.geojson',
    regionCrosswalk: 'region-crosswalk.json',
    districtCrosswalk: 'district-crosswalk.json'
};

const PRINT_LIMIT = 25;

// ── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Area-weighted centroid of the largest outer ring, in degrees. Good enough as a
 * label anchor for a choropleth. Not a true centre of mass for shapes with holes,
 * and it is not used for any measurement, only for placing a marker.
 */
function ringCentroid(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x0, y0] = ring[j];
        const [x1, y1] = ring[i];
        const f = x0 * y1 - x1 * y0;
        a += f;
        cx += (x0 + x1) * f;
        cy += (y0 + y1) * f;
    }
    if (a === 0) {
        const n = ring.length;
        return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
    }
    a *= 0.5;
    return [cx / (6 * a), cy / (6 * a)];
}

function ringAreaAbs(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a / 2);
}

function outerRings(geometry) {
    if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(p => p[0]);
    return [];
}

// A closed quadrilateral is five points: four corners plus the repeat that closes
// the ring. Nothing traced from OSM is that simple.
const RECTANGLE_MAX_VERTICES = 6;

function vertexCount(geometry) {
    return outerRings(geometry).reduce((n, r) => n + (Array.isArray(r) ? r.length : 0), 0);
}

/**
 * Refuses to import bounding boxes.
 *
 * This gate exists because its absence cost a full pipeline run without anyone
 * noticing. A buggy Overpass query returned relations with no members, whatever
 * built the file fell back to their `bounds`, and 175 five-point rectangles went
 * into the database. Nothing objected: they were valid polygons, they carried
 * names, they matched the crosswalk, they wrote cleanly, and areaKm2 computed off
 * a bbox is a plausible-looking number. The defect surfaced only when somebody
 * opened the map and saw squares.
 *
 * A wrong boundary is worse than a missing one, because a missing one is visible.
 */
function assertNotBoxes(features, label, allowDegenerate) {
    const counts = features.map(f => vertexCount(f.geometry)).filter(n => n > 0);
    if (counts.length === 0) return;

    const boxes = counts.filter(n => n <= RECTANGLE_MAX_VERTICES).length;
    const sorted = [...counts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    console.log(`  вершин: минимум ${sorted[0]}, медиана ${median}, максимум ${sorted[sorted.length - 1]}`);
    if (boxes === 0) return;

    console.error(`  ❌ ${boxes} из ${counts.length} границ (${label}) - прямоугольники.`);
    console.error('     Это bbox, а не контуры. Источник файла испорчен, импортировать нечего.');
    console.error('     Перекачать: node src/scripts/fetch-osm-boundaries.js --debug');
    if (allowDegenerate) {
        console.error('     --allow-degenerate: продолжаю вопреки этому.');
        return;
    }
    throw new Error(`${label}: геометрия вырождена, импорт остановлен`);
}

function centroidOf(geometry) {
    const rings = outerRings(geometry).filter(r => Array.isArray(r) && r.length >= 4);
    if (rings.length === 0) return null;
    const largest = rings.reduce((best, r) => (ringAreaAbs(r) > ringAreaAbs(best) ? r : best), rings[0]);
    return ringCentroid(largest);
}

/**
 * Spherical excess over all outer rings, minus inner rings, in square kilometres.
 */
function areaKm2(geometry) {
    const R = 6371.0088;
    const rad = d => d * Math.PI / 180;

    const ringArea = ring => {
        if (!Array.isArray(ring) || ring.length < 4) return 0;
        let total = 0;
        for (let i = 0; i < ring.length - 1; i++) {
            const [lon1, lat1] = ring[i];
            const [lon2, lat2] = ring[i + 1];
            total += (rad(lon2) - rad(lon1)) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
        }
        return Math.abs(total * R * R / 2);
    };

    if (geometry.type === 'Polygon') {
        const [outer, ...holes] = geometry.coordinates;
        return ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0);
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.reduce((sum, poly) => {
            const [outer, ...holes] = poly;
            return sum + ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0);
        }, 0);
    }
    return 0;
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Every name variant OSM offers for one boundary. `name` is normally Uzbek Latin,
 * `name:oz` and `name:uz-Cyrl` carry Cyrillic where mappers bothered.
 */
function osmNames(props) {
    const keys = ['name', 'name:uz', 'name:oz', 'name:uz-Cyrl', 'name:uz-Latn',
        'name:ru', 'name:en', 'name:kaa', 'official_name', 'alt_name', 'int_name'];
    const out = [];
    for (const k of keys) {
        const v = props[k];
        if (typeof v === 'string' && v.trim()) out.push(v.trim());
    }
    return out;
}

/**
 * Best match across all name variants on both sides, strongest tier wins.
 * An 'edit' or 'token' match is accepted only when it is unambiguous: if two
 * different crosswalk entries reach the same tier, neither is taken. A wrong
 * boundary silently attached to a district is worse than a missing one.
 */
function matchFeature(feature, entries) {
    const fNames = osmNames(feature.properties || {});
    if (fNames.length === 0) return null;

    const hits = new Map();  // tier -> [entry]
    for (const e of entries) {
        let best = null;
        for (const a of fNames) {
            for (const b of e.names) {
                const tier = compareNames(a, b);
                if (!tier) continue;
                if (best === null || TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(best)) best = tier;
                if (best === 'exact') break;
            }
            if (best === 'exact') break;
        }
        if (best) {
            if (!hits.has(best)) hits.set(best, []);
            hits.get(best).push(e);
        }
    }

    for (const tier of TIER_ORDER) {
        const list = hits.get(tier);
        if (!list || list.length === 0) continue;
        if (list.length > 1 && tier !== 'exact') {
            return { ambiguous: list.map(e => e.districtCode || e.regionCode), how: tier };
        }
        return { entry: list[0], how: tier };
    }
    return null;
}

function readJson(file) {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) throw new Error(`${file} не найден в ${DATA_DIR}`);
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// ── Import ───────────────────────────────────────────────────────────────────

async function importRegions({ dryRun, allowDegenerate }) {
    const geo = readJson(FILES.regions);
    const cw = readJson(FILES.regionCrosswalk);

    const entries = cw.map(e => ({
        ...e,
        names: [e.nameCanonical, ...(e.variants || [])].filter(Boolean)
    }));

    const feats = (geo.features || []).filter(f =>
        f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));

    console.log(`\n📍 Регионы: ${feats.length} границ в OSM, ${entries.length} в справочнике`);
    assertNotBoxes(feats, 'регионы', allowDegenerate);

    const ops = [];
    const matched = new Set();
    const unmatchedFeatures = [];
    const ambiguous = [];
    const tiers = new Map();

    for (const f of feats) {
        const m = matchFeature(f, entries);
        if (!m) { unmatchedFeatures.push(osmNames(f.properties)[0] || '(без имени)'); continue; }
        if (m.ambiguous) { ambiguous.push(`${osmNames(f.properties)[0]} -> ${m.ambiguous.join(', ')}`); continue; }
        if (matched.has(m.entry.regionCode)) continue;  // first match wins
        matched.add(m.entry.regionCode);
        tiers.set(m.how, (tiers.get(m.how) || 0) + 1);

        const centroid = centroidOf(f.geometry);
        if (!centroid) { console.warn(`  ⚠️  ${m.entry.nameCanonical}: не удалось вычислить центроид`); continue; }

        ops.push({
            updateOne: {
                filter: { code: Number(m.entry.regionCode) },
                update: {
                    $set: {
                        code: Number(m.entry.regionCode),
                        name: {
                            uz: m.entry.nameCanonical,
                            ru: m.entry.nameRu || m.entry.nameCanonical,
                            en: f.properties['name:en'] || m.entry.nameCanonical
                        },
                        geometry: f.geometry,
                        centroid: { type: 'Point', coordinates: centroid },
                        areaKm2: Math.round(areaKm2(f.geometry))
                    }
                },
                upsert: true
            }
        });
    }

    const missing = entries.filter(e => !matched.has(e.regionCode));
    console.log(`  сопоставлено: ${matched.size}/${entries.length}  (${[...tiers].map(([k, v]) => `${k}: ${v}`).join(', ') || 'нет'})`);
    if (ambiguous.length) {
        console.warn(`  ⚠️  неоднозначных, пропущено: ${ambiguous.length}`);
        for (const a of ambiguous.slice(0, PRINT_LIMIT)) console.warn(`     ${a}`);
    }
    if (missing.length) {
        console.warn(`  ⚠️  без границы: ${missing.map(e => `${e.regionCode} ${e.nameCanonical}`).join(', ')}`);
    }
    if (unmatchedFeatures.length) {
        console.log(`  границ OSM без пары в справочнике: ${unmatchedFeatures.length}`);
        console.log(`    ${unmatchedFeatures.slice(0, PRINT_LIMIT).join(', ')}`);
    }

    if (dryRun) { console.log(`  🔍 dry run - записали бы ${ops.length}`); return { written: 0, missing: missing.length }; }

    if (ops.length) await Region.bulkWrite(ops, { ordered: false });
    console.log(`  ✅ записано регионов: ${ops.length}`);
    return { written: ops.length, missing: missing.length };
}

async function importDistricts({ dryRun, allowDegenerate }) {
    const geo = readJson(FILES.districts);
    const cw = readJson(FILES.districtCrosswalk);

    const entries = cw.map(e => ({
        ...e,
        names: [...(e.nameLatin || []), ...(e.nameCyrillic || [])].filter(Boolean)
    }));

    const feats = (geo.features || []).filter(f =>
        f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));

    console.log(`\n📍 Районы: ${feats.length} границ в OSM, ${entries.length} в справочнике`);
    assertNotBoxes(feats, 'районы', allowDegenerate);

    const ops = [];
    const matched = new Map();
    const unmatchedFeatures = [];
    const ambiguous = [];
    const tiers = new Map();

    for (const f of feats) {
        const m = matchFeature(f, entries);
        if (!m) { unmatchedFeatures.push(osmNames(f.properties)[0] || '(без имени)'); continue; }
        if (m.ambiguous) { ambiguous.push(`${osmNames(f.properties)[0]} -> ${m.ambiguous.join(', ')}`); continue; }
        if (matched.has(m.entry.districtCode)) continue;
        matched.set(m.entry.districtCode, f);
        tiers.set(m.how, (tiers.get(m.how) || 0) + 1);

        const centroid = centroidOf(f.geometry);
        if (!centroid) { console.warn(`  ⚠️  ${m.entry.districtCode}: не удалось вычислить центроид`); continue; }

        // apiId used to hold the crop.agro identifier and is uniquely indexed.
        // The OSM relation id takes that slot: stable, and it says where the
        // geometry came from.
        const osmId = Number(String(f.properties.id || f.id || '').replace(/\D/g, '')) || null;

        ops.push({
            updateOne: {
                filter: { apiId: osmId },
                update: {
                    $set: {
                        apiId: osmId,
                        regionCode: Number(m.entry.regionCode),
                        cadNum: m.entry.districtCode,
                        name: {
                            uz: (m.entry.nameLatin || [])[0] || f.properties.name || m.entry.districtCode,
                            ru: f.properties['name:ru'] || (m.entry.nameCyrillic || [])[0] || '',
                            en: f.properties['name:en'] || (m.entry.nameLatin || [])[0] || m.entry.districtCode
                        },
                        geometry: f.geometry,
                        centroid: { type: 'Point', coordinates: centroid },
                        areaKm2: Math.round(areaKm2(f.geometry))
                    }
                },
                upsert: true
            }
        });
    }

    const missing = entries.filter(e => !matched.has(e.districtCode));
    console.log(`  сопоставлено: ${matched.size}/${entries.length}  (${[...tiers].map(([k, v]) => `${k}: ${v}`).join(', ') || 'нет'})`);
    if (ambiguous.length) {
        console.warn(`  ⚠️  неоднозначных, пропущено: ${ambiguous.length}`);
        for (const a of ambiguous.slice(0, PRINT_LIMIT)) console.warn(`     ${a}`);
    }
    if (missing.length) {
        console.warn(`  ⚠️  без границы: ${missing.length}`);
        for (const e of missing.slice(0, PRINT_LIMIT)) {
            console.warn(`     ${e.districtCode}  ${[...(e.nameLatin || []), ...(e.nameCyrillic || [])].join(' | ')}`);
        }
        if (missing.length > PRINT_LIMIT) console.warn(`     ... и ещё ${missing.length - PRINT_LIMIT}`);
    }
    if (unmatchedFeatures.length) {
        console.log(`  границ OSM без пары в справочнике: ${unmatchedFeatures.length}`);
        console.log(`    ${unmatchedFeatures.slice(0, PRINT_LIMIT).join(', ')}`);
    }

    if (dryRun) { console.log(`  🔍 dry run - записали бы ${ops.length}`); return { written: 0, missing: missing.length }; }

    if (ops.length) await District.bulkWrite(ops, { ordered: false });
    console.log(`  ✅ записано районов: ${ops.length}`);
    return { written: ops.length, missing: missing.length };
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const strict = args.includes('--strict');
    // Escape hatch, deliberately awkward to type. There is no legitimate reason to
    // load rectangles; the flag exists so a future case nobody predicted is not
    // blocked by a check written today.
    const allowDegenerate = args.includes('--allow-degenerate');

    console.log('═══════════════════════════════════════');
    console.log('  GeoData Import - OpenStreetMap');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - без записи');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI не задан'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB');

    try {
        const r = await importRegions({ dryRun, allowDegenerate });
        const d = await importDistricts({ dryRun, allowDegenerate });

        console.log('\nДальше: node src/scripts/import-objects.js - проставит districtId');

        if (strict && (r.missing > 0 || d.missing > 0)) {
            throw new Error(`strict: без границы осталось ${r.missing} регионов и ${d.missing} районов`);
        }
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
}