// backend/src/ai/controller.js

import { analyzeReport } from './service.js';

// POST /api/ai/analyze
// Body: { description: string, context?: { tasks?, fields? } }
// Auth: authMiddleware (любой авторизованный пользователь)
export const analyze = async (req, res) => {
    const { description, context } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'description is required (min 5 chars)' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ success: false, message: 'AI analysis unavailable' });
    }

    const result = await analyzeReport(description.trim(), context ?? {});
    res.json({ success: true, data: result });
};