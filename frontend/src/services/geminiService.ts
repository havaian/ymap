
import { GoogleGenAI, Type } from "@google/genai";
import { IssueCategory, Severity, IssueSubCategory } from '../../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface AnalysisResult {
  title: string;
  category: IssueCategory;
  subCategory?: IssueSubCategory;
  severity: Severity;
  summary: string;
}

export const analyzeReportWithGemini = async (userDescription: string): Promise<AnalysisResult> => {
  try {
    const model = "gemini-3-flash-preview";
    
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
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { 
              type: Type.STRING, 
              enum: [
                'Roads', 'Water & Sewage', 'Electricity', 'Schools & Kindergartens', 
                'Hospitals & Clinics', 'Waste Management', 'Other'
              ] 
            },
            subCategory: {
              type: Type.STRING,
              enum: ['Water', 'Electricity', 'General/Other'],
              description: 'Only for Education or Health categories'
            },
            severity: { 
              type: Type.STRING,
              enum: ['Low', 'Medium', 'High', 'Critical']
            },
            summary: { type: Type.STRING }
          },
          required: ["title", "category", "severity", "summary"]
        }
      }
    });

    const jsonStr = response.text || '{}';
    const result = JSON.parse(jsonStr);
    
    return {
      title: result.title,
      category: result.category as IssueCategory,
      subCategory: result.subCategory as IssueSubCategory,
      severity: result.severity as Severity,
      summary: result.summary
    };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      title: "New Issue Report",
      category: IssueCategory.OTHER,
      severity: Severity.MEDIUM,
      summary: "User reported an issue. AI analysis unavailable."
    };
  }
};
