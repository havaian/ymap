import Issue from './model.js';
import Comment from '../comment/model.js';
import Vote from '../vote/model.js';
import Organization from '../organization/model.js';
import Infrastructure from '../infrastructure/model.js';
import { validateCoordinates } from '../utils/validators.js';

/**
 * GET /api/issues
 * 
 * OPTIMIZED: Uses $lookup aggregation to fetch all comments in ONE query
 * instead of N+1 (was: 3000 separate Comment.find() calls = 34 seconds)
 */
export const getIssues = async (req, res) => {
    const { category, status, severity, limit = 1000 } = req.query;

    const match = {};
    if (category) match.category = category;
    if (status) match.status = status;
    if (severity) match.severity = severity;

    const issues = await Issue.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $limit: parseInt(limit) },
        // Single $lookup replaces 3000 individual Comment.find() calls
        {
            $lookup: {
                from: 'comments',
                localField: '_id',
                foreignField: 'issueId',
                pipeline: [
                    { $sort: { createdAt: 1 } },
                    {
                        $project: {
                            id: { $toString: '$_id' },
                            author: 1,
                            text: 1,
                            timestamp: { $toLong: '$createdAt' },
                            _id: 0
                        }
                    }
                ],
                as: 'comments'
            }
        },
        {
            $project: {
                id: { $toString: '$_id' },
                lat: 1,
                lng: 1,
                title: 1,
                description: 1,
                category: 1,
                subCategory: 1,
                severity: 1,
                status: 1,
                votes: 1,
                aiSummary: 1,
                organizationId: 1,
                organizationName: 1,
                infrastructureId: 1,
                infrastructureName: 1,
                userId: 1,
                regionCode: 1,
                districtId: 1,
                comments: 1,
                createdAt: 1,
                updatedAt: 1,
                _id: 0
            }
        }
    ]);

    res.json({
        success: true,
        data: issues
    });
};

/**
 * GET /api/issues/:id
 * Single issue with comments (used for detail-on-demand)
 */
export const getIssue = async (req, res) => {
    const { id } = req.params;

    const issue = await Issue.findById(id);

    if (!issue) {
        return res.status(404).json({
            success: false,
            message: 'Issue not found'
        });
    }

    const comments = await Comment.find({ issueId: id })
        .sort({ createdAt: 1 })
        .lean();

    const issueObj = issue.toJSON();
    issueObj.comments = comments.map(c => ({
        id: c._id.toString(),
        author: c.author,
        text: c.text,
        timestamp: new Date(c.createdAt).getTime()
    }));

    res.json({
        success: true,
        data: issueObj
    });
};

export const createIssue = async (req, res) => {
    const {
        lat, lng, title, description, category, subCategory,
        severity, aiSummary, organizationId, infrastructureId
    } = req.body;

    if (!lat || !lng || !title || !description || !category || !severity) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields'
        });
    }

    if (!validateCoordinates(lat, lng)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid coordinates'
        });
    }

    let organizationName = null;
    if (organizationId) {
        const org = await Organization.findById(organizationId);
        if (org) {
            organizationName = org.name;
        }
    }

    let infrastructureName = null;
    if (infrastructureId) {
        const infra = await Infrastructure.findById(infrastructureId);
        if (infra) {
            infrastructureName = infra.name;
        }
    }

    const issue = await Issue.create({
        lat,
        lng,
        location: {
            type: 'Point',
            coordinates: [lng, lat]
        },
        title,
        description,
        category,
        subCategory: subCategory || null,
        severity,
        status: 'Open',
        votes: 1,
        aiSummary: aiSummary || null,
        organizationId: organizationId || null,
        organizationName,
        infrastructureId: infrastructureId || null,
        infrastructureName,
        userId: req.user._id
    });

    const issueObj = issue.toJSON();
    issueObj.comments = [];

    res.status(201).json({
        success: true,
        data: issueObj
    });
};

export const updateIssue = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status'
        });
    }

    const issue = await Issue.findByIdAndUpdate(
        id,
        { status },
        { new: true }
    );

    if (!issue) {
        return res.status(404).json({
            success: false,
            message: 'Issue not found'
        });
    }

    const comments = await Comment.find({ issueId: id })
        .sort({ createdAt: 1 })
        .lean();

    const issueObj = issue.toJSON();
    issueObj.comments = comments.map(c => ({
        id: c._id.toString(),
        author: c.author,
        text: c.text,
        timestamp: new Date(c.createdAt).getTime()
    }));

    res.json({
        success: true,
        data: issueObj
    });
};

export const deleteIssue = async (req, res) => {
    const { id } = req.params;

    const issue = await Issue.findByIdAndDelete(id);

    if (!issue) {
        return res.status(404).json({
            success: false,
            message: 'Issue not found'
        });
    }

    // Delete related data
    await Vote.deleteMany({ issueId: id });
    await Comment.deleteMany({ issueId: id });

    res.json({
        success: true,
        message: 'Issue deleted'
    });
};

export const voteIssue = async (req, res) => {
    const { id } = req.params;

    const issue = await Issue.findById(id);

    if (!issue) {
        return res.status(404).json({
            success: false,
            message: 'Issue not found'
        });
    }

    const existingVote = await Vote.findOne({
        issueId: id,
        userId: req.user._id
    });

    if (existingVote) {
        // Remove vote
        await Vote.deleteOne({ _id: existingVote._id });
        issue.votes = Math.max(0, issue.votes - 1);
    } else {
        // Add vote
        await Vote.create({
            issueId: id,
            userId: req.user._id
        });
        issue.votes += 1;
    }

    await issue.save();

    res.json({
        success: true,
        data: {
            votes: issue.votes,
            hasVoted: !existingVote
        }
    });
};