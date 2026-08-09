// backend/src/index.js

import 'express-async-errors';
import compression from 'compression';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateEnv } from './config/env.js';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware, strictAuthMiddleware } from './middleware/auth.js';
import { adminOnly } from './middleware/adminOnly.js';
import { ensureAdminExists } from './services/admin-setup.js';
import { checkMailer } from './services/mailer.js';
import { bootstrapData, bootstrapNeedsBlocking } from './services/data-bootstrap.js';

import authRoutes from './auth/routes.js';
import aiRoutes from './ai/routes.js';
import issueRoutes from './issue/routes.js';
import objectRoutes from './object/routes.js';
import userRoutes from './user/routes.js';
import voteRoutes from './vote/routes.js';
import adminRoutes from './admin/routes.js';
import analyticsRoutes from './analytics/routes.js';
import regionRoutes from './region/routes.js';
import districtRoutes from './district/routes.js';
import markerRoutes from './markers/routes.js';
import openBudgetRoutes from './openbudget/routes.js';
import taskRoutes from './task/routes.js';
import allocationRoutes from './budgetAllocation/routes.js';
import programRoutes from './program/routes.js';
import indicatorVerifRoutes from './indicatorVerification/routes.js';
import { PATHS as UPLOAD_PATHS } from './utils/uploadPaths.js';

validateEnv();

const app = express();
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Credential guessing. Tight on purpose: twenty tries a quarter of an hour is far
// more than a person needs and far less than a dictionary run.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Confirming an address is not a credential attempt and must not share a counter
// with one. Opening the link from a letter is a request against /auth/verify-email,
// and on a shared address - one office, one mobile carrier NAT - a handful of
// people signing up would otherwise spend the login budget and lock each other out
// of their own accounts. The token is 32 random bytes, so guessing is not the
// threat model here; this window only stops a loop.
const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, message: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Registration and resend both send mail, so the limit here protects a mailbox and
// the sending reputation rather than a password. Per-account throttling is separate
// and lives in the controller as verifySentAt, because this one is per IP and an IP
// is shared.
const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    message: { success: false, message: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: { success: false, message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET'
});

const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false
});

// Gzip - cuts response size by 70-80%
app.use(compression());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/api/uploads', express.static(UPLOAD_PATHS.root, {
    maxAge: '7d',
    immutable: true,
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public routes ─────────────────────────────────────────────────────────────
// Three different windows on one router. Order matters: the specific paths are
// mounted before the catch-all, so /login keeps the strict limiter while confirming
// an address and asking for a new letter get their own budgets.
app.use('/api/auth/verify-email', verifyLimiter);
app.use('/api/auth/register', signupLimiter);
app.use('/api/auth/resend-verification', signupLimiter);
app.use('/api/auth/forgot-password', signupLimiter);
// Consuming a reset token is a one-shot action against a 32-byte random string,
// not a guessable credential, so it sits with confirmation rather than with login.
app.use('/api/auth/reset-password', verifyLimiter);
app.use('/api/auth', authLimiter, authRoutes);

// ── AI (Gemini proxy) - авторизованные пользователи ──────────────────────────
app.use('/api/ai', apiLimiter, aiRoutes);

// Map data - read is public, writes are protected inside each route file
app.use('/api/issues', apiLimiter, issueRoutes);
app.use('/api/objects', apiLimiter, objectRoutes);

// ── Authenticated routes ──────────────────────────────────────────────────────
app.use('/api/users', apiLimiter, authMiddleware, userRoutes);
app.use('/api/votes', apiLimiter, authMiddleware, voteRoutes);

// Tasks & budget allocations - read: authenticated, write: admin only
app.use('/api/tasks', apiLimiter, taskRoutes);
app.use('/api/allocations', apiLimiter, allocationRoutes);

// Programs - read: authenticated, write: admin only
app.use('/api/programs', apiLimiter, programRoutes);

// ── Admin routes ──────────────────────────────────────────────────────────────
// Этап 10: админка убрана из продукта - роут закомментирован (не удалён), можно вернуть.
// app.use('/api/admin', adminLimiter, strictAuthMiddleware, adminOnly, adminRoutes);

// ── Analytics (Этап 10: админ-гейт снят → публичная аналитика; старая защита в комментарии) ──
app.use('/api/analytics', apiLimiter, /* strictAuthMiddleware, adminOnly, */ analyticsRoutes);

// ── Region & District (public - map GeoJSON + dropdowns) ─────────────────────
app.use('/api/regions', apiLimiter, /* authMiddleware, */ regionRoutes);
app.use('/api/districts', apiLimiter, /* authMiddleware, */ districtRoutes);

// ── Markers (public - map pins) ───────────────────────────────────────────────
app.use('/api/markers', apiLimiter, /* authMiddleware, */ markerRoutes);

// ── Open Budget (public) ──────────────────────────────────────────────────────
app.use('/api/openbudget', apiLimiter, authMiddleware, openBudgetRoutes);

// ── Indicator verification routes (public) ──────────────────────────────────────────────────────
app.use('/api/objects/:id/indicator-verifications', apiLimiter, authMiddleware, indicatorVerifRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();
        await ensureAdminExists();
        await checkMailer();

        // An empty database is not usefully up, so the first population blocks the
        // listen. Once there is data to serve, a refresh runs behind it: the old
        // data answers correctly enough while the new data lands, and a deploy is
        // not held open for the length of an import.
        if (await bootstrapNeedsBlocking()) {
            await bootstrapData();
        } else {
            bootstrapData().catch(err => console.error('❌ Наполнение базы:', err.message));
        }

        app.listen(config.port, '0.0.0.0', () => {
            console.log('');
            console.log('🚀 ========================================');
            console.log(`🚀 Y.Map Backend API`);
            console.log(`🚀 Server running on port ${config.port}`);
            console.log(`🚀 Environment: ${config.nodeEnv}`);
            console.log('🚀 ========================================');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

process.on('SIGTERM', () => { console.log('SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT received'); process.exit(0); });