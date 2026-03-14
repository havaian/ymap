// backend/src/program/controller.js

import mongoose from 'mongoose';
import Program from './model.js';
import Object_ from '../object/model.js';

// ── GET /api/programs ─────────────────────────────────────────────────────────

export const getPrograms = async (req, res) => {
    const { status, regionCode } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (regionCode) filter['scope.regionCode'] = parseInt(regionCode);

    const programs = await Program.find(filter).sort({ createdAt: -1 }).lean();

    res.json({
        success: true,
        data: programs.map(p => ({
            ...p,
            id: p._id.toString(),
            createdBy: p.createdBy?.toString(),
            objectIds: (p.objectIds || []).map(id => id.toString()),
            _id: undefined,
            __v: undefined
        }))
    });
};

// ── GET /api/programs/:id ─────────────────────────────────────────────────────

export const getProgram = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id).lean();
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    res.json({
        success: true,
        data: {
            ...program,
            id: program._id.toString(),
            createdBy: program.createdBy?.toString(),
            objectIds: (program.objectIds || []).map(id => id.toString()),
            _id: undefined,
            __v: undefined
        }
    });
};

// ── POST /api/programs ────────────────────────────────────────────────────────

export const createProgram = async (req, res) => {
    const { name, number, description, deadline, status, totalBudget, currency, scope } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'name is required' });
    }

    const program = await Program.create({
        name,
        number: number || null,
        description: description || null,
        deadline: deadline || null,
        status: status || 'active',
        totalBudget: totalBudget || null,
        currency: currency || 'UZS',
        scope: {
            objectTypes: scope?.objectTypes || [],
            regionCode: scope?.regionCode || null,
            districtId: scope?.districtId || null
        },
        objectIds: [],
        createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: program.toJSON() });
};

// ── PATCH /api/programs/:id ───────────────────────────────────────────────────

export const updateProgram = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id);
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const allowed = ['name', 'number', 'description', 'deadline', 'status', 'totalBudget', 'currency', 'scope'];
    for (const key of allowed) {
        if (req.body[key] !== undefined) program[key] = req.body[key];
    }

    await program.save();
    res.json({ success: true, data: program.toJSON() });
};

// ── DELETE /api/programs/:id ──────────────────────────────────────────────────

export const deleteProgram = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id);
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    await program.deleteOne();
    res.json({ success: true, message: 'Program deleted' });
};

// ── POST /api/programs/:id/assign-objects ──────────────────────────────────────
// Auto-assigns objects based on program scope, then merges with any existing
// manually-added objectIds. Idempotent — safe to re-run.

export const assignObjects = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id);
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const { scope } = program;
    const filter = {};

    if (scope.objectTypes && scope.objectTypes.length > 0) {
        filter.objectType = { $in: scope.objectTypes };
    }
    if (scope.regionCode) {
        filter.regionCode = scope.regionCode;
    }
    if (scope.districtId) {
        filter.districtId = scope.districtId;
    }

    const matched = await Object_.find(filter).select('_id').lean();
    const matchedIds = matched.map(o => o._id.toString());

    // Merge with existing manual entries (set union)
    const existingIds = program.objectIds.map(id => id.toString());
    const merged = [...new Set([...existingIds, ...matchedIds])];

    program.objectIds = merged;
    await program.save();

    res.json({
        success: true,
        data: {
            assigned: matchedIds.length,
            total: merged.length,
            objectIds: merged
        }
    });
};

// ── POST /api/programs/:id/objects/:objectId ──────────────────────────────────
// Manually add a single object to a program.

export const addObject = async (req, res) => {
    const { id, objectId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(objectId)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id);
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const exists = program.objectIds.some(oid => oid.toString() === objectId);
    if (!exists) {
        program.objectIds.push(objectId);
        await program.save();
    }

    res.json({ success: true, data: program.toJSON() });
};

// ── DELETE /api/programs/:id/objects/:objectId ────────────────────────────────
// Manually remove a single object from a program.

export const removeObject = async (req, res) => {
    const { id, objectId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(objectId)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id);
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    program.objectIds = program.objectIds.filter(oid => oid.toString() !== objectId);
    await program.save();

    res.json({ success: true, data: program.toJSON() });
};