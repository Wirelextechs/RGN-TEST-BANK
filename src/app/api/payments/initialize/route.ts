import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, amount, currency = "GHS", callback_url } = body;

        if (!email || !amount) {
            return NextResponse.json({ error: "Email and amount required" }, { status: 400 });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
        }

        const response = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${paystackSecretKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                amount: Math.round(amount * 100), // Paystack expects pesewas
                currency,
                callback_url: callback_url || `${process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || ''}/dashboard?payment=verify`
            })
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || "Failed to initialize payment");
        }

        return NextResponse.json({
            authorization_url: data.data.authorization_url,
            access_code: data.data.access_code,
            reference: data.data.reference
        });
    } catch (error: any) {
        console.error("Payment init error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
