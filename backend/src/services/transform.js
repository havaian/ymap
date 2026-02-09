// ============================================
// FIX 4: backend/src/services/transform.js
// ============================================
// REPLACE THE ENTIRE FILE with this code:

// Updated mapping for Uzbek sector names to English types
const SECTOR_TO_TYPE_MAP = {
    "ta'lim": 'Schools & Kindergartens',  // Education
    "sog'liq": 'Hospitals & Clinics',     // Healthcare
    "yo'l": 'Roads',                      // Roads
    'suv': 'Water & Sewage'               // Water
};

export const transformExcelRowToOrganization = (row, latitude, longitude) => {
    const sector = (row.sector || row.Sector || '').toLowerCase().trim();
    const type = SECTOR_TO_TYPE_MAP[sector];

    return {
        externalId: row._uid_ || row.external_id || row.id,  // Excel uses _uid_
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
            name: row.region_name_uz || row.region || row.Region  // Excel uses region_name_uz
        },
        year: row.year,
        sector: row.sector,
        sourceType: row.source_type,
        sourceName: row.source_name,
        status: row.status || row.Status,
        budget: {
            // Excel uses lowercase: committed_uzs, spent_uzs, committed_usd, spent_usd
            committedUZS: parseFloat(row.committed_uzs || row.commitmented_UZS) || 0,
            spentUZS: parseFloat(row.spent_uzs || row.spented_UZS) || 0,
            committedUSD: parseFloat(row.committed_usd || row.commitmented_USD) || 0,
            spentUSD: parseFloat(row.spent_usd || row.spented_USD) || 0
        }
    };
};

export const transformExcelRowToInfrastructure = (row, latitude, longitude) => {
    const sector = (row.sector || row.Sector || '').toLowerCase().trim();
    const type = SECTOR_TO_TYPE_MAP[sector];

    return {
        externalId: row._uid_ || row.external_id || row.id,  // Excel uses _uid_
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
            name: row.region_name_uz || row.region || row.Region  // Excel uses region_name_uz
        },
        year: row.year,
        sector: row.sector,
        sourceType: row.source_type,
        sourceName: row.source_name,
        status: row.status || row.Status,
        budget: {
            // Excel uses lowercase: committed_uzs, spent_uzs, committed_usd, spent_usd
            committedUZS: parseFloat(row.committed_uzs || row.commitmented_UZS) || 0,
            spentUZS: parseFloat(row.spent_uzs || row.spented_UZS) || 0,
            committedUSD: parseFloat(row.committed_usd || row.commitmented_USD) || 0,
            spentUSD: parseFloat(row.spent_usd || row.spented_USD) || 0
        }
    };
};