/**
 * backend/src/scripts/sync-indexes.js
 *
 * Brings the indexes in MongoDB in line with what the Mongoose schemas declare:
 * creates the missing ones and drops the ones no longer present in the schema.
 *
 * Written because changing an index in a schema does not change it in the
 * database. Mongoose creates new indexes on model init but never removes old
 * ones, so a replaced unique key keeps rejecting inserts under the old rule.
 * Concretely: the Object model used to declare { inn, code, sourceApi } as unique.
 * That key cannot hold - inn repeats within a source (392 ssv records share 166
 * tax ids) and code is the district code shared by every object in that district.
 * It is now { sourceId, sourceApi }, and the old index has to go or the import
 * fails on duplicates.
 *
 * Uses MONGODB_URI from the environment, so no credentials have to be typed and
 * no direct mongosh access to the database host is needed.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/sync-indexes.js --dry-run
 *   docker compose exec backend node src/scripts/sync-indexes.js
 *
 * Options:
 *   --dry-run          Show the difference without touching anything
 *   --model=Object     Limit to one model (default: every model listed below)
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import Object_ from '../object/model.js';
import District from '../district/model.js';
import Region from '../region/model.js';

// Add models here as their indexes change. Keeping the list explicit avoids
// touching collections nobody asked about.
const MODELS = {
    Object: Object_,
    District,
    Region,
};

async function run({ dryRun = false, only = null } = {}) {
    const targets = only
        ? { [only]: MODELS[only] }
        : MODELS;

    if (only && !MODELS[only]) {
        throw new Error(`Unknown model: ${only}. Known: ${Object.keys(MODELS).join(', ')}`);
    }

    for (const [name, model] of Object.entries(targets)) {
        console.log(`\n── ${name} (${model.collection.collectionName})`);

        let existing = [];
        try {
            existing = await model.collection.indexes();
        } catch (err) {
            // A collection that does not exist yet has nothing to sync.
            console.log('   collection does not exist yet, nothing to drop');
        }

        if (existing.length > 0) {
            console.log('   current indexes:');
            for (const ix of existing) {
                const uniq = ix.unique ? ' UNIQUE' : '';
                const sparse = ix.sparse ? ' sparse' : '';
                console.log(`     ${ix.name}${uniq}${sparse}  ${JSON.stringify(ix.key)}`);
            }
        }

        // diffIndexes reports what syncIndexes would do, without doing it.
        const diff = await model.diffIndexes();
        const toDrop = diff.toDrop || [];
        const toCreate = diff.toCreate || [];

        if (toDrop.length === 0 && toCreate.length === 0) {
            console.log('   ✅ already in sync');
            continue;
        }

        if (toDrop.length > 0) console.log(`   ➖ to drop:   ${toDrop.join(', ')}`);
        if (toCreate.length > 0) console.log(`   ➕ to create: ${toCreate.map(k => JSON.stringify(k)).join(', ')}`);

        if (dryRun) {
            console.log('   🔍 dry run, nothing applied');
            continue;
        }

        const dropped = await model.syncIndexes();
        console.log(`   ✅ applied. Dropped: ${dropped.length ? dropped.join(', ') : 'none'}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const only = args.find(a => a.startsWith('--model='))?.split('=')[1] || null;

    console.log('═══════════════════════════════════════');
    console.log('  Index sync');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - nothing is applied');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    try {
        await run({ dryRun, only });
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err); process.exit(1); });
}