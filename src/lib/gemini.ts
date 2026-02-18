import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function parseDocumentToQuiz(text: string) {
    const prompt = `
    Analyze the following text from a medical/nursing exam document. 
    Extract all Multiple Choice Questions (MCQs) and format them into a strict JSON array.
    Each object in the array MUST have the following structure:
    {
      "question": "The text of the question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The exact text of the correct option"
    }
    
    Return ONLY the JSON array, no other text.
    
    Document Text:
    ${text}
  `;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().replace(/```json|```/g, "").trim();

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", jsonText);
        throw new Error("Invalid quiz format received from AI");
    }
}
