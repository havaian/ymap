// backend/src/task/routes.js

import express from 'express';
import {
    getTasks, getStats, createTask, updateStatus, updateTask,
    vote, verify, uploadPhoto, deleteTask
} from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public — no auth needed, used by the public dashboard widget
router.get('/stats', getStats);

// Authenticated reads
router.get('/', authMiddleware, getTasks);

// Photo upload — any authenticated user (citizen needs this before verify)
router.post('/upload-photo', authMiddleware, upload.single('photo'), uploadPhoto);

// Admin writes
router.post('/', authMiddleware, adminOnly, createTask);
router.patch('/:id/status', authMiddleware, adminOnly, updateStatus);
router.patch('/:id', authMiddleware, adminOnly, updateTask);
router.delete('/:id', authMiddleware, adminOnly, deleteTask);

// Citizen vote (only while status = 'Pending Verification')
router.post('/:id/vote', authMiddleware, vote);

// Citizen verification — done ✓ / problem ✗ + optional photo
router.post('/:id/verify', authMiddleware, verify);

export default router;