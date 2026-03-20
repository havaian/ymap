// frontend/src/services/geminiService.ts
// Gemini логика перенесена на бэкенд. Этот файл — тонкая обёртка над /api/ai/analyze.

import api from "./api";
import { IssueCategory, Severity, IssueSubCategory } from "../../types";

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

export const analyzeReportWithGemini = async (
  userDescription: string,
  context?: AnalysisContext
): Promise<AnalysisResult> => {
  try {
    const response = await api.post("/ai/analyze", {
      description: userDescription,
      context: context ?? {},
    });
    return response.data.data as AnalysisResult;
  } catch (error) {
    console.error("AI analysis failed:", error);
    return {
      title: "New Issue Report",
      category: IssueCategory.OTHER,
      severity: Severity.MEDIUM,
      summary: "User reported an issue. AI analysis unavailable.",
    };
  }
};
