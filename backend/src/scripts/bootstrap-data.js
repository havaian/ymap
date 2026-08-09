/**
 * backend/src/scripts/bootstrap-data.js
 *
 * The same population the server runs at startup, on demand.
 *
 * services/data-bootstrap.js does the work; this is only a way to trigger it
 * without restarting the container, and to force a reimport when the files have
 * not changed but the database needs rebuilding anyway.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/bootstrap-data.js
 *   docker compose exec backend node src/scripts/bootstrap-data.js --force
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { bootstrapData } from '../services/data-bootstrap.js';

async function main() {
    const force = process.argv.slice(2).includes('--force');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI не задан'); process.exit(1); }

    await mongoose.connect(mongoUri);
    try {
        await bootstrapData({ force });
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('❌', err.message); process.exit(1); });
}
