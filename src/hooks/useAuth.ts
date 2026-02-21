"use client";

import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        /**
         * Logic to fetch profile from DB or synthesize a fallback from metadata.
         * This handles the "Verifying Session..." hang by ensuring we always
         * have a profile object even if the database sync is slightly delayed.
         */
        const fetchProfile = async (currentUser: User) => {
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single();

            if (data) {
                setProfile(data);
            } else {
                // Synthesize from metadata
                setProfile({
                    id: currentUser.id,
                    full_name: currentUser.user_metadata?.full_name || "User",
                    role: currentUser.user_metadata?.role || "student",
                    school: currentUser.user_metadata?.school || "",
                    is_locked: false,
                    is_hand_raised: false,
                    points: 0
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

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                await fetchProfile(currentUser);
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
