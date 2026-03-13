import { Router } from 'express';
import { getByOrg, createPromise, addVerification, deletePromise } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { photoUpload } from '../utils/photoConfig.js';

const router = Router();

// Public — any visitor can read promises for an org
router.get('/', getByOrg);

// Citizen — upload a verification photo, get back the relative URL to pass into verify
// POST /api/promises/upload-photo  (multipart/form-data, field: photo)
// Returns: { success: true, data: { photoUrl: "photos/1234-uuid.jpg" } }
router.post(
    '/upload-photo',
    authMiddleware,
    photoUpload.single('photo'),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        // Return the path relative to uploads root — stored in DB, served via /api/uploads/
        res.json({
            success: true,
            data: { photoUrl: `photos/${req.file.filename}` }
        });
    }
);

// Authenticated — any logged-in citizen can verify
router.post('/:id/verify', authMiddleware, addVerification);

// Admin — create / delete promises
router.post('/', authMiddleware, adminOnly, createPromise);
router.delete('/:id', authMiddleware, adminOnly, deletePromise);

export default router;