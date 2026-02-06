import { createClient } from 'redis';

let redisClient = null;

export const connectRedis = async () => {
    if (redisClient?.isOpen) {
        console.log('✅ Redis: Using existing connection');
        return redisClient;
    }

    try {
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

        redisClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('❌ Redis: Max reconnection attempts reached');
                        return new Error('Max reconnection attempts reached');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis error:', err);
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        await redisClient.connect();
        return redisClient;

    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        return null;
    }
};

export const getRedisClient = () => redisClient;

export const disconnectRedis = async () => {
    if (redisClient?.isOpen) {
        await redisClient.quit();
        console.log('✅ Redis disconnected');
    }
};