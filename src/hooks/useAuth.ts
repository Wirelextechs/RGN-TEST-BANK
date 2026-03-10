"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

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
    const [onlineCount, setOnlineCount] = useState(0);
    const sessionIdRef = useRef<string | null>(null);

    // Synchronize sessionIdRef with localStorage once on mount
    useEffect(() => {
        sessionIdRef.current = getOrGenerateSessionId();
    }, []);

    const fetchProfile = async (currentUser: User) => {
        try {
            const { data } = await supabase
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
        await supabase
            .from("profiles")
            .update({ device_session_id: sessionId })
            .eq("id", userId);
    };

    const handleSession = async (session: Session | null) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
            // Fetch profile and register device concurrently to speed up login
            await Promise.all([
                fetchProfile(currentUser),
                registerDeviceSession(currentUser.id)
            ]);
        } else {
            setProfile(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("rgn_device_session_id");
                sessionIdRef.current = null;
            }
        }
        setLoading(false);
    };

    // Primary Auth Observer (Runs ONCE on mount)
    useEffect(() => {
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await handleSession(session);
            } catch (err) {
                console.error("Session fetch error:", err);
                setLoading(false);
            }
        };

        getSession();

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                await handleSession(session);
            }
        );

        return () => {
            authSubscription.unsubscribe();
        };
    }, []); // <-- Empty dependency array prevents double-fetching loop

    // Subscriptions: Only run when `user.id` is available and changes
    useEffect(() => {
        let profileSubscription: any = null;
        let presenceChannel: any = null;

        if (!user) return;

        const userId = user.id;

        // Start Profile Subscription for single device enforcement
        profileSubscription = supabase
            .channel(`profile-updates-${userId}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                (payload) => {
                    const updatedProfile = payload.new as Profile;
                    setProfile(updatedProfile);

                    const currentSessionId = sessionIdRef.current || getOrGenerateSessionId();
                    if (
                        currentSessionId &&
                        updatedProfile.device_session_id &&
                        updatedProfile.device_session_id !== currentSessionId
                    ) {
                        console.warn("[Auth] Another device logged in. Session mismatch.");
                        if (updatedProfile.device_session_id.length > 5) {
                            supabase.auth.signOut();
                            alert("You have been logged out because your account was signed in on another device.");
                        }
                    }
                }
            )
            .subscribe();

        // Start Presence Tracking
        presenceChannel = supabase.channel('online-users', {
            config: { presence: { key: userId } },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                setOnlineCount(Object.keys(state).length);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        user_id: userId,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            if (profileSubscription) supabase.removeChannel(profileSubscription);
            if (presenceChannel) supabase.removeChannel(presenceChannel);
        };
    }, [user?.id]); // Only re-subscribe if the user ID changes

    const signOut = async () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("rgn_device_session_id");
            sessionIdRef.current = null;
        }
        await supabase.auth.signOut();
    };

    return { user, profile, loading, onlineCount, signOut };
}
