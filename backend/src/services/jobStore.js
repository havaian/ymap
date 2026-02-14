// backend/src/services/jobStore.js

const jobs = new Map();

export function createJob() {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    jobs.set(id, {
        id,
        status: 'running',  // 'running' | 'done' | 'error'
        phase: 'preparing', // 'preparing' | 'orgs' | 'infrastructure' | 'done'
        progress: 0,        // current batch number (1-indexed)
        total: 0,           // total batches for current phase
        result: null,
        error: null,
        createdAt: Date.now()
    });
    return id;
}

export function updateJob(id, updates) {
    const job = jobs.get(id);
    if (job) jobs.set(id, { ...job, ...updates });
}

export function getJob(id) {
    return jobs.get(id) || null;
}

// Clean up completed jobs older than 1 hour to prevent unbounded memory growth
setInterval(() => {
    const cutoff = Date.now() - 3_600_000;
    for (const [id, job] of jobs.entries()) {
        if (job.createdAt < cutoff) jobs.delete(id);
    }
}, 300_000);