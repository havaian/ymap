// backend/src/program/controller.js

import mongoose from 'mongoose';
import Program from './model.js';
import Task from '../task/model.js';
import Object_ from '../object/model.js';
import BudgetAllocation from '../budgetAllocation/model.js';

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

    // Если указан бюджет — сразу создать аллокацию на программу
    if (totalBudget) {
        await BudgetAllocation.create({
            targetType: 'program',
            targetId: program._id,
            amount: totalBudget,
            currency: currency || 'UZS',
            note: `Бюджет программы: ${program.name}`,
            createdBy: req.user._id
        });
    }

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

// POST /api/programs/:id/bulk-tasks
// Создаёт одну задачу с одинаковыми title/description/deadline
// для каждого objectId в программе. Уже существующие задачи с тем же
// programId + targetId + title — не дублируются.
export const bulkCreateTasks = async (req, res) => {
    const { id } = req.params;
    const { title, description, deadline } = req.body;

    if (!title)
        return res.status(400).json({ success: false, message: 'title is required' });
    if (!mongoose.isValidObjectId(id))
        return res.status(400).json({ success: false, message: 'Invalid id' });

    const program = await Program.findById(id);
    if (!program)
        return res.status(404).json({ success: false, message: 'Program not found' });
    if (program.objectIds.length === 0)
        return res.status(400).json({ success: false, message: 'Program has no assigned objects' });

    // Находим уже существующие задачи этой программы с таким же title
    const existing = await Task.find({ programId: id, title }).select('targetId').lean();
    const existingTargets = new Set(existing.map(t => t.targetId.toString()));

    const toCreate = program.objectIds
        .filter(oid => !existingTargets.has(oid.toString()))
        .map(oid => ({
            targetId: oid,
            programId: program._id,
            title,
            description: description || null,
            deadline: deadline ? new Date(deadline) : null,
            status: 'Planned',
            createdBy: req.user._id,
            votes: { confirmed: [], rejected: [] }
        }));

    if (toCreate.length === 0)
        return res.json({ success: true, data: { created: 0, skipped: existing.length } });

    await Task.insertMany(toCreate);

    res.json({ success: true, data: { created: toCreate.length, skipped: existing.length } });
};

// GET /api/programs/:id/task-analytics — публичная аналитика задач программы
// Группирует задачи по названию, считает сколько учреждений выполнили/не выполнили
export const getProgramTaskAnalytics = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id).lean();
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    if (!program.objectIds?.length) {
        return res.json({ success: true, data: [] });
    }

    const [tasks, objects] = await Promise.all([
        Task.find({ programId: id })
            .select('title targetId status verifications')
            .lean(),
        Object_.find({ _id: { $in: program.objectIds } })
            .select('name objectType tuman viloyat')
            .lean()
    ]);

    const objMap = new Map(objects.map(o => [o._id.toString(), o]));

    // Группируем по названию задачи
    const byTitle = new Map();
    for (const task of tasks) {
        const title = task.title;
        if (!byTitle.has(title)) byTitle.set(title, []);
        const doneCount = (task.verifications || []).filter(v => v.status === 'done').length;
        const problemCount = (task.verifications || []).filter(v => v.status === 'problem').length;
        const obj = objMap.get(task.targetId?.toString());
        byTitle.get(title).push({
            taskId: task._id.toString(),
            taskStatus: task.status,
            objectId: task.targetId?.toString(),
            objectName: obj?.name || '—',
            objectType: obj?.objectType || null,
            tuman: obj?.tuman || null,
            doneCount,
            problemCount,
            totalVerifications: (task.verifications || []).length,
        });
    }

    const data = Array.from(byTitle.entries()).map(([title, items]) => ({
        title,
        totalFacilities: items.length,
        // Учреждение «выполнило» если хотя бы 1 верификация done
        verifiedDone: items.filter(i => i.doneCount > 0).length,
        // Учреждение «не выполнило» если есть problem но нет done
        verifiedProblem: items.filter(i => i.problemCount > 0 && i.doneCount === 0).length,
        notVerified: items.filter(i => i.totalVerifications === 0).length,
        facilities: items,
    }));

    res.json({ success: true, data });
};

// GET /api/programs/:id/objects — объекты программы с их задачами
export const getProgramObjects = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const program = await Program.findById(id).lean();
    if (!program) {
        return res.status(404).json({ success: false, message: 'Program not found' });
    }

    if (!program.objectIds?.length) {
        return res.json({ success: true, data: [] });
    }

    const [objects, tasks] = await Promise.all([
        Object_.find({ _id: { $in: program.objectIds } })
            .select('name objectType viloyat tuman lat lng regionCode')
            .lean(),
        Task.find({ programId: id })
            .select('targetId title status deadline doneCount problemCount totalCount verifications')
            .lean()
    ]);

    // Attach tasks to their objects
    const tasksByObject = new Map();
    tasks.forEach(t => {
        const key = t.targetId.toString();
        if (!tasksByObject.has(key)) tasksByObject.set(key, []);
        tasksByObject.get(key).push({
            id: t._id.toString(),
            title: t.title,
            status: t.status,
            deadline: t.deadline,
            doneCount: t.verifications?.filter(v => v.status === 'done').length || 0,
            problemCount: t.verifications?.filter(v => v.status === 'problem').length || 0,
            totalCount: t.verifications?.length || 0,
        });
    });

    const data = objects.map(o => ({
        id: o._id.toString(),
        name: o.name,
        objectType: o.objectType,
        viloyat: o.viloyat,
        tuman: o.tuman,
        lat: o.lat,
        lng: o.lng,
        tasks: tasksByObject.get(o._id.toString()) || [],
    }));

    res.json({ success: true, data });
};