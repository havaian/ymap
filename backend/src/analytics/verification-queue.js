/**
 * backend/src/analytics/verification-queue.js
 *
 * М4 version 1: which register entries are worth asking a person about, ranked by
 * rules rather than by a fitted model, because there is nothing to fit yet.
 *
 * Four components, each computed per facility and field, each returned alongside
 * the total. A composite that appears without its parts cannot be argued with, and
 * a ranking nobody can argue with is a ranking nobody will act on.
 *
 *   staleness            days since the source last touched the record
 *   contradiction        import-time quality flags on the record
 *   emptiness            share of scoreable fields left blank
 *   neighbourDeviation   distance from the district median on the same field
 *
 * The weights below are a starting position, not a result. They were chosen so
 * that no single component can carry an item to the top on its own, and they are
 * returned with every response so that a reader can recompute the ranking under
 * different weights. Replacing them is a change to one object here.
 *
 * The random arm is the part that cannot be added later.
 *
 * A queue ordered by these rules is a biased sample of the register. Fitting the
 * learned version of М4 on whatever comes back would teach it to reproduce the
 * rules, not to find wrong records. So a declared share of every queue is drawn
 * uniformly from all eligible candidates, and every served item is written to
 * VerificationAssignment with its selection mechanism and the draw denominator.
 * That record is what makes the collected verifications reweightable afterwards.
 * It is not reconstructable from the verifications themselves.
 *
 * The queue is never cached. A cached queue would serve the same random draw to
 * everyone, which is the same as having no random arm at all.
 *
 * GET /api/analytics/verification-queue
 *   ?objectType=school|kindergarten|health_post
 *   ?regionCode=1703
 *   ?districtCode=1703203
 *   ?limit=20            default 20, max 100
 *   ?dryRun=1            rank without writing assignments
 *
 * GET /api/analytics/verification-queue/audit
 *   composition of what has been served, so the bias can be checked rather than
 *   assumed away
 */

import Object_ from '../object/model.js';
import VerificationAssignment from '../verification/model.js';
import { FIELD_OF, score, maxScore } from './scales.js';
import { CONCEPTS_BY_SOURCE } from './data-quality.js';

// Share of each queue drawn uniformly rather than by rank. A quarter is enough to
// support reweighting without making the queue feel arbitrary to the person
// answering it. Changing it changes the inclusion probabilities, so the value in
// force at serve time is stored on every assignment rather than assumed constant.
const RANDOM_SHARE = 0.25;

const WEIGHTS = {
    staleness: 0.30,
    contradiction: 0.30,
    emptiness: 0.20,
    neighbourDeviation: 0.20
};

// Rank at or above which a record is called stale in the reasons list. The
// component itself is a rank, so this is a labelling threshold, not a cap.
const STALENESS_REASON_RANK = 0.75;

const OBJECT_TYPE_TO_SOURCE = {
    school: 'maktab44',
    kindergarten: 'bogcha',
    health_post: 'ssv'
};

// bogcha carries one bulk-load date across all its rows, so staleness is not
// measurable there. The component is dropped for that source and the remaining
// weights are renormalised, rather than scoring every bogcha record identically
// on a field that means nothing.
const STALENESS_UNUSABLE_SOURCES = new Set(['bogcha']);

const REASON_LABEL = {
    stale: 'одна из самых давно не обновлявшихся записей источника',
    contradiction: 'внутреннее противоречие в записи',
    empty: 'часть полей состояния не заполнена',
    outlier: 'значение сильно расходится с соседями по району',
    no_recency: 'дата обновления отсутствует или в этом источнике непригодна'
};

function clamp01(x) {
    if (!isFinite(x)) return 0;
    return x < 0 ? 0 : x > 1 ? 1 : x;
}

function median(nums) {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

/**
 * District medians per concept, over the objects in scope. Used as the reference a
 * record is compared against: a school reporting no drinking water in a district
 * where every other school reports mains supply is a more useful question than the
 * same answer in a district where it is the norm.
 */
function districtMedians(objects, concepts) {
    const acc = new Map();  // districtCode -> concept -> [scores]
    for (const o of objects) {
        const key = o.districtCode || '(none)';
        if (!acc.has(key)) acc.set(key, new Map());
        const per = acc.get(key);
        for (const c of concepts) {
            const s = score(c, o.sourceApi, o.details?.[FIELD_OF[c]]);
            if (s === null) continue;
            if (!per.has(c)) per.set(c, []);
            per.get(c).push(s);
        }
    }
    const out = new Map();
    for (const [district, per] of acc) {
        const m = new Map();
        for (const [c, list] of per) m.set(c, { median: median(list), n: list.length });
        out.set(district, m);
    }
    return out;
}

/**
 * Staleness as a rank within the source, not as an absolute age.
 *
 * An absolute cap does not work on this data. Every date in maktab44 sits between
 * 600 and 950 days back, so a two-year cap saturates for almost every record and
 * the component becomes a constant that contributes nothing to the ordering while
 * still consuming its weight. A percentile rank keeps the meaning - the oldest
 * records in this register score highest - and stays useful whether the whole
 * register was last touched last month or five years ago.
 *
 * Returns Map<objectId, number in 0..1>. Records with no usable date are absent
 * from the map and score zero, with the reason spelled out on the item.
 */
function stalenessRanks(objects) {
    const dated = objects
        .filter(o => !STALENESS_UNUSABLE_SOURCES.has(o.sourceApi) && o.sourceUpdatedAt)
        .map(o => ({ id: String(o._id), t: new Date(o.sourceUpdatedAt).getTime() }))
        .filter(x => !isNaN(x.t))
        .sort((a, b) => a.t - b.t);   // oldest first

    const out = new Map();
    if (dated.length <= 1) {
        for (const d of dated) out.set(d.id, 0);
        return out;
    }
    // Ties share a rank, so a bulk-loaded block does not get an arbitrary order
    // imposed on it.
    let i = 0;
    while (i < dated.length) {
        let j = i;
        while (j + 1 < dated.length && dated[j + 1].t === dated[i].t) j++;
        const rank = 1 - ((i + j) / 2) / (dated.length - 1);
        for (let k = i; k <= j; k++) out.set(dated[k].id, Number(rank.toFixed(4)));
        i = j + 1;
    }
    return out;
}

/**
 * One candidate per facility and scoreable field. A field already blank scores high
 * on emptiness but cannot deviate from anything, and both facts are visible in the
 * components rather than blended into a single unexplained number.
 *
 * neighbourDeviation is absolute distance from the district median, so a record
 * reporting a satisfactory hall where its neighbours report none ranks as high as
 * the reverse. That is intended: an unusually good claim in a poor district is as
 * worth checking as an unusually bad one, and the queue makes no assumption about
 * which direction the error runs.
 */
function buildCandidates(objects, concepts, medians, now) {
    const candidates = [];
    const ranks = stalenessRanks(objects);

    for (const o of objects) {
        const source = o.sourceApi;
        const usesStaleness = !STALENESS_UNUSABLE_SOURCES.has(source);

        // Staleness is a property of the record, identical across its fields.
        const staleness = usesStaleness ? (ranks.get(String(o._id)) ?? 0) : 0;
        const hasDate = usesStaleness && ranks.has(String(o._id));

        const flags = o.qualityFlags || [];
        const contradiction = clamp01(flags.length / 2);

        const present = concepts.filter(c => score(c, source, o.details?.[FIELD_OF[c]]) !== null).length;
        const emptiness = concepts.length ? clamp01(1 - present / concepts.length) : 0;

        const per = medians.get(o.districtCode || '(none)') || new Map();

        for (const c of concepts) {
            const raw = o.details?.[FIELD_OF[c]];
            const s = score(c, source, raw);
            const ref = per.get(c);
            const top = maxScore(c, source) || 1;

            // Fewer than three comparable neighbours is not a district norm. The
            // component stays at zero rather than turning noise into a signal.
            let neighbourDeviation = 0;
            if (s !== null && ref && ref.median !== null && ref.n >= 3) {
                neighbourDeviation = clamp01(Math.abs(s - ref.median) / top);
            }

            const parts = { staleness, contradiction, emptiness, neighbourDeviation };
            const active = usesStaleness
                ? WEIGHTS
                : { contradiction: WEIGHTS.contradiction, emptiness: WEIGHTS.emptiness, neighbourDeviation: WEIGHTS.neighbourDeviation };
            const totalWeight = Object.values(active).reduce((a, b) => a + b, 0);
            const priority = Object.entries(active).reduce((sum, [k, w]) => sum + w * parts[k], 0) / totalWeight;

            const reasons = [];
            if (staleness >= STALENESS_REASON_RANK) reasons.push('stale');
            if (contradiction > 0) reasons.push('contradiction');
            if (emptiness >= 0.3) reasons.push('empty');
            if (neighbourDeviation >= 0.5) reasons.push('outlier');
            if (!usesStaleness || !hasDate) reasons.push('no_recency');

            candidates.push({
                objectId: o._id,
                name: o.name,
                objectType: o.objectType,
                sourceApi: source,
                districtCode: o.districtCode,
                regionCode: o.regionCode,
                tuman: o.tuman,
                field: FIELD_OF[c],
                concept: c,
                currentValue: raw ?? null,
                districtMedianScore: ref?.median ?? null,
                priorityScore: Number(priority.toFixed(4)),
                components: {
                    staleness: Number(staleness.toFixed(4)),
                    contradiction: Number(contradiction.toFixed(4)),
                    emptiness: Number(emptiness.toFixed(4)),
                    neighbourDeviation: Number(neighbourDeviation.toFixed(4))
                },
                reasons
            });
        }
    }

    return candidates;
}

export const getVerificationQueue = async (req, res) => {
    try {
        const objectType = req.query.objectType ? String(req.query.objectType) : null;
        if (objectType && !OBJECT_TYPE_TO_SOURCE[objectType]) {
            return res.status(400).json({
                success: false,
                error: `objectType must be one of: ${Object.keys(OBJECT_TYPE_TO_SOURCE).join(', ')}`
            });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

        const match = {};
        if (objectType) match.objectType = objectType;
        if (req.query.regionCode) match.regionCode = parseInt(req.query.regionCode, 10);
        if (req.query.districtCode) match.districtCode = String(req.query.districtCode);
        // Family kindergartens have no building fields to verify.
        match.objectClass = 'building';

        const objects = await Object_.find(match)
            .select('name objectType sourceApi districtCode regionCode tuman details qualityFlags sourceUpdatedAt')
            .lean();

        if (objects.length === 0) {
            return res.json({
                success: true,
                data: { items: [], eligibleCandidates: 0 },
                meta: { note: 'нет объектов под фильтр' }
            });
        }

        // Concepts are per source, so a mixed selection uses the intersection: a
        // queue must not offer a school field on a health post.
        const sources = [...new Set(objects.map(o => o.sourceApi))];
        let concepts = CONCEPTS_BY_SOURCE[sources[0]] || [];
        for (const s of sources.slice(1)) {
            const set = new Set(CONCEPTS_BY_SOURCE[s] || []);
            concepts = concepts.filter(c => set.has(c));
        }
        if (concepts.length === 0) {
            return res.json({
                success: true,
                data: { items: [], eligibleCandidates: 0 },
                meta: { note: 'у выбранных источников нет общих полей состояния, задайте objectType' }
            });
        }

        const now = Date.now();
        const medians = districtMedians(objects, concepts);
        const candidates = buildCandidates(objects, concepts, medians, now);

        const randomSlots = Math.min(Math.round(limit * RANDOM_SHARE), candidates.length);
        const targetedSlots = Math.min(limit - randomSlots, Math.max(candidates.length - randomSlots, 0));

        // Random arm first, drawn from everything eligible. Drawing it after the
        // ranked arm would exclude the top of the ranking from the uniform sample
        // and quietly break the property the arm exists for.
        const pool = [...candidates];
        const randomPicks = [];
        for (let i = 0; i < randomSlots && pool.length; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            randomPicks.push(pool.splice(idx, 1)[0]);
        }

        const targetedPicks = pool
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .slice(0, targetedSlots);

        const items = [
            ...targetedPicks.map(c => ({ ...c, selection: 'targeted' })),
            ...randomPicks.map(c => ({ ...c, selection: 'random' }))
        ];

        // Interleave so the answering order does not correlate with the mechanism.
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }

        if (!dryRun && items.length) {
            const userId = req.user?._id || req.user?.id || null;
            await VerificationAssignment.insertMany(
                items.map(c => ({
                    objectId: c.objectId,
                    field: c.field,
                    selection: c.selection,
                    priorityScore: c.priorityScore,
                    components: c.components,
                    reasons: c.reasons,
                    eligibleCandidates: candidates.length,
                    randomShare: RANDOM_SHARE,
                    userId,
                    servedAt: new Date(now),
                    sourceApi: c.sourceApi,
                    districtCode: c.districtCode,
                    regionCode: c.regionCode
                })),
                { ordered: false }
            );
        }

        res.json({
            success: true,
            data: {
                items: items.map(c => ({
                    objectId: String(c.objectId),
                    name: c.name,
                    objectType: c.objectType,
                    tuman: c.tuman,
                    districtCode: c.districtCode,
                    field: c.field,
                    currentValue: c.currentValue,
                    selection: c.selection,
                    priorityScore: c.priorityScore,
                    components: c.components,
                    reasons: c.reasons.map(r => ({ code: r, label: REASON_LABEL[r] || r }))
                })),
                eligibleCandidates: candidates.length
            },
            meta: {
                asOf: new Date().toISOString().slice(0, 10),
                weights: WEIGHTS,
                stalenessScale: 'ранг внутри источника, 1 = самая старая запись',
                randomShare: RANDOM_SHARE,
                randomSlots,
                targetedSlots,
                stalenessDroppedForSources: sources.filter(s => STALENESS_UNUSABLE_SOURCES.has(s)),
                assignmentsRecorded: !dryRun,
                framing: 'Очередь указывает, какую запись реестра стоит уточнить на месте. Утверждения о состоянии объекта она не делает.',
                note: 'Веса - стартовая позиция, а не результат. Компоненты возвращаются отдельно, чтобы ранжирование можно было пересчитать под другими весами.'
            }
        });
    } catch (err) {
        console.error('getVerificationQueue error:', err);
        res.status(500).json({ success: false, error: 'Failed to build verification queue' });
    }
};

/**
 * What has actually been served. Answers the only question that matters about a
 * biased queue: how biased, and is the random arm large enough to correct it.
 */
export const getVerificationQueueAudit = async (req, res) => {
    try {
        const [bySelection, bySource, byField, firstDoc, lastDoc, distinctObjects] = await Promise.all([
            VerificationAssignment.aggregate([
                { $group: { _id: '$selection', count: { $sum: 1 }, avgScore: { $avg: '$priorityScore' } } }
            ]),
            VerificationAssignment.aggregate([
                { $group: { _id: { source: '$sourceApi', selection: '$selection' }, count: { $sum: 1 } } }
            ]),
            VerificationAssignment.aggregate([
                { $group: { _id: { field: '$field', selection: '$selection' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 40 }
            ]),
            VerificationAssignment.findOne({}).sort({ servedAt: 1 }).select('servedAt').lean(),
            VerificationAssignment.findOne({}).sort({ servedAt: -1 }).select('servedAt randomShare').lean(),
            VerificationAssignment.distinct('objectId')
        ]);

        const total = bySelection.reduce((s, r) => s + r.count, 0);
        const randomCount = bySelection.find(r => r._id === 'random')?.count || 0;

        res.json({
            success: true,
            data: {
                total,
                bySelection: Object.fromEntries(bySelection.map(r => [
                    r._id,
                    { count: r.count, avgPriorityScore: r.avgScore === null ? null : Number(r.avgScore.toFixed(4)) }
                ])),
                observedRandomShare: total ? Number((randomCount / total).toFixed(4)) : null,
                bySource: bySource.map(r => ({ sourceApi: r._id.source, selection: r._id.selection, count: r.count })),
                byField: byField.map(r => ({ field: r._id.field, selection: r._id.selection, count: r.count })),
                distinctObjectsServed: distinctObjects.length,
                firstServedAt: firstDoc?.servedAt || null,
                lastServedAt: lastDoc?.servedAt || null,
                currentRandomShare: RANDOM_SHARE
            },
            meta: {
                note: 'Расхождение observedRandomShare с currentRandomShare означает, что доля менялась. Вес каждого наблюдения берётся из его собственной записи, а не из текущей константы.',
                usableForTraining: 'Обучать М4 версии 2 можно только на верификациях, у которых есть запись в VerificationAssignment. Собранные до появления записи переоценить задним числом нельзя.'
            }
        });
    } catch (err) {
        console.error('getVerificationQueueAudit error:', err);
        res.status(500).json({ success: false, error: 'Failed to audit verification queue' });
    }
};

export { RANDOM_SHARE, WEIGHTS, buildCandidates, districtMedians };
