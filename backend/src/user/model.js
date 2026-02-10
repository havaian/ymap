// backend/src/user/model.js
// UPDATE the role enum to include ORG_ADMIN

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
    role: {
        type: String,
        enum: ['ADMIN', 'ORG_ADMIN', 'CITIZEN'],
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
    organizationId: {
        type: String
    },
    organizationName: {
        type: String
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

// REMOVE THIS LINE - it creates duplicate index
// userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);