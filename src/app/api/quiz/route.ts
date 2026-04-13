// Polyfill for pdf-parse in Node.js / Vercel runtime
if (typeof global.DOMMatrix === "undefined") {
    (global as any).DOMMatrix = class DOMMatrix {};
}
if (typeof global.ImageData === "undefined") {
    (global as any).ImageData = class ImageData {};
}
if (typeof global.Path2D === "undefined") {
    (global as any).Path2D = class Path2D {};
}

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { parseDocumentToQuiz } from "@/lib/gemini";
const pdfParse = require("pdf-parse");

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Enhanced Regex Parser for MCQ documents
 * Handles multi-line questions, various option formats, and answer keys.
 */
function enhancedRegexParse(text: string) {
    const questions: any[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let currentQuestion: any = null;

    const isQuestionStart = (line: string) => {
        return /^(Q|Question|#)?\s*\d+[\.\)\:\-]\s+/i.test(line);
    };

    const isOption = (line: string) => {
        return /^[a-d\d][\.\)\:\-]\s+/i.test(line);
    };

    const isAnswer = (line: string) => {
        return /^(Answer|Ans|Correct|Key)\s*[\:\-]?\s*[a-d]/i.test(line);
    };

    const isExplanation = (line: string) => {
        return /^(Explanation|Rationale|Note)\s*[\:\-]/i.test(line);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isQuestionStart(line)) {
            if (currentQuestion && currentQuestion.options.length >= 2) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question: line.replace(/^(Q|Question|#)?\s*\d+[\.\)\:\-]\s*/i, '').trim(),
                options: [],
                correctAnswer: null,
                explanation: ""
            };
        } else if (currentQuestion && isOption(line)) {
            currentQuestion.options.push(line.replace(/^[a-d\d][\.\)\:\-]\s*/i, '').trim());
        } else if (currentQuestion && isAnswer(line)) {
            const match = line.match(/(?:Answer|Ans|Correct|Key)\s*[\:\-]?\s*([a-d])/i);
            if (match && match[1]) {
                const letter = match[1].toUpperCase();
                const index = letter.charCodeAt(0) - 65;
                if (index >= 0 && index < currentQuestion.options.length) {
                    currentQuestion.correctAnswer = currentQuestion.options[index];
                }
            }
        } else if (currentQuestion && isExplanation(line)) {
            currentQuestion.explanation = line.replace(/^(Explanation|Rationale|Note)\s*[\:\-]\s*/i, '').trim();
        } else if (currentQuestion && currentQuestion.options.length === 0 && !isAnswer(line)) {
            // Multi-line question continuation
            currentQuestion.question += " " + line;
        } else if (currentQuestion && currentQuestion.options.length > 0 && !isAnswer(line) && !isExplanation(line)) {
            // Multi-line option continuation (appends to the last added option)
            const lastIdx = currentQuestion.options.length - 1;
            currentQuestion.options[lastIdx] += " " + line;
        }
    }

    if (currentQuestion && currentQuestion.options.length >= 2) {
        questions.push(currentQuestion);
    }

    return questions;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = file.name.toLowerCase();
        let extractedText = "";

        // Text Extraction
        if (filename.endsWith('.pdf')) {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
        } else if (filename.endsWith('.docx')) {
            const mammothData = await mammoth.extractRawText({ buffer });
            extractedText = mammothData.value;
        } else if (filename.endsWith('.txt')) {
            extractedText = buffer.toString('utf-8');
        } else {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return NextResponse.json({ error: "No text content found" }, { status: 400 });
        }

        let questions: any[] = [];

        // Attempt Gemini Parsing first
        try {
            if (process.env.NEXT_PUBLIC_GEMINI_API_KEY && process.env.NEXT_PUBLIC_GEMINI_API_KEY !== 'placeholder-key') {
                questions = await parseDocumentToQuiz(extractedText);
            }
        } catch (aiError) {
            console.error("Gemini parsing failed, falling back to regex:", aiError);
        }

        // Fallback to Enhanced Regex if Gemini didn't return results
        if (!questions || questions.length === 0) {
            questions = enhancedRegexParse(extractedText);
        }

        if (!questions || questions.length === 0) {
            return NextResponse.json({ error: "Failed to extract questions. Please check document formatting." }, { status: 400 });
        }

        return NextResponse.json({ quiz: questions });

    } catch (error: any) {
        console.error("Quiz parsing error:", error);
        return NextResponse.json({ error: error.message || "Server error during parsing" }, { status: 500 });
    }
}
