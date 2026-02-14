// backend/src/services/admin-setup.js

import User from '../user/model.js';
import { hashPassword } from '../utils/bcrypt.js';

export const ensureAdminExists = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminName = process.env.ADMIN_NAME || 'Administrator';

        if (!adminEmail || !adminPassword) {
            console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in environment — skipping admin bootstrap');
            return;
        }

        const existing = await User.findOne({ email: adminEmail });
        if (existing) {
            // Admin exists. If for some reason role is wrong, fix it silently.
            if (existing.role !== 'ADMIN') {
                await User.updateOne({ _id: existing._id }, { role: 'ADMIN' });
                console.log('🔧 Fixed admin role for', adminEmail);
            }
            console.log('✅ Admin account verified:', adminEmail);
            return;
        }

        const hashedPassword = await hashPassword(adminPassword);
        await User.create({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN'
        });

        console.log('✅ Admin account created:', adminEmail);
    } catch (error) {
        // Don't crash the server if this fails — just warn loudly
        console.error('❌ ensureAdminExists failed:', error.message);
    }
};