import Region from './model.js';

// GET /api/regions
export const getRegions = async (req, res) => {
    const { includeGeometry } = req.query;

    // Both geometry copies are excluded by default. The dropdown on the map reads
    // only code and name, and shipping fourteen outlines to fill a <select> was
    // most of that response.
    const projection = includeGeometry === 'true'
        ? '-__v'
        : '-__v -geometry -geometrySimplified';

    const regions = await Region.find()
        .select(projection)
        .sort({ code: 1 })
        .lean();

    res.json({
        success: true,
        count: regions.length,
        data: regions.map(r => ({
            id: r._id.toString(),
            code: r.code,
            name: r.name,
            centroid: r.centroid,
            areaKm2: r.areaKm2,
            ...(includeGeometry === 'true' && {
                geometry: r.geometrySimplified?.coordinates ? r.geometrySimplified : r.geometry
            })
        }))
    });
};

// GET /api/regions/:code
//
// Feeds the outline MapCanvas draws around the selected region. That outline is
// read at a zoom where the whole viloyat fits on screen, so it is served from
// geometrySimplified when simplify-boundaries.js has been run. `?full=true`
// returns the source geometry for callers that measure rather than draw.
export const getRegionByCode = async (req, res) => {
    const { code } = req.params;
    const { full } = req.query;

    const region = await Region.findOne({ code: parseInt(code) }).lean();

    if (!region) {
        return res.status(404).json({
            success: false,
            message: 'Region not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: region._id.toString(),
            code: region.code,
            name: region.name,
            geometry: full === 'true' || !region.geometrySimplified?.coordinates
                ? region.geometry
                : region.geometrySimplified,
            // Says which copy was sent, so a caller that needs the source can ask
            // for it instead of assuming what it received.
            geometrySource: full === 'true' || !region.geometrySimplified?.coordinates
                ? 'source'
                : 'simplified',
            centroid: region.centroid,
            areaKm2: region.areaKm2
        }
    });
};

// GET /api/regions/geojson - full GeoJSON FeatureCollection for map rendering
// Same rule as the detail route: the render copy unless ?full=true asks otherwise.
export const getRegionsGeoJSON = async (req, res) => {
    const { full } = req.query;
    const regions = await Region.find().lean();

    const featureCollection = {
        type: 'FeatureCollection',
        features: regions.map(r => ({
            type: 'Feature',
            properties: {
                code: r.code,
                name: r.name,
                areaKm2: r.areaKm2,
                centroid: r.centroid?.coordinates
            },
            geometry: full === 'true' || !r.geometrySimplified?.coordinates
                ? r.geometry
                : r.geometrySimplified
        }))
    };

    res.json(featureCollection);
};