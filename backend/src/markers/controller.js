/**
 * Markers Controller
 * 
 * Ultra-lightweight endpoints that return ONLY the fields needed for map markers.
 * Full details are fetched on demand when a user clicks a marker.
 * 
 * Payload comparison (15K orgs):
 *   Old getOrganizations: ~3,900 KB (all fields)
 *   New getOrgMarkers:    ~450 KB raw → ~80 KB gzipped
 */

import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import Issue from '../issue/model.js';

// ─────────────────────────────────────────────
// GET /api/markers/organizations
// Query: ?type=Schools+%26+Kindergartens&regionCode=17
// Returns: id, lat, lng, name, type
// ─────────────────────────────────────────────

export const getOrgMarkers = async (req, res) => {
    const { type, regionCode } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    const docs = await Organization.find(filter)
        .select('lat lng name type')
        .lean();

    // Flat array format for minimal JSON overhead
    res.json({
        success: true,
        count: docs.length,
        data: docs.map(d => ({
            id: d._id.toString(),
            lat: d.lat,
            lng: d.lng,
            name: d.name,
            type: d.type
        }))
    });
};

// ─────────────────────────────────────────────
// GET /api/markers/infrastructure
// Query: ?type=Roads&regionCode=17
// Returns: id, lat, lng, name, type
// ─────────────────────────────────────────────

export const getInfraMarkers = async (req, res) => {
    const { type, regionCode } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    const docs = await Infrastructure.find(filter)
        .select('lat lng name type')
        .lean();

    res.json({
        success: true,
        count: docs.length,
        data: docs.map(d => ({
            id: d._id.toString(),
            lat: d.lat,
            lng: d.lng,
            name: d.name,
            type: d.type
        }))
    });
};

// ─────────────────────────────────────────────
// GET /api/markers/issues
// Query: ?category=Roads&status=Open&severity=High&regionCode=17
// Returns: id, lat, lng, title, category, severity, status, votes, organizationId
// ─────────────────────────────────────────────

export const getIssueMarkers = async (req, res) => {
    const { category, status, severity, regionCode } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (regionCode) filter.regionCode = parseInt(regionCode);

    const docs = await Issue.find(filter)
        .select('lat lng title category severity status votes organizationId infrastructureId createdAt')
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
            organizationId: d.organizationId || null,
            infrastructureId: d.infrastructureId || null,
            createdAt: d.createdAt
        }))
    });
};