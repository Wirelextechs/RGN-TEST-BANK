"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Calendar, Clock, Plus, Play, StopCircle, CheckCircle, Trash2 } from "lucide-react";
import { supabase, Lesson, Profile } from "@/lib/supabase";
import styles from "./LessonManager.module.css";

interface LessonManagerProps {
    userProfile: Profile;
}

export const LessonManager = ({ userProfile }: LessonManagerProps) => {
    const [topic, setTopic] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchLessons();

        // Refresh status every minute to catch transitions from scheduled to live
        const timer = setInterval(() => {
            setLessons(prev => [...prev]); // Trigger re-render to check current time
        }, 60000);

        // Subscribe to lesson changes
        const channel = supabase
            .channel('lesson-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => {
                fetchLessons();
            })
            .subscribe();

        return () => {
            clearInterval(timer);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchLessons = async () => {
        const { data } = await supabase
            .from('lessons')
            .select('*')
            .order('scheduled_at', { ascending: false });
        if (data) setLessons(data);
    };

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic || !date || !time) return;

        setIsLoading(true);
        const scheduledAt = new Date(`${date}T${time}`).toISOString();

        const { error } = await supabase.from('lessons').insert({
            topic,
            scheduled_at: scheduledAt,
            created_by: userProfile.id,
            status: 'scheduled'
        });

        if (!error) {
            setTopic("");
            setDate("");
            setTime("");
            fetchLessons();
        } else {
            console.error("Error scheduling lesson:", error);
            alert("Failed to schedule lesson.");
        }
        setIsLoading(false);
    };

    const updateStatus = async (lessonId: string, status: 'live' | 'completed') => {
        try {
            const updates: any = { status };
            if (status === 'live') updates.started_at = new Date().toISOString();
            if (status === 'completed') updates.ended_at = new Date().toISOString();

            const { error } = await supabase
                .from('lessons')
                .update(updates)
                .eq('id', lessonId);

            if (error) throw error;
            fetchLessons();
        } catch (err: any) {
            console.error("Error updating lesson status:", err);
            alert(`Failed to update lesson: ${err.message || 'Unknown error'}`);
        }
    };

    const deleteLesson = async (lessonId: string) => {
        if (!confirm("Are you sure you want to delete this lesson? This action cannot be undone and will remove all associated messages.")) return;

        try {
            const { error } = await supabase
                .from('lessons')
                .delete()
                .eq('id', lessonId);

            if (error) throw error;
            fetchLessons();
        } catch (err: any) {
            console.error("Error deleting lesson:", err);
            alert(`Failed to delete lesson: ${err.message || 'Unknown error'}`);
        }
    };

    return (
        <div className={styles.container}>
            <Card title="Schedule New Lesson" className={styles.scheduleCard}>
                <form onSubmit={handleSchedule} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label>Topic Name</label>
                        <Input
                            placeholder="e.g. Introduction to Pharmacology"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>Date</label>
                            <div className={styles.iconInput}>
                                <Calendar size={16} />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Time</label>
                            <div className={styles.iconInput}>
                                <Clock size={16} />
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <Button type="submit" isLoading={isLoading} className={styles.submitBtn}>
                        <Plus size={18} /> Schedule Lesson
                    </Button>
                </form>
            </Card>

            <div className={styles.lessonList}>
                <h3 className={styles.listTitle}>All Scheduled Lessons</h3>
                {lessons.length === 0 ? (
                    <p className={styles.empty}>No lessons scheduled yet.</p>
                ) : (
                    <div className={styles.grid}>
                        {lessons.map((lesson) => {
                            const isPastDue = lesson.status === 'scheduled' && new Date(lesson.scheduled_at) <= new Date();
                            const isEffectivelyLive = lesson.status === 'live' || isPastDue;

                            return (
                                <Card key={lesson.id} className={`${styles.lessonCard} ${styles[lesson.status]} ${isPastDue ? styles.live : ''}`}>
                                    <div className={styles.lessonInfo}>
                                        <h4>{lesson.topic}</h4>
                                        <div className={styles.meta}>
                                            <span><Calendar size={14} /> {new Date(lesson.scheduled_at).toLocaleDateString()}</span>
                                            <span><Clock size={14} /> {new Date(lesson.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className={styles.statusBadge}>
                                            {isPastDue ? 'LIVE (AUTO)' : lesson.status.toUpperCase()}
                                        </div>
                                    </div>
                                    <div className={styles.actions}>
                                        <div className={styles.primaryActions}>
                                            {lesson.status === 'scheduled' && !isPastDue && (
                                                <Button variant="primary" size="sm" onClick={() => updateStatus(lesson.id, 'live')}>
                                                    <Play size={14} /> Start Now
                                                </Button>
                                            )}
                                            {isEffectivelyLive && (
                                                <Button variant="error" size="sm" onClick={() => updateStatus(lesson.id, 'completed')}>
                                                    <StopCircle size={14} /> End Class
                                                </Button>
                                            )}
                                            {lesson.status === 'completed' && (
                                                <div className={styles.completedInfo}>
                                                    <CheckCircle size={16} color="var(--success)" /> Managed
                                                </div>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => deleteLesson(lesson.id)} className={styles.deleteBtn}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
