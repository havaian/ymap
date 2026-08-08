/**
 * backend/src/scripts/take-snapshot.js
 *
 * Puts a registry payload into the archive: gzips the raw bytes into
 * data/snapshots/<source>/, records a manifest row, and refuses to store a
 * payload identical to the one already at the head of that source's timeline.
 *
 * Fetching is not this script's job. It takes a file that is already on disk,
 * which means the archive can start today from the three seed files in data/ and
 * does not wait on the duasr.uz pagination work. Once a harvester exists it writes
 * a file and calls this the same way.
 *
 * On the capture date. The three seed files were placed by hand and their real
 * fetch date is not recorded anywhere. The script uses the file's modification
 * time and marks provenance as manual_upload, so nothing downstream can mistake it
 * for a harvested timestamp. Pass --as-of when the actual date is known.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/take-snapshot.js --source=all --dry-run
 *   docker compose exec backend node src/scripts/take-snapshot.js --source=all
 *   docker compose exec backend node src/scripts/take-snapshot.js --source=maktab44 --from=/tmp/maktab44.json --as-of=2026-08-08
 *
 * Options:
 *   --source=ssv|bogcha|maktab44|all   default all
 *   --from=<path>                      default data/<source>.json
 *   --as-of=YYYY-MM-DD                 capture date, default the file's mtime
 *   --provenance=harvester             default manual_upload
 *   --note="..."                       free text kept on the manifest row
 *   --force                            store even if the digest already exists
 *   --dry-run                          report without writing anything
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Snapshot } from '../snapshot/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

const SOURCES = ['ssv', 'bogcha', 'maktab44'];

function arg(name) {
    const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
}

function has(name) {
    return process.argv.slice(2).includes(`--${name}`);
}

/**
 * Rows out of a source payload. The three registries answer with a bare array
 * today; the wrapped shapes are accepted so a harvester that keeps the envelope
 * does not need a separate path.
 */
function rowsOf(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ['data', 'result', 'items', 'rows']) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return null;
}

async function capture(source, { dryRun, force, asOf, provenance, note, fromPath }) {
    const src = fromPath || path.join(DATA_DIR, `${source}.json`);
    if (!fs.existsSync(src)) {
        console.warn(`  ${source}: ${src} не найден, пропуск`);
        return { skipped: true };
    }

    const raw = fs.readFileSync(src);
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

    let rows;
    try {
        rows = rowsOf(JSON.parse(raw.toString('utf-8')));
    } catch (err) {
        console.error(`  ${source}: не разбирается как JSON - ${err.message}`);
        return { skipped: true };
    }
    if (!rows) {
        console.error(`  ${source}: в payload не найден массив записей`);
        return { skipped: true };
    }

    const stat = fs.statSync(src);
    const takenAt = asOf ? new Date(asOf + 'T00:00:00Z') : stat.mtime;
    if (isNaN(takenAt.getTime())) {
        console.error(`  ${source}: --as-of не разбирается как дата`);
        return { skipped: true };
    }

    const existing = await Snapshot.findOne({ sourceApi: source, sha256 }).lean();
    const head = await Snapshot.findOne({ sourceApi: source }).sort({ takenAt: -1 }).lean();

    console.log(`  ${source}: ${rows.length} записей, sha256 ${sha256.slice(0, 12)}, дата ${takenAt.toISOString().slice(0, 10)}`);
    if (head) {
        console.log(`    в архиве уже: ${head.recordCount} записей от ${new Date(head.takenAt).toISOString().slice(0, 10)}`);
    } else {
        console.log('    первый снимок этого источника');
    }

    if (existing && !force) {
        // Identical bytes are not a new state of the register. Storing them would
        // put a zero-change step into the timeline and make every rate computed
        // over snapshot counts wrong.
        console.log('    payload совпадает с уже сохранённым, пропуск (--force чтобы записать)');
        return { skipped: true, duplicate: true };
    }

    const stamp = takenAt.toISOString().replace(/[:.]/g, '-');
    const rel = path.join('snapshots', source, `${stamp}.json.gz`);
    const dest = path.join(DATA_DIR, rel);

    if (dryRun) {
        console.log(`    dry run - записали бы ${rel}`);
        return { skipped: false, dryRun: true };
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const gz = zlib.gzipSync(raw, { level: 9 });
    fs.writeFileSync(dest, gz);

    await Snapshot.create({
        sourceApi: source,
        takenAt,
        provenance: provenance || 'manual_upload',
        file: rel,
        recordCount: rows.length,
        sha256,
        bytesRaw: raw.length,
        bytesStored: gz.length,
        note: note || null
    });

    console.log(`    записано: ${rel} (${(gz.length / 1024).toFixed(0)} КБ из ${(raw.length / 1024).toFixed(0)} КБ)`);
    return { skipped: false };
}

async function main() {
    const dryRun = has('dry-run');
    const force = has('force');
    const which = arg('source') || 'all';
    const sources = which === 'all' ? SOURCES : [which];
    const fromPath = arg('from');

    if (sources.some(s => !SOURCES.includes(s))) {
        console.error(`--source должен быть одним из: ${SOURCES.join(', ')}, all`);
        process.exit(1);
    }
    if (fromPath && sources.length > 1) {
        console.error('--from можно использовать только с одним --source');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════');
    console.log('  Снимок реестра в архив');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - без записи');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI не задан'); process.exit(1); }

    await mongoose.connect(mongoUri);

    try {
        const opts = {
            dryRun,
            force,
            asOf: arg('as-of'),
            provenance: arg('provenance'),
            note: arg('note'),
            fromPath
        };
        let stored = 0;
        for (const s of sources) {
            const r = await capture(s, opts);
            if (!r.skipped && !r.dryRun) stored++;
        }

        console.log(`\n  сохранено снимков: ${stored}`);
        console.log('  Дальше: node src/scripts/diff-snapshots.js --source=<источник>');
        console.log('  Второй снимок того же источника имеет смысл снимать не раньше, чем реестр обновится.');
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
}

export { rowsOf };
