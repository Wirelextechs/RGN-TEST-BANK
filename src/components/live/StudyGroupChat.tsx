"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, StudyGroupMessage, StudyGroup } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Send, Users, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./StudyGroupChat.module.css";

export const StudyGroupChat = () => {
    const { user, profile } = useAuth();
    const [group, setGroup] = useState<StudyGroup | null>(null);
    const [messages, setMessages] = useState<StudyGroupMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [memberCount, setMemberCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const schoolName = profile?.school;

    // Find or create study group for user's school
    useEffect(() => {
        if (!schoolName || schoolName === "Other / Not Listed") {
            setLoading(false);
            return;
        }

        const initGroup = async () => {
            // Try to find existing group
            let { data: existingGroup } = await supabase
                .from("study_groups")
                .select("*")
                .eq("school_name", schoolName)
                .single();

            if (!existingGroup) {
                // Create group for this school
                const { data: newGroup } = await supabase
                    .from("study_groups")
                    .insert({ school_name: schoolName })
                    .select()
                    .single();
                existingGroup = newGroup;
            }

            if (existingGroup) {
                setGroup(existingGroup);

                // Get member count
                const { count } = await supabase
                    .from("profiles")
                    .select("*", { count: "exact", head: true })
                    .eq("school", schoolName);
                setMemberCount(count || 0);

                // Fetch messages
                const { data: msgs } = await supabase
                    .from("study_group_messages")
                    .select("*, profiles:user_id(full_name, role)")
                    .eq("group_id", existingGroup.id)
                    .order("created_at", { ascending: true })
                    .limit(200);

                if (msgs) setMessages(msgs);
            }
            setLoading(false);
        };

        initGroup();
    }, [schoolName]);

    // Real-time subscription
    useEffect(() => {
        if (!group) return;

        const channel = supabase
            .channel(`study-group-${group.id}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "study_group_messages", filter: `group_id=eq.${group.id}` },
                async (payload) => {
                    const msg = payload.new as StudyGroupMessage;
                    // Fetch profile for the new message
                    const { data: prof } = await supabase
                        .from("profiles")
                        .select("full_name, role")
                        .eq("id", msg.user_id)
                        .single();
                    msg.profiles = prof || undefined;
                    setMessages(prev => [...prev, msg]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [group]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !group) return;

        const content = newMessage.trim();
        setNewMessage("");

        await supabase.from("study_group_messages").insert({
            group_id: group.id,
            user_id: user.id,
            content,
            message_type: "text"
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !group) return;

        const ext = file.name.split(".").pop();
        const path = `study-groups/${group.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from("chat-media").upload(path, file);
        if (error) return;

        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);

        await supabase.from("study_group_messages").insert({
            group_id: group.id,
            user_id: user.id,
            content: "📷 Image",
            message_type: "image",
            media_url: urlData.publicUrl
        });
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Loading study group...</div>
            </div>
        );
    }

    if (!schoolName || schoolName === "Other / Not Listed") {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <Users size={40} />
                    <h3>No Study Group Available</h3>
                    <p>Study groups are created per school. Update your profile with your school to join one.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Users size={20} />
                <div className={styles.headerInfo}>
                    <h3>{schoolName}</h3>
                    <span className={styles.memberCount}>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                </div>
            </div>

            <div className={styles.messages} ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No messages yet. Be the first to chat with your schoolmates! 🎓</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === user?.id;
                        return (
                            <div key={msg.id} className={`${styles.message} ${isOwn ? styles.own : ""}`}>
                                {!isOwn && (
                                    <div className={styles.avatar}>{(msg.profiles?.full_name || "?")[0].toUpperCase()}</div>
                                )}
                                <div className={styles.bubbleWrap}>
                                    {!isOwn && (
                                        <span className={styles.senderName}>{msg.profiles?.full_name || "Unknown"}</span>
                                    )}
                                    <div className={styles.bubble}>
                                        {msg.message_type === "image" && msg.media_url && (
                                            <img src={msg.media_url} alt="Shared" className={styles.mediaImage} />
                                        )}
                                        {msg.message_type === "text" && (
                                            <p className={styles.text}>{msg.content}</p>
                                        )}
                                        <span className={styles.time}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <form onSubmit={handleSend} className={styles.inputArea}>
                <label className={styles.mediaBtn}>
                    <ImageIcon size={20} />
                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                </label>
                <Input
                    id="sg-input"
                    placeholder="Message your study group..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className={styles.input}
                />
                <Button type="submit" variant="primary" className={styles.sendBtn} disabled={!newMessage.trim()}>
                    <Send size={18} />
                </Button>
            </form>
        </div>
    );
};
