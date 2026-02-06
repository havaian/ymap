import express from 'express';
import { addComment, getComments } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/:issueId/comments', authMiddleware, addComment);
router.get('/:issueId/comments', getComments);

export default router;