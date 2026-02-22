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
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", currentUser.id)
                    .single();

                if (data) {
                    setProfile(data);
                } else {
                    throw new Error("Profile not found");
                }
            } catch (err) {
                console.warn("Profile fetch failed, using fallback:", err);
                // Synthesize from metadata if record missing/delayed
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
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchProfile(currentUser);
                }
            } catch (err) {
                console.error("Session fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchProfile(currentUser);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error("Auth state change error:", err);
            } finally {
                setLoading(false);
            }
        });

        // Real-time profile subscription
        let profileSubscription: any = null;

        const startProfileSubscription = (userId: string) => {
            profileSubscription = supabase
                .channel(`profile-updates-${userId}`)
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                    (payload) => {
                        setProfile(payload.new as Profile);
                    }
                )
                .subscribe();
        };

        if (user) startProfileSubscription(user.id);

        return () => {
            authSubscription.unsubscribe();
            if (profileSubscription) supabase.removeChannel(profileSubscription);
        };
    }, [user?.id]);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return { user, profile, loading, signOut };
}
