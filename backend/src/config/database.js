// backend/src/config/database.js
// ADD timeout settings to your mongoose.connect()

import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
    try {
        await mongoose.connect(config.mongoUri, {
            serverSelectionTimeoutMS: 30000,    // 30 seconds (default 30s)
            socketTimeoutMS: 120000,             // 2 minutes (default 360s, reduce for faster failure)
            connectTimeoutMS: 30000,             // 30 seconds
            maxPoolSize: 10,                     // Connection pool size
            minPoolSize: 2
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
});