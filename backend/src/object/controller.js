// backend/src/object/controller.js

import mongoose from 'mongoose';
import Object_ from './model.js';
import District from '../district/model.js';

// ── Source API configuration ──────────────────────────────────────────────────

const SOURCES = [
    { key: 'ssv', url: 'https://duasr.uz/api4/ssv', objectType: 'health_post' },
    { key: 'bogcha', url: 'https://duasr.uz/api4/bogcha', objectType: 'kindergarten' },
    { key: 'maktab44', url: 'https://duasr.uz/api4/maktab44', objectType: 'school' },
];

// ── Coord jitter helpers ──────────────────────────────────────────────────────

// Returns a random offset in degrees within ~±radiusMeters around a centroid.
// ~1 degree lat ≈ 111 km, so radiusMeters / 111000 gives degree offset.
function jitter(centroidLat, centroidLng, radiusMeters = 1500) {
    const r = radiusMeters / 111000;
    const u = Math.random();
    const v = Math.random();
    // Box-Muller-style spread capped to radius
    const dLat = (u * 2 - 1) * r;
    const dLng = (v * 2 - 1) * r / Math.cos((centroidLat * Math.PI) / 180);
    return {
        lat: Math.round((centroidLat + dLat) * 1e6) / 1e6,
        lng: Math.round((centroidLng + dLng) * 1e6) / 1e6
    };
}

// ── Raw → document transformer ────────────────────────────────────────────────

function transformRecord(raw, sourceKey, objectType, coords, districtMatch) {
    const inn = raw.inn != null ? String(raw.inn) : null;

    const details = {};
    // Fields shared across all three APIs
    if (raw.material_sten) details.materialSten = raw.material_sten;
    if (raw.elektr_kun_davomida) details.elektrKunDavomida = raw.elektr_kun_davomida;
    if (raw.ichimlik_suvi_manbaa) details.ichimlikSuviManbaa = raw.ichimlik_suvi_manbaa;
    if (raw.kapital_tamir) details.kapitalTamir = String(raw.kapital_tamir);
    if (raw.qurilish_yili) details.qurilishYili = String(raw.qurilish_yili);

    // ssv-specific
    if (raw.internet) details.internet = raw.internet;
    if (raw.bino_ichida_suv) details.binoIchidaSuv = raw.bino_ichida_suv;

    // bogcha / maktab44
    if (raw.internetga_ulanish_turi) details.internet = raw.internetga_ulanish_turi;
    if (raw.sigimi != null) details.sigimi = Number(raw.sigimi) || null;
    if (raw.umumiy_uquvchi != null) details.umumiyUquvchi = Number(raw.umumiy_uquvchi) || null;
    if (raw.aktiv_zal_holati) details.aktivZalHolati = raw.aktiv_zal_holati;
    if (raw.oshhona_holati) details.oshhonaHolati = raw.oshhona_holati;

    // maktab44-specific
    if (raw.smena) details.smena = String(raw.smena);
    if (raw.sport_zal_holati) details.sportZalHolati = raw.sport_zal_holati;

    return {
        uid: raw._uid_,
        inn,
        code: raw.code || null,
        parentCode: raw.parent_code || null,
        sourceApi: sourceKey,
        objectType,
        name: raw.obekt_nomi || 'Неизвестно',
        nameRu: raw.obekt_nomi_ru || null,
        nameEn: raw.obekt_nomi_en || null,
        viloyat: raw.viloyat || null,
        tuman: raw.tuman || null,
        regionCode: districtMatch?.regionCode || null,
        districtId: districtMatch?._id || null,
        lat: coords.lat,
        lng: coords.lng,
        location: {
            type: 'Point',
            coordinates: [coords.lng, coords.lat]
        },
        details,
        sourceUpdatedAt: raw.updated ? new Date(raw.updated) : null,
        lastSyncedAt: new Date()
    };
}

// ── District lookup cache (per sync run, keyed by parentCode) ─────────────────

async function buildDistrictCache(parentCodes) {
    const cache = new Map();
    // Districts store regionCode and centroid geometry — query by code field
    const districts = await District.find({
        code: { $in: [...parentCodes] }
    }).select('code regionCode centroid geometry').lean();

    for (const d of districts) {
        cache.set(d.code, d);
    }
    return cache;
}

function getCentroid(district) {
    // Prefer explicit centroid point, fall back to geometry centroid approximation
    if (district.centroid?.coordinates) {
        return {
            lat: district.centroid.coordinates[1],
            lng: district.centroid.coordinates[0]
        };
    }
    return null;
}

// ── GET /api/objects ──────────────────────────────────────────────────────────

export const getObjects = async (req, res) => {
    const { objectType, sourceApi, regionCode, districtId, limit = 500, offset = 0 } = req.query;

    const filter = {};
    if (objectType) filter.objectType = objectType;
    if (sourceApi) filter.sourceApi = sourceApi;
    if (regionCode) filter.regionCode = parseInt(regionCode);
    if (districtId && mongoose.isValidObjectId(districtId)) filter.districtId = districtId;

    const [total, docs] = await Promise.all([
        Object_.countDocuments(filter),
        Object_.find(filter)
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean()
    ]);

    res.json({
        success: true,
        total,
        data: docs.map(d => ({ ...d, id: d._id.toString(), _id: undefined, __v: undefined, location: undefined }))
    });
};

// ── GET /api/objects/:id ──────────────────────────────────────────────────────

export const getObject = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const doc = await Object_.findById(id).lean();
    if (!doc) {
        return res.status(404).json({ success: false, message: 'Object not found' });
    }

    res.json({
        success: true,
        data: { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined, location: undefined }
    });
};

// ── POST /api/admin/sync-objects ──────────────────────────────────────────────
// Fetches all three duasr.uz endpoints, upserts records by (inn + code + sourceApi).
// Responds immediately with a jobId; caller polls /api/admin/jobs/:jobId.

export const syncObjects = async (req, res, jobId, updateJob) => {
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
        for (const source of SOURCES) {
            updateJob(jobId, { phase: `fetching_${source.key}`, progress: 0, total: 0 });

            // Fetch from source API
            let records;
            try {
                const resp = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                records = await resp.json();
            } catch (err) {
                console.error(`[sync] Failed to fetch ${source.key}:`, err.message);
                updateJob(jobId, { phase: `error_${source.key}`, error: err.message });
                continue;
            }

            updateJob(jobId, { phase: `processing_${source.key}`, progress: 0, total: records.length });

            // Collect all unique parentCodes for bulk district lookup
            const parentCodes = new Set(records.map(r => r.parent_code).filter(Boolean));
            const districtCache = await buildDistrictCache(parentCodes);

            // Build bulk upsert operations
            const ops = [];
            for (const raw of records) {
                const districtMatch = raw.parent_code ? districtCache.get(raw.parent_code) : null;
                const centroid = districtMatch ? getCentroid(districtMatch) : null;

                if (!centroid) {
                    totalSkipped++;
                    continue;
                }

                const coords = jitter(centroid.lat, centroid.lng, 1500);
                const doc = transformRecord(raw, source.key, source.objectType, coords, districtMatch);

                // Build compound filter for upsert uniqueness
                // inn can be null for some records; fall back to uid+code+sourceApi
                const filter = doc.inn && doc.code
                    ? { inn: doc.inn, code: doc.code, sourceApi: doc.sourceApi }
                    : { uid: doc.uid, code: doc.code, sourceApi: doc.sourceApi };

                ops.push({
                    updateOne: {
                        filter,
                        update: { $set: doc },
                        upsert: true
                    }
                });
            }

            if (ops.length === 0) continue;

            // Execute in batches of 500
            const BATCH = 500;
            for (let i = 0; i < ops.length; i += BATCH) {
                const batch = ops.slice(i, i + BATCH);
                const result = await Object_.bulkWrite(batch, { ordered: false });
                totalInserted += result.upsertedCount || 0;
                totalUpdated += result.modifiedCount || 0;
                updateJob(jobId, {
                    phase: `processing_${source.key}`,
                    progress: Math.min(i + BATCH, ops.length),
                    total: ops.length
                });
            }
        }

        updateJob(jobId, {
            status: 'done',
            phase: 'done',
            result: { inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped }
        });

    } catch (err) {
        console.error('[sync] Unexpected error:', err);
        updateJob(jobId, { status: 'error', error: err.message });
    }
};