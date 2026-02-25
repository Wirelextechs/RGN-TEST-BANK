"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

function generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const sessionIdRef = useRef<string | null>(null);

    useEffect(() => {
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

        const registerDeviceSession = async (userId: string) => {
            // Generate a unique session ID for this device/tab
            const sessionId = generateSessionId();
            sessionIdRef.current = sessionId;

            // Write it to the profile
            await supabase
                .from("profiles")
                .update({ device_session_id: sessionId })
                .eq("id", userId);
        };

        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchProfile(currentUser);
                    await registerDeviceSession(currentUser.id);
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
                    // Also register device session on auth change (e.g. login)
                    await registerDeviceSession(currentUser.id);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error("Auth state change error:", err);
            } finally {
                setLoading(false);
            }
        });

        // Real-time profile subscription (includes device session check)
        let profileSubscription: any = null;

        const startProfileSubscription = (userId: string) => {
            profileSubscription = supabase
                .channel(`profile-updates-${userId}`)
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                    (payload) => {
                        const updatedProfile = payload.new as Profile;
                        setProfile(updatedProfile);

                        // Single device enforcement: if device_session_id changed and it's not ours, sign out
                        if (
                            sessionIdRef.current &&
                            updatedProfile.device_session_id &&
                            updatedProfile.device_session_id !== sessionIdRef.current
                        ) {
                            console.warn("[Auth] Another device logged in. Signing out...");
                            supabase.auth.signOut();
                            alert("You have been logged out because your account was signed in on another device.");
                        }
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
