// backend/src/openbudget/controller.js
//
// Priority Index = weighted composite of:
//   - Issue burden   (40%): unresolved issues weighted by severity
//   - Task gap       (25%): incomplete tasks / total tasks ratio
//   - Community signal (20%): total votes on linked issues
//   - Verification pressure (15%): problem verifications ratio

import mongoose from 'mongoose';
import Object_ from '../object/model.js';
import Issue from '../issue/model.js';
import Task from '../task/model.js';
import BudgetAllocation from '../budgetAllocation/model.js';

const SEVERITY_WEIGHTS = { Critical: 10, High: 5, Medium: 2, Low: 1 };
const EDUCATION_TYPES  = ['school', 'kindergarten'];
const HEALTH_TYPES     = ['health_post'];

// ── GET /api/openbudget/scoring ───────────────────────────────────────────────
// Ranked list of all objects by funding priority
// Query: ?objectType=school&viloyat=Toshkent&limit=50&offset=0&sort=priorityScore&order=desc
export const getOrgScoring = async (req, res) => {
    try {
        const {
            objectType,
            viloyat,
            limit  = 50,
            offset = 0,
            sort   = 'priorityScore',
            order  = 'desc'
        } = req.query;

        const objFilter = {};
        if (objectType) objFilter.objectType = objectType;
        if (viloyat)    objFilter.viloyat     = viloyat;

        const objects = await Object_.find(objFilter)
            .select('name objectType sourceApi lat lng viloyat tuman regionCode districtId')
            .lean();

        if (objects.length === 0) {
            return res.json({ success: true, data: { total: 0, orgs: [] } });
        }

        const objectIds = objects.map(o => o._id.toString());

        // Issue stats per object — single aggregation
        const issueStats = await Issue.aggregate([
            { $match: { objectId: { $in: objectIds } } },
            {
                $group: {
                    _id:            '$objectId',
                    totalIssues:    { $sum: 1 },
                    openIssues:     { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } },
                    resolvedIssues: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                    criticalCount:  { $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] } },
                    highCount:      { $sum: { $cond: [{ $eq: ['$severity', 'High'] }, 1, 0] } },
                    mediumCount:    { $sum: { $cond: [{ $eq: ['$severity', 'Medium'] }, 1, 0] } },
                    lowCount:       { $sum: { $cond: [{ $eq: ['$severity', 'Low'] }, 1, 0] } },
                    totalVotes:     { $sum: '$votes' }
                }
            }
        ]);

        // Task stats per object — single aggregation
        const taskStats = await Task.aggregate([
            { $match: { targetId: { $in: objects.map(o => o._id) } } },
            {
                $group: {
                    _id:          '$targetId',
                    totalTasks:   { $sum: 1 },
                    completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                    problemVerifications: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: '$verifications',
                                    as:    'v',
                                    cond:  { $eq: ['$$v.status', 'problem'] }
                                }
                            }
                        }
                    },
                    totalVerifications: { $sum: { $size: '$verifications' } }
                }
            }
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id, s]));
        const taskMap  = new Map(taskStats.map(s => [s._id.toString(), s]));

        const maxVotes = Math.max(...issueStats.map(s => s.totalVotes), 1);
        const maxBurden = Math.max(
            ...issueStats.map(s =>
                (s.criticalCount  * SEVERITY_WEIGHTS.Critical) +
                (s.highCount      * SEVERITY_WEIGHTS.High) +
                (s.mediumCount    * SEVERITY_WEIGHTS.Medium) +
                (s.lowCount       * SEVERITY_WEIGHTS.Low)
            ), 1
        );

        const scored = objects.map(obj => {
            const id     = obj._id.toString();
            const issues = issueMap.get(id) || { totalIssues: 0, openIssues: 0, resolvedIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalVotes: 0 };
            const tasks  = taskMap.get(id)  || { totalTasks: 0, completedTasks: 0, problemVerifications: 0, totalVerifications: 0 };

            const rawBurden = (issues.criticalCount * SEVERITY_WEIGHTS.Critical) +
                              (issues.highCount     * SEVERITY_WEIGHTS.High) +
                              (issues.mediumCount   * SEVERITY_WEIGHTS.Medium) +
                              (issues.lowCount      * SEVERITY_WEIGHTS.Low);

            const issueBurden      = Math.round((rawBurden / maxBurden) * 100);
            const taskGap          = tasks.totalTasks > 0 ? Math.round((1 - tasks.completedTasks / tasks.totalTasks) * 100) : 0;
            const communitySignal  = Math.min(Math.round((issues.totalVotes / maxVotes) * 100), 100);
            const verificationPressure = tasks.totalVerifications > 0
                ? Math.round((tasks.problemVerifications / tasks.totalVerifications) * 100)
                : 0;

            const priorityScore = Math.round(
                issueBurden         * 0.40 +
                taskGap             * 0.25 +
                communitySignal     * 0.20 +
                verificationPressure * 0.15
            );

            return {
                orgId:      id,
                name:       obj.name,
                objectType: obj.objectType,
                sourceApi:  obj.sourceApi,
                lat:        obj.lat,
                lng:        obj.lng,
                viloyat:    obj.viloyat,
                tuman:      obj.tuman,
                regionCode: obj.regionCode,
                issues: {
                    total:      issues.totalIssues,
                    open:       issues.openIssues,
                    resolved:   issues.resolvedIssues,
                    critical:   issues.criticalCount,
                    high:       issues.highCount,
                    medium:     issues.mediumCount,
                    low:        issues.lowCount,
                    totalVotes: issues.totalVotes
                },
                tasks: {
                    total:     tasks.totalTasks,
                    completed: tasks.completedTasks,
                    taskGap
                },
                scores: {
                    priorityScore,
                    issueBurden,
                    taskGap,
                    communitySignal,
                    verificationPressure
                }
            };
        });

        // Sort
        scored.sort((a, b) => {
            const aVal = sort === 'name' ? a.name : (a.scores[sort] ?? a.scores.priorityScore);
            const bVal = sort === 'name' ? b.name : (b.scores[sort] ?? b.scores.priorityScore);
            if (order === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

        // Assign ranks after sorting by priorityScore
        const byPriority = [...scored].sort((a, b) => b.scores.priorityScore - a.scores.priorityScore);
        byPriority.forEach((o, i) => { o.rank = i + 1; });

        const total = scored.length;

        const summary = {
            totalObjects:     total,
            criticalPriority: scored.filter(o => o.scores.priorityScore >= 70).length,
            highPriority:     scored.filter(o => o.scores.priorityScore >= 40 && o.scores.priorityScore < 70).length,
            lowPriority:      scored.filter(o => o.scores.priorityScore < 40).length,
            totalOpenIssues:  scored.reduce((s, o) => s + o.issues.open, 0)
        };

        const paginated = scored.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            data: { summary, total, limit: parseInt(limit), offset: parseInt(offset), orgs: paginated }
        });
    } catch (err) {
        console.error('OpenBudget scoring error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute scoring' });
    }
};

// ── GET /api/openbudget/org/:id ───────────────────────────────────────────────
// Single object detail with full scoring breakdown + linked tasks + allocations
export const getOrgDetail = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, error: 'Invalid id' });
        }

        const obj = await Object_.findById(id).lean();
        if (!obj) {
            return res.status(404).json({ success: false, error: 'Object not found' });
        }

        const [issues, tasks, allocations] = await Promise.all([
            Issue.find({ objectId: id })
                .select('title category severity status votes createdAt')
                .sort({ votes: -1 })
                .lean(),
            Task.find({ targetId: id })
                .select('title status deadline verifications programId')
                .sort({ createdAt: -1 })
                .lean(),
            BudgetAllocation.find({ targetType: 'object', targetId: id })
                .sort({ createdAt: -1 })
                .lean()
        ]);

        const openIssues     = issues.filter(i => i.status !== 'Resolved');
        const resolvedIssues = issues.filter(i => i.status === 'Resolved');

        const severityBreakdown = {};
        const categoryBreakdown = {};
        issues.forEach(i => {
            severityBreakdown[i.severity] = (severityBreakdown[i.severity] || 0) + 1;
            categoryBreakdown[i.category] = (categoryBreakdown[i.category] || 0) + 1;
        });

        const totalAllocated = allocations.reduce((s, a) => s + (a.amount || 0), 0);

        res.json({
            success: true,
            data: {
                object: {
                    id:         obj._id.toString(),
                    name:       obj.name,
                    objectType: obj.objectType,
                    sourceApi:  obj.sourceApi,
                    viloyat:    obj.viloyat,
                    tuman:      obj.tuman,
                    lat:        obj.lat,
                    lng:        obj.lng,
                    details:    obj.details
                },
                issues: {
                    total:              issues.length,
                    open:               openIssues.length,
                    resolved:           resolvedIssues.length,
                    severityBreakdown,
                    categoryBreakdown,
                    totalVotes:         issues.reduce((s, i) => s + (i.votes || 0), 0),
                    topIssues:          issues.slice(0, 10).map(i => ({
                        id: i._id.toString(), title: i.title, category: i.category,
                        severity: i.severity, status: i.status, votes: i.votes || 0, createdAt: i.createdAt
                    }))
                },
                tasks: tasks.map(t => ({
                    id:            t._id.toString(),
                    title:         t.title,
                    status:        t.status,
                    deadline:      t.deadline,
                    programId:     t.programId?.toString() || null,
                    totalCount:    t.verifications?.length || 0,
                    doneCount:     t.verifications?.filter(v => v.status === 'done').length || 0,
                    problemCount:  t.verifications?.filter(v => v.status === 'problem').length || 0
                })),
                budget: {
                    totalAllocated,
                    allocations: allocations.map(a => ({
                        id: a._id.toString(), amount: a.amount, currency: a.currency,
                        period: a.period, note: a.note
                    }))
                }
            }
        });
    } catch (err) {
        console.error('OpenBudget detail error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch object detail' });
    }
};

// ── GET /api/openbudget/deficit ───────────────────────────────────────────────
// Facility Deficit Index per district
// (max_in_region − actual) / max × 100 — higher = more underfunded
// Query: ?regionCode=17
export const getDeficitIndex = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter   = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [objectsByDistrict, issuesByDistrict] = await Promise.all([
            Object_.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id:            '$districtId',
                        objectCount:    { $sum: 1 },
                        educationCount: { $sum: { $cond: [{ $in: ['$objectType', EDUCATION_TYPES] }, 1, 0] } },
                        healthCount:    { $sum: { $cond: [{ $in: ['$objectType', HEALTH_TYPES]    }, 1, 0] } }
                    }
                }
            ]),
            Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id:         '$districtId',
                        totalIssues: { $sum: 1 },
                        openIssues:  { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const objMap   = new Map(objectsByDistrict.map(d => [d._id?.toString(), d]));
        const issueMap = new Map(issuesByDistrict.map(d => [d._id?.toString(), d]));

        const maxEducation = Math.max(...objectsByDistrict.map(d => d.educationCount), 1);
        const maxHealth    = Math.max(...objectsByDistrict.map(d => d.healthCount),    1);

        const allIds = new Set([
            ...objectsByDistrict.map(d => d._id?.toString()),
            ...issuesByDistrict.map(d =>  d._id?.toString())
        ]);

        const deficits = Array.from(allIds).filter(Boolean).map(districtId => {
            const objs   = objMap.get(districtId)   || { objectCount: 0, educationCount: 0, healthCount: 0 };
            const issues = issueMap.get(districtId) || { totalIssues: 0, openIssues: 0 };

            const educationDeficit = Math.round((1 - objs.educationCount / maxEducation) * 100);
            const healthDeficit    = Math.round((1 - objs.healthCount    / maxHealth)    * 100);

            const issuePressure = issues.totalIssues > 0
                ? Math.min(Math.round((issues.openIssues / issues.totalIssues) * 100), 100)
                : 0;

            const composite = Math.round(
                educationDeficit * 0.40 +
                healthDeficit    * 0.40 +
                issuePressure    * 0.20
            );

            return {
                districtId,
                facilityCount:    objs.objectCount,
                educationCount:   objs.educationCount,
                healthCount:      objs.healthCount,
                openIssues:       issues.openIssues,
                deficits: {
                    education:    educationDeficit,
                    health:       healthDeficit,
                    issuePressure,
                    composite
                }
            };
        });

        deficits.sort((a, b) => b.deficits.composite - a.deficits.composite);

        res.json({ success: true, data: deficits });
    } catch (err) {
        console.error('Deficit index error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute deficit index' });
    }
};