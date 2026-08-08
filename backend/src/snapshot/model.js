// backend/src/snapshot/model.js
//
// The archive of registry states over time. This is the asset the project is
// built around: the portals publish the current state of a register and nobody
// keeps the history, so it cannot be reconstructed after the fact. Every week
// without a snapshot is a week of history that is gone.
//
// Two collections and one directory:
//
//   data/snapshots/<source>/<timestamp>.json.gz   the raw payload, never rewritten
//   Snapshot                                       manifest: what was captured, when,
//                                                   how many rows, and its digest
//   RegistryChange                                 what moved between two snapshots
//
// The files are the archive. The collections are an index over it, and both can be
// rebuilt from the files alone. Nothing here parses or normalises before storing:
// a snapshot is the bytes the source returned, so that a later correction to the
// import logic can be applied retroactively to the whole history.

import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
    sourceApi: {
        type: String,
        required: true,
        enum: ['ssv', 'bogcha', 'maktab44'],
        index: true
    },
    // When the payload was captured from the source. For files placed by hand this
    // is the file's modification time or an explicit --as-of, and provenance says
    // so: the true fetch date of the three seed files is not known and must not be
    // presented as if it were.
    takenAt: {
        type: Date,
        required: true,
        index: true
    },
    provenance: {
        type: String,
        enum: ['harvester', 'manual_upload'],
        required: true
    },
    // Path relative to the data directory.
    file: {
        type: String,
        required: true
    },
    recordCount: {
        type: Number,
        required: true
    },
    // sha256 of the uncompressed bytes. Two snapshots with the same digest hold the
    // same payload, which is how a re-run that fetched nothing new is recognised
    // without decompressing anything.
    sha256: {
        type: String,
        required: true,
        index: true
    },
    bytesRaw: Number,
    bytesStored: Number,
    note: String
}, { timestamps: true });

// One capture per source per digest. A repeat fetch that returned identical bytes
// is not a new state of the register and does not belong in the timeline.
snapshotSchema.index({ sourceApi: 1, sha256: 1 }, { unique: true });
snapshotSchema.index({ sourceApi: 1, takenAt: -1 });

const registryChangeSchema = new mongoose.Schema({
    sourceApi: {
        type: String,
        required: true,
        enum: ['ssv', 'bogcha', 'maktab44'],
        index: true
    },
    // The source `id` field. Verified unique and fully populated in all three
    // registries, unlike `_uid_` which is a row number and shifts between fetches.
    sourceId: {
        type: Number,
        required: true,
        index: true
    },
    kind: {
        type: String,
        required: true,
        enum: ['added', 'removed', 'changed'],
        index: true
    },
    // Null for added and removed.
    field: {
        type: String,
        default: null,
        index: true
    },
    // Stored as strings so a categorical field and a numeric one keep the same
    // shape. The typed reading belongs to whatever model consumes the change.
    from: { type: String, default: null },
    to: { type: String, default: null },

    fromSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot', default: null },
    toSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot', required: true },

    // The change happened at some point inside this window and the archive cannot
    // narrow it further. This is exactly the interval-censored form a multi-state
    // survival model needs, and it is why the wear model version 2 cannot be bought
    // with money or compute, only with elapsed time.
    observedFrom: { type: Date, default: null },
    observedTo: { type: Date, required: true, index: true },

    // Denormalised so the change log can be sliced by geography without a join.
    districtCode: { type: String, default: null, index: true },
    regionCode: { type: Number, default: null, index: true }
}, { timestamps: true });

registryChangeSchema.index({ sourceApi: 1, sourceId: 1, field: 1, toSnapshot: 1 }, { unique: true });
registryChangeSchema.index({ sourceApi: 1, field: 1, observedTo: -1 });

export const Snapshot = mongoose.model('Snapshot', snapshotSchema);
export const RegistryChange = mongoose.model('RegistryChange', registryChangeSchema);
