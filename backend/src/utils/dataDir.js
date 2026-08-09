/**
 * backend/src/utils/dataDir.js
 *
 * Where data files are read from and where downloaded ones are written to.
 *
 * Normally these are the same directory and nothing here does anything: scripts
 * read and write src/data, which is the checkout the operator owns.
 *
 * They separate only when GEODATA_DIR is set, and that exists for one situation.
 * src/data sits inside the git working tree, and the deploy runs
 * `git reset --hard` there. Unlinking a file needs write permission on the
 * directory holding it, not on the file, so handing that directory to a container
 * so it can write a download takes it away from the runner and every pipeline
 * fails on Permission denied; handing it back breaks the container again. The two
 * requirements cannot share one directory.
 *
 * The arrangement in use avoids the question entirely: downloads are run locally,
 * where the operator owns the checkout, and the results are committed. They reach
 * the container inside the image, and the container never writes data at all.
 * GEODATA_DIR remains for the case where a download really has to happen on a
 * machine that does not own the checkout - point it at a writable volume and
 * reads will prefer it while still falling back to the committed copy.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Committed data. Read from here; in the container it arrives inside the image. */
export const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Downloaded data. Defaults to DATA_DIR so that running a script outside Docker,
 * on a checkout the user owns, behaves the way it always did.
 */
export const WRITE_DIR = process.env.GEODATA_DIR
    ? path.resolve(process.env.GEODATA_DIR)
    : DATA_DIR;

export const SEPARATE_WRITE_DIR = WRITE_DIR !== DATA_DIR;

/**
 * Full path to read `file` from. The downloaded copy wins over the committed one:
 * somebody who just re-fetched a boundary set expects the import to use it.
 */
export function resolveRead(file) {
    if (SEPARATE_WRITE_DIR) {
        const w = path.join(WRITE_DIR, file);
        if (fs.existsSync(w)) return w;
    }
    return path.join(DATA_DIR, file);
}

/** Full path to write `file` to. */
export function resolveWrite(file) {
    return path.join(WRITE_DIR, file);
}

/**
 * Verifies the directory can actually be written to, before anything is
 * downloaded into it. A probe file rather than a look at the mode bits: the
 * container runs unprivileged, the directory may be a bind mount owned by
 * somebody else, and on a relabelled mount SELinux can refuse a write the bits
 * appear to allow.
 */
export function assertWritable(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    try {
        fs.writeFileSync(probe, '');
        fs.unlinkSync(probe);
        return true;
    } catch (err) {
        console.error(`❌ Каталог не доступен на запись: ${dir}`);
        console.error(`   ${err.code || err.message}`);
        console.error('');
        console.error('   Эти скрипты рассчитаны на локальный запуск: у них нет внешних');
        console.error('   зависимостей, нужен только Node 18 и сеть. Запустите на своей');
        console.error('   машине, в корне репозитория:');
        console.error('     node backend/src/scripts/fetch-osm-boundaries.js --debug');
        console.error('   затем закоммитьте появившиеся backend/src/data/osm-*.geojson.');
        console.error('');
        console.error('   Если запуск обязан идти там, где каталог чужой, укажите свой:');
        console.error('     GEODATA_DIR=/путь/с/правами node ... fetch-osm-boundaries.js');
        return false;
    }
}
