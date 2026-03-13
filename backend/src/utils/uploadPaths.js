// backend/src/utils/uploadPaths.js
//
// Single source of truth for all upload directory paths.
//
// Uses config.uploadsDir (which reads UPLOADS_DIR env var, falling back to /app/uploads)
// as the root. All subdirectories are derived from that root so docker-compose volume
// changes only need to happen in one place (.env / docker-compose.yml).
//
// Docker volume mount:
//   ${UPLOADS_DIR:-./uploads}:/app/uploads   (host → container)
//
// Files are served statically at:
//   GET /api/uploads/<subdir>/<filename>

import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';

const UPLOAD_ROOT = config.uploadsDir; // /app/uploads (or UPLOADS_DIR override)

export const PATHS = {
    root: UPLOAD_ROOT,
    photos: path.join(UPLOAD_ROOT, 'photos'),   // verification photos
    orgs: path.join(UPLOAD_ROOT, 'orgs'),      // org Excel imports (currently flat, kept for clarity)
};

/**
 * Ensures a directory exists, creates it recursively if not.
 * Call this before writing any file.
 */
export function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
    return dir;
}

// Pre-create all directories on startup so they're ready before any request
Object.values(PATHS).forEach(ensureDir);