// backend/src/budgetAllocation/routes.js
import express from 'express';
import {
    getAllocations,
    createAllocation,
    updateAllocation,
    deleteAllocation
} from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

// GET is available to all authenticated users — citizens need to see allocations in sidebars
router.get('/', authMiddleware, getAllocations);

// Write operations are admin-only
router.post('/', authMiddleware, adminOnly, createAllocation);
router.patch('/:id', authMiddleware, adminOnly, updateAllocation);
router.delete('/:id', authMiddleware, adminOnly, deleteAllocation);

export default router;