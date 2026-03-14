// backend/src/task/routes.js

import express from 'express';
import {
    getTasks, getStats, getVerificationSummary,
    createTask, updateStatus, updateTask, deleteTask,
    vote, uploadPhoto, verify
} from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public — stats banner and marker colors use these without auth
router.get('/stats', getStats);
router.get('/verification-summary', getVerificationSummary);

// Authenticated reads
router.get('/', authMiddleware, getTasks);

// Photo upload — any authenticated user (needed before verify)
router.post('/upload-photo', authMiddleware, upload.single('photo'), uploadPhoto);

// Admin writes
router.post('/', authMiddleware, adminOnly, createTask);
router.patch('/:id/status', authMiddleware, adminOnly, updateStatus);
router.patch('/:id', authMiddleware, adminOnly, updateTask);
router.delete('/:id', authMiddleware, adminOnly, deleteTask);

// Citizen vote and verification
router.post('/:id/vote', authMiddleware, vote);
router.post('/:id/verify', authMiddleware, verify);

export default router;