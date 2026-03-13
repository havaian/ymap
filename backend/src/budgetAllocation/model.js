// backend/src/budgetAllocation/model.js
import mongoose from 'mongoose';

const budgetAllocationSchema = new mongoose.Schema({
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
    amount: {
        type: Number
    },
    currency: {
        type: String,
        enum: ['UZS', 'USD'],
        default: 'UZS'
    },
    // Loose period label — e.g. "Q1 2025", "2024", "Jan–Mar 2025"
    period: {
        type: String
    },
    // Broad description of what this spending covers
    note: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.targetId = ret.targetId.toString();
            ret.createdBy = ret.createdBy.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

budgetAllocationSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.model('BudgetAllocation', budgetAllocationSchema);