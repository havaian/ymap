// backend/src/app.js

import 'express-async-errors';
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

import authRoutes from './auth/routes.js';
import issueRoutes from './issue/routes.js';
import infrastructureRoutes from './infrastructure/routes.js';
import organizationRoutes from './organization/routes.js';
import userRoutes from './user/routes.js';
import voteRoutes from './vote/routes.js';
import adminRoutes from './admin/routes.js';
import analyticsRoutes from './analytics/routes.js';
import regionRoutes from './region/routes.js';
import districtRoutes from './district/routes.js';

validateEnv();

const app = express();
app.set('trust proxy', 1);

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Auth endpoints: strict — prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20,                    // 20 login attempts per window
    message: { success: false, message: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Data endpoints: generous — map app fires many requests on load
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute window
    max: 300,                   // 300 req/min per IP (5 req/s)
    message: { success: false, message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET' // GET requests are unauthenticated reads, skip rate limit
});

// Admin endpoints: moderate
const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check (public) ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public routes ─────────────────────────────────────────────────────────────
// Auth: login/register are public. /auth/me uses strictAuthMiddleware inside its route.
app.use('/api/auth', authLimiter, authRoutes);

// Map data read access is intentionally public — citizens can browse without accounts.
// Write operations (create issue, vote, comment) are protected inside each route file.
app.use('/api/issues', apiLimiter, issueRoutes);
app.use('/api/organizations', apiLimiter, organizationRoutes);
app.use('/api/infrastructure', apiLimiter, infrastructureRoutes);

// ── Authenticated routes ──────────────────────────────────────────────────────
// All /api/users and /api/votes require a valid JWT
app.use('/api/users', apiLimiter, authMiddleware, userRoutes);
app.use('/api/votes', apiLimiter, authMiddleware, voteRoutes);

// ── Admin routes ──────────────────────────────────────────────────────────────
// strictAuthMiddleware does a DB lookup — ensures admin account still exists and isn't blocked
app.use('/api/admin', adminLimiter, strictAuthMiddleware, adminOnly, adminRoutes);

// ── Analytics routes (protected by adminOnly but not rate-limited, as they may be used for internal reporting)
app.use('/api/analytics', strictAuthMiddleware, adminOnly, analyticsRoutes);

// ── Region & District routes (public, used by map for geojson and dropdowns)
app.use('/api/regions', apiLimiter, authMiddleware, regionRoutes);
app.use('/api/districts', apiLimiter, authMiddleware, districtRoutes);

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
process.on('SIGINT',  () => { console.log('SIGINT received');  process.exit(0); });