// backend/src/program/model.js
// Represents a governmental decree or program that targets a set of objects
// with a list of tasks (repairs, purchases, installations) to be completed.

import mongoose from 'mongoose';

const programSchema = new mongoose.Schema({
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Official decree / resolution number
    number: {
        type: String,
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
        enum: ['active', 'completed', 'cancelled'],
        default: 'active',
        index: true
    },

    // ── Budget ────────────────────────────────────────────────────────────────
    totalBudget: {
        type: Number,
        default: null
    },
    currency: {
        type: String,
        enum: ['UZS', 'USD'],
        default: 'UZS'
    },

    // ── Scope — determines which objects are auto-assigned ────────────────────
    // All filters are optional; empty = match everything of that dimension.
    scope: {
        // Which object types to include. Empty array = all types.
        objectTypes: {
            type: [String],
            enum: ['health_post', 'kindergarten', 'school'],
            default: []
        },
        // Restrict to a specific region (by regionCode). Null = all regions.
        regionCode: {
            type: Number,
            default: null
        },
        // Restrict to a specific district. Null = all districts within region.
        districtId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'District',
            default: null
        }
    },

    // ── Resolved object list ──────────────────────────────────────────────────
    // Populated by POST /api/programs/:id/assign-objects.
    // Can also have objects added / removed manually.
    objectIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Object'
    }],

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
            ret.createdBy = ret.createdBy?.toString?.() || ret.createdBy;
            if (ret.scope?.districtId) ret.scope.districtId = ret.scope.districtId.toString();
            ret.objectIds = (ret.objectIds || []).map(id => id.toString());
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

programSchema.index({ status: 1 });
programSchema.index({ 'scope.regionCode': 1 });

export default mongoose.model('Program', programSchema);