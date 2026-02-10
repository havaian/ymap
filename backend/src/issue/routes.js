import express from 'express';
import { getIssues, getIssue, createIssue, updateIssue, deleteIssue, voteIssue } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import commentRoutes from '../comment/routes.js';

const router = express.Router();

router.get('/', getIssues);
router.use('/:issueId/comments', commentRoutes);
router.get('/:id', getIssue);
router.post('/', authMiddleware, createIssue);
router.patch('/:id', authMiddleware, adminOnly, updateIssue);
router.delete('/:id', authMiddleware, adminOnly, deleteIssue);
router.post('/:id/vote', authMiddleware, voteIssue);

export default router;