import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
    externalId: {
        type: Number,
        index: true  // Simple index for fast lookups
    },
    projectId: {
        type: Number
    },
    objectId: {
        type: Number
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Schools & Kindergartens', 'Hospitals & Clinics'],
        index: true  // For type filtering
    },
    objectType: {
        type: String
    },
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
            required: true,
            index: '2dsphere'  // Geospatial index
        }
    },
    address: {
        type: String,
        required: true
    },
    region: {
        id: Number,
        name: { type: String, index: true }  // For region filtering
    },
    year: {
        type: Number
    },
    sector: {
        type: String
    },
    sourceType: {
        type: String
    },
    sourceName: {
        type: String
    },
    status: {
        type: String
    },
    budget: {
        committedUZS: Number,
        spentUZS: Number,
        committedUSD: Number,
        spentUSD: Number
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            delete ret.location;
            return ret;
        }
    }
});

export default mongoose.model('Organization', organizationSchema);