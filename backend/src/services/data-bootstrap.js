// backend/src/services/data-bootstrap.js
//
// Populates MongoDB from the committed JSON files when the container starts.
//
// The files are prepared once, locally, and committed: fetch-osm-boundaries.js
// writes the boundaries, the registry exports come from duasr.uz, and all of it
// travels inside the image. This module is the other half - it takes what shipped
// and puts it in the database, so a fresh deployment against an empty Mongo comes
// up populated instead of requiring somebody to remember five commands.
//
// Four properties it is built around.
//
// IT MUST NOT RUN TWICE FOR NOTHING. Restarts are routine - every deploy, every
// crash, `restart: unless-stopped`. So each stage records a fingerprint of the
// exact bytes it consumed, and a stage whose inputs have not changed is skipped
// after a single indexed read. Reimporting is triggered by committing a different
// file, which is the only thing that should trigger it.
//
// IT MUST NOT KEEP THE API DOWN. A first run on an empty database is worth
// waiting for: an API serving zero districts is not usefully up. A rerun after a
// data change is not, because the old data is still there and still correct
// enough to answer with. So the first population blocks the listen and every
// later one runs behind it.
//
// IT MUST NOT BE ABLE TO CRASH THE SERVER. Any failure here is logged and
// swallowed. A boundary file that will not parse is a reason to serve stale data,
// never a reason to refuse connections.
//
// IT MUST NOT RUN TWICE AT ONCE. Two replicas starting together would both
// import. A lock document with a lease makes the second one skip, and the lease
// expires so a container killed mid-import does not block the next one forever.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

import Region from '../region/model.js';
import District from '../district/model.js';
import Object_ from '../object/model.js';
import { DATA_DIR, resolveRead } from '../utils/dataDir.js';

// ── Bookkeeping ───────────────────────────────────────────────────────────────

const stateSchema = new mongoose.Schema({
    // One document per stage, plus one for the lock.
    key: { type: String, required: true, unique: true },
    fingerprint: { type: String, default: null },
    ranAt: { type: Date, default: null },
    // Free-form counts from the stage, for the log line on the next start.
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    // Lock fields.
    holder: { type: String, default: null },
    leaseUntil: { type: Date, default: null }
}, { timestamps: true });

const BootstrapState = mongoose.models.BootstrapState
    || mongoose.model('BootstrapState', stateSchema);

const LOCK_KEY = '__lock__';
const LEASE_MS = 15 * 60 * 1000;

// Координата, выставленная человеком, автоматическим соединением не
// перезаписывается никогда.
const PROTECTED_COORD_SOURCES = ['field_verified', 'manual'];
const COORD_BATCH = 500;

/**
 * sha256 over the exact bytes of every input file, with its name, so a rename or
 * a reordering is a different fingerprint. Missing files are recorded as missing
 * rather than skipped: a stage whose input disappeared has changed.
 */
function fingerprint(files) {
    const h = crypto.createHash('sha256');
    for (const f of files) {
        const p = resolveRead(f);
        h.update(f);
        if (!fs.existsSync(p)) { h.update('\0missing'); continue; }
        h.update(fs.readFileSync(p));
    }
    return h.digest('hex');
}

function missingFiles(files) {
    return files.filter(f => !fs.existsSync(resolveRead(f)));
}

async function acquireLock(holder) {
    const now = new Date();
    try {
        // Takes the lock when nobody holds it or the previous lease has expired.
        const res = await BootstrapState.findOneAndUpdate(
            { key: LOCK_KEY, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] },
            { $set: { holder, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
            { upsert: true, new: true }
        );
        return !!res;
    } catch (err) {
        // Duplicate key means somebody else created it first, which is a refusal,
        // not a failure.
        if (err.code === 11000) return false;
        throw err;
    }
}

async function releaseLock(holder) {
    await BootstrapState.updateOne(
        { key: LOCK_KEY, holder },
        { $set: { holder: null, leaseUntil: null } }
    );
}

// ── Stages ────────────────────────────────────────────────────────────────────
//
// Order matters and is not negotiable: districts need regions, objects need
// districts for districtId, and the simplified geometry needs the districts it
// simplifies. `count` decides whether the collection is empty, which is what
// separates a first run from a rerun.

const STAGES = [
    {
        key: 'geodata',
        label: 'границы регионов и районов',
        files: ['osm-regions.geojson', 'osm-districts.geojson'],
        count: () => District.estimatedDocumentCount(),
        run: async () => {
            const { importRegions, importDistricts } = await import('../scripts/import-geodata-osm.js');
            const r = await importRegions({});
            const d = await importDistricts({});
            return { regions: r.written, districts: d.written, missing: r.missing + d.missing };
        }
    },
    {
        key: 'objects',
        label: 'объекты реестров',
        files: ['ssv.json', 'bogcha.json', 'maktab44.json', 'district-crosswalk.json'],
        count: () => Object_.estimatedDocumentCount(),
        run: async () => {
            const { importObjects } = await import('../scripts/import-objects.js');
            const res = await importObjects({});
            return res ?? null;
        }
    },
    {
        key: 'simplify',
        label: 'упрощённая геометрия под отрисовку',
        // Depends on what the geodata stage produced rather than on a file, so its
        // fingerprint is the geodata one: if the boundaries did not change, the
        // simplification of them cannot have.
        files: ['osm-regions.geojson', 'osm-districts.geojson'],
        count: () => District.countDocuments({ 'geometrySimplified.coordinates': { $exists: true } }),
        run: async () => {
            const { simplifyAll } = await import('../scripts/simplify-boundaries.js');
            await simplifyAll();
            return { done: true };
        }
    },
    {
        key: 'coords',
        label: 'координаты объектов',
        // Готовое соответствие, посчитанное локально скриптом
        // build-egov-coords.js. Здесь оно только разливается: соединение по ИНН,
        // правило неоднозначности и признак общей точки решены при сборке файла,
        // и повторять это при каждом старте контейнера незачем.
        files: ['object-coords.json'],
        // Считаются документы, координата которых пришла именно отсюда. Объекты,
        // размеченные вручную или в поле, в счёт не идут: иначе один выверенный
        // объект выдавал бы этап за выполненный.
        count: () => Object_.countDocuments({ coordSource: 'egov_inn' }),
        run: async () => loadObjectCoords()
    }
];

/**
 * Разливает data/object-coords.json в коллекцию объектов.
 *
 * Единственное, что решается здесь, а не при сборке файла - защита координат,
 * выставленных человеком. Их источник известен только базе, поэтому проверка
 * выражена условием запроса, а не сравнением после чтения: документ с
 * coordSource field_verified или manual просто не попадает под обновление, и
 * между чтением и записью его состояние измениться не может.
 *
 * Отметка coord_ambiguous ставится и снимается через $addToSet и $pull, чтобы не
 * читать текущий набор отметок ради одного значения.
 */
async function loadObjectCoords() {
    const payload = JSON.parse(fs.readFileSync(resolveRead('object-coords.json'), 'utf-8'));
    const coords = payload.coords ?? [];
    const ambiguous = payload.ambiguous ?? [];

    const ops = [];

    for (const c of coords) {
        ops.push({
            updateOne: {
                filter: {
                    sourceApi: c.sourceApi,
                    sourceId: c.sourceId,
                    coordSource: { $nin: PROTECTED_COORD_SOURCES }
                },
                update: {
                    $set: {
                        lat: c.lat,
                        lng: c.lng,
                        location: { type: 'Point', coordinates: [c.lng, c.lat] },
                        coordSource: 'egov_inn',
                        coordPrecision: c.precision,
                        coordShared: c.shared
                    },
                    $pull: { qualityFlags: 'coord_ambiguous' }
                }
            }
        });
    }

    for (const a of ambiguous) {
        ops.push({
            updateOne: {
                filter: {
                    sourceApi: a.sourceApi,
                    sourceId: a.sourceId,
                    coordSource: { $nin: PROTECTED_COORD_SOURCES }
                },
                update: { $addToSet: { qualityFlags: 'coord_ambiguous' } }
            }
        });
    }

    let modified = 0;
    for (let i = 0; i < ops.length; i += COORD_BATCH) {
        const res = await Object_.bulkWrite(ops.slice(i, i + COORD_BATCH), { ordered: false });
        modified += res.modifiedCount;
    }

    return {
        coords: coords.length,
        ambiguous: ambiguous.length,
        modified,
        // Из чего собран файл, а не когда: метки времени в нём нет, иначе он
        // менялся бы при каждом прогоне сборщика и этап переигрывался бы впустую.
        egovFiles: (payload.egovFiles ?? []).length
    };
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Whether a stage should run, and why.
 *
 * Pulled out as a pure function because this is the part with the behaviour worth
 * being sure about, and everything it needs is already a plain value by the time
 * it is called. The truth table it encodes:
 *
 *   inputs all absent        -> skip, nothing to load from
 *   inputs partly absent     -> skip, a half-loaded stage is worse than none
 *   force                    -> run
 *   collection empty         -> run, whatever the fingerprint says
 *   fingerprint differs      -> run, the committed files changed
 *   fingerprint matches      -> skip
 *
 * The empty-collection case outranks the fingerprint deliberately: a database
 * that was dropped and a bookkeeping row that survived would otherwise leave the
 * stage convinced it had already done its work.
 */
export function decideStage({ absentCount, totalFiles, force, populated, storedFingerprint, currentFingerprint }) {
    if (totalFiles > 0 && absentCount === totalFiles) return { run: false, reason: 'no_input' };
    if (absentCount > 0) return { run: false, reason: 'partial_input' };
    if (force) return { run: true, reason: 'forced' };
    if (!populated) return { run: true, reason: 'empty_collection' };
    if (!storedFingerprint) return { run: true, reason: 'first_run' };
    if (storedFingerprint !== currentFingerprint) return { run: true, reason: 'files_changed' };
    return { run: false, reason: 'unchanged' };
}

const REASON_TEXT = {
    no_input: 'входных файлов нет',
    partial_input: 'часть входных файлов отсутствует',
    forced: 'принудительно',
    empty_collection: 'коллекция пуста',
    first_run: 'первый запуск',
    files_changed: 'файлы изменились',
    unchanged: 'файлы не менялись, база наполнена'
};

async function runStage(stage, { force }) {
    const absent = missingFiles(stage.files);
    const fp = fingerprint(stage.files);
    const state = await BootstrapState.findOne({ key: stage.key }).lean();
    const populated = (await stage.count()) > 0;

    const decision = decideStage({
        absentCount: absent.length,
        totalFiles: stage.files.length,
        force,
        populated,
        storedFingerprint: state?.fingerprint ?? null,
        currentFingerprint: fp
    });

    if (!decision.run) {
        const detail = absent.length ? ` (${absent.join(', ')})` : '';
        const mark = decision.reason === 'unchanged' ? '  ✓' : '  ⏭';
        console.log(`${mark} ${stage.key}: ${REASON_TEXT[decision.reason]}${detail}, пропускаю`);
        return { skipped: decision.reason };
    }

    console.log(`  ▶  ${stage.key}: ${stage.label} (${REASON_TEXT[decision.reason]})`);

    const started = Date.now();
    const result = await stage.run();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    await BootstrapState.updateOne(
        { key: stage.key },
        { $set: { fingerprint: fp, ranAt: new Date(), result } },
        { upsert: true }
    );

    console.log(`  ✅ ${stage.key}: за ${seconds} с ${result ? JSON.stringify(result) : ''}`);
    return { ran: true, result };
}

/**
 * Whether anything at all still has to be loaded. Used to decide between blocking
 * the listen and running behind it: an empty database is worth waiting for, a
 * refresh of a populated one is not.
 */
export async function bootstrapNeedsBlocking() {
    try {
        const [districts, objects] = await Promise.all([
            District.estimatedDocumentCount(),
            Object_.estimatedDocumentCount()
        ]);
        return districts === 0 || objects === 0;
    } catch {
        return false;
    }
}

export async function bootstrapData({ force = false } = {}) {
    if (process.env.BOOTSTRAP_DATA === 'false') {
        console.log('⏭  Наполнение базы из файлов отключено (BOOTSTRAP_DATA=false)');
        return;
    }

    const holder = `${process.env.HOSTNAME || 'backend'}:${process.pid}`;
    let locked = false;

    try {
        locked = await acquireLock(holder);
        if (!locked) {
            console.log('⏭  Наполнение базы уже идёт в другом процессе, пропускаю');
            return;
        }

        console.log('📦 Наполнение базы из файлов в ' + DATA_DIR);
        for (const stage of STAGES) {
            try {
                await runStage(stage, { force: force || process.env.BOOTSTRAP_FORCE === 'true' });
            } catch (err) {
                // One stage failing must not take the rest with it: boundaries that
                // will not parse should not stop the object registry from loading.
                console.error(`  ❌ ${stage.key}: ${err.message}`);
            }
        }
        console.log('📦 Наполнение завершено');
    } catch (err) {
        // Nothing here is worth refusing connections over.
        console.error('❌ Наполнение базы не выполнено:', err.message);
    } finally {
        if (locked) {
            try { await releaseLock(holder); } catch { /* lease expires on its own */ }
        }
    }
}
