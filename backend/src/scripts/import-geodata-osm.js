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
 *   --prune-stale        Удалить документы, которых нет в этом прогоне
 *   --allow-degenerate   Импортировать bbox вместо контуров, только вручную
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Region from '../region/model.js';
import District from '../district/model.js';
import Object_ from '../object/model.js';
import { compareNames, TIER_ORDER } from './uz-name-match.js';

import { DATA_DIR, WRITE_DIR, SEPARATE_WRITE_DIR, resolveRead } from '../utils/dataDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/**
 * Documents in the collection that this run did not touch.
 *
 * The importer upserts and never deletes, and districts are keyed on the OSM
 * relation id. So a district that matched under an older matcher, or came from an
 * older and broken boundary file, keeps its document forever once the current run
 * stops producing that id. It is not overwritten, it is simply skipped, and it
 * goes on being the only geometry that district has.
 *
 * That is exactly how two bounding boxes survived a full reimport: 188 districts
 * were written, 190 were in the collection, and the extra two were the last
 * remains of the broken run - still bound to objects, still drawn on the map.
 *
 * Reported by default, removed only with --prune-stale, because deleting a
 * district orphans the `districtId` of every object pointing at it and that needs
 * import-objects.js run afterwards.
 */
async function reportStale(Model, keyField, keptKeys, label, { pruneStale, dryRun }) {
    const stale = await Model.find({ [keyField]: { $nin: [...keptKeys] } })
        .select(`${keyField} name cadNum code geometry`)
        .lean();

    if (stale.length === 0) return 0;

    console.warn(`  ⚠️  ${label}: документов, которых нет в этом прогоне: ${stale.length}`);
    for (const d of stale.slice(0, PRINT_LIMIT)) {
        const v = vertexCount(d.geometry);
        const box = v > 0 && v <= RECTANGLE_MAX_VERTICES ? '  ПРЯМОУГОЛЬНИК' : '';
        const objects = Model.modelName === 'District'
            ? await Object_.countDocuments({ districtId: d._id })
            : null;
        console.warn(`     ${d[keyField]}  ${d.name?.ru || d.name?.uz || '(без имени)'}  вершин ${v}${box}${objects !== null ? `  объектов ${objects}` : ''}`);
    }
    if (stale.length > PRINT_LIMIT) console.warn(`     ... и ещё ${stale.length - PRINT_LIMIT}`);

    if (!pruneStale) {
        console.warn('     Оставлены. Удалить: --prune-stale, затем обязательно import-objects.js');
        return stale.length;
    }
    if (dryRun) {
        console.warn(`     (dry run) удалило бы ${stale.length}`);
        return stale.length;
    }

    const res = await Model.deleteMany({ _id: { $in: stale.map(d => d._id) } });
    console.warn(`     ✅ удалено: ${res.deletedCount}. Теперь прогоните import-objects.js: districtId у части объектов указывает в пустоту.`);
    return stale.length;
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

// Name tags in order of authority, and the order is the point.
//
// `name` is what the unit is called; `name:ru` and the alt/int variants are
// translations somebody added, and they can be plain wrong. Two relations in the
// current Uzbek extract prove it: relation/11158813 is `Xatirchi tumani` with
// `name:ru` reading "Конимех тумани", and relation/15601869 is `Nurobod tumani`
// with `name:ru` reading "Пахтачи тумани". Both name a different district
// entirely.
//
// Treating every tag as equally good let those two relations be claimed by
// Konimex and Pakhtachi, which is how Xatirchi and Nurobod ended up with no
// boundary at all while their old bounding boxes survived as the only geometry
// they had.
const NAME_KEYS = ['name', 'name:uz', 'name:uz-Latn', 'name:oz', 'name:uz-Cyrl',
    'name:kaa', 'official_name', 'name:en', 'name:ru', 'alt_name', 'int_name'];

function osmNames(props) {
    const out = [];
    for (let rank = 0; rank < NAME_KEYS.length; rank++) {
        const v = props[NAME_KEYS[rank]];
        if (typeof v === 'string' && v.trim()) out.push({ value: v.trim(), rank, key: NAME_KEYS[rank] });
    }
    return out;
}

/** Just the strings, for log lines that only want something to print. */
function osmNameStrings(props) {
    return osmNames(props).map(n => n.value);
}

/**
 * Which crosswalk entry this boundary belongs to.
 *
 * An entry is scored by the best (tier, name-key rank) pair any of its names
 * achieves against any of the feature's names. Tier decides first - an exact hit
 * beats a token hit beats an edit hit - and the authority of the tag that
 * produced it breaks the tie. So a feature whose `name` matches one district
 * exactly and whose `name:ru` matches a different district exactly resolves to
 * the first, instead of to whichever happened to sit earlier in the crosswalk.
 *
 * Only a genuine draw - two entries reached by equally authoritative tags at the
 * same tier - is ambiguous, and that is refused rather than guessed. Previously
 * the ambiguity check was skipped entirely for exact matches, on the assumption
 * that exactness implies certainty. It does not: exactness of one tag says
 * nothing about what the other tags of the same feature say.
 */
function matchFeature(feature, entries) {
    const fNames = osmNames(feature.properties || {});
    if (fNames.length === 0) return null;

    const scored = [];
    for (const e of entries) {
        let bestTier = null;
        let bestRank = Infinity;
        let bestKey = null;

        for (const a of fNames) {
            for (const b of e.names) {
                const tier = compareNames(a.value, b);
                if (!tier) continue;
                const ti = TIER_ORDER.indexOf(tier);
                const bi = bestTier === null ? Infinity : TIER_ORDER.indexOf(bestTier);
                if (ti < bi || (ti === bi && a.rank < bestRank)) {
                    bestTier = tier;
                    bestRank = a.rank;
                    bestKey = a.key;
                }
            }
        }
        if (bestTier) scored.push({ entry: e, tier: bestTier, rank: bestRank, key: bestKey });
    }

    if (scored.length === 0) return null;

    scored.sort((x, y) => {
        const d = TIER_ORDER.indexOf(x.tier) - TIER_ORDER.indexOf(y.tier);
        return d !== 0 ? d : x.rank - y.rank;
    });

    const top = scored[0];
    const rival = scored[1];
    if (rival && rival.tier === top.tier && rival.rank === top.rank) {
        return {
            ambiguous: scored
                .filter(s => s.tier === top.tier && s.rank === top.rank)
                .map(s => s.entry.districtCode || s.entry.regionCode),
            how: top.tier
        };
    }

    return { entry: top.entry, how: top.tier, viaKey: top.key, viaRank: top.rank };
}


/**
 * The missing-file message is long on purpose. A boundary file that was fetched
 * successfully and then vanished has exactly one common cause, and it is not one
 * anybody guesses: /app/src/data is image content unless it is mounted, so
 * anything written there by fetch-osm-boundaries.js lives only as long as that
 * container does. Rebuild the stack and the download is gone, while the sibling
 * files that shipped inside the image are still sitting right next to where it
 * used to be - which makes it look like the fetch never worked.
 */
function readJson(file) {
    // Downloaded copy first, committed copy second. A boundary set that was just
    // fetched has to win over one committed months ago, or a re-fetch would look
    // like it did nothing.
    const p = resolveRead(file);
    if (!fs.existsSync(p)) {
        const dirs = SEPARATE_WRITE_DIR ? [WRITE_DIR, DATA_DIR] : [DATA_DIR];
        const siblings = [];
        for (const d of dirs) {
            if (!fs.existsSync(d)) continue;
            for (const f of fs.readdirSync(d)) {
                if (f.endsWith('.geojson')) siblings.push(path.join(d, f));
            }
        }
        const lines = [
            `${file} не найден. Искал в: ${dirs.join(', ')}`,
            siblings.length
                ? `  рядом лежат: ${siblings.join(', ')}`
                : '  ни одного .geojson ни в одном из каталогов',
            '',
            '  Границы скачивает fetch-osm-boundaries.js. Он пишет в GEODATA_DIR,',
            '  а не в src/data: тот каталог принадлежит git, права на него нужны',
            '  раннеру для `git reset --hard`, и отдавать его контейнеру нельзя.',
            '',
            '  node src/scripts/fetch-osm-boundaries.js --debug'
        ];
        throw new Error(lines.join('\n'));
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importRegions({ dryRun, allowDegenerate, pruneStale } = {}) {
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
    const contested = [];
    const tiers = new Map();

    for (const f of feats) {
        const m = matchFeature(f, entries);
        if (!m) { unmatchedFeatures.push(osmNameStrings(f.properties)[0] || '(без имени)'); continue; }
        if (m.ambiguous) { ambiguous.push(`${osmNameStrings(f.properties)[0]} -> ${m.ambiguous.join(', ')}`); continue; }
        if (matched.has(m.entry.regionCode)) {
            contested.push(`${m.entry.regionCode} <- ${osmNameStrings(f.properties)[0]} (уже занят)`);
            continue;
        }
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
    if (contested.length) {
        console.warn(`  ⚠️  на один код претендует больше одной границы: ${contested.length}`);
        for (const c of contested.slice(0, PRINT_LIMIT)) console.warn(`     ${c}`);
    }
    if (unmatchedFeatures.length) {
        console.log(`  границ OSM без пары в справочнике: ${unmatchedFeatures.length}`);
        console.log(`    ${unmatchedFeatures.slice(0, PRINT_LIMIT).join(', ')}`);
    }
    const accounted = matched.size + ambiguous.length + contested.length + unmatchedFeatures.length;
    if (accounted !== feats.length) {
        console.warn(`  ⚠️  не сходится: ${feats.length} границ на входе, учтено ${accounted}`);
    }

    const keptCodes = ops.map(o => o.updateOne.filter.code);

    if (dryRun) {
        console.log(`  🔍 dry run - записали бы ${ops.length}`);
        await reportStale(Region, 'code', keptCodes, 'регионы', { pruneStale, dryRun });
        return { written: 0, missing: missing.length };
    }

    if (ops.length) await Region.bulkWrite(ops, { ordered: false });
    console.log(`  ✅ записано регионов: ${ops.length}`);
    await reportStale(Region, 'code', keptCodes, 'регионы', { pruneStale, dryRun });
    return { written: ops.length, missing: missing.length };
}

export async function importDistricts({ dryRun, allowDegenerate, pruneStale } = {}) {
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
    const contested = [];
    const tiers = new Map();

    for (const f of feats) {
        const m = matchFeature(f, entries);
        if (!m) { unmatchedFeatures.push(osmNameStrings(f.properties)[0] || '(без имени)'); continue; }
        if (m.ambiguous) { ambiguous.push(`${osmNameStrings(f.properties)[0]} -> ${m.ambiguous.join(', ')}`); continue; }
        if (matched.has(m.entry.districtCode)) {
            // Two boundaries claiming one code. Previously this was a bare
            // `continue`, so the second one vanished with no trace: 204 features
            // in, 189 matched, 9 reported unmatched, and six unaccounted for.
            // Whichever of the two is wrong, silence is the wrong answer.
            contested.push(`${m.entry.districtCode} <- ${osmNameStrings(f.properties)[0]} (уже занят)`);
            continue;
        }
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
    if (contested.length) {
        console.warn(`  ⚠️  на один код претендует больше одной границы: ${contested.length}`);
        for (const c of contested.slice(0, PRINT_LIMIT)) console.warn(`     ${c}`);
    }
    if (unmatchedFeatures.length) {
        console.log(`  границ OSM без пары в справочнике: ${unmatchedFeatures.length}`);
        console.log(`    ${unmatchedFeatures.slice(0, PRINT_LIMIT).join(', ')}`);
    }
    // Everything that came in has to come out somewhere in this arithmetic, or a
    // feature was dropped by a branch nobody is watching.
    const accounted = matched.size + ambiguous.length + contested.length + unmatchedFeatures.length;
    if (accounted !== feats.length) {
        console.warn(`  ⚠️  не сходится: ${feats.length} границ на входе, учтено ${accounted}`);
    }

    const keptIds = ops.map(o => o.updateOne.filter.apiId);

    if (dryRun) {
        console.log(`  🔍 dry run - записали бы ${ops.length}`);
        await reportStale(District, 'apiId', keptIds, 'районы', { pruneStale, dryRun });
        return { written: 0, missing: missing.length };
    }

    if (ops.length) await District.bulkWrite(ops, { ordered: false });
    console.log(`  ✅ записано районов: ${ops.length}`);
    await reportStale(District, 'apiId', keptIds, 'районы', { pruneStale, dryRun });
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
    // Removes documents this run did not produce. Off by default: deleting a
    // district orphans the districtId of every object pointing at it.
    const pruneStale = args.includes('--prune-stale');

    console.log('═══════════════════════════════════════');
    console.log('  GeoData Import - OpenStreetMap');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - без записи');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI не задан'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB');

    try {
        const r = await importRegions({ dryRun, allowDegenerate, pruneStale });
        const d = await importDistricts({ dryRun, allowDegenerate, pruneStale });

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