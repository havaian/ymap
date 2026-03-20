// backend/src/admin/controller.js

import { getUsers, blockUser } from '../user/controller.js';
import { importObjects } from '../scripts/import-objects.js';
import { generateMockData, clearSeededData, generateProgramVerifications, clearProgramVerifications } from '../services/seeder.js';
import { createJob, updateJob, getJob } from '../services/jobStore.js';
import { invalidateAnalyticsCache } from '../middleware/cache.js';

export const adminGetUsers = getUsers;
export const adminBlockUser = blockUser;

// ── POST /api/admin/sync-objects ──────────────────────────────────────────────
// Reads local JSON files in src/data/ and upserts into the Object collection.
// Accepts optional ?source=ssv|bogcha|maktab44 to process a single file.
// Returns a jobId immediately; client polls /jobs/:jobId for progress.

export const syncObjects = async (req, res) => {
    const source = req.query.source || req.body.source || null;

    const jobId = createJob();
    res.json({ success: true, data: { jobId } });

    setImmediate(async () => {
        try {
            updateJob(jobId, { phase: 'loading_districts', progress: 0, total: 1 });

            const result = await importObjects({
                source,
                dryRun: false,
                onProgress: (phase, done, total) => {
                    updateJob(jobId, { phase, progress: done, total });
                }
            });

            updateJob(jobId, {
                status: 'done',
                phase: 'done',
                progress: result.upserted,
                total: result.upserted,
                result
            });
            await invalidateAnalyticsCache();
        } catch (error) {
            console.error('syncObjects job failed:', error);
            updateJob(jobId, { status: 'error', error: error.message });
        }
    });
};

// ── GET /api/admin/jobs/:jobId ────────────────────────────────────────────────

export const getJobStatus = (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, data: job });
};

// ── POST /api/admin/seed/generate ────────────────────────────────────────────

export const seedData = async (req, res) => {
    const { issuesCount = 1000, includeComments = true } = req.body;
    const result = await generateMockData(parseInt(issuesCount), includeComments);
    res.json({ success: true, data: result });
};

// ── DELETE /api/admin/seed/clear ─────────────────────────────────────────────

export const clearSeeded = async (req, res) => {
    const result = await clearSeededData();
    res.json({ success: true, data: result });
};

// ── POST /api/admin/seed/program-verifications ────────────────────────────────

export const seedProgramVerifications = async (req, res) => {
    const { maxPerTask = 6 } = req.body;
    const result = await generateProgramVerifications(parseInt(maxPerTask));
    res.json({ success: true, data: result });
};

// ── DELETE /api/admin/seed/program-verifications ──────────────────────────────

export const clearProgramVerifs = async (req, res) => {
    const result = await clearProgramVerifications();
    res.json({ success: true, data: result });
};