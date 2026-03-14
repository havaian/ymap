// backend/src/program/routes.js

import { Router } from 'express';
import {
    getPrograms, getProgram, createProgram, updateProgram, deleteProgram,
    assignObjects, addObject, removeObject
} from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = Router();

// Authenticated reads — citizens can browse programs
router.get('/', authMiddleware, getPrograms);
router.get('/:id', authMiddleware, getProgram);

// Admin writes
router.post('/', authMiddleware, adminOnly, createProgram);
router.patch('/:id', authMiddleware, adminOnly, updateProgram);
router.delete('/:id', authMiddleware, adminOnly, deleteProgram);

// Object assignment
router.post('/:id/assign-objects', authMiddleware, adminOnly, assignObjects);
router.post('/:id/objects/:objectId', authMiddleware, adminOnly, addObject);
router.delete('/:id/objects/:objectId', authMiddleware, adminOnly, removeObject);

export default router;