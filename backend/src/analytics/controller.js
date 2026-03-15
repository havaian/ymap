/**
 * Analytics Controller
 *
 * All data comes from real MongoDB collections — no mock data.
 * Architecture: Object_ (schools/kindergartens/health_posts) + Task + Issue
 */

import mongoose from 'mongoose';
import Object_ from '../object/model.js';
import Task from '../task/model.js';
import Issue from '../issue/model.js';
import District from '../district/model.js';
import Region from '../region/model.js';

// ─────────────────────────────────────────────
// GET /api/analytics/overview
// System-wide summary
// Query: ?regionCode=17
// ─────────────────────────────────────────────

export const getOverview = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [objectCount, issueStats, taskStats] = await Promise.all([
            Object_.countDocuments(regionFilter),

            Issue.aggregate([
                { $match: regionFilter },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        open: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        totalVotes: { $sum: '$votes' }
                    }
                }
            ]),

            Task.aggregate([
                {
                    $lookup: {
                        from: 'objects', localField: 'targetId', foreignField: '_id', as: 'object'
                    }
                },
                { $unwind: { path: '$object', preserveNullAndEmptyArrays: false } },
                { $match: Object.keys(regionFilter).length ? { 'object.regionCode': parseInt(regionCode) } : {} },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const issues = issueStats[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, totalVotes: 0 };
        const tasks = taskStats[0] || { total: 0, completed: 0 };

        res.json({
            success: true,
            data: {
                objects: {
                    total: objectCount
                },
                issues: {
                    total: issues.total,
                    open: issues.open,
                    inProgress: issues.inProgress,
                    resolved: issues.resolved,
                    totalVotes: issues.totalVotes
                },
                tasks: {
                    total: tasks.total,
                    completed: tasks.completed,
                    completionRate: tasks.total > 0
                        ? Math.round((tasks.completed / tasks.total) * 100)
                        : null
                }
            }
        });
    } catch (err) {
        console.error('Overview error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch overview' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/issues
// Issue analytics
// Query: ?regionCode=17&districtId=xxx&category=Roads
// ─────────────────────────────────────────────

export const getIssueAnalytics = async (req, res) => {
    try {
        const { regionCode, districtId, category } = req.query;

        const match = {};
        if (regionCode) match.regionCode = parseInt(regionCode);
        if (districtId && mongoose.isValidObjectId(districtId))
            match.districtId = new mongoose.Types.ObjectId(districtId);
        if (category) match.category = category;

        const [byCategory, bySeverity, byStatus, byDistrict, trends, topVoted, totalCount] = await Promise.all([
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$category', count: { $sum: 1 }, votes: { $sum: '$votes' } } },
                { $sort: { count: -1 } }
            ]),
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Issue.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                { $group: { _id: '$districtId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            Issue.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ]),
            Issue.find(match).sort({ votes: -1 }).limit(10)
                .select('title category severity status votes createdAt').lean(),
            Issue.countDocuments(match)
        ]);

        let density = null;
        if (districtId) {
            const dist = await District.findById(districtId).select('areaKm2').lean();
            if (dist?.areaKm2) density = Math.round((totalCount / dist.areaKm2) * 100) / 100;
        } else if (regionCode) {
            const reg = await Region.findOne({ code: parseInt(regionCode) }).select('areaKm2').lean();
            if (reg?.areaKm2) density = Math.round((totalCount / reg.areaKm2) * 100) / 100;
        }

        res.json({
            success: true,
            data: {
                total: totalCount,
                density,
                byCategory,
                bySeverity: Object.fromEntries(bySeverity.map(s => [s._id, s.count])),
                byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
                byDistrict,
                trends: trends.map(t => ({
                    year: t._id.year, month: t._id.month,
                    count: t.count, resolved: t.resolved
                })),
                topVoted
            }
        });
    } catch (err) {
        console.error('Issue analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch issue analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/infrastructure
// Now shows object coverage (replaces old org+infra analytics)
// Query: ?regionCode=17
// ─────────────────────────────────────────────

export const getInfraAnalytics = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const match = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [byType, byRegion, byDistrict] = await Promise.all([
            Object_.aggregate([
                { $match: match },
                { $group: { _id: '$objectType', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Object_.aggregate([
                { $match: match },
                { $group: { _id: '$viloyat', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            Object_.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                { $group: { _id: '$districtId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ])
        ]);

        res.json({
            success: true,
            data: { byType, byRegion, byDistrict }
        });
    } catch (err) {
        console.error('Infra analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch object analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/crops — kept for district crop data on drilldown
// ─────────────────────────────────────────────

export const getCropAnalytics = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const match = { 'crops.0': { $exists: true } };
        if (regionCode) match.regionCode = parseInt(regionCode);

        const cropsByDistrict = await District.aggregate([
            { $match: match },
            { $unwind: '$crops' },
            {
                $group: {
                    _id: '$_id',
                    districtName: { $first: '$name' },
                    regionCode: { $first: '$regionCode' },
                    areaKm2: { $first: '$areaKm2' },
                    cropCount: { $sum: 1 },
                    crops: { $push: { apiId: '$crops.apiId', name: '$crops.name', color: '$crops.color' } }
                }
            },
            { $sort: { cropCount: -1 } }
        ]);

        const cropTotals = await District.aggregate([
            { $match: match },
            { $unwind: '$crops' },
            {
                $group: {
                    _id: '$crops.apiId',
                    name: { $first: '$crops.name' },
                    color: { $first: '$crops.color' },
                    districtCount: { $sum: 1 }
                }
            },
            { $sort: { districtCount: -1 } }
        ]);

        res.json({ success: true, data: { cropTotals, byDistrict: cropsByDistrict } });
    } catch (err) {
        console.error('Crop analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch crop analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/districts/scoring
// Ranks districts by issue density + verification rate + object density
// Query: ?regionCode=17
// ─────────────────────────────────────────────

export const getDistrictScoring = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const districts = await District.find(regionFilter)
            .select('name regionCode areaKm2 centroid')
            .lean();

        if (!districts.length) {
            return res.json({ success: true, data: { count: 0, districts: [] } });
        }

        const districtIds = districts.map(d => d._id);

        const [issueStats, objectStats, verificationStats] = await Promise.all([
            Issue.aggregate([
                { $match: { districtId: { $in: districtIds } } },
                {
                    $group: {
                        _id: '$districtId',
                        total: { $sum: 1 },
                        open: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        totalVotes: { $sum: '$votes' }
                    }
                }
            ]),
            Object_.aggregate([
                { $match: { districtId: { $in: districtIds } } },
                { $group: { _id: '$districtId', count: { $sum: 1 } } }
            ]),
            Task.aggregate([
                { $match: { 'verifications.0': { $exists: true } } },
                { $unwind: '$verifications' },
                {
                    $lookup: {
                        from: 'objects', localField: 'targetId', foreignField: '_id', as: 'obj'
                    }
                },
                { $unwind: { path: '$obj', preserveNullAndEmptyArrays: false } },
                { $match: { 'obj.districtId': { $in: districtIds } } },
                {
                    $group: {
                        _id: '$obj.districtId',
                        doneCount: { $sum: { $cond: [{ $eq: ['$verifications.status', 'done'] }, 1, 0] } },
                        totalCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id.toString(), s]));
        const objMap = new Map(objectStats.map(s => [s._id.toString(), s]));
        const verifMap = new Map(verificationStats.map(s => [s._id.toString(), s]));

        const rawScores = districts.map(dist => {
            const id = dist._id.toString();
            const area = dist.areaKm2 || 1;

            const issues = issueMap.get(id) || { total: 0, open: 0, resolved: 0, totalVotes: 0 };
            const objs = objMap.get(id) || { count: 0 };
            const verif = verifMap.get(id) || { doneCount: 0, totalCount: 0 };

            const openRatio = issues.total > 0 ? issues.open / issues.total : 0;
            const resolutionRate = issues.total > 0 ? issues.resolved / issues.total : 0;
            const issueDensity = issues.total / area;
            const objectDensity = objs.count / area;
            const verificationRate = verif.totalCount > 0 ? verif.doneCount / verif.totalCount : null;

            return {
                districtId: dist._id,
                districtName: dist.name,
                regionCode: dist.regionCode,
                areaKm2: area,
                centroid: dist.centroid?.coordinates,
                issueCount: issues.total,
                openCount: issues.open,
                resolvedCount: issues.resolved,
                totalVotes: issues.totalVotes,
                objectCount: objs.count,
                openRatio, resolutionRate, issueDensity, objectDensity, verificationRate
            };
        });

        const maxIssueDensity = Math.max(...rawScores.map(d => d.issueDensity), 0.001);
        const maxObjectDensity = Math.max(...rawScores.map(d => d.objectDensity), 0.001);

        const scored = rawScores.map(d => {
            // Нет обращений → 0 (активность не проявлялась, не "идеальный" район)
            const issueScore = d.issueCount === 0 ? 0 : Math.max(0, Math.round((1 - d.openRatio) * 100));
            const objectScore = Math.min(100, Math.round((d.objectDensity / maxObjectDensity) * 100));
            // Нет верификаций → 0, не нейтральные 50
            const verifScore = d.verificationRate !== null ? Math.round(d.verificationRate * 100) : 0;
            const composite = Math.round(issueScore * 0.40 + verifScore * 0.35 + objectScore * 0.25);

            return {
                ...d,
                scores: { composite, issues: issueScore, objects: objectScore, verification: verifScore }
            };
        });

        // Сортировка по активности пользователей (кол-во обращений), не по composite
        scored.sort((a, b) => b.issueCount - a.issueCount);

        scored.sort((a, b) => b.scores.composite - a.scores.composite);
        scored.forEach((d, i) => { d.rank = i + 1; });

        res.json({ success: true, data: { count: scored.length, districts: scored } });
    } catch (err) {
        console.error('District scoring error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute district scoring' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/districts/:id
// Deep-dive for a single district — used by DistrictDrilldown panel
// ─────────────────────────────────────────────

export const getDistrictDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const districtId = new mongoose.Types.ObjectId(id);

        const [district, issueResult, objectResult, taskResult] = await Promise.all([
            District.findById(id).lean(),

            Issue.aggregate([
                { $match: { districtId } },
                {
                    $facet: {
                        totals: [{ $group: { _id: null, total: { $sum: 1 }, totalVotes: { $sum: '$votes' } } }],
                        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                        list: [
                            { $sort: { votes: -1 } }, { $limit: 15 },
                            { $project: { title: 1, category: 1, severity: 1, status: 1, votes: 1 } }
                        ]
                    }
                }
            ]),

            Object_.aggregate([
                { $match: { districtId } },
                {
                    $facet: {
                        byType: [{ $group: { _id: '$objectType', count: { $sum: 1 } } }],
                        total: [{ $count: 'n' }],
                        list: [
                            { $sort: { name: 1 } }, { $limit: 20 },
                            { $project: { name: 1, objectType: 1, tuman: 1 } }
                        ]
                    }
                }
            ]),

            Task.aggregate([
                {
                    $lookup: {
                        from: 'objects', localField: 'targetId', foreignField: '_id', as: 'object'
                    }
                },
                { $unwind: { path: '$object', preserveNullAndEmptyArrays: false } },
                { $match: { 'object.districtId': districtId } },
                {
                    $group: {
                        _id: null,
                        totalTasks: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                        doneVerifs: { $sum: '$doneCount' },
                        totalVerifs: { $sum: '$totalCount' }
                    }
                }
            ])
        ]);

        if (!district) {
            return res.status(404).json({ success: false, error: 'District not found' });
        }

        const issueData = issueResult[0] || {};
        const objectData = objectResult[0] || {};
        const taskData = taskResult[0] || null;

        const byTypeMap = {};
        (objectData.byType || []).forEach(t => { byTypeMap[t._id] = t.count; });

        res.json({
            success: true,
            data: {
                district: {
                    id: district._id,
                    name: district.name,
                    regionCode: district.regionCode,
                    areaKm2: district.areaKm2
                },
                issues: {
                    total: issueData.totals?.[0]?.total || 0,
                    totalVotes: issueData.totals?.[0]?.totalVotes || 0,
                    byStatus: Object.fromEntries((issueData.byStatus || []).map(s => [s._id, s.count])),
                    list: issueData.list || []
                },
                objects: {
                    total: objectData.total?.[0]?.n || 0,
                    byType: byTypeMap,
                    list: (objectData.list || []).map(o => ({
                        id: o._id.toString(), name: o.name, objectType: o.objectType, tuman: o.tuman
                    }))
                },
                tasks: taskData ? {
                    total: taskData.totalTasks,
                    completed: taskData.completed,
                    inProgress: taskData.inProgress,
                    verificationRate: taskData.totalVerifs > 0
                        ? Math.round((taskData.doneVerifs / taskData.totalVerifs) * 100)
                        : null
                } : null
            }
        });
    } catch (err) {
        console.error('getDistrictDetail error:', err);
        res.status(500).json({ success: false, error: 'Failed to load district detail' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/regions/summary
// ─────────────────────────────────────────────

export const getRegionSummary = async (req, res) => {
    try {
        const [regions, issuesByRegion, objectsByRegion] = await Promise.all([
            Region.find({}).select('code name areaKm2').lean(),
            Issue.aggregate([
                { $match: { regionCode: { $exists: true } } },
                {
                    $group: {
                        _id: '$regionCode',
                        total: { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                }
            ]),
            Object_.aggregate([
                { $match: { regionCode: { $exists: true } } },
                { $group: { _id: '$regionCode', count: { $sum: 1 } } }
            ])
        ]);

        const issueMap = new Map(issuesByRegion.map(r => [r._id, r]));
        const objMap = new Map(objectsByRegion.map(r => [r._id, r]));

        const data = regions.map(r => {
            const issues = issueMap.get(r.code) || { total: 0, resolved: 0 };
            const objects = objMap.get(r.code) || { count: 0 };
            return {
                code: r.code,
                name: r.name,
                areaKm2: r.areaKm2,
                issueCount: issues.total,
                resolvedCount: issues.resolved,
                resolutionRate: issues.total > 0 ? Math.round((issues.resolved / issues.total) * 100) : null,
                objectCount: objects.count
            };
        });

        res.json({ success: true, data });
    } catch (err) {
        console.error('Region summary error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch region summary' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/budget
// Stub — no budget data on Objects from duasr.uz
// ─────────────────────────────────────────────

export const getBudgetAnalytics = async (req, res) => {
    res.json({
        success: true,
        data: { totals: {}, byDistrict: [], note: 'Budget data not available for current data sources' }
    });
};

// ─────────────────────────────────────────────
// GET /api/analytics/choropleth
// District scoring as GeoJSON for map layer
// Query: ?metric=composite|issues|objects|verification&regionCode=17
// ─────────────────────────────────────────────

export const getChoropleth = async (req, res) => {
    try {
        const { metric = 'composite', regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const districts = await District.find(regionFilter)
            .select('name regionCode areaKm2 geometry centroid')
            .lean();

        if (!districts.length) {
            return res.json({ type: 'FeatureCollection', metric, features: [] });
        }

        const districtIds = districts.map(d => d._id);

        const [issueStats, objectStats, verificationStats] = await Promise.all([
            Issue.aggregate([
                { $match: { districtId: { $in: districtIds } } },
                {
                    $group: {
                        _id: '$districtId',
                        total: { $sum: 1 },
                        open: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                }
            ]),
            Object_.aggregate([
                { $match: { districtId: { $in: districtIds } } },
                { $group: { _id: '$districtId', count: { $sum: 1 } } }
            ]),
            Task.aggregate([
                { $match: { 'verifications.0': { $exists: true } } },
                { $unwind: '$verifications' },
                {
                    $lookup: {
                        from: 'objects', localField: 'targetId', foreignField: '_id', as: 'obj'
                    }
                },
                { $unwind: { path: '$obj', preserveNullAndEmptyArrays: false } },
                { $match: { 'obj.districtId': { $in: districtIds } } },
                {
                    $group: {
                        _id: '$obj.districtId',
                        doneCount: { $sum: { $cond: [{ $eq: ['$verifications.status', 'done'] }, 1, 0] } },
                        totalCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id.toString(), s]));
        const objMap = new Map(objectStats.map(s => [s._id.toString(), s]));
        const verifMap = new Map(verificationStats.map(s => [s._id.toString(), s]));

        const raw = districts.map(dist => {
            const id = dist._id.toString();
            const area = dist.areaKm2 || 1;

            const issues = issueMap.get(id) || { total: 0, open: 0 };
            const objs = objMap.get(id) || { count: 0 };
            const verif = verifMap.get(id) || { doneCount: 0, totalCount: 0 };

            return {
                dist,
                issueCount: issues.total,
                openRatio: issues.total > 0 ? issues.open / issues.total : 0,
                objectDensity: objs.count / area,
                verificationRate: verif.totalCount > 0 ? verif.doneCount / verif.totalCount : null
            };
        });

        const maxObjectDensity = Math.max(...raw.map(r => r.objectDensity), 0.001);

        const features = raw.map(({ dist, issueCount, openRatio, objectDensity, verificationRate }) => {
            const issueScore = issueCount === 0 ? 0 : Math.max(0, Math.round((1 - openRatio) * 100));
            const objectScore = Math.min(100, Math.round((objectDensity / maxObjectDensity) * 100));
            const verifScore = verificationRate !== null ? Math.round(verificationRate * 100) : 0;
            const composite = Math.round(issueScore * 0.40 + verifScore * 0.35 + objectScore * 0.25);

            const scores = { composite, issues: issueScore, objects: objectScore, verification: verifScore };
            const value = scores[metric] ?? scores.composite;

            return {
                type: 'Feature',
                properties: {
                    districtId: dist._id.toString(),
                    name: dist.name,
                    regionCode: dist.regionCode,
                    areaKm2: dist.areaKm2,
                    value,
                    scores
                },
                geometry: dist.geometry
            };
        }).filter(f => f.geometry);

        res.json({ type: 'FeatureCollection', metric, features });
    } catch (err) {
        console.error('Choropleth error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate choropleth' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/trends
// Monthly issue time-series
// Query: ?months=12&category=Roads&regionCode=17
// ─────────────────────────────────────────────

export async function getTrends(req, res) {
    try {
        const months = Math.min(parseInt(req.query.months) || 12, 36);
        const category = req.query.category;
        const regionCode = req.query.regionCode ? parseInt(req.query.regionCode) : null;

        const since = new Date();
        since.setMonth(since.getMonth() - months);

        const match = { createdAt: { $gte: since } };
        if (category) match.category = category;
        if (regionCode) match.regionCode = regionCode;

        const [monthly, categoryBreakdown] = await Promise.all([
            Issue.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        total: { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        avgResolutionMs: {
                            $avg: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'Resolved'] }, { $ifNull: ['$resolvedAt', false] }] },
                                    { $subtract: ['$resolvedAt', '$createdAt'] },
                                    null
                                ]
                            }
                        }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$category', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } } } },
                { $sort: { total: -1 } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                monthly: monthly.map(m => ({
                    label: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
                    total: m.total,
                    resolved: m.resolved,
                    resolutionRate: m.total > 0 ? Math.round((m.resolved / m.total) * 100) : 0,
                    avgResolutionDays: m.avgResolutionMs
                        ? Math.round(m.avgResolutionMs / (1000 * 60 * 60 * 24) * 10) / 10
                        : null
                })),
                byCategory: categoryBreakdown
            }
        });
    } catch (err) {
        console.error('Trends error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch trends' });
    }
}

// ─────────────────────────────────────────────
// GET /api/analytics/resolution
// Resolution time stats
// ─────────────────────────────────────────────

export async function getResolution(req, res) {
    try {
        const regionCode = req.query.regionCode ? parseInt(req.query.regionCode) : null;
        const match = {};
        if (regionCode) match.regionCode = regionCode;

        const stats = await Issue.aggregate([
            { $match: { ...match, status: 'Resolved' } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgResolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                    totalVotes: { $sum: '$votes' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const bySeverity = await Issue.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$severity',
                    total: { $sum: 1 },
                    resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
                }
            }
        ]);

        res.json({ success: true, data: { byCategory: stats, bySeverity } });
    } catch (err) {
        console.error('Resolution error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch resolution stats' });
    }
}

// ─────────────────────────────────────────────
// GET /api/analytics/efficiency — stub (no budget data)
// ─────────────────────────────────────────────

export async function getEfficiency(req, res) {
    res.json({
        success: true,
        data: {
            summary: {}, districts: [], anomalies: [], objects: [],
            note: 'Budget efficiency not available for current data sources'
        }
    });
}

// ─────────────────────────────────────────────
// GET /api/analytics/district/:name — legacy endpoint
// Kept for backwards compat; redirects logic to getDistrictDetail via name lookup
// ─────────────────────────────────────────────

export async function getDistrictProfile(req, res) {
    try {
        const name = decodeURIComponent(req.params.name);
        const district = await District.findOne({
            $or: [
                { 'name.ru': name },
                { 'name.en': name },
                { 'name.uz': name }
            ]
        }).lean();

        if (!district) {
            return res.status(404).json({ success: false, error: 'District not found' });
        }

        // Delegate to the main detail handler by faking params
        req.params.id = district._id.toString();
        return getDistrictDetail(req, res);
    } catch (err) {
        console.error('getDistrictProfile error:', err);
        res.status(500).json({ success: false, error: 'Failed to load district profile' });
    }
}

export const getOvercrowdedFacilities = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const match = {
            'details.sigimi': { $gt: 0 },
            'details.umumiyUquvchi': { $gt: 0 }
        };
        if (regionCode) match.regionCode = parseInt(regionCode);

        const docs = await Object_.find(match)
            .select('name objectType viloyat tuman regionCode details lat lng')
            .lean();

        const overcrowded = docs
            .map(d => ({
                id: d._id.toString(),
                name: d.name,
                objectType: d.objectType,
                viloyat: d.viloyat,
                tuman: d.tuman,
                lat: d.lat,
                lng: d.lng,
                capacity: d.details.sigimi,
                enrollment: d.details.umumiyUquvchi,
                overloadPct: Math.round((d.details.umumiyUquvchi / d.details.sigimi) * 100)
            }))
            .filter(d => d.overloadPct > 100)
            .sort((a, b) => b.overloadPct - a.overloadPct);

        res.json({ success: true, data: { overcrowded, total: overcrowded.length } });
    } catch (err) {
        console.error('getOvercrowdedFacilities error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch overcrowded facilities' });
    }
};

// GET /api/analytics/problematic-facilities
// Объекты у которых: задачи с problem-верификациями ИЛИ оспоренные показатели
// Query: ?regionCode=17
export const getProblematicFacilities = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        // 1. Объекты с задачами где проблемных верификаций >= 50%
        const taskProblems = await Task.aggregate([
            { $match: { 'verifications.0': { $exists: true } } },
            { $unwind: '$verifications' },
            {
                $group: {
                    _id: '$targetId',
                    totalVerif: { $sum: 1 },
                    problemVerif: { $sum: { $cond: [{ $eq: ['$verifications.status', 'problem'] }, 1, 0] } }
                }
            },
            { $match: { $expr: { $gte: ['$problemVerif', { $divide: ['$totalVerif', 2] }] } } }
        ]);
        const taskProblemIds = taskProblems.map(t => t._id);

        // 2. Объекты с оспоренными показателями (indicator verifications disputed >= 50%)
        const IndicatorVerification = mongoose.model('IndicatorVerification');
        const indicatorProblems = await IndicatorVerification.aggregate([
            { $group: {
                _id: '$objectId',
                total: { $sum: 1 },
                disputed: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } }
            }},
            { $match: { $expr: { $gte: ['$disputed', { $divide: ['$total', 2] }] } } }
        ]);
        const indicatorProblemIds = indicatorProblems.map(i => i._id);

        // Объединяем уникальные ID
        const allProblemIds = [...new Set([
            ...taskProblemIds.map(id => id.toString()),
            ...indicatorProblemIds.map(id => id.toString())
        ])].map(id => new mongoose.Types.ObjectId(id));

        if (allProblemIds.length === 0) {
            return res.json({ success: true, data: { facilities: [], total: 0 } });
        }

        const facilities = await Object_.find({
            _id: { $in: allProblemIds },
            ...regionFilter
        })
        .select('name objectType viloyat tuman regionCode lat lng details')
        .lean();

        // Обогащаем данными о проблемах
        const taskProblemMap = new Map(taskProblems.map(t => [t._id.toString(), t]));
        const indicatorProblemMap = new Map(indicatorProblems.map(i => [i._id.toString(), i]));

        const result = facilities.map(f => {
            const id = f._id.toString();
            const tp = taskProblemMap.get(id);
            const ip = indicatorProblemMap.get(id);
            return {
                id,
                name: f.name,
                objectType: f.objectType,
                viloyat: f.viloyat,
                tuman: f.tuman,
                lat: f.lat,
                lng: f.lng,
                isOvercrowded: (f.details?.sigimi > 0 && f.details?.umumiyUquvchi > f.details?.sigimi),
                taskProblems: tp ? { problemVerif: tp.problemVerif, totalVerif: tp.totalVerif } : null,
                indicatorProblems: ip ? { disputed: ip.disputed, total: ip.total } : null,
            };
        });

        res.json({ success: true, data: { facilities: result, total: result.length } });
    } catch (err) {
        console.error('getProblematicFacilities error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch problematic facilities' });
    }
};