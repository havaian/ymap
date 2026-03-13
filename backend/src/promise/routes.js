// backend/src/promise/routes.js
import express from 'express';
import {
    getPromises,
    getStats,
    createPromise,
    updateStatus,
    updatePromise,
    vote,
    verify,
    uploadPhoto,
    deletePromise
} from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public — no auth needed, used by the public dashboard widget
router.get('/stats', getStats);

// Authenticated reads — citizens and admins can view promises
router.get('/', authMiddleware, getPromises);

// Photo upload — any authenticated user (needed before verify)
router.post('/upload-photo', authMiddleware, upload.single('photo'), uploadPhoto);

// Admin writes
router.post('/',              authMiddleware, adminOnly, createPromise);
router.patch('/:id/status',   authMiddleware, adminOnly, updateStatus);
router.patch('/:id',          authMiddleware, adminOnly, updatePromise);
router.delete('/:id',         authMiddleware, adminOnly, deletePromise);

// Citizen vote (AllocationSection vote UI)
router.post('/:id/vote', authMiddleware, vote);

// Citizen verification (PromisesSection done/problem flow)
router.post('/:id/verify', authMiddleware, verify);

export default router;