import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await req.json();
        const { key, value } = body;

        // Using upsert ensures it overrides or creates the key cleanly
        const { error } = await supabaseAdmin
            .from("platform_settings")
            .upsert({ key, value: String(value) });

        if (error) throw error;

        return NextResponse.json({ success: true, key, value });
    } catch (error: any) {
        console.error("Settings update error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update platform settings" },
            { status: 500 }
        );
    }
}
