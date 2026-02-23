/**
 * Analytics Controller
 * 
 * Aggregation-based analytics endpoints for the geoportal.
 * All data comes from real MongoDB collections — no mock data.
 */

import mongoose from 'mongoose';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import Issue from '../issue/model.js';
import District from '../district/model.js';
import Region from '../region/model.js';

// ─────────────────────────────────────────────
// GET /api/analytics/overview
// System-wide summary across all collections
// ─────────────────────────────────────────────

export const getOverview = async (req, res) => {
    try {
        const [
            orgCount,
            infraCount,
            issueCount,
            regionCount,
            districtCount,
            issuesByStatus,
            issuesBySeverity,
            budgetTotals
        ] = await Promise.all([
            Organization.countDocuments(),
            Infrastructure.countDocuments(),
            Issue.countDocuments(),
            Region.countDocuments(),
            District.countDocuments(),
            Issue.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Issue.aggregate([
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            // Combined budget from orgs + infra
            Promise.all([
                Organization.aggregate([
                    {
                        $group: {
                            _id: null,
                            committedUZS: { $sum: '$budget.committedUZS' },
                            spentUZS: { $sum: '$budget.spentUZS' },
                            committedUSD: { $sum: '$budget.committedUSD' },
                            spentUSD: { $sum: '$budget.spentUSD' }
                        }
                    }
                ]),
                Infrastructure.aggregate([
                    {
                        $group: {
                            _id: null,
                            committedUZS: { $sum: '$budget.committedUZS' },
                            spentUZS: { $sum: '$budget.spentUZS' },
                            committedUSD: { $sum: '$budget.committedUSD' },
                            spentUSD: { $sum: '$budget.spentUSD' }
                        }
                    }
                ])
            ])
        ]);

        const statusMap = {};
        for (const s of issuesByStatus) statusMap[s._id] = s.count;

        const severityMap = {};
        for (const s of issuesBySeverity) severityMap[s._id] = s.count;

        const orgBudget = budgetTotals[0][0] || {};
        const infraBudget = budgetTotals[1][0] || {};

        const resolutionRate = issueCount > 0
            ? Math.round(((statusMap['Resolved'] || 0) / issueCount) * 1000) / 10
            : 0;

        const totalCommitted = (orgBudget.committedUZS || 0) + (infraBudget.committedUZS || 0);
        const totalSpent = (orgBudget.spentUZS || 0) + (infraBudget.spentUZS || 0);
        const executionRate = totalCommitted > 0
            ? Math.round((totalSpent / totalCommitted) * 1000) / 10
            : 0;

        res.json({
            success: true,
            data: {
                counts: {
                    organizations: orgCount,
                    infrastructure: infraCount,
                    issues: issueCount,
                    regions: regionCount,
                    districts: districtCount
                },
                issues: {
                    byStatus: statusMap,
                    bySeverity: severityMap,
                    resolutionRate
                },
                budget: {
                    committedUZS: totalCommitted,
                    spentUZS: totalSpent,
                    committedUSD: (orgBudget.committedUSD || 0) + (infraBudget.committedUSD || 0),
                    spentUSD: (orgBudget.spentUSD || 0) + (infraBudget.spentUSD || 0),
                    executionRate
                }
            }
        });
    } catch (err) {
        console.error('Analytics overview error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch analytics overview' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/issues
// Issue analytics with optional region/district filter
// Query: ?regionCode=17&districtId=xxx&period=90
// ─────────────────────────────────────────────

export const getIssueAnalytics = async (req, res) => {
    try {
        const { regionCode, districtId, period } = req.query;

        const match = {};
        if (regionCode) match.regionCode = parseInt(regionCode);
        if (districtId) match.districtId = new mongoose.Types.ObjectId(districtId);

        // Period filter (days)
        if (period) {
            const since = new Date();
            since.setDate(since.getDate() - parseInt(period));
            match.createdAt = { $gte: since };
        }

        const [
            byCategory,
            bySeverity,
            byStatus,
            byDistrict,
            trends,
            topVoted,
            totalCount
        ] = await Promise.all([
            // Category breakdown
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$category', count: { $sum: 1 }, avgVotes: { $avg: '$votes' } } },
                { $sort: { count: -1 } }
            ]),
            // Severity breakdown
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            // Status breakdown
            Issue.aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // By district (top 20)
            Issue.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        count: { $sum: 1 },
                        openCount: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                        resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] } },
                        totalVotes: { $sum: '$votes' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 },
                {
                    $lookup: {
                        from: 'districts',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'district'
                    }
                },
                { $unwind: '$district' },
                {
                    $project: {
                        districtId: '$_id',
                        districtName: '$district.name',
                        regionCode: 1,
                        count: 1,
                        openCount: 1,
                        resolvedCount: 1,
                        criticalCount: 1,
                        totalVotes: 1,
                        resolutionRate: {
                            $cond: [
                                { $gt: ['$count', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$resolvedCount', '$count'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                }
            ]),
            // Monthly trend (last 12 months)
            Issue.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ]),
            // Top voted issues
            Issue.find(match)
                .sort({ votes: -1 })
                .limit(10)
                .select('title category severity status votes createdAt')
                .lean(),
            // Total count
            Issue.countDocuments(match)
        ]);

        // Compute density per km² if filtering by region/district
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
                    year: t._id.year,
                    month: t._id.month,
                    count: t.count,
                    resolved: t.resolved
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
// Infrastructure & organization coverage
// Query: ?regionCode=17&districtId=xxx
// ─────────────────────────────────────────────

export const getInfraAnalytics = async (req, res) => {
    try {
        const { regionCode, districtId } = req.query;

        const match = {};
        if (regionCode) match.regionCode = parseInt(regionCode);
        if (districtId) match.districtId = new mongoose.Types.ObjectId(districtId);

        const [orgsByType, infraByType, orgBudgetByDistrict, infraBudgetByDistrict] = await Promise.all([
            // Orgs by type per district
            Organization.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { districtId: '$districtId', type: '$type' },
                        regionCode: { $first: '$regionCode' },
                        count: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            // Infra by type per district
            Infrastructure.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { districtId: '$districtId', type: '$type' },
                        regionCode: { $first: '$regionCode' },
                        count: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            // Org budget per district
            Organization.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        orgCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                {
                    $lookup: {
                        from: 'districts',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'district'
                    }
                },
                { $unwind: '$district' },
                {
                    $project: {
                        districtId: '$_id',
                        districtName: '$district.name',
                        regionCode: 1,
                        orgCount: 1,
                        areaKm2: '$district.areaKm2',
                        committedUZS: 1,
                        spentUZS: 1,
                        committedUSD: 1,
                        spentUSD: 1,
                        density: {
                            $cond: [
                                { $gt: ['$district.areaKm2', 0] },
                                { $round: [{ $divide: ['$orgCount', '$district.areaKm2'] }, 2] },
                                0
                            ]
                        },
                        executionRate: {
                            $cond: [
                                { $gt: ['$committedUZS', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$spentUZS', '$committedUZS'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                },
                { $sort: { orgCount: -1 } }
            ]),
            // Infra budget per district
            Infrastructure.aggregate([
                { $match: { ...match, districtId: { $exists: true } } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        infraCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                {
                    $lookup: {
                        from: 'districts',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'district'
                    }
                },
                { $unwind: '$district' },
                {
                    $project: {
                        districtId: '$_id',
                        districtName: '$district.name',
                        regionCode: 1,
                        infraCount: 1,
                        areaKm2: '$district.areaKm2',
                        committedUZS: 1,
                        spentUZS: 1,
                        committedUSD: 1,
                        spentUSD: 1,
                        density: {
                            $cond: [
                                { $gt: ['$district.areaKm2', 0] },
                                { $round: [{ $divide: ['$infraCount', '$district.areaKm2'] }, 2] },
                                0
                            ]
                        },
                        executionRate: {
                            $cond: [
                                { $gt: ['$committedUZS', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$spentUZS', '$committedUZS'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                },
                { $sort: { infraCount: -1 } }
            ])
        ]);

        // Aggregate type totals
        const typeSummary = {};
        for (const row of [...orgsByType, ...infraByType]) {
            const type = row._id.type;
            if (!typeSummary[type]) typeSummary[type] = { count: 0, committedUZS: 0, spentUZS: 0 };
            typeSummary[type].count += row.count;
            typeSummary[type].committedUZS += row.committedUZS || 0;
            typeSummary[type].spentUZS += row.spentUZS || 0;
        }

        res.json({
            success: true,
            data: {
                typeSummary,
                orgsByDistrict: orgBudgetByDistrict,
                infraByDistrict: infraBudgetByDistrict
            }
        });
    } catch (err) {
        console.error('Infra analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch infrastructure analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/crops
// Crop data by region/district
// Query: ?regionCode=17
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
                    _id: {
                        districtId: '$_id',
                        cropApiId: '$crops.apiId'
                    },
                    districtName: { $first: '$name' },
                    regionCode: { $first: '$regionCode' },
                    areaKm2: { $first: '$areaKm2' },
                    cropName: { $first: '$crops.name' },
                    cropColor: { $first: '$crops.color' }
                }
            },
            {
                $group: {
                    _id: '$_id.districtId',
                    districtName: { $first: '$districtName' },
                    regionCode: { $first: '$regionCode' },
                    areaKm2: { $first: '$areaKm2' },
                    cropCount: { $sum: 1 },
                    crops: {
                        $push: {
                            apiId: '$_id.cropApiId',
                            name: '$cropName',
                            color: '$cropColor'
                        }
                    }
                }
            },
            { $sort: { cropCount: -1 } }
        ]);

        // Crop type totals (how many districts grow each crop)
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

        res.json({
            success: true,
            data: {
                cropTotals,
                byDistrict: cropsByDistrict
            }
        });
    } catch (err) {
        console.error('Crop analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch crop analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/districts/scoring
// Composite district scoring
// Ranks districts by issue density, infra coverage, budget efficiency
// Query: ?regionCode=17
// ─────────────────────────────────────────────

export const getDistrictScoring = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        // Gather all metrics per district in parallel
        const [districts, issueStats, orgStats, infraStats] = await Promise.all([
            District.find(regionFilter)
                .select('name regionCode areaKm2 crops centroid')
                .lean(),

            Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        issueCount: { $sum: 1 },
                        openCount: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                        resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] } },
                        highCount: { $sum: { $cond: [{ $eq: ['$severity', 'High'] }, 1, 0] } },
                        totalVotes: { $sum: '$votes' }
                    }
                }
            ]),

            Organization.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        orgCount: { $sum: 1 },
                        schoolCount: { $sum: { $cond: [{ $eq: ['$type', 'Schools & Kindergartens'] }, 1, 0] } },
                        hospitalCount: { $sum: { $cond: [{ $eq: ['$type', 'Hospitals & Clinics'] }, 1, 0] } },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ]),

            Infrastructure.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        infraCount: { $sum: 1 },
                        roadCount: { $sum: { $cond: [{ $eq: ['$type', 'Roads'] }, 1, 0] } },
                        waterCount: { $sum: { $cond: [{ $eq: ['$type', 'Water & Sewage'] }, 1, 0] } },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ])
        ]);

        // Index stats by districtId for fast lookup
        const issueMap = new Map(issueStats.map(s => [s._id.toString(), s]));
        const orgMap = new Map(orgStats.map(s => [s._id.toString(), s]));
        const infraMap = new Map(infraStats.map(s => [s._id.toString(), s]));

        // Build raw scores per district
        const rawScores = districts.map(dist => {
            const id = dist._id.toString();
            const issues = issueMap.get(id) || {};
            const orgs = orgMap.get(id) || {};
            const infra = infraMap.get(id) || {};
            const area = dist.areaKm2 || 1;

            const issueCount = issues.issueCount || 0;
            const resolvedCount = issues.resolvedCount || 0;
            const resolutionRate = issueCount > 0 ? resolvedCount / issueCount : 0;
            const issueDensity = issueCount / area;
            const criticalRatio = issueCount > 0 ? (issues.criticalCount || 0) / issueCount : 0;

            const orgCount = orgs.orgCount || 0;
            const infraCount = infra.infraCount || 0;
            const totalFacilities = orgCount + infraCount;
            const facilityDensity = totalFacilities / area;

            const totalCommitted = (orgs.committedUZS || 0) + (infra.committedUZS || 0);
            const totalSpent = (orgs.spentUZS || 0) + (infra.spentUZS || 0);
            const budgetExecution = totalCommitted > 0 ? totalSpent / totalCommitted : 0;

            const cropDiversity = dist.crops?.length || 0;

            return {
                districtId: dist._id,
                districtName: dist.name,
                regionCode: dist.regionCode,
                areaKm2: area,
                centroid: dist.centroid?.coordinates,

                // Raw metrics
                issueCount,
                openCount: issues.openCount || 0,
                resolvedCount,
                criticalCount: issues.criticalCount || 0,
                highCount: issues.highCount || 0,
                resolutionRate,
                issueDensity,
                criticalRatio,
                totalVotes: issues.totalVotes || 0,

                orgCount,
                schoolCount: orgs.schoolCount || 0,
                hospitalCount: orgs.hospitalCount || 0,
                infraCount,
                roadCount: infra.roadCount || 0,
                waterCount: infra.waterCount || 0,
                facilityDensity,

                budgetCommittedUZS: totalCommitted,
                budgetSpentUZS: totalSpent,
                budgetExecution,

                cropDiversity
            };
        });

        // ── Normalize & compute composite scores ──
        // Higher is better for: resolutionRate, facilityDensity, budgetExecution, cropDiversity
        // Lower is better for: issueDensity, criticalRatio

        const maxIssueDensity = Math.max(...rawScores.map(d => d.issueDensity), 0.001);
        const maxFacilityDensity = Math.max(...rawScores.map(d => d.facilityDensity), 0.001);
        const maxCropDiv = Math.max(...rawScores.map(d => d.cropDiversity), 1);

        const scored = rawScores.map(d => {
            // Normalize 0-100 (higher = better)
            const infraScore = Math.min((d.facilityDensity / maxFacilityDensity) * 100, 100);
            const issueScore = Math.max(0, (1 - d.issueDensity / maxIssueDensity) * 60 + d.resolutionRate * 40);
            const budgetScore = d.budgetExecution * 100;
            const cropScore = (d.cropDiversity / maxCropDiv) * 100;

            // Weighted composite (from spec: infra 30%, issues 30%, budget 25%, crops 15%)
            const compositeScore = Math.round(
                infraScore * 0.30 +
                issueScore * 0.30 +
                budgetScore * 0.25 +
                cropScore * 0.15
            );

            return {
                ...d,
                // Normalized component scores (0-100)
                scores: {
                    infrastructure: Math.round(infraScore),
                    issues: Math.round(issueScore),
                    budget: Math.round(budgetScore),
                    crops: Math.round(cropScore),
                    composite: compositeScore
                },
                // Round raw metrics for readability
                resolutionRate: Math.round(d.resolutionRate * 1000) / 10,
                issueDensity: Math.round(d.issueDensity * 100) / 100,
                facilityDensity: Math.round(d.facilityDensity * 100) / 100,
                budgetExecution: Math.round(d.budgetExecution * 1000) / 10
            };
        });

        // Sort by composite score descending
        scored.sort((a, b) => b.scores.composite - a.scores.composite);

        // Add rank
        scored.forEach((d, i) => d.rank = i + 1);

        res.json({
            success: true,
            data: {
                count: scored.length,
                districts: scored
            }
        });
    } catch (err) {
        console.error('District scoring error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute district scoring' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/districts/:id
// Deep-dive analytics for a single district
// ─────────────────────────────────────────────

export const getDistrictDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const districtId = new mongoose.Types.ObjectId(id);

        const [district, issues, orgs, infra] = await Promise.all([
            District.findById(id).lean(),

            Issue.aggregate([
                { $match: { districtId } },
                {
                    $facet: {
                        byCategory: [
                            { $group: { _id: '$category', count: { $sum: 1 } } },
                            { $sort: { count: -1 } }
                        ],
                        bySeverity: [
                            { $group: { _id: '$severity', count: { $sum: 1 } } }
                        ],
                        byStatus: [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        trends: [
                            {
                                $group: {
                                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                                    count: { $sum: 1 },
                                    resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }
                                }
                            },
                            { $sort: { '_id.year': 1, '_id.month': 1 } }
                        ],
                        topIssues: [
                            { $sort: { votes: -1 } },
                            { $limit: 5 },
                            { $project: { title: 1, category: 1, severity: 1, status: 1, votes: 1 } }
                        ],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: 1 },
                                    totalVotes: { $sum: '$votes' }
                                }
                            }
                        ]
                    }
                }
            ]),

            Organization.aggregate([
                { $match: { districtId } },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ]),

            Infrastructure.aggregate([
                { $match: { districtId } },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ])
        ]);

        if (!district) {
            return res.status(404).json({ success: false, error: 'District not found' });
        }

        const issueData = issues[0] || {};

        res.json({
            success: true,
            data: {
                district: {
                    id: district._id,
                    name: district.name,
                    regionCode: district.regionCode,
                    cadNum: district.cadNum,
                    areaKm2: district.areaKm2,
                    crops: district.crops
                },
                issues: {
                    total: issueData.totals?.[0]?.total || 0,
                    totalVotes: issueData.totals?.[0]?.totalVotes || 0,
                    byCategory: issueData.byCategory || [],
                    bySeverity: Object.fromEntries((issueData.bySeverity || []).map(s => [s._id, s.count])),
                    byStatus: Object.fromEntries((issueData.byStatus || []).map(s => [s._id, s.count])),
                    trends: (issueData.trends || []).map(t => ({
                        year: t._id.year, month: t._id.month,
                        count: t.count, resolved: t.resolved
                    })),
                    topIssues: issueData.topIssues || []
                },
                organizations: orgs.map(o => ({
                    type: o._id,
                    count: o.count,
                    committedUZS: o.committedUZS,
                    spentUZS: o.spentUZS,
                    executionRate: o.committedUZS > 0
                        ? Math.round((o.spentUZS / o.committedUZS) * 1000) / 10
                        : 0
                })),
                infrastructure: infra.map(i => ({
                    type: i._id,
                    count: i.count,
                    committedUZS: i.committedUZS,
                    spentUZS: i.spentUZS,
                    executionRate: i.committedUZS > 0
                        ? Math.round((i.spentUZS / i.committedUZS) * 1000) / 10
                        : 0
                }))
            }
        });
    } catch (err) {
        console.error('District detail error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch district detail' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/regions/summary
// Per-region aggregated metrics
// ─────────────────────────────────────────────

export const getRegionSummary = async (req, res) => {
    try {
        const [regions, issuesByRegion, orgsByRegion, infraByRegion] = await Promise.all([
            Region.find({}).select('code name areaKm2').lean(),

            Issue.aggregate([
                { $match: { regionCode: { $exists: true } } },
                {
                    $group: {
                        _id: '$regionCode',
                        issueCount: { $sum: 1 },
                        openCount: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                        resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        totalVotes: { $sum: '$votes' }
                    }
                }
            ]),

            Organization.aggregate([
                { $match: { regionCode: { $exists: true } } },
                {
                    $group: {
                        _id: '$regionCode',
                        orgCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ]),

            Infrastructure.aggregate([
                { $match: { regionCode: { $exists: true } } },
                {
                    $group: {
                        _id: '$regionCode',
                        infraCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ])
        ]);

        const issueMap = new Map(issuesByRegion.map(s => [s._id, s]));
        const orgMap = new Map(orgsByRegion.map(s => [s._id, s]));
        const infraMap = new Map(infraByRegion.map(s => [s._id, s]));

        const summary = regions.map(r => {
            const issues = issueMap.get(r.code) || {};
            const orgs = orgMap.get(r.code) || {};
            const infra = infraMap.get(r.code) || {};
            const area = r.areaKm2 || 1;

            const issueCount = issues.issueCount || 0;
            const resolvedCount = issues.resolvedCount || 0;

            return {
                regionCode: r.code,
                regionName: r.name,
                areaKm2: r.areaKm2,
                issueCount,
                openCount: issues.openCount || 0,
                resolvedCount,
                resolutionRate: issueCount > 0
                    ? Math.round((resolvedCount / issueCount) * 1000) / 10
                    : 0,
                issueDensity: Math.round((issueCount / area) * 100) / 100,
                totalVotes: issues.totalVotes || 0,
                orgCount: orgs.orgCount || 0,
                infraCount: infra.infraCount || 0,
                budgetCommittedUZS: (orgs.committedUZS || 0) + (infra.committedUZS || 0),
                budgetSpentUZS: (orgs.spentUZS || 0) + (infra.spentUZS || 0)
            };
        });

        summary.sort((a, b) => b.issueCount - a.issueCount);

        res.json({
            success: true,
            data: summary
        });
    } catch (err) {
        console.error('Region summary error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch region summary' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/budget
// Budget efficiency analysis (spec section III)
// Query: ?regionCode=17
// ─────────────────────────────────────────────

export const getBudgetAnalytics = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [orgBudget, infraBudget, costPerIssue] = await Promise.all([
            // Org budget by district
            Organization.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        orgCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                {
                    $lookup: {
                        from: 'districts',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'district'
                    }
                },
                { $unwind: '$district' },
                {
                    $project: {
                        districtId: '$_id',
                        districtName: '$district.name',
                        regionCode: 1,
                        orgCount: 1,
                        areaKm2: '$district.areaKm2',
                        committedUZS: 1, spentUZS: 1,
                        committedUSD: 1, spentUSD: 1,
                        executionRate: {
                            $cond: [
                                { $gt: ['$committedUZS', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$spentUZS', '$committedUZS'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                },
                { $sort: { spentUZS: -1 } }
            ]),

            // Infra budget by district
            Infrastructure.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        infraCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' },
                        committedUSD: { $sum: '$budget.committedUSD' },
                        spentUSD: { $sum: '$budget.spentUSD' }
                    }
                },
                {
                    $lookup: {
                        from: 'districts',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'district'
                    }
                },
                { $unwind: '$district' },
                {
                    $project: {
                        districtId: '$_id',
                        districtName: '$district.name',
                        regionCode: 1,
                        infraCount: 1,
                        areaKm2: '$district.areaKm2',
                        committedUZS: 1, spentUZS: 1,
                        committedUSD: 1, spentUSD: 1,
                        executionRate: {
                            $cond: [
                                { $gt: ['$committedUZS', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$spentUZS', '$committedUZS'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                },
                { $sort: { spentUZS: -1 } }
            ]),

            // Cost per resolved issue by district
            // Spec 3.2: budget / resolved issues count
            Issue.aggregate([
                { $match: { districtId: { $exists: true }, status: 'Resolved', ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        regionCode: { $first: '$regionCode' },
                        resolvedCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Merge cost-per-issue with budget data
        const resolvedMap = new Map(costPerIssue.map(c => [c._id.toString(), c.resolvedCount]));

        // Combined budget per district
        const districtBudgets = new Map();
        for (const d of [...orgBudget, ...infraBudget]) {
            const id = d.districtId.toString();
            if (!districtBudgets.has(id)) {
                districtBudgets.set(id, {
                    districtId: id,
                    districtName: d.districtName,
                    regionCode: d.regionCode,
                    areaKm2: d.areaKm2,
                    totalCommittedUZS: 0,
                    totalSpentUZS: 0,
                    totalCommittedUSD: 0,
                    totalSpentUSD: 0,
                    orgCount: 0,
                    infraCount: 0
                });
            }
            const entry = districtBudgets.get(id);
            entry.totalCommittedUZS += d.committedUZS || 0;
            entry.totalSpentUZS += d.spentUZS || 0;
            entry.totalCommittedUSD += d.committedUSD || 0;
            entry.totalSpentUSD += d.spentUSD || 0;
            entry.orgCount += d.orgCount || 0;
            entry.infraCount += d.infraCount || 0;
        }

        const efficiency = Array.from(districtBudgets.values()).map(d => {
            const resolvedCount = resolvedMap.get(d.districtId) || 0;
            const executionRate = d.totalCommittedUZS > 0
                ? Math.round((d.totalSpentUZS / d.totalCommittedUZS) * 1000) / 10
                : 0;
            const costPerResolved = resolvedCount > 0
                ? Math.round(d.totalSpentUZS / resolvedCount)
                : null;
            const budgetPerKm2 = d.areaKm2 > 0
                ? Math.round(d.totalSpentUZS / d.areaKm2)
                : 0;

            return {
                ...d,
                resolvedCount,
                executionRate,
                costPerResolved,
                budgetPerKm2
            };
        });

        efficiency.sort((a, b) => b.totalSpentUZS - a.totalSpentUZS);

        // Aggregate totals
        const totals = efficiency.reduce((acc, d) => {
            acc.committedUZS += d.totalCommittedUZS;
            acc.spentUZS += d.totalSpentUZS;
            acc.committedUSD += d.totalCommittedUSD;
            acc.spentUSD += d.totalSpentUSD;
            acc.resolvedCount += d.resolvedCount;
            return acc;
        }, { committedUZS: 0, spentUZS: 0, committedUSD: 0, spentUSD: 0, resolvedCount: 0 });

        totals.executionRate = totals.committedUZS > 0
            ? Math.round((totals.spentUZS / totals.committedUZS) * 1000) / 10
            : 0;
        totals.costPerResolved = totals.resolvedCount > 0
            ? Math.round(totals.spentUZS / totals.resolvedCount)
            : null;

        res.json({
            success: true,
            data: {
                totals,
                byDistrict: efficiency
            }
        });
    } catch (err) {
        console.error('Budget analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch budget analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/analytics/choropleth
// District scoring as GeoJSON for map layer
// Query: ?metric=composite|issues|infrastructure|budget|crops&regionCode=17
// ─────────────────────────────────────────────

export const getChoropleth = async (req, res) => {
    try {
        const { metric = 'composite', regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        // Get districts with geometry
        const districts = await District.find(regionFilter)
            .select('name regionCode areaKm2 geometry centroid crops')
            .lean();

        // Get stats per district (same logic as scoring but lighter)
        const [issueStats, orgStats, infraStats] = await Promise.all([
            Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        issueCount: { $sum: 1 },
                        resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                        criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] } }
                    }
                }
            ]),
            Organization.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        orgCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ]),
            Infrastructure.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        infraCount: { $sum: 1 },
                        committedUZS: { $sum: '$budget.committedUZS' },
                        spentUZS: { $sum: '$budget.spentUZS' }
                    }
                }
            ])
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id.toString(), s]));
        const orgMap = new Map(orgStats.map(s => [s._id.toString(), s]));
        const infraMap = new Map(infraStats.map(s => [s._id.toString(), s]));

        // Compute raw values for normalization
        const rawValues = districts.map(dist => {
            const id = dist._id.toString();
            const issues = issueMap.get(id) || {};
            const orgs = orgMap.get(id) || {};
            const infra = infraMap.get(id) || {};
            const area = dist.areaKm2 || 1;

            const issueCount = issues.issueCount || 0;
            const resolvedCount = issues.resolvedCount || 0;
            const resolutionRate = issueCount > 0 ? resolvedCount / issueCount : 0;
            const issueDensity = issueCount / area;

            const totalFacilities = (orgs.orgCount || 0) + (infra.infraCount || 0);
            const facilityDensity = totalFacilities / area;

            const totalCommitted = (orgs.committedUZS || 0) + (infra.committedUZS || 0);
            const totalSpent = (orgs.spentUZS || 0) + (infra.spentUZS || 0);
            const budgetExecution = totalCommitted > 0 ? totalSpent / totalCommitted : 0;

            const cropDiversity = dist.crops?.length || 0;

            return { dist, issueDensity, resolutionRate, facilityDensity, budgetExecution, cropDiversity, issueCount, totalFacilities };
        });

        // Normalization ranges
        const maxIssueDensity = Math.max(...rawValues.map(d => d.issueDensity), 0.001);
        const maxFacilityDensity = Math.max(...rawValues.map(d => d.facilityDensity), 0.001);
        const maxCropDiv = Math.max(...rawValues.map(d => d.cropDiversity), 1);

        // Build GeoJSON features
        const features = rawValues.map(({ dist, issueDensity, resolutionRate, facilityDensity, budgetExecution, cropDiversity, issueCount, totalFacilities }) => {
            const infraScore = Math.min((facilityDensity / maxFacilityDensity) * 100, 100);
            const issueScore = Math.max(0, (1 - issueDensity / maxIssueDensity) * 60 + resolutionRate * 40);
            const budgetScore = budgetExecution * 100;
            const cropScore = (cropDiversity / maxCropDiv) * 100;
            const composite = Math.round(infraScore * 0.30 + issueScore * 0.30 + budgetScore * 0.25 + cropScore * 0.15);

            const scores = {
                composite,
                infrastructure: Math.round(infraScore),
                issues: Math.round(issueScore),
                budget: Math.round(budgetScore),
                crops: Math.round(cropScore)
            };

            const value = scores[metric] ?? scores.composite;

            return {
                type: 'Feature',
                properties: {
                    districtId: dist._id.toString(),
                    name: dist.name,
                    regionCode: dist.regionCode,
                    areaKm2: dist.areaKm2,
                    value,
                    scores,
                    issueCount,
                    facilityCount: totalFacilities,
                    cropDiversity
                },
                geometry: dist.geometry
            };
        }).filter(f => f.geometry); // exclude districts without geometry

        res.json({
            type: 'FeatureCollection',
            metric,
            features
        });
    } catch (err) {
        console.error('Choropleth error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate choropleth' });
    }
};