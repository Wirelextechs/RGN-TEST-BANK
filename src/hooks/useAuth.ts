"use client";

import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active sessions and sets the user
        const fetchProfile = async (currentUser: User) => {
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single();

            if (data) {
                setProfile(data);
            } else {
                setProfile({
                    id: currentUser.id,
                    full_name: currentUser.user_metadata?.full_name || "User",
                    role: currentUser.user_metadata?.role || "student",
                    school: currentUser.user_metadata?.school || "",
                    is_locked: false,
                    is_hand_raised: false
                } as Profile);
            }
        };

        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                await fetchProfile(currentUser);
            }

            setLoading(false);
        };

        getSession();

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", currentUser.id)
                    .single();

                if (data) {
                    setProfile(data);
                } else {
                    // Fallback: Create a temporary profile from user metadata if DB record isn't ready
                    setProfile({
                        id: currentUser.id,
                        full_name: currentUser.user_metadata?.full_name || "User",
                        role: currentUser.user_metadata?.role || "student",
                        school: currentUser.user_metadata?.school || "",
                        is_locked: false,
                        is_hand_raised: false
                    } as Profile);
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return { user, profile, loading, signOut };
}
