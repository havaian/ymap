// backend/src/services/excel.js

import xlsx from 'xlsx';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import { transformExcelRowToOrganization, transformExcelRowToInfrastructure } from './transform.js';

const SECTOR_TO_COLLECTION_MAP = {
    "ta'lim": 'organization',
    "sog'liq": 'organization',
    "yo'l": 'infrastructure',
    'suv': 'infrastructure'
};

const BATCH_SIZE = 1000;

// onProgress(phase, currentBatch, totalBatches)
// phase: 'preparing' | 'orgs' | 'infrastructure'
export const importOrganizationsFromExcel = async (filePath, onProgress = () => {}) => {
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
    onProgress('preparing', 0, dataRows.length);

    const orgBulkOps = [];
    const infraBulkOps = [];
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

    // Step 2: Bulk insert organizations in batches
    let organizationsImported = 0;
    if (orgBulkOps.length > 0) {
        const totalBatches = Math.ceil(orgBulkOps.length / BATCH_SIZE);
        console.log(`⚡ Bulk inserting organizations in batches of ${BATCH_SIZE}...`);
        onProgress('orgs', 0, totalBatches);

        for (let i = 0; i < orgBulkOps.length; i += BATCH_SIZE) {
            const batch = orgBulkOps.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
            onProgress('orgs', batchNum, totalBatches);

            try {
                const orgResult = await Organization.bulkWrite(batch, { ordered: false });
                organizationsImported += orgResult.upsertedCount + orgResult.modifiedCount;
            } catch (error) {
                console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
            }
        }

        console.log(`✅ Organizations: ${organizationsImported} created/updated`);
    }

    // Step 3: Bulk insert infrastructure in batches
    let infrastructureImported = 0;
    if (infraBulkOps.length > 0) {
        const totalBatches = Math.ceil(infraBulkOps.length / BATCH_SIZE);
        console.log(`⚡ Bulk inserting infrastructure in batches of ${BATCH_SIZE}...`);
        onProgress('infrastructure', 0, totalBatches);

        for (let i = 0; i < infraBulkOps.length; i += BATCH_SIZE) {
            const batch = infraBulkOps.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
            onProgress('infrastructure', batchNum, totalBatches);

            try {
                const infraResult = await Infrastructure.bulkWrite(batch, { ordered: false });
                infrastructureImported += infraResult.upsertedCount + infraResult.modifiedCount;
            } catch (error) {
                console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
            }
        }

        console.log(`✅ Infrastructure: ${infrastructureImported} created/updated`);
    }

    console.log(`✅ Import complete: ${organizationsImported} organizations, ${infrastructureImported} infrastructure, ${skipped} skipped`);

    return {
        total: dataRows.length,
        organizations: organizationsImported,
        infrastructure: infrastructureImported,
        skipped
    };
};