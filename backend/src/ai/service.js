// backend/src/ai/service.js
// Единственное место, где живёт логика Gemini. Вызывается из контроллера.

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3-flash-preview';

// ── Context prompt builder ────────────────────────────────────────────────────

function buildContextSection(context) {
    const parts = [];
    let stepNum = 6;

    if (context.tasks?.length) {
        const taskList = context.tasks
            .map(t => `  - [ID: ${t.id}] "${t.title}" (статус: ${t.status})${t.description ? ` — ${t.description}` : ''}`)
            .join('\n');

        parts.push(`
${stepNum++}. Analyse whether the report text contains facts that CONFIRM or indicate a PROBLEM with any of the following active tasks at this facility.
Only include tasks where there is a meaningful connection. Return results in "taskSignals".

Active tasks:
${taskList}

Examples:
- Report says "крыша всё ещё течёт", task is "Ремонт кровли" (In Progress) → signal: "problem".
- Report says "отопление починили на прошлой неделе", task is "Починить отопление" (Pending Verification) → signal: "confirms".
If no meaningful connection exists, return an empty array for taskSignals.`);
    }

    if (context.fields?.length) {
        const fieldList = context.fields
            .map(f => `  - ${f.label} (key: ${f.key}): текущее значение = "${f.value}"`)
            .join('\n');

        parts.push(`
${stepNum++}. Analyse whether the report text contains facts that CONFIRM or DISPUTE the following verifiable field values at this facility.
Only include fields where there is a meaningful connection. Return results in "fieldSignals".

Verifiable fields:
${fieldList}

Examples:
- Report says "электричества нет", field "Электричество" = "Электричество есть" → signal: "disputes".
- Report says "интернет работает нормально, оптоволокно", field "Интернет" = "Оптоволокно" → signal: "confirms".
If no meaningful connection exists, return an empty array for fieldSignals.`);
    }

    return parts.join('\n');
}

// ── Нормализация fieldSignals — AI может вернуть лейбл вместо ключа ───────────

function normalizeFieldSignals(fieldSignals, contextFields) {
    if (!contextFields?.length) return fieldSignals ?? [];

    return (fieldSignals ?? []).map(s => {
        // Ключ уже правильный
        if (contextFields.find(f => f.key === s.field)) return s;

        // AI вернул лейбл
        const byLabel = contextFields.find(f => f.label.toLowerCase() === s.field.toLowerCase());
        if (byLabel) return { ...s, field: byLabel.key, fieldLabel: byLabel.label };

        // Частичное совпадение
        const byPartial = contextFields.find(f =>
            f.key.toLowerCase().includes(s.field.toLowerCase()) ||
            s.field.toLowerCase().includes(f.label.toLowerCase())
        );
        if (byPartial) return { ...s, field: byPartial.key, fieldLabel: byPartial.label };

        return s;
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * @param {string} description — текст обращения от пользователя
 * @param {{ tasks?: Array, fields?: Array }} [context] — опциональный контекст объекта
 * @returns {Promise<object>} — { title, category, subCategory, severity, summary, taskSignals?, fieldSignals? }
 */
export async function analyzeReport(description, context = {}) {
    const hasContext = (context.tasks?.length ?? 0) > 0 || (context.fields?.length ?? 0) > 0;
    const contextSection = hasContext ? buildContextSection(context) : '';

    const prompt = `
You are an AI assistant for a civic infrastructure app in Uzbekistan called 'Y.Map'.
Analyze the following user report description about a city problem.

User Report: "${description}"

Determine:
1. A short, professional title (max 6 words).
2. The most fitting Category from this list: Roads, Water & Sewage, Electricity, Schools & Kindergartens, Hospitals & Clinics, Waste Management, Other.
3. If the category is 'Schools & Kindergartens' or 'Hospitals & Clinics', also determine a subCategory: 'Water' (plumbing, leaks), 'Electricity' (no power, wires), or 'General/Other'.
4. The Severity level: Low, Medium, High, or Critical.
5. A one-sentence summary for the government dashboard.
${contextSection}
    `;

    const schemaProperties = {
        title: { type: 'STRING' },
        category: { type: 'STRING', enum: ['Roads', 'Water & Sewage', 'Electricity', 'Schools & Kindergartens', 'Hospitals & Clinics', 'Waste Management', 'Other'] },
        subCategory: { type: 'STRING', enum: ['Water', 'Electricity', 'General/Other'] },
        severity: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Critical'] },
        summary: { type: 'STRING' },
    };

    if (hasContext) {
        if (context.tasks?.length) {
            schemaProperties.taskSignals = {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        taskId: { type: 'STRING' },
                        taskTitle: { type: 'STRING' },
                        signal: { type: 'STRING', enum: ['confirms', 'problem'] },
                        confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
                        reason: { type: 'STRING' },
                    },
                    required: ['taskId', 'taskTitle', 'signal', 'confidence', 'reason'],
                },
            };
        }
        if (context.fields?.length) {
            schemaProperties.fieldSignals = {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        field: { type: 'STRING', enum: context.fields.map(f => f.key) },
                        fieldLabel: { type: 'STRING' },
                        signal: { type: 'STRING', enum: ['confirms', 'disputes'] },
                        confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
                        reason: { type: 'STRING' },
                    },
                    required: ['field', 'fieldLabel', 'signal', 'confidence', 'reason'],
                },
            };
        }
    }

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: schemaProperties,
                required: ['title', 'category', 'severity', 'summary'],
            },
        },
    });

    const result = JSON.parse(response.text || '{}');

    return {
        title: result.title || 'New Issue Report',
        category: result.category || 'Other',
        subCategory: result.subCategory || undefined,
        severity: result.severity || 'Medium',
        summary: result.summary || '',
        taskSignals: result.taskSignals ?? [],
        fieldSignals: normalizeFieldSignals(result.fieldSignals, context.fields),
    };
}