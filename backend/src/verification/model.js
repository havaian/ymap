// backend/src/verification/model.js
//
// What the verification queue actually served, and by which mechanism.
//
// This collection exists for one reason. The queue ranks facilities by a rules
// score, so the records people are asked about are not a random sample of the
// register. If the learned version of the priority model is later fitted on
// submitted verifications, that ranking becomes the selection rule and the
// training set inherits it: the model would learn which records the old rules
// picked, not which records are wrong.
//
// The fix is to serve part of the queue uniformly at random and to record which
// slot each served item came from. A random slot is only useful if it can still be
// identified afterwards, and it cannot be recomputed later because the draw is not
// reproducible. So it is written down at serve time.
//
// This has to be in place from the first day the queue is shown to anyone.
// Verifications collected before it exists cannot be reweighted afterwards and are
// not usable as training data.

import mongoose from 'mongoose';

const verificationAssignmentSchema = new mongoose.Schema({
    objectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Object',
        required: true,
        index: true
    },
    // Key from Object.details, matching IndicatorVerification.field.
    field: {
        type: String,
        required: true,
        index: true
    },
    // 'targeted' came from the rules ranking, 'random' from the uniform draw.
    // The inclusion probability of a targeted item is unknown; of a random item it
    // is the random share divided by the number of eligible candidates, which is
    // recorded below so the weight can be reconstructed exactly.
    selection: {
        type: String,
        required: true,
        enum: ['targeted', 'random'],
        index: true
    },
    // Score and its parts at the moment of serving. Kept because the rules change
    // and a later re-run would not reproduce the number that actually drove this
    // assignment.
    priorityScore: { type: Number, default: null },
    components: {
        staleness: { type: Number, default: null },
        contradiction: { type: Number, default: null },
        emptiness: { type: Number, default: null },
        neighbourDeviation: { type: Number, default: null }
    },
    reasons: { type: [String], default: [] },

    // Denominator of the random draw at serve time.
    eligibleCandidates: { type: Number, default: null },
    randomShare: { type: Number, default: null },

    // Null when the queue was requested without an identified user.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    servedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    sourceApi: { type: String, default: null, index: true },
    districtCode: { type: String, default: null, index: true },
    regionCode: { type: Number, default: null, index: true }
}, { timestamps: true });

verificationAssignmentSchema.index({ servedAt: -1, selection: 1 });
verificationAssignmentSchema.index({ objectId: 1, field: 1, servedAt: -1 });

export default mongoose.model('VerificationAssignment', verificationAssignmentSchema);
