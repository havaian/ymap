// backend/src/promise/model.js — UPDATED: added verifications embedded array + virtuals
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

const promiseSchema = new mongoose.Schema({
    targetType: {
        type: String,
        required: true,
        enum: ['organization', 'infrastructure'],
        index: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    // Optional link to a BudgetAllocation — promise can exist without one
    allocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BudgetAllocation',
        default: null
    },
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
    votes: {
        confirmed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        rejected:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    // Citizen verifications — each user submits done/problem with optional photo+comment
    verifications: [verificationSchema]
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.targetId  = ret.targetId.toString();
            ret.createdBy = ret.createdBy.toString();
            if (ret.allocationId) ret.allocationId = ret.allocationId.toString();
            ret.votes = {
                confirmed: (ret.votes?.confirmed || []).map(id => id.toString()),
                rejected:  (ret.votes?.rejected  || []).map(id => id.toString())
            };
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Virtual counts — used by citizen-facing PromisesSection
promiseSchema.virtual('totalCount').get(function () {
    return this.verifications?.length ?? 0;
});
promiseSchema.virtual('doneCount').get(function () {
    return this.verifications?.filter(v => v.status === 'done').length ?? 0;
});
promiseSchema.virtual('problemCount').get(function () {
    return this.verifications?.filter(v => v.status === 'problem').length ?? 0;
});

promiseSchema.index({ targetType: 1, targetId: 1 });
promiseSchema.index({ status: 1 });
promiseSchema.index({ allocationId: 1 });
promiseSchema.index({ deadline: 1 });

export default mongoose.model('Promise', promiseSchema);