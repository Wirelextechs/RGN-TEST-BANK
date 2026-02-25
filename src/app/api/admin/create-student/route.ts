import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
    try {
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
