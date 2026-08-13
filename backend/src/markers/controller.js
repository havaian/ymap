// backend/src/markers/controller.js
//
// Ultra-lightweight endpoints that return ONLY the fields needed for map markers.
// Full details are fetched on demand when a user clicks a marker.

import Object_ from '../object/model.js';
import Issue from '../issue/model.js';

// ── GET /api/markers/objects ──────────────────────────────────────────────────
// Query: ?objectType=school&regionCode=17&swLat=&swLng=&neLat=&neLng=
// Returns: id, lat, lng, name, objectType, sourceApi
export const getObjectMarkers = async (req, res) => {
    const { objectType, sourceApi, regionCode, precision, swLat, swLng, neLat, neLng } = req.query;

    const filter = {};
    if (objectType) filter.objectType = objectType;
    if (sourceApi) filter.sourceApi = sourceApi;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    // A point is drawn only where a real coordinate exists. Since the centroid
    // jitter was removed from import-objects.js most records legitimately carry
    // lat = null, and returning those put markers at [null, null]. Default is
    // exact only; ?precision=any also returns approximate positions for callers
    // that render them differently.
    filter.coordPrecision = precision === 'any' ? { $in: ['exact', 'approximate'] } : 'exact';

    // Bbox filter - takes priority over regionCode when provided
    if (swLat && swLng && neLat && neLng) {
        filter.lat = { $gte: parseFloat(swLat), $lte: parseFloat(neLat) };
        filter.lng = { $gte: parseFloat(swLng), $lte: parseFloat(neLng) };
    }

    // Payload cap. Today the collection holds 2198 objects and only a few hundred
    // carry an exact coordinate, so nothing is cut. After the coords bootstrap stage
    // runs for real and the school registry lands, a country-wide viewport would
    // ask for tens of thousands of points in one response, and the browser spends
    // longer building markers than the request spends in flight. The cap is
    // reported back so the client can say the view is partial instead of quietly
    // showing a subset.
    const MAX_MARKERS = 4000;
    const requested = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requested) && requested > 0
        ? Math.min(requested, MAX_MARKERS)
        : MAX_MARKERS;

    const [docs, total] = await Promise.all([
        Object_.find(filter)
            .select('lat lng name objectType sourceApi coordPrecision coordSource coordShared details.sigimi details.umumiyUquvchi')
            .limit(limit)
            .lean(),
        Object_.countDocuments(filter)
    ]);

    res.json({
        success: true,
        count: docs.length,
        total,
        truncated: total > docs.length,
        data: docs.map(d => ({
            id: d._id.toString(),
            lat: d.lat,
            lng: d.lng,
            name: d.name,
            objectType: d.objectType,
            sourceApi: d.sourceApi,
            // coordShared marks a point copied across several facilities in the
            // source registry: valid as a coordinate, unverified as a position.
            coordPrecision: d.coordPrecision ?? 'none',
            coordSource: d.coordSource ?? 'none',
            coordShared: !!d.coordShared,
            capacity: d.details?.sigimi ?? null,
            enrollment: d.details?.umumiyUquvchi ?? null,
        }))
    });
};

// ── GET /api/markers/issues ───────────────────────────────────────────────────
// Query: ?category=&status=&severity=&regionCode=&swLat=&swLng=&neLat=&neLng=
// Returns: id, lat, lng, title, category, severity, status, votes, objectId
export const getIssueMarkers = async (req, res) => {
    const { category, status, severity, regionCode, swLat, swLng, neLat, neLng } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    // Bbox filter - takes priority over regionCode when provided
    if (swLat && swLng && neLat && neLng) {
        filter.lat = { $gte: parseFloat(swLat), $lte: parseFloat(neLat) };
        filter.lng = { $gte: parseFloat(swLng), $lte: parseFloat(neLng) };
    }

    const docs = await Issue.find(filter)
        .select('lat lng title category severity status votes objectId createdAt')
        .sort({ createdAt: -1 })
        .lean();

    res.json({
        success: true,
        count: docs.length,
        data: docs.map(d => ({
            id: d._id.toString(),
            lat: d.lat,
            lng: d.lng,
            title: d.title,
            category: d.category,
            severity: d.severity,
            status: d.status,
            votes: d.votes || 0,
            objectId: d.objectId || null,
            createdAt: d.createdAt
        }))
    });
};