/**
 * backend/src/analytics/composite.js
 *
 * GET /api/analytics/composite
 *
 * A district composite over the facility registers, rebuilt from the ground up.
 *
 * What was wrong with the old one. `openbudget/controller.js` mixes four terms at
 * 40/25/20/15 and `analytics/controller.js` mixes three at 40/35/25. Neither set
 * of weights has a source, and three of the four terms in the first one - issue
 * burden, task gap, community signal - run on the civic circuit, which holds no
 * data. A composite whose heaviest components are empty is not a measurement of
 * anything; it ranks districts by how few zeros they happen to carry.
 *
 * Three changes, each of them the reason this file exists rather than a patch to
 * the old code.
 *
 * 1. RANKS, NOT MIN-MAX. Min-max normalisation hands the scale to the extremes:
 *    one district with an implausible load factor compresses every other district
 *    into the bottom of the range, and a data error becomes the unit of measure.
 *    Ranks are invariant to that. The cost is real and is stated rather than
 *    hidden: ranks discard distance, so a district that is far worse than the
 *    next one only reads as one place worse. Both the rank and the underlying
 *    value are returned for every component so the distance is still visible.
 *
 * 2. WEIGHTS ARE DECLARED, NOT DERIVED. They are equal by default, which is the
 *    only weighting that needs no justification, and they are overridable per
 *    request. The response always carries the weights it used. Equal weights are
 *    not a claim that the components matter equally - they are a refusal to
 *    invent a claim that they do not.
 *
 * 3. THE RANKING IS TESTED BEFORE IT IS PUBLISHED. A composite is a hypothesis
 *    about an ordering, and an ordering that dissolves under a small change of
 *    weights was never an ordering. So the weights are perturbed a thousand times
 *    and the share of runs in which each district stays inside the top band is
 *    reported next to its rank. A district at rank 12 with a stability of 0.31 is
 *    telling the reader not to act on the 12.
 *
 * The composite is never returned without its decomposition. Every district row
 * carries each component's raw value, its rank and its contribution, and a caller
 * that wants only the total has to discard the rest itself.
 */

import Object_ from '../object/model.js';
import District from '../district/model.js';
import { effectiveAge, loadClass } from './scales.js';
import { DIMENSION_SETS, DEFAULT_BUILDING_AGE_CUTOFF, DEFAULT_K_SHARE, DIM, vectorOf } from './deprivation.js';

// ── Components ────────────────────────────────────────────────────────────────
//
// All four run on the facility registers, which are the part of the project that
// holds data. Nothing here reads issues, votes or task verifications: those
// belong to the civic circuit and including an empty series would let a district
// score well for having no users rather than no problems.
//
// Every component is oriented the same way: HIGHER IS WORSE. A composite whose
// terms disagree about direction is the single easiest way to publish a sign
// error, and it is not detectable by looking at the output.

const COMPONENTS = {
    deprivation: {
        label: 'Депривация M0',
        note: 'Индекс Алкире-Фостера по объектам района, нижняя граница'
    },
    overload: {
        label: 'Превышение мощности',
        note: 'Доля объектов, где контингент выше проектной мощности'
    },
    age: {
        label: 'Возраст фонда',
        note: 'Доля объектов за нормативным циклом от тех, у кого возраст определим'
    },
    unmeasured: {
        label: 'Неизмеримость',
        note: 'Доля объектов, которые нельзя оценить: пустые поля условий'
    }
};

const COMPONENT_KEYS = Object.keys(COMPONENTS);

// Districts below this many assessed facilities are ranked but flagged. The
// registers are loaded to about 17.6 % of the school stock, so a district holding
// three objects is a sample, not a census, and its position in a national ranking
// is mostly an artefact of which three arrived.
const MIN_OBJECTS_FOR_CONFIDENCE = 10;

// Sensitivity run. 1000 draws, weights perturbed uniformly by up to ±50 % of
// their declared value and renormalised. The band is the top 50 by default -
// wide enough that membership is a real question and narrow enough that it means
// something.
const SENSITIVITY_RUNS = 1000;
const DEFAULT_TOP_BAND = 50;
const PERTURBATION = 0.5;

// ── Rank normalisation ────────────────────────────────────────────────────────

/**
 * Fractional ranks on [0, 1], ties averaged, higher input to higher output.
 *
 * Ties are averaged rather than broken by document order: two districts with the
 * same value are the same observation, and letting insertion order decide which
 * ranks worse would make the composite depend on the order rows came back from
 * the database.
 *
 * Nulls keep their place in the array and come back as null. A district with no
 * usable value for a component is not ranked on it - see the reweighting in
 * `composeRow`, which redistributes that component's weight over the ones that
 * do have a value instead of scoring the gap as zero.
 */
function fractionalRanks(values) {
    const present = values
        .map((v, i) => ({ v, i }))
        .filter(x => x.v !== null && x.v !== undefined && !Number.isNaN(x.v));

    const out = new Array(values.length).fill(null);
    if (present.length === 0) return out;
    if (present.length === 1) {
        out[present[0].i] = 0.5;
        return out;
    }

    present.sort((a, b) => a.v - b.v);

    let i = 0;
    while (i < present.length) {
        let j = i;
        while (j + 1 < present.length && present[j + 1].v === present[i].v) j++;
        // Average of the 1-based positions this tied group occupies.
        const meanPos = (i + j) / 2 + 1;
        const norm = (meanPos - 1) / (present.length - 1);
        for (let k = i; k <= j; k++) out[present[k].i] = norm;
        i = j + 1;
    }
    return out;
}

// ── Per-district component values ─────────────────────────────────────────────

/**
 * Reduces one district's facilities to the four component values.
 *
 * Every denominator is carried alongside its numerator. A share computed over
 * four assessable objects and a share computed over four hundred are not the same
 * measurement, and the only way to keep that visible downstream is to never throw
 * the denominator away.
 */
function componentsFor(objects, cfg) {
    const scorable = objects.filter(o => o.objectClass !== 'home_based');

    // Deprivation: the counting method, lower bound, over facilities whose whole
    // dimension vector is determinable. Pooled across facility types within the
    // district by c_i share, not by dimension - the dimension lists differ per
    // type and averaging across them would compare a sports hall to an indoor tap.
    let assessed = 0;
    let notAssessable = 0;
    let deprivedCount = 0;
    let sumC = 0;

    for (const o of scorable) {
        const dims = DIMENSION_SETS[o.objectType];
        if (!dims) { notAssessable++; continue; }
        const vec = vectorOf(o, dims, cfg);
        if (!vec.ok) { notAssessable++; continue; }
        assessed++;
        const c = vec.deprived / dims.length;
        if (c >= DEFAULT_K_SHARE - 1e-9) { deprivedCount++; sumC += c; }
    }

    const H = assessed > 0 ? deprivedCount / assessed : null;
    const A = deprivedCount > 0 ? sumC / deprivedCount : 0;
    const M0 = H === null ? null : H * A;

    // Overload: share of facilities carrying more people than they were designed
    // for. Objects with a load-quality flag are excluded rather than counted as
    // overloaded - a ratio above 3 is a data error, not a crowded building.
    const loadable = scorable.filter(
        o => o.loadFactor != null
            && !(o.qualityFlags ?? []).some(f =>
                f === 'load_implausible' || f === 'capacity_zero' || f === 'enrolment_zero')
    );
    const overloaded = loadable.filter(o => o.loadFactor > 1).length;
    const overload = loadable.length > 0 ? overloaded / loadable.length : null;

    // Age: share past the cycle among facilities whose age is determinable at all.
    // ssv is excluded upstream by effectiveAge because its construction year is a
    // placeholder in about 85 % of records; the denominator here reflects that.
    let ageKnown = 0;
    let ageOver = 0;
    for (const o of scorable) {
        const a = effectiveAge(o, cfg.asOfYear);
        if (a.age === null) continue;
        ageKnown++;
        if (a.age > cfg.buildingAgeCutoff) ageOver++;
    }
    const age = ageKnown > 0 ? ageOver / ageKnown : null;

    // Unmeasurability as a component in its own right, not as a footnote. A
    // district whose records are too empty to score is a real finding about that
    // district's reporting, and burying it would let a blank register look like a
    // clean one.
    const unmeasured = scorable.length > 0 ? notAssessable / scorable.length : null;

    return {
        values: { deprivation: M0, overload, age, unmeasured },
        denominators: {
            objects: objects.length,
            scorable: scorable.length,
            assessed,
            notAssessable,
            loadable: loadable.length,
            ageKnown
        },
        detail: {
            H: H === null ? null : Number(H.toFixed(4)),
            A: Number(A.toFixed(4)),
            overloadedCount: overloaded,
            ageOverCount: ageOver
        }
    };
}

// ── Composition ───────────────────────────────────────────────────────────────

/**
 * Weighted mean of the ranks a district actually has.
 *
 * A component with no value has its weight redistributed over the rest rather
 * than being scored as zero. Scoring it as zero would reward a district for
 * having nothing measurable, which is precisely backwards: `unmeasured` exists to
 * make that case visible, and it must not also be rewarded here.
 */
function composeRow(rankRow, weights) {
    let sumW = 0;
    let acc = 0;
    const contributions = {};

    for (const key of COMPONENT_KEYS) {
        const r = rankRow[key];
        if (r === null) { contributions[key] = null; continue; }
        sumW += weights[key];
        acc += weights[key] * r;
    }
    if (sumW === 0) return { score: null, contributions, usedWeight: 0 };

    for (const key of COMPONENT_KEYS) {
        const r = rankRow[key];
        contributions[key] = r === null ? null : Number(((weights[key] * r) / sumW).toFixed(4));
    }
    return { score: acc / sumW, contributions, usedWeight: sumW };
}

// ── Sensitivity ───────────────────────────────────────────────────────────────

/**
 * Deterministic PRNG. The sensitivity result has to be reproducible: a stability
 * figure that changes between two identical requests cannot be quoted, and a
 * cached response that disagrees with a fresh one is worse than no figure.
 * mulberry32, seeded from the request.
 */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Perturbs the weights `runs` times and counts how often each district lands
 * inside the top band. Returns a share on [0, 1] per district index.
 *
 * The perturbation is multiplicative and symmetric: each weight is multiplied by
 * a factor drawn uniformly from [1 - p, 1 + p] and the set is renormalised. This
 * asks the question a reader actually has - "would a different reasonable
 * weighting move this district" - rather than the easier question of what happens
 * when one weight goes to zero.
 */
function sensitivity(rankRows, weights, { runs, topBand, seed }) {
    const n = rankRows.length;
    const hits = new Array(n).fill(0);
    const rand = rng(seed);
    const band = Math.min(topBand, n);

    for (let run = 0; run < runs; run++) {
        const w = {};
        for (const key of COMPONENT_KEYS) {
            w[key] = weights[key] * (1 - PERTURBATION + rand() * 2 * PERTURBATION);
        }

        const scored = [];
        for (let i = 0; i < n; i++) {
            const { score } = composeRow(rankRows[i], w);
            if (score !== null) scored.push({ i, score });
        }
        scored.sort((a, b) => b.score - a.score);
        for (let r = 0; r < Math.min(band, scored.length); r++) hits[scored[r].i]++;
    }

    return hits.map(h => Number((h / runs).toFixed(3)));
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const getComposite = async (req, res) => {
    const {
        regionCode,
        objectType,
        topBand,
        buildingAgeCutoff,
        seed
    } = req.query;

    const cfg = {
        buildingAgeCutoff: Number(buildingAgeCutoff) > 0
            ? Number(buildingAgeCutoff)
            : DEFAULT_BUILDING_AGE_CUTOFF,
        asOfYear: new Date().getFullYear()
    };

    // Weights: equal unless the caller declares otherwise. Accepted as
    // ?w.deprivation=2 and so on, then normalised to sum to one so the numbers a
    // caller passes do not have to.
    const weights = {};
    let declared = false;
    for (const key of COMPONENT_KEYS) {
        const raw = Number(req.query[`w.${key}`]);
        if (Number.isFinite(raw) && raw >= 0) { weights[key] = raw; declared = true; }
        else weights[key] = 1;
    }
    const wSum = COMPONENT_KEYS.reduce((s, k) => s + weights[k], 0);
    if (wSum <= 0) {
        return res.status(400).json({ success: false, message: 'Weights must not sum to zero' });
    }
    for (const key of COMPONENT_KEYS) weights[key] = weights[key] / wSum;

    const objFilter = {};
    if (regionCode) objFilter.regionCode = parseInt(regionCode);
    if (objectType) objFilter.objectType = objectType;

    const objects = await Object_.find(objFilter)
        .select('objectType objectClass sourceApi districtCode districtId regionCode loadFactor qualityFlags details')
        .lean();

    if (objects.length === 0) {
        return res.json({
            success: true,
            data: { districts: [], meta: { objects: 0, note: 'В базе нет объектов под этот фильтр' } }
        });
    }

    // Grouped by SOATO code rather than by districtId: the code is on the object
    // itself and does not require the District collection to be populated, so the
    // composite is computable before any geometry is loaded.
    const byDistrict = new Map();
    for (const o of objects) {
        const key = o.districtCode || (o.districtId ? String(o.districtId) : null);
        if (!key) continue;
        if (!byDistrict.has(key)) byDistrict.set(key, []);
        byDistrict.get(key).push(o);
    }

    const codes = [...byDistrict.keys()];
    const districtDocs = await District.find({ cadNum: { $in: codes } })
        .select('cadNum name regionCode')
        .lean();
    const nameByCode = new Map(districtDocs.map(d => [d.cadNum, d]));

    // ── Component values, then ranks over the districts in scope ──────────────
    const rows = codes.map(code => {
        const list = byDistrict.get(code);
        const c = componentsFor(list, cfg);
        const meta = nameByCode.get(code);
        return {
            soato: code,
            name: meta?.name ?? { ru: list[0]?.tuman ?? null, uz: list[0]?.tuman ?? null, en: null },
            regionCode: meta?.regionCode ?? list[0]?.regionCode ?? null,
            ...c
        };
    });

    const rankByComponent = {};
    for (const key of COMPONENT_KEYS) {
        rankByComponent[key] = fractionalRanks(rows.map(r => r.values[key]));
    }
    const rankRows = rows.map((_, i) =>
        Object.fromEntries(COMPONENT_KEYS.map(k => [k, rankByComponent[k][i]])));

    const composed = rankRows.map(rr => composeRow(rr, weights));

    const band = Number(topBand) > 0 ? Number(topBand) : DEFAULT_TOP_BAND;
    const stability = sensitivity(rankRows, weights, {
        runs: SENSITIVITY_RUNS,
        topBand: band,
        // Seeded from the request so two identical calls give identical figures,
        // and a caller can move the seed to check the result is not an artefact of
        // one draw.
        seed: Number.isFinite(Number(seed)) ? Number(seed) : 20260808
    });

    const out = rows.map((r, i) => ({
        soato: r.soato,
        name: r.name,
        regionCode: r.regionCode,
        composite: composed[i].score === null ? null : Number(composed[i].score.toFixed(4)),
        // Ranked and reported, but marked. A district with four objects sits in the
        // ranking because removing it would silently change every other position;
        // the flag is what stops its number being quoted on its own.
        thinSample: r.denominators.scorable < MIN_OBJECTS_FOR_CONFIDENCE,
        stabilityInTopBand: stability[i],
        components: Object.fromEntries(COMPONENT_KEYS.map(k => [k, {
            label: COMPONENTS[k].label,
            value: r.values[k] === null ? null : Number(r.values[k].toFixed(4)),
            rank: rankByComponent[k][i],
            weight: Number(weights[k].toFixed(4)),
            contribution: composed[i].contributions[k]
        }])),
        denominators: r.denominators,
        detail: r.detail
    }));

    out.sort((a, b) => {
        if (a.composite === null) return 1;
        if (b.composite === null) return -1;
        return b.composite - a.composite;
    });
    out.forEach((r, i) => { r.rank = r.composite === null ? null : i + 1; });

    res.json({
        success: true,
        data: {
            districts: out,
            meta: {
                method: 'Ранговая нормализация, средневзвешенное по рангам. Выше = хуже.',
                components: COMPONENTS,
                weights: Object.fromEntries(COMPONENT_KEYS.map(k => [k, Number(weights[k].toFixed(4))])),
                weightsDeclared: declared,
                weightsNote: declared
                    ? 'Веса заданы в запросе.'
                    : 'Веса равные. Это не утверждение, что компоненты равнозначны, а отказ придумывать, что это не так.',
                sensitivity: {
                    runs: SENSITIVITY_RUNS,
                    perturbation: PERTURBATION,
                    topBand: Math.min(band, out.length),
                    note: 'Доля прогонов, в которых район остаётся в верхней полосе при возмущении весов до ±50 %. Низкая доля означает, что позиция держится на выборе весов, а не на данных.'
                },
                buildingAgeCutoff: cfg.buildingAgeCutoff,
                buildingAgeCutoffProvisional: true,
                minObjectsForConfidence: MIN_OBJECTS_FOR_CONFIDENCE,
                districts: out.length,
                objects: objects.length,
                excludes: 'Обращения, голоса и проверки не участвуют: гражданский контур пуст, и район получал бы хорошую позицию за отсутствие пользователей.'
            }
        }
    });
};

export { fractionalRanks, composeRow, sensitivity, COMPONENT_KEYS };
