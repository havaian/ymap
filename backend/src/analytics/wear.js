/**
 * backend/src/analytics/wear.js
 *
 * М2, first stage: normative accounting of building wear, published under two
 * competing readings of the same field rather than one.
 *
 * Why two. The register stores a bare year in `kapital_tamir` and does not say what
 * kind of repair it was. In the health post register the ministry does separate
 * them - ha_kapital, ha_joriy, ha_rekon - so the distinction exists in practice and
 * is simply absent from the school and preschool forms. The two readings give
 * answers that differ by a factor of seven, which makes this the single largest
 * open question in the model:
 *
 *   H1 capital  the recorded year is a capital repair and resets the clock.
 *               Schools past their cycle: 8.2 %. Median R 0.27.
 *   H2 current  the recorded year may be any repair and resets nothing.
 *               Schools past their cycle: 61.1 %. Median R 1.23.
 *
 * H1 taken alone implies a stock where half the buildings were capitally repaired
 * eight years ago and 62 % within ten, which no published repair cycle supports.
 * H2 taken alone throws away a field that is populated for three quarters of the
 * records. Neither is chosen here. Both are computed, both are returned, and the
 * gap between them is the finding: it closes by separating the kind of repair in
 * the form, not by a better estimator.
 *
 * The normative cycle is provisional. It has to be read from the current edition of
 * ШНК before anything computed with it leaves the project. It lives in one constant
 * and in a query parameter so replacing it is a recompute, not a rewrite.
 *
 * ssv is excluded entirely: 341 of its 344 filled construction years are 2005, so
 * any age derived from that field would be an artefact of the loader.
 *
 * Seismic exposure is part of the intended priority formula and is not applied,
 * because no zone layer is connected. It is declared missing in the response rather
 * than silently set to one.
 *
 * GET /api/analytics/wear
 *   ?objectType=school|kindergarten   default school
 *   ?regionCode=1703
 *   ?cycleYears=30                    overrides the provisional cycle
 *   ?hypothesis=capital|current       which one orders the lists; both are returned
 *   ?minAssessed=5
 *   ?limit=25                         facilities in the priority list
 */

import Object_ from '../object/model.js';
import District from '../district/model.js';
import { materialRisk, AGE_UNUSABLE_SOURCES } from './scales.js';

// PROVISIONAL. Indicative capital repair cycle for public buildings, in years.
// Must be checked against the current ШНК edition before publication.
const DEFAULT_CYCLE_YEARS = 30;

// R is capped so a building at four times its cycle does not swamp the ranking on
// age alone. Above twice the cycle the register cannot distinguish degrees anyway.
const R_CAP = 2;

const MIN_YEAR = 1850;

function yearOf(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < MIN_YEAR || n > new Date().getFullYear()) return null;
    return n;
}

function int(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

/**
 * Effective age under each reading. Both are returned so nothing downstream has to
 * pick one, and the pair is the unit that gets published.
 */
function ages(o, asOfYear) {
    const build = yearOf(o.details?.qurilishYili);
    if (build === null) return null;
    const repair = o.details?.lastCapitalRepairYear ?? null;
    const reset = repair && repair >= build ? repair : build;
    return {
        capital: asOfYear - reset,
        current: asOfYear - build,
        hasRepairRecord: !!(repair && repair >= build)
    };
}

function quantiles(nums) {
    if (!nums.length) return { p25: null, p50: null, p75: null, p90: null };
    const s = [...nums].sort((a, b) => a - b);
    const at = p => Number(s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3));
    return { p25: at(0.25), p50: at(0.5), p75: at(0.75), p90: at(0.9) };
}

/**
 * Priority is a product, not a weighted sum, because the factors are not
 * substitutes: a new building does not become urgent by being large, and an old one
 * serving nobody is not urgent either. The parts are always returned next to the
 * total.
 *
 *   f(R)              wear against the normative cycle, capped
 *   ln(1 + enrolment) people exposed, on a log scale so the largest schools do not
 *                     dominate purely by size
 *   materialRisk      structural class of the walls
 */
function priorityOf(R, enrolment, risk) {
    const f = Math.min(R, R_CAP);
    const exposure = Math.log(1 + Math.max(0, enrolment || 0));
    return Number((f * exposure * risk).toFixed(4));
}

export const getWear = async (req, res) => {
    try {
        const objectType = String(req.query.objectType || 'school');
        if (!['school', 'kindergarten'].includes(objectType)) {
            return res.status(400).json({
                success: false,
                error: 'objectType must be school or kindergarten; ssv construction years are a placeholder and carry no age'
            });
        }

        const cycleYears = req.query.cycleYears ? parseInt(req.query.cycleYears, 10) : DEFAULT_CYCLE_YEARS;
        if (isNaN(cycleYears) || cycleYears < 1) {
            return res.status(400).json({ success: false, error: 'cycleYears must be a positive integer' });
        }
        const ordering = req.query.hypothesis === 'current' ? 'current' : 'capital';
        const minAssessed = req.query.minAssessed ? parseInt(req.query.minAssessed, 10) : 5;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 200);

        const match = { objectType, objectClass: 'building' };
        if (req.query.regionCode) match.regionCode = parseInt(req.query.regionCode, 10);

        const objects = await Object_.find(match)
            .select('name districtCode regionCode tuman viloyat sourceApi details qualityFlags')
            .lean();

        if (objects.length === 0) {
            return res.json({ success: true, data: null, meta: { objectType, note: 'нет объектов этого типа' } });
        }

        const asOfYear = new Date().getFullYear();

        const rows = [];
        let noBuildYear = 0;
        let noMaterial = 0;
        let excludedSource = 0;

        for (const o of objects) {
            if (AGE_UNUSABLE_SOURCES.has(o.sourceApi)) { excludedSource++; continue; }
            const a = ages(o, asOfYear);
            if (!a) { noBuildYear++; continue; }

            const risk = materialRisk(o.details?.materialSten);
            if (risk === null) noMaterial++;
            const enrolment = int(o.details?.umumiyUquvchi) ?? 0;

            const Rcap = a.capital / cycleYears;
            const Rcur = a.current / cycleYears;

            rows.push({
                objectId: String(o._id),
                name: o.name,
                districtCode: o.districtCode,
                regionCode: o.regionCode,
                tuman: o.tuman,
                material: o.details?.materialSten ?? null,
                buildYear: yearOf(o.details?.qurilishYili),
                repairYear: o.details?.lastCapitalRepairYear ?? null,
                hasRepairRecord: a.hasRepairRecord,
                enrolment,
                age: { capital: a.capital, current: a.current },
                R: { capital: Number(Rcap.toFixed(3)), current: Number(Rcur.toFixed(3)) },
                priority: {
                    capital: priorityOf(Rcap, enrolment, risk ?? 1),
                    current: priorityOf(Rcur, enrolment, risk ?? 1)
                },
                materialRisk: risk,
                materialUnknown: risk === null
            });
        }

        if (rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                meta: { objectType, note: 'ни у одной записи нет пригодного года постройки' }
            });
        }

        const summaryFor = h => {
            const Rs = rows.map(r => r.R[h]);
            const past = rows.filter(r => r.R[h] >= 1).length;
            return {
                R: quantiles(Rs),
                pastCycle: past,
                pastCyclePct: Number(((past / rows.length) * 100).toFixed(1)),
                medianAgeYears: quantiles(rows.map(r => r.age[h])).p50
            };
        };

        // District aggregates under both readings. The spread between them is what a
        // planner actually needs to see before committing money.
        const buckets = new Map();
        for (const r of rows) {
            const key = r.districtCode || '(без района)';
            if (!buckets.has(key)) {
                buckets.set(key, { districtCode: r.districtCode, tuman: r.tuman, regionCode: r.regionCode, rows: [] });
            }
            buckets.get(key).rows.push(r);
        }

        const codes = [...buckets.values()].map(b => b.districtCode).filter(Boolean);
        const districtDocs = await District.find({ cadNum: { $in: codes } }).select('cadNum name').lean();
        const nameByCode = new Map(districtDocs.map(d => [d.cadNum, d.name]));

        const districts = [...buckets.values()].map(b => {
            const n = b.rows.length;
            const share = h => Number((b.rows.filter(r => r.R[h] >= 1).length / n).toFixed(4));
            const medR = h => quantiles(b.rows.map(r => r.R[h])).p50;
            return {
                districtCode: b.districtCode,
                name: nameByCode.get(b.districtCode) || { uz: b.tuman || '', ru: '', en: '' },
                tuman: b.tuman,
                regionCode: b.regionCode,
                facilities: n,
                belowThreshold: n < minAssessed,
                pastCycleShare: { capital: share('capital'), current: share('current') },
                medianR: { capital: medR('capital'), current: medR('current') },
                enrolmentExposed: {
                    capital: b.rows.filter(r => r.R.capital >= 1).reduce((s, r) => s + r.enrolment, 0),
                    current: b.rows.filter(r => r.R.current >= 1).reduce((s, r) => s + r.enrolment, 0)
                },
                adobeCount: b.rows.filter(r => r.material === 'paxsa').length
            };
        }).sort((a, b) => b.pastCycleShare[ordering] - a.pastCycleShare[ordering]);

        const topFacilities = [...rows]
            .sort((a, b) => b.priority[ordering] - a.priority[ordering])
            .slice(0, limit);

        res.json({
            success: true,
            data: {
                national: {
                    assessed: rows.length,
                    capital: summaryFor('capital'),
                    current: summaryFor('current'),
                    withRepairRecord: rows.filter(r => r.hasRepairRecord).length,
                    adobeCount: rows.filter(r => r.material === 'paxsa').length
                },
                districts,
                topFacilities
            },
            meta: {
                objectType,
                asOf: new Date().toISOString().slice(0, 10),
                ordering,
                cycleYears,
                cycleStatus: 'провизорный, до сверки с действующей редакцией ШНК',
                rCap: R_CAP,
                hypotheses: {
                    capital: 'Записанный в kapital_tamir год - капитальный ремонт, отсчёт износа начинается заново.',
                    current: 'Записанный год может быть текущим ремонтом и отсчёт не сбрасывает. Возраст считается от постройки.'
                },
                whyTwo: 'Реестр не указывает вид ремонта. В реестре Минздрава виды разделены (ha_kapital, ha_joriy, ha_rekon), в школьной и дошкольной формах нет. Разрыв между гипотезами закрывается разделением вида ремонта в форме, а не оценкой.',
                priorityFormula: 'min(R, 2) × ln(1 + контингент) × риск материала',
                seismic: {
                    applied: false,
                    reason: 'Слой сейсмического районирования не подключён. Множитель не подставляется.'
                },
                denominators: {
                    objectsInScope: objects.length,
                    assessed: rows.length,
                    withoutBuildYear: noBuildYear,
                    withoutMaterial: noMaterial,
                    excludedBySource: excludedSource
                },
                caveat: 'Расчёт по загруженной выборке. Экстраполяция на страну не производится.'
            }
        });
    } catch (err) {
        console.error('getWear error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute wear' });
    }
};

export { ages, priorityOf, quantiles, DEFAULT_CYCLE_YEARS, R_CAP };
