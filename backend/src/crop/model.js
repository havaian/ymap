import mongoose from 'mongoose';

const cropTypeSchema = new mongoose.Schema({
    // API id from crop.agro.uz
    apiId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    name: {
        uz: { type: String, required: true },
        en: { type: String },
        ru: { type: String }
    },
    color: {
        type: String  // hex color from API, e.g. "#fbfb79"
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

export default mongoose.model('CropType', cropTypeSchema);