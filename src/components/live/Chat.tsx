"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AdminInbox, useUnreadDMCount } from "@/components/live/AdminInbox";
import { Poll } from "@/components/live/Poll";
import { DirectChat } from "@/components/live/DirectChat";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { Send, ArrowLeft, Image as ImageIcon, Mic, Hash, Lock, Unlock, Reply, X, Camera, Hand, Calendar, Smile, MicOff, BarChart2, Plus } from "lucide-react";
import styles from "./Chat.module.css";
import { supabase, Message, Profile, Lesson } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
    const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, formatTime, setAudioBlob } = useVoiceRecorder();
    const isStaff = isAdmin || isTA;
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatLocked, setIsChatLocked] = useState(true);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showJumpBtn, setShowJumpBtn] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    // Handle voice note upload
    useEffect(() => {
        if (audioBlob) {
            handleVoiceUpload(audioBlob);
            setAudioBlob(null);
        }
    }, [audioBlob]);

    const handleVoiceUpload = async (blob: Blob) => {
        const path = `voice/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, blob);
        if (uploadError) return;

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("messages").insert({
            content: "🎤 Voice Note",
            user_id: userProfile.id,
            lesson_id: activeLesson?.id,
            message_type: "voice",
            media_url: urlData.publicUrl
        });
    };
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeLessonRef = useRef<string | null>(null);

    // Swipe tracking refs
    const touchStartX = useRef(0);
    const touchCurrentX = useRef(0);
    const swipingMsgId = useRef<string | null>(null);

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

        const { data: liveLessons } = await supabase
            .from('lessons')
            .select('*')
            .eq('status', 'live')
            .order('started_at', { ascending: false })
            .limit(1);

        let lesson = liveLessons && liveLessons.length > 0 ? liveLessons[0] : null;

        if (!lesson) {
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
            activeLessonRef.current = lesson.id;

            const now = new Date();
            const scheduledAt = new Date(lesson.scheduled_at);
            const isTimeDue = scheduledAt <= now;

            if (lesson.status === 'scheduled' && !isTimeDue) {
                setIsChatLocked(true);
            } else if (lesson.status === 'completed') {
                setIsChatLocked(true);
            } else {
                const { data: settings } = await supabase.from("platform_settings").select("*").eq("key", "chat_lock").single();
                if (settings?.value) setIsChatLocked(settings.value.is_locked);
                else setIsChatLocked(false);
            }
        } else {
            setIsChatLocked(true);
            setActiveLesson(null);
            activeLessonRef.current = null;
        }
    }, [isArchive, lessonId]);

    const isEffectiveLive = !isArchive && (
        activeLesson?.status === 'live' ||
        (activeLesson?.status === 'scheduled' && new Date(activeLesson.scheduled_at) <= new Date())
    );

    const hasActiveSession = !!(activeLesson && (activeLesson.status === 'live' || activeLesson.status === 'scheduled'));

    // 1. Lesson Context: Initial fetch + aggressive polling + realtime
    useEffect(() => {
        fetchLessonContext();
        const pollTimer = setInterval(() => { fetchLessonContext(); }, 3000);

        const lessonChannel = supabase.channel('lesson-status-live').on('postgres_changes', {
            event: '*', schema: 'public', table: 'lessons'
        }, () => { fetchLessonContext(); }).subscribe();

        const settingsChannel = supabase.channel("platform-settings-live").on("postgres_changes", {
            event: "UPDATE", schema: "public", table: "platform_settings", filter: "key=eq.chat_lock"
        }, (payload) => { setIsChatLocked(payload.new.value.is_locked); }).subscribe();

        return () => {
            clearInterval(pollTimer);
            supabase.removeChannel(lessonChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, [fetchLessonContext]);

    // 2. Fetch and Subscribe to Messages
    useEffect(() => {
        if (!activeLesson && !isArchive) { setMessages([]); return; }

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
            if (data) {
                // Enrich messages with reply data
                const enriched = await enrichReplies(data as any);
                setMessages(enriched);
            }
        };

        fetchMessages();

        const channelKey = isArchive
            ? `lesson-archive-${lessonId}`
            : (activeLesson ? `lesson-live-${activeLesson.id}` : 'chat-global');

        const chatChannel = supabase.channel(channelKey).on("postgres_changes", {
            event: "INSERT", schema: "public", table: "messages"
        }, async (payload) => {
            const msg = payload.new as Message;
            if (activeLesson && msg.lesson_id !== activeLesson.id) return;
            if (isArchive && msg.lesson_id !== lessonId) return;
            if (!activeLesson && !isArchive && msg.lesson_id) return;

            const { data: profileData } = await supabase.from("profiles").select("full_name, role").eq("id", msg.user_id).single();
            let messageWithProfile: Message = { ...msg, profiles: profileData as any };

            // Enrich reply data if this message is a reply
            if (msg.reply_to) {
                const { data: replyData } = await supabase
                    .from("messages")
                    .select("id, content, profiles(full_name)")
                    .eq("id", msg.reply_to)
                    .single();
                if (replyData) {
                    messageWithProfile.reply_message = replyData as any;
                }
            }

            setMessages((prev) => [...prev, messageWithProfile]);
            if (!isArchive) {
                setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
            }
        }).subscribe();

        return () => { supabase.removeChannel(chatChannel); };
    }, [activeLesson?.id, lessonId, isArchive, selectedDate]);

    // Helper: enrich messages array with reply data
    const enrichReplies = async (msgs: Message[]): Promise<Message[]> => {
        const replyIds = msgs.filter(m => m.reply_to).map(m => m.reply_to!);
        if (replyIds.length === 0) return msgs;

        const uniqueIds = [...new Set(replyIds)];
        const { data: replyMessages } = await supabase
            .from("messages")
            .select("id, content, profiles(full_name)")
            .in("id", uniqueIds);

        if (!replyMessages) return msgs;

        const replyMap = new Map(replyMessages.map((rm: any) => [rm.id, rm]));

        return msgs.map(m => {
            if (m.reply_to && replyMap.has(m.reply_to)) {
                return { ...m, reply_message: replyMap.get(m.reply_to) };
            }
            return m;
        });
    };

    // 3. Auto-scroll
    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (scrollContainer && !showJumpBtn) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
    }, [messages.length]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            setShowJumpBtn(scrollHeight - scrollTop - clientHeight > 100);
        }
    };

    const scrollToBottom = () => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    };

    // Scroll to a specific message (when clicking a reply quote)
    const scrollToMessage = (messageId: string) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(styles.highlighted);
            setTimeout(() => el.classList.remove(styles.highlighted), 2000);
        }
    };

    // Swipe-to-reply handlers
    const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
        touchStartX.current = e.touches[0].clientX;
        touchCurrentX.current = e.touches[0].clientX;
        swipingMsgId.current = msg.id;
    };

    const handleTouchMove = (e: React.TouchEvent, msg: Message) => {
        if (swipingMsgId.current !== msg.id) return;
        touchCurrentX.current = e.touches[0].clientX;
        const diff = touchCurrentX.current - touchStartX.current;

        // Only allow swipe right (positive direction), max 80px
        const swipeAmount = Math.min(Math.max(diff, 0), 80);
        const el = document.getElementById(`msg-${msg.id}`);
        if (el) {
            el.style.transform = `translateX(${swipeAmount}px)`;
            el.style.transition = 'none';

            // Show reply indicator when past threshold
            const indicator = el.querySelector(`.${styles.replyIndicator}`) as HTMLElement;
            if (indicator) {
                indicator.style.opacity = swipeAmount > 40 ? '1' : `${swipeAmount / 40}`;
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent, msg: Message) => {
        if (swipingMsgId.current !== msg.id) return;
        const diff = touchCurrentX.current - touchStartX.current;
        const el = document.getElementById(`msg-${msg.id}`);

        if (el) {
            el.style.transform = 'translateX(0)';
            el.style.transition = 'transform 0.3s ease';
        }

        // If swiped past threshold, trigger reply
        if (diff > 50) {
            setReplyingTo(msg);
            (document.getElementById('chat-input')?.querySelector('input') as HTMLInputElement)?.focus();
        }

        swipingMsgId.current = null;
    };

    // Double-click/tap to reply (desktop fallback)
    const handleDoubleClick = (msg: Message) => {
        setReplyingTo(msg);
        (document.getElementById('chat-input')?.querySelector('input') as HTMLInputElement)?.focus();
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        if (!hasActiveSession && !isArchive) return;
        if (isChatLocked && !isStaff && !userProfile.is_unlocked) return;

        const insertData: any = {
            content: newMessage,
            user_id: userProfile.id,
            lesson_id: lessonId || activeLesson?.id
        };

        if (replyingTo) {
            insertData.reply_to = replyingTo.id;
        }

        const { error } = await supabase.from("messages").insert(insertData);

        if (!error) {
            setNewMessage("");
            setReplyingTo(null);
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
                            <>
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPollCreator(true)}
                                    className={styles.pollBtn}
                                >
                                    <BarChart2 size={14} />
                                    <span>Poll</span>
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Poll Creator Modal */}
            {showPollCreator && (
                <div className={styles.modalOverlay}>
                    <div className={styles.pollModal}>
                        <div className={styles.modalHeader}>
                            <h3>Create New Poll</h3>
                            <button onClick={() => setShowPollCreator(false)} className={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Question</label>
                                <Input
                                    placeholder="What's your question?"
                                    value={pollQuestion}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPollQuestion(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Options</label>
                                {pollOptions.map((opt, i) => (
                                    <div key={i} className={styles.optionInputRow}>
                                        <Input
                                            placeholder={`Option ${i + 1}`}
                                            value={opt}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                                const newOpts = [...pollOptions];
                                                newOpts[i] = e.target.value;
                                                setPollOptions(newOpts);
                                            }}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                                                className={styles.removeOpt}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 5 && (
                                    <button
                                        className={styles.addOptBtn}
                                        onClick={() => setPollOptions([...pollOptions, ""])}
                                    >
                                        <Plus size={14} /> Add Option
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <Button variant="outline" onClick={() => setShowPollCreator(false)}>Cancel</Button>
                            <Button
                                variant="primary"
                                disabled={!pollQuestion.trim() || pollOptions.some(o => !o.trim())}
                                onClick={async () => {
                                    const { data: pollData } = await supabase
                                        .from('polls')
                                        .insert({
                                            question: pollQuestion,
                                            options: pollOptions.filter(o => o.trim()),
                                            created_by: userProfile.id,
                                            lesson_id: activeLesson?.id,
                                            chat_type: 'main'
                                        })
                                        .select()
                                        .single();

                                    if (pollData) {
                                        await supabase.from('messages').insert({
                                            content: `📊 Poll: ${pollQuestion}`,
                                            user_id: userProfile.id,
                                            lesson_id: activeLesson?.id,
                                            message_type: 'poll',
                                            media_url: pollData.id
                                        });
                                    }
                                    setShowPollCreator(false);
                                    setPollQuestion("");
                                    setPollOptions(["", ""]);
                                }}
                            >
                                Create Poll
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                                <div
                                    key={msg.id}
                                    id={`msg-${msg.id}`}
                                    className={`${styles.message} ${msg.user_id === userProfile.id ? styles.own : ""}`}
                                    onTouchStart={(e) => handleTouchStart(e, msg)}
                                    onTouchMove={(e) => handleTouchMove(e, msg)}
                                    onTouchEnd={(e) => handleTouchEnd(e, msg)}
                                    onDoubleClick={() => handleDoubleClick(msg)}
                                >
                                    {/* Reply swipe indicator */}
                                    <div className={styles.replyIndicator}>
                                        <Reply size={16} />
                                    </div>

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
                                            {/* Quoted reply preview */}
                                            {msg.reply_message && (
                                                <div
                                                    className={styles.replyQuote}
                                                    onClick={() => scrollToMessage(msg.reply_message!.id)}
                                                >
                                                    <span className={styles.replyAuthor}>
                                                        {msg.reply_message.profiles?.full_name || "Unknown"}
                                                    </span>
                                                    <span className={styles.replyText}>
                                                        {msg.reply_message.content.length > 80
                                                            ? msg.reply_message.content.substring(0, 80) + "..."
                                                            : msg.reply_message.content}
                                                    </span>
                                                </div>
                                            )}
                                            {msg.message_type === 'image' && msg.media_url && (
                                                <div className={styles.mediaContainer} onClick={() => setLightboxImage(msg.media_url!)}>
                                                    <img src={msg.media_url} alt="Shared image" className={styles.mediaImage} style={{ cursor: 'pointer' }} />
                                                </div>
                                            )}
                                            {msg.message_type === 'voice' && msg.media_url && (
                                                <audio controls src={msg.media_url} className={styles.audioPlayer} />
                                            )}
                                            {msg.message_type === 'poll' && msg.media_url && (
                                                <Poll pollId={msg.media_url} isAdmin={isStaff} />
                                            )}
                                            {(!msg.message_type || msg.message_type === 'text') && (
                                                <div className={styles.msgContent}>{msg.content}</div>
                                            )}
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

                    {/* Reply preview bar */}
                    {replyingTo && (
                        <div className={styles.replyPreview}>
                            <div className={styles.replyPreviewContent}>
                                <Reply size={14} />
                                <div className={styles.replyPreviewText}>
                                    <span className={styles.replyPreviewAuthor}>
                                        {replyingTo.profiles?.full_name || "Unknown"}
                                    </span>
                                    <span className={styles.replyPreviewMsg}>
                                        {replyingTo.content.length > 60
                                            ? replyingTo.content.substring(0, 60) + "..."
                                            : replyingTo.content}
                                    </span>
                                </div>
                            </div>
                            <button
                                className={styles.replyPreviewClose}
                                onClick={() => setReplyingTo(null)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

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
                                {isRecording ? (
                                    <div className={styles.recordingOverlay}>
                                        <div className={styles.recordingIndicator}>
                                            <div className={styles.pulse}></div>
                                            <span>Recording {formatTime(recordingTime)}</span>
                                        </div>
                                        <div className={styles.recordingActions}>
                                            <Button type="button" variant="ghost" size="sm" onClick={cancelRecording}>Cancel</Button>
                                            <Button type="button" variant="primary" size="sm" onClick={stopRecording}>Send</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <label className={styles.mediaBtn}>
                                            <ImageIcon size={18} />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    const ext = file.name.split('.').pop();
                                                    const path = `chat/${Date.now()}.${ext}`;

                                                    const { error: uploadError } = await supabase.storage
                                                        .from('chat-media')
                                                        .upload(path, file);

                                                    if (uploadError) {
                                                        console.error('Upload error:', uploadError);
                                                        return;
                                                    }

                                                    const { data: urlData } = supabase.storage
                                                        .from('chat-media')
                                                        .getPublicUrl(path);

                                                    await supabase.from('messages').insert({
                                                        content: '📷 Image',
                                                        user_id: userProfile.id,
                                                        lesson_id: activeLesson?.id,
                                                        message_type: 'image',
                                                        media_url: urlData.publicUrl
                                                    });
                                                }}
                                                disabled={selectedDate !== new Date().toISOString().split('T')[0]}
                                            />
                                        </label>
                                        <Input
                                            id="chat-input"
                                            placeholder={replyingTo ? "Type your reply..." : "Type your message..."}
                                            value={newMessage}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                                            className={styles.input}
                                            disabled={selectedDate !== new Date().toISOString().split('T')[0]}
                                        />
                                        <button
                                            type="button"
                                            className={styles.voiceBtn}
                                            onClick={startRecording}
                                            disabled={selectedDate !== new Date().toISOString().split('T')[0]}
                                        >
                                            <Mic size={18} />
                                        </button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="sm"
                                            className={styles.sendBtn}
                                            disabled={!newMessage.trim() || selectedDate !== new Date().toISOString().split('T')[0]}
                                        >
                                            <Send size={18} />
                                        </Button>
                                    </>
                                )}
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

            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </div>
    );
};
