// backend/src/services/admin-setup.js
// Bootstraps the admin account on every server start. Idempotent - safe to run
// repeatedly.
//
// УДАЛЕНО: шесть демонстрационных гражданских аккаунтов с общим паролем
// Demo1234!, создававшихся при каждом старте. Посевные пользователи сняты с
// платформы целиком. Учётная запись администратора остаётся: её адрес и пароль
// задаёт оператор в окружении, без неё в систему некому войти.
//
// Уже созданные демо-аккаунты в базе этим кодом не трогаются: удаление чужих
// строк без команды здесь не делается. Снести их можно вручную одним запросом:
//   db.users.deleteMany({ email: /@demo\.ymap\.uz$/ })

import User from '../user/model.js';
import { hashPassword } from '../utils/bcrypt.js';

// ── ensureAdminExists ─────────────────────────────────────────────────────────

export const ensureAdminExists = async () => {
    try {
        await bootstrapAdmin();
    } catch (error) {
        // Don't crash the server - just warn loudly
        console.error('❌ Account bootstrap failed:', error.message);
    }
};

async function bootstrapAdmin() {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrator';

    if (!adminEmail || !adminPassword) {
        console.warn('⚠️  DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not set - skipping admin bootstrap');
        return;
    }

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
        // Fix role if somehow wrong
        if (existing.role !== 'ADMIN') {
            await User.updateOne({ _id: existing._id }, { role: 'ADMIN' });
            console.log('🔧 Fixed admin role for', adminEmail);
        }
        if (existing.emailVerified !== true) {
            await User.updateOne({ _id: existing._id }, { emailVerified: true });
        }
        console.log('✅ Admin account verified:', adminEmail);
        return;
    }

    const hashedPassword = await hashPassword(adminPassword);
    await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        // Bootstrapped accounts skip the confirmation gate: their address is set by
        // the operator in the environment, and there is no inbox to click through.
        emailVerified: true
    });

    console.log('✅ Admin account created:', adminEmail);
}
