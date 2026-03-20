// backend/src/markers/controller.js
//
// Ultra-lightweight endpoints that return ONLY the fields needed for map markers.
// Full details are fetched on demand when a user clicks a marker.

import Object_ from '../object/model.js';
import Issue from '../issue/model.js';

// ── GET /api/markers/objects ──────────────────────────────────────────────────
// Query: ?objectType=school&regionCode=17
// Returns: id, lat, lng, name, objectType, sourceApi
export const getObjectMarkers = async (req, res) => {
    const { objectType, sourceApi, regionCode } = req.query;

    const filter = {};
    if (objectType) filter.objectType = objectType;
    if (sourceApi) filter.sourceApi = sourceApi;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    const docs = await Object_.find(filter)
        .select('lat lng name objectType sourceApi details.sigimi details.umumiyUquvchi')
        .lean();

    res.json({
        success: true,
        count: docs.length,
        data: docs.map(d => ({
            id: d._id.toString(),
            lat: d.lat,
            lng: d.lng,
            name: d.name,
            objectType: d.objectType,
            sourceApi: d.sourceApi,
            capacity: d.details?.sigimi ?? null,
            enrollment: d.details?.umumiyUquvchi ?? null,
        }))
    });
};

// ── GET /api/markers/issues ───────────────────────────────────────────────────
// Query: ?category=&status=&severity=&regionCode=
// Returns: id, lat, lng, title, category, severity, status, votes, objectId
export const getIssueMarkers = async (req, res) => {
    const { category, status, severity, regionCode } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (regionCode) filter.regionCode = parseInt(regionCode);

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