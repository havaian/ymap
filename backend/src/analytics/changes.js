/**
 * backend/src/analytics/changes.js
 *
 * Reads the archive: what moved in the registers, in which direction, and where.
 *
 * The direction is the part that carries meaning. A condition field that goes from
 * a partially repaired sports hall to a satisfactory one is an improvement; the
 * reverse is a deterioration; a move between two values the scale does not order is
 * neither and is reported separately rather than folded into one of the two. The
 * ordering comes from scales.js, so this endpoint and the deprivation index can
 * never disagree about which way is better.
 *
 * Two things this endpoint does not do.
 *
 * It does not present a change as a fact about a building. A register field moved;
 * whether the building moved with it is exactly what the verification queue is for.
 * The wording throughout is about the record, not the object.
 *
 * It does not report rates per unit of time until the archive holds enough steps to
 * support one. With two snapshots every rate is one observation, and the window
 * between them is returned so a reader can see that for themselves.
 *
 * GET /api/analytics/changes
 *   ?sourceApi=maktab44
 *   ?field=sport_zal_holati
 *   ?regionCode=1703
 *   ?since=2026-01-01
 *   ?limit=100
 *
 * GET /api/analytics/changes/timeline
 *   the archive itself: snapshots per source, windows between them, coverage
 */

import { Snapshot, RegistryChange } from '../snapshot/model.js';
import { score } from './scales.js';

// Source field name to the concept it scores. scales.js maps the other way, onto the
// Object document's camelCase detail keys; the archive stores raw source field
// names, so the bridge is spelled out here.
const CONCEPT_OF_SOURCE_FIELD = {
    ichimlik_suvi_manbaa: 'water',
    elektr_kun_davomida: 'electricity',
    internet: 'internet',
    internetga_ulanish_turi: 'internet',
    sport_zal_holati: 'sportHall',
    aktiv_zal_holati: 'activityHall',
    oshhona_holati: 'canteen',
    bino_ichida_suv: 'indoorWater'
};

// Numeric source fields where an increase and a decrease both mean something, but
// not on a better/worse axis. They are counted apart from the ordinal ones.
const NUMERIC_FIELDS = new Set(['sigimi', 'umumiy_uquvchi', 'smena', 'qurilish_yili', 'kapital_tamir']);

/**
 * Direction of one change: 'improved', 'deteriorated', 'lateral', 'numeric_up',
 * 'numeric_down' or null when the field carries no ordering.
 */
function direction(sourceApi, field, from, to) {
    const concept = CONCEPT_OF_SOURCE_FIELD[field];
    if (concept) {
        const a = score(concept, sourceApi, from);
        const b = score(concept, sourceApi, to);
        // One side outside the ladder, or an appearance out of nothing. Not a
        // movement along the scale and must not be counted as one.
        if (a === null || b === null) return 'lateral';
        if (b > a) return 'improved';
        if (b < a) return 'deteriorated';
        return 'lateral';
    }
    if (NUMERIC_FIELDS.has(field)) {
        const a = Number(from);
        const b = Number(to);
        if (isNaN(a) || isNaN(b)) return null;
        if (b > a) return 'numeric_up';
        if (b < a) return 'numeric_down';
        return null;
    }
    return null;
}

export const getChanges = async (req, res) => {
    try {
        const match = {};
        if (req.query.sourceApi) match.sourceApi = String(req.query.sourceApi);
        if (req.query.field) match.field = String(req.query.field);
        if (req.query.regionCode) match.regionCode = parseInt(req.query.regionCode, 10);
        if (req.query.since) {
            const since = new Date(String(req.query.since));
            if (!isNaN(since.getTime())) match.observedTo = { $gte: since };
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

        const snapshotCount = await Snapshot.countDocuments(
            match.sourceApi ? { sourceApi: match.sourceApi } : {}
        );
        if (snapshotCount < 2) {
            // Not an error. The archive starts with one snapshot per source and the
            // first transition appears with the second. Saying so plainly is better
            // than an empty list that reads like a failure.
            return res.json({
                success: true,
                data: { total: 0, byKind: {}, byField: [], byDirection: {}, recent: [] },
                meta: {
                    archiveState: 'снимков меньше двух, переходов ещё нет',
                    snapshots: snapshotCount,
                    note: 'Первый снимок задаёт t0. Переходы появляются со второго.'
                }
            });
        }

        const [total, byKind, byFieldRaw, recentRaw] = await Promise.all([
            RegistryChange.countDocuments(match),
            RegistryChange.aggregate([
                { $match: match },
                { $group: { _id: '$kind', count: { $sum: 1 } } }
            ]),
            RegistryChange.aggregate([
                { $match: { ...match, kind: 'changed' } },
                { $group: { _id: { field: '$field', sourceApi: '$sourceApi' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 40 }
            ]),
            RegistryChange.find({ ...match, kind: 'changed' })
                .sort({ observedTo: -1, sourceId: 1 })
                .limit(limit)
                .lean()
        ]);

        // Direction needs the scale, which is per source and per value pair, so it
        // cannot be resolved in the pipeline. Grouping by the distinct pairs first
        // collapses the log to a few hundred rows whatever its length, instead of
        // pulling every change into memory.
        const pairs = await RegistryChange.aggregate([
            { $match: { ...match, kind: 'changed' } },
            {
                $group: {
                    _id: { sourceApi: '$sourceApi', field: '$field', from: '$from', to: '$to' },
                    count: { $sum: 1 }
                }
            }
        ]);
        const directionCounts = {};
        for (const p of pairs) {
            const d = direction(p._id.sourceApi, p._id.field, p._id.from, p._id.to);
            const key = d || 'unordered';
            directionCounts[key] = (directionCounts[key] || 0) + p.count;
        }

        const byField = byFieldRaw.map(f => ({
            field: f._id.field,
            sourceApi: f._id.sourceApi,
            count: f.count,
            ordered: !!CONCEPT_OF_SOURCE_FIELD[f._id.field]
        }));

        const recent = recentRaw.map(c => ({
            sourceApi: c.sourceApi,
            sourceId: c.sourceId,
            field: c.field,
            from: c.from,
            to: c.to,
            direction: direction(c.sourceApi, c.field, c.from, c.to),
            districtCode: c.districtCode,
            regionCode: c.regionCode,
            observedFrom: c.observedFrom,
            observedTo: c.observedTo
        }));

        res.json({
            success: true,
            data: {
                total,
                byKind: Object.fromEntries(byKind.map(k => [k._id, k.count])),
                byField,
                byDirection: directionCounts,
                recent
            },
            meta: {
                snapshots: snapshotCount,
                framing: 'Изменилось поле реестра. Соответствует ли изменение объекту, определяет полевая проверка.',
                censoring: 'Каждое изменение произошло внутри окна observedFrom..observedTo. Архив сузить его не может.'
            }
        });
    } catch (err) {
        console.error('getChanges error:', err);
        res.status(500).json({ success: false, error: 'Failed to read change log' });
    }
};

/**
 * The archive itself. How many snapshots exist per source, when they were taken,
 * and how wide the gaps are. The gaps are the resolution ceiling of every
 * transition-based model built on top, so they belong on screen next to any figure
 * derived from them.
 */
export const getChangeTimeline = async (req, res) => {
    try {
        const snaps = await Snapshot.find({})
            .select('sourceApi takenAt provenance recordCount sha256 bytesRaw bytesStored note')
            .sort({ sourceApi: 1, takenAt: 1 })
            .lean();

        const bySource = new Map();
        for (const s of snaps) {
            if (!bySource.has(s.sourceApi)) bySource.set(s.sourceApi, []);
            bySource.get(s.sourceApi).push(s);
        }

        const sources = [...bySource].map(([sourceApi, list]) => {
            const windows = [];
            for (let i = 1; i < list.length; i++) {
                windows.push(Math.round((new Date(list[i].takenAt) - new Date(list[i - 1].takenAt)) / 86400000));
            }
            const spanDays = list.length > 1
                ? Math.round((new Date(list[list.length - 1].takenAt) - new Date(list[0].takenAt)) / 86400000)
                : 0;

            return {
                sourceApi,
                snapshots: list.length,
                first: list[0]?.takenAt || null,
                last: list[list.length - 1]?.takenAt || null,
                spanDays,
                windowsDays: windows,
                medianWindowDays: windows.length
                    ? [...windows].sort((a, b) => a - b)[Math.floor(windows.length / 2)]
                    : null,
                recordCounts: list.map(s => s.recordCount),
                provenance: [...new Set(list.map(s => s.provenance))],
                storedBytes: list.reduce((s, x) => s + (x.bytesStored || 0), 0),
                // A transition model needs a run of states, not a pair. Until the
                // archive has that, this says how far it is from it.
                transitionsAvailable: Math.max(0, list.length - 1)
            };
        });

        res.json({
            success: true,
            data: { sources },
            meta: {
                asOf: new Date().toISOString().slice(0, 10),
                note: 'Ширина окна между снимками ограничивает точность любой модели переходов, построенной на архиве.'
            }
        });
    } catch (err) {
        console.error('getChangeTimeline error:', err);
        res.status(500).json({ success: false, error: 'Failed to read snapshot timeline' });
    }
};

export { direction, CONCEPT_OF_SOURCE_FIELD };
