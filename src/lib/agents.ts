import { GoogleGenAI, Type } from "@google/genai";
import { LegalUpdate, ScrapedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class AnalysisAgent {
  static async analyze(data: ScrapedData): Promise<Partial<LegalUpdate>> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following legal/regulatory text from ${data.url}. 
      Title: ${data.title}
      Text: ${data.text}
      
      Provide a structured analysis including:
      1. A concise summary (max 3 sentences).
      2. The primary topic (e.g., Tax, Labour, Compliance, Environmental).
      3. Impact level (High, Medium, Low) based on how many businesses it affects and the severity of penalties.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            topic: { type: Type.STRING },
            impact_level: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
          },
          required: ["summary", "topic", "impact_level"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  }
}

export class ComplianceAgent {
  static async suggestActions(update: Partial<LegalUpdate>): Promise<{ actions: string; departments: string }> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this legal update:
      Topic: ${update.topic}
      Summary: ${update.summary}
      Impact: ${update.impact_level}
      
      Suggest 2-3 specific compliance actions and identify which departments (e.g., HR, Finance, Legal, IT) should be involved.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actions: { type: Type.STRING },
            departments: { type: Type.STRING }
          },
          required: ["actions", "departments"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  }
}
