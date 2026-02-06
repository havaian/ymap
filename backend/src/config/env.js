import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET'
];

export const validateEnv = () => {
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        process.exit(1);
    }

    console.log('✅ Environment variables validated');
};

export const config = {
    port: parseInt(process.env.BACKEND_PORT || '4000', 10),
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    nodeEnv: process.env.NODE_ENV || 'development',
    uploadsDir: process.env.UPLOADS_DIR || '/app/uploads'
};