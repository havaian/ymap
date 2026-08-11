// backend/src/admin/routes.js

import express from 'express';
import { adminGetUsers, adminBlockUser, syncObjects, getJobStatus } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

router.use(adminOnly);

router.get('/users', adminGetUsers);
router.patch('/users/:id/block', adminBlockUser);

// Object sync - triggers background fetch from all duasr.uz endpoints
router.post('/sync-objects', syncObjects);
router.get('/jobs/:jobId', getJobStatus);

// УДАЛЕНО: маршруты сидера тестовых данных.

export default router;