import xlsx from 'xlsx';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import { transformExcelRowToOrganization, transformExcelRowToInfrastructure } from './transform.js';

const SECTOR_TO_COLLECTION_MAP = {
    'maktab': 'organization', // Schools
    'ssv': 'organization',    // Hospitals
    'road': 'infrastructure', // Roads
    'suv': 'infrastructure'   // Water
};

export const importOrganizationsFromExcel = async (filePath) => {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    console.log(`📊 Importing ${rows.length} objects from Excel...`);

    let organizationsImported = 0;
    let infrastructureImported = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
        try {
            const latitude = parseFloat(row.latitude || row.lat || row.Latitude);
            const longitude = parseFloat(row.longitude || row.lng || row.lon || row.Longitude);

            if (isNaN(latitude) || isNaN(longitude)) {
                skipped++;
                continue;
            }

            const sector = (row.sector || row.Sector || '').toLowerCase();
            const collectionType = SECTOR_TO_COLLECTION_MAP[sector];

            if (!collectionType) {
                skipped++;
                continue;
            }

            if (collectionType === 'organization') {
                const orgData = transformExcelRowToOrganization(row, latitude, longitude);
                await Organization.updateOne(
                    { externalId: orgData.externalId },
                    orgData,
                    { upsert: true }
                );
                organizationsImported++;
            } else if (collectionType === 'infrastructure') {
                const infraData = transformExcelRowToInfrastructure(row, latitude, longitude);
                await Infrastructure.updateOne(
                    { externalId: infraData.externalId },
                    infraData,
                    { upsert: true }
                );
                infrastructureImported++;
            }

        } catch (error) {
            errors.push({ row, error: error.message });
            skipped++;
        }
    }

    console.log(`✅ Import complete: ${organizationsImported} organizations, ${infrastructureImported} infrastructure, ${skipped} skipped`);

    return {
        total: rows.length,
        organizations: organizationsImported,
        infrastructure: infrastructureImported,
        skipped,
        errors: errors.slice(0, 10)
    };
};