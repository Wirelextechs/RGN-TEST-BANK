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
    Trophy
} from "lucide-react";
import styles from "./dashboard.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function DashboardPage() {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("live");

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

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
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === "students" ? styles.active : ""}`}
                            onClick={() => setActiveTab("students")}
                        >
                            <Users size={20} />
                            <span>Students</span>
                        </Button>
                    )}
                </nav>

                <div className={styles.sidebarFooter}>
                    <Button variant="ghost" className={styles.navItem}>
                        <Settings size={20} />
                        <span>Settings</span>
                    </Button>
                    <Button variant="ghost" className={styles.navItem} onClick={signOut}>
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </Button>
                </div>
            </aside>

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
                                    <Card className={styles.activityCard} title="Class Activity Rankings">
                                        <div className={styles.rankingList}>
                                            <div className={styles.rankingItem}>
                                                <Trophy size={20} color="#FFD700" />
                                                <span>Kwadwo Mensah</span>
                                                <span className={styles.points}>42 pts</span>
                                            </div>
                                            <div className={styles.rankingItem}>
                                                <Trophy size={20} color="#C0C0C0" />
                                                <span>Ama Serwaa</span>
                                                <span className={styles.points}>38 pts</span>
                                            </div>
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
                                                <span>Kwadwo Mensah</span>
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
                    </div>

                    <div className={styles.chatSection}>
                        <Chat userProfile={profile} isAdmin={isAdmin} />
                    </div>
                </div>
            </main>
        </div>
    );
}
