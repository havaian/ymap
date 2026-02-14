// backend/src/admin/router.js

import express from 'express';
import { adminGetUsers, adminBlockUser, uploadOrganizations, getJobStatus, seedData, clearSeeded } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/users', adminGetUsers);
router.patch('/users/:id/block', adminBlockUser);
router.post('/upload/organizations', upload.single('file'), uploadOrganizations);
router.get('/jobs/:jobId', getJobStatus);
router.post('/seed/generate', seedData);
router.delete('/seed/clear', clearSeeded);

export default router;