"use client";

import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import styles from "./VideoClass.module.css";
import { Video, Shield, ExternalLink, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { supabase, Lesson } from "@/lib/supabase";

export const VideoClass = () => {
    const { profile, user } = useAuth();
    const [popupWindow, setPopupWindow] = useState<Window | null>(null);
    const [isWindowOpen, setIsWindowOpen] = useState(false);

    // New state for lesson tracking
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [isLoadingLesson, setIsLoadingLesson] = useState(true);

    // Fetch the current active or upcoming lesson
    useEffect(() => {
        const fetchLesson = async () => {
            try {
                // Find a lesson that is live or scheduled today
                const { data } = await supabase
                    .from('lessons')
                    .select('*')
                    .in('status', ['live', 'scheduled'])
                    .order('scheduled_at', { ascending: true })
                    .limit(1)
                    .single();

                if (data) {
                    setCurrentLesson(data as Lesson);
                } else {
                    setCurrentLesson(null);
                }
            } catch (err) {
                console.error("Error fetching lesson:", err);
            } finally {
                setIsLoadingLesson(false);
            }
        };

        fetchLesson();

        // Subscribe to changes in the lessons table
        const subscription = supabase
            .channel('public:lessons')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'lessons'
            }, (payload) => {
                const updatedLesson = payload.new as Lesson;
                if (updatedLesson.status === 'completed') {
                    // If the current lesson was marked completed, fetch the next one
                    if (currentLesson && updatedLesson.id === currentLesson.id) {
                        fetchLesson();
                        // Also auto-close window if they are a student
                        if (profile?.role === 'student' && popupWindow) {
                            try { popupWindow.close(); } catch (e) { }
                            setIsWindowOpen(false);
                        }
                    }
                } else if (
                    (currentLesson && updatedLesson.id === currentLesson.id) ||
                    (updatedLesson.status === 'live' || updatedLesson.status === 'scheduled')
                ) {
                    setCurrentLesson(updatedLesson);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentLesson?.id, profile?.role, popupWindow]);

    // Track if the popup window is closed by the user manually
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (popupWindow) {
            interval = setInterval(() => {
                if (popupWindow.closed) {
                    setIsWindowOpen(false);
                    setPopupWindow(null);
                    clearInterval(interval);
                }
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [popupWindow]);

    if (!profile || !user) return null;

    const isStaff = profile.role === 'admin' || profile.role === 'ta';
    const roomName = "RGN_Live_Classroom_Official_Stream";

    const startBroadcast = async () => {
        if (!isStaff) return;

        // If there's a scheduled lesson, mark it as live
        if (currentLesson && currentLesson.status === 'scheduled') {
            await supabase
                .from('lessons')
                .update({ status: 'live', started_at: new Date().toISOString() })
                .eq('id', currentLesson.id);
        }

        openJitsiPopup();
    };

    const endBroadcast = async () => {
        if (!isStaff) return;

        const confirmEnd = window.confirm("Are you sure you want to completely end this broadcast? Students will no longer be able to join.");
        if (!confirmEnd) return;

        if (currentLesson && (currentLesson.status === 'live' || currentLesson.status === 'scheduled')) {
            await supabase
                .from('lessons')
                .update({ status: 'completed', ended_at: new Date().toISOString() })
                .eq('id', currentLesson.id);
        }

        if (popupWindow) {
            try { popupWindow.close(); } catch (e) { }
        }
        setIsWindowOpen(false);
    };

    const openJitsiPopup = () => {
        const domain = "meet.jit.si";
        const displayName = profile.full_name;

        // Pass configuration via URL hash for Jitsi Meet free tier
        let hashString = `#userInfo.displayName="${encodeURIComponent(displayName)}"`;

        if (!isStaff) {
            // Students start muted
            hashString += `&config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.prejoinPageEnabled=false`;
        } else {
            hashString += `&config.startWithAudioMuted=false&config.startWithVideoMuted=false`;
        }

        const url = `https://${domain}/${roomName}${hashString}`;

        // Open as a floating popup window instead of an iframe or a raw new tab.
        // This acts as a completely separate top-level window (bypassing the 5-minute limit),
        // but it is sized and positioned to float directly on the screen!
        const width = 1000;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const newWindow = window.open(
            url,
            "JitsiClassroom",
            `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=no,resizable=yes,status=no`
        );

        if (newWindow) {
            setPopupWindow(newWindow);
            setIsWindowOpen(true);
        } else {
            alert("Your browser blocked the popup. Please allow popups for this site to open the live class.");
        }
    };

    if (!isWindowOpen) {
        return (
            <div className={styles.joinContainer}>
                <div className={styles.joinCard}>
                    {isStaff ? <Shield size={48} color="var(--primary)" /> : <Video size={48} color="var(--primary)" />}
                    <h2>Live Classroom</h2>

                    {isLoadingLesson ? (
                        <p>Loading class schedule...</p>
                    ) : isStaff ? (
                        <>
                            <p>Start the stream for students. A secure broadcasting window will open.</p>

                            {currentLesson?.status === 'scheduled' && (
                                <p style={{ fontSize: '0.9em', color: 'var(--amber-500)', marginTop: '0.5rem' }}>
                                    Starting broadcast will change lesson status to Live.
                                </p>
                            )}
                            {currentLesson?.status === 'live' && (
                                <p style={{ fontSize: '0.9em', color: 'var(--primary)', marginTop: '0.5rem' }}>
                                    ● A broadcast is currently marked as LIVE.
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button onClick={startBroadcast} variant="primary" size="lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {currentLesson?.status === 'live' ? 'Rejoin Broadcast' : 'Start Broadcast'} (Popup) <ExternalLink size={18} />
                                </Button>
                                {currentLesson?.status === 'live' && (
                                    <Button onClick={endBroadcast} variant="error" size="lg">
                                        End Class
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {!currentLesson || currentLesson.status === 'scheduled' ? (
                                <>
                                    <div style={{ padding: '1.5rem', background: 'var(--card-hover)', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
                                        <Clock size={32} color="var(--secondary)" style={{ margin: '0 auto 0.5rem' }} />
                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Class is not live yet</h3>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                            {currentLesson
                                                ? `The stream will begin when an instructor starts the broadcast.`
                                                : `There are no scheduled live classes at this time.`}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p>Join the interactive live class. A floating viewer window will open so you can watch while chatting.</p>
                                    <div style={{ padding: '0.75rem', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--secondary)', marginTop: '1rem', textAlign: 'left' }}>
                                        <strong>📱 On Mobile:</strong> The video will open in a New Tab. You can safely switch between Tabs to watch the video and use the Chat at the same time! When the class is over, just close the video tab.
                                    </div>
                                    <Button onClick={openJitsiPopup} variant="primary" size="lg" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem auto 0' }}>
                                        Join Class Window <ExternalLink size={18} />
                                    </Button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.joinContainer}>
            <div className={styles.joinCard}>
                <Video size={48} color="var(--primary)" />
                <h2>Classroom Active</h2>
                <p>The classroom is currently open in a separate window or tab.</p>
                <div style={{ padding: '0.75rem', background: 'var(--card-hover)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                    <strong>Tip:</strong> You can resize the window and drag it alongside your chat, or switch tabs if you are on a mobile device.
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button onClick={() => {
                        if (popupWindow && !popupWindow.closed) {
                            popupWindow.focus();
                        } else {
                            openJitsiPopup();
                        }
                    }} variant="primary" size="lg">
                        Bring to Front
                    </Button>
                    <Button onClick={() => {
                        if (popupWindow) {
                            try { popupWindow.close(); } catch (e) { }
                        }
                        setIsWindowOpen(false);
                    }} variant="ghost" size="lg">
                        Close Connection
                    </Button>
                    {isStaff && (
                        <Button onClick={endBroadcast} variant="error" size="lg">
                            End Class For Everyone
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
