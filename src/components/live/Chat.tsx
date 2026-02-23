"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Send, Smile, Hand, Lock, Unlock, Hash, Calendar } from "lucide-react";
import styles from "./Chat.module.css";
import { supabase, Message, Profile } from "@/lib/supabase";

interface ChatProps {
    userProfile: Profile;
    isAdmin?: boolean;
    isTA?: boolean;
}

export const Chat = ({ userProfile, isAdmin, isTA }: ChatProps) => {
    const isStaff = isAdmin || isTA;
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showJumpBtn, setShowJumpBtn] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch current platform settings (like chat lock)
        const fetchSettings = async () => {
            const { data } = await supabase
                .from("platform_settings")
                .select("*")
                .eq("key", "chat_lock")
                .single();
            if (data?.value) {
                setIsChatLocked(data.value.is_locked);
            }
        };

        fetchSettings();

        // Subscribe to settings changes
        const settingsChannel = supabase
            .channel("platform-settings")
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "platform_settings", filter: "key=eq.chat_lock" },
                (payload) => {
                    setIsChatLocked(payload.new.value.is_locked);
                }
            )
            .subscribe();

        // Initial fetch of messages (Persistent "WhatsApp" style)
        const fetchMessages = async () => {
            const isToday = selectedDate === new Date().toISOString().split('T')[0];

            let query = supabase
                .from("messages")
                .select("*, profiles(full_name, role)");

            if (isToday) {
                // Load at least 20 messages, or all since last_read_at
                const lastRead = userProfile.last_read_at || new Date(0).toISOString();

                const { data } = await query
                    .order("created_at", { ascending: false })
                    .limit(50); // Get latest 50 for immediate context

                if (data) setMessages(data.reverse() as any);
            } else {
                // Historical archive view
                const startOfDay = `${selectedDate}T00:00:00.000Z`;
                const endOfDay = `${selectedDate}T23:59:59.999Z`;
                const { data } = await query
                    .gte("created_at", startOfDay)
                    .lte("created_at", endOfDay)
                    .order("created_at", { ascending: true });
                if (data) setMessages(data as any);
            }
        };

        fetchMessages();

        // Update last_read_at when viewing today's chat
        const isToday = selectedDate === new Date().toISOString().split('T')[0];
        if (isToday) {
            supabase
                .from("profiles")
                .update({ last_read_at: new Date().toISOString() })
                .eq("id", userProfile.id)
                .then(() => { });
        }

        const chatChannel = supabase
            .channel("live-chat")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
                if (isToday) {
                    const newMessage = payload.new as Message;

                    // Enrich with profile info for badges
                    const { data: profileData } = await supabase
                        .from("profiles")
                        .select("full_name, role")
                        .eq("id", newMessage.user_id)
                        .single();

                    if (profileData) {
                        newMessage.profiles = profileData;
                    }

                    setMessages((prev) => [...prev, newMessage]);
                    // Auto-update last_read_at on new messages
                    supabase
                        .from("profiles")
                        .update({ last_read_at: new Date().toISOString() })
                        .eq("id", userProfile.id)
                        .then(() => { });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(settingsChannel);
            supabase.removeChannel(chatChannel);
        };
    }, [selectedDate, userProfile.id]);

    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (scrollContainer && !showJumpBtn) {
            // Smoothly scroll to bottom on new messages
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages.length]); // Only snap when message count changes

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowJumpBtn(!isBottom);
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        // Allow if: !locked OR isStaff OR specifically unlocked
        if (!newMessage.trim() || (isChatLocked && !isStaff && !userProfile.is_unlocked)) return;

        const { error } = await supabase.from("messages").insert({
            content: newMessage,
            user_id: userProfile.id,
        });

        if (!error) setNewMessage("");
    };

    const toggleRaiseHand = async () => {
        const { error } = await supabase
            .from("profiles")
            .update({ is_hand_raised: !userProfile.is_hand_raised })
            .eq("id", userProfile.id);
        if (error) {
            console.error("Error toggling hand raised status:", error);
            alert("Failed to update hand raised status.");
        }
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
                <div className={styles.status}>
                    <div className={styles.onlineDot}></div>
                    <span>{selectedDate === new Date().toISOString().split('T')[0] ? "Live Interaction" : "Archive"}</span>
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
                                try {
                                    const newLockState = !isChatLocked;
                                    setIsChatLocked(newLockState);

                                    const { error } = await supabase
                                        .from("platform_settings")
                                        .update({ value: { is_locked: newLockState } })
                                        .eq("key", "chat_lock");

                                    if (error) throw error;
                                } catch (err: any) {
                                    console.error("Lock toggle failed:", err);
                                    setIsChatLocked(isChatLocked); // Revert
                                    alert(`Failed to update lock: ${err.message || "Ensure you are a staff member (Admin/TA) in the database."}`);
                                }
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
                                {msg.profiles?.full_name?.substring(0, 1).toUpperCase() || msg.user_id.substring(0, 1).toUpperCase()}
                                {msg.profiles?.role === 'ta' && <span className={styles.taBadge}>TA</span>}
                                {msg.profiles?.role === 'admin' && <span className={styles.adminBadge}>A</span>}
                            </div>
                            <div className={styles.contentWrapper}>
                                <div className={styles.senderHeader}>
                                    <span className={styles.senderName}>
                                        {msg.user_id === userProfile.id ? "You" : (msg.profiles?.full_name || "Unknown User")}
                                    </span>
                                </div>
                                <div className={styles.msgBubble}>
                                    <div className={styles.msgContent}>{msg.content}</div>
                                    <div className={styles.msgMeta}>
                                        <span className={styles.timestamp}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.reactions}>
                                    {Object.entries(msg.reactions || {}).map(([emoji, users]) => (
                                        <span key={emoji} className={styles.reaction}>
                                            {emoji} {users.length}
                                        </span>
                                    ))}
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
                        <span>Chat is locked by Admin</span>
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
