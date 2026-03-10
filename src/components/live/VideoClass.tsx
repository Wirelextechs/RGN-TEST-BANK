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

    // Track if admin explicitly ended the video (for this session)
    const [videoEndedLocally, setVideoEndedLocally] = useState<Record<string, boolean>>({});

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

                    // Check if this lesson's video was already ended in this browser
                    const endedMap = JSON.parse(localStorage.getItem('rgn_ended_videos') || '{}');
                    if (endedMap[data.id]) {
                        setVideoEndedLocally(prev => ({...prev, [data.id]: true}));
                    }

                    // Check if admin previously opened a broadcast in another tab
                    if (localStorage.getItem(`rgn_jitsi_active_${data.id}`) === 'true') {
                        setIsWindowOpen(true);
                    }
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
                    // If the current lesson was marked strictly completed (by LessonManager)
                    if (currentLesson && updatedLesson.id === currentLesson.id) {
                        fetchLesson();
                        // Also auto-close window if they are a student
                        if (profile?.role === 'student' && popupWindow) {
                            try { popupWindow.close(); } catch (e) {}
                            setIsWindowOpen(false);
                            localStorage.removeItem(`rgn_jitsi_active_${currentLesson.id}`);
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

        // Subscribe to custom broadcast messages for handling "Video Ended" without breaking the database chat status
        const broadcastChannel = supabase.channel('video-controls')
            .on('broadcast', { event: 'end-video' }, (payload) => {
                if (currentLesson && payload.payload.lessonId === currentLesson.id) {
                    setVideoEndedLocally(prev => ({...prev, [currentLesson.id]: true}));

                    // Save to local storage so a refresh doesn't reopen it
                    const endedMap = JSON.parse(localStorage.getItem('rgn_ended_videos') || '{}');
                    endedMap[currentLesson.id] = true;
                    localStorage.setItem('rgn_ended_videos', JSON.stringify(endedMap));

                    // If we have an open window (e.g. we are a student viewing it), close it automatically
                    if (popupWindow) {
                        try { popupWindow.close(); } catch (e) {}
                    }
                    setIsWindowOpen(false);
                    localStorage.removeItem(`rgn_jitsi_active_${currentLesson.id}`);
                }
            })
            .on('broadcast', { event: 'revive-video' }, (payload) => {
                if (currentLesson && payload.payload.lessonId === currentLesson.id) {
                    setVideoEndedLocally(prev => ({...prev, [currentLesson.id]: false}));
                    const endedMap = JSON.parse(localStorage.getItem('rgn_ended_videos') || '{}');
                    delete endedMap[currentLesson.id];
                    localStorage.setItem('rgn_ended_videos', JSON.stringify(endedMap));
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
            supabase.removeChannel(broadcastChannel);
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
                    if (currentLesson) {
                       localStorage.removeItem(`rgn_jitsi_active_${currentLesson.id}`);
                    }
                    clearInterval(interval);
                }
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [popupWindow, currentLesson]);

    if (!profile || !user) return null;

    const isStaff = profile.role === 'admin' || profile.role === 'ta';
    const roomName = "RGN_Live_Classroom_Official_Stream";

    const hasVideoEndedForCurrentLesson = currentLesson && videoEndedLocally[currentLesson.id];

    const startBroadcast = async () => {
        if (!isStaff) return;

        // If there's a scheduled lesson, mark it as live
        if (currentLesson && currentLesson.status === 'scheduled') {
            await supabase
                .from('lessons')
                .update({ status: 'live', started_at: new Date().toISOString() })
                .eq('id', currentLesson.id);
        }

        // Reset local ended state if admin decides to restart
        if (currentLesson) {
            setVideoEndedLocally(prev => ({...prev, [currentLesson.id]: false}));
            const endedMap = JSON.parse(localStorage.getItem('rgn_ended_videos') || '{}');
            delete endedMap[currentLesson.id];
            localStorage.setItem('rgn_ended_videos', JSON.stringify(endedMap));

            // Broadcast that video revived
            supabase.channel('video-controls').send({
                type: 'broadcast',
                event: 'revive-video',
                payload: { lessonId: currentLesson.id }
            });
        }

        openJitsiPopup();
    };

    const endBroadcast = async () => {
        if (!isStaff || !currentLesson) return;

        const confirmEnd = window.confirm("End the VIDEO broadcast? (The Lesson Live Chat will remain active)");
        if (!confirmEnd) return;

        // Broadcast to all clients to shut down video UI
        await supabase.channel('video-controls').send({
            type: 'broadcast',
            event: 'end-video',
            payload: { lessonId: currentLesson.id }
        });

        // Handle locally for admin
        setVideoEndedLocally(prev => ({...prev, [currentLesson.id]: true}));
        const endedMap = JSON.parse(localStorage.getItem('rgn_ended_videos') || '{}');
        endedMap[currentLesson.id] = true;
        localStorage.setItem('rgn_ended_videos', JSON.stringify(endedMap));

        if (popupWindow) {
            try { popupWindow.close(); } catch (e) {}
        }
        setIsWindowOpen(false);
        localStorage.removeItem(`rgn_jitsi_active_${currentLesson.id}`);
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
            if (currentLesson) {
                localStorage.setItem(`rgn_jitsi_active_${currentLesson.id}`, 'true');
            }
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
                            {hasVideoEndedForCurrentLesson ? (
                                <>
                                    <div style={{ padding: '1.5rem', background: 'var(--card-hover)', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
                                        <CheckCircle size={32} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Video Broadcast Ended</h3>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                            The video portion is finished, but chat remains active.
                                        </p>
                                    </div>
                                    <Button onClick={startBroadcast} variant="outline" size="sm" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem auto 0' }}>
                                        Restart Broadcast (Popup)
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p>Start the stream for students. A secure broadcasting window will open.</p>

                                    {currentLesson?.status === 'scheduled' && (
                                        <p style={{ fontSize: '0.9em', color: 'var(--amber-500)', marginTop: '0.5rem' }}>
                                            Starting broadcast will change lesson status to Live.
                                        </p>
                                    )}
                                    {currentLesson?.status === 'live' && (
                                        <p style={{ fontSize: '0.9em', color: 'var(--primary)', marginTop: '0.5rem' }}>
                                            ● A lesson is currently marked as LIVE.
                                        </p>
                                    )}

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <Button onClick={startBroadcast} variant="primary" size="lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {currentLesson?.status === 'live' ? 'Resume Broadcast' : 'Start Broadcast'} (Popup) <ExternalLink size={18} />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {!currentLesson || currentLesson.status === 'scheduled' || hasVideoEndedForCurrentLesson ? (
                                <>
                                    <div style={{ padding: '1.5rem', background: 'var(--card-hover)', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
                                        {hasVideoEndedForCurrentLesson ? (
                                            <CheckCircle size={32} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
                                        ) : (
                                            <Clock size={32} color="var(--secondary)" style={{ margin: '0 auto 0.5rem' }} />
                                        )}

                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>
                                            {hasVideoEndedForCurrentLesson ? "Video Broadcast Ended" : "Video not live yet"}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                            {hasVideoEndedForCurrentLesson
                                                ? `The video portion of the lesson has been ended by the instructor.`
                                                : currentLesson
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
                            try { popupWindow.close(); } catch (e) {}
                        }
                        setIsWindowOpen(false);
                        if (currentLesson) {
                            localStorage.removeItem(`rgn_jitsi_active_${currentLesson.id}`);
                        }
                    }} variant="ghost" size="lg">
                        Close Connection
                    </Button>
                    {isStaff && (
                        <Button onClick={endBroadcast} variant="error" size="lg">
                            End Video Broadcast
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
