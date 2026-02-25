import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await req.json();
        const { reference, user_id } = body;

        if (!reference || !user_id) {
            return NextResponse.json({ error: "Reference and user_id required" }, { status: 400 });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
        }

        // Verify with Paystack
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { "Authorization": `Bearer ${paystackSecretKey}` }
        });

        const data = await response.json();

        if (!data.status || data.data.status !== "success") {
            // Record failed payment
            await supabaseAdmin.from("payments").upsert({
                user_id,
                reference,
                paystack_reference: data.data?.reference,
                amount: (data.data?.amount || 0) / 100,
                status: "failed"
            }, { onConflict: "reference" });

            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
        }

        // Payment successful - upgrade user
        const amountGHS = data.data.amount / 100;

        // Record payment
        await supabaseAdmin.from("payments").upsert({
            user_id,
            reference,
            paystack_reference: data.data.reference,
            amount: amountGHS,
            currency: data.data.currency,
            status: "success",
            verified_at: new Date().toISOString()
        }, { onConflict: "reference" });

        // Mark user as premium
        await supabaseAdmin.from("profiles").update({
            is_premium: true,
            premium_expires_at: null // No expiry for now, admin controls this
        }).eq("id", user_id);

        return NextResponse.json({
            success: true,
            amount: amountGHS,
            message: "Payment verified! Your account has been upgraded to premium."
        });
    } catch (error: any) {
        console.error("Payment verify error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
