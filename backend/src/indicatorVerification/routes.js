// backend/src/indicatorVerification/routes.js
import express from 'express';
import { getForObject, submit } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.get('/', getForObject);
router.post('/', authMiddleware, submit);

export default router;