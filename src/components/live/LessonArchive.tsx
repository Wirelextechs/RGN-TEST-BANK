"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Search, Calendar, ChevronRight, MessageCircle } from "lucide-react";
import { supabase, Lesson } from "@/lib/supabase";
import styles from "./LessonArchive.module.css";
import { Chat } from "./Chat";

interface LessonArchiveProps {
    userProfile: any;
}

export const LessonArchive = ({ userProfile }: LessonArchiveProps) => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [search, setSearch] = useState("");
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    useEffect(() => {
        fetchPastLessons();
    }, []);

    const fetchPastLessons = async () => {
        const { data } = await supabase
            .from('lessons')
            .select('*')
            .eq('status', 'completed')
            .order('ended_at', { ascending: false });
        if (data) setLessons(data);
    };

    const filteredLessons = lessons.filter(l =>
        l.topic.toLowerCase().includes(search.toLowerCase())
    );

    if (selectedLesson) {
        return (
            <div className={styles.viewer}>
                <div className={styles.viewerHeader}>
                    <button className={styles.backBtn} onClick={() => setSelectedLesson(null)}>
                        ← Back to Lessons
                    </button>
                    <div className={styles.viewerTitle}>
                        <h3>{selectedLesson.topic}</h3>
                        <span className={styles.date}>
                            Completed on {new Date(selectedLesson.ended_at!).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div className={styles.chatContainer}>
                    <Chat userProfile={userProfile} lessonId={selectedLesson.id} isArchive />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerInfo}>
                    <h2>Past Lessons Archive</h2>
                    <p>Revisit conversations and notes from previous sessions.</p>
                </div>
                <div className={styles.searchBar}>
                    <Search size={18} />
                    <Input
                        placeholder="Search by topic..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {filteredLessons.length === 0 ? (
                <div className={styles.empty}>
                    <MessageCircle size={48} />
                    <p>No past lessons found matching your search.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filteredLessons.map((lesson) => (
                        <Card key={lesson.id} className={styles.lessonItem} onClick={() => setSelectedLesson(lesson)}>
                            <div className={styles.lessonInfo}>
                                <div className={styles.topicRow}>
                                    <MessageCircle size={20} className={styles.icon} />
                                    <h4>{lesson.topic}</h4>
                                </div>
                                <div className={styles.meta}>
                                    <span><Calendar size={14} /> {new Date(lesson.ended_at!).toLocaleDateString()}</span>
                                    <span>{new Date(lesson.ended_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            < ChevronRight size={20} className={styles.arrow} />
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
