import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;
export const runtime = 'edge';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'placeholder-key');

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Read file as ArrayBuffer for binary processing
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64Data = Buffer.from(uint8Array).toString('base64');

        // Determine MIME type
        const mimeType = file.type || getMimeType(file.name);

        const prompt = `You are an expert MCQ extractor. Analyze this uploaded document carefully.

Extract ALL Multiple Choice Questions (MCQs) found in the document.

Return your response as a STRICT JSON array with this exact structure:
[
  {
    "question": "The full text of the question",
    "options": ["A. Option text", "B. Option text", "C. Option text", "D. Option text"],
    "correctAnswer": "The full text of the correct option exactly as it appears in options array"
  }
]

IMPORTANT RULES:
- Extract EVERY question, do not skip any
- Include the letter prefix (A., B., C., D.) in each option
- For "correctAnswer", use the EXACT string from the options array
- If the document includes answer keys or "Correct Answer:" markers, use those
- If no explicit answer is marked, make your best educated guess based on medical/nursing knowledge
- Return ONLY the raw JSON array, no markdown, no code blocks, no other text
- If there are sub-questions or multi-part questions, treat each part as a separate question`;

        const contentParts = [
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ];

        // Retry logic for rate limits
        let result;
        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                result = await model.generateContent(contentParts);
                break; // Success — exit retry loop
            } catch (apiError: any) {
                lastError = apiError;
                const errorMsg = apiError.message || '';

                // Check if it's a rate limit error
                if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Too Many Requests')) {
                    // Extract retry delay if available
                    const delayMatch = errorMsg.match(/retry in ([\d.]+)s/);
                    const waitSec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : (attempt + 1) * 30;

                    if (attempt < 2) {
                        console.log(`[Quiz API] Rate limited, retrying in ${waitSec}s (attempt ${attempt + 1}/3)`);
                        await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
                        continue;
                    }
                }
                throw apiError;
            }
        }

        if (!result) {
            const errMsg = lastError?.message || '';
            if (errMsg.includes('429') || errMsg.includes('quota')) {
                throw new Error('AI quota exceeded. Please wait a minute and try again, or contact your admin to upgrade the API plan.');
            }
            throw lastError || new Error('Failed to get AI response');
        }

        const response = await result.response;
        let jsonText = response.text()
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // Try to extract JSON array if there's extra text
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }

        let quiz;
        try {
            quiz = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error("Failed to parse Gemini response:", jsonText.substring(0, 500));
            throw new Error("AI returned invalid JSON format");
        }

        if (!Array.isArray(quiz) || quiz.length === 0) {
            throw new Error("No questions extracted from document");
        }

        // Validate and clean each question
        quiz = quiz.map((q: any, i: number) => ({
            question: q.question || `Question ${i + 1}`,
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || q.correct_answer || q.answer || (q.options?.[0] || "")
        })).filter((q: any) => q.options.length >= 2);

        return NextResponse.json({ quiz });
    } catch (error: any) {
        console.error("Quiz generation error:", error);

        // Clean up error message for the user
        let userMessage = error.message || "Failed to process document";
        if (userMessage.includes('429') || userMessage.includes('quota') || userMessage.includes('Too Many')) {
            userMessage = 'AI quota exceeded. Please wait a minute and try again.';
        }

        return NextResponse.json(
            { error: userMessage },
            { status: 500 }
        );
    }
}

function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'txt': return 'text/plain';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        default: return 'application/octet-stream';
    }
}
