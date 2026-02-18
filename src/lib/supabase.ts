import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
    id: string;
    role: 'admin' | 'student';
    full_name: string;
    avatar_url?: string;
    is_locked: boolean;
    is_hand_raised: boolean;
};

export type Message = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    reactions: Record<string, string[]>; // { emoji: [user_id1, user_id2] }
};
