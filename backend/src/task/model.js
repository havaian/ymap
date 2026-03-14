// backend/src/task/model.js
// A Task is a specific work item promised by a governmental program at an Object
// (school, kindergarten, health post). Citizens verify completion with photos.
// Renamed from Promise to avoid collision with the JS built-in Promise.

import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['done', 'problem'],
        required: true
    },
    comment: {
        type: String
    },
    photoUrl: {
        type: String
    }
}, { timestamps: true, _id: true });

const taskSchema = new mongoose.Schema({
    // ── Links ─────────────────────────────────────────────────────────────────
    // The Object this task belongs to (school / kindergarten / health post)
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Object',
        required: true,
        index: true
    },
    // Optional link to a Program decree — task can be standalone
    programId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
        default: null,
        index: true
    },
    // Optional link to a BudgetAllocation
    allocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BudgetAllocation',
        default: null
    },

    // ── Content ───────────────────────────────────────────────────────────────
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    deadline: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        required: true,
        enum: ['Planned', 'In Progress', 'Pending Verification', 'Completed', 'Failed'],
        default: 'Planned',
        index: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // ── Voting (confirms overall task completion at reviewer level) ───────────
    votes: {
        confirmed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        rejected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },

    // ── Citizen verifications (done ✓ / problem ✗ with optional photo) ────────
    verifications: [verificationSchema]
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.targetId = ret.targetId?.toString();
            ret.programId = ret.programId?.toString() || null;
            ret.allocationId = ret.allocationId?.toString() || null;
            ret.createdBy = ret.createdBy?.toString();
            ret.votes = {
                confirmed: (ret.votes?.confirmed || []).map(id => id.toString()),
                rejected: (ret.votes?.rejected || []).map(id => id.toString())
            };
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Virtual counts — used by citizen-facing task cards
taskSchema.virtual('totalCount').get(function () {
    return this.verifications?.length ?? 0;
});
taskSchema.virtual('doneCount').get(function () {
    return this.verifications?.filter(v => v.status === 'done').length ?? 0;
});
taskSchema.virtual('problemCount').get(function () {
    return this.verifications?.filter(v => v.status === 'problem').length ?? 0;
});

taskSchema.index({ targetId: 1, status: 1 });
taskSchema.index({ programId: 1, status: 1 });
taskSchema.index({ allocationId: 1 });
taskSchema.index({ deadline: 1 });

export default mongoose.model('Task', taskSchema);