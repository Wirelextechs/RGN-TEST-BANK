import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
    id: string;
    role: 'admin' | 'ta' | 'student';
    full_name: string;
    school?: string;
    course?: string;
    email?: string;
    avatar_url?: string;
    is_locked: boolean;
    is_hand_raised: boolean;
    is_unlocked: boolean;
    points: number;
    last_read_at?: string;
    phone_number?: string;
    is_premium?: boolean;
    device_session_id?: string;
    premium_expires_at?: string;
};

export type Message = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    reactions: Record<string, string[]>;
    profiles?: { full_name: string; role: string };
    lesson_id?: string;
    reply_to?: string;
    reply_message?: {
        id: string;
        content: string;
        profiles?: { full_name: string };
    };
    message_type?: 'text' | 'image' | 'voice' | 'poll';
    media_url?: string;
};

export type Lesson = {
    id: string;
    topic: string;
    scheduled_at: string;
    started_at?: string;
    ended_at?: string;
    status: 'scheduled' | 'live' | 'completed';
    created_at: string;
    created_by: string;
};

export type DirectMessage = {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type: 'text' | 'image' | 'voice';
    media_url?: string;
    is_read: boolean;
    is_edited?: boolean;
    reply_to?: string;
    reply_message?: {
        id: string;
        content: string;
        sender_profile?: { full_name: string };
    };
    created_at: string;
    sender_profile?: { full_name: string; role: string };
    receiver_profile?: { full_name: string; role: string };
};

export type StudyGroup = {
    id: string;
    school_name?: string;
    course_name?: string;
    group_type: 'school' | 'course';
    created_at: string;
};

export type StudyGroupMessage = {
    id: string;
    group_id: string;
    user_id: string;
    content: string;
    message_type: 'text' | 'image' | 'voice';
    media_url?: string;
    reply_to?: string;
    reply_message?: {
        id: string;
        content: string;
        profiles?: { full_name: string };
    };
    created_at: string;
    updated_at?: string;
    profiles?: { full_name: string; role: string };
};

export type Poll = {
    id: string;
    question: string;
    options: string[];
    created_by: string;
    lesson_id?: string;
    group_id?: string;
    chat_type: 'main' | 'study_group';
    is_closed: boolean;
    created_at: string;
    creator_profile?: { full_name: string };
    votes?: PollVote[];
};

export type PollVote = {
    id: string;
    poll_id: string;
    user_id: string;
    option_index: number;
    created_at: string;
};

export type Payment = {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    reference: string;
    paystack_reference?: string;
    status: 'pending' | 'success' | 'failed';
    created_at: string;
    verified_at?: string;
    profiles?: { full_name: string; school: string };
};

export type PlatformSettings = {
    paywall_enabled: boolean;
    premium_price: number;
    sms_enabled: boolean;
};
