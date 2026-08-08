import mongoose from 'mongoose';

const regionSchema = new mongoose.Schema({
    // Official regioncode from crop.agro.uz API (10-23 range)
    code: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    // API internal id (separate from regioncode)
    apiId: {
        type: Number,
        index: true
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
    // Render copy. Same reason as District.geometrySimplified: the outline drawn
    // around a selected region is read at a zoom where whole viloyats fit on
    // screen, and source resolution there costs frames for detail nobody can see.
    //
    // This field was missing while simplify-boundaries.js already wrote to it.
    // Mongoose strips unknown paths from an update under the default strict mode,
    // so the region half of that script reported success and stored nothing.
    //
    // No 2dsphere index, deliberately: a simplified ring can self-intersect and
    // the index would reject the whole document.
    geometrySimplified: {
        type: {
            type: String,
            enum: ['MultiPolygon', 'Polygon']
        },
        coordinates: {
            type: mongoose.Schema.Types.Mixed
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

regionSchema.index({ geometry: '2dsphere' });
regionSchema.index({ centroid: '2dsphere' });

export default mongoose.model('Region', regionSchema);