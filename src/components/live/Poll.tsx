"use client";

import { useState, useEffect } from "react";
import { supabase, Poll as PollType, PollVote } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Check } from "lucide-react";
import styles from "./Poll.module.css";

interface PollProps {
    pollId: string;
    isAdmin?: boolean;
}

export const Poll = ({ pollId, isAdmin }: PollProps) => {
    const { user } = useAuth();
    const [poll, setPoll] = useState<PollType | null>(null);
    const [userVote, setUserVote] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPollData = async () => {
            const { data: pollData } = await supabase
                .from("polls")
                .select("*, votes:poll_votes(*)")
                .eq("id", pollId)
                .single();

            if (pollData) {
                setPoll(pollData);
                const myVote = pollData.votes?.find((v: PollVote) => v.user_id === user?.id);
                if (myVote) setUserVote(myVote.option_index);
            }
            setLoading(false);
        };

        fetchPollData();

        // Subscribe to votes
        const channel = supabase
            .channel(`poll-${pollId}`)
            .on("postgres_changes",
                { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` },
                () => fetchPollData()
            )
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "polls", filter: `id=eq.${pollId}` },
                () => fetchPollData()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [pollId, user?.id]);

    const handleVote = async (index: number) => {
        if (!user || poll?.is_closed || userVote !== null) return;

        setUserVote(index); // Optimistic UI
        await supabase.from("poll_votes").insert({
            poll_id: pollId,
            user_id: user.id,
            option_index: index
        });
    };

    const closePoll = async () => {
        if (!isAdmin) return;
        await supabase.from("polls").update({ is_closed: true }).eq("id", pollId);
    };

    if (loading || !poll) return <div className={styles.loading}>Loading poll...</div>;

    const totalVotes = poll.votes?.length || 0;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h4 className={styles.question}>{poll.question}</h4>
                {poll.is_closed && <span className={styles.closedBadge}>Closed</span>}
            </div>

            <div className={styles.options}>
                {poll.options.map((option, idx) => {
                    const optionVotes = poll.votes?.filter((v: PollVote) => v.option_index === idx).length || 0;
                    const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                    const isSelected = userVote === idx;

                    return (
                        <button
                            key={idx}
                            className={`${styles.option} ${isSelected ? styles.selected : ""} ${poll.is_closed ? styles.disabled : ""}`}
                            onClick={() => handleVote(idx)}
                            disabled={poll.is_closed || userVote !== null}
                        >
                            <div className={styles.optionContent}>
                                <div className={styles.optionText}>
                                    {option}
                                    {isSelected && <Check size={14} className={styles.check} />}
                                </div>
                                <span className={styles.percentage}>{percentage}%</span>
                            </div>
                            <div className={styles.progressContainer}>
                                <div className={styles.progressBar} style={{ width: `${percentage}%` }}></div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className={styles.footer}>
                <span className={styles.voteCount}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                {isAdmin && !poll.is_closed && (
                    <Button variant="outline" size="sm" onClick={closePoll}>Close Poll</Button>
                )}
            </div>
        </div>
    );
};
