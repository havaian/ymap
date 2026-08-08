// backend/src/object/model.js
// Unified facility/infrastructure object — sourced from duasr.uz APIs (ssv, bogcha, maktab44).

import mongoose from 'mongoose';

const objectSchema = new mongoose.Schema({
    // ── Source identity ───────────────────────────────────────────────────────
    // uid is the _uid_ from the source API (row sequence number, not globally unique)
    uid: {
        type: Number
    },
    // sourceId is the `id` field from the source API. Verified unique and fully
    // populated in all three sources (400/400, 400/400, 1411/1411), unlike `_uid_`
    // which is a row sequence number that shifts between fetches. This is the
    // upsert key together with sourceApi.
    sourceId: {
        type: Number,
        index: true
    },
    // inn is the tax ID — used as primary upsert key together with code + sourceApi
    // CORRECTION: inn is NOT unique and cannot serve as a key. ssv holds 392 records
    // under 166 tax ids because rural health posts share one legal entity; maktab44
    // has 71 duplicates. It stays as an attribute and as the join key to the
    // data.egov.uz preschool registry, where it is unique on the bogcha side.
    inn: {
        type: String,
        index: true
    },
    // code is the geographic unit code assigned by the ministry
    // CORRECTION: verified against ssv/bogcha/maktab44 — `code` is the 7-digit
    // SOATO district code (17 + region(2) + district(3)). It is consistent across
    // all three sources: 1703203 is Andijon tumani in maktab44 and Андижон т. in
    // bogcha. This is the district join key, `tuman` is display text only.
    code: {
        type: Number,
        index: true
    },
    // parentCode is the district-level code
    // CORRECTION: parentCode is the REGION code, not the district. Only 14 distinct
    // values exist across all three sources, one per region, and it always equals
    // the first four digits of `code`.
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
    // Physical nature of the facility. Family kindergartens (Turi = 'Oilaviy' in the
    // data.egov.uz registry, 24927 of 27162 non-state preschools) operate inside a
    // flat or a private house: they have no construction year, no wall material and
    // no design capacity in the sense the condition models assume. They belong in
    // the accessibility model as service points and must stay out of the wear and
    // capacity models. Default is 'building' because everything sourced from duasr.uz
    // is a standalone facility.
    objectClass: {
        type: String,
        enum: ['building', 'home_based'],
        default: 'building',
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
    // CHANGED: jitter removed. Coordinates are now either real or absent. A record
    // with no known position keeps lat/lng null and is rendered through the district
    // choropleth instead of a point, so the map never claims precision it lacks.
    lat: {
        type: Number,
        default: null
    },
    lng: {
        type: Number,
        default: null
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number]  // [lng, lat] — left undefined when no real coordinate is known
        }
    },
    // Where the coordinate came from. 'egov_inn' means it was joined from the
    // data.egov.uz preschool registry on the tax id.
    coordSource: {
        type: String,
        enum: ['egov_inn', 'osm', 'field_verified', 'manual', 'district_centroid', 'none'],
        default: 'none',
        index: true
    },
    coordPrecision: {
        type: String,
        enum: ['exact', 'approximate', 'none'],
        default: 'none',
        index: true
    },
    // True when this exact coordinate is shared by other objects in the source.
    // In the non-state preschool registry 640 coordinates carry 1441 objects, one of
    // them 30 at once — a single map click copied across many records. Technically
    // valid, factually unknown, so it must not be treated as a surveyed position.
    coordShared: {
        type: Boolean,
        default: false,
        index: true
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
        // NOTE: the field carries two different meanings depending on the source.
        // bogcha and maktab44 store a year ("2018"). ssv stores a category:
        // ha_kapital, ha_joriy, ha_rekon, yuq_remont. Keep the raw value here and
        // read the parsed ones below.
        kapitalTamir: String,
        // Parsed numeric year, bogcha and maktab44 only. Null when absent or invalid.
        lastCapitalRepairYear: Number,
        // Parsed category, ssv only.
        repairStatus: {
            type: String,
            enum: ['ha_kapital', 'ha_joriy', 'ha_rekon', 'yuq_remont', null],
            default: null
        },
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

    // ── Derived / quality ─────────────────────────────────────────────────────
    // umumiyUquvchi / sigimi. Denormalised so the map and analytics can filter and
    // sort without recomputing. Null when either input is missing or capacity is 0.
    loadFactor: {
        type: Number,
        default: null,
        index: true
    },
    // Non-fatal issues detected at import time. Kept on the document so the data
    // quality report can be produced from the collection itself.
    // Values: code_length, code_missing, code_unknown, district_name_mismatch,
    //         parent_code_mismatch, capacity_zero, enrolment_zero,
    //         repair_before_build, load_implausible
    qualityFlags: {
        type: [String],
        default: []
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

// Sparse because a record with no known coordinate leaves location.coordinates
// undefined; a non-sparse 2dsphere index would reject those documents.
objectSchema.index({ location: '2dsphere' }, { sparse: true });
// Compound unique index — ensures no duplicate per source record across re-syncs
// REPLACED. The previous key was { inn, code, sourceApi }. It cannot hold: inn
// repeats within a source and code is the district code shared by every object in
// that district, so the pair collapses unrelated facilities into one document.
// objectSchema.index({ inn: 1, code: 1, sourceApi: 1 }, { unique: true, sparse: true });
objectSchema.index({ sourceId: 1, sourceApi: 1 }, { unique: true });

export default mongoose.model('Object', objectSchema);