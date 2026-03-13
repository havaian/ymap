// backend/src/utils/photoConfig.js
//
// Multer configuration for citizen verification photos.
// Files land in uploads/photos/<timestamp>-<uuid>.<ext>
// and are served at GET /api/uploads/photos/<filename>

import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { PATHS, ensureDir } from './uploadPaths.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ensureDir(PATHS.photos));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed for verification photos.'), false);
    }
};

export const photoUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});