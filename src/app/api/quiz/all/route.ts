import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        
        // Fetch quizzes with their questions
        const { data, error } = await supabase
            .from("quizzes")
            .select("*, quiz_questions(*)")
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ quizzes: data });
    } catch (error: any) {
        console.error("Fetch quizzes error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
