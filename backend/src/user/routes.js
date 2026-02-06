import express from 'express';
import { getUsers, blockUser } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

router.get('/', authMiddleware, adminOnly, getUsers);
router.patch('/:id/block', authMiddleware, adminOnly, blockUser);

export default router;