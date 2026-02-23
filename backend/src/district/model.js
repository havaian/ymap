import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema({
    // Official regioncode from crop.agro.uz API
    regionCode: {
        type: Number,
        required: true,
        index: true
    },
    // API internal id for this district
    apiId: {
        type: Number,
        unique: true,
        index: true
    },
    // Cadastral number, e.g. "17:10"
    cadNum: {
        type: String
    },
    name: {
        en: { type: String, required: true },
        ru: { type: String },
        uz: { type: String, required: true }
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
    },
    // Crop types available in this district (from /api/plants/{id})
    crops: [{
        apiId: Number,
        name: String,   // UZ name from API
        color: String   // hex color
    }]
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