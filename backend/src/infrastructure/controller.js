import Infrastructure from './model.js';

export const getInfrastructure = async (req, res) => {
    try {
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

        const infrastructure = await Infrastructure.find(filter)
            .select('-__v -createdAt -updatedAt')
            .lean();

        res.json({
            success: true,
            count: infrastructure.length,
            data: infrastructure.map(i => ({
                id: i._id.toString(),
                externalId: i.externalId,
                projectId: i.projectId,
                objectId: i.objectId,
                name: i.name,
                type: i.type,
                objectType: i.objectType,
                lat: i.lat,
                lng: i.lng,
                address: i.address,
                region: i.region,
                year: i.year,
                sector: i.sector,
                sourceType: i.sourceType,
                sourceName: i.sourceName,
                status: i.status,
                budget: i.budget
            }))
        });
    } catch (error) {
        console.error('Error fetching infrastructure:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching infrastructure',
            error: error.message
        });
    }
};

export const getInfrastructureById = async (req, res) => {
    try {
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
                externalId: infrastructure.externalId,
                projectId: infrastructure.projectId,
                objectId: infrastructure.objectId,
                name: infrastructure.name,
                type: infrastructure.type,
                objectType: infrastructure.objectType,
                lat: infrastructure.lat,
                lng: infrastructure.lng,
                address: infrastructure.address,
                region: infrastructure.region,
                year: infrastructure.year,
                sector: infrastructure.sector,
                sourceType: infrastructure.sourceType,
                sourceName: infrastructure.sourceName,
                status: infrastructure.status,
                budget: infrastructure.budget
            }
        });
    } catch (error) {
        console.error('Error fetching infrastructure by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching infrastructure',
            error: error.message
        });
    }
};

export const getNearbyInfrastructure = async (req, res) => {
    try {
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
                externalId: i.externalId,
                projectId: i.projectId,
                objectId: i.objectId,
                name: i.name,
                type: i.type,
                objectType: i.objectType,
                lat: i.lat,
                lng: i.lng,
                address: i.address,
                region: i.region,
                year: i.year,
                sector: i.sector,
                sourceType: i.sourceType,
                sourceName: i.sourceName,
                status: i.status,
                budget: i.budget
            }))
        });
    } catch (error) {
        console.error('Error fetching nearby infrastructure:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching nearby infrastructure',
            error: error.message
        });
    }
};