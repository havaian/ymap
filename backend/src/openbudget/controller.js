/**
 * OpenBudget Controller
 * 
 * Spec Section IV: Institution-level scoring for budget prioritization.
 * 
 * Priority Index = weighted composite of:
 *   - Issue burden (40%): unresolved issues weighted by severity
 *   - Budget efficiency (25%): spent/committed ratio (lower = worse = higher priority)
 *   - Community signal (20%): total votes on linked issues
 *   - Infrastructure gap (15%): missing infra in vicinity
 * 
 * Higher score = higher priority for funding.
 */

import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import Issue from '../issue/model.js';

const SEVERITY_WEIGHTS = { Critical: 10, High: 5, Medium: 2, Low: 1 };

// ─────────────────────────────────────────────
// GET /api/openbudget/scoring
// Ranked list of all orgs by funding priority
// Query: ?type=Schools & Kindergartens&regionName=Toshkent&limit=50&offset=0
// ─────────────────────────────────────────────

export const getOrgScoring = async (req, res) => {
    try {
        const {
            type,
            regionName,
            limit = 50,
            offset = 0,
            sort = 'priorityScore', // priorityScore | issueBurden | budgetGap | name
            order = 'desc'
        } = req.query;

        const orgFilter = {};
        if (type) orgFilter.type = type;
        if (regionName) orgFilter['region.name'] = regionName;

        // Step 1: Get all orgs with budget data
        const orgs = await Organization.find(orgFilter)
            .select('name type lat lng address region budget status')
            .lean();

        if (orgs.length === 0) {
            return res.json({ success: true, data: { total: 0, orgs: [] } });
        }

        const orgIds = orgs.map(o => o._id.toString());

        // Step 2: Get issue stats per org (single aggregation)
        const issueStats = await Issue.aggregate([
            { $match: { organizationId: { $in: orgIds } } },
            {
                $group: {
                    _id: '$organizationId',
                    totalIssues: { $sum: 1 },
                    openIssues: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } },
                    resolvedIssues: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                    criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] } },
                    highCount: { $sum: { $cond: [{ $eq: ['$severity', 'High'] }, 1, 0] } },
                    mediumCount: { $sum: { $cond: [{ $eq: ['$severity', 'Medium'] }, 1, 0] } },
                    lowCount: { $sum: { $cond: [{ $eq: ['$severity', 'Low'] }, 1, 0] } },
                    totalVotes: { $sum: '$votes' },
                    avgSeverityScore: {
                        $avg: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$severity', 'Critical'] }, then: 10 },
                                    { case: { $eq: ['$severity', 'High'] }, then: 5 },
                                    { case: { $eq: ['$severity', 'Medium'] }, then: 2 },
                                ],
                                default: 1
                            }
                        }
                    }
                }
            }
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id, s]));

        // Step 3: Compute scores
        // Normalization ranges
        const maxVotes = Math.max(...issueStats.map(s => s.totalVotes), 1);
        const maxBurden = Math.max(
            ...issueStats.map(s =>
                (s.criticalCount * 10) + (s.highCount * 5) + (s.mediumCount * 2) + (s.lowCount * 1)
            ), 1
        );

        const scored = orgs.map(org => {
            const id = org._id.toString();
            const stats = issueMap.get(id) || {
                totalIssues: 0, openIssues: 0, resolvedIssues: 0,
                criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0,
                totalVotes: 0, avgSeverityScore: 0
            };

            // Issue burden: weighted unresolved issues (0-100)
            const rawBurden = (stats.criticalCount * 10) + (stats.highCount * 5) +
                (stats.mediumCount * 2) + (stats.lowCount * 1);
            const issueBurden = Math.min((rawBurden / maxBurden) * 100, 100);

            // Budget gap: inverse of execution rate (0-100, higher = worse)
            const committed = org.budget?.committedUZS || 0;
            const spent = org.budget?.spentUZS || 0;
            const executionRate = committed > 0 ? spent / committed : 0;
            const budgetGap = Math.round((1 - executionRate) * 100);

            // Community signal: votes normalized (0-100)
            const communitySignal = Math.min((stats.totalVotes / maxVotes) * 100, 100);

            // Infrastructure gap: simple proxy — open issues / total (0-100)
            const infraGap = stats.totalIssues > 0
                ? Math.round((stats.openIssues / stats.totalIssues) * 100)
                : 0;

            // Composite priority score
            const priorityScore = Math.round(
                issueBurden * 0.40 +
                budgetGap * 0.25 +
                communitySignal * 0.20 +
                infraGap * 0.15
            );

            return {
                orgId: id,
                name: org.name,
                type: org.type,
                address: org.address,
                region: org.region,
                lat: org.lat,
                lng: org.lng,
                status: org.status,
                budget: {
                    committedUZS: committed,
                    spentUZS: spent,
                    committedUSD: org.budget?.committedUSD || 0,
                    spentUSD: org.budget?.spentUSD || 0,
                    executionRate: Math.round(executionRate * 1000) / 10
                },
                issues: {
                    total: stats.totalIssues,
                    open: stats.openIssues,
                    resolved: stats.resolvedIssues,
                    critical: stats.criticalCount,
                    high: stats.highCount,
                    medium: stats.mediumCount,
                    low: stats.lowCount,
                    totalVotes: stats.totalVotes
                },
                scores: {
                    priorityScore,
                    issueBurden: Math.round(issueBurden),
                    budgetGap,
                    communitySignal: Math.round(communitySignal),
                    infraGap
                }
            };
        });

        // Sort
        const sortKey = sort === 'name' ? 'name' : `scores.${sort}`;
        scored.sort((a, b) => {
            const aVal = sort === 'name' ? a.name : (a.scores[sort] ?? a.scores.priorityScore);
            const bVal = sort === 'name' ? b.name : (b.scores[sort] ?? b.scores.priorityScore);
            if (order === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

        // Assign ranks after sorting by priorityScore desc
        const byPriority = [...scored].sort((a, b) => b.scores.priorityScore - a.scores.priorityScore);
        byPriority.forEach((o, i) => { o.rank = i + 1; });

        // Pagination
        const total = scored.length;
        const paginated = scored.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        // Summary stats
        const summary = {
            totalOrgs: total,
            criticalPriority: scored.filter(o => o.scores.priorityScore >= 70).length,
            highPriority: scored.filter(o => o.scores.priorityScore >= 40 && o.scores.priorityScore < 70).length,
            lowPriority: scored.filter(o => o.scores.priorityScore < 40).length,
            avgExecutionRate: Math.round(
                scored.reduce((sum, o) => sum + o.budget.executionRate, 0) / Math.max(total, 1) * 10
            ) / 10,
            totalUnresolvedIssues: scored.reduce((sum, o) => sum + o.issues.open, 0)
        };

        res.json({
            success: true,
            data: {
                summary,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                orgs: paginated
            }
        });
    } catch (err) {
        console.error('OpenBudget scoring error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute org scoring' });
    }
};

// ─────────────────────────────────────────────
// GET /api/openbudget/org/:id
// Single org detail with full scoring breakdown
// ─────────────────────────────────────────────

export const getOrgDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const org = await Organization.findById(id).lean();
        if (!org) {
            return res.status(404).json({ success: false, error: 'Organization not found' });
        }

        // Issues for this org
        const issues = await Issue.find({ organizationId: id })
            .select('title category severity status votes createdAt')
            .sort({ votes: -1 })
            .lean();

        // Nearby infrastructure (within 2km)
        const nearbyInfra = await Infrastructure.find({
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [org.lng, org.lat] },
                    $maxDistance: 2000
                }
            }
        }).select('name type budget status').limit(20).lean();

        const openIssues = issues.filter(i => i.status !== 'Resolved');
        const resolvedIssues = issues.filter(i => i.status === 'Resolved');

        // Severity breakdown
        const severityBreakdown = {};
        for (const i of openIssues) {
            severityBreakdown[i.severity] = (severityBreakdown[i.severity] || 0) + 1;
        }

        // Category breakdown
        const categoryBreakdown = {};
        for (const i of issues) {
            categoryBreakdown[i.category] = (categoryBreakdown[i.category] || 0) + 1;
        }

        const committed = org.budget?.committedUZS || 0;
        const spent = org.budget?.spentUZS || 0;
        const executionRate = committed > 0 ? Math.round((spent / committed) * 1000) / 10 : 0;

        res.json({
            success: true,
            data: {
                org: {
                    id: org._id.toString(),
                    name: org.name,
                    type: org.type,
                    address: org.address,
                    region: org.region,
                    lat: org.lat,
                    lng: org.lng,
                    status: org.status,
                    year: org.year,
                    budget: {
                        committedUZS: committed,
                        spentUZS: spent,
                        committedUSD: org.budget?.committedUSD || 0,
                        spentUSD: org.budget?.spentUSD || 0,
                        executionRate
                    }
                },
                issues: {
                    total: issues.length,
                    open: openIssues.length,
                    resolved: resolvedIssues.length,
                    severityBreakdown,
                    categoryBreakdown,
                    totalVotes: issues.reduce((s, i) => s + (i.votes || 0), 0),
                    topIssues: issues.slice(0, 10).map(i => ({
                        id: i._id.toString(),
                        title: i.title,
                        category: i.category,
                        severity: i.severity,
                        status: i.status,
                        votes: i.votes || 0,
                        createdAt: i.createdAt
                    }))
                },
                nearbyInfrastructure: nearbyInfra.map(i => ({
                    id: i._id.toString(),
                    name: i.name,
                    type: i.type,
                    status: i.status,
                    budget: i.budget
                }))
            }
        });
    } catch (err) {
        console.error('OpenBudget org detail error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch org detail' });
    }
};

// ─────────────────────────────────────────────
// GET /api/openbudget/deficit
// Infrastructure Deficit Index (Spec Section II.2)
// (Потребность − Обеспеченность) / Потребность per district
// ─────────────────────────────────────────────

export const getDeficitIndex = async (req, res) => {
    try {
        const { regionCode } = req.query;
        const regionFilter = regionCode ? { regionCode: parseInt(regionCode) } : {};

        const [orgsByDistrict, infraByDistrict, issuesByDistrict] = await Promise.all([
            Organization.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        orgCount: { $sum: 1 },
                        schoolCount: { $sum: { $cond: [{ $eq: ['$type', 'Schools & Kindergartens'] }, 1, 0] } },
                        hospitalCount: { $sum: { $cond: [{ $eq: ['$type', 'Hospitals & Clinics'] }, 1, 0] } },
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
                    }
                }
            ]),
            Issue.aggregate([
                { $match: { districtId: { $exists: true }, ...regionFilter } },
                {
                    $group: {
                        _id: '$districtId',
                        totalIssues: { $sum: 1 },
                        openIssues: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } },
                        infraIssues: {
                            $sum: {
                                $cond: [
                                    { $in: ['$category', ['Roads', 'Water & Sewage', 'Electricity']] },
                                    1, 0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        const orgMap = new Map(orgsByDistrict.map(d => [d._id?.toString(), d]));
        const infraMap = new Map(infraByDistrict.map(d => [d._id?.toString(), d]));
        const issueMap = new Map(issuesByDistrict.map(d => [d._id?.toString(), d]));

        // Get all district IDs
        const allIds = new Set([
            ...orgsByDistrict.map(d => d._id?.toString()),
            ...infraByDistrict.map(d => d._id?.toString()),
            ...issuesByDistrict.map(d => d._id?.toString())
        ]);

        // Compute max values for normalization
        const maxSchools = Math.max(...orgsByDistrict.map(d => d.schoolCount), 1);
        const maxHospitals = Math.max(...orgsByDistrict.map(d => d.hospitalCount), 1);
        const maxRoads = Math.max(...infraByDistrict.map(d => d.roadCount), 1);
        const maxWater = Math.max(...infraByDistrict.map(d => d.waterCount), 1);

        const deficits = Array.from(allIds).filter(Boolean).map(districtId => {
            const orgs = orgMap.get(districtId) || { schoolCount: 0, hospitalCount: 0, orgCount: 0 };
            const infra = infraMap.get(districtId) || { roadCount: 0, waterCount: 0, infraCount: 0 };
            const issues = issueMap.get(districtId) || { totalIssues: 0, openIssues: 0, infraIssues: 0 };

            // Deficit = (max - actual) / max * 100 — higher = more deficit
            const educationDeficit = Math.round((1 - orgs.schoolCount / maxSchools) * 100);
            const healthDeficit = Math.round((1 - orgs.hospitalCount / maxHospitals) * 100);
            const roadDeficit = Math.round((1 - infra.roadCount / maxRoads) * 100);
            const waterDeficit = Math.round((1 - infra.waterCount / maxWater) * 100);

            // Issue pressure adds to deficit
            const issuePressure = issues.totalIssues > 0
                ? Math.min(Math.round((issues.infraIssues / issues.totalIssues) * 100), 100)
                : 0;

            const composite = Math.round(
                educationDeficit * 0.25 +
                healthDeficit * 0.25 +
                roadDeficit * 0.20 +
                waterDeficit * 0.20 +
                issuePressure * 0.10
            );

            return {
                districtId,
                facilityCount: orgs.orgCount + infra.infraCount,
                schools: orgs.schoolCount,
                hospitals: orgs.hospitalCount,
                roads: infra.roadCount,
                water: infra.waterCount,
                openIssues: issues.openIssues,
                infraIssues: issues.infraIssues,
                deficits: {
                    education: educationDeficit,
                    health: healthDeficit,
                    roads: roadDeficit,
                    water: waterDeficit,
                    issuePressure,
                    composite
                }
            };
        });

        deficits.sort((a, b) => b.deficits.composite - a.deficits.composite);

        res.json({
            success: true,
            data: deficits
        });
    } catch (err) {
        console.error('Deficit index error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute deficit index' });
    }
};