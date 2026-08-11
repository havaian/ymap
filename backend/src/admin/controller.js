// backend/src/admin/controller.js

import { getUsers, blockUser } from '../user/controller.js';
import { importObjects } from '../scripts/import-objects.js';
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

// УДАЛЕНО: обработчики сидера (seed/generate, seed/clear,
// seed/program-verifications). Генерация выдуманных обращений и проверок снята
// с платформы вместе с services/seeder.js.
