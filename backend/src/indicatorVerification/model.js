// backend/src/indicatorVerification/model.js
import mongoose from 'mongoose';

const indicatorVerificationSchema = new mongoose.Schema({
    objectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Object',
        required: true,
        index: true
    },
    // ключ поля из details: 'sportZalHolati', 'aktivZalHolati', etc.
    field: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // confirmed = данные верны, disputed = данные не соответствуют реальности
    status: {
        type: String,
        enum: ['confirmed', 'disputed'],
        required: true
    },
    // звёздный рейтинг 1-5
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    comment: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.objectId = ret.objectId.toString();
            ret.userId = ret.userId.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

indicatorVerificationSchema.index({ objectId: 1, field: 1 });
// Один пользователь — одна верификация на поле объекта
indicatorVerificationSchema.index({ objectId: 1, field: 1, userId: 1 }, { unique: true });

export default mongoose.model('IndicatorVerification', indicatorVerificationSchema);