import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
    id: string;
    role: 'admin' | 'ta' | 'student';
    full_name: string;
    school?: string;
    avatar_url?: string;
    is_locked: boolean;
    is_hand_raised: boolean;
    is_unlocked: boolean;
    points: number;
    last_read_at?: string;
};

export type Message = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    reactions: Record<string, string[]>; // { emoji: [user_id1, user_id2] }
    profiles?: { full_name: string; role: string };
    lesson_id?: string;
    reply_to?: string;
    reply_message?: {
        id: string;
        content: string;
        profiles?: { full_name: string };
    };
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
