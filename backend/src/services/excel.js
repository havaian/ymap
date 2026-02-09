import xlsx from 'xlsx';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import { transformExcelRowToOrganization, transformExcelRowToInfrastructure } from './transform.js';
import { createOrganizationUser } from './org-user-generator.js';

const SECTOR_TO_COLLECTION_MAP = {
    "ta'lim": 'organization',
    "sog'liq": 'organization',
    "yo'l": 'infrastructure',
    'suv': 'infrastructure'
};

export const importOrganizationsFromExcel = async (filePath) => {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null
    });

    const headers = rows[1];
    const dataRows = rows.slice(2).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });

    console.log(`📊 Importing ${dataRows.length} objects from Excel...`);
    console.log(`📋 Headers: ${headers.join(', ')}`);

    let organizationsImported = 0;
    let infrastructureImported = 0;
    let usersCreated = 0;
    let skipped = 0;
    const errors = [];
    const credentials = [];

    let processedCount = 0;
    const totalRows = dataRows.length;

    for (const row of dataRows) {
        processedCount++;

        // Progress logging every 1000 rows
        if (processedCount % 1000 === 0) {
            console.log(`⏳ Progress: ${processedCount}/${totalRows} (${Math.round(processedCount / totalRows * 100)}%)`);
            console.log(`   ✅ Orgs: ${organizationsImported}, Infrastructure: ${infrastructureImported}, Skipped: ${skipped}`);
        }

        try {
            const latitude = parseFloat(row.lat || row.latitude || row.Latitude);
            const longitude = parseFloat(row.lon || row.lng || row.longitude || row.Longitude);

            if (isNaN(latitude) || isNaN(longitude)) {
                skipped++;
                if (skipped <= 5) {
                    console.log(`⚠️  Row ${processedCount}: Missing coordinates (lat: ${row.lat}, lon: ${row.lon})`);
                }
                continue;
            }

            const sector = (row.sector || row.Sector || '').toLowerCase().trim();
            const collectionType = SECTOR_TO_COLLECTION_MAP[sector];

            if (!collectionType) {
                skipped++;
                if (skipped <= 5) {
                    console.log(`⚠️  Row ${processedCount}: Unknown sector '${sector}'`);
                }
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
                    console.error(`❌ User creation failed for org ${orgData.name}:`, userError.message);
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
            errors.push({ row: processedCount, error: error.message, stack: error.stack });
            skipped++;

            // Log first 10 errors in detail
            if (errors.length <= 10) {
                console.error(`❌ ERROR at row ${processedCount}:`, error.message);
                console.error(`   Data sample:`, {
                    name: row.name,
                    sector: row.sector,
                    lat: row.lat,
                    lon: row.lon
                });
            }
        }
    }

    console.log(`✅ Import complete: ${organizationsImported} organizations, ${infrastructureImported} infrastructure, ${usersCreated} users created, ${skipped} skipped`);

    if (errors.length > 0) {
        console.error(`⚠️  Total errors: ${errors.length}`);
        console.error(`First 5 errors:`, errors.slice(0, 5));
    }

    return {
        total: dataRows.length,
        organizations: organizationsImported,
        infrastructure: infrastructureImported,
        usersCreated,
        skipped,
        errors: errors.slice(0, 10),
        credentials: credentials.slice(0, 100)
    };
};