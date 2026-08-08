// backend/src/user/model.js

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    // Two roles only: ADMIN (government operator) and CITIZEN (public user)
    role: {
        type: String,
        enum: ['ADMIN', 'CITIZEN'],
        default: 'CITIZEN'
    },
    avatar: {
        type: String
    },
    district: {
        type: String
    },
    blocked: {
        type: Boolean,
        default: false
    },
    // Email confirmation. Accounts created by bootstrap (admin, demo citizens) and
    // by the seeder are written with emailVerified: true, so the confirmation gate
    // only applies to self-registration through /api/auth/register.
    emailVerified: {
        type: Boolean,
        default: false
    },
    // Only the hash is stored. The raw token lives in the link that was mailed and
    // nowhere else, so a database read cannot be turned into an account takeover.
    verifyTokenHash: {
        type: String,
        select: false
    },
    verifyTokenExpires: {
        type: Date,
        select: false
    },
    // Throttles resend independently of the express-rate-limit window, which is
    // per-IP and therefore shared by everyone behind one NAT.
    verifySentAt: {
        type: Date,
        select: false
    },
    // Password reset. Same shape and the same reasoning as the confirmation
    // fields above: only the hash is stored, and the raw token exists solely in
    // the link that was mailed. Kept as a separate triple rather than reusing the
    // verify one, because a live reset request must not silently confirm an
    // address, and an outstanding confirmation must not double as a password
    // reset.
    resetTokenHash: {
        type: String,
        select: false
    },
    resetTokenExpires: {
        type: Date,
        select: false
    },
    resetSentAt: {
        type: Date,
        select: false
    },
    isSeeded: {
        type: Boolean,
        default: false
    },
    points: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            delete ret.password;
            return ret;
        }
    }
});

export default mongoose.model('User', userSchema);