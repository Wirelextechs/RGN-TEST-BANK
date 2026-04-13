import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const { title, course, is_premium_only, time_limit, questions, created_by } = await req.json();

        if (!title || !questions || questions.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Insert Quiz
        const { data: quiz, error: quizError } = await supabase
            .from("quizzes")
            .insert({
                title,
                course,
                is_premium_only: !!is_premium_only,
                time_limit: time_limit || null,
                created_by
            })
            .select()
            .single();

        if (quizError) throw quizError;

        // 2. Insert Questions
        const questionsToInsert = questions.map((q: any) => ({
            quiz_id: quiz.id,
            question_text: q.question,
            options: q.options,
            correct_answer: q.correctAnswer,
            explanation: q.explanation || ""
        }));

        const { error: questionsError } = await supabase
            .from("quiz_questions")
            .insert(questionsToInsert);

        if (questionsError) throw questionsError;

        return NextResponse.json({ success: true, quizId: quiz.id });
    } catch (error: any) {
        console.error("Save quiz error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
