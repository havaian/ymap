import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateEnv } from './config/env.js';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureAdminExists } from './services/admin-setup.js';

import authRoutes from './auth/routes.js';
import issueRoutes from './issue/routes.js';
import commentRoutes from './comment/routes.js';
import organizationRoutes from './organization/routes.js';
import userRoutes from './user/routes.js';
import voteRoutes from './vote/routes.js';
import adminRoutes from './admin/routes.js';

// Validate environment variables
validateEnv();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/issues', commentRoutes); // Comments are under /api/issues/:issueId/comments
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to databases
        await connectDB();
        await connectRedis();

        // Ensure admin user exists
        await ensureAdminExists();

        app.listen(config.port, '0.0.0.0', () => {
            console.log('');
            console.log('🚀 ========================================');
            console.log(`🚀 RealHolat Backend API`);
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

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});