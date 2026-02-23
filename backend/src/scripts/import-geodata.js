/**
 * Import GeoData Script
 * 
 * Reads region and district GeoJSON files, processes them, and imports
 * into MongoDB with proper 2dsphere-compatible geometries.
 * 
 * Usage:
 *   node src/scripts/import-geodata.js
 * 
 * Expected file structure:
 *   backend/geodata/
 *     regions/
 *       uzbekistan_regional.geojson       ← ADM1 regions (14 features)
 *     districts/
 *       tashkent_districts.geojson        ← .geojson district files (primary)
 *       andijan_districts.geojson
 *       ...
 *     districts_js/
 *       toshkent.js                       ← .js district files (for shapeID merge)
 *       andijon.js
 *       ...
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';
import Region from '../region/model.js';
import District from '../district/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEODATA_DIR = path.resolve(__dirname, '../../geodata');

// ─────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────

/**
 * Unwrap GeometryCollection → MultiPolygon/Polygon
 * MongoDB 2dsphere doesn't support GeometryCollection
 */
function unwrapGeometry(geometry) {
    if (!geometry) return null;

    if (geometry.type === 'GeometryCollection' && geometry.geometries?.length) {
        // Take the first geometry inside the collection
        return normalizeToMultiPolygon(geometry.geometries[0]);
    }

    return normalizeToMultiPolygon(geometry);
}

/**
 * Normalize Polygon to MultiPolygon for consistency
 */
function normalizeToMultiPolygon(geometry) {
    if (!geometry) return null;

    if (geometry.type === 'Polygon') {
        return {
            type: 'MultiPolygon',
            coordinates: [geometry.coordinates]
        };
    }

    if (geometry.type === 'MultiPolygon') {
        return geometry;
    }

    console.warn(`  ⚠ Unexpected geometry type: ${geometry.type}`);
    return null;
}

/**
 * Repair self-intersecting polygons that MongoDB 2dsphere rejects.
 * Uses turf.unkinkPolygon to split crossing edges into valid parts,
 * then reassembles as MultiPolygon.
 */
function repairGeometry(geometry) {
    try {
        if (geometry.type === 'MultiPolygon') {
            // Process each polygon in the multi separately
            const repairedPolygons = [];

            for (const polyCoords of geometry.coordinates) {
                const poly = turf.polygon(polyCoords);
                const kinks = turf.kinks(poly);

                if (kinks.features.length > 0) {
                    // Has self-intersections — unkink it
                    const unkinked = turf.unkinkPolygon(poly);
                    for (const part of unkinked.features) {
                        repairedPolygons.push(part.geometry.coordinates);
                    }
                } else {
                    repairedPolygons.push(polyCoords);
                }
            }

            return {
                type: 'MultiPolygon',
                coordinates: repairedPolygons
            };
        }

        if (geometry.type === 'Polygon') {
            const poly = turf.polygon(geometry.coordinates);
            const kinks = turf.kinks(poly);

            if (kinks.features.length === 0) {
                return geometry; // Already valid
            }

            const unkinked = turf.unkinkPolygon(poly);
            return {
                type: 'MultiPolygon',
                coordinates: unkinked.features.map(f => f.geometry.coordinates)
            };
        }

        return geometry;
    } catch (err) {
        console.warn(`    ⚠ Geometry repair failed: ${err.message}`);
        return null;
    }
}

/**
 * Try to upsert a document. If it fails due to invalid GeoJSON (self-intersecting edges),
 * attempt to repair the geometry and retry.
 */
async function upsertWithRepair(Model, filter, doc, label) {
    try {
        return await Model.findOneAndUpdate(filter, doc, { upsert: true, new: true });
    } catch (err) {
        // Check if this is a GeoJSON validation error (code 16755)
        if (err.code === 16755 || err?.errorResponse?.code === 16755) {
            console.warn(`    ⚠ ${label}: invalid geometry detected, attempting repair...`);

            const repaired = repairGeometry(doc.geometry);
            if (!repaired) {
                console.warn(`    ❌ ${label}: repair failed, skipping`);
                return null;
            }

            // Recompute centroid and area from repaired geometry
            doc.geometry = repaired;
            doc.centroid = computeCentroid(repaired);
            doc.areaKm2 = computeAreaKm2(repaired);

            try {
                const result = await Model.findOneAndUpdate(filter, doc, { upsert: true, new: true });
                console.warn(`    ✅ ${label}: repaired successfully`);
                return result;
            } catch (retryErr) {
                console.warn(`    ❌ ${label}: repair didn't fix the issue (${retryErr.message}), skipping`);
                return null;
            }
        }

        // Some other error — rethrow
        throw err;
    }
}

/**
 * Compute centroid using turf.js
 */
function computeCentroid(geometry) {
    try {
        const feature = turf.feature(geometry);
        const centroid = turf.centroid(feature);
        return {
            type: 'Point',
            coordinates: centroid.geometry.coordinates
        };
    } catch (err) {
        console.warn(`  ⚠ Centroid computation failed: ${err.message}`);
        return null;
    }
}

/**
 * Compute area in km² using turf.js
 */
function computeAreaKm2(geometry) {
    try {
        const feature = turf.feature(geometry);
        const areaM2 = turf.area(feature);
        return Math.round((areaM2 / 1_000_000) * 100) / 100;
    } catch (err) {
        console.warn(`  ⚠ Area computation failed: ${err.message}`);
        return null;
    }
}

/**
 * Haversine distance between two [lng, lat] points in meters
 */
function distanceMeters(coordsA, coordsB) {
    const from = turf.point(coordsA);
    const to = turf.point(coordsB);
    return turf.distance(from, to, { units: 'meters' });
}

// ─────────────────────────────────────────────
// File reading helpers
// ─────────────────────────────────────────────

function readGeoJSON(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

/**
 * Read a .js file that exports a variable (e.g. `const toshkent = {...}`)
 * Strips the variable declaration to get raw JSON
 */
function readJSGeoData(filePath) {
    let raw = fs.readFileSync(filePath, 'utf-8');

    // Remove BOM if present
    if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
    }

    // Strip "const varname = " or "export default " prefix
    raw = raw.replace(/^(?:export\s+default\s+|(?:const|let|var)\s+\w+\s*=\s*)/m, '');

    // Remove trailing semicolons
    raw = raw.replace(/;\s*$/, '');

    // Fix unquoted keys: `type:` → `"type":`
    // Only fix keys that are plain identifiers (not already quoted)
    raw = raw.replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1 "$2":');

    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`  ⚠ Failed to parse JS file ${path.basename(filePath)}: ${err.message}`);
        return null;
    }
}

function listFiles(dir, extension) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith(extension))
        .map(f => path.join(dir, f));
}

// ─────────────────────────────────────────────
// Step 1: Import Regions
// ─────────────────────────────────────────────

async function importRegions() {
    const regionsFile = path.join(GEODATA_DIR, 'regions', 'uzbekistan_regional.geojson');

    if (!fs.existsSync(regionsFile)) {
        console.error(`❌ Regions file not found: ${regionsFile}`);
        console.error('   Place uzbekistan_regional.geojson in backend/geodata/regions/');
        return [];
    }

    const geojson = readGeoJSON(regionsFile);
    console.log(`\n📍 Importing ${geojson.features.length} regions from uzbekistan_regional.geojson`);

    const imported = [];

    for (const feature of geojson.features) {
        const props = feature.properties;
        const code = props.id || props.code;

        if (!code) {
            console.warn(`  ⚠ Skipping feature without id/code: ${JSON.stringify(props)}`);
            continue;
        }

        const geometry = unwrapGeometry(feature.geometry);
        if (!geometry) {
            console.warn(`  ⚠ Skipping region ${code}: could not unwrap geometry`);
            continue;
        }

        const centroid = computeCentroid(geometry);
        const areaKm2 = computeAreaKm2(geometry);

        const regionDoc = {
            code,
            name: {
                en: props.ADM1_EN || props.name_en || '',
                ru: props.ADM1_RU || props.name_ru || '',
                uz: props.ADM1_UZ || props.name_uz || ''
            },
            geometry,
            centroid,
            areaKm2
        };

        const result = await upsertWithRepair(Region, { code }, regionDoc, `Region ${code} ${regionDoc.name.en}`);
        if (!result) continue;

        imported.push(regionDoc);
        console.log(`  ✅ Region ${code}: ${regionDoc.name.en} (${areaKm2} km²)`);
    }

    return imported;
}

// ─────────────────────────────────────────────
// Step 2: Import Districts from .geojson files
// ─────────────────────────────────────────────

async function importDistrictsFromGeoJSON(regions) {
    const districtDir = path.join(GEODATA_DIR, 'districts');
    const files = listFiles(districtDir, '.geojson');

    if (files.length === 0) {
        console.warn('\n⚠ No .geojson district files found in backend/geodata/districts/');
        return [];
    }

    console.log(`\n📍 Importing districts from ${files.length} .geojson files`);

    // Clean up previously imported districts (they may have dedup issues from earlier runs)
    const oldCount = await District.countDocuments();
    if (oldCount > 0) {
        console.log(`  🗑  Clearing ${oldCount} existing districts before reimport...`);
        await District.deleteMany({});
    }

    const allDistricts = [];

    for (const filePath of files) {
        const fileName = path.basename(filePath);
        const geojson = readGeoJSON(filePath);

        console.log(`\n  📂 ${fileName} (${geojson.features?.length || 0} features)`);

        if (!geojson.features?.length) continue;

        // Log property keys from first feature for debugging
        const firstProps = geojson.features[0]?.properties;
        if (firstProps) {
            console.log(`    📋 Properties: [${Object.keys(firstProps).join(', ')}]`);
        }

        for (const feature of geojson.features) {
            const props = feature.properties;
            const geometry = unwrapGeometry(feature.geometry);
            if (!geometry) {
                console.warn(`    ⚠ Skipping: could not unwrap geometry for ${props?.ADM2_EN || 'unknown'}`);
                continue;
            }

            const centroid = computeCentroid(geometry);
            if (!centroid) continue;

            const areaKm2 = computeAreaKm2(geometry);

            // Determine regionCode by checking which region polygon contains this district
            let regionCode = null;
            for (const region of regions) {
                try {
                    const districtPoint = turf.point(centroid.coordinates);
                    const regionFeature = turf.feature(region.geometry);
                    if (turf.booleanPointInPolygon(districtPoint, regionFeature)) {
                        regionCode = region.code;
                        break;
                    }
                } catch {
                    // Skip if region geometry can't be tested
                }
            }

            // Fallback: nearest region centroid
            if (regionCode === null) {
                let minDist = Infinity;
                for (const region of regions) {
                    if (region.centroid?.coordinates) {
                        const dist = distanceMeters(centroid.coordinates, region.centroid.coordinates);
                        if (dist < minDist) {
                            minDist = dist;
                            regionCode = region.code;
                        }
                    }
                }
                if (regionCode !== null) {
                    const fName = props?.ADM2_EN || props?.name || props?.Name || 'unknown';
                    console.warn(`    ⚠ ${fName}: used centroid fallback → region ${regionCode}`);
                }
            }

            if (regionCode === null) {
                const fName = props?.ADM2_EN || props?.name || props?.Name || 'unknown';
                console.warn(`    ⚠ Skipping ${fName}: could not determine region`);
                continue;
            }

            // Extract names from various property key patterns
            // Some district files use ADM1_* keys, some ADM2_*, some just "name"
            const nameEn = props.ADM2_EN || props.ADM1_EN
                || props.name_en || props.NAME_EN || props.Name_EN
                || props.name || props.Name || props.NAME
                || props.shapeName || props.district || props.DISTRICT
                || props.label || '';
            const nameRu = props.ADM2_RU || props.ADM1_RU
                || props.name_ru || props.NAME_RU || props.Name_RU || '';
            const nameUz = props.ADM2_UZ || props.ADM1_UZ
                || props.name_uz || props.NAME_UZ || props.Name_UZ || '';

            // Warn if no name found — log available keys for debugging
            if (!nameEn) {
                const keys = Object.keys(props).join(', ');
                console.warn(`    ⚠ No district name found! Available properties: [${keys}]`);
                console.warn(`      Values: ${JSON.stringify(props)}`);
            }

            const districtDoc = {
                regionCode,
                name: {
                    en: nameEn,
                    ru: nameRu,
                    uz: nameUz
                },
                geometry,
                centroid,
                areaKm2
            };

            // Dedup key: use regionCode + name if name exists,
            // otherwise fall back to regionCode + centroid (rounded to avoid float issues)
            let upsertFilter;
            if (nameEn) {
                upsertFilter = { regionCode, 'name.en': nameEn };
            } else {
                // Centroid-based dedup for nameless features
                const cLng = Math.round(centroid.coordinates[0] * 10000) / 10000;
                const cLat = Math.round(centroid.coordinates[1] * 10000) / 10000;
                upsertFilter = {
                    regionCode,
                    'centroid.coordinates.0': { $gte: cLng - 0.001, $lte: cLng + 0.001 },
                    'centroid.coordinates.1': { $gte: cLat - 0.001, $lte: cLat + 0.001 }
                };
            }

            const doc = await upsertWithRepair(
                District,
                upsertFilter,
                districtDoc,
                nameEn || `unnamed@${centroid.coordinates}`
            );

            if (!doc) continue;

            allDistricts.push({ ...districtDoc, _id: doc._id });
            console.log(`    ✅ ${nameEn || '(unnamed)'} → region ${regionCode} (${areaKm2} km²)`);
        }
    }

    return allDistricts;
}

// ─────────────────────────────────────────────
// Step 3: Merge shapeIDs from .js files
// ─────────────────────────────────────────────

async function mergeShapeIDsFromJS(importedDistricts) {
    const jsDir = path.join(GEODATA_DIR, 'districts_js');
    const files = listFiles(jsDir, '.js');

    if (files.length === 0) {
        console.warn('\n⚠ No .js district files found in backend/geodata/districts_js/ — skipping shapeID merge');
        return;
    }

    console.log(`\n🔗 Merging shapeIDs from ${files.length} .js files`);

    // Collect all .js features with their centroids
    const jsFeatures = [];

    for (const filePath of files) {
        const fileName = path.basename(filePath);
        const data = readJSGeoData(filePath);

        if (!data?.features?.length) {
            console.warn(`  ⚠ No features in ${fileName}`);
            continue;
        }

        for (const feature of data.features) {
            const props = feature.properties || {};

            // Skip region outlines (ADM1), only want districts (ADM2)
            if (props.ADM1_EN || props.ADM1_RU) continue;
            if (props.shapeType && props.shapeType !== 'ADM2') continue;

            const geometry = unwrapGeometry(feature.geometry);
            if (!geometry) continue;

            const centroid = computeCentroid(geometry);
            if (!centroid) continue;

            jsFeatures.push({
                name: props.name || '',
                shapeID: props.shapeID || '',
                centroid: centroid.coordinates
            });
        }
    }

    console.log(`  📦 ${jsFeatures.length} ADM2 features extracted from .js files`);

    // Match each imported district to nearest .js feature by centroid
    let matched = 0;
    const usedJsIndices = new Set();

    for (const district of importedDistricts) {
        if (!district.centroid?.coordinates) continue;

        let bestIdx = -1;
        let bestDist = Infinity;

        for (let i = 0; i < jsFeatures.length; i++) {
            if (usedJsIndices.has(i)) continue;

            const dist = distanceMeters(district.centroid.coordinates, jsFeatures[i].centroid);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }

        // Only match if within 15km (reasonable threshold for centroid proximity)
        if (bestIdx >= 0 && bestDist < 15000 && jsFeatures[bestIdx].shapeID) {
            usedJsIndices.add(bestIdx);

            await District.updateOne(
                { _id: district._id },
                { $set: { shapeID: jsFeatures[bestIdx].shapeID } }
            );

            matched++;
            console.log(`    🔗 ${district.name.en} ↔ ${jsFeatures[bestIdx].name} (shapeID: ${jsFeatures[bestIdx].shapeID.substring(0, 12)}..., ${Math.round(bestDist)}m)`);
        }
    }

    console.log(`  ✅ Matched ${matched}/${importedDistricts.length} districts with shapeIDs`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  GeoData Import Script');
    console.log('═══════════════════════════════════════');
    console.log(`  Geodata dir: ${GEODATA_DIR}`);

    // Verify directory exists
    if (!fs.existsSync(GEODATA_DIR)) {
        console.error(`\n❌ Geodata directory not found: ${GEODATA_DIR}`);
        console.error('   Create it and place the GeoJSON files inside.');
        process.exit(1);
    }

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('\n❌ MONGODB_URI not set in environment');
        process.exit(1);
    }

    console.log(`\n🔌 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    try {
        // Step 1: Import regions
        const regions = await importRegions();
        console.log(`\n📊 Regions imported: ${regions.length}`);

        // Step 2: Import districts from .geojson
        const districts = await importDistrictsFromGeoJSON(regions);
        console.log(`\n📊 Districts imported: ${districts.length}`);

        // Step 3: Merge shapeIDs from .js files
        await mergeShapeIDsFromJS(districts);

        // Summary
        const regionCount = await Region.countDocuments();
        const districtCount = await District.countDocuments();

        console.log('\n═══════════════════════════════════════');
        console.log('  Import Complete');
        console.log('═══════════════════════════════════════');
        console.log(`  Regions:   ${regionCount}`);
        console.log(`  Districts: ${districtCount}`);
        console.log('═══════════════════════════════════════\n');

    } catch (err) {
        console.error('\n❌ Import failed:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main();