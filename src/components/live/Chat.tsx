"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Send, Smile, Hand, Lock, Unlock, Hash, Calendar } from "lucide-react";
import styles from "./Chat.module.css";
import { supabase, Message, Profile, Lesson } from "@/lib/supabase";

interface ChatProps {
    userProfile: Profile;
    isAdmin?: boolean;
    isTA?: boolean;
    lessonId?: string;
    isArchive?: boolean;
}

const healthInsights = [
    "Drinking enough water is essential for maintaining healthy skin and improving cognitive function.",
    "Regular handwashing is one of the most effective ways to prevent the spread of infections.",
    "A balanced diet rich in fruits and vegetables can significantly reduce the risk of chronic diseases.",
    "Sleeping at least 7-8 hours a night is crucial for physical and mental well-being.",
    "Physical activity helps strengthen the heart and improves overall circulation.",
    "Deep breathing exercises can help reduce stress and improve mental clarity.",
    "Eating slowly helps with digestion and prevents overeating.",
    "Regular check-ups can help detect health issues early when they are easier to treat.",
    "Stretching daily can improve flexibility and reduce the risk of injury.",
    "Maintaining a healthy posture can prevent back and neck pain.",
    "Laughter has been shown to boost the immune system and reduce stress hormones.",
    "Limiting sugar intake can lower the risk of heart disease and type 2 diabetes.",
    "Proper wound care is vital to prevent infections and promote faster healing.",
    "Staying socially active can help improve mental health and longevity."
];

const getDailyInsight = () => {
    const dateString = new Date().toISOString().split('T')[0];
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return healthInsights[Math.abs(hash) % healthInsights.length];
};

export const Chat = ({ userProfile, isAdmin, isTA, lessonId, isArchive }: ChatProps) => {
    const isStaff = isAdmin || isTA;
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatLocked, setIsChatLocked] = useState(true);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showJumpBtn, setShowJumpBtn] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Use ref to track lesson ID for comparison in polling (avoids stale closure)
    const activeLessonRef = useRef<string | null>(null);

    // Stable fetch function using useCallback
    const fetchLessonContext = useCallback(async () => {
        if (isArchive && lessonId) {
            const { data } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
            if (data) {
                setActiveLesson(data);
                activeLessonRef.current = data.id;
            }
            setIsChatLocked(true);
            return;
        }

        // Query for LIVE lessons first
        const { data: liveLessons } = await supabase
            .from('lessons')
            .select('*')
            .eq('status', 'live')
            .order('started_at', { ascending: false })
            .limit(1);

        let lesson = liveLessons && liveLessons.length > 0 ? liveLessons[0] : null;

        if (!lesson) {
            // Find next upcoming scheduled lesson
            const { data: scheduledLessons } = await supabase
                .from('lessons')
                .select('*')
                .eq('status', 'scheduled')
                .order('scheduled_at', { ascending: true })
                .limit(1);
            lesson = scheduledLessons && scheduledLessons.length > 0 ? scheduledLessons[0] : null;
        }

        if (lesson) {
            const previousId = activeLessonRef.current;
            setActiveLesson(lesson);
            activeLessonRef.current = lesson.id;

            const now = new Date();
            const scheduledAt = new Date(lesson.scheduled_at);
            const isTimeDue = scheduledAt <= now;

            if (lesson.status === 'scheduled' && !isTimeDue) {
                setIsChatLocked(true);
            } else if (lesson.status === 'completed') {
                setIsChatLocked(true);
            } else {
                // Live or past-due scheduled — check global lock
                const { data: settings } = await supabase.from("platform_settings").select("*").eq("key", "chat_lock").single();
                if (settings?.value) setIsChatLocked(settings.value.is_locked);
                else setIsChatLocked(false);
            }
        } else {
            // No active lesson at all — show insight card
            if (activeLessonRef.current !== null) {
                // Lesson was active but now gone — force clear
                console.log('[Chat] Lesson ended — transitioning to idle state');
            }
            setIsChatLocked(true);
            setActiveLesson(null);
            activeLessonRef.current = null;
        }
    }, [isArchive, lessonId]);

    // Computed state
    const isEffectiveLive = !isArchive && (
        activeLesson?.status === 'live' ||
        (activeLesson?.status === 'scheduled' && new Date(activeLesson.scheduled_at) <= new Date())
    );

    const hasActiveSession = !!(activeLesson && (activeLesson.status === 'live' || activeLesson.status === 'scheduled'));

    // 1. Lesson Context: Initial fetch + aggressive polling + realtime subscription
    useEffect(() => {
        // Initial fetch
        fetchLessonContext();

        // AGGRESSIVE POLLING every 3 seconds — this is the PRIMARY mechanism
        // for detecting lesson transitions. Supabase Realtime is a bonus.
        const pollTimer = setInterval(() => {
            fetchLessonContext();
        }, 3000);

        // Supabase Realtime subscription as a BONUS (fires instantly if enabled)
        const lessonChannel = supabase.channel('lesson-status-live').on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'lessons'
        }, () => {
            fetchLessonContext();
        }).subscribe();

        // Settings subscription for chat lock
        const settingsChannel = supabase.channel("platform-settings-live").on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "platform_settings",
            filter: "key=eq.chat_lock"
        }, (payload) => {
            setIsChatLocked(payload.new.value.is_locked);
        }).subscribe();

        return () => {
            clearInterval(pollTimer);
            supabase.removeChannel(lessonChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, [fetchLessonContext]);

    // 2. Fetch and Subscribe to Messages (re-runs when activeLesson changes)
    useEffect(() => {
        if (!activeLesson && !isArchive) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            let query = supabase.from("messages").select("*, profiles(full_name, role)");

            if (isArchive && lessonId) {
                query = query.eq('lesson_id', lessonId);
            } else if (activeLesson) {
                query = query.eq('lesson_id', activeLesson.id);
            } else {
                const isToday = selectedDate === new Date().toISOString().split('T')[0];
                if (isToday) {
                    query = query.order("created_at", { ascending: false }).limit(50);
                } else {
                    const startOfDay = `${selectedDate}T00:00:00.000Z`;
                    const endOfDay = `${selectedDate}T23:59:59.999Z`;
                    query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
                }
            }

            const { data } = await query.order("created_at", { ascending: true });
            if (data) setMessages(data as any);
        };

        fetchMessages();

        const channelKey = isArchive
            ? `lesson-archive-${lessonId}`
            : (activeLesson ? `lesson-live-${activeLesson.id}` : 'chat-global');

        const chatChannel = supabase.channel(channelKey).on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "messages"
        }, async (payload) => {
            const msg = payload.new as Message;

            if (activeLesson && msg.lesson_id !== activeLesson.id) return;
            if (isArchive && msg.lesson_id !== lessonId) return;
            if (!activeLesson && !isArchive && msg.lesson_id) return;

            const { data: profileData } = await supabase.from("profiles").select("full_name, role").eq("id", msg.user_id).single();
            const messageWithProfile = { ...msg, profiles: profileData as any };

            setMessages((prev) => [...prev, messageWithProfile]);

            if (!isArchive) {
                setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [activeLesson?.id, lessonId, isArchive, selectedDate]);

    // 3. Auto-scroll on new messages
    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (scrollContainer && !showJumpBtn) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
    }, [messages.length]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowJumpBtn(!isBottom);
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Block sending if no active session
        if (!hasActiveSession && !isArchive) return;

        // Block sending if chat is locked and user is not staff/unlocked
        if (isChatLocked && !isStaff && !userProfile.is_unlocked) return;

        const { error } = await supabase.from("messages").insert({
            content: newMessage,
            user_id: userProfile.id,
            lesson_id: lessonId || activeLesson?.id
        });

        if (!error) {
            setNewMessage("");
            await supabase.from("profiles").update({ last_read_at: new Date().toISOString() }).eq("id", userProfile.id);
        }
    };

    const toggleRaiseHand = async () => {
        await supabase.from("profiles").update({ is_hand_raised: !userProfile.is_hand_raised }).eq("id", userProfile.id);
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
                <div className={styles.status}>
                    <div className={styles.onlineDot} style={{ background: isEffectiveLive ? 'var(--success)' : 'var(--secondary)' }}></div>
                    <div className={styles.topicInfo}>
                        <span className={styles.statusLabel}>
                            {isArchive ? "Archive" : (
                                isEffectiveLive
                                    ? "Live Class"
                                    : (activeLesson?.status === 'scheduled' ? "Scheduled" : "No active lesson")
                            )}
                        </span>
                        {hasActiveSession ? (
                            <h4 className={styles.topicName}>{activeLesson!.topic}</h4>
                        ) : (
                            <span className={styles.topicName}>Health & Wellness</span>
                        )}
                    </div>
                </div>
                {hasActiveSession && (
                    <div className={styles.headerTools}>
                        <div className={styles.datePicker}>
                            <Calendar size={14} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        {isStaff && (
                            <Button
                                variant={isChatLocked ? "error" : "outline"}
                                size="sm"
                                onClick={async () => {
                                    const newLockState = !isChatLocked;
                                    setIsChatLocked(newLockState);
                                    await supabase.from("platform_settings").update({ value: { is_locked: newLockState } }).eq("key", "chat_lock");
                                }}
                                className={styles.lockBtn}
                            >
                                {isChatLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                <span>{isChatLocked ? "Locked" : "Lock"}</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {(!hasActiveSession && !isArchive) ? (
                <div className={styles.idleState}>
                    <div className={styles.insightCard}>
                        <div className={styles.insightIcon}>💡</div>
                        <h3>Did you know?</h3>
                        <p>{getDailyInsight()}</p>
                        <div className={styles.insightFooter}>
                            Daily Health & Nursing Insights
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.messagesContainer}>
                        <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
                            {messages.map((msg) => (
                                <div key={msg.id} className={`${styles.message} ${msg.user_id === userProfile.id ? styles.own : ""}`}>
                                    <div className={styles.avatar}>
                                        {msg.profiles?.full_name?.substring(0, 1).toUpperCase() || "?"}
                                        {msg.profiles?.role === 'ta' && <span className={styles.taBadge}>TA</span>}
                                        {msg.profiles?.role === 'admin' && <span className={styles.adminBadge}>A</span>}
                                    </div>
                                    <div className={styles.contentWrapper}>
                                        <div className={styles.senderHeader}>
                                            <span className={styles.senderName}>{msg.profiles?.full_name || "Unknown"}</span>
                                        </div>
                                        <div className={styles.msgBubble}>
                                            <div className={styles.msgContent}>{msg.content}</div>
                                            <div className={styles.msgMeta}>
                                                <span className={styles.timestamp}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {showJumpBtn && (
                            <button className={styles.jumpBtn} onClick={scrollToBottom}>
                                <Hash size={16} /> New Messages
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className={styles.inputArea}>
                        {!isStaff && isChatLocked && !userProfile.is_unlocked ? (
                            <div className={styles.lockedArea}>
                                <span>{isEffectiveLive ? "Chat is locked" : "Waiting for class to start..."}</span>
                                {isEffectiveLive && (
                                    <Button
                                        variant={userProfile.is_hand_raised ? "secondary" : "primary"}
                                        size="sm"
                                        onClick={toggleRaiseHand}
                                    >
                                        <Hand size={14} />
                                        {userProfile.is_hand_raised ? "Hand Raised" : "Raise Hand"}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <Input
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className={styles.input}
                                    disabled={selectedDate !== new Date().toISOString().split('T')[0]}
                                />
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    className={styles.sendBtn}
                                    disabled={selectedDate !== new Date().toISOString().split('T')[0]}
                                >
                                    <Send size={18} />
                                </Button>
                            </>
                        )}
                    </form>
                </>
            )}

            {selectedDate !== new Date().toISOString().split('T')[0] && (
                <div className={styles.archiveNotice}>
                    Viewing history for {new Date(selectedDate).toLocaleDateString()}
                </div>
            )}
        </div>
    );
};
