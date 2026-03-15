import { GoogleGenAI, Type } from "@google/genai";
import { IssueCategory, Severity, IssueSubCategory } from "../../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskSignal {
  taskId: string;
  taskTitle: string;
  signal: "confirms" | "problem";
  confidence: "low" | "medium" | "high";
  reason: string;
}

export interface FieldSignal {
  field: string;
  fieldLabel: string;
  signal: "confirms" | "disputes";
  confidence: "low" | "medium" | "high";
  reason: string;
}

export interface AnalysisContext {
  tasks?: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
  }>;
  fields?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

export interface AnalysisResult {
  title: string;
  category: IssueCategory;
  subCategory?: IssueSubCategory;
  severity: Severity;
  summary: string;
  taskSignals?: TaskSignal[];
  fieldSignals?: FieldSignal[];
}

// ── Context prompt builder ────────────────────────────────────────────────────

function buildContextSection(context: AnalysisContext): string {
  const parts: string[] = [];
  let stepNum = 6;

  if (context.tasks?.length) {
    const taskList = context.tasks
      .map(
        (t) =>
          `  - [ID: ${t.id}] "${t.title}" (статус: ${t.status})${
            t.description ? ` — ${t.description}` : ""
          }`
      )
      .join("\n");

    parts.push(`
${stepNum++}. Analyse whether the report text contains facts that CONFIRM or indicate a PROBLEM with any of the following active tasks at this facility.
Only include tasks where there is a meaningful connection. Return results in "taskSignals".

Active tasks:
${taskList}

Examples:
- Report says "крыша всё ещё течёт", task is "Ремонт кровли" (In Progress) → signal: "problem", because problem persists despite task being in progress.
- Report says "отопление починили на прошлой неделе", task is "Починить отопление" (Pending Verification) → signal: "confirms".
If no meaningful connection exists, return an empty array for taskSignals.`);
  }

  if (context.fields?.length) {
    const fieldList = context.fields
      .map((f) => `  - ${f.label} (key: ${f.key}): текущее значение = "${f.value}"`)
      .join("\n");

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

  return parts.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export const analyzeReportWithGemini = async (
  userDescription: string,
  context?: AnalysisContext
): Promise<AnalysisResult> => {
  try {
    const model = "gemini-3-flash-preview";

    const hasContext =
      context &&
      ((context.tasks?.length ?? 0) > 0 || (context.fields?.length ?? 0) > 0);

    const contextSection = hasContext ? buildContextSection(context!) : "";

    const prompt = `
You are an AI assistant for a civic infrastructure app in Uzbekistan called 'Y.Map'.
Analyze the following user report description about a city problem.

User Report: "${userDescription}"

Determine:
1. A short, professional title (max 6 words).
2. The most fitting Category from this list: Roads, Water & Sewage, Electricity, Schools & Kindergartens, Hospitals & Clinics, Waste Management, Other.
3. If the category is 'Schools & Kindergartens' or 'Hospitals & Clinics', also determine a subCategory: 'Water' (plumbing, leaks), 'Electricity' (no power, wires), or 'General/Other'.
4. The Severity level: Low, Medium, High, or Critical.
5. A one-sentence summary for the government dashboard.
${contextSection}
    `;

    // Build response schema — conditionally extend with signal arrays
    const schemaProperties: Record<string, any> = {
      title: { type: Type.STRING },
      category: {
        type: Type.STRING,
        enum: [
          "Roads",
          "Water & Sewage",
          "Electricity",
          "Schools & Kindergartens",
          "Hospitals & Clinics",
          "Waste Management",
          "Other",
        ],
      },
      subCategory: {
        type: Type.STRING,
        enum: ["Water", "Electricity", "General/Other"],
        description: "Only for Education or Health categories",
      },
      severity: {
        type: Type.STRING,
        enum: ["Low", "Medium", "High", "Critical"],
      },
      summary: { type: Type.STRING },
    };

    if (hasContext) {
      if (context!.tasks?.length) {
        schemaProperties.taskSignals = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId:     { type: Type.STRING },
              taskTitle:  { type: Type.STRING },
              signal:     { type: Type.STRING, enum: ["confirms", "problem"] },
              confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
              reason:     { type: Type.STRING },
            },
            required: ["taskId", "taskTitle", "signal", "confidence", "reason"],
          },
        };
      }
      if (context!.fields?.length) {
        schemaProperties.fieldSignals = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              // enum принудительно ограничивает AI только реальными camelCase ключами
              field:      { type: Type.STRING, enum: context!.fields!.map((f) => f.key) },
              fieldLabel: { type: Type.STRING },
              signal:     { type: Type.STRING, enum: ["confirms", "disputes"] },
              confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
              reason:     { type: Type.STRING },
            },
            required: ["field", "fieldLabel", "signal", "confidence", "reason"],
          },
        };
      }
    }

    console.log("[Gemini] prompt:\n", prompt);
    console.log("[Gemini] context passed:", JSON.stringify(context, null, 2));

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: ["title", "category", "severity", "summary"],
        },
      },
    });

    const jsonStr = response.text || "{}";
    console.log("[Gemini] raw response:", jsonStr);
    const result = JSON.parse(jsonStr);
    console.log("[Gemini] parsed result:", JSON.stringify(result, null, 2));

    // Нормализация fieldSignals: если AI вернул лейбл вместо ключа — исправляем
    const rawFieldSignals: FieldSignal[] = result.fieldSignals ?? [];
    const normalizedFieldSignals: FieldSignal[] = rawFieldSignals.map((s) => {
      if (!context?.fields) return s;

      // Ключ уже правильный — оставляем
      const byKey = context.fields.find((f) => f.key === s.field);
      if (byKey) return s;

      // AI вернул лейбл — ищем по лейблу
      const byLabel = context.fields.find(
        (f) => f.label.toLowerCase() === s.field.toLowerCase()
      );
      if (byLabel) return { ...s, field: byLabel.key, fieldLabel: byLabel.label };

      // AI вернул перевод значения или что-то иное — ищем частичное совпадение
      const byPartial = context.fields.find(
        (f) =>
          f.key.toLowerCase().includes(s.field.toLowerCase()) ||
          s.field.toLowerCase().includes(f.label.toLowerCase())
      );
      if (byPartial) return { ...s, field: byPartial.key, fieldLabel: byPartial.label };

      return s;
    });

    return {
      title: result.title,
      category: result.category as IssueCategory,
      subCategory: result.subCategory as IssueSubCategory,
      severity: result.severity as Severity,
      summary: result.summary,
      taskSignals: result.taskSignals ?? [],
      fieldSignals: normalizedFieldSignals,
    };
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      title: "New Issue Report",
      category: IssueCategory.OTHER,
      severity: Severity.MEDIUM,
      summary: "User reported an issue. AI analysis unavailable.",
    };
  }
};