// ============================================
// FIX 3: backend/src/services/excel.js
// ============================================
// REPLACE THE ENTIRE FILE with this code:

import xlsx from 'xlsx';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import { transformExcelRowToOrganization, transformExcelRowToInfrastructure } from './transform.js';
import { createOrganizationUser } from './org-user-generator.js';

// Updated mapping for Uzbek sector names
const SECTOR_TO_COLLECTION_MAP = {
    "ta'lim": 'organization',  // Schools/Education (was 'maktab')
    "sog'liq": 'organization', // Hospitals/Healthcare (was 'ssv')
    "yo'l": 'infrastructure',  // Roads (was 'road')
    'suv': 'infrastructure'    // Water & Sewage (unchanged)
};

export const importOrganizationsFromExcel = async (filePath) => {
    // Read Excel file, skipping first row (disclaimer header)
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,      // Get raw array
        defval: null    // Use null for empty cells
    });

    // Skip first row (disclaimer) and second row becomes headers
    const headers = rows[1];
    const dataRows = rows.slice(2).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });

    console.log(`📊 Importing ${dataRows.length} objects from Excel...`);

    let organizationsImported = 0;
    let infrastructureImported = 0;
    let usersCreated = 0;
    let skipped = 0;
    const errors = [];
    const credentials = []; // Store generated credentials

    for (const row of dataRows) {
        try {
            // Use 'lat' and 'lon' columns (not 'latitude' and 'longitude')
            const latitude = parseFloat(row.lat || row.latitude || row.Latitude);
            const longitude = parseFloat(row.lon || row.lng || row.longitude || row.Longitude);

            if (isNaN(latitude) || isNaN(longitude)) {
                skipped++;
                continue;
            }

            // Get sector and normalize to lowercase
            const sector = (row.sector || row.Sector || '').toLowerCase().trim();
            const collectionType = SECTOR_TO_COLLECTION_MAP[sector];

            if (!collectionType) {
                skipped++;
                continue;
            }

            if (collectionType === 'organization') {
                const orgData = transformExcelRowToOrganization(row, latitude, longitude);

                const result = await Organization.findOneAndUpdate(
                    { externalId: orgData.externalId },
                    orgData,
                    { upsert: true, new: true }
                );

                organizationsImported++;

                // Create user account for this organization
                try {
                    const userResult = await createOrganizationUser(orgData, result._id.toString());
                    if (userResult.isNew) {
                        usersCreated++;
                        credentials.push({
                            organizationId: result._id.toString(),
                            organizationName: orgData.name,
                            email: userResult.email,
                            password: userResult.password
                        });
                    }
                } catch (userError) {
                    console.error(`Failed to create user for org ${orgData.name}:`, userError.message);
                }

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

    console.log(`✅ Import complete: ${organizationsImported} organizations, ${infrastructureImported} infrastructure, ${usersCreated} users created, ${skipped} skipped`);

    return {
        total: dataRows.length,
        organizations: organizationsImported,
        infrastructure: infrastructureImported,
        usersCreated,
        skipped,
        errors: errors.slice(0, 10),
        credentials: credentials.slice(0, 100) // Return first 100 credentials for reference
    };
};