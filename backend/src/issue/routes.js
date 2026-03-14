// backend/src/issue/routes.js

import express from 'express';
import { getIssues, getIssue, createIssue, updateIssue, deleteIssue, voteIssue } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { citizenOnly } from '../middleware/citizenOnly.js';
import commentRoutes from '../comment/routes.js';

const router = express.Router();

router.get('/', getIssues);
router.use('/:issueId/comments', commentRoutes);
router.get('/:id', getIssue);

// Citizens only — admins manage facilities and tasks, not citizen issue reports
router.post('/', authMiddleware, citizenOnly, createIssue);

router.patch('/:id', authMiddleware, adminOnly, updateIssue);
router.delete('/:id', authMiddleware, adminOnly, deleteIssue);
router.post('/:id/vote', authMiddleware, voteIssue);

export default router;