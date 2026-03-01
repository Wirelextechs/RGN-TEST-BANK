import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await req.json();
        const { school, course } = body;

        const results: any = {};

        // 1. School Study Group
        if (school && school !== "Other / Not Listed") {
            let { data: exSchoolGroup } = await supabaseAdmin
                .from("study_groups")
                .select("*")
                .eq("school_name", school)
                .eq("group_type", "school")
                .single();

            if (!exSchoolGroup) {
                const { data: nGroup, error: insertErr } = await supabaseAdmin
                    .from("study_groups")
                    .insert({
                        school_name: school,
                        group_type: "school"
                    })
                    .select().single();

                if (insertErr) {
                    console.error("Failed to insert school group:", insertErr);
                    throw new Error(`School Insert Error: ${insertErr.message}`);
                }
                exSchoolGroup = nGroup;
            }
            results.schoolGroup = exSchoolGroup;
        }

        // 2. Course Study Group
        if (course && course !== "") {
            let { data: exCourseGroup } = await supabaseAdmin
                .from("study_groups")
                .select("*")
                .eq("course_name", course)
                .eq("group_type", "course")
                .single();

            if (!exCourseGroup) {
                const { data: nGroup, error: insertErr } = await supabaseAdmin
                    .from("study_groups")
                    .insert({
                        course_name: course,
                        group_type: "course",
                        school_name: "Global Course Group" // Fallback to avoid null constraint issues if the SQL wasn't run perfectly
                    })
                    .select().single();

                if (insertErr) {
                    console.error("Failed to insert course group:", insertErr);
                    throw new Error(`Course Insert Error: ${insertErr.message}`);
                }
                exCourseGroup = nGroup;
            }
            results.courseGroup = exCourseGroup;
        }

        return NextResponse.json({ success: true, ...results });
    } catch (error: any) {
        console.error("Study group initialization error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to initialize study groups",
            details: error
        }, { status: 500 });
    }
}
