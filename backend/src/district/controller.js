import District from './model.js';

// GET /api/districts
export const getDistricts = async (req, res) => {
    const { regionCode, includeGeometry } = req.query;

    const filter = {};
    if (regionCode) {
        filter.regionCode = parseInt(regionCode);
    }

    const projection = includeGeometry === 'true'
        ? '-__v'
        : '-__v -geometry';

    const districts = await District.find(filter)
        .select(projection)
        .sort({ regionCode: 1, 'name.en': 1 })
        .lean();

    res.json({
        success: true,
        count: districts.length,
        data: districts.map(d => ({
            id: d._id.toString(),
            regionCode: d.regionCode,
            name: d.name,
            shapeID: d.shapeID,
            centroid: d.centroid,
            areaKm2: d.areaKm2,
            ...(includeGeometry === 'true' && { geometry: d.geometry })
        }))
    });
};

// GET /api/districts/:id
export const getDistrictById = async (req, res) => {
    const { id } = req.params;

    const district = await District.findById(id).lean();

    if (!district) {
        return res.status(404).json({
            success: false,
            message: 'District not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: district._id.toString(),
            regionCode: district.regionCode,
            name: district.name,
            shapeID: district.shapeID,
            geometry: district.geometry,
            centroid: district.centroid,
            areaKm2: district.areaKm2
        }
    });
};

// GET /api/districts/geojson — GeoJSON FeatureCollection, optionally filtered by regionCode
export const getDistrictsGeoJSON = async (req, res) => {
    const { regionCode } = req.query;

    const filter = {};
    if (regionCode) {
        filter.regionCode = parseInt(regionCode);
    }

    const districts = await District.find(filter).lean();

    const featureCollection = {
        type: 'FeatureCollection',
        features: districts.map(d => ({
            type: 'Feature',
            properties: {
                id: d._id.toString(),
                regionCode: d.regionCode,
                name: d.name,
                shapeID: d.shapeID,
                areaKm2: d.areaKm2,
                centroid: d.centroid?.coordinates
            },
            geometry: d.geometry
        }))
    };

    res.json(featureCollection);
};

// GET /api/districts/lookup?lat=...&lng=... — find district containing a point
export const lookupDistrict = async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({
            success: false,
            message: 'lat and lng query params required'
        });
    }

    const point = {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
    };

    // Try exact polygon containment first
    let district = await District.findOne({
        geometry: { $geoIntersects: { $geometry: point } }
    }).lean();

    // Fallback: nearest centroid if point is outside all polygons
    if (!district) {
        district = await District.findOne({
            centroid: {
                $near: {
                    $geometry: point,
                    $maxDistance: 50000 // 50km fallback radius
                }
            }
        }).lean();
    }

    if (!district) {
        return res.status(404).json({
            success: false,
            message: 'No district found for this location'
        });
    }

    res.json({
        success: true,
        data: {
            id: district._id.toString(),
            regionCode: district.regionCode,
            name: district.name,
            shapeID: district.shapeID,
            centroid: district.centroid,
            areaKm2: district.areaKm2
        }
    });
};