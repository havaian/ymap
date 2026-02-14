// backend/src/admin/controller.js

import fs from 'fs';
import { getUsers, blockUser } from '../user/controller.js';
import { importOrganizationsFromExcel } from '../services/excel.js';
import { generateMockData, clearSeededData } from '../services/seeder.js';
import { createJob, updateJob, getJob } from '../services/jobStore.js';

export const adminGetUsers = getUsers;
export const adminBlockUser = blockUser;

export const uploadOrganizations = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    const jobId = createJob();

    // Respond immediately — client will poll /jobs/:jobId for progress
    res.json({ success: true, data: { jobId } });

    // Run import in background after response is flushed
    setImmediate(async () => {
        try {
            const result = await importOrganizationsFromExcel(
                req.file.path,
                (phase, progress, total) => {
                    updateJob(jobId, { phase, progress, total });
                }
            );

            updateJob(jobId, {
                status: 'done',
                phase: 'done',
                progress: result.total,
                total: result.total,
                result
            });
        } catch (error) {
            console.error('Import job failed:', error);
            updateJob(jobId, {
                status: 'error',
                error: error.message
            });
        } finally {
            // Clean up the temp file regardless of outcome
            try { fs.unlinkSync(req.file.path); } catch (_) { }
        }
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

    res.json({
        success: true,
        data: result
    });
};

export const clearSeeded = async (req, res) => {
    const result = await clearSeededData();

    res.json({
        success: true,
        data: result
    });
};