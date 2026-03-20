// backend/src/ai/routes.js

import { Router } from 'express';
import { analyze } from './controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Только авторизованные пользователи — ключ Gemini не утекает наружу
router.post('/analyze', authMiddleware, analyze);

export default router;