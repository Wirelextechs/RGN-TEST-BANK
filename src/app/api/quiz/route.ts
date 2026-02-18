import { NextRequest, NextResponse } from "next/server";
import { parseDocumentToQuiz } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Read file content as text
        // Note: For binary files (PDF/Word), you'd normally use a library like pdf-parse 
        // but here we demonstrate the AI integration logic.
        const text = await file.text();

        const quiz = await parseDocumentToQuiz(text);

        return NextResponse.json({ quiz });
    } catch (error: any) {
        console.error("Quiz generation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
