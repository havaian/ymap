// backend/src/auth/controller.js

import User from '../user/model.js';
import { hashPassword, comparePassword } from '../utils/bcrypt.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword } from '../utils/validators.js';
import Organization from '../organization/model.js';

export const register = async (req, res) => {
    const { name, email, password, district } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Name, email and password are required'
        });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }

    if (!validatePassword(password)) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: 'Email already registered'
        });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        district: district || null,
        role: 'CITIZEN'
    });

    // Include role in token so authMiddleware doesn't need a DB lookup
    const token = generateToken({ userId: user._id, role: user.role });

    res.status(201).json({
        success: true,
        data: {
            user: user.toJSON(),
            token
        }
    });
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    // ── Lazy org-account creation ──────────────────────────────────────────
    // If no user exists with this email, check whether it matches a known
    // organization's generated email pattern (org.{externalId}@ymap.uz).
    // If it does, create the account on first login using the supplied password.
    const orgEmailMatch = email.match(/^org\.(\d+)@ymap\.uz$/);
    if (orgEmailMatch) {
        const externalId = parseInt(orgEmailMatch[1], 10);
        const existingOrgUser = await User.findOne({ email }).select('+password');

        if (!existingOrgUser) {
            // First login for this org — find the org and create the account
            const org = await Organization.findOne({ externalId }).lean();
            if (!org) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const hashedPassword = await hashPassword(password);
            const newUser = await User.create({
                name: org.name,
                email,
                password: hashedPassword,
                role: 'ORG_ADMIN',
                organizationId: org._id.toString()
            });

            const token = generateToken({ userId: newUser._id, role: newUser.role });
            return res.json({
                success: true,
                data: {
                    user: newUser.toJSON(),
                    token
                }
            });
        }
        // Account already exists — fall through to normal login below
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }

    if (user.blocked) {
        return res.status(403).json({
            success: false,
            message: 'Your account has been blocked'
        });
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }

    // Include role in token so authMiddleware doesn't need a DB lookup
    const token = generateToken({ userId: user._id, role: user.role });

    res.json({
        success: true,
        data: {
            user: user.toJSON(),
            token
        }
    });
};

export const getMe = async (req, res) => {
    // req.user from strictAuthMiddleware has full fresh data
    res.json({
        success: true,
        data: req.user
    });
};