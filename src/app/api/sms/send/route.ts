import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBulkSMS } from '@/lib/sms';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { message, lessonTitle } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Get all students with phone numbers
        const { data: students, error } = await supabaseAdmin
            .from('profiles')
            .select('phone_number')
            .not('phone_number', 'is', null)
            .neq('phone_number', '');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const phoneNumbers = students
            ?.map(s => s.phone_number)
            .filter(Boolean) as string[];

        if (phoneNumbers.length === 0) {
            return NextResponse.json({ error: 'No students with phone numbers found' }, { status: 404 });
        }

        const smsMessage = lessonTitle
            ? `RGN Test Bank: "${lessonTitle}" — ${message}`
            : `RGN Test Bank: ${message}`;

        const result = await sendBulkSMS(phoneNumbers, smsMessage);

        return NextResponse.json({
            ...result,
            recipientCount: phoneNumbers.length
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
