/**
 * Redis Cache Middleware
 * 
 * Caches analytics endpoint responses in Redis.
 * Cache key = request path + query string.
 * TTL default: 5 minutes (analytics data doesn't change every second).
 * 
 * Invalidation: POST/PATCH/DELETE to issues/orgs/infra flush relevant keys.
 */

import { getRedisClient } from '../config/redis.js';

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Middleware factory: cache GET responses
 * @param {number} ttl - Cache TTL in seconds
 * @param {string} prefix - Key prefix for targeted invalidation
 */
export const cacheMiddleware = (ttl = DEFAULT_TTL, prefix = 'cache') => {
    return async (req, res, next) => {
        const redis = getRedisClient();

        // Skip if Redis not available or non-GET
        if (!redis?.isOpen || req.method !== 'GET') {
            return next();
        }

        const key = `${prefix}:${req.originalUrl}`;

        try {
            const cached = await redis.get(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                res.set('X-Cache', 'HIT');
                return res.json(parsed);
            }
        } catch (err) {
            // Redis error — continue without cache
            console.warn('Redis cache read error:', err.message);
        }

        // Intercept res.json to store in cache
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Only cache successful responses
            if (res.statusCode === 200 && body?.success !== false) {
                redis.setEx(key, ttl, JSON.stringify(body)).catch(err => {
                    console.warn('Redis cache write error:', err.message);
                });
            }
            res.set('X-Cache', 'MISS');
            return originalJson(body);
        };

        next();
    };
};

/**
 * Invalidate analytics cache
 * Call this after any write operation that affects analytics data
 */
export const invalidateAnalyticsCache = async () => {
    const redis = getRedisClient();
    if (!redis?.isOpen) return;

    try {
        for (const prefix of ['analytics:*', 'markers:*']) {
            let cursor = 0;
            do {
                const result = await redis.scan(cursor, { MATCH: prefix, COUNT: 100 });
                cursor = result.cursor;
                if (result.keys.length > 0) await redis.del(result.keys);
            } while (cursor !== 0);
        }
    } catch (err) {
        console.warn('Cache invalidation error:', err.message);
    }
};