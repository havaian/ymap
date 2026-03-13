import { Router } from 'express';
import { getByOrg, createPromise, addVerification, deletePromise } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = Router();

// Public — any visitor can read promises for an org
router.get('/', getByOrg);

// Authenticated — any logged-in citizen can verify
router.post('/:id/verify', authMiddleware, addVerification);

// Admin — create / delete promises
router.post('/', authMiddleware, adminOnly, createPromise);
router.delete('/:id', authMiddleware, adminOnly, deletePromise);

export default router;