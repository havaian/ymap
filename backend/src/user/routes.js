// backend/src/user/routes.js
// Note: authMiddleware is already applied at the router level in app.js
// for all /api/users routes. No need to repeat it here.

import express from 'express';
import { getUsers, blockUser } from './controller.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

router.get('/', adminOnly, getUsers);
router.patch('/:id/block', adminOnly, blockUser);

export default router;