"use client";

import { useState, useEffect, useRef } from "react";
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

export const Chat = ({ userProfile, isAdmin, isTA, lessonId, isArchive }: ChatProps) => {
    const isStaff = isAdmin || isTA;
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showJumpBtn, setShowJumpBtn] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Manage Lesson Context and Global Subscriptions
    useEffect(() => {
        const fetchLessonContext = async () => {
            if (isArchive && lessonId) {
                const { data } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
                if (data) setActiveLesson(data);
                setIsChatLocked(true);
                return;
            }

            // Prioritize LIVE lessons (most recent started first)
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
                setActiveLesson(lesson);
                const now = new Date();
                const scheduledAt = new Date(lesson.scheduled_at);
                const isTimeDue = scheduledAt <= now;

                if (lesson.status === 'scheduled' && !isTimeDue) {
                    setIsChatLocked(true);
                } else if (lesson.status === 'completed') {
                    setIsChatLocked(true);
                } else {
                    // Check global chat lock setting
                    const { data: settings } = await supabase.from("platform_settings").select("*").eq("key", "chat_lock").single();
                    if (settings?.value) setIsChatLocked(settings.value.is_locked);
                    else setIsChatLocked(false);
                }
            } else {
                setIsChatLocked(true);
                setActiveLesson(null);
            }
        };

        fetchLessonContext();

        // Polling for auto-start
        const checkTimer = setInterval(() => {
            const now = new Date();
            if (activeLesson?.status === 'scheduled' && new Date(activeLesson.scheduled_at) <= now) {
                setIsChatLocked(false);
                fetchLessonContext();
            }
        }, 10000);

        // Subscriptions
        const lessonChannel = supabase.channel('lesson-status-updates').on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'lessons'
        }, (payload) => {
            const updated = payload.new as Lesson;
            if (!activeLesson || activeLesson.id === updated.id || updated.status === 'live') {
                fetchLessonContext();
            }
        }).subscribe();

        const settingsChannel = supabase.channel("platform-settings").on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "platform_settings",
            filter: "key=eq.chat_lock"
        }, (payload) => {
            setIsChatLocked(payload.new.value.is_locked);
        }).subscribe();

        return () => {
            clearInterval(checkTimer);
            supabase.removeChannel(lessonChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, [isArchive, lessonId]);

    // 2. Fetch and Subscribe to Messages
    useEffect(() => {
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

        const channelKey = isArchive ? `lesson-archive-${lessonId}` : (activeLesson ? `lesson-live-${activeLesson.id}` : 'chat-global');
        const chatChannel = supabase.channel(channelKey).on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "messages"
        }, async (payload) => {
            const newMessage = payload.new as Message;

            // Filtering for specific lesson if active
            if (activeLesson && newMessage.lesson_id !== activeLesson.id) return;
            if (isArchive && newMessage.lesson_id !== lessonId) return;
            if (!activeLesson && !isArchive && newMessage.lesson_id) return; // Don't show lesson messages in global fallback

            const { data: profileData } = await supabase.from("profiles").select("full_name, role").eq("id", newMessage.user_id).single();
            const messageWithProfile = { ...newMessage, profiles: profileData as any };

            setMessages((prev) => [...prev, messageWithProfile]);

            if (!isArchive) {
                setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [activeLesson?.id, lessonId, isArchive, selectedDate]);

    // 3. UI Helpers
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
        if (!newMessage.trim() || (isChatLocked && !isStaff && !userProfile.is_unlocked)) return;
        if (!activeLesson && !isArchive) return;

        const { error } = await supabase.from("messages").insert({
            content: newMessage,
            user_id: userProfile.id,
            lesson_id: lessonId || activeLesson?.id
        });

        if (!error) {
            setNewMessage("");
            // Update last read
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
                    <div className={styles.onlineDot} style={{ background: activeLesson?.status === 'live' ? 'var(--success)' : 'var(--secondary)' }}></div>
                    <div className={styles.topicInfo}>
                        <span className={styles.statusLabel}>
                            {isArchive ? "Archive" : (activeLesson?.status === 'live' ? "Live Class" : (activeLesson?.status === 'scheduled' ? "Scheduled" : "No active lesson"))}
                        </span>
                        <h4 className={styles.topicName}>
                            {activeLesson?.topic || "Discussion Board"}
                        </h4>
                    </div>
                </div>
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
            </div>

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
                        <span>Chat is locked for this lesson</span>
                        <Button
                            variant={userProfile.is_hand_raised ? "secondary" : "primary"}
                            size="sm"
                            onClick={toggleRaiseHand}
                        >
                            <Hand size={14} />
                            {userProfile.is_hand_raised ? "Hand Raised" : "Raise Hand"}
                        </Button>
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
            {selectedDate !== new Date().toISOString().split('T')[0] && (
                <div className={styles.archiveNotice}>
                    Viewing history for {new Date(selectedDate).toLocaleDateString()}
                </div>
            )}
        </div>
    );
};
