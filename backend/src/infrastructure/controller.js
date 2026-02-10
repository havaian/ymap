import Infrastructure from './model.js';

export const getInfrastructure = async (req, res) => {
    const { type, region, bounds } = req.query;

    const filter = {};

    // Type filter
    if (type) {
        filter.type = type;
    }

    // Region filter
    if (region) {
        filter['region.name'] = region;
    }

    // CRITICAL: Viewport bounds filter for map performance
    // Format: bounds=minLng,minLat,maxLng,maxLat
    if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(parseFloat);

        if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
            filter.location = {
                $geoWithin: {
                    $box: [
                        [minLng, minLat],  // Southwest corner
                        [maxLng, maxLat]   // Northeast corner
                    ]
                }
            };
        }
    }

    const limit = parseInt(req.query.limit) || 5000;

    const infrastructure = await Infrastructure.find(filter)
        .limit(Math.min(limit, 10000))
        .select('-__v -createdAt -updatedAt')
        .lean();

    res.json({
        success: true,
        count: infrastructure.length,
        data: infrastructure.map(i => ({
            id: i._id.toString(),
            externalId: i.externalId,
            name: i.name,
            type: i.type,
            lat: i.lat,
            lng: i.lng,
            address: i.address,
            region: i.region,
            year: i.year,
            sector: i.sector,
            status: i.status
        }))
    });
};

export const getInfrastructureItem = async (req, res) => {
    const { id } = req.params;

    const infrastructure = await Infrastructure.findById(id).lean();

    if (!infrastructure) {
        return res.status(404).json({
            success: false,
            message: 'Infrastructure not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: infrastructure._id.toString(),
            ...infrastructure,
            _id: undefined,
            __v: undefined
        }
    });
};

export const getNearbyInfrastructure = async (req, res) => {
    const { lat, lng, maxDistance = 5000, type } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({
            success: false,
            message: 'Latitude and longitude required'
        });
    }

    const filter = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: parseInt(maxDistance)
            }
        }
    };

    if (type) {
        filter.type = type;
    }

    const infrastructure = await Infrastructure.find(filter)
        .limit(50)
        .select('-__v -createdAt -updatedAt')
        .lean();

    res.json({
        success: true,
        count: infrastructure.length,
        data: infrastructure.map(i => ({
            id: i._id.toString(),
            ...i,
            _id: undefined
        }))
    });
};