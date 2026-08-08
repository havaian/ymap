// backend/src/auth/routes.js

import express from 'express';
import {
    register,
    login,
    getMe,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword
} from './controller.js';
import { strictAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Confirmation. GET so the link in the letter works when opened directly with a
// tool other than the frontend; the frontend page /verify-email calls the same
// route with the token it took out of the query string.
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Password reset. POST only, both of them: the reset link opens a page in the
// frontend, which then submits the token together with the new password. A GET
// that consumed the token would burn it on every mail-client link preview.
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// /me needs a DB lookup to return fresh, complete user data
router.get('/me', strictAuthMiddleware, getMe);

export default router;
