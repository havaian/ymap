// backend/src/task/controller.js

import Task from './model.js';
import User from '../user/model.js';
import mongoose from 'mongoose';

const VOTE_ALLOWED_STATUS = 'Pending Verification';

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// Supports: ?targetId=  ?programId=  ?allocationId=  ?status=
export const getTasks = async (req, res) => {
    try {
        const { targetId, programId, allocationId, status } = req.query;
        const filter = {};

        if (targetId) {
            if (!mongoose.isValidObjectId(targetId))
                return res.status(400).json({ success: false, message: 'Invalid targetId' });
            filter.targetId = targetId;
        }
        if (programId) {
            if (!mongoose.isValidObjectId(programId))
                return res.status(400).json({ success: false, message: 'Invalid programId' });
            filter.programId = programId;
        }
        if (allocationId) {
            if (!mongoose.isValidObjectId(allocationId))
                return res.status(400).json({ success: false, message: 'Invalid allocationId' });
            filter.allocationId = allocationId;
        }
        if (status) filter.status = status;

        const tasks = await Task.find(filter).sort({ createdAt: -1 });

        const data = tasks.map(t => {
            const obj = t.toJSON();
            obj.totalCount = t.totalCount;
            obj.doneCount = t.doneCount;
            obj.problemCount = t.problemCount;
            return obj;
        });

        res.json({ success: true, data });
    } catch (err) {
        console.error('getTasks error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
};

// ── GET /api/tasks/stats ──────────────────────────────────────────────────────
export const getStats = async (req, res) => {
    try {
        const [statusStats, voteStats, verificationStats] = await Promise.all([
            Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Task.aggregate([
                {
                    $project: {
                        confirmedCount: { $size: '$votes.confirmed' },
                        rejectedCount: { $size: '$votes.rejected' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalConfirmed: { $sum: '$confirmedCount' },
                        totalRejected: { $sum: '$rejectedCount' }
                    }
                }
            ]),
            Task.aggregate([
                { $unwind: { path: '$verifications', preserveNullAndEmptyArrays: false } },
                { $group: { _id: '$verifications.status', count: { $sum: 1 } } }
            ])
        ]);

        const byStatus = {};
        statusStats.forEach(s => { byStatus[s._id] = s.count; });
        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        const votes = voteStats[0] || { totalConfirmed: 0, totalRejected: 0 };
        const verifications = { done: 0, problem: 0 };
        verificationStats.forEach(v => { verifications[v._id] = v.count; });

        res.json({
            success: true,
            data: {
                total,
                byStatus,
                votes: { confirmed: votes.totalConfirmed, rejected: votes.totalRejected },
                verifications
            }
        });
    } catch (err) {
        console.error('getStats error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch task stats' });
    }
};

// ── POST /api/tasks ───────────────────────────────────────────────────────────
export const createTask = async (req, res) => {
    try {
        const { targetId, programId, allocationId, title, description, deadline, status } = req.body;

        if (!targetId || !title)
            return res.status(400).json({ success: false, message: 'targetId and title are required' });
        if (!mongoose.isValidObjectId(targetId))
            return res.status(400).json({ success: false, message: 'Invalid targetId' });
        if (programId && !mongoose.isValidObjectId(programId))
            return res.status(400).json({ success: false, message: 'Invalid programId' });
        if (allocationId && !mongoose.isValidObjectId(allocationId))
            return res.status(400).json({ success: false, message: 'Invalid allocationId' });

        const task = await Task.create({
            targetId,
            programId: programId || null,
            allocationId: allocationId || null,
            title,
            description: description || null,
            deadline: deadline ? new Date(deadline) : null,
            status: status || 'Planned',
            createdBy: req.user._id,
            votes: { confirmed: [], rejected: [] }
        });

        res.status(201).json({ success: true, data: task.toJSON() });
    } catch (err) {
        console.error('createTask error:', err);
        res.status(500).json({ success: false, message: 'Failed to create task' });
    }
};

// ── PATCH /api/tasks/:id/status ───────────────────────────────────────────────
export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const VALID = ['Planned', 'In Progress', 'Pending Verification', 'Completed', 'Failed'];
        if (!status || !VALID.includes(status))
            return res.status(400).json({ success: false, message: `status must be one of: ${VALID.join(', ')}` });
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        task.status = status;
        await task.save();
        res.json({ success: true, data: task.toJSON() });
    } catch (err) {
        console.error('updateStatus error:', err);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        const { title, description, deadline, allocationId, programId } = req.body;
        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
        if (allocationId !== undefined) {
            if (allocationId && !mongoose.isValidObjectId(allocationId))
                return res.status(400).json({ success: false, message: 'Invalid allocationId' });
            task.allocationId = allocationId || null;
        }
        if (programId !== undefined) {
            if (programId && !mongoose.isValidObjectId(programId))
                return res.status(400).json({ success: false, message: 'Invalid programId' });
            task.programId = programId || null;
        }

        await task.save();
        res.json({ success: true, data: task.toJSON() });
    } catch (err) {
        console.error('updateTask error:', err);
        res.status(500).json({ success: false, message: 'Failed to update task' });
    }
};

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        await task.deleteOne();
        res.json({ success: true, message: 'Task deleted' });
    } catch (err) {
        console.error('deleteTask error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
};

// ── POST /api/tasks/:id/vote ──────────────────────────────────────────────────
export const vote = async (req, res) => {
    try {
        const { id } = req.params;
        const { verdict } = req.body; // 'confirmed' | 'rejected'

        if (req.user.role === 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Admins cannot vote on tasks' });
        }

        if (!['confirmed', 'rejected'].includes(verdict))
            return res.status(400).json({ success: false, message: "verdict must be 'confirmed' or 'rejected'" });
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        if (task.status !== VOTE_ALLOWED_STATUS) {
            return res.status(400).json({
                success: false,
                message: `Voting is only allowed when status is '${VOTE_ALLOWED_STATUS}'`
            });
        }

        const userId = req.user._id;
        const opposite = verdict === 'confirmed' ? 'rejected' : 'confirmed';

        task.votes[opposite] = task.votes[opposite].filter(uid => uid.toString() !== userId.toString());

        const alreadyVoted = task.votes[verdict].some(uid => uid.toString() === userId.toString());
        if (alreadyVoted) {
            task.votes[verdict] = task.votes[verdict].filter(uid => uid.toString() !== userId.toString());
        } else {
            task.votes[verdict].push(userId);
        }

        await task.save();
        res.json({ success: true, data: task.toJSON() });
    } catch (err) {
        console.error('vote error:', err);
        res.status(500).json({ success: false, message: 'Failed to record vote' });
    }
};

// ── POST /api/tasks/upload-photo ─────────────────────────────────────────────
export const uploadPhoto = async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        // Prefix with subdir so the URL /api/uploads/photos/<filename> resolves correctly.
        // Static middleware serves from UPLOAD_PATHS.root, so the returned path
        // must include the subdirectory: "photos/filename.jpg"
        res.json({ success: true, data: { photoUrl: `photos/${req.file.filename}` } });
    } catch (err) {
        console.error('uploadPhoto error:', err);
        res.status(500).json({ success: false, message: 'Failed to upload photo' });
    }
};

// ── POST /api/tasks/:id/verify ────────────────────────────────────────────────
// Citizen submits done ✓ or problem ✗ with optional photo + comment.
// Only userId is stored — no userName needed (authMiddleware doesn't provide name).
export const verify = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comment, photoUrl } = req.body;

        if (!['done', 'problem'].includes(status))
            return res.status(400).json({ success: false, message: "status must be 'done' or 'problem'" });
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ success: false, message: 'Invalid id' });

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        task.verifications.push({
            userId: req.user._id,
            status,
            comment: comment || null,
            photoUrl: photoUrl || null
        });

        await task.save();

        await User.findByIdAndUpdate(req.user._id, { $inc: { points: 1 } });

        const obj = task.toJSON();
        obj.totalCount = task.totalCount;
        obj.doneCount = task.doneCount;
        obj.problemCount = task.problemCount;

        res.json({ success: true, data: obj });
    } catch (err) {
        console.error('verify error:', err);
        res.status(500).json({ success: false, message: 'Failed to record verification' });
    }
};

// ── GET /api/tasks/verification-summary ──────────────────────────────────────
// Public. Returns per-object verification counts for map marker coloring.
// { data: [{ targetId, doneCount, problemCount, totalCount }] }
export const getVerificationSummary = async (req, res) => {
    try {
        const summary = await Task.aggregate([
            { $match: { 'verifications.0': { $exists: true } } },
            { $unwind: '$verifications' },
            {
                $group: {
                    _id: '$targetId',
                    totalCount: { $sum: 1 },
                    doneCount: { $sum: { $cond: [{ $eq: ['$verifications.status', 'done'] }, 1, 0] } },
                    problemCount: { $sum: { $cond: [{ $eq: ['$verifications.status', 'problem'] }, 1, 0] } }
                }
            }
        ]);

        res.json({
            success: true,
            data: summary.map(s => ({
                targetId: s._id.toString(),
                totalCount: s.totalCount,
                doneCount: s.doneCount,
                problemCount: s.problemCount
            }))
        });
    } catch (err) {
        console.error('getVerificationSummary error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch verification summary' });
    }
};