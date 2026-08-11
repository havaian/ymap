// backend/src/auth/controller.js

import crypto from 'crypto';
import User from '../user/model.js';
import { hashPassword, comparePassword } from '../utils/bcrypt.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword } from '../utils/validators.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/mailer.js';
import { config } from '../config/env.js';

// ── Confirmation tokens ───────────────────────────────────────────────────────
//
// The raw token goes into the mailed link and is never stored. The database keeps
// only its SHA-256, so a dump of the users collection does not let anyone confirm
// somebody else's address. SHA-256 rather than bcrypt on purpose: the token is 32
// random bytes, there is nothing to brute force, and lookup has to be a single
// indexed read.

/**
 * Whether an account still needs to confirm its address.
 *
 * The field did not exist before the confirmation flow landed, so accounts
 * created earlier carry `undefined`. That has to read as confirmed, not as
 * pending: treating it as pending would lock out every existing user at the next
 * deploy, and would mail a confirmation letter to anyone whose address someone
 * else typed into the registration form.
 *
 * Only an explicit `false` - written by register() and by nothing else - counts.
 * This predicate exists because the three call sites had drifted: login checked
 * `=== false` while register and resend checked `!emailVerified`, so the same
 * legacy account was confirmed on one route and pending on the other two.
 */
const awaitsConfirmation = (user) => user?.emailVerified === false;

const makeVerifyToken = () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
};

const issueVerification = async (user) => {
    const { raw, hash } = makeVerifyToken();
    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                verifyTokenHash: hash,
                verifyTokenExpires: new Date(Date.now() + config.mail.verifyTtlMs),
                verifySentAt: new Date()
            }
        }
    );
    return sendVerificationEmail({ to: user.email, token: raw });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
//
// No token is returned. The account exists but cannot sign in until the address is
// confirmed, which is the whole point of confirming it. The response says whether
// the letter actually left, so the interface can tell the difference between "check
// your inbox" and "delivery failed, try resending".

export const register = async (req, res) => {
    const { name, email, password, district } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        // An address registered but never confirmed is a dead end for its owner:
        // they cannot sign in and cannot register again. Re-issuing the letter is
        // the only way out, and it leaks nothing an attacker does not already have,
        // because the letter goes to the address itself and not to the requester.
        if (awaitsConfirmation(existingUser)) {
            const sent = await issueVerification(existingUser);
            return res.status(200).json({
                success: true,
                data: {
                    email: existingUser.email,
                    emailVerified: false,
                    mailDelivered: sent.delivered,
                    resent: true
                },
                message: 'Аккаунт уже создан и ожидает подтверждения. Письмо отправлено повторно.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Email already registered'
        });
    }

    const hashedPassword = await hashPassword(password);

    // The name is optional in the form: an address and a password are enough to
    // open an account, and requiring a real name before the address is even
    // confirmed collects a field that may well be discarded.
    //
    // CORRECTION: левая часть адреса как имя больше не подставляется. Это не имя,
    // а кусок адреса, и он уходил в обращение письма: человек получал
    // "m.usman.work, здравствуйте", причём почтовый клиент подчёркивал это
    // ссылкой, приняв за домен. Поле остаётся пустым, пока его не заполнят.
    const user = await User.create({
        name:      (name && String(name).trim()) || undefined,
        email:     normalizedEmail,
        password:  hashedPassword,
        district:  district || null,
        role:      'CITIZEN',
        emailVerified: false
    });

    const sent = await issueVerification(user);

    res.status(201).json({
        success: true,
        data: {
            email: user.email,
            emailVerified: false,
            mailDelivered: sent.delivered
        }
    });
};

// ── GET /api/auth/verify-email?token=… ────────────────────────────────────────

export const verifyEmail = async (req, res) => {
    const token = req.query.token || req.body?.token;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ verifyTokenHash: hash }).select('+verifyTokenExpires');

    if (!user) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Ссылка недействительна или уже использована'
        });
    }

    if (user.verifyTokenExpires && user.verifyTokenExpires.getTime() < Date.now()) {
        return res.status(400).json({
            success: false,
            code: 'TOKEN_EXPIRED',
            message: 'Срок действия ссылки истёк, запросите письмо заново'
        });
    }

    // The token is cleared in the same write that flips the flag, so a link cannot
    // be replayed and cannot be used to keep an account confirmable forever.
    await User.updateOne(
        { _id: user._id },
        {
            $set: { emailVerified: true },
            $unset: { verifyTokenHash: '', verifyTokenExpires: '' }
        }
    );

    const fresh = await User.findById(user._id);
    const authToken = generateToken({ userId: fresh._id, role: fresh.role });

    res.json({
        success: true,
        data: { user: fresh.toJSON(), token: authToken }
    });
};

// ── POST /api/auth/resend-verification ────────────────────────────────────────
//
// Answers identically whether or not the address exists. Otherwise this endpoint
// becomes a way to test which addresses are registered.

export const resendVerification = async (req, res) => {
    const { email } = req.body;
    const generic = {
        success: true,
        message: 'Если аккаунт с таким адресом ждёт подтверждения, письмо отправлено'
    };

    if (!email || !validateEmail(email)) {
        return res.json(generic);
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() })
        .select('+verifySentAt');

    if (!user || !awaitsConfirmation(user) || user.blocked) {
        return res.json(generic);
    }

    const since = user.verifySentAt ? Date.now() - user.verifySentAt.getTime() : Infinity;
    if (since < config.mail.resendCooldownMs) {
        return res.status(429).json({
            success: false,
            code: 'RESEND_COOLDOWN',
            retryAfterMs: config.mail.resendCooldownMs - since,
            message: 'Письмо уже отправлено, подождите немного'
        });
    }

    await issueVerification(user);
    res.json(generic);
};

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
//
// Always answers the same way. A route that says "no such address" is an account
// enumerator, and this one is public.

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const generic = {
        success: true,
        message: 'Если аккаунт с таким адресом существует, письмо со ссылкой отправлено'
    };

    if (!email || !validateEmail(email)) {
        return res.json(generic);
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() })
        .select('+resetSentAt');

    // A blocked account gets no reset link: regaining the password would not
    // regain access, and mailing one implies otherwise.
    if (!user || user.blocked) {
        return res.json(generic);
    }

    // Same per-account throttle as the confirmation resend, and for the same
    // reason: the express-rate-limit window is per IP, and an IP is shared.
    const since = user.resetSentAt ? Date.now() - user.resetSentAt.getTime() : Infinity;
    if (since < config.mail.resendCooldownMs) {
        return res.json(generic);
    }

    const { raw, hash } = makeVerifyToken();
    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                resetTokenHash: hash,
                resetTokenExpires: new Date(Date.now() + config.mail.resetTtlMs),
                resetSentAt: new Date()
            }
        }
    );
    await sendPasswordResetEmail({ to: user.email, token: raw });

    res.json(generic);
};

// ── POST /api/auth/reset-password ─────────────────────────────────────────────

export const resetPassword = async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ success: false, message: 'Token and password are required' });
    }

    if (!validatePassword(password)) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ resetTokenHash: hash }).select('+resetTokenExpires');

    if (!user) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Ссылка недействительна или уже использована'
        });
    }

    if (user.resetTokenExpires && user.resetTokenExpires.getTime() < Date.now()) {
        return res.status(400).json({
            success: false,
            code: 'TOKEN_EXPIRED',
            message: 'Срок действия ссылки истёк, запросите новую'
        });
    }

    if (user.blocked) {
        return res.status(403).json({
            success: false,
            message: 'Your account has been blocked'
        });
    }

    const hashedPassword = await hashPassword(password);

    // Reaching the reset link proves control of the mailbox, which is exactly what
    // the confirmation flow asks for. Requiring both would leave an account that
    // registered, never confirmed and forgot its password with no way back in.
    // The token is cleared in the same write, so the link works once.
    await User.updateOne(
        { _id: user._id },
        {
            $set: { password: hashedPassword, emailVerified: true },
            $unset: {
                resetTokenHash: '',
                resetTokenExpires: '',
                verifyTokenHash: '',
                verifyTokenExpires: ''
            }
        }
    );

    const fresh = await User.findById(user._id);
    const authToken = generateToken({ userId: fresh._id, role: fresh.role });

    res.json({
        success: true,
        data: { user: fresh.toJSON(), token: authToken }
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

    // The confirmation gate is checked after the password, not before. Refusing an
    // unconfirmed address to anyone who types it would turn the login form into an
    // address-registration oracle.
    if (awaitsConfirmation(user)) {
        return res.status(403).json({
            success: false,
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Адрес почты не подтверждён'
        });
    }

    const token = generateToken({ userId: user._id, role: user.role });

    res.json({
        success: true,
        data: { user: user.toJSON(), token }
    });
};

export const getMe = async (req, res) => {
    // req.user is populated by strictAuthMiddleware with a fresh DB fetch
    res.json({
        success: true,
        data: req.user
    });
};
