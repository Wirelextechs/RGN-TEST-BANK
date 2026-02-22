"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Send, Smile, Hand, Lock, Unlock, Hash, Calendar } from "lucide-react";
import styles from "./Chat.module.css";
import { supabase, Message, Profile } from "@/lib/supabase";

interface ChatProps {
    userProfile: Profile;
    isAdmin?: boolean;
}

export const Chat = ({ userProfile, isAdmin }: ChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initial fetch of messages for selected date
        const fetchMessages = async () => {
            const startOfDay = `${selectedDate}T00:00:00.000Z`;
            const endOfDay = `${selectedDate}T23:59:59.999Z`;

            const { data } = await supabase
                .from("messages")
                .select("*")
                .gte("created_at", startOfDay)
                .lte("created_at", endOfDay)
                .order("created_at", { ascending: true });
            if (data) setMessages(data);
        };

        fetchMessages();

        // Subscribe to new messages (only relevant for today)
        const isToday = selectedDate === new Date().toISOString().split('T')[0];

        const channel = supabase
            .channel("live-chat")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
                if (isToday) {
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedDate]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || (isChatLocked && !isAdmin && !userProfile.is_locked)) return;

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
    };

    return (
        <Card className={styles.chatContainer}>
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
                    {isAdmin && (
                        <Button
                            variant={isChatLocked ? "error" : "outline"}
                            size="sm"
                            onClick={() => setIsChatLocked(!isChatLocked)}
                            className={styles.lockBtn}
                        >
                            {isChatLocked ? <Lock size={14} /> : <Unlock size={14} />}
                            <span>{isChatLocked ? "Locked" : "Lock"}</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className={styles.messages} ref={scrollRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`${styles.message} ${msg.user_id === userProfile.id ? styles.own : ""}`}>
                        <div className={styles.avatar}>
                            {msg.user_id.substring(0, 2).toUpperCase()}
                        </div>
                        <div className={styles.contentWrapper}>
                            <div className={styles.msgContent}>{msg.content}</div>
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

            <form onSubmit={handleSendMessage} className={styles.inputArea}>
                {!isAdmin && isChatLocked && !userProfile.is_locked ? (
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
        </Card>
    );
};
