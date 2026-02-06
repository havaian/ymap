const SECTOR_TO_TYPE_MAP = {
    'maktab': 'Schools & Kindergartens',
    'ssv': 'Hospitals & Clinics',
    'road': 'Roads',
    'suv': 'Water & Sewage'
};

export const transformExcelRowToOrganization = (row, latitude, longitude) => {
    const sector = (row.sector || row.Sector || '').toLowerCase();
    const type = SECTOR_TO_TYPE_MAP[sector];

    return {
        externalId: row.external_id || row.id,
        projectId: row.project_id,
        objectId: row.object_id,
        name: row.name || row.Name || row.project_name || 'Unknown',
        type,
        objectType: row.object_type,
        lat: latitude,
        lng: longitude,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        address: row.address || row.Address || '',
        region: {
            id: row.region_id,
            name: row.region || row.Region
        },
        year: row.year,
        sector: row.sector,
        sourceType: row.source_type,
        sourceName: row.source_name,
        status: row.status || row.Status,
        budget: {
            committedUZS: parseFloat(row.commitmented_UZS) || 0,
            spentUZS: parseFloat(row.spented_UZS) || 0,
            committedUSD: parseFloat(row.commitmented_USD) || 0,
            spentUSD: parseFloat(row.spented_USD) || 0
        }
    };
};

export const transformExcelRowToInfrastructure = (row, latitude, longitude) => {
    const sector = (row.sector || row.Sector || '').toLowerCase();
    const type = SECTOR_TO_TYPE_MAP[sector];

    return {
        externalId: row.external_id || row.id,
        projectId: row.project_id,
        objectId: row.object_id,
        name: row.name || row.Name || row.project_name || 'Unknown',
        type,
        objectType: row.object_type,
        lat: latitude,
        lng: longitude,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        address: row.address || row.Address || '',
        region: {
            id: row.region_id,
            name: row.region || row.Region
        },
        year: row.year,
        sector: row.sector,
        sourceType: row.source_type,
        sourceName: row.source_name,
        status: row.status || row.Status,
        budget: {
            committedUZS: parseFloat(row.commitmented_UZS) || 0,
            spentUZS: parseFloat(row.spented_UZS) || 0,
            committedUSD: parseFloat(row.commitmented_USD) || 0,
            spentUSD: parseFloat(row.spented_USD) || 0
        }
    };
};