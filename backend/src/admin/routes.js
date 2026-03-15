// backend/src/admin/routes.js

import express from 'express';
import { adminGetUsers, adminBlockUser, syncObjects, getJobStatus, seedData, clearSeeded, seedProgramVerifications, clearProgramVerifs } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/users', adminGetUsers);
router.patch('/users/:id/block', adminBlockUser);

// Object sync — triggers background fetch from all duasr.uz endpoints
router.post('/sync-objects', syncObjects);
router.get('/jobs/:jobId', getJobStatus);

// Seeder (test data)
router.post('/seed/generate', seedData);
router.delete('/seed/clear', clearSeeded);
router.post('/seed/program-verifications', seedProgramVerifications);
router.delete('/seed/program-verifications', clearProgramVerifs);

export default router;