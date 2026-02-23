/**
 * Import GeoData from crop.agro.uz API
 * 
 * Fetches region boundaries, district boundaries, and crop data
 * from the official Uzbekistan crop databank API.
 * 
 * Usage:
 *   node src/scripts/import-geodata.js [--skip-crops] [--delay=1000]
 * 
 * Options:
 *   --skip-crops    Don't fetch crop/plant data per district
 *   --delay=N       Milliseconds between API requests (default: 1000)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import * as turf from '@turf/turf';
import Region from '../region/model.js';
import District from '../district/model.js';
import CropType from '../crop/model.js';
import {
    translateRegion, translateDistrict,
    normalizeUzName, TASHKENT_CITY, TASHKENT_REGION
} from './geo-translations.js';

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const BASE_URL = 'https://crop.agro.uz';
const DEFAULT_DELAY = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 5000; // 5 seconds base backoff

function parseArgs() {
    const args = process.argv.slice(2);
    const delayArg = args.find(a => a.startsWith('--delay='));
    return {
        skipCrops: args.includes('--skip-crops'),
        delay: delayArg ? parseInt(delayArg.split('=')[1]) : DEFAULT_DELAY
    };
}

// ─────────────────────────────────────────────
// Rate-limited API fetcher with session handling
// ─────────────────────────────────────────────

let sessionCookies = '';
let xsrfToken = '';
let lastRequestTime = 0;
let requestDelay = DEFAULT_DELAY;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize session by visiting the site to get XSRF + session cookies.
 * Required by Laravel's CSRF middleware.
 */
async function initSession() {
    console.log('  🔑 Initializing session...');

    const res = await fetch(BASE_URL + '/uz/map', {
        headers: {
            'accept': 'text/html',
            'user-agent': 'Mozilla/5.0 (compatible; YMap/1.0)'
        },
        redirect: 'follow'
    });

    // Extract Set-Cookie headers
    let setCookies = [];
    try {
        setCookies = res.headers.getSetCookie?.() || [];
    } catch {
        // Fallback
    }
    if (setCookies.length === 0) {
        const raw = res.headers.get('set-cookie') || '';
        if (raw) setCookies = raw.split(/,(?=\s*\w+=)/).map(s => s.trim());
    }

    const cookieParts = [];
    for (const sc of setCookies) {
        const nameVal = sc.split(';')[0];
        cookieParts.push(nameVal);

        if (nameVal.startsWith('XSRF-TOKEN=')) {
            xsrfToken = decodeURIComponent(nameVal.replace('XSRF-TOKEN=', ''));
        }
    }

    sessionCookies = cookieParts.join('; ');
    console.log(`  ✅ Session established (${cookieParts.length} cookies)`);
}

/**
 * Make a rate-limited API request with retries.
 */
async function apiFetch(path, attempt = 1) {
    // Rate limiting
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < requestDelay) {
        await sleep(requestDelay - elapsed);
    }
    lastRequestTime = Date.now();

    const url = BASE_URL + path;
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'x-requested-with': 'XMLHttpRequest',
        'referer': BASE_URL + '/uz/map',
        'user-agent': 'Mozilla/5.0 (compatible; YMap/1.0)',
    };
    if (sessionCookies) headers['cookie'] = sessionCookies;
    if (xsrfToken) headers['x-xsrf-token'] = xsrfToken;

    try {
        const res = await fetch(url, { headers });

        // If we get 419 (CSRF) or 302 redirect, try initializing session
        if ((res.status === 419 || res.status === 302) && attempt === 1) {
            console.warn(`  ⚠ Got ${res.status}, re-initializing session...`);
            await initSession();
            return apiFetch(path, 2);
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        return await res.json();
    } catch (err) {
        if (attempt < MAX_RETRIES) {
            const backoff = RETRY_BACKOFF * attempt;
            console.warn(`  ⚠ ${path}: ${err.message} — retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
            await sleep(backoff);
            return apiFetch(path, attempt + 1);
        }
        throw err;
    }
}

// ─────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────

/**
 * Normalize geometry to MultiPolygon for consistency.
 * Handles Polygon, MultiPolygon, FeatureCollection, and GeometryCollection.
 */
function normalizeGeometry(data) {
    if (!data) return null;

    // Direct Polygon or MultiPolygon
    if (data.type === 'Polygon') {
        return { type: 'MultiPolygon', coordinates: [data.coordinates] };
    }
    if (data.type === 'MultiPolygon') {
        return data;
    }

    // FeatureCollection — merge all polygon features
    if (data.type === 'FeatureCollection' && data.features?.length) {
        const allCoords = [];
        for (const feature of data.features) {
            const geom = feature.geometry;
            if (!geom) continue;
            if (geom.type === 'Polygon') {
                allCoords.push(geom.coordinates);
            } else if (geom.type === 'MultiPolygon') {
                allCoords.push(...geom.coordinates);
            }
        }
        if (allCoords.length === 0) return null;
        return { type: 'MultiPolygon', coordinates: allCoords };
    }

    // GeometryCollection — unwrap first polygon
    if (data.type === 'GeometryCollection' && data.geometries?.length) {
        return normalizeGeometry(data.geometries[0]);
    }

    // Feature — extract geometry
    if (data.type === 'Feature' && data.geometry) {
        return normalizeGeometry(data.geometry);
    }

    console.warn(`  ⚠ Unknown geometry type: ${data.type}`);
    return null;
}

/**
 * Remove consecutive duplicate coordinates from a ring.
 * Fixes "may not have duplicate vertices" errors from MongoDB.
 */
function deduplicateRing(ring) {
    if (!ring || ring.length < 2) return ring;
    const deduped = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
        const prev = deduped[deduped.length - 1];
        const curr = ring[i];
        if (prev[0] !== curr[0] || prev[1] !== curr[1]) {
            deduped.push(curr);
        }
    }
    // Ensure ring is closed
    if (deduped.length >= 2) {
        const first = deduped[0];
        const last = deduped[deduped.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            deduped.push([...first]);
        }
    }
    return deduped;
}

function deduplicateGeometry(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'MultiPolygon') {
        return {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates.map(poly =>
                poly.map(ring => deduplicateRing(ring))
            )
        };
    }
    if (geometry.type === 'Polygon') {
        return {
            type: 'Polygon',
            coordinates: geometry.coordinates.map(ring => deduplicateRing(ring))
        };
    }
    return geometry;
}

/**
 * Repair self-intersecting polygons that MongoDB 2dsphere rejects.
 */
function repairGeometry(geometry) {
    try {
        // Step 1: Deduplicate vertices
        geometry = deduplicateGeometry(geometry);

        // Step 2: Fix self-intersections
        if (geometry.type === 'MultiPolygon') {
            const repaired = [];
            for (const polyCoords of geometry.coordinates) {
                const poly = turf.polygon(polyCoords);
                const kinks = turf.kinks(poly);
                if (kinks.features.length > 0) {
                    const unkinked = turf.unkinkPolygon(poly);
                    for (const part of unkinked.features) {
                        repaired.push(part.geometry.coordinates);
                    }
                } else {
                    repaired.push(polyCoords);
                }
            }
            return { type: 'MultiPolygon', coordinates: repaired };
        }
        return geometry;
    } catch (err) {
        console.warn(`    ⚠ Geometry repair failed: ${err.message}`);
        return null;
    }
}

function computeCentroid(geometry) {
    try {
        return turf.centroid(turf.feature(geometry)).geometry;
    } catch {
        return null;
    }
}

function computeAreaKm2(geometry) {
    try {
        return Math.round((turf.area(turf.feature(geometry)) / 1_000_000) * 100) / 100;
    } catch {
        return null;
    }
}

/**
 * Try saving a document. If 2dsphere rejects it, repair and retry.
 */
async function upsertWithRepair(Model, filter, doc, label) {
    try {
        return await Model.findOneAndUpdate(filter, doc, { upsert: true, new: true });
    } catch (err) {
        if (err.code === 16755 || err?.errorResponse?.code === 16755) {
            console.warn(`    ⚠ ${label}: self-intersecting geometry, repairing...`);
            const repaired = repairGeometry(doc.geometry);
            if (!repaired) {
                console.warn(`    ❌ ${label}: repair failed, skipping`);
                return null;
            }
            doc.geometry = repaired;
            doc.centroid = computeCentroid(repaired);
            doc.areaKm2 = computeAreaKm2(repaired);
            try {
                const result = await Model.findOneAndUpdate(filter, doc, { upsert: true, new: true });
                console.warn(`    ✅ ${label}: repaired`);
                return result;
            } catch (retryErr) {
                console.warn(`    ❌ ${label}: repair didn't fix it, skipping`);
                return null;
            }
        }
        throw err;
    }
}

// ─────────────────────────────────────────────
// Step 1: Import Regions
// ─────────────────────────────────────────────

async function importRegions() {
    console.log('\n📍 Step 1: Fetching regions...');

    const regions = await apiFetch('/api/json/regions');
    console.log(`  Found ${regions.length} regions`);

    const imported = [];

    for (const region of regions) {
        const { id, nameuz, regioncode } = region;

        // Fetch polygon
        console.log(`  📡 ${nameuz} (code ${regioncode})...`);
        const geomData = await apiFetch(`/api/json/regions/${regioncode}`);
        const geometry = deduplicateGeometry(normalizeGeometry(geomData));

        if (!geometry) {
            console.warn(`  ❌ No geometry for ${nameuz}, skipping`);
            continue;
        }

        const centroid = computeCentroid(geometry);
        const areaKm2 = computeAreaKm2(geometry);

        // Translate names — handle Tashkent city vs region
        const isTashkentCity = /shaxri|shahri/i.test(nameuz) && /toshkent/i.test(nameuz);
        const translated = isTashkentCity ? TASHKENT_CITY : translateRegion(nameuz);

        const doc = {
            code: regioncode,
            apiId: id,
            name: {
                en: translated.en,
                ru: translated.ru,
                uz: nameuz
            },
            geometry,
            centroid,
            areaKm2
        };

        const result = await upsertWithRepair(Region, { code: regioncode }, doc, nameuz);
        if (result) {
            imported.push(doc);
            console.log(`  ✅ ${translated.en} (code ${regioncode}, ${areaKm2} km²)`);
        }
    }

    return imported;
}

// ─────────────────────────────────────────────
// Step 2: Import Districts
// ─────────────────────────────────────────────

async function importDistricts(regions) {
    console.log('\n📍 Step 2: Fetching districts...');

    const allDistricts = [];

    for (const region of regions) {
        const { code, name } = region;

        // Fetch district list for this region
        console.log(`\n  📂 ${name.en} (code ${code})`);
        let districts;
        try {
            districts = await apiFetch(`/api/json/districts/${code}`);
        } catch (err) {
            console.warn(`  ❌ Failed to fetch districts for ${name.en}: ${err.message}`);
            continue;
        }
        console.log(`    ${districts.length} districts`);

        for (const district of districts) {
            const { id: distId, nameuz, cad_num } = district;

            // Fetch polygon
            process.stdout.write(`    📡 ${nameuz}...`);
            let geomData;
            try {
                geomData = await apiFetch(`/api/json/district/${distId}`);
            } catch (err) {
                console.warn(` ❌ ${err.message}`);
                continue;
            }

            const geometry = deduplicateGeometry(normalizeGeometry(geomData));
            if (!geometry) {
                console.warn(` ❌ no geometry`);
                continue;
            }

            const centroid = computeCentroid(geometry);
            const areaKm2 = computeAreaKm2(geometry);

            // Translate names
            const translated = translateDistrict(nameuz);

            const doc = {
                regionCode: code,
                apiId: distId,
                cadNum: cad_num || null,
                name: {
                    en: translated.en,
                    ru: translated.ru,
                    uz: nameuz
                },
                geometry,
                centroid,
                areaKm2,
                crops: []
            };

            const result = await upsertWithRepair(
                District,
                { apiId: distId },
                doc,
                translated.en
            );

            if (result) {
                allDistricts.push({ ...doc, _id: result._id });
                console.log(` ✅ ${translated.en} (${areaKm2} km²)`);
            }
        }
    }

    return allDistricts;
}

// ─────────────────────────────────────────────
// Step 3: Fetch Crop Data
// ─────────────────────────────────────────────

async function fetchCropData(districts) {
    console.log('\n🌾 Step 3: Fetching crop data...');

    const allCropTypes = new Map();
    let updatedCount = 0;

    for (const district of districts) {
        const { apiId, name } = district;

        try {
            const crops = await apiFetch(`/api/plants/${apiId}`);

            if (!crops?.length) continue;

            // Collect crop types globally
            const districtCrops = [];
            for (const crop of crops) {
                allCropTypes.set(crop.id, {
                    apiId: crop.id,
                    name: { uz: crop.name, en: '', ru: '' },
                    color: crop.color
                });
                districtCrops.push({
                    apiId: crop.id,
                    name: crop.name,
                    color: crop.color
                });
            }

            // Update district with crop list
            await District.updateOne(
                { apiId },
                { $set: { crops: districtCrops } }
            );

            updatedCount++;
            console.log(`    🌾 ${name.en}: ${crops.length} crops`);
        } catch (err) {
            console.warn(`    ⚠ ${name.en}: crops fetch failed — ${err.message}`);
        }
    }

    // Save global crop types
    for (const crop of allCropTypes.values()) {
        await CropType.findOneAndUpdate(
            { apiId: crop.apiId },
            crop,
            { upsert: true }
        );
    }

    console.log(`\n  ✅ ${updatedCount} districts with crop data`);
    console.log(`  ✅ ${allCropTypes.size} unique crop types saved`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
    const options = parseArgs();
    requestDelay = options.delay;

    console.log('═══════════════════════════════════════');
    console.log('  GeoData Import — crop.agro.uz API');
    console.log('═══════════════════════════════════════');
    console.log(`  Rate limit: ${requestDelay}ms between requests`);
    if (options.skipCrops) console.log('  Skipping crop data');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('\n❌ MONGODB_URI not set in environment');
        process.exit(1);
    }

    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    try {
        // Initialize API session
        await initSession();

        // Step 1: Regions
        const regions = await importRegions();
        console.log(`\n📊 Regions imported: ${regions.length}`);

        if (regions.length === 0) {
            console.error('❌ No regions imported — check API connectivity');
            process.exit(1);
        }

        // Step 2: Districts
        const districts = await importDistricts(regions);
        console.log(`\n📊 Districts imported: ${districts.length}`);

        // Step 3: Crop data
        if (!options.skipCrops && districts.length > 0) {
            await fetchCropData(districts);
        }

        // Summary
        const regionCount = await Region.countDocuments();
        const districtCount = await District.countDocuments();
        const cropCount = await CropType.countDocuments();

        console.log('\n═══════════════════════════════════════');
        console.log('  Import Complete');
        console.log('═══════════════════════════════════════');
        console.log(`  Regions:    ${regionCount}`);
        console.log(`  Districts:  ${districtCount}`);
        console.log(`  Crop types: ${cropCount}`);
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