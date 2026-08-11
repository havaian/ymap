import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'GEMINI_API_KEY',
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
    // Опциональные - предупреждение, но не падаем
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  GEMINI_API_KEY not set - AI analysis endpoint will return 503');
    }
    // Ссылки в письмах строятся от PUBLIC_BASE_URL. Значение по умолчанию -
    // localhost, и в проде оно даёт письма с мёртвыми ссылками вида
    // http://localhost:7797/verify-email?token=... Молча это пропускать нельзя:
    // человек уже зарегистрировался и ждёт письма, которое никуда не ведёт.
    const base = process.env.PUBLIC_BASE_URL || '';
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production' && (!base || /localhost|127\.0\.0\.1/.test(base))) {
        console.error('❌ PUBLIC_BASE_URL не задан или указывает на localhost при NODE_ENV=production');
        console.error(`   текущее значение: ${base || '(пусто, будет http://localhost:7797)'}`);
        console.error('   письма подтверждения и сброса пароля уйдут с нерабочими ссылками');
        console.error('   поправьте .env на сервере: PUBLIC_BASE_URL=https://ymap.ytech.space');
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
    uploadsDir: process.env.UPLOADS_DIR || '/app/uploads',
    // Where the confirmation link points. This is the public address of the Nuxt
    // frontend, not of this API: the link opens /verify-email, which then calls
    // back here. Wrong value here means letters with dead links, so it is kept
    // separate from CORS_ORIGIN, which may legitimately be a list or a wildcard.
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:7797',
    // SMTP is optional. Without it registration still works and the confirmation
    // link is written to the server log - see services/mailer.js.
    mail: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'Y.Map <no-reply@ymap.ytech.space>',
        verifyTtlMs: parseInt(process.env.VERIFY_TOKEN_TTL_MS || String(24 * 60 * 60 * 1000), 10),
        resendCooldownMs: parseInt(process.env.VERIFY_RESEND_COOLDOWN_MS || String(60 * 1000), 10),
        // Shorter than the confirmation window on purpose. A confirmation link
        // sits in an inbox until its owner gets round to it; a reset link is a
        // live credential, and every extra hour of validity is exposure.
        resetTtlMs: parseInt(process.env.RESET_TOKEN_TTL_MS || String(60 * 60 * 1000), 10)
    }
};