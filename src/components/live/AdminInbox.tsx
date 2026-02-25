"use client";

import { useState, useEffect } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Search } from "lucide-react";
import { DirectChat } from "./DirectChat";
import { Input } from "@/components/ui/Input";
import styles from "./AdminInbox.module.css";

interface ConversationItem {
    userId: string;
    fullName: string;
    school?: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

export const AdminInbox = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        fetchConversations();

        // Subscribe to new DMs
        const channel = supabase
            .channel("admin-inbox")
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "direct_messages" },
                () => { fetchConversations(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const fetchConversations = async () => {
        if (!user) return;

        // Get all DMs where admin is sender or receiver
        const { data: dms } = await supabase
            .from("direct_messages")
            .select("*")
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

        if (!dms) { setLoading(false); return; }

        // Group by conversation partner
        const convMap = new Map<string, { msgs: any[], unread: number }>();
        for (const dm of dms) {
            const partnerId = dm.sender_id === user.id ? dm.receiver_id : dm.sender_id;
            if (!convMap.has(partnerId)) {
                convMap.set(partnerId, { msgs: [], unread: 0 });
            }
            const conv = convMap.get(partnerId)!;
            conv.msgs.push(dm);
            if (!dm.is_read && dm.receiver_id === user.id) {
                conv.unread++;
            }
        }

        // Fetch partner profiles
        const partnerIds = Array.from(convMap.keys());
        if (partnerIds.length === 0) { setConversations([]); setLoading(false); return; }

        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, school")
            .in("id", partnerIds);

        const profileMap = new Map<string, Profile>();
        profiles?.forEach(p => profileMap.set(p.id, p as Profile));

        const items: ConversationItem[] = partnerIds.map(pid => {
            const conv = convMap.get(pid)!;
            const profile = profileMap.get(pid);
            const lastMsg = conv.msgs[0];
            return {
                userId: pid,
                fullName: profile?.full_name || "Unknown",
                school: profile?.school,
                lastMessage: lastMsg.content,
                lastMessageAt: lastMsg.created_at,
                unreadCount: conv.unread
            };
        });

        // Sort by most recent first
        items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        setConversations(items);
        setLoading(false);
    };

    const filteredConversations = conversations.filter(c =>
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.school && c.school.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    // If a chat is selected, show it full screen
    if (selectedUserId) {
        return (
            <DirectChat
                otherUserId={selectedUserId}
                otherUserName={selectedUserName}
                onBack={() => { setSelectedUserId(null); fetchConversations(); }}
            />
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <MessageCircle size={20} />
                <h3>Student Messages</h3>
                {totalUnread > 0 && <span className={styles.totalBadge}>{totalUnread}</span>}
            </div>

            <div className={styles.searchArea}>
                <Input
                    placeholder="Search students..."
                    icon={<Search size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className={styles.list}>
                {loading ? (
                    <div className={styles.empty}>Loading...</div>
                ) : filteredConversations.length === 0 ? (
                    <div className={styles.empty}>
                        {searchQuery ? "No matching conversations" : "No messages yet"}
                    </div>
                ) : (
                    filteredConversations.map(conv => (
                        <div
                            key={conv.userId}
                            className={`${styles.convItem} ${conv.unreadCount > 0 ? styles.unread : ""}`}
                            onClick={() => { setSelectedUserId(conv.userId); setSelectedUserName(conv.fullName); }}
                        >
                            <div className={styles.convAvatar}>
                                {conv.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.convInfo}>
                                <div className={styles.convTop}>
                                    <span className={styles.convName}>{conv.fullName}</span>
                                    <span className={styles.convTime}>
                                        {new Date(conv.lastMessageAt).toLocaleDateString([], { day: "numeric", month: "short" })}
                                    </span>
                                </div>
                                <div className={styles.convBottom}>
                                    <span className={styles.convPreview}>{conv.lastMessage}</span>
                                    {conv.unreadCount > 0 && (
                                        <span className={styles.unreadBadge}>{conv.unreadCount}</span>
                                    )}
                                </div>
                                {conv.school && <span className={styles.convSchool}>{conv.school}</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Export hook for unread count (used in sidebar badge)
export function useUnreadDMCount() {
    const { user, profile } = useAuth();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!user || profile?.role !== "admin") return;

        const fetchCount = async () => {
            const { count: c } = await supabase
                .from("direct_messages")
                .select("*", { count: "exact", head: true })
                .eq("receiver_id", user.id)
                .eq("is_read", false);
            setCount(c || 0);
        };

        fetchCount();
        const interval = setInterval(fetchCount, 10000);

        const channel = supabase
            .channel("dm-count")
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "direct_messages" },
                () => fetchCount()
            )
            .subscribe();

        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [user, profile?.role]);

    return count;
}
