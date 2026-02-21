import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
    id: string;
    role: 'admin' | 'student';
    full_name: string;
    school?: string;
    avatar_url?: string;
    is_locked: boolean;
    is_hand_raised: boolean;
    points: number;
};

export type Message = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    reactions: Record<string, string[]>; // { emoji: [user_id1, user_id2] }
};
