/**
 * backend/src/analytics/scales.js
 *
 * Ordinal scales for the categorical condition fields, in one place. Every model
 * that reads a condition field reads it through here, so a rescoring is a change
 * to this file and nothing else.
 *
 * Source-aware on purpose. The three registries do not share a vocabulary for the
 * same concept, and the shortened names used in the planning document match only
 * two of the three. Observed value sets:
 *
 *   drinking water
 *     maktab44, bogcha: ichimlik_suvi_yuq | ichimlik_suvi_manbaa_olib_kelinadi |
 *                       ichimlik_suvi_manbaa_lokal | ichimlik_suvi_manbaa_markaz
 *     ssv:              yuq | avtosisterna | qadoqlangan_suv | yer_osti_suvi |
 *                       vodoprovod_suvi
 *
 *   internet
 *     maktab44, bogcha: umuman_yuq | internet_mobil | internet_optika
 *     ssv:              yuq | shaxsiy | shisha_tola
 *
 * The ssv water vocabulary carries a distinction the other two do not: bottled
 * water and a tanker are both delivery, groundwater is a local source, mains is
 * central. They are folded onto the same 0-3 ladder so a district mixing schools
 * and health posts can still be scored on one axis.
 *
 * Two orderings are judgement calls and are recorded as such:
 *   - aktiv_zal_bor_mebel_yuq below aktiv_zal_qisman_tamir. A hall that exists but
 *     is unfurnished is treated as worse than one under partial repair.
 *   - qadoqlangan_suv equal to avtosisterna. Both are water brought in from
 *     outside; the registry gives no volume or frequency to separate them.
 * Changing either requires recomputing every published figure that used it.
 */

// ── Ordinal ladders ──────────────────────────────────────────────────────────
// Higher is better. `null` means the field was empty or held an unknown token,
// which is never silently turned into a zero.

const WATER = {
    default: {
        ichimlik_suvi_yuq: 0,
        ichimlik_suvi_manbaa_olib_kelinadi: 1,
        ichimlik_suvi_manbaa_lokal: 2,
        ichimlik_suvi_manbaa_markaz: 3
    },
    ssv: {
        yuq: 0,
        avtosisterna: 1,
        qadoqlangan_suv: 1,
        yer_osti_suvi: 2,
        vodoprovod_suvi: 3
    }
};

const ELECTRICITY = {
    default: {
        elektr_yuq: 0,
        elektr_qisman: 1,
        elektr_bor: 2
    }
};

const INTERNET = {
    default: {
        umuman_yuq: 0,
        internet_mobil: 1,
        internet_optika: 2
    },
    ssv: {
        yuq: 0,
        shaxsiy: 1,
        shisha_tola: 2
    }
};

const SPORT_HALL = {
    default: {
        sport_zal_umuman_yuq: 0,
        sport_zal_qisman_tamir: 1,
        sport_zal_qoniqarli: 2
    }
};

const ACTIVITY_HALL = {
    default: {
        aktiv_zal_umuman_yuq: 0,
        aktiv_zal_bor_mebel_yuq: 1,
        aktiv_zal_qisman_tamir: 2,
        aktiv_zal_qoniqarli: 3
    }
};

const CANTEEN = {
    default: {
        oshhona_umuman_yuq: 0,
        oshhona_bor_ishlamaydi: 1,
        oshhona_holati_qisman_tamir: 2,
        oshhona_holati_qoniqarli: 3
    }
};

// ssv only. Plumbing present and water running is the top of this ladder; a pipe
// with no water is still better than no pipe, because restoring supply is
// cheaper than laying a line.
const INDOOR_WATER = {
    default: {
        quvur_yuq_suv_yuq: 0,
        quvur_bor_suv_yuq: 1,
        kran_orqali: 2
    }
};

// ssv stores a repair category where the other two store a year. It is ordinal in
// its own right: no repair at all is the bottom, a reconstruction the top.
const REPAIR_STATUS = {
    default: {
        yuq_remont: 0,
        ha_joriy: 1,
        ha_kapital: 2,
        ha_rekon: 3
    }
};

export const SCALES = {
    water: WATER,
    electricity: ELECTRICITY,
    internet: INTERNET,
    sportHall: SPORT_HALL,
    activityHall: ACTIVITY_HALL,
    canteen: CANTEEN,
    indoorWater: INDOOR_WATER,
    repairStatus: REPAIR_STATUS
};

// Which detail field on the Object document each concept reads.
export const FIELD_OF = {
    water: 'ichimlikSuviManbaa',
    electricity: 'elektrKunDavomida',
    internet: 'internet',
    sportHall: 'sportZalHolati',
    activityHall: 'aktivZalHolati',
    canteen: 'oshhonaHolati',
    indoorWater: 'binoIchidaSuv',
    repairStatus: 'repairStatus'
};

function ladder(concept, sourceApi) {
    const s = SCALES[concept];
    if (!s) return null;
    return s[sourceApi] || s.default;
}

/**
 * Ordinal score of one concept for one object. Returns null when the field is
 * empty or holds a token outside the observed vocabulary - an unknown token is a
 * data quality event, not a zero.
 */
export function score(concept, sourceApi, rawValue) {
    const l = ladder(concept, sourceApi);
    if (!l) return null;
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const v = l[String(rawValue)];
    return v === undefined ? null : v;
}

/** Top of the ladder for this concept and source. Used for normalising to 0-1. */
export function maxScore(concept, sourceApi) {
    const l = ladder(concept, sourceApi);
    if (!l) return null;
    return Math.max(...Object.values(l));
}

/** True when the raw value is non-empty but not in the ladder. */
export function isUnknownToken(concept, sourceApi, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') return false;
    const l = ladder(concept, sourceApi);
    return !!l && l[String(rawValue)] === undefined;
}

/**
 * Reads a concept straight off an Object document, picking the right field and
 * the right ladder for its source.
 */
export function scoreObject(obj, concept) {
    const field = FIELD_OF[concept];
    if (!field) return null;
    return score(concept, obj.sourceApi, obj.details?.[field]);
}

// ── Wall material ────────────────────────────────────────────────────────────
// Not a quality ladder. A relative structural risk multiplier for the wear model,
// with adobe singled out: 43 school buildings in the sample, median age 42, in a
// seismic country. The numbers are provisional and belong in configuration the
// moment a published normative is available.

export const MATERIAL_RISK = {
    beton: 1.0,
    gisht: 1.15,
    tosh: 1.15,
    paxsa: 1.6
};

export function materialRisk(materialSten) {
    if (!materialSten) return null;
    return MATERIAL_RISK[String(materialSten)] ?? null;
}

// ── Building age ─────────────────────────────────────────────────────────────

// qurilish_yili in ssv is a placeholder: 341 of 344 filled values are 2005. Any
// age computed from it would be an artefact of the loader, so ssv is excluded
// from age arithmetic entirely rather than carrying a silently wrong number.
export const AGE_UNUSABLE_SOURCES = new Set(['ssv']);

const MIN_YEAR = 1850;

function yearOf(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < MIN_YEAR || n > new Date().getFullYear()) return null;
    return n;
}

/**
 * Effective age in years, plus whether it is certain.
 *
 * Certain when a capital repair year is recorded, or when the building is new
 * enough that a missing repair record cannot change the answer.
 *
 * Uncertain when no repair year is recorded. Then the age is not imputed: the
 * caller gets the no-repair figure and the flag, and decides both bounds. 27.1 %
 * of schools and 31.3 % of kindergartens land here, and the gap between the two
 * bounds is the single largest source of spread in the wear model. It closes with
 * one field in the registry, not with a better estimator.
 */
export function effectiveAge(obj, asOfYear = new Date().getFullYear()) {
    if (AGE_UNUSABLE_SOURCES.has(obj.sourceApi)) {
        return { age: null, certain: false, reason: 'source_year_placeholder' };
    }
    const build = yearOf(obj.details?.qurilishYili);
    if (build === null) return { age: null, certain: false, reason: 'build_year_missing' };

    const repair = obj.details?.lastCapitalRepairYear ?? null;
    if (repair && repair >= build) {
        return { age: asOfYear - repair, certain: true, reason: 'repair_recorded' };
    }
    return { age: asOfYear - build, certain: false, reason: 'repair_missing' };
}

// ── Load ─────────────────────────────────────────────────────────────────────
// State is the pair (loadFactor, shifts), never one number. A school at capacity
// running two shifts is not the same building as a school at capacity running one.

export const LOAD_CLASSES = [
    'normal',            // L <= 1.0, one shift
    'hidden_overload',   // L <= 1.0, two or more shifts - usually a data error
    'acute',             // L > 1.0, one shift
    'chronic',           // L > 1.0, two or more shifts
    'critical'           // L > 1.5, two or more shifts
];

export function loadClass(loadFactor, smena) {
    if (loadFactor === null || loadFactor === undefined) return null;
    // smena is stored as a string on the document and arrives as a number from
    // the importer; both are accepted.
    const shifts = parseInt(smena, 10);
    if (isNaN(shifts)) return null;

    if (loadFactor <= 1.0) return shifts >= 2 ? 'hidden_overload' : 'normal';
    if (shifts < 2) return 'acute';
    return loadFactor > 1.5 ? 'critical' : 'chronic';
}
