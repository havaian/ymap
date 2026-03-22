// backend/src/issue/controller.js

import Issue from './model.js';
import User from '../user/model.js';
import Comment from '../comment/model.js';
import Vote from '../vote/model.js';
import Object_ from '../object/model.js';
import District from '../district/model.js';
import { validateCoordinates } from '../utils/validators.js';
import { invalidateAnalyticsCache } from '../middleware/cache.js';

/**
 * GET /api/issues
 * Query: ?category= &status= &severity= &objectId= &regionCode= &limit= &includeComments=false
 */
export const getIssues = async (req, res) => {
    const { category, status, severity, limit = 1000, objectId, regionCode, includeComments } = req.query;

    const match = {};
    if (category) match.category = category;
    if (status) match.status = status;
    if (severity) match.severity = severity;
    if (objectId) match.objectId = objectId;
    if (regionCode) match.regionCode = parseInt(regionCode);

    const pipeline = [
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $limit: parseInt(limit) },
    ];

    // Comments lookup is skipped when caller passes ?includeComments=false
    if (includeComments !== 'false') {
        pipeline.push({
            $lookup: {
                from: 'comments',
                localField: '_id',
                foreignField: 'issueId',
                pipeline: [
                    { $sort: { createdAt: 1 } },
                    { $project: { id: { $toString: '$_id' }, author: 1, text: 1, timestamp: { $toLong: '$createdAt' }, _id: 0 } }
                ],
                as: 'comments'
            }
        });
    } else {
        pipeline.push({ $addFields: { comments: [] } });
    }

    pipeline.push({
        $project: {
            id: { $toString: '$_id' },
            lat: 1, lng: 1,
            title: 1, description: 1,
            category: 1, subCategory: 1,
            severity: 1, status: 1,
            votes: 1, aiSummary: 1,
            objectId: 1, objectName: 1,
            userId: 1,
            regionCode: 1, districtId: 1,
            comments: 1,
            createdAt: 1, updatedAt: 1,
            _id: 0
        }
    });

    const issues = await Issue.aggregate(pipeline);
    res.json({ success: true, data: issues });
};

/**
 * GET /api/issues/:id
 */
export const getIssue = async (req, res) => {
    const { id } = req.params;

    const issue = await Issue.findById(id);
    if (!issue) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const comments = await Comment.find({ issueId: id }).sort({ createdAt: 1 }).lean();

    const issueObj = issue.toJSON();
    issueObj.comments = comments.map(c => ({
        id: c._id.toString(),
        author: c.author,
        text: c.text,
        timestamp: new Date(c.createdAt).getTime()
    }));

    res.json({ success: true, data: issueObj });
};

/**
 * POST /api/issues
 * Citizens only — admin is blocked by the citizenOnly middleware on the route.
 */
export const createIssue = async (req, res) => {
    const {
        lat, lng, title, description, category, subCategory,
        severity, aiSummary, objectId
    } = req.body;

    if (!lat || !lng || !title || !description || !category || !severity) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!validateCoordinates(lat, lng)) {
        return res.status(400).json({ success: false, message: 'Invalid coordinates for Uzbekistan' });
    }

    // If linked to an object, verify coordinates are within ~10km of it
    if (objectId) {
        const linkedObj = await Object_.findById(objectId).select('lat lng').lean();
        if (linkedObj) {
            const dLat = parseFloat(lat) - linkedObj.lat;
            const dLng = parseFloat(lng) - linkedObj.lng;
            const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);
            // ~0.09 degrees ≈ 10km
            if (distDeg > 0.09) {
                return res.status(400).json({ success: false, message: 'Issue coordinates are too far from the linked object' });
            }
        }
    }

    let objectName = null;
    let objectRegionCode = null;
    let objectDistrictId = null;

    if (objectId) {
        const obj = await Object_.findById(objectId).select('name regionCode districtId').lean();
        if (obj) {
            objectName = obj.name;
            if (obj.regionCode) objectRegionCode = obj.regionCode;
            if (obj.districtId) objectDistrictId = obj.districtId;
        }
    }

    if (!objectRegionCode || !objectDistrictId) {
        const point = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
        const district = await District.findOne({
            geometry: { $geoIntersects: { $geometry: point } }
        }).lean() || await District.findOne({
            centroid: { $near: { $geometry: point, $maxDistance: 200000 } }
        }).lean();

        if (district) {
            if (!objectRegionCode) objectRegionCode = district.regionCode;
            if (!objectDistrictId) objectDistrictId = district._id;
        }
    }

    const issue = await Issue.create({
        lat, lng,
        location: { type: 'Point', coordinates: [lng, lat] },
        title, description, category,
        subCategory: subCategory || null,
        severity,
        status: 'Open',
        votes: 1,
        aiSummary: aiSummary || null,
        objectId: objectId || null,
        objectName,
        userId: req.user._id,
        regionCode: objectRegionCode || null,
        districtId: objectDistrictId || null,
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { points: 1 } });

    const issueObj = issue.toJSON();
    issueObj.comments = [];

    // Invalidate markers cache so new issue appears immediately
    invalidateAnalyticsCache().catch(() => {});

    res.status(201).json({ success: true, data: issueObj });
};

/**
 * PATCH /api/issues/:id — admin only (status update)
 */
export const updateIssue = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const issue = await Issue.findByIdAndUpdate(id, { status }, { new: true });
    if (!issue) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.json({ success: true, data: issue.toJSON() });
};

/**
 * DELETE /api/issues/:id — admin only
 */
export const deleteIssue = async (req, res) => {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    if (!issue) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
    }
    res.json({ success: true, message: 'Issue deleted' });
};

/**
 * POST /api/issues/:id/vote
 */
export const voteIssue = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const existing = await Vote.findOne({ issueId: id, userId });
    if (existing) {
        return res.status(409).json({ success: false, message: 'Already voted' });
    }

    await Vote.create({ issueId: id, userId });
    const issue = await Issue.findByIdAndUpdate(id, { $inc: { votes: 1 } }, { new: true });

    if (!issue) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.json({ success: true, data: { votes: issue.votes } });
};