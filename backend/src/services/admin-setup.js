// backend/src/services/admin-setup.js
// Bootstraps the admin account and 5 demo citizen accounts on every server start.
// All accounts are idempotent — safe to run repeatedly.

import User from '../user/model.js';
import { hashPassword } from '../utils/bcrypt.js';

// ── Demo citizen accounts ─────────────────────────────────────────────────────
// Fixed credentials shown to judges during the hackathon demo.
// Password is the same for all 5 to keep the demo simple.
const DEMO_PASSWORD = 'Demo1234!';

const DEMO_CITIZENS = [
    { name: 'Зарина Юсупова', email: 'zarina@demo.ymap.uz', district: 'Юнусабад' },
    { name: 'Бобур Рахимов', email: 'bobur@demo.ymap.uz', district: 'Чиланзар' },
    { name: 'Нигора Каримова', email: 'nigora@demo.ymap.uz', district: 'Мирзо-Улугбек' },
    { name: 'Фарход Ахмедов', email: 'farkhod@demo.ymap.uz', district: 'Яшнобод' },
    { name: 'Малика Холматова', email: 'malika@demo.ymap.uz', district: 'Сергели' },
];

// ── ensureAdminExists ─────────────────────────────────────────────────────────

export const ensureAdminExists = async () => {
    try {
        await bootstrapAdmin();
        await bootstrapDemoCitizens();
    } catch (error) {
        // Don't crash the server — just warn loudly
        console.error('❌ Account bootstrap failed:', error.message);
    }
};

async function bootstrapAdmin() {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrator';

    if (!adminEmail || !adminPassword) {
        console.warn('⚠️  DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not set — skipping admin bootstrap');
        return;
    }

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
        // Fix role if somehow wrong
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
}

async function bootstrapDemoCitizens() {
    const hashedPassword = await hashPassword(DEMO_PASSWORD);

    for (const citizen of DEMO_CITIZENS) {
        const existing = await User.findOne({ email: citizen.email });

        if (existing) {
            // Ensure role is CITIZEN (in case of old ORG_ADMIN data)
            if (existing.role !== 'CITIZEN') {
                await User.updateOne({ _id: existing._id }, { role: 'CITIZEN' });
            }
            continue;
        }

        await User.create({
            name: citizen.name,
            email: citizen.email,
            password: hashedPassword,
            role: 'CITIZEN',
            district: citizen.district
        });

        console.log('✅ Demo citizen created:', citizen.email);
    }

    console.log(`✅ Demo citizens verified (password: ${DEMO_PASSWORD})`);
}