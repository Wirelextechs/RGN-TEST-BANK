"use client";

import { useAuth } from "@/hooks/useAuth";
import { Chat } from "@/components/live/Chat";
import { QuizGenerator } from "@/components/quiz/QuizGenerator";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
    LogOut,
    Users,
    FileEdit,
    LayoutDashboard,
    Video,
    Settings,
    Bell,
    Trophy,
    GraduationCap,
    School,
    User as UserIcon,
    Shield,
    BellRing,
    Hand,
    X
} from "lucide-react";
import styles from "./dashboard.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import Image from "next/image";

export default function DashboardPage() {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("live");
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [schoolStats, setSchoolStats] = useState<{ school: string, count: number }[]>([]);
    const [topStudents, setTopStudents] = useState<Profile[]>([]);
    const [allStudents, setAllStudents] = useState<Profile[]>([]);
    const [raisedHands, setRaisedHands] = useState<Profile[]>([]);
    const [notifications, setNotifications] = useState<Profile[]>([]);
    const prevHandsRef = useRef<Profile[]>([]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }

        if (profile) {
            const fetchData = () => {
                if (profile.role === "admin" || profile.role === "ta") {
                    if (profile.role === "admin") fetchSchoolStats();
                    fetchAllStudents();
                    fetchRaisedHands();
                }
                fetchTopStudents();
            };

            fetchData();

            // Real-time subscription for profile changes (Hand raising, Points, etc.)
            const profileChanges = supabase
                .channel('admin-dashboard-sync')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'profiles' },
                    () => {
                        // Re-fetch data on any profile change to keep dashboard live
                        fetchData();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(profileChanges);
            };
        }
    }, [user, loading, router, profile?.role, profile?.id]);

    const fetchSchoolStats = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('school')
            .not('school', 'is', null);

        if (data) {
            const stats = data.reduce((acc: any, curr: any) => {
                acc[curr.school] = (acc[curr.school] || 0) + 1;
                return acc;
            }, {});

            const sortedStats = Object.entries(stats)
                .map(([school, count]) => ({ school, count: count as number }))
                .sort((a, b) => b.count - a.count);

            setSchoolStats(sortedStats);
        }
        if (error) {
            console.error("Error fetching school stats:", error);
        }
    };

    const fetchTopStudents = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .order('points', { ascending: false })
            .limit(10);

        if (data) {
            setTopStudents(data);
        }
        if (error) {
            console.error("Error fetching top students:", error);
        }
    };

    const fetchAllStudents = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['student', 'ta'])
            .order('full_name', { ascending: true });

        if (data) {
            setAllStudents(data);
        }
        if (error) {
            console.error("Error fetching all students:", error);
        }
    };

    const fetchRaisedHands = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_hand_raised', true);

        if (data) {
            // Check for new hand raises specifically for notifications
            const currentIds = data.map(p => p.id);
            const prevIds = prevHandsRef.current.map(p => p.id);

            const newRaises = data.filter(p => !prevIds.includes(p.id));
            if (newRaises.length > 0 && isAdmin) {
                setNotifications(prev => [...prev, ...newRaises]);
                // Play notification sound
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                audio.play().catch(() => { }); // Browser might block auto-play

                // Auto-clear notification after 5 seconds
                newRaises.forEach(p => {
                    setTimeout(() => {
                        setNotifications(prev => prev.filter(n => n.id !== p.id));
                    }, 5000);
                });
            }

            prevHandsRef.current = data;
            setRaisedHands(data);
        }
        if (error) {
            console.error("Error fetching raised hands:", error);
        }
    };

    if (loading || !user || !profile) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>Verifying Session...</span>
            </div>
        );
    }

    if (profile.is_locked) {
        return (
            <div className={styles.loading}>
                <Shield size={48} color="var(--error)" />
                <h1 style={{ marginTop: '1rem' }}>Account Restricted</h1>
                <p style={{ maxWidth: '400px', textAlign: 'center', opacity: 0.8 }}>
                    Your access to the RGN Test Bank has been limited. Please contact support if you believe this is an error.
                </p>
                <Button onClick={signOut} variant="outline" style={{ marginTop: '1.5rem' }}>
                    Sign Out
                </Button>
            </div>
        );
    }

    const isAdmin = profile.role === "admin";
    const isTA = profile.role === "ta";
    const isStaff = isAdmin || isTA;

    return (
        <div className={styles.container}>
            {/* Hand Raise Notifications (Google Meet Style) */}
            {isAdmin && notifications.length > 0 && (
                <div className={styles.toastContainer}>
                    {notifications.map(student => (
                        <div key={student.id} className={styles.toast}>
                            <div className={styles.toastIcon}>
                                <Hand size={20} />
                            </div>
                            <div className={styles.toastContent}>
                                <strong>{student.full_name} raised a hand</strong>
                                <span>{student.school || "RGN Student"}</span>
                            </div>
                            <div className={styles.toastActions}>
                                {!student.is_unlocked && (
                                    <Button
                                        size="sm"
                                        className={styles.ackBtn}
                                        onClick={async () => {
                                            await supabase.from('profiles').update({ is_unlocked: true }).eq('id', student.id);
                                            fetchRaisedHands();
                                        }}
                                    >
                                        Unlock Chat
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    className={styles.ackBtn}
                                    style={{ background: 'transparent', border: '1px solid white' }}
                                    onClick={async () => {
                                        await supabase.from('profiles').update({ is_hand_raised: false }).eq('id', student.id);
                                        setNotifications(prev => prev.filter(n => n.id !== student.id));
                                        fetchRaisedHands();
                                    }}
                                >
                                    Lower
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    style={{ color: 'white', padding: '0.25rem' }}
                                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== student.id))}
                                >
                                    <X size={18} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    <Image src="/logo.jpg" alt="RGN Logo" width={32} height={32} className={styles.brandLogo} />
                    <span>RGN TEST BANK</span>
                </div>

                <nav className={styles.nav}>
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "overview" ? styles.active : ""}`}
                        onClick={() => setActiveTab("overview")}
                    >
                        <LayoutDashboard size={20} />
                        <span>Overview</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "live" ? styles.active : ""}`}
                        onClick={() => setActiveTab("live")}
                    >
                        <Video size={20} />
                        <span>Live Class</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "quizzes" ? styles.active : ""}`}
                        onClick={() => setActiveTab("quizzes")}
                    >
                        <FileEdit size={20} />
                        <span>Quizzes</span>
                    </Button>
                    {isStaff && (
                        <>
                            <Button
                                variant="ghost"
                                className={`${styles.navItem} ${activeTab === "students" ? styles.active : ""}`}
                                onClick={() => setActiveTab("students")}
                            >
                                <Users size={20} />
                                <span>Students</span>
                            </Button>
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    className={`${styles.navItem} ${activeTab === "impact" ? styles.active : ""}`}
                                    onClick={() => setActiveTab("impact")}
                                >
                                    <School size={20} />
                                    <span>Impact</span>
                                </Button>
                            )}
                        </>
                    )}
                </nav>

                <div className={styles.sidebarFooter}>
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "settings" ? styles.active : ""}`}
                        onClick={() => setActiveTab("settings")}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </Button>
                    <Button variant="ghost" className={styles.navItem} onClick={signOut}>
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </Button>
                </div>
            </aside>

            <nav className={styles.mobileNav}>
                <Button
                    variant="ghost"
                    className={`${styles.navItem} ${activeTab === "overview" ? styles.active : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    <LayoutDashboard size={20} />
                </Button>
                <Button
                    variant="ghost"
                    className={`${styles.navItem} ${activeTab === "live" ? styles.active : ""}`}
                    onClick={() => setActiveTab("live")}
                >
                    <Video size={20} />
                </Button>
                <Button
                    variant="ghost"
                    className={`${styles.navItem} ${activeTab === "quizzes" ? styles.active : ""}`}
                    onClick={() => setActiveTab("quizzes")}
                >
                    <FileEdit size={20} />
                </Button>
                {isStaff && (
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "students" ? styles.active : ""}`}
                        onClick={() => setActiveTab("students")}
                    >
                        <Users size={20} />
                    </Button>
                )}
                {isAdmin && (
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "impact" ? styles.active : ""}`}
                        onClick={() => setActiveTab("impact")}
                    >
                        <School size={20} />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    className={`${styles.navItem} ${activeTab === "settings" ? styles.active : ""}`}
                    onClick={() => setActiveTab("settings")}
                >
                    <Settings size={20} />
                </Button>
            </nav>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.headerInfo}>
                        <h1>{isAdmin ? "Admin Control Center" : isTA ? "T.A. Dashboard" : "Live Interactive Session"}</h1>
                        <p>Welcome back, {profile.full_name}</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Button variant="outline" size="sm" className={styles.iconBtn}>
                            <Bell size={20} />
                        </Button>
                        <div className={styles.avatar}>
                            {profile.full_name.substring(0, 1)}
                        </div>
                    </div>
                </header>

                <div className={styles.contentGrid}>
                    <div className={styles.leftCol}>
                        {activeTab === "live" && (
                            isAdmin ? (
                                <div className={styles.adminTools}>
                                    <QuizGenerator />
                                    <Card className={styles.activityCard} title="Top 10 Active Students">
                                        <div className={styles.rankingList}>
                                            {topStudents.map((student, index) => (
                                                <div key={student.id} className={styles.rankingItem}>
                                                    <div className={styles.rankBadge}>
                                                        {index === 0 ? <Trophy size={16} color="#FFD700" /> : index + 1}
                                                    </div>
                                                    <div className={styles.studentInfo}>
                                                        <span className={styles.studentName}>{student.full_name}</span>
                                                        <span className={styles.studentSchool}>{student.school}</span>
                                                    </div>
                                                    <span className={styles.points}>{student.points} pts</span>
                                                </div>
                                            ))}
                                            {topStudents.length === 0 && (
                                                <div className={styles.noData}>No rankings yet</div>
                                            )}
                                        </div>
                                    </Card>

                                    {raisedHands.length > 0 && (
                                        <Card className={styles.handRaisedCard} title="Students with Hands Raised ✋">
                                            <div className={styles.handList}>
                                                {raisedHands.map(student => (
                                                    <div key={student.id} className={styles.handItem}>
                                                        <div className={styles.avatar}>
                                                            {student.full_name.substring(0, 1)}
                                                        </div>
                                                        <div className={styles.studentInfo}>
                                                            <span className={styles.studentName}>{student.full_name}</span>
                                                            <span className={styles.studentSchool}>{student.school}</span>
                                                        </div>
                                                        <div className={styles.toastActions} style={{ gap: '0.5rem' }}>
                                                            {!student.is_unlocked ? (
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        await supabase.from('profiles').update({ is_unlocked: true }).eq('id', student.id);
                                                                        fetchRaisedHands();
                                                                    }}
                                                                >
                                                                    Unlock
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled
                                                                    style={{ opacity: 0.7 }}
                                                                >
                                                                    Unlocked
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    await supabase.from('profiles').update({ is_hand_raised: false }).eq('id', student.id);
                                                                    fetchRaisedHands();
                                                                }}
                                                            >
                                                                Lower
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={styles.lowerAllBtn}
                                                onClick={async () => {
                                                    const ids = raisedHands.map(h => h.id);
                                                    await supabase.from('profiles').update({ is_hand_raised: false }).in('id', ids);
                                                    fetchRaisedHands();
                                                }}
                                            >
                                                Lower All Hands
                                            </Button>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <div className={styles.studentView}>
                                    <Card className={styles.videoPlayer}>
                                        <div className={styles.videoOverlay}>
                                            <div className={styles.liveBadge}>LIVE</div>
                                            <span>RGN Live Prep</span>
                                        </div>
                                        <div className={styles.placeholderIcon}>
                                            <Video size={64} />
                                        </div>
                                    </Card>

                                    <div className={styles.stats}>
                                        <Card glass className={styles.statCard}>
                                            <Users size={24} color="var(--primary)" />
                                            <div>
                                                <h4>128</h4>
                                                <span>Online Students</span>
                                            </div>
                                        </Card>
                                        <Card glass className={styles.statCard}>
                                            <Trophy size={24} color="#FFD700" />
                                            <div>
                                                <h4>#1 Ranking</h4>
                                                <span>{topStudents[0]?.full_name || "---"}</span>
                                            </div>
                                        </Card>
                                    </div>

                                    <div style={{ marginTop: '1.5rem' }}>
                                        <Card title="Global Leaderboard (Top 10)">
                                            <div className={styles.rankingList}>
                                                {topStudents.map((student, index) => (
                                                    <div key={student.id} className={styles.rankingItem}>
                                                        <div className={styles.rankBadge}>
                                                            {index === 0 ? <Trophy size={16} color="#FFD700" /> : index + 1}
                                                        </div>
                                                        <div className={styles.studentInfo}>
                                                            <span className={styles.studentName}>{student.full_name}</span>
                                                            <span className={styles.studentSchool}>{student.school}</span>
                                                        </div>
                                                        <span className={styles.points}>{student.points} pts</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            )
                        )}

                        {activeTab === "quizzes" && (
                            <div className={styles.quizSection}>
                                <QuizPlayer quiz={[]} />
                            </div>
                        )}

                        {activeTab === "overview" && (
                            <div className={styles.overviewSection}>
                                <div className={styles.stats}>
                                    <Card glass className={styles.statCard}>
                                        <Users size={24} color="var(--primary)" />
                                        <div>
                                            <h4>{isAdmin ? allStudents.length : "128"}</h4>
                                            <span>{isAdmin ? "Total Registered Students" : "Online Students"}</span>
                                        </div>
                                    </Card>
                                    <Card glass className={styles.statCard}>
                                        <Trophy size={24} color="#FFD700" />
                                        <div>
                                            <h4>#{topStudents.findIndex(s => s.id === profile.id) + 1 || "---"}</h4>
                                            <span>Your Global Rank</span>
                                        </div>
                                    </Card>
                                </div>
                                <Card title="Course Progress">
                                    <p>Your overall progress in RGN Preparation: {isAdmin ? "Platform Active" : "65%"}</p>
                                </Card>
                            </div>
                        )}

                        {activeTab === "students" && isAdmin && (
                            <Card title={`Registered Students (${allStudents.length})`}>
                                <div className={styles.studentList}>
                                    {allStudents.map(student => (
                                        <div key={student.id} className={styles.rankingItem}>
                                            <div className={styles.avatar}>
                                                {student.full_name.substring(0, 1)}
                                            </div>
                                            <div className={styles.studentInfo}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span className={styles.studentName}>{student.full_name}</span>
                                                    <span className={`${styles.roleBadge} ${student.role === 'ta' ? styles.taBadge : styles.studentBadge}`}>
                                                        {student.role === 'ta' ? 'T.A.' : 'Student'}
                                                    </span>
                                                </div>
                                                <span className={styles.studentSchool}>{student.school}</span>
                                            </div>
                                            <div className={styles.studentRole}>
                                                <span className={styles.points}>{student.points} pts</span>
                                                {isAdmin && student.id !== profile.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={student.role === 'student' ? styles.promoteBtn : styles.demoteBtn}
                                                        disabled={updatingUserId === student.id}
                                                        onClick={async () => {
                                                            setUpdatingUserId(student.id);
                                                            const newRole = student.role === 'student' ? 'ta' : 'student';
                                                            const { error } = await supabase
                                                                .from('profiles')
                                                                .update({ role: newRole })
                                                                .eq('id', student.id);

                                                            if (error) {
                                                                console.error("Promotion error:", error);
                                                                alert(`Could not update role. This is likely due to a database constraint. Please check your Supabase SQL Editor.`);
                                                            } else {
                                                                fetchAllStudents();
                                                            }
                                                            setUpdatingUserId(null);
                                                        }}
                                                    >
                                                        {student.role === 'student' ? "Promote to T.A." : "Demote"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {allStudents.length === 0 && (
                                        <p className={styles.noData}>No students registered yet.</p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {activeTab === "impact" && isAdmin && (
                            <div className={styles.impactSection}>
                                <Card title="Platform Impact by School">
                                    <div className={styles.statsGrid}>
                                        {schoolStats.length > 0 ? (
                                            schoolStats.map((stat, index) => (
                                                <div key={index} className={styles.impactCard}>
                                                    <div className={styles.impactInfo}>
                                                        <GraduationCap size={24} className={styles.impactIcon} />
                                                        <div className={styles.impactDetails}>
                                                            <span className={styles.schoolName}>{stat.school}</span>
                                                            <span className={styles.studentCount}>{stat.count} {stat.count === 1 ? 'Student' : 'Students'}</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.impactBar}>
                                                        <div
                                                            className={styles.impactProgress}
                                                            style={{ width: `${(stat.count / schoolStats[0].count) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className={styles.noData}>No data available yet</div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {activeTab === "settings" && (
                            <div className={styles.overviewSection}>
                                <Card title="Account Settings">
                                    <div className={styles.settingsGrid}>
                                        <div className={styles.settingsItem}>
                                            <div className={styles.settingsIcon}>
                                                <UserIcon size={20} />
                                            </div>
                                            <div className={styles.settingsInfo}>
                                                <label>Full Name</label>
                                                <p>{profile.full_name}</p>
                                            </div>
                                        </div>
                                        <div className={styles.settingsItem}>
                                            <div className={styles.settingsIcon}>
                                                <School size={20} />
                                            </div>
                                            <div className={styles.settingsInfo}>
                                                <label>School</label>
                                                <p>{profile.school || "Not Specified"}</p>
                                            </div>
                                        </div>
                                        <div className={styles.settingsItem}>
                                            <div className={styles.settingsIcon}>
                                                <Shield size={20} />
                                            </div>
                                            <div className={styles.settingsInfo}>
                                                <label>Account Role</label>
                                                <p style={{ textTransform: 'capitalize' }}>{profile.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <Card title="Preferences">
                                        <div className={styles.settingsGrid}>
                                            <div className={styles.settingsItem}>
                                                <div className={styles.settingsIcon}>
                                                    <BellRing size={20} />
                                                </div>
                                                <div className={styles.settingsInfo}>
                                                    <label>Notifications</label>
                                                    <p>In-app alerts are enabled</p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                <div style={{ marginTop: '2rem' }}>
                                    <Button variant="error" onClick={signOut} style={{ width: '100%' }}>
                                        <LogOut size={18} style={{ marginRight: '0.5rem' }} />
                                        Log Out from this Device
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.chatSection}>
                        <Chat userProfile={profile} isAdmin={isAdmin} isTA={isTA} />
                    </div>
                </div>
            </main>
        </div>
    );
}
