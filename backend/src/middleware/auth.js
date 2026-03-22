// backend/src/middleware/auth.js

import { verifyToken } from '../utils/jwt.js';
import User from '../user/model.js';

// ─── Fast middleware (no DB lookup) ─────────────────────────────────────────
// Uses role stored in JWT claims. No round-trip to MongoDB.
// Use this on all regular protected routes (issues, votes, etc.)
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Check if this user has been blocked since token was issued
        const { getRedisClient } = await import('../config/redis.js');
        const redis = getRedisClient();
        if (redis?.isOpen) {
            const blocked = await redis.get(`blocked:${decoded.userId}`);
            if (blocked) {
                return res.status(403).json({
                    success: false,
                    message: 'Your account has been blocked'
                });
            }
        }

        // Attach minimal user object from JWT claims — no DB needed
        req.user = {
            id: decoded.userId,
            _id: decoded.userId,
            role: decoded.role,
            // blocked is checked at login time; JWT expiry limits the window
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// ─── Strict middleware (DB lookup) ──────────────────────────────────────────
// Fetches the full user from DB on every call.
// Use only where freshness is critical: admin routes, account management.
export const strictAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const user = await User.findById(decoded.userId).select('-password').lean();

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.blocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Strict auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};