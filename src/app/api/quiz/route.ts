import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export const maxDuration = 60;

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

        // Determine file type and parse offline
        if (filename.endsWith('.pdf')) {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
        } else if (filename.endsWith('.docx')) {
            const mammothData = await mammoth.extractRawText({ buffer });
            extractedText = mammothData.value;
        } else if (filename.endsWith('.txt')) {
            extractedText = buffer.toString('utf-8');
        } else {
            return NextResponse.json({ error: "Unsupported file type. Please upload PDF, DOCX, or TXT." }, { status: 400 });
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return NextResponse.json({ error: "Could not extract text from document. Ensure it's not a scanned image PDF." }, { status: 400 });
        }

        // Regex parsing structured to find MCQs
        const questions: any[] = [];
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let currentQuestion: any = null;

        const isQuestionStart = (line: string) => {
            // Matches "1.", "Q1:", "Question 1:", etc.
            return /^(Q|Question)?\s*\d+[\.\)\:]\s+/i.test(line);
        };

        const isOption = (line: string) => {
            // Matches "A.", "a)", "A:", etc.
            return /^[a-d][\.\)\:]\s+/i.test(line);
        };

        const isAnswer = (line: string) => {
            // Matches "Answer: A", "Ans: B"
            return /^(Answer|Ans|Correct)\s*[\:\-]?\s*[a-d]/i.test(line);
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (isQuestionStart(line)) {
                // Save previous if exists
                if (currentQuestion && currentQuestion.options.length >= 2) {
                    questions.push(currentQuestion);
                }

                // Initialize the new question outline
                currentQuestion = {
                    question: line.replace(/^(Q|Question)?\s*\d+[\.\)\:]\s*/i, '').trim(),
                    options: [],
                    correctAnswer: null,
                };
            } else if (currentQuestion && isOption(line)) {
                currentQuestion.options.push(line);
            } else if (currentQuestion && isAnswer(line)) {
                // Extract just the letter (A, B, C, D)
                const match = line.match(/(?:Answer|Ans|Correct)\s*[\:\-]?\s*([a-d])/i);
                if (match && match[1]) {
                    const letter = match[1].toUpperCase();
                    // Try to match the exact option string we already extracted
                    const fullOption = currentQuestion.options.find((opt: string) => opt.toUpperCase().startsWith(letter + '.') || opt.toUpperCase().startsWith(letter + ')'));
                    currentQuestion.correctAnswer = fullOption || null;
                }
            } else if (currentQuestion && currentQuestion.options.length === 0 && !isAnswer(line)) {
                // Multi-line question continuation
                currentQuestion.question += " " + line;
            }
        }

        // Push the very last question if valid
        if (currentQuestion && currentQuestion.options.length >= 2) {
            questions.push(currentQuestion);
        }

        if (questions.length === 0) {
            throw new Error("No structured Multiple Choice Questions found. Please ensure questions start with numbers and options start with A, B, C, D.");
        }

        return NextResponse.json({ quiz: questions });

    } catch (error: any) {
        console.error("Quiz parsing error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to parse document natively" },
            { status: 500 }
        );
    }
}
