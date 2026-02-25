"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

function getOrGenerateSessionId() {
    if (typeof window === "undefined") return null;
    const STORAGE_KEY = "rgn_device_session_id";
    let sid = localStorage.getItem(STORAGE_KEY);
    if (!sid) {
        sid = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem(STORAGE_KEY, sid);
    }
    return sid;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const sessionIdRef = useRef<string | null>(null);

    // Synchronize sessionIdRef with localStorage once on mount
    useEffect(() => {
        sessionIdRef.current = getOrGenerateSessionId();
    }, []);

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
            const sessionId = getOrGenerateSessionId();
            if (!sessionId) return;

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
                    await registerDeviceSession(currentUser.id);
                } else {
                    setProfile(null);
                    // Clear local session ID on sign out to allow fresh start
                    if (typeof window !== "undefined") {
                        localStorage.removeItem("rgn_device_session_id");
                        sessionIdRef.current = null;
                    }
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

                        // Single device enforcement
                        const currentSessionId = sessionIdRef.current || getOrGenerateSessionId();

                        if (
                            currentSessionId &&
                            updatedProfile.device_session_id &&
                            updatedProfile.device_session_id !== currentSessionId
                        ) {
                            console.warn("[Auth] Another device logged in. Session mismatch:", {
                                local: currentSessionId,
                                remote: updatedProfile.device_session_id
                            });

                            // Prevent accidental logouts if the remote ID is null/empty (shouldn't happen but safe to have)
                            if (updatedProfile.device_session_id.length > 5) {
                                supabase.auth.signOut();
                                alert("You have been logged out because your account was signed in on another device.");
                            }
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
        if (typeof window !== "undefined") {
            localStorage.removeItem("rgn_device_session_id");
        }
        await supabase.auth.signOut();
    };

    return { user, profile, loading, signOut };
}
