// ─────────────────────────────────────────────
// GET /api/analytics/choropleth
// District scoring as GeoJSON for map layer
// Query: ?metric=composite|issues|objects|verification&regionCode=17
//
// Metrics:
//   composite    — weighted: issue pressure 40% + verification rate 35% + object density 25%
//   issues       — open-issue pressure per district (lower open = greener)
//   objects      — facility object count density per km²
//   verification — % of task verifications marked "done"
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
            // Issue pressure: total + open per district
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
            // Object density: count per district
            Object_.aggregate([
                { $match: { districtId: { $in: districtIds } } },
                { $group: { _id: '$districtId', count: { $sum: 1 } } }
            ]),
            // Task verifications: done vs problem per district (via join to Object)
            Task.aggregate([
                { $match: { 'verifications.0': { $exists: true } } },
                { $unwind: '$verifications' },
                {
                    $lookup: {
                        from: 'objects',
                        localField: 'targetId',
                        foreignField: '_id',
                        as: 'object'
                    }
                },
                { $unwind: { path: '$object', preserveNullAndEmptyArrays: false } },
                { $match: { 'object.districtId': { $in: districtIds } } },
                {
                    $group: {
                        _id: '$object.districtId',
                        doneCount: { $sum: { $cond: [{ $eq: ['$verifications.status', 'done'] }, 1, 0] } },
                        totalCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        const issueMap = new Map(issueStats.map(s => [s._id.toString(), s]));
        const objMap = new Map(objectStats.map(s => [s._id.toString(), s]));
        const verifMap = new Map(verificationStats.map(s => [s._id.toString(), s]));

        // Raw values for normalization
        const raw = districts.map(dist => {
            const id = dist._id.toString();
            const area = dist.areaKm2 || 1;

            const issues = issueMap.get(id) || { total: 0, open: 0 };
            const objs = objMap.get(id) || { count: 0 };
            const verif = verifMap.get(id) || { doneCount: 0, totalCount: 0 };

            const openRatio = issues.total > 0 ? issues.open / issues.total : 0;
            const issueDensity = issues.total / area;
            const objectDensity = objs.count / area;
            const verificationRate = verif.totalCount > 0
                ? verif.doneCount / verif.totalCount
                : null; // null = no data yet

            return { dist, openRatio, issueDensity, objectDensity, verificationRate };
        });

        const maxIssueDensity = Math.max(...raw.map(r => r.issueDensity), 0.001);
        const maxObjectDensity = Math.max(...raw.map(r => r.objectDensity), 0.001);

        const features = raw.map(({ dist, openRatio, issueDensity, objectDensity, verificationRate }) => {
            // Issue score: fewer open issues = better (0-100)
            const issueScore = Math.max(0, Math.round((1 - openRatio) * 100));

            // Object score: denser = better (0-100)
            const objectScore = Math.min(100, Math.round((objectDensity / maxObjectDensity) * 100));

            // Verification score: more "done" = better (0-100, null → 50 neutral)
            const verifScore = verificationRate !== null
                ? Math.round(verificationRate * 100)
                : 50;

            const compositeScore = Math.round(
                issueScore * 0.40 +
                verifScore * 0.35 +
                objectScore * 0.25
            );

            const scores = {
                composite: compositeScore,
                issues: issueScore,
                objects: objectScore,
                verification: verifScore
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
// GET /api/analytics/districts/:id
// Deep-dive for a single district — used by DistrictDrilldown panel
// ─────────────────────────────────────────────

export const getDistrictDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const districtId = new mongoose.Types.ObjectId(id);

        const [district, issueResult, objectResult, taskResult] = await Promise.all([
            District.findById(id).lean(),

            // Issues in this district
            Issue.aggregate([
                { $match: { districtId } },
                {
                    $facet: {
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: 1 },
                                    totalVotes: { $sum: '$votes' }
                                }
                            }
                        ],
                        byStatus: [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        list: [
                            { $sort: { votes: -1 } },
                            { $limit: 15 },
                            { $project: { title: 1, category: 1, severity: 1, status: 1, votes: 1 } }
                        ]
                    }
                }
            ]),

            // Facility objects in this district
            Object_.aggregate([
                { $match: { districtId } },
                {
                    $facet: {
                        byType: [
                            { $group: { _id: '$objectType', count: { $sum: 1 } } }
                        ],
                        list: [
                            { $sort: { name: 1 } },
                            { $limit: 20 },
                            { $project: { name: 1, objectType: 1, tuman: 1 } }
                        ],
                        total: [
                            { $count: 'n' }
                        ]
                    }
                }
            ]),

            // Task verification stats for objects in this district
            Task.aggregate([
                {
                    $lookup: {
                        from: 'objects',
                        localField: 'targetId',
                        foreignField: '_id',
                        as: 'object'
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
                        id: o._id.toString(),
                        name: o.name,
                        objectType: o.objectType,
                        tuman: o.tuman
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