// backend/src/budgetAllocation/controller.js

import BudgetAllocation from './model.js';
import Task from '../task/model.js';
import mongoose from 'mongoose';

// ── GET /api/allocations?targetType=&targetId= ────────────────────────────────
export const getAllocations = async (req, res) => {
    try {
        const { targetType, targetId } = req.query;

        if (!targetType || !targetId) {
            return res.status(400).json({ success: false, message: 'targetType and targetId are required' });
        }
        if (!mongoose.isValidObjectId(targetId)) {
            return res.status(400).json({ success: false, message: 'Invalid targetId' });
        }

        const allocations = await BudgetAllocation.find({ targetType, targetId })
            .sort({ createdAt: -1 })
            .lean();

        // Attach task counts per allocation
        const allocationIds = allocations.map(a => a._id);
        const taskCounts = await Task.aggregate([
            { $match: { allocationId: { $in: allocationIds } } },
            { $group: { _id: '$allocationId', count: { $sum: 1 } } }
        ]);

        const countMap = {};
        taskCounts.forEach(t => { countMap[t._id.toString()] = t.count; });

        const data = allocations.map(a => ({
            ...a,
            id: a._id.toString(),
            targetId: a.targetId.toString(),
            createdBy: a.createdBy.toString(),
            taskCount: countMap[a._id.toString()] || 0,
            _id: undefined,
            __v: undefined
        }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('getAllocations error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch allocations' });
    }
};

// ── POST /api/allocations ─────────────────────────────────────────────────────
export const createAllocation = async (req, res) => {
    try {
        const { targetType, targetId, amount, currency, period, note } = req.body;

        if (!targetType || !targetId) {
            return res.status(400).json({ success: false, message: 'targetType and targetId are required' });
        }
        if (!['object', 'program'].includes(targetType)) {
            return res.status(400).json({ success: false, message: 'targetType must be "object" or "program"' });
        }
        if (!mongoose.isValidObjectId(targetId)) {
            return res.status(400).json({ success: false, message: 'Invalid targetId' });
        }

        const allocation = await BudgetAllocation.create({
            targetType,
            targetId,
            amount: amount || null,
            currency: currency || 'UZS',
            period: period || null,
            note: note || null,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: allocation.toJSON() });
    } catch (err) {
        console.error('createAllocation error:', err);
        res.status(500).json({ success: false, message: 'Failed to create allocation' });
    }
};

// ── PATCH /api/allocations/:id ────────────────────────────────────────────────
export const updateAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const allocation = await BudgetAllocation.findById(id);
        if (!allocation) {
            return res.status(404).json({ success: false, message: 'Allocation not found' });
        }

        const { amount, currency, period, note } = req.body;
        if (amount !== undefined) allocation.amount = amount;
        if (currency !== undefined) allocation.currency = currency;
        if (period !== undefined) allocation.period = period;
        if (note !== undefined) allocation.note = note;

        await allocation.save();
        res.json({ success: true, data: allocation.toJSON() });
    } catch (err) {
        console.error('updateAllocation error:', err);
        res.status(500).json({ success: false, message: 'Failed to update allocation' });
    }
};

// ── DELETE /api/allocations/:id ───────────────────────────────────────────────
export const deleteAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const allocation = await BudgetAllocation.findById(id);
        if (!allocation) {
            return res.status(404).json({ success: false, message: 'Allocation not found' });
        }

        // Detach tasks that referenced this allocation rather than deleting them
        await Task.updateMany({ allocationId: allocation._id }, { $set: { allocationId: null } });

        await allocation.deleteOne();
        res.json({ success: true, message: 'Allocation deleted' });
    } catch (err) {
        console.error('deleteAllocation error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete allocation' });
    }
};