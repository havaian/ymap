import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema({
    regionCode: {
        type: Number,
        required: true,
        index: true
    },
    name: {
        en: { type: String, required: true },
        ru: { type: String },
        uz: { type: String }
    },
    // Merged from .js source when available
    shapeID: {
        type: String
    },
    geometry: {
        type: {
            type: String,
            enum: ['MultiPolygon', 'Polygon'],
            required: true
        },
        coordinates: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        }
    },
    centroid: {
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
    areaKm2: {
        type: Number
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

districtSchema.index({ geometry: '2dsphere' });
districtSchema.index({ centroid: '2dsphere' });
districtSchema.index({ regionCode: 1, 'name.en': 1 });

export default mongoose.model('District', districtSchema);