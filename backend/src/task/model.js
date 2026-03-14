// backend/src/task/model.js

import mongoose from 'mongoose';

// userName intentionally excluded — authMiddleware (fast JWT path) only provides
// userId. If you need to display a name, populate userId via User ref at read time.
const verificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Object',
        required: true,
        index: true
    },
    programId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
        default: null,
        index: true
    },
    allocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BudgetAllocation',
        default: null,
        index: true
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
        default: null,
        index: true
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
        rejected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    verifications: [verificationSchema]
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.targetId = ret.targetId?.toString();
            ret.createdBy = ret.createdBy?.toString();
            if (ret.allocationId) ret.allocationId = ret.allocationId.toString();
            if (ret.programId) ret.programId = ret.programId.toString();
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

taskSchema.virtual('totalCount').get(function () {
    return this.verifications?.length ?? 0;
});
taskSchema.virtual('doneCount').get(function () {
    return this.verifications?.filter(v => v.status === 'done').length ?? 0;
});
taskSchema.virtual('problemCount').get(function () {
    return this.verifications?.filter(v => v.status === 'problem').length ?? 0;
});

export default mongoose.model('Task', taskSchema);