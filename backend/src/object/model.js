// backend/src/object/model.js
// Unified facility/infrastructure object — sourced from duasr.uz APIs (ssv, bogcha, maktab44).

import mongoose from 'mongoose';

const objectSchema = new mongoose.Schema({
    // ── Source identity ───────────────────────────────────────────────────────
    // uid is the _uid_ from the source API (row sequence number, not globally unique)
    uid: {
        type: Number
    },
    // inn is the tax ID — used as primary upsert key together with code + sourceApi
    inn: {
        type: String,
        index: true
    },
    // code is the geographic unit code assigned by the ministry
    code: {
        type: Number,
        index: true
    },
    // parentCode is the district-level code
    parentCode: {
        type: Number,
        index: true
    },
    // which endpoint this record came from
    sourceApi: {
        type: String,
        required: true,
        enum: ['ssv', 'bogcha', 'maktab44'],
        index: true
    },
    // human-readable type label derived from sourceApi
    objectType: {
        type: String,
        required: true,
        enum: ['health_post', 'kindergarten', 'school'],
        index: true
    },

    // ── Names ─────────────────────────────────────────────────────────────────
    name: {
        type: String,
        required: true
    },
    nameRu: {
        type: String  // obekt_nomi_ru — only present in maktab44
    },
    nameEn: {
        type: String  // obekt_nomi_en — only present in maktab44
    },

    // ── Location ──────────────────────────────────────────────────────────────
    // viloyat / tuman are the Uzbek names from the source API
    viloyat: {
        type: String,
        index: true
    },
    tuman: {
        type: String
    },
    // regionCode matched from district collection via parentCode
    regionCode: {
        type: Number,
        index: true
    },
    districtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        index: true
    },
    // lat/lng set at sync time by jittering the matched district centroid
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
            type: [Number],  // [lng, lat]
            required: true
        }
    },

    // ── Condition details (vary per sourceApi) ────────────────────────────────
    details: {
        // Wall material — all three APIs
        materialSten: String,
        // Electricity — all three
        elektrKunDavomida: String,
        // Drinking water source — all three
        ichimlikSuviManbaa: String,
        // Internet type — bogcha / maktab44 use 'internetgaUlanishTuri'; ssv uses 'internet'
        internet: String,
        // Water inside building — ssv only
        binoIchidaSuv: String,
        // Last capital repair year — all three
        kapitalTamir: String,
        // Construction year — all three
        qurilishYili: String,
        // Capacity (seats/beds)
        sigimi: Number,
        // Total students/patients
        umumiyUquvchi: Number,
        // Number of shifts — maktab44 only
        smena: String,
        // Sports hall condition — maktab44 only
        sportZalHolati: String,
        // Activity hall condition — maktab44 + bogcha
        aktivZalHolati: String,
        // Canteen condition — maktab44 + bogcha
        oshhonaHolati: String
    },

    // ── Sync metadata ─────────────────────────────────────────────────────────
    // 'updated' field from source API
    sourceUpdatedAt: {
        type: Date
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
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

objectSchema.index({ location: '2dsphere' });
// Compound unique index — ensures no duplicate per source record across re-syncs
objectSchema.index({ inn: 1, code: 1, sourceApi: 1 }, { unique: true, sparse: true });

export default mongoose.model('Object', objectSchema);