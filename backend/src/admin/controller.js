// backend/src/admin/controller.js

import { getUsers, blockUser } from '../user/controller.js';
import { syncObjects as runSync } from '../object/controller.js';
import { generateMockData, clearSeededData } from '../services/seeder.js';
import { createJob, updateJob, getJob } from '../services/jobStore.js';

export const adminGetUsers = getUsers;
export const adminBlockUser = blockUser;

// ── POST /api/admin/sync-objects ──────────────────────────────────────────────
// Fetches all three duasr.uz endpoints and upserts into the Object collection.
// Responds immediately with jobId; caller polls GET /api/admin/jobs/:jobId.
export const syncObjects = async (req, res) => {
    const jobId = createJob();

    res.json({ success: true, data: { jobId } });

    setImmediate(async () => {
        await runSync(req, res, jobId, updateJob);
    });
};

export const getJobStatus = (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, data: job });
};

export const seedData = async (req, res) => {
    const { issuesCount = 1000, includeComments = true } = req.body;
    const result = await generateMockData(parseInt(issuesCount), includeComments);
    res.json({ success: true, data: result });
};

export const clearSeeded = async (req, res) => {
    const result = await clearSeededData();
    res.json({ success: true, data: result });
};