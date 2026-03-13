import mongoose from 'mongoose';

// Each citizen verification on a promise (done ✓ or problem ✗)
const verificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    // 'done' = citizen confirms it was completed, 'problem' = still broken
    status: { type: String, enum: ['done', 'problem'], required: true },
    comment: { type: String, default: '' },
    // Populated after photo upload — stores the path relative to uploads root
    photoUrl: { type: String, default: null }
}, { _id: true, timestamps: { createdAt: 'createdAt', updatedAt: false } });

// A government commitment/promise attached to an organization
const promiseSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    verifications: [verificationSchema]
}, { timestamps: true });

export default mongoose.model('Promise', promiseSchema);