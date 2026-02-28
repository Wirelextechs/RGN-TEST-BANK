"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, DirectMessage } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Send, ArrowLeft, Image as ImageIcon, Mic, Square, Trash2, Reply, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import styles from "./DirectChat.module.css";

interface DirectChatProps {
    otherUserId: string;
    otherUserName: string;
    onBack?: () => void;
}

export const DirectChat = ({ otherUserId, otherUserName, onBack }: DirectChatProps) => {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    // Fetch messages between the two users
    useEffect(() => {
        if (!user) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from("direct_messages")
                .select("*")
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
                .order("created_at", { ascending: true })
                .limit(200);

            if (data) {
                const enriched = await enrichReplies(data as any);
                setMessages(enriched);
            }
            setLoading(false);

            // Mark unread messages as read
            await supabase
                .from("direct_messages")
                .update({ is_read: true })
                .eq("receiver_id", user.id)
                .eq("sender_id", otherUserId)
                .eq("is_read", false);
        };

        fetchMessages();

        // Real-time subscription
        const channel = supabase
            .channel(`dm-${user.id}-${otherUserId}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "direct_messages" },
                async (payload) => {
                    const msg = payload.new as DirectMessage;
                    if (
                        (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
                        (msg.sender_id === otherUserId && msg.receiver_id === user.id)
                    ) {
                        let finalMsg = { ...msg };
                        if (msg.reply_to) {
                            const { data: replyData } = await supabase
                                .from("direct_messages")
                                .select("id, content")
                                .eq("id", msg.reply_to)
                                .single();
                            if (replyData) {
                                // Add sender's pseudo-profile if we wanted names, but here we just need the text
                                finalMsg.reply_message = replyData as any;
                            }
                        }

                        setMessages(prev => [...prev, finalMsg]);
                        // Mark as read if we're the receiver
                        if (msg.receiver_id === user.id) {
                            supabase
                                .from("direct_messages")
                                .update({ is_read: true })
                                .eq("id", msg.id)
                                .then();
                        }
                    }
                }
            )
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "direct_messages" },
                (payload) => {
                    const msg = payload.new as DirectMessage;
                    setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
                }
            )
            .on("postgres_changes",
                { event: "DELETE", schema: "public", table: "direct_messages" },
                (payload) => {
                    const id = payload.old.id;
                    setMessages(prev => prev.filter(m => m.id !== id));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, otherUserId]);

    // Helper: enrich messages array with reply data
    const enrichReplies = async (msgs: DirectMessage[]): Promise<DirectMessage[]> => {
        const replyIds = msgs.filter(m => m.reply_to).map(m => m.reply_to!);
        if (replyIds.length === 0) return msgs;

        const uniqueIds = [...new Set(replyIds)];
        const { data: replyMessages } = await supabase
            .from("direct_messages")
            .select("id, content")
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
        const el = document.getElementById(`dm-msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(styles.highlighted);
            setTimeout(() => el.classList.remove(styles.highlighted), 2000);
        }
    };

    // Swipe-to-reply handlers
    const handleTouchStart = (e: React.TouchEvent, msg: DirectMessage) => {
        touchStartX.current = e.touches[0].clientX;
        touchCurrentX.current = e.touches[0].clientX;
        swipingMsgId.current = msg.id;
    };

    const handleTouchMove = (e: React.TouchEvent, msg: DirectMessage) => {
        if (swipingMsgId.current !== msg.id) return;
        touchCurrentX.current = e.touches[0].clientX;
        const diff = touchCurrentX.current - touchStartX.current;

        const swipeAmount = Math.min(Math.max(diff, 0), 80);
        const el = document.getElementById(`dm-msg-${msg.id}`);
        if (el) {
            el.style.transform = `translateX(${swipeAmount}px)`;
            el.style.transition = 'none';

            const indicator = el.querySelector(`.${styles.replyIndicator}`) as HTMLElement;
            if (indicator) {
                indicator.style.opacity = swipeAmount > 40 ? '1' : `${swipeAmount / 40}`;
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent, msg: DirectMessage) => {
        if (swipingMsgId.current !== msg.id) return;
        const diff = touchCurrentX.current - touchStartX.current;
        const el = document.getElementById(`dm-msg-${msg.id}`);

        if (el) {
            el.style.transform = 'translateX(0)';
            el.style.transition = 'transform 0.3s ease';
        }

        if (diff > 50) {
            setReplyingTo(msg);
            document.getElementById('dm-input')?.focus();
        }
        swipingMsgId.current = null;
    };

    const handleDoubleClick = (msg: DirectMessage) => {
        setReplyingTo(msg);
        document.getElementById('dm-input')?.focus();
    };

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const content = newMessage.trim();
        setNewMessage("");
        const replyId = replyingTo?.id;
        setReplyingTo(null);

        const insertData: any = {
            sender_id: user.id,
            receiver_id: otherUserId,
            content,
            message_type: "text"
        };

        if (replyId) insertData.reply_to = replyId;

        await supabase.from("direct_messages").insert(insertData);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const ext = file.name.split(".").pop();
        const path = `dm/${user.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from("chat-media").upload(path, file);
        if (error) return;

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("direct_messages").insert({
            sender_id: user.id,
            receiver_id: otherUserId,
            content: "📷 Image",
            message_type: "image",
            media_url: urlData.publicUrl
        });
    };

    const handleVoiceSend = async () => {
        if (!audioBlob || !user) return;

        const path = `dm/${user.id}/voice_${Date.now()}.webm`;
        const { error } = await supabase.storage.from("chat-media").upload(path, audioBlob);

        if (error) {
            console.error("Failed to upload voice note:", error);
            return;
        }

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("direct_messages").insert({
            sender_id: user.id,
            receiver_id: otherUserId,
            content: "🎤 Voice Message",
            message_type: "voice",
            media_url: urlData.publicUrl
        });

        setAudioBlob(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                {onBack && (
                    <button className={styles.backBtn} onClick={onBack}>
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className={styles.headerInfo}>
                    <div className={styles.avatar}>{otherUserName.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 className={styles.headerName}>{otherUserName}</h3>
                        <span className={styles.headerStatus}>Direct Message</span>
                    </div>
                </div>
            </div>

            <div className={styles.messages} ref={scrollRef}>
                {loading ? (
                    <div className={styles.loadingMsg}>Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No messages yet. Start a conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.sender_id === user?.id;
                        return (
                            <div
                                key={msg.id}
                                id={`dm-msg-${msg.id}`}
                                className={`${styles.message} ${isOwn ? styles.own : ""}`}
                                onTouchStart={(e) => handleTouchStart(e, msg)}
                                onTouchMove={(e) => handleTouchMove(e, msg)}
                                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                                onDoubleClick={() => handleDoubleClick(msg)}
                            >
                                <div className={styles.replyIndicator}>
                                    <Reply size={16} />
                                </div>
                                <div className={styles.bubble}>
                                    {msg.reply_message && (
                                        <div
                                            className={styles.replyQuote}
                                            onClick={() => scrollToMessage(msg.reply_message!.id)}
                                        >
                                            <span className={styles.replyAuthor}>
                                                {msg.reply_message.sender_profile?.full_name || (msg.reply_message as any).sender_id === user?.id ? "You" : "Them"}
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
                                            <img src={msg.media_url} alt="Shared image" className={styles.mediaImage} style={{ cursor: 'pointer' }} />
                                        </div>
                                    )}
                                    {msg.message_type === "voice" && msg.media_url && (
                                        <audio controls src={msg.media_url} className={styles.audioPlayer} />
                                    )}
                                    {msg.message_type === "text" && (
                                        editingMsgId === msg.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                                <Textarea
                                                    value={editContent}
                                                    onChange={e => setEditContent(e.target.value)}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Button size="sm" variant="outline" onClick={() => setEditingMsgId(null)}>Cancel</Button>
                                                    <Button size="sm" variant="primary" onClick={async () => {
                                                        if (!editContent.trim()) return;
                                                        await supabase.from('direct_messages').update({ content: editContent.trim(), is_edited: true }).eq('id', msg.id);
                                                        setEditingMsgId(null);
                                                    }}>Save</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className={styles.text}>
                                                {msg.content}
                                                {msg.is_edited && <span className={styles.editedMark}>(edited)</span>}
                                            </p>
                                        )
                                    )}
                                    <span className={styles.time}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {(isOwn || profile?.role === 'admin' || profile?.role === 'ta') && editingMsgId !== msg.id && (
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', opacity: 0.7 }}>
                                            {isOwn && msg.message_type === 'text' && (
                                                <button
                                                    onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={async () => {
                                                    if (confirm("Are you sure you want to delete this message?")) {
                                                        await supabase.from("direct_messages").delete().eq("id", msg.id);
                                                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
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
                                {replyingTo.sender_id === user?.id ? "You" : "Them"}
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
                            <button onClick={cancelRecording} className={styles.cancelRecordBtn}>
                                <Trash2 size={18} />
                            </button>
                            <button onClick={stopRecording} className={styles.stopRecordBtn}>
                                <Square size={18} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                ) : audioBlob ? (
                    <div className={styles.preSendUI}>
                        <audio src={URL.createObjectURL(audioBlob)} controls className={styles.audioPreview} />
                        <div className={styles.recordingActions}>
                            <button onClick={cancelRecording} className={styles.cancelRecordBtn}>
                                <Trash2 size={18} />
                            </button>
                            <Button onClick={handleVoiceSend} variant="primary" size="sm" className={styles.sendRecordBtn}>
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
                            id="dm-input"
                            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
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

            {selectedImage && (
                <ImageLightbox
                    src={selectedImage}
                    onClose={() => setSelectedImage(null)}
                />
            )}
        </div>
    );
};
