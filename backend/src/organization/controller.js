import Organization from './model.js';

export const getOrganizations = async (req, res) => {
    const { type, region } = req.query;

    const filter = {};

    if (type) {
        filter.type = type;
    }

    if (region) {
        filter['region.name'] = region;
    }

    const organizations = await Organization.find(filter);

    res.json({
        success: true,
        data: organizations.map(o => o.toJSON())
    });
};

export const getOrganization = async (req, res) => {
    const { id } = req.params;

    const organization = await Organization.findById(id);

    if (!organization) {
        return res.status(404).json({
            success: false,
            message: 'Organization not found'
        });
    }

    res.json({
        success: true,
        data: organization.toJSON()
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

    const organizations = await Organization.find(filter).limit(50);

    res.json({
        success: true,
        data: organizations.map(o => o.toJSON())
    });
};