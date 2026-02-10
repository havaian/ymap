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

    const orgBulkOps = [];
    const infraBulkOps = [];
    const userBulkOps = [];
    let skipped = 0;

    // Step 1: Transform all data into bulk operations
    console.log('📦 Preparing bulk operations...');
    for (const row of dataRows) {
        try {
            const latitude = parseFloat(row.lat || row.latitude || row.Latitude);
            const longitude = parseFloat(row.lon || row.lng || row.longitude || row.Longitude);

            if (isNaN(latitude) || isNaN(longitude)) {
                skipped++;
                continue;
            }

            const sector = (row.sector || row.Sector || '').toLowerCase().trim();
            const collectionType = SECTOR_TO_COLLECTION_MAP[sector];

            if (!collectionType) {
                skipped++;
                continue;
            }

            if (collectionType === 'organization') {
                const orgData = transformExcelRowToOrganization(row, latitude, longitude);
                orgBulkOps.push({
                    updateOne: {
                        filter: { externalId: orgData.externalId },
                        update: { $set: orgData },
                        upsert: true
                    }
                });
            } else if (collectionType === 'infrastructure') {
                const infraData = transformExcelRowToInfrastructure(row, latitude, longitude);
                infraBulkOps.push({
                    updateOne: {
                        filter: { externalId: infraData.externalId },
                        update: { $set: infraData },
                        upsert: true
                    }
                });
            }
        } catch (error) {
            console.error(`Error transforming row:`, error.message);
            skipped++;
        }
    }

    console.log(`📊 Prepared: ${orgBulkOps.length} orgs, ${infraBulkOps.length} infrastructure, ${skipped} skipped`);

    // Step 2: Bulk insert organizations (FAST!)
    let organizationsImported = 0;
    if (orgBulkOps.length > 0) {
        console.log('⚡ Bulk inserting organizations...');
        const orgResult = await Organization.bulkWrite(orgBulkOps, { ordered: false });
        organizationsImported = orgResult.upsertedCount + orgResult.modifiedCount;
        console.log(`✅ Organizations: ${organizationsImported} created/updated`);
    }

    // Step 3: Bulk insert infrastructure (FAST!)
    let infrastructureImported = 0;
    if (infraBulkOps.length > 0) {
        console.log('⚡ Bulk inserting infrastructure...');
        const infraResult = await Infrastructure.bulkWrite(infraBulkOps, { ordered: false });
        infrastructureImported = infraResult.upsertedCount + infraResult.modifiedCount;
        console.log(`✅ Infrastructure: ${infrastructureImported} created/updated`);
    }

    // Step 4: Create organization users (need individual ops for password hashing)
    console.log('👥 Creating organization users...');
    let usersCreated = 0;
    const credentials = [];
    
    // Get all organizations to create users for them
    const organizations = await Organization.find({}).lean();
    
    for (const org of organizations) {
        try {
            const userResult = await createOrganizationUser(org, org._id.toString());
            if (userResult.isNew) {
                usersCreated++;
                if (credentials.length < 100) {
                    credentials.push({
                        organizationId: org._id.toString(),
                        organizationName: org.name,
                        email: userResult.email,
                        password: userResult.password
                    });
                }
            }
        } catch (error) {
            // User might already exist, that's ok
        }
    }

    console.log(`✅ Import complete: ${organizationsImported} organizations, ${infrastructureImported} infrastructure, ${usersCreated} users created, ${skipped} skipped`);

    return {
        total: dataRows.length,
        organizations: organizationsImported,
        infrastructure: infrastructureImported,
        usersCreated,
        skipped,
        credentials: credentials
    };
};