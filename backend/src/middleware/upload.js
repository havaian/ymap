// backend/src/middleware/upload.js
// Used for admin org/infrastructure Excel imports.
// Image types are kept here so the same middleware can handle
// ad-hoc single-image uploads if needed outside of verifications.

import multer from 'multer';
import path from 'path';
import { PATHS, ensureDir } from '../utils/uploadPaths.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ensureDir(PATHS.orgs));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: ' + allowedTypes.join(', ')));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});