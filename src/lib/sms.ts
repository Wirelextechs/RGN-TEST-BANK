/**
 * Arkesel SMS Integration
 * Docs: https://developers.arkesel.com
 */

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY || '';
const SENDER_ID = process.env.SMS_SENDER_ID || 'RGN-BANK';

interface SendSMSResult {
    success: boolean;
    message: string;
}

/**
 * Send an SMS via Arkesel API v1
 * @param to - Recipient phone number(s), comma-separated for multiple
 * @param message - SMS content
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
    if (!ARKESEL_API_KEY) {
        console.error('ARKESEL_API_KEY is not set');
        return { success: false, message: 'SMS not configured — add ARKESEL_API_KEY to .env' };
    }

    try {
        // Normalize Ghana numbers: 0XX → 233XX
        const normalizedTo = to.split(',').map(num => {
            num = num.trim().replace(/\s+/g, '');
            if (num.startsWith('0')) {
                return '233' + num.substring(1);
            }
            return num;
        }).join(',');

        // Use Arkesel v1 GET API
        const url = new URL('https://sms.arkesel.com/sms/api');
        url.searchParams.set('action', 'send-sms');
        url.searchParams.set('api_key', ARKESEL_API_KEY);
        url.searchParams.set('to', normalizedTo);
        url.searchParams.set('from', SENDER_ID);
        url.searchParams.set('sms', message);

        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.code === 'ok' || data.code === '100') {
            return { success: true, message: 'SMS sent successfully' };
        } else {
            console.error('Arkesel SMS error:', data);
            return { success: false, message: data.message || 'SMS send failed' };
        }
    } catch (error: any) {
        console.error('SMS send error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send SMS to multiple recipients (bulk)
 */
export async function sendBulkSMS(recipients: string[], message: string): Promise<SendSMSResult> {
    return sendSMS(recipients.join(','), message);
}

/**
 * Send class notification SMS to all students with phone numbers
 */
export async function sendClassNotification(
    phoneNumbers: string[],
    className: string,
    time: string
): Promise<SendSMSResult> {
    const message = `RGN Test Bank: "${className}" is starting at ${time}. Join now at your dashboard!`;
    return sendBulkSMS(phoneNumbers, message);
}
