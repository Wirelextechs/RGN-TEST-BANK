import { supabase } from "./supabase";

export type ActivityScore = {
    user_id: string;
    full_name: string;
    score: number;
};

export async function calculateMostActiveUsers(classId: string): Promise<ActivityScore[]> {
    // In a real app, you'd aggregate message counts, reaction counts, and poll participation
    // from the database for a specific class/session.

    const { data: messages } = await supabase
        .from("messages")
        .select("user_id, profiles(full_name)")
        .eq("class_id", classId);

    if (!messages) return [];

    const activityMap: Record<string, { name: string; count: number }> = {};

    messages.forEach((msg: any) => {
        const userId = msg.user_id;
        const name = msg.profiles?.full_name || "Unknown User";

        if (!activityMap[userId]) {
            activityMap[userId] = { name, count: 0 };
        }
        activityMap[userId].count += 1;
    });

    // Sort and return top users
    return Object.entries(activityMap)
        .map(([user_id, data]) => ({
            user_id,
            full_name: data.name,
            score: data.count,
        }))
        .sort((a, b) => b.score - a.score);
}

export async function sendNotification(userId: string, type: 'sms' | 'app', message: string) {
    console.log(`Sending ${type} notification to user ${userId}: ${message}`);
    // Integration with Twilio for SMS and FCM for In-App would go here.
}
