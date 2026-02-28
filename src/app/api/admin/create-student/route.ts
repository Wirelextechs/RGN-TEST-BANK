import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await req.json();
        const { full_name, email, password, school, phone_number } = body;

        if (!full_name || !email || !password) {
            return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
        }

        // Create auth user via admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Skip email verification
            user_metadata: {
                full_name,
                school: school || "",
                phone_number: phone_number || "",
                role: "student"
            }
        });

        if (authError) throw authError;

        // Create profile record
        if (authData?.user) {
            await supabaseAdmin.from("profiles").upsert({
                id: authData.user.id,
                full_name,
                role: "student",
                school: school || "",
                phone_number: phone_number || "",
                is_locked: false,
                is_hand_raised: false,
                points: 0
            });

            // Auto-create study group for school if it doesn't exist
            if (school && school !== "Other / Not Listed") {
                const { data: existingGroup } = await supabaseAdmin
                    .from("study_groups")
                    .select("id")
                    .eq("school_name", school)
                    .single();

                if (!existingGroup) {
                    await supabaseAdmin.from("study_groups").insert({ school_name: school, group_type: "school" });
                }
            }
        }

        return NextResponse.json({
            success: true,
            userId: authData?.user?.id,
            message: `Account created for ${full_name}`
        });
    } catch (error: any) {
        console.error("Create student error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create student account" },
            { status: 500 }
        );
    }
}
