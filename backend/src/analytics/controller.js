// backend/src/analytics/controller.js
// objectType: 'school' | 'kindergarten' → education facilities
// objectType: 'health_post'             → health facilities
// Budget data now lives in BudgetAllocation, not on the Object_ documents.

import mongoose from 'mongoose';
import Object_ from '../object/model.js';
import Issue from '../issue/model.js';
import District from '../district/model.js';
import Region from '../region/model.js';
import Task from '../task/model.js';
import Program from '../program/model.js';
import BudgetAllocation from '../budgetAllocation/model.js';

const EDUCATION_TYPES = ['school', 'kindergarten'];
const HEALTH_TYPES = ['health_post'];

// ── GET /api/analytics/overview ───────────────────────────────────────────────
// Query: ?regionCode=17
export const getOverview = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};
        const issueFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [
            totalObjects,
            totalIssues,
            openIssues,
            resolvedIssues,
            totalTasks,
            completedTasks,
            totalPrograms,
            activePrograms
        ] = await Promise.all([
            Object_.countDocuments(regionFilter),
            Issue.countDocuments(issueFilter),
            Issue.countDocuments({ ...issueFilter, status: 'Open' }),
            Issue.countDocuments({ ...issueFilter, status: 'Resolved' }),
            Task.countDocuments(),
            Task.countDocuments({ status: 'Completed' }),
            Program.countDocuments(),
            Program.countDocuments({ status: 'active' })
        ]);

        const byObjectType = await Object_.aggregate([
            { $match: regionFilter },
            { $group: { _id: '$objectType', count: { $sum: 1 } } }
        ]);

        const objectTypeMap = {};
        byObjectType.forEach(t => { objectTypeMap[t._id] = t.count; });

        res.json({
            success: true,
            data: {
                objects: {
                    total: totalObjects,
                    byType: objectTypeMap
                },
                issues: {
                    total: totalIssues,
                    open: openIssues,
                    resolved: resolvedIssues,
                    resolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0
                },
                tasks: {
                    total: totalTasks,
                    completed: completedTasks,
                    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
                },
                programs: {
                    total: totalPrograms,
                    active: activePrograms
                }
            }
        });
    } catch (err) {
        console.error('Overview analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch overview' });
    }
};

// ── GET /api/analytics/issues ─────────────────────────────────────────────────
// Query: ?regionCode=17&districtId=xxx&period=30
export const getIssueAnalytics = async (req, res) => {
    try {
        const { regionCode, districtId, period = 90 } = req.query;

        const match = {};
        if (regionCode) match.regionCode = parseInt(regionCode);
        if (districtId && mongoose.isValidObjectId(districtId)) match.districtId = new mongoose.Types.ObjectId(districtId);

        const periodDate = new Date();
        periodDate.setDate(periodDate.getDate() - parseInt(period));

        const [byCategory, bySeverity, byStatus, monthlyTrend, topIssues] = await Promise.all([
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$category', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } } } }
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
                { $match: { ...match, createdAt: { $gte: periodDate } } },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            Issue.find(match).sort({ votes: -1 }).limit(10).select('title category severity status votes createdAt').lean()
        ]);

        const statusMap = {};
        const severityMap = {};
        byStatus.forEach(s => { statusMap[s._id] = s.count; });
        bySeverity.forEach(s => { severityMap[s._id] = s.count; });

        res.json({
            success: true,
            data: {
                byCategory,
                bySeverity: severityMap,
                byStatus: statusMap,
                monthlyTrend,
                topIssues
            }
        });
    } catch (err) {
        console.error('Issue analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch issue analytics' });
    }
};

// ── GET /api/analytics/objects ────────────────────────────────────────────────
// Query: ?regionCode=17
export const getInfraAnalytics = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const match = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [byType, byRegion, byDistrict] = await Promise.all([
            Object_.aggregate([
                { $match: match },
                { $group: { _id: '$objectType', count: { $sum: 1 } } }
            ]),
            Object_.aggregate([
                { $match: { ...match, viloyat: { $exists: true, $ne: null } } },
                { $group: { _id: '$viloyat', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            Object_.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                { $group: { _id: '$districtId', regionCode: { $first: '$regionCode' }, count: { $sum: 1 } } },
                { $lookup: { from: 'districts', localField: '_id', foreignField: '_id', as: 'district' } },
                { $unwind: '$district' },
                { $project: { districtId: '$_id', districtName: '$district.name', regionCode: 1, count: 1 } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.json({
            success: true,
            data: { byType, byRegion, byDistrict }
        });
    } catch (err) {
        console.error('Objects analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch object analytics' });
    }
};

// ── GET /api/analytics/tasks ──────────────────────────────────────────────────
// Query: ?programId=xxx&regionCode=17
export const getTaskAnalytics = async (req, res) => {
    try {
        const { programId, regionCode } = req.query;

        const match = {};
        if (programId && mongoose.isValidObjectId(programId)) match.programId = new mongoose.Types.ObjectId(programId);

        const [byStatus, verificationStats, recentVerifications] = await Promise.all([
            Task.aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Task.aggregate([
                { $match: match },
                {
                    $project: {
                        doneCount: { $size: { $filter: { input: '$verifications', as: 'v', cond: { $eq: ['$$v.status', 'done'] } } } },
                        problemCount: { $size: { $filter: { input: '$verifications', as: 'v', cond: { $eq: ['$$v.status', 'problem'] } } } },
                        totalCount: { $size: '$verifications' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDone: { $sum: '$doneCount' },
                        totalProblem: { $sum: '$problemCount' },
                        totalVerifications: { $sum: '$totalCount' }
                    }
                }
            ]),
            Task.aggregate([
                { $match: match },
                { $unwind: '$verifications' },
                { $sort: { 'verifications.createdAt': -1 } },
                { $limit: 20 },
                { $project: { title: 1, 'verifications.userName': 1, 'verifications.status': 1, 'verifications.comment': 1, 'verifications.createdAt': 1 } }
            ])
        ]);

        const statusMap = {};
        byStatus.forEach(s => { statusMap[s._id] = s.count; });

        const vs = verificationStats[0] || { totalDone: 0, totalProblem: 0, totalVerifications: 0 };

        res.json({
            success: true,
            data: {
                byStatus: statusMap,
                verifications: {
                    total: vs.totalVerifications,
                    done: vs.totalDone,
                    problem: vs.totalProblem
                },
                recentVerifications
            }
        });
    } catch (err) {
        console.error('Task analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch task analytics' });
    }
};

// ── GET /api/analytics/programs ───────────────────────────────────────────────
export const getProgramAnalytics = async (req, res) => {
    try {
        const programs = await Program.find().lean();

        const programIds = programs.map(p => p._id);

        const tasksByProgram = await Task.aggregate([
            { $match: { programId: { $in: programIds } } },
            {
                $group: {
                    _id: '$programId',
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending Verification'] }, 1, 0] } },
                    totalVerifications: { $sum: { $size: '$verifications' } },
                    doneVerifications: {
                        $sum: {
                            $size: { $filter: { input: '$verifications', as: 'v', cond: { $eq: ['$$v.status', 'done'] } } }
                        }
                    }
                }
            }
        ]);

        const taskMap = {};
        tasksByProgram.forEach(t => { taskMap[t._id.toString()] = t; });

        const data = programs.map(p => {
            const stats = taskMap[p._id.toString()] || { total: 0, completed: 0, pending: 0, totalVerifications: 0, doneVerifications: 0 };
            return {
                id: p._id.toString(),
                name: p.name,
                number: p.number,
                status: p.status,
                deadline: p.deadline,
                totalBudget: p.totalBudget,
                currency: p.currency,
                objectCount: p.objectIds?.length || 0,
                tasks: {
                    total: stats.total,
                    completed: stats.completed,
                    pending: stats.pending,
                    completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
                    verifications: stats.totalVerifications,
                    doneVerifications: stats.doneVerifications
                }
            };
        });

        res.json({ success: true, data });
    } catch (err) {
        console.error('Program analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch program analytics' });
    }
};

// ── GET /api/analytics/districts/scoring ─────────────────────────────────────
// Query: ?regionCode=17
export const getDistrictScoring = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [objectsByDistrict, issuesByDistrict, districts] = await Promise.all([
            Object_.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        objectCount: { $sum: 1 },
                        educationCount: { $sum: { $cond: [{ $in: ['$objectType', EDUCATION_TYPES] }, 1, 0] } },
                        healthCount: { $sum: { $cond: [{ $in: ['$objectType', HEALTH_TYPES] }, 1, 0] } }
                    }
                }
            ]),
            Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        totalIssues: { $sum: 1 },
                        openIssues: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                }
            ]),
            District.find(regionFilter).select('code regionCode name areaKm2 centroid').lean()
        ]);

        const objMap = new Map(objectsByDistrict.map(d => [d._id?.toString(), d]));
        const issueMap = new Map(issuesByDistrict.map(d => [d._id?.toString(), d]));

        const maxObjects = Math.max(...objectsByDistrict.map(d => d.objectCount), 1);

        const scored = districts.map(dist => {
            const id = dist._id.toString();
            const objs = objMap.get(id) || { objectCount: 0, educationCount: 0, healthCount: 0 };
            const issues = issueMap.get(id) || { totalIssues: 0, openIssues: 0 };

            const deficitScore = Math.round((1 - objs.objectCount / maxObjects) * 100);
            const issuePressure = issues.totalIssues > 0
                ? Math.round((issues.openIssues / issues.totalIssues) * 100)
                : 0;
            const composite = Math.round(deficitScore * 0.6 + issuePressure * 0.4);

            return {
                districtId: id,
                districtName: dist.name,
                regionCode: dist.regionCode,
                objectCount: objs.objectCount,
                educationCount: objs.educationCount,
                healthCount: objs.healthCount,
                openIssues: issues.openIssues,
                scores: { deficit: deficitScore, issuePressure, composite }
            };
        });

        scored.sort((a, b) => b.scores.composite - a.scores.composite);

        res.json({ success: true, data: scored });
    } catch (err) {
        console.error('District scoring error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute district scoring' });
    }
};

// ── GET /api/analytics/districts/:id ─────────────────────────────────────────
export const getDistrictDetail = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid district id' });
        }

        const districtObjId = new mongoose.Types.ObjectId(id);

        const [district, objects, issues] = await Promise.all([
            District.findById(id).lean(),
            Object_.find({ districtId: districtObjId }).select('name objectType sourceApi viloyat').lean(),
            Issue.find({ districtId: districtObjId }).select('title category severity status votes createdAt').sort({ createdAt: -1 }).limit(50).lean()
        ]);

        if (!district) {
            return res.status(404).json({ success: false, message: 'District not found' });
        }

        const byObjectType = {};
        objects.forEach(o => { byObjectType[o.objectType] = (byObjectType[o.objectType] || 0) + 1; });

        res.json({
            success: true,
            data: {
                district: { id, name: district.name, regionCode: district.regionCode, areaKm2: district.areaKm2 },
                objects: { total: objects.length, byType: byObjectType, list: objects.slice(0, 100) },
                issues: { total: issues.length, list: issues }
            }
        });
    } catch (err) {
        console.error('District detail error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch district detail' });
    }
};

// ── GET /api/analytics/regions/summary ───────────────────────────────────────
export const getRegionSummary = async (req, res) => {
    try {
        const [objectsByRegion, issuesByRegion, regions] = await Promise.all([
            Object_.aggregate([
                { $match: { regionCode: { $exists: true } } },
                { $group: { _id: '$regionCode', count: { $sum: 1 } } }
            ]),
            Issue.aggregate([
                { $match: { regionCode: { $exists: true } } },
                { $group: { _id: '$regionCode', total: { $sum: 1 }, open: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } } } }
            ]),
            Region.find().select('code name').lean()
        ]);

        const objMap = new Map(objectsByRegion.map(r => [r._id, r.count]));
        const issueMap = new Map(issuesByRegion.map(r => [r._id, r]));

        const data = regions.map(r => ({
            regionCode: r.code,
            name: r.name,
            objectCount: objMap.get(r.code) || 0,
            issues: issueMap.get(r.code) || { total: 0, open: 0 }
        }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('Region summary error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch region summary' });
    }
};

// ── GET /api/analytics/budget ─────────────────────────────────────────────────
// Query: ?regionCode=17
export const getBudgetAnalytics = async (req, res) => {
    try {
        const { regionCode } = req.query;

        const allocFilter = {};

        const [allocationsByType, allocationsByPeriod, programBudgets] = await Promise.all([
            BudgetAllocation.aggregate([
                { $match: allocFilter },
                { $group: { _id: '$targetType', totalAmount: { $sum: '$amount' }, count: { $sum: 1 }, currencies: { $addToSet: '$currency' } } }
            ]),
            BudgetAllocation.aggregate([
                { $match: { ...allocFilter, period: { $exists: true, $ne: null } } },
                { $group: { _id: '$period', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { _id: -1 } },
                { $limit: 12 }
            ]),
            Program.aggregate([
                { $match: regionCode ? { 'scope.regionCode': parseInt(regionCode) } : {} },
                {
                    $group: {
                        _id: '$status',
                        totalBudget: { $sum: '$totalBudget' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const byType = {};
        allocationsByType.forEach(a => { byType[a._id] = { total: a.totalAmount, count: a.count }; });

        const programByStatus = {};
        programBudgets.forEach(p => { programByStatus[p._id] = { totalBudget: p.totalBudget, count: p.count }; });

        res.json({
            success: true,
            data: {
                allocationsByType: byType,
                allocationsByPeriod,
                programsByStatus: programByStatus
            }
        });
    } catch (err) {
        console.error('Budget analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch budget analytics' });
    }
};

// ── GET /api/analytics/choropleth ─────────────────────────────────────────────
// Query: ?metric=objects|issues|tasks&regionCode=17
export const getChoropleth = async (req, res) => {
    try {
        const { metric = 'objects', regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        let aggregation;
        if (metric === 'issues') {
            aggregation = Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                { $group: { _id: '$districtId', value: { $sum: 1 } } }
            ]);
        } else if (metric === 'tasks') {
            aggregation = Task.aggregate([
                { $group: { _id: '$targetId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } }
            ]);
        } else {
            // default: objects per district
            aggregation = Object_.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                { $group: { _id: '$districtId', value: { $sum: 1 } } }
            ]);
        }

        const rows = await aggregation;
        const data = rows.map(r => ({ districtId: r._id?.toString(), value: r.value ?? r.total ?? 0 }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('Choropleth error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch choropleth data' });
    }
};

// ── GET /api/analytics/trends ─────────────────────────────────────────────────
export const getTrends = async (req, res) => {
    try {
        const { regionCode, period = 90 } = req.query;
        const since = new Date();
        since.setDate(since.getDate() - parseInt(period));

        const match = { createdAt: { $gte: since } };
        if (regionCode) match.regionCode = parseInt(regionCode);

        const [issueTrend, taskTrend] = await Promise.all([
            Issue.aggregate([
                { $match: match },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]),
            Task.aggregate([
                { $match: { updatedAt: { $gte: since }, status: 'Completed' } },
                { $group: { _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' }, day: { $dayOfMonth: '$updatedAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ])
        ]);

        res.json({ success: true, data: { issueTrend, taskTrend } });
    } catch (err) {
        console.error('Trends error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch trends' });
    }
};

// ── GET /api/analytics/efficiency ────────────────────────────────────────────
export const getEfficiency = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const objFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [taskStats, verificationStats, programStats] = await Promise.all([
            Task.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),
            Task.aggregate([
                {
                    $project: {
                        doneCount: { $size: { $filter: { input: '$verifications', as: 'v', cond: { $eq: ['$$v.status', 'done'] } } } },
                        problemCount: { $size: { $filter: { input: '$verifications', as: 'v', cond: { $eq: ['$$v.status', 'problem'] } } } }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDone: { $sum: '$doneCount' },
                        totalProblem: { $sum: '$problemCount' }
                    }
                }
            ]),
            Program.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, totalBudget: { $sum: '$totalBudget' } } }
            ])
        ]);

        const statusMap = {};
        taskStats.forEach(t => { statusMap[t._id] = t.count; });

        const totalTasks = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const completed = statusMap['Completed'] || 0;

        const vs = verificationStats[0] || { totalDone: 0, totalProblem: 0 };

        const pgByStatus = {};
        programStats.forEach(p => { pgByStatus[p._id] = { count: p.count, totalBudget: p.totalBudget }; });

        res.json({
            success: true,
            data: {
                summary: {
                    totalTasks,
                    completedTasks: completed,
                    completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
                    totalVerifications: (vs.totalDone + vs.totalProblem),
                    doneVerifications: vs.totalDone,
                    citizenSatisfactionRate: (vs.totalDone + vs.totalProblem) > 0
                        ? Math.round((vs.totalDone / (vs.totalDone + vs.totalProblem)) * 100)
                        : 0
                },
                tasksByStatus: statusMap,
                programsByStatus: pgByStatus
            }
        });
    } catch (err) {
        console.error('Efficiency error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch efficiency data' });
    }
};

// Keep remaining endpoints exported so analytics/routes.js doesn't break.
// These are stubs that can be fleshed out as needed.
export const getCropAnalytics = (req, res) => res.json({ success: true, data: [] });
export const getResolution = getEfficiency;  // alias
export const getDistrictProfile = getDistrictDetail; // alias