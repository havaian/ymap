import User from '../user/model.js';
import { hashPassword } from '../utils/bcrypt.js';

export const ensureAdminExists = async () => {
    try {
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@map.ytech.space';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

        if (!adminPassword) {
            console.warn('⚠️ DEFAULT_ADMIN_PASSWORD not set in .env - skipping admin creation');
            return;
        }

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            return;
        }

        const hashedPassword = await hashPassword(adminPassword);

        await User.create({
            name: 'System Administrator',
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            district: null,
            blocked: false
        });

        console.log('✅ Admin user created successfully');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
    } catch (error) {
        console.error('❌ Failed to create admin user:', error);
    }
};