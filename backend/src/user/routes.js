// backend/src/user/routes.js
// Note: authMiddleware is already applied at the router level in app.js
// for all /api/users routes. No need to repeat it here.

import express from 'express';
import { getUsers, blockUser, getUserActivity, getMyActivity, getLeaderboard } from './controller.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

router.get('/', adminOnly, getUsers);
router.get('/leaderboard', getLeaderboard);       // перед /:id чтобы не конфликтовало
router.get('/me/activity', getMyActivity);        // перед /:id
router.get('/:id/activity', adminOnly, getUserActivity);
router.patch('/:id/block', adminOnly, blockUser);

export default router;