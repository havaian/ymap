import User from './model.js';
import mongoose from 'mongoose';
import Issue from '../issue/model.js';
import Task from '../task/model.js';
import Vote from '../vote/model.js';    

export const getUsers = async (req, res) => {
    const users = await User.find().select('-password');

    res.json({
        success: true,
        data: users.map(u => u.toJSON())
    });
};

export const blockUser = async (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'blocked must be boolean'
        });
    }

    const user = await User.findById(id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    if (user.role === 'ADMIN') {
        return res.status(400).json({
            success: false,
            message: 'Cannot block admin users'
        });
    }

    user.blocked = blocked;
    await user.save();

    // Flag in Redis so active JWTs are immediately rejected
    const { getRedisClient } = await import('../config/redis.js');
    const redis = getRedisClient();
    if (redis?.isOpen) {
        if (blocked) {
            // TTL = 7 days (matches JWT_EXPIRES_IN)
            await redis.setEx(`blocked:${id}`, 7 * 24 * 60 * 60, '1');
        } else {
            await redis.del(`blocked:${id}`);
        }
    }

    res.json({
        success: true,
        data: user.toJSON()
    });
};

export const getUserActivity = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const user = await User.findById(id).select('-password').lean();
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userId = new mongoose.Types.ObjectId(id);

    const [issueStats, recentIssues, voteCount, verificationStats] = await Promise.all([
        Issue.aggregate([
            { $match: { userId } },
            { $group: {
                _id: null,
                total:    { $sum: 1 },
                open:     { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                progress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                totalVotes: { $sum: '$votes' },
            }}
        ]),
        Issue.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title category severity status createdAt votes')
            .lean(),
        Vote.countDocuments({ userId: id }),
        Task.aggregate([
            { $unwind: '$verifications' },
            { $match: { 'verifications.userId': userId } },
            { $group: {
                _id: '$verifications.status',
                count: { $sum: 1 }
            }}
        ])
    ]);

    const issues = issueStats[0] || { total: 0, open: 0, progress: 0, resolved: 0, totalVotes: 0 };
    const verifs = { done: 0, problem: 0 };
    verificationStats.forEach(v => { verifs[v._id] = v.count; });

    res.json({
        success: true,
        data: {
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                points: user.points || 0,
                blocked: user.blocked || false,
                createdAt: user.createdAt,
            },
            activity: {
                issues,
                recentIssues: recentIssues.map(i => ({
                    id: i._id.toString(),
                    title: i.title,
                    category: i.category,
                    severity: i.severity,
                    status: i.status,
                    votes: i.votes,
                    createdAt: i.createdAt,
                })),
                votesGiven: voteCount,
                verifications: verifs,
            }
        }
    });
};

// ── GET /api/users/me/activity ────────────────────────────────────────────────
// Own profile — uses JWT userId, no adminOnly required
export const getMyActivity = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [issueStats, recentIssues, voteCount, verificationStats] = await Promise.all([
        Issue.aggregate([
            { $match: { userId } },
            { $group: {
                _id: null,
                total:    { $sum: 1 },
                open:     { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                progress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
                totalVotes: { $sum: '$votes' },
            }}
        ]),
        Issue.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title category severity status createdAt votes')
            .lean(),
        Vote.countDocuments({ userId: req.user._id.toString() }),
        Task.aggregate([
            { $unwind: '$verifications' },
            { $match: { 'verifications.userId': userId } },
            { $group: { _id: '$verifications.status', count: { $sum: 1 } } }
        ])
    ]);

    const issues = issueStats[0] || { total: 0, open: 0, progress: 0, resolved: 0, totalVotes: 0 };
    const verifs = { done: 0, problem: 0 };
    verificationStats.forEach(v => { verifs[v._id] = v.count; });

    res.json({
        success: true,
        data: {
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                points: user.points || 0,
                createdAt: user.createdAt,
            },
            activity: {
                issues,
                recentIssues: recentIssues.map(i => ({
                    id: i._id.toString(),
                    title: i.title,
                    category: i.category,
                    severity: i.severity,
                    status: i.status,
                    votes: i.votes,
                    createdAt: i.createdAt,
                })),
                votesGiven: voteCount,
                verifications: verifs,
            }
        }
    });
};

// ── GET /api/users/leaderboard ────────────────────────────────────────────────
// Top 50 citizens by points — public within authenticated users
export const getLeaderboard = async (req, res) => {
    const users = await User.find({ role: 'CITIZEN', blocked: false })
        .select('-password')
        .sort({ points: -1 })
        .limit(50)
        .lean();

    if (!users.length) {
        return res.json({ success: true, data: [] });
    }

    const userIds = users.map(u => u._id);

    const [issueCounts, verifCounts] = await Promise.all([
        Issue.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: '$userId', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } } } }
        ]),
        Task.aggregate([
            { $unwind: '$verifications' },
            { $match: { 'verifications.userId': { $in: userIds } } },
            { $group: { _id: '$verifications.userId', count: { $sum: 1 } } }
        ])
    ]);

    const issueMap = new Map(issueCounts.map(i => [i._id.toString(), i]));
    const verifMap = new Map(verifCounts.map(v => [v._id.toString(), v.count]));

    const data = users.map((u, idx) => {
        const id = u._id.toString();
        const ic = issueMap.get(id) || { total: 0, resolved: 0 };
        return {
            rank: idx + 1,
            id,
            name: u.name,
            points: u.points || 0,
            issueCount: ic.total,
            resolvedCount: ic.resolved,
            verificationCount: verifMap.get(id) || 0,
            createdAt: u.createdAt,
        };
    });

    res.json({ success: true, data });
};