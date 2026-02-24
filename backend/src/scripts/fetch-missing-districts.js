/**
 * Fetch missing districts that failed import due to duplicate vertices.
 * 
 * Affected districts:
 *   - Xo'jaobod tumani (Andijan, apiId 201)
 *   - Oltinko'l tumani  (Andijan, apiId 194)
 *   - Gurlan tumani     (Khorezm, apiId unknown — looked up from API)
 * 
 * Usage:
 *   node src/scripts/fetch-missing-districts.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import * as turf from '@turf/turf';
import District from '../district/model.js';
import CropType from '../crop/model.js';
import { translateDistrict } from './geo-translations.js';

const BASE_URL = 'https://crop.agro.uz';
const REQUEST_DELAY = 1500;

let sessionCookies = '';
let xsrfToken = '';
let lastRequestTime = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initSession() {
    console.log('🔑 Initializing session...');
    const res = await fetch(BASE_URL + '/uz/map', {
        headers: { 'accept': 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; YMap/1.0)' },
        redirect: 'follow'
    });
    let setCookies = [];
    try { setCookies = res.headers.getSetCookie?.() || []; } catch { }
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
    console.log('✅ Session established');
}

async function apiFetch(path) {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < REQUEST_DELAY) await sleep(REQUEST_DELAY - elapsed);
    lastRequestTime = Date.now();

    const res = await fetch(BASE_URL + path, {
        headers: {
            'accept': 'application/json, text/plain, */*',
            'x-requested-with': 'XMLHttpRequest',
            'referer': BASE_URL + '/uz/map',
            'user-agent': 'Mozilla/5.0 (compatible; YMap/1.0)',
            ...(sessionCookies && { 'cookie': sessionCookies }),
            ...(xsrfToken && { 'x-xsrf-token': xsrfToken }),
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
}

// ─────────────────────────────────────────────
// Geometry helpers (with duplicate vertex fix)
// ─────────────────────────────────────────────

/**
 * Remove ALL duplicate coordinates from a ring (not just consecutive).
 * Turf.js rejects any duplicate vertex in a ring except the closing point.
 */
function deduplicateRing(ring) {
    if (!ring || ring.length < 2) return ring;
    const seen = new Set();
    const deduped = [];
    // Process all but the last point (which is the closing duplicate of first)
    const points = ring.slice(0, -1);
    for (const coord of points) {
        const key = coord[0] + ',' + coord[1];
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(coord);
        }
    }
    // Close the ring
    if (deduped.length >= 3) {
        deduped.push([...deduped[0]]);
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

function normalizeGeometry(data) {
    if (!data) return null;
    if (data.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [data.coordinates] };
    if (data.type === 'MultiPolygon') return data;
    if (data.type === 'FeatureCollection' && data.features?.length) {
        const allCoords = [];
        for (const f of data.features) {
            if (!f.geometry) continue;
            if (f.geometry.type === 'Polygon') allCoords.push(f.geometry.coordinates);
            else if (f.geometry.type === 'MultiPolygon') allCoords.push(...f.geometry.coordinates);
        }
        return allCoords.length ? { type: 'MultiPolygon', coordinates: allCoords } : null;
    }
    if (data.type === 'Feature' && data.geometry) return normalizeGeometry(data.geometry);
    return null;
}

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
    try { return turf.centroid(turf.feature(geometry)).geometry; } catch { return null; }
}

function computeAreaKm2(geometry) {
    try { return Math.round((turf.area(turf.feature(geometry)) / 1_000_000) * 100) / 100; } catch { return null; }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  Fetch Missing Districts');
    console.log('═══════════════════════════════════════\n');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    await initSession();

    // Find which districts are in the API but not in our DB
    // Check Andijan (17) and Khorezm (22) — the two regions with failures
    const regionsToCheck = [
        { code: 17, name: 'Andijan' },
        { code: 22, name: 'Khorezm' }
    ];

    let imported = 0;
    let failed = 0;

    for (const region of regionsToCheck) {
        console.log(`\n📂 Checking ${region.name} (code ${region.code})...`);
        const districts = await apiFetch(`/api/json/districts/${region.code}`);

        for (const dist of districts) {
            // Skip if already in DB
            const exists = await District.findOne({ apiId: dist.id });
            if (exists) continue;

            console.log(`\n  📡 Fetching ${dist.nameuz} (apiId ${dist.id})...`);

            let geomData;
            try {
                geomData = await apiFetch(`/api/json/district/${dist.id}`);
            } catch (err) {
                console.warn(`  ❌ API error: ${err.message}`);
                failed++;
                continue;
            }

            let geometry = normalizeGeometry(geomData);
            if (!geometry) {
                console.warn(`  ❌ No geometry`);
                failed++;
                continue;
            }

            // Deduplicate + repair BEFORE saving
            geometry = deduplicateGeometry(geometry);

            const translated = translateDistrict(dist.nameuz);
            const doc = {
                regionCode: region.code,
                apiId: dist.id,
                cadNum: dist.cad_num || null,
                name: { en: translated.en, ru: translated.ru, uz: dist.nameuz },
                geometry,
                centroid: computeCentroid(geometry),
                areaKm2: computeAreaKm2(geometry),
                crops: []
            };

            try {
                await District.findOneAndUpdate(
                    { apiId: dist.id },
                    doc,
                    { upsert: true, new: true }
                );
                console.log(`  ✅ ${translated.en} (${doc.areaKm2} km²)`);
                imported++;
            } catch (err) {
                if (err.code === 16755 || err?.errorResponse?.code === 16755) {
                    console.warn(`  ⚠ Self-intersecting after dedup, attempting full repair...`);
                    const repaired = repairGeometry(geometry);
                    if (!repaired) { console.warn(`  ❌ Repair failed`); failed++; continue; }
                    doc.geometry = repaired;
                    doc.centroid = computeCentroid(repaired);
                    doc.areaKm2 = computeAreaKm2(repaired);
                    try {
                        await District.findOneAndUpdate(
                            { apiId: dist.id },
                            doc,
                            { upsert: true, new: true }
                        );
                        console.log(`  ✅ ${translated.en} (repaired, ${doc.areaKm2} km²)`);
                        imported++;
                    } catch (retryErr) {
                        console.warn(`  ❌ Still failing: ${retryErr.message}`);
                        failed++;
                    }
                } else {
                    throw err;
                }
            }

            // Fetch crops too
            try {
                const crops = await apiFetch(`/api/plants/${dist.id}`);
                if (crops?.length) {
                    const districtCrops = crops.map(c => ({ apiId: c.id, name: c.name, color: c.color }));
                    await District.updateOne({ apiId: dist.id }, { $set: { crops: districtCrops } });
                    // Also upsert global crop types
                    for (const c of crops) {
                        await CropType.findOneAndUpdate(
                            { apiId: c.id },
                            { apiId: c.id, name: { uz: c.name }, color: c.color },
                            { upsert: true }
                        );
                    }
                    console.log(`  🌾 ${crops.length} crops`);
                }
            } catch (err) {
                console.warn(`  ⚠ Crops fetch failed: ${err.message}`);
            }
        }
    }

    const total = await District.countDocuments(regionFilter);
    console.log('\n═══════════════════════════════════════');
    console.log(`  Done: ${imported} imported, ${failed} failed`);
    console.log(`  Total districts in DB: ${total}`);
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
}

main().catch(err => { console.error('❌', err); process.exit(1); });