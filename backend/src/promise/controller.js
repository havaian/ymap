// backend/src/promise/controller.js
import Promise from './model.js';
import mongoose from 'mongoose';

const VOTE_ALLOWED_STATUS = 'Pending Verification';

// ─── GET /api/promises ────────────────────────────────────────────────────────
// Supports: ?targetType=&targetId=  OR  ?orgId=  OR  ?infraId=  OR  ?allocationId=
export const getPromises = async (req, res) => {
    try {
        let { targetType, targetId, orgId, infraId, allocationId } = req.query;

        // Convenience shorthands
        if (orgId)   { targetType = 'organization';    targetId = orgId; }
        if (infraId) { targetType = 'infrastructure';  targetId = infraId; }

        const filter = {};

        if (targetType && targetId) {
            if (!mongoose.isValidObjectId(targetId)) {
                return res.status(400).json({ success: false, message: 'Invalid targetId' });
            }
            filter.targetType = targetType;
            filter.targetId = targetId;
        }

        if (allocationId) {
            if (!mongoose.isValidObjectId(allocationId)) {
                return res.status(400).json({ success: false, message: 'Invalid allocationId' });
            }
            filter.allocationId = allocationId;
        }

        // Use find() (not lean()) so virtuals (totalCount etc.) are available
        const promises = await Promise.find(filter).sort({ createdAt: -1 });

        const data = promises.map(p => {
            const obj = p.toJSON();
            // Attach virtual counts explicitly (toJSON with virtuals:true handles this,
            // but being explicit here for clarity)
            obj.totalCount   = p.totalCount;
            obj.doneCount    = p.doneCount;
            obj.problemCount = p.problemCount;
            return obj;
        });

        res.json({ success: true, data });
    } catch (err) {
        console.error('getPromises error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch promises' });
    }
};

// ─── GET /api/promises/stats ──────────────────────────────────────────────────
// Public — no auth required, used by the public dashboard
export const getStats = async (req, res) => {
    try {
        const stats = await Promise.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const byStatus = {};
        stats.forEach(s => { byStatus[s._id] = s.count; });

        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

        // Total citizen votes across all promises
        const voteStats = await Promise.aggregate([
            {
                $project: {
                    confirmedCount: { $size: '$votes.confirmed' },
                    rejectedCount:  { $size: '$votes.rejected' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalConfirmed: { $sum: '$confirmedCount' },
                    totalRejected:  { $sum: '$rejectedCount' }
                }
            }
        ]);

        const votes = voteStats[0] || { totalConfirmed: 0, totalRejected: 0 };

        res.json({
            success: true,
            data: {
                total,
                byStatus,
                votes: {
                    confirmed: votes.totalConfirmed,
                    rejected:  votes.totalRejected
                }
            }
        });
    } catch (err) {
        console.error('getStats error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch promise stats' });
    }
};

// ─── POST /api/promises ───────────────────────────────────────────────────────
export const createPromise = async (req, res) => {
    try {
        let { targetType, targetId, organizationId, infraId,
              allocationId, title, description, deadline, status } = req.body;

        // Convenience shorthands from OrgSidebar / InfraSidebar
        if (organizationId) { targetType = 'organization';   targetId = organizationId; }
        if (infraId)        { targetType = 'infrastructure'; targetId = infraId; }

        if (!targetType || !targetId || !title) {
            return res.status(400).json({
                success: false,
                message: 'targetType (or organizationId/infraId), targetId and title are required'
            });
        }

        if (!['organization', 'infrastructure'].includes(targetType)) {
            return res.status(400).json({ success: false, message: 'Invalid targetType' });
        }

        if (!mongoose.isValidObjectId(targetId)) {
            return res.status(400).json({ success: false, message: 'Invalid targetId' });
        }

        if (allocationId && !mongoose.isValidObjectId(allocationId)) {
            return res.status(400).json({ success: false, message: 'Invalid allocationId' });
        }

        const promise = await Promise.create({
            targetType,
            targetId,
            allocationId: allocationId || null,
            title,
            description: description || null,
            deadline: deadline ? new Date(deadline) : null,
            status: status || 'Planned',
            createdBy: req.user._id,
            votes: { confirmed: [], rejected: [] }
        });

        res.status(201).json({ success: true, data: promise.toJSON() });
    } catch (err) {
        console.error('createPromise error:', err);
        res.status(500).json({ success: false, message: 'Failed to create promise' });
    }
};

// ─── PATCH /api/promises/:id/status ──────────────────────────────────────────
export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const VALID_STATUSES = ['Planned', 'In Progress', 'Pending Verification', 'Completed', 'Failed'];

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const promise = await Promise.findById(id);
        if (!promise) {
            return res.status(404).json({ success: false, message: 'Promise not found' });
        }

        promise.status = status;
        await promise.save();

        res.json({ success: true, data: promise.toJSON() });
    } catch (err) {
        console.error('updateStatus error:', err);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};

// ─── PATCH /api/promises/:id ──────────────────────────────────────────────────
// Admin edits title / description / deadline / allocationId
export const updatePromise = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, allocationId } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const promise = await Promise.findById(id);
        if (!promise) {
            return res.status(404).json({ success: false, message: 'Promise not found' });
        }

        if (title       !== undefined) promise.title       = title;
        if (description !== undefined) promise.description = description;
        if (deadline    !== undefined) promise.deadline    = deadline ? new Date(deadline) : null;
        if (allocationId !== undefined) {
            if (allocationId && !mongoose.isValidObjectId(allocationId)) {
                return res.status(400).json({ success: false, message: 'Invalid allocationId' });
            }
            promise.allocationId = allocationId || null;
        }

        await promise.save();

        res.json({ success: true, data: promise.toJSON() });
    } catch (err) {
        console.error('updatePromise error:', err);
        res.status(500).json({ success: false, message: 'Failed to update promise' });
    }
};

// ─── POST /api/promises/:id/vote ─────────────────────────────────────────────
export const vote = async (req, res) => {
    try {
        const { id } = req.params;
        const { verdict } = req.body; // 'confirmed' | 'rejected'

        if (!['confirmed', 'rejected'].includes(verdict)) {
            return res.status(400).json({
                success: false,
                message: "verdict must be 'confirmed' or 'rejected'"
            });
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const promise = await Promise.findById(id);
        if (!promise) {
            return res.status(404).json({ success: false, message: 'Promise not found' });
        }

        if (promise.status !== VOTE_ALLOWED_STATUS) {
            return res.status(400).json({
                success: false,
                message: `Voting is only allowed when status is '${VOTE_ALLOWED_STATUS}'`
            });
        }

        const userId = req.user._id;
        const opposite = verdict === 'confirmed' ? 'rejected' : 'confirmed';

        // Remove from opposite side if already voted there
        promise.votes[opposite] = promise.votes[opposite].filter(
            uid => uid.toString() !== userId.toString()
        );

        // Check if already voted on this side → toggle off (remove vote)
        const alreadyVoted = promise.votes[verdict].some(
            uid => uid.toString() === userId.toString()
        );

        if (alreadyVoted) {
            promise.votes[verdict] = promise.votes[verdict].filter(
                uid => uid.toString() !== userId.toString()
            );
        } else {
            promise.votes[verdict].push(userId);
        }

        await promise.save();

        res.json({ success: true, data: promise.toJSON() });
    } catch (err) {
        console.error('vote error:', err);
        res.status(500).json({ success: false, message: 'Failed to record vote' });
    }
};

// ─── POST /api/promises/upload-photo ─────────────────────────────────────────
// Receives a multipart photo, stores it via multer, returns { photoUrl }
export const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        // req.file.filename is set by multer diskStorage with the unique name
        res.json({ success: true, data: { photoUrl: req.file.filename } });
    } catch (err) {
        console.error('uploadPhoto error:', err);
        res.status(500).json({ success: false, message: 'Failed to upload photo' });
    }
};

// ─── POST /api/promises/:id/verify ───────────────────────────────────────────
// Citizen submits a verification (done ✓ or problem ✗) with optional photo+comment.
// Any authenticated citizen can verify at any time — no status restriction here
// because the PromisesSection shows promises regardless of lifecycle status.
export const verify = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comment, photoUrl } = req.body;

        if (!['done', 'problem'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "status must be 'done' or 'problem'"
            });
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const promise = await Promise.findById(id);
        if (!promise) {
            return res.status(404).json({ success: false, message: 'Promise not found' });
        }

        promise.verifications.push({
            userId:   req.user._id,
            userName: req.user.name,
            status,
            comment:  comment || null,
            photoUrl: photoUrl || null
        });

        await promise.save();

        const obj = promise.toJSON();
        obj.totalCount   = promise.totalCount;
        obj.doneCount    = promise.doneCount;
        obj.problemCount = promise.problemCount;

        res.json({ success: true, data: obj });
    } catch (err) {
        console.error('verify error:', err);
        res.status(500).json({ success: false, message: 'Failed to record verification' });
    }
};

// ─── DELETE /api/promises/:id ─────────────────────────────────────────────────
export const deletePromise = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const promise = await Promise.findById(id);
        if (!promise) {
            return res.status(404).json({ success: false, message: 'Promise not found' });
        }

        await promise.deleteOne();

        res.json({ success: true, message: 'Promise deleted' });
    } catch (err) {
        console.error('deletePromise error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete promise' });
    }
};

// ─── Serializer helper ────────────────────────────────────────────────────────
// Only used by vote() which still calls .lean() indirectly via save+toJSON
function serializePromise(p) {
    return {
        id: p._id.toString(),
        targetType: p.targetType,
        targetId: p.targetId.toString(),
        allocationId: p.allocationId ? p.allocationId.toString() : null,
        title: p.title,
        description: p.description || null,
        deadline: p.deadline || null,
        status: p.status,
        createdBy: p.createdBy.toString(),
        votes: {
            confirmed: (p.votes?.confirmed || []).map(id => id.toString()),
            rejected:  (p.votes?.rejected  || []).map(id => id.toString())
        },
        totalCount:   (p.verifications || []).length,
        doneCount:    (p.verifications || []).filter(v => v.status === 'done').length,
        problemCount: (p.verifications || []).filter(v => v.status === 'problem').length,
        verifications: (p.verifications || []).map(v => ({
            _id:      v._id.toString(),
            userId:   v.userId.toString(),
            userName: v.userName,
            status:   v.status,
            comment:  v.comment || null,
            photoUrl: v.photoUrl || null,
            createdAt: v.createdAt
        })),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
    };
}