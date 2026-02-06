import mongoose from 'mongoose';

const infrastructureSchema = new mongoose.Schema({
    externalId: {
        type: Number
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
        enum: ['Roads', 'Water & Sewage']
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
            required: true
        }
    },
    address: {
        type: String
    },
    region: {
        id: Number,
        name: String
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
    timestamps: true
});

infrastructureSchema.index({ location: '2dsphere' });
infrastructureSchema.index({ type: 1 });
infrastructureSchema.index({ 'region.name': 1 });

export default mongoose.model('Infrastructure', infrastructureSchema);