/**
 * backend/src/scripts/diff-snapshots.js
 *
 * Compares two snapshots of one registry and writes what moved between them into
 * RegistryChange. This is the dividing line the whole project rests on: the
 * portals publish a state, the archive turns a sequence of states into transitions,
 * and transitions are what a condition model can actually be fitted to.
 *
 * What a change means here. A row that reports a partially repaired sports hall in
 * one snapshot and a satisfactory one in the next changed at some point inside that
 * window and the archive cannot say when. That is interval-censored data in the
 * exact form a multi-state model wants, and it is the reason the wear model version
 * 2 has a calendar and not a budget.
 *
 * Fields deliberately ignored:
 *   _uid_    row sequence number. It shifts whenever the source re-paginates and
 *            carries no information about the object.
 *   updated  in bogcha only. All 400 rows carry one date, so it is a bulk-load
 *            marker rather than per-record metadata; treating its movement as a
 *            change would fabricate an event for every row at once. In ssv and
 *            maktab44 the field varies across rows and is kept.
 *
 * Usage:
 *   docker compose exec backend node src/scripts/diff-snapshots.js --source=maktab44 --dry-run
 *   docker compose exec backend node src/scripts/diff-snapshots.js --source=maktab44
 *   docker compose exec backend node src/scripts/diff-snapshots.js --source=ssv --from=<snapshotId> --to=<snapshotId>
 *
 * Options:
 *   --source=ssv|bogcha|maktab44   required
 *   --from=<snapshotId>            default the second most recent
 *   --to=<snapshotId>              default the most recent
 *   --field=<name>                 report only this field
 *   --limit=40                     how many example changes to print
 *   --dry-run                      report without writing
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Snapshot, RegistryChange } from '../snapshot/model.js';
import { rowsOf } from './take-snapshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const SOURCES = ['ssv', 'bogcha', 'maktab44'];
const PRINT_LIMIT_DEFAULT = 40;

// Fields whose movement is not an event. See the header for why each one is here.
const IGNORED_FIELDS = {
    ssv: new Set(['_uid_']),
    maktab44: new Set(['_uid_']),
    bogcha: new Set(['_uid_', 'updated'])
};

function arg(name) {
    const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
}

function has(name) {
    return process.argv.slice(2).includes(`--${name}`);
}

function loadSnapshot(doc) {
    const p = path.join(DATA_DIR, doc.file);
    if (!fs.existsSync(p)) throw new Error(`файл снимка не найден: ${doc.file}`);
    const raw = zlib.gunzipSync(fs.readFileSync(p));
    const rows = rowsOf(JSON.parse(raw.toString('utf-8')));
    if (!rows) throw new Error(`в снимке ${doc.file} не найден массив записей`);
    return rows;
}

/** Empty string, null and undefined are the same absence and must not diff against each other. */
function norm(v) {
    if (v === null || v === undefined || v === '') return null;
    return String(v);
}

function indexById(rows) {
    const m = new Map();
    let missingId = 0;
    for (const r of rows) {
        if (r.id === null || r.id === undefined) { missingId++; continue; }
        m.set(Number(r.id), r);
    }
    return { map: m, missingId };
}

function diff(fromRows, toRows, source) {
    const ignored = IGNORED_FIELDS[source] || new Set(['_uid_']);
    const a = indexById(fromRows);
    const b = indexById(toRows);

    const changes = [];
    const byField = new Map();

    for (const [id, next] of b.map) {
        const prev = a.map.get(id);
        if (!prev) {
            changes.push({ sourceId: id, kind: 'added', field: null, from: null, to: null, row: next });
            continue;
        }
        // Union of keys, so a field that appears or disappears between fetches is
        // seen rather than silently skipped.
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) {
            if (ignored.has(k)) continue;
            const x = norm(prev[k]);
            const y = norm(next[k]);
            if (x === y) continue;
            changes.push({ sourceId: id, kind: 'changed', field: k, from: x, to: y, row: next });
            byField.set(k, (byField.get(k) || 0) + 1);
        }
    }

    for (const [id, prev] of a.map) {
        if (!b.map.has(id)) {
            changes.push({ sourceId: id, kind: 'removed', field: null, from: null, to: null, row: prev });
        }
    }

    return { changes, byField, missingId: a.missingId + b.missingId, fromCount: a.map.size, toCount: b.map.size };
}

async function main() {
    const source = arg('source');
    if (!SOURCES.includes(source)) {
        console.error(`--source обязателен и должен быть одним из: ${SOURCES.join(', ')}`);
        process.exit(1);
    }
    const dryRun = has('dry-run');
    const onlyField = arg('field');
    const printLimit = Number(arg('limit')) || PRINT_LIMIT_DEFAULT;

    console.log('═══════════════════════════════════════');
    console.log('  Diff снимков реестра');
    console.log('═══════════════════════════════════════');
    if (dryRun) console.log('  DRY RUN - без записи');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI не задан'); process.exit(1); }

    await mongoose.connect(mongoUri);

    try {
        const fromId = arg('from');
        const toId = arg('to');

        let fromDoc;
        let toDoc;

        if (fromId && toId) {
            fromDoc = await Snapshot.findById(fromId).lean();
            toDoc = await Snapshot.findById(toId).lean();
        } else {
            const recent = await Snapshot.find({ sourceApi: source }).sort({ takenAt: -1 }).limit(2).lean();
            toDoc = recent[0];
            fromDoc = recent[1];
        }

        if (!toDoc) {
            console.log(`\n  Снимков источника ${source} в архиве нет.`);
            console.log('  Сначала: node src/scripts/take-snapshot.js --source=' + source);
            return;
        }
        if (!fromDoc) {
            console.log(`\n  В архиве только один снимок ${source} от ${new Date(toDoc.takenAt).toISOString().slice(0, 10)}.`);
            console.log('  Сравнивать не с чем. Это ожидаемое состояние на старте архива:');
            console.log('  первый снимок задаёт t0, переходы появляются со второго.');
            return;
        }
        if (fromDoc.sourceApi !== toDoc.sourceApi) {
            console.error('❌ снимки из разных источников');
            process.exit(1);
        }
        if (new Date(fromDoc.takenAt) > new Date(toDoc.takenAt)) {
            [fromDoc, toDoc] = [toDoc, fromDoc];
        }

        console.log(`\n  ${source}`);
        console.log(`    от: ${new Date(fromDoc.takenAt).toISOString().slice(0, 10)}  ${fromDoc.recordCount} записей  ${fromDoc.sha256.slice(0, 12)}`);
        console.log(`    до: ${new Date(toDoc.takenAt).toISOString().slice(0, 10)}  ${toDoc.recordCount} записей  ${toDoc.sha256.slice(0, 12)}`);

        const windowDays = Math.round((new Date(toDoc.takenAt) - new Date(fromDoc.takenAt)) / 86400000);
        console.log(`    окно наблюдения: ${windowDays} дней`);

        const result = diff(loadSnapshot(fromDoc), loadSnapshot(toDoc), source);

        const added = result.changes.filter(c => c.kind === 'added').length;
        const removed = result.changes.filter(c => c.kind === 'removed').length;
        const changed = result.changes.filter(c => c.kind === 'changed').length;

        console.log(`\n  записей: было ${result.fromCount}, стало ${result.toCount}`);
        if (result.missingId) console.log(`  ⚠️  без поля id, пропущено: ${result.missingId}`);
        console.log(`  добавлено ${added}, удалено ${removed}, изменений полей ${changed}`);

        if (result.byField.size) {
            console.log('\n  Изменения по полям');
            console.log('  ' + '─'.repeat(45));
            for (const [f, c] of [...result.byField].sort((x, y) => y[1] - x[1])) {
                console.log(`  ${f.padEnd(28)} ${String(c).padStart(6)}`);
            }
        }

        const shown = result.changes
            .filter(c => c.kind === 'changed' && (!onlyField || c.field === onlyField))
            .slice(0, printLimit);
        if (shown.length) {
            console.log(`\n  Примеры (${shown.length} из ${changed})`);
            console.log('  ' + '─'.repeat(70));
            for (const c of shown) {
                console.log(`  id=${String(c.sourceId).padEnd(8)} ${c.field.padEnd(24)} ${String(c.from).padEnd(16)} -> ${c.to}`);
            }
        }

        if (dryRun) {
            console.log(`\n  🔍 dry run - записали бы ${result.changes.length} строк RegistryChange`);
            return;
        }

        if (result.changes.length === 0) {
            console.log('\n  Изменений нет, писать нечего.');
            return;
        }

        const ops = result.changes.map(c => ({
            updateOne: {
                filter: {
                    sourceApi: source,
                    sourceId: c.sourceId,
                    field: c.field,
                    toSnapshot: toDoc._id
                },
                update: {
                    $set: {
                        sourceApi: source,
                        sourceId: c.sourceId,
                        kind: c.kind,
                        field: c.field,
                        from: c.from,
                        to: c.to,
                        fromSnapshot: fromDoc._id,
                        toSnapshot: toDoc._id,
                        observedFrom: fromDoc.takenAt,
                        observedTo: toDoc.takenAt,
                        districtCode: c.row?.code != null ? String(c.row.code) : null,
                        regionCode: c.row?.parent_code != null ? Number(c.row.parent_code) : null
                    }
                },
                upsert: true
            }
        }));

        // Upsert rather than insert so a repeated diff of the same pair is
        // idempotent and does not double-count transitions.
        await RegistryChange.bulkWrite(ops, { ordered: false });
        console.log(`\n  ✅ записано строк RegistryChange: ${ops.length}`);
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
}

export { diff, norm, IGNORED_FIELDS };
