import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Roads', 'Water & Sewage', 'Electricity', 'Schools & Kindergartens', 'Hospitals & Clinics', 'Waste Management', 'Other']
    },
    subCategory: {
        type: String,
        enum: ['Water', 'Electricity', 'General/Other']
    },
    severity: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High', 'Critical']
    },
    status: {
        type: String,
        required: true,
        enum: ['Open', 'In Progress', 'Resolved'],
        default: 'Open'
    },
    votes: {
        type: Number,
        default: 0
    },
    aiSummary: {
        type: String
    },
    organizationId: {
        type: String
    },
    organizationName: {
        type: String
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    images: [{
        type: String
    }],
    isSeeded: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.createdAt = new Date(ret.createdAt).getTime();
            delete ret._id;
            delete ret.__v;
            delete ret.location;
            delete ret.userId;
            delete ret.updatedAt;
            delete ret.isSeeded;
            return ret;
        }
    }
});

issueSchema.index({ location: '2dsphere' });
issueSchema.index({ status: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ createdAt: -1 });

export default mongoose.model('Issue', issueSchema);