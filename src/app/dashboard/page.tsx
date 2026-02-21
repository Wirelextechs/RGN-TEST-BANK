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
    BellRing
} from "lucide-react";
import styles from "./dashboard.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabase";
import Image from "next/image";

export default function DashboardPage() {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("live");
    const [schoolStats, setSchoolStats] = useState<{ school: string, count: number }[]>([]);
    const [topStudents, setTopStudents] = useState<Profile[]>([]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }

        if (profile?.role === "admin") {
            fetchSchoolStats();
        }
        fetchTopStudents();
    }, [user, loading, router, profile]);

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
    };

    if (loading || !user || !profile) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>Verifying Session...</span>
            </div>
        );
    }

    const isAdmin = profile.role === "admin";

    return (
        <div className={styles.container}>
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
                    {isAdmin && (
                        <>
                            <Button
                                variant="ghost"
                                className={`${styles.navItem} ${activeTab === "students" ? styles.active : ""}`}
                                onClick={() => setActiveTab("students")}
                            >
                                <Users size={20} />
                                <span>Students</span>
                            </Button>
                            <Button
                                variant="ghost"
                                className={`${styles.navItem} ${activeTab === "impact" ? styles.active : ""}`}
                                onClick={() => setActiveTab("impact")}
                            >
                                <School size={20} />
                                <span>Impact</span>
                            </Button>
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
                {isAdmin && (
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
                        <h1>{isAdmin ? "Admin Control Center" : "Live Interactive Session"}</h1>
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
                                <Card title="Course Progress">
                                    <p>Your overall progress in RGN Preparation: 65%</p>
                                </Card>
                            </div>
                        )}

                        {activeTab === "students" && isAdmin && (
                            <Card title="Student Management">
                                <p>Manage your students and their progress here.</p>
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
                        <Chat userProfile={profile} isAdmin={isAdmin} />
                    </div>
                </div>
            </main>
        </div>
    );
}
