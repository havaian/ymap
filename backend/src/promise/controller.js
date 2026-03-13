import PromiseModel from './model.js';
import Organization from '../organization/model.js';

// ─────────────────────────────────────────────
// GET /api/promises?orgId=<id>
// Public — returns all promises for an org with verification counts
// ─────────────────────────────────────────────

export const getByOrg = async (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
        return res.status(400).json({ success: false, error: 'orgId query param required' });
    }

    const promises = await PromiseModel.find({ organizationId: orgId }).lean();

    res.json({
        success: true,
        data: promises.map(p => ({
            id: p._id.toString(),
            organizationId: p.organizationId.toString(),
            title: p.title,
            description: p.description,
            verifications: p.verifications,
            doneCount: p.verifications.filter(v => v.status === 'done').length,
            problemCount: p.verifications.filter(v => v.status === 'problem').length,
            totalCount: p.verifications.length,
            createdAt: p.createdAt
        }))
    });
};

// ─────────────────────────────────────────────
// POST /api/promises
// Admin only — create a new promise for an org
// Body: { organizationId, title, description? }
// ─────────────────────────────────────────────

export const createPromise = async (req, res) => {
    const { organizationId, title, description } = req.body;

    if (!organizationId || !title?.trim()) {
        return res.status(400).json({ success: false, error: 'organizationId and title are required' });
    }

    const org = await Organization.findById(organizationId).lean();
    if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    const p = await PromiseModel.create({
        organizationId,
        title: title.trim(),
        description: description?.trim() || ''
    });

    res.status(201).json({
        success: true,
        data: {
            id: p._id.toString(),
            organizationId: organizationId.toString(),
            title: p.title,
            description: p.description,
            verifications: [],
            doneCount: 0,
            problemCount: 0,
            totalCount: 0,
            createdAt: p.createdAt
        }
    });
};

// ─────────────────────────────────────────────
// POST /api/promises/:id/verify
// Authenticated citizen — submit a verification
// Body: { status: 'done' | 'problem', comment?, photoUrl? }
// ─────────────────────────────────────────────

export const addVerification = async (req, res) => {
    const { id } = req.params;
    const { status, comment, photoUrl } = req.body;

    if (!status || !['done', 'problem'].includes(status)) {
        return res.status(400).json({ success: false, error: 'status must be "done" or "problem"' });
    }

    const p = await PromiseModel.findById(id);
    if (!p) {
        return res.status(404).json({ success: false, error: 'Promise not found' });
    }

    p.verifications.push({
        userId: req.user._id,
        userName: req.user.name,
        status,
        comment: comment?.trim() || '',
        photoUrl: photoUrl || null
    });

    await p.save();

    const added = p.verifications[p.verifications.length - 1];
    res.status(201).json({ success: true, data: added });
};

// ─────────────────────────────────────────────
// DELETE /api/promises/:id
// Admin only
// ─────────────────────────────────────────────

export const deletePromise = async (req, res) => {
    const deleted = await PromiseModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
        return res.status(404).json({ success: false, error: 'Promise not found' });
    }
    res.json({ success: true });
};