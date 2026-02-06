import Comment from './model.js';
import Issue from '../issue/model.js';

export const addComment = async (req, res) => {
    const { issueId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Comment text is required'
        });
    }

    const issue = await Issue.findById(issueId);

    if (!issue) {
        return res.status(404).json({
            success: false,
            message: 'Issue not found'
        });
    }

    const comment = await Comment.create({
        issueId,
        userId: req.user._id,
        author: req.user.name,
        text: text.trim()
    });

    res.status(201).json({
        success: true,
        data: comment.toJSON()
    });
};

export const getComments = async (req, res) => {
    const { issueId } = req.params;

    const comments = await Comment.find({ issueId })
        .sort({ createdAt: 1 });

    res.json({
        success: true,
        data: comments.map(c => c.toJSON())
    });
};