import Region from './model.js';

// GET /api/regions
export const getRegions = async (req, res) => {
    const { includeGeometry } = req.query;

    const projection = includeGeometry === 'true'
        ? '-__v'
        : '-__v -geometry';

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
            ...(includeGeometry === 'true' && { geometry: r.geometry })
        }))
    });
};

// GET /api/regions/:code
export const getRegionByCode = async (req, res) => {
    const { code } = req.params;

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
            geometry: region.geometry,
            centroid: region.centroid,
            areaKm2: region.areaKm2
        }
    });
};

// GET /api/regions/geojson — full GeoJSON FeatureCollection for map rendering
export const getRegionsGeoJSON = async (req, res) => {
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
            geometry: r.geometry
        }))
    };

    res.json(featureCollection);
};