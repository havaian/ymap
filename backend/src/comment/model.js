import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    issueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Issue',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    author: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            ret.id = ret._id.toString();
            ret.timestamp = new Date(ret.createdAt).getTime();
            delete ret._id;
            delete ret.__v;
            delete ret.userId;
            delete ret.issueId;
            delete ret.createdAt;
            delete ret.updatedAt;
            return ret;
        }
    }
});

commentSchema.index({ issueId: 1, createdAt: -1 });

export default mongoose.model('Comment', commentSchema);