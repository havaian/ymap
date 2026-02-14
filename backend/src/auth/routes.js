// backend/src/auth/routes.js

import express from 'express';
import { register, login, getMe } from './controller.js';
import { strictAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// /me needs a DB lookup to return fresh, complete user data
router.get('/me', strictAuthMiddleware, getMe);

export default router;