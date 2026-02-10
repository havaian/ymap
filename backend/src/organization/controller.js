import Organization from './model.js';

export const getOrganizations = async (req, res) => {
    const { type, region } = req.query;

    const filter = {};

    // Type filter
    if (type) {
        filter.type = type;
    }

    // Region filter
    if (region) {
        filter['region.name'] = region;
    }

    const organizations = await Organization.find(filter)
        .select('-__v -createdAt -updatedAt')  // Exclude unnecessary fields
        .lean();  // Return plain objects (faster)

    res.json({
        success: true,
        count: organizations.length,
        data: organizations.map(o => ({
            id: o._id.toString(),
            externalId: o.externalId,
            name: o.name,
            type: o.type,
            lat: o.lat,
            lng: o.lng,
            address: o.address,
            region: o.region,
            year: o.year,
            sector: o.sector,
            status: o.status
        }))
    });
};

export const getOrganization = async (req, res) => {
    const { id } = req.params;

    const organization = await Organization.findById(id).lean();

    if (!organization) {
        return res.status(404).json({
            success: false,
            message: 'Organization not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: organization._id.toString(),
            ...organization,
            _id: undefined,
            __v: undefined
        }
    });
};

export const getNearbyOrganizations = async (req, res) => {
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

    const organizations = await Organization.find(filter)
        .limit(50)
        .select('-__v -createdAt -updatedAt')
        .lean();

    res.json({
        success: true,
        count: organizations.length,
        data: organizations.map(o => ({
            id: o._id.toString(),
            ...o,
            _id: undefined
        }))
    });
};