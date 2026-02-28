"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, StudyGroupMessage, StudyGroup } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Send, Users, Image as ImageIcon, GraduationCap, LibraryBig, Mic, Square, Trash2, Reply, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import styles from "./StudyGroupChat.module.css";

export const StudyGroupChat = () => {
    const { user, profile } = useAuth();

    // Group states
    const [schoolGroup, setSchoolGroup] = useState<StudyGroup | null>(null);
    const [courseGroup, setCourseGroup] = useState<StudyGroup | null>(null);
    const [activeGroupType, setActiveGroupType] = useState<'school' | 'course'>('school');

    const [messages, setMessages] = useState<StudyGroupMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Lightbox & Edit States
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [replyingTo, setReplyingTo] = useState<StudyGroupMessage | null>(null);

    // Swipe tracking refs
    const touchStartX = useRef(0);
    const touchCurrentX = useRef(0);
    const swipingMsgId = useRef<string | null>(null);

    const {
        isRecording,
        recordingTime,
        audioBlob,
        startRecording,
        stopRecording,
        cancelRecording,
        formatTime,
        setAudioBlob
    } = useVoiceRecorder();

    const schoolName = profile?.school;
    const courseName = profile?.course;

    // Derived active group
    const activeGroup = activeGroupType === 'school' ? schoolGroup : courseGroup;

    // 1. Initialize Groups
    useEffect(() => {
        if (!profile) return;

        const initGroups = async () => {
            setLoadingGroups(true);

            // Fetch or create Study Groups securely from API
            try {
                if ((schoolName && schoolName !== "Other / Not Listed") || (courseName && courseName !== "")) {
                    const res = await fetch('/api/study-groups/init', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ school: schoolName, course: courseName })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.schoolGroup) setSchoolGroup(data.schoolGroup);
                        if (data.courseGroup) setCourseGroup(data.courseGroup);
                    }
                }
            } catch (err) {
                console.error("Failed to init study groups", err);
            }

            setLoadingGroups(false);
        };

        initGroups();
    }, [schoolName, courseName, profile]);

    // 2. Fetch Messages and Member Count when activeGroup changes
    useEffect(() => {
        if (!activeGroup) {
            setMessages([]);
            setMemberCount(0);
            return;
        }

        const fetchChatData = async () => {
            setLoadingMessages(true);

            // Get member count based on active group type
            if (activeGroupType === 'school' && schoolName) {
                const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("school", schoolName);
                setMemberCount(count || 0);
            } else if (activeGroupType === 'course' && courseName) {
                const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("course", courseName);
                setMemberCount(count || 0);
            }

            // Fetch messages
            const { data: msgs } = await supabase
                .from("study_group_messages")
                .select("*, profiles:user_id(full_name, role)")
                .eq("group_id", activeGroup.id)
                .order("created_at", { ascending: true })
                .limit(200);

            if (msgs) {
                const enriched = await enrichReplies(msgs as any);
                setMessages(enriched);
            }
            setLoadingMessages(false);
        };

        fetchChatData();

        // Real-time subscription for the active group
        const channel = supabase
            .channel(`study-group-${activeGroup.id}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "study_group_messages", filter: `group_id=eq.${activeGroup.id}` },
                async (payload) => {
                    const msg = payload.new as StudyGroupMessage;
                    const { data: prof } = await supabase.from("profiles").select("full_name, role").eq("id", msg.user_id).single();
                    msg.profiles = prof || undefined;

                    let finalMsg = { ...msg };
                    if (msg.reply_to) {
                        const { data: replyData } = await supabase
                            .from("study_group_messages")
                            .select("id, content, profiles:user_id(full_name)")
                            .eq("id", msg.reply_to)
                            .single();
                        if (replyData) {
                            finalMsg.reply_message = replyData as any;
                        }
                    }

                    setMessages(prev => [...prev, finalMsg]);
                }
            )
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "study_group_messages", filter: `group_id=eq.${activeGroup.id}` },
                (payload) => {
                    const updated = payload.new as StudyGroupMessage;
                    setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
                }
            )
            .on("postgres_changes",
                { event: "DELETE", schema: "public", table: "study_group_messages", filter: `group_id=eq.${activeGroup.id}` },
                (payload) => {
                    setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeGroup, activeGroupType, schoolName, courseName]);

    // Helper: enrich messages array with reply data
    const enrichReplies = async (msgs: StudyGroupMessage[]): Promise<StudyGroupMessage[]> => {
        const replyIds = msgs.filter(m => m.reply_to).map(m => m.reply_to!);
        if (replyIds.length === 0) return msgs;

        const uniqueIds = [...new Set(replyIds)];
        const { data: replyMessages } = await supabase
            .from("study_group_messages")
            .select("id, content, profiles:user_id(full_name)")
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

    // Scroll to a specific message
    const scrollToMessage = (messageId: string) => {
        const el = document.getElementById(`sg-msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(styles.highlighted);
            setTimeout(() => el.classList.remove(styles.highlighted), 2000);
        }
    };

    // Swipe-to-reply handlers
    const handleTouchStart = (e: React.TouchEvent, msg: StudyGroupMessage) => {
        touchStartX.current = e.touches[0].clientX;
        touchCurrentX.current = e.touches[0].clientX;
        swipingMsgId.current = msg.id;
    };

    const handleTouchMove = (e: React.TouchEvent, msg: StudyGroupMessage) => {
        if (swipingMsgId.current !== msg.id) return;
        touchCurrentX.current = e.touches[0].clientX;
        const diff = touchCurrentX.current - touchStartX.current;

        const swipeAmount = Math.min(Math.max(diff, 0), 80);
        const el = document.getElementById(`sg-msg-${msg.id}`);
        if (el) {
            el.style.transform = `translateX(${swipeAmount}px)`;
            el.style.transition = 'none';

            const indicator = el.querySelector(`.${styles.replyIndicator}`) as HTMLElement;
            if (indicator) {
                indicator.style.opacity = swipeAmount > 40 ? '1' : `${swipeAmount / 40}`;
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent, msg: StudyGroupMessage) => {
        if (swipingMsgId.current !== msg.id) return;
        const diff = touchCurrentX.current - touchStartX.current;
        const el = document.getElementById(`sg-msg-${msg.id}`);

        if (el) {
            el.style.transform = 'translateX(0)';
            el.style.transition = 'transform 0.3s ease';
        }

        if (diff > 50) {
            setReplyingTo(msg);
            document.getElementById('sg-input')?.focus();
        }
        swipingMsgId.current = null;
    };

    const handleDoubleClick = (msg: StudyGroupMessage) => {
        setReplyingTo(msg);
        document.getElementById('sg-input')?.focus();
    };

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !activeGroup) return;

        const content = newMessage.trim();
        setNewMessage("");
        const replyId = replyingTo?.id;
        setReplyingTo(null);

        const insertData: any = {
            group_id: activeGroup.id,
            user_id: user.id,
            content,
            message_type: "text"
        };

        if (replyId) insertData.reply_to = replyId;

        await supabase.from("study_group_messages").insert(insertData);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !activeGroup) return;

        const ext = file.name.split(".").pop();
        const path = `study-groups/${activeGroup.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from("chat-media").upload(path, file);
        if (error) return;

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("study_group_messages").insert({
            group_id: activeGroup.id,
            user_id: user.id,
            content: "📷 Image",
            message_type: "image",
            media_url: urlData.publicUrl
        });
    };

    const handleVoiceSend = async () => {
        if (!audioBlob || !user || !activeGroup) return;

        const path = `study-groups/${activeGroup.id}/voice_${Date.now()}.webm`;
        const { error } = await supabase.storage.from("chat-media").upload(path, audioBlob);

        if (error) {
            console.error("Failed to upload voice note:", error);
            return;
        }

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("study_group_messages").insert({
            group_id: activeGroup.id,
            user_id: user.id,
            content: "🎤 Voice Message",
            message_type: "voice",
            media_url: urlData.publicUrl
        });

        setAudioBlob(null);
    };

    if (loadingGroups) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Loading study groups...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Tabs for Group Switching */}
            <div className={styles.groupTabs}>
                <button
                    className={`${styles.tabBtn} ${activeGroupType === 'school' ? styles.activeTab : ''}`}
                    onClick={() => setActiveGroupType('school')}
                >
                    <LibraryBig size={18} />
                    Institution Group
                </button>
                <button
                    className={`${styles.tabBtn} ${activeGroupType === 'course' ? styles.activeTab : ''}`}
                    onClick={() => setActiveGroupType('course')}
                >
                    <GraduationCap size={18} />
                    Course Group
                </button>
            </div>

            {!activeGroup ? (
                <div className={styles.emptyState}>
                    <Users size={40} />
                    <h3>No {activeGroupType === 'school' ? 'Institution' : 'Course'} Group Available</h3>
                    <p>Update your profile with your {activeGroupType === 'school' ? 'school' : 'course'} to join this study group.</p>
                </div>
            ) : (
                <>
                    <div className={styles.header}>
                        <Users size={20} />
                        <div className={styles.headerInfo}>
                            <h3>{activeGroupType === 'school' ? schoolName : courseName}</h3>
                            <span className={styles.memberCount}>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                        </div>
                    </div>

                    <div className={styles.messages} ref={scrollRef}>
                        {loadingMessages ? (
                            <div className={styles.emptyState}>Loading messages...</div>
                        ) : messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No messages yet. Be the first to chat with your {activeGroupType === 'school' ? 'schoolmates' : 'coursemates'}! 🎓</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isOwn = msg.user_id === user?.id;
                                const isStaff = profile?.role === 'admin' || profile?.role === 'ta';
                                const isEditing = editingMessageId === msg.id;

                                return (
                                    <div
                                        key={msg.id}
                                        id={`sg-msg-${msg.id}`}
                                        className={`${styles.message} ${isOwn ? styles.own : ""}`}
                                        onTouchStart={(e) => handleTouchStart(e, msg)}
                                        onTouchMove={(e) => handleTouchMove(e, msg)}
                                        onTouchEnd={(e) => handleTouchEnd(e, msg)}
                                        onDoubleClick={() => handleDoubleClick(msg)}
                                    >
                                        <div className={styles.replyIndicator}>
                                            <Reply size={16} />
                                        </div>
                                        {!isOwn && (
                                            <div className={styles.avatar}>{(msg.profiles?.full_name || "?")[0].toUpperCase()}</div>
                                        )}
                                        <div className={styles.bubbleWrap}>
                                            {!isOwn && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span className={styles.senderName}>{msg.profiles?.full_name || "Unknown"}</span>
                                                    {isStaff && (
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={async () => {
                                                                if (confirm("Delete this message?")) {
                                                                    await supabase.from("study_group_messages").delete().eq("id", msg.id);
                                                                }
                                                            }}
                                                            style={{ fontSize: '11px', color: 'var(--secondary)' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className={styles.bubble}>
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
                                                {msg.message_type === "image" && msg.media_url && (
                                                    <div className={styles.imageContainer} onClick={() => setSelectedImage(msg.media_url!)}>
                                                        <img src={msg.media_url} alt="Shared" className={styles.mediaImage} />
                                                        <div className={styles.imageOverlay}>Click to expand</div>
                                                    </div>
                                                )}
                                                {msg.message_type === "voice" && msg.media_url && (
                                                    <audio controls src={msg.media_url} className={styles.audioPlayer} />
                                                )}
                                                {msg.message_type === "text" && (
                                                    isEditing ? (
                                                        <div className={styles.editArea}>
                                                            <Textarea
                                                                value={editContent}
                                                                onChange={(e) => setEditContent(e.target.value)}
                                                                className={styles.editTextarea}
                                                            />
                                                            <div className={styles.editActions}>
                                                                <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                                                <Button size="sm" variant="primary" onClick={async () => {
                                                                    await supabase.from("study_group_messages").update({ content: editContent }).eq("id", msg.id);
                                                                    setEditingMessageId(null);
                                                                }}>Save</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className={styles.text}>{msg.content}</p>
                                                    )
                                                )}
                                                <div className={styles.msgFooter}>
                                                    <span className={styles.time}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        {msg.updated_at && msg.updated_at !== msg.created_at && " (edited)"}
                                                    </span>
                                                    {isOwn && !isEditing && (
                                                        <div className={styles.ownActions} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                            {msg.message_type === 'text' && (
                                                                <button
                                                                    className={styles.actionBtn}
                                                                    style={{ fontSize: '11px', color: 'var(--secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                                    onClick={() => {
                                                                        setEditingMessageId(msg.id);
                                                                        setEditContent(msg.content);
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                className={styles.actionBtn}
                                                                style={{ fontSize: '11px', color: 'var(--secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                                onClick={async () => {
                                                                    if (confirm("Delete your message?")) {
                                                                        await supabase.from("study_group_messages").delete().eq("id", msg.id);
                                                                    }
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

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
                            <button className={styles.replyPreviewClose} onClick={() => setReplyingTo(null)}>
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <div className={styles.inputContainerWrapper}>
                        {isRecording ? (
                            <div className={styles.recordingUI}>
                                <div className={styles.recordingPulse} />
                                <span className={styles.recordingTime}>{formatTime(recordingTime)}</span>
                                <div className={styles.recordingActions}>
                                    <button type="button" onClick={cancelRecording} className={styles.cancelRecordBtn}>
                                        <Trash2 size={18} />
                                    </button>
                                    <button type="button" onClick={stopRecording} className={styles.stopRecordBtn}>
                                        <Square size={18} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        ) : audioBlob ? (
                            <div className={styles.preSendUI}>
                                <audio src={URL.createObjectURL(audioBlob)} controls className={styles.audioPreview} />
                                <div className={styles.recordingActions}>
                                    <button type="button" onClick={cancelRecording} className={styles.cancelRecordBtn}>
                                        <Trash2 size={18} />
                                    </button>
                                    <Button type="button" onClick={handleVoiceSend} variant="primary" size="sm" className={styles.sendRecordBtn}>
                                        <Send size={18} />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSend} className={styles.inputArea}>
                                <label className={styles.mediaBtn}>
                                    <ImageIcon size={20} />
                                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                                </label>
                                <Textarea
                                    id="sg-input"
                                    placeholder={replyingTo ? "Type your reply..." : "Message your study group..."}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend(e);
                                        }
                                    }}
                                    className={styles.input}
                                />
                                {newMessage.trim() ? (
                                    <Button type="submit" variant="primary" className={styles.sendBtn} disabled={!newMessage.trim()}>
                                        <Send size={18} />
                                    </Button>
                                ) : (
                                    <button type="button" onClick={startRecording} className={styles.micBtn}>
                                        <Mic size={20} />
                                    </button>
                                )}
                            </form>
                        )}
                    </div>
                </>
            )}

            {selectedImage && (
                <ImageLightbox
                    src={selectedImage}
                    onClose={() => setSelectedImage(null)}
                />
            )}
        </div>
    );
};
