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
    isSeeded: {
        type: Boolean,
        default: false
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