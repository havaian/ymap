import Issue from './model.js';
import Comment from '../comment/model.js';
import Vote from '../vote/model.js';
import Organization from '../organization/model.js';
import { validateCoordinates } from '../utils/validators.js';

export const getIssues = async (req, res) => {
    const { category, status, severity, limit = 1000 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const issues = await Issue.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

    // For each issue, get its comments
    const issuesWithComments = await Promise.all(
        issues.map(async (issue) => {
            const comments = await Comment.find({ issueId: issue._id })
                .sort({ createdAt: 1 })
                .lean();

            const issueObj = issue.toJSON();
            issueObj.comments = comments.map(c => ({
                id: c._id.toString(),
                author: c.author,
                text: c.text,
                timestamp: new Date(c.createdAt).getTime()
            }));

            return issueObj;
        })
    );

    res.json({
        success: true,
        data: issuesWithComments
    });
};

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
        severity, aiSummary, organizationId
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