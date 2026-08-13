/**
 * backend/src/analytics/deprivation-core.js
 *
 * Метод Алкире-Фостера: измерения, пороги и сам счёт. Ни базы, ни моделей, ни
 * express - только арифметика над записями реестра.
 *
 * ВЫДЕЛЕНО ИЗ deprivation.js. Тот модуль подключает модели объекта и района, а
 * они тянут mongoose. Из-за этого verify-deprivation.js, который пересчитывает
 * индекс прямо по трём файлам и в базу не ходит вообще, всё равно требовал
 * установленных пакетов и падал трассировкой на чистом клоне репозитория. При
 * этом его смысл ровно в том, чтобы методику мог воспроизвести любой, у кого есть
 * репозиторий и Node.
 *
 * Граница проведена по зависимостям: здесь то, что считается из значений полей,
 * там - то, что эти значения достаёт и отдаёт наружу. Единственный внешний
 * импорт - scales.js, он сам ни от чего не зависит.
 */

import { scoreObject, effectiveAge, loadClass } from './scales.js';

const DEFAULT_BUILDING_AGE_CUTOFF = 30;

// Cutoff share of dimensions. 3 of 7 in the school set, carried across to the
// other sets as a share so that a shorter dimension list does not silently become
// a stricter test.
const DEFAULT_K_SHARE = 3 / 7;

// Quality flags that make a dimension indeterminate rather than deprived. A
// capacity ratio above 3 is a data error, not a crowded building, and must not be
// read as the worst possible value.
const CAPACITY_VETO_FLAGS = new Set(['load_implausible', 'capacity_zero', 'enrolment_zero']);

// ── Dimension sets ───────────────────────────────────────────────────────────
//
// Each returns true (deprived), false (not deprived) or null (indeterminate).
// `uncertain: true` marks a dimension whose null is a genuine unknown that should
// produce an interval instead of dropping the facility.

const DIM = {
    water: {
        label: 'Питьевая вода',
        test: o => {
            const s = scoreObject(o, 'water');
            return s === null ? null : s <= 1;
        }
    },
    electricity: {
        label: 'Электроснабжение',
        test: o => {
            const s = scoreObject(o, 'electricity');
            return s === null ? null : s <= 1;
        }
    },
    internet: {
        label: 'Интернет',
        test: o => {
            const s = scoreObject(o, 'internet');
            return s === null ? null : s === 0;
        }
    },
    canteen: {
        label: 'Питание',
        test: o => {
            const s = scoreObject(o, 'canteen');
            return s === null ? null : s <= 1;
        }
    },
    sportHall: {
        label: 'Физкультура',
        test: o => {
            const s = scoreObject(o, 'sportHall');
            return s === null ? null : s === 0;
        }
    },
    activityHall: {
        label: 'Актовый зал',
        test: o => {
            const s = scoreObject(o, 'activityHall');
            return s === null ? null : s <= 1;
        }
    },
    indoorWater: {
        label: 'Вода в здании',
        test: o => {
            const s = scoreObject(o, 'indoorWater');
            return s === null ? null : s <= 1;
        }
    },
    repairStatus: {
        label: 'Ремонт не проводился',
        test: o => {
            const s = scoreObject(o, 'repairStatus');
            return s === null ? null : s === 0;
        }
    },
    capacity: {
        label: 'Перегрузка',
        test: o => {
            const flags = o.qualityFlags || [];
            if (flags.some(f => CAPACITY_VETO_FLAGS.has(f))) return null;
            if (o.loadFactor === null || o.loadFactor === undefined) return null;
            return o.loadFactor > 1.0;
        }
    },
    building: {
        label: 'Состояние здания',
        uncertain: true,
        test: (o, cfg) => {
            const { age, certain } = effectiveAge(o, cfg.asOfYear);
            if (age === null) return null;
            const deprived = age >= cfg.buildingAgeCutoff;
            // A building already past the cutoff on its construction year alone is
            // deprived whatever the missing repair record would have said only if
            // that record cannot rescue it. It can, so the answer stays uncertain.
            if (!certain && deprived) return undefined;   // undefined = uncertain
            return deprived;
        }
    }
};

// Sports hall exists only in maktab44; ssv has neither capacity nor a usable
// construction year, so its set is shorter and says so.
const DIMENSION_SETS = {
    school: ['water', 'electricity', 'internet', 'canteen', 'sportHall', 'capacity', 'building'],
    kindergarten: ['water', 'electricity', 'internet', 'canteen', 'activityHall', 'capacity', 'building'],
    health_post: ['water', 'electricity', 'internet', 'indoorWater', 'repairStatus']
};

// ── Per-facility scoring ─────────────────────────────────────────────────────

/**
 * Deprivation vector for one facility.
 * Returns { ok: false } when any dimension is missing outright, otherwise
 * { ok: true, deprived, uncertain, per } - uncertain dimensions are counted apart
 * so the caller can build both bounds. `per` holds each dimension's own result so
 * the aggregation never re-runs a test and cannot drift from the vector.
 */
function vectorOf(obj, dims, cfg) {
    let deprived = 0;
    let uncertain = 0;
    const per = {};

    for (const name of dims) {
        const r = DIM[name].test(obj, cfg);
        if (r === null) return { ok: false, missingDim: name };
        per[name] = r;
        if (r === undefined) { uncertain++; continue; }
        if (r) deprived++;
    }

    return { ok: true, deprived, uncertain, per };
}

// ── Aggregation ──────────────────────────────────────────────────────────────

function emptyBucket(dims) {
    return {
        assessed: 0,
        notAssessable: 0,
        // per-dimension deprivation counts, lower and upper bound
        dimLower: Object.fromEntries(dims.map(d => [d, 0])),
        dimUpper: Object.fromEntries(dims.map(d => [d, 0])),
        rows: []
    };
}

/**
 * H, A and M0 for one bucket at one bound. `bound` is 'lower' when uncertain
 * dimensions count as not deprived and 'upper' when they count as deprived.
 */
function indexAt(rows, d, kShare, bound) {
    if (rows.length === 0) return { H: null, A: null, M0: null, deprivedCount: 0 };

    let deprivedCount = 0;
    let sumC = 0;

    for (const r of rows) {
        const c = (r.deprived + (bound === 'upper' ? r.uncertain : 0)) / d;
        if (c >= kShare - 1e-9) {
            deprivedCount++;
            sumC += c;
        }
    }

    const H = deprivedCount / rows.length;
    const A = deprivedCount > 0 ? sumC / deprivedCount : 0;
    return {
        H: Number(H.toFixed(4)),
        A: Number(A.toFixed(4)),
        M0: Number((H * A).toFixed(4)),
        deprivedCount
    };
}

function round4(x) { return x === null ? null : Number(x.toFixed(4)); }

export { DIM, DIMENSION_SETS, DEFAULT_BUILDING_AGE_CUTOFF, DEFAULT_K_SHARE, vectorOf, emptyBucket, indexAt, round4 };
