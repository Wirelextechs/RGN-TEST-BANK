"use client";

import { useAuth } from "@/hooks/useAuth";
import { Chat } from "@/components/live/Chat";
import { QuizGenerator } from "@/components/quiz/QuizGenerator";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { LessonManager } from "@/components/live/LessonManager";
import { LessonArchive } from "@/components/live/LessonArchive";
import { AdminInbox, useUnreadDMCount } from "@/components/live/AdminInbox";
import { DirectChat } from "@/components/live/DirectChat";
import { StudyGroupChat } from "@/components/live/StudyGroupChat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { NURSING_SCHOOLS } from "@/lib/schools";
import { NURSING_COURSES } from "@/lib/courses";
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
    X,
    MessageCircle,
    Download,
    CreditCard,
    Crown,
    UserPlus,
    Send
} from "lucide-react";
import styles from "./dashboard.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import Image from "next/image";

export default function DashboardPage() {
    const { user, profile, loading, onlineCount, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("live");
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [schoolStats, setSchoolStats] = useState<{ school: string, count: number }[]>([]);
    const [topStudents, setTopStudents] = useState<Profile[]>([]);
    const [allStudents, setAllStudents] = useState<Profile[]>([]);
    const [raisedHands, setRaisedHands] = useState<Profile[]>([]);
    const [notifications, setNotifications] = useState<Profile[]>([]);
    const prevHandsRef = useRef<Profile[]>([]);
    const unreadDMCount = useUnreadDMCount();

    // Admin Create Student state
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentPassword, setNewStudentPassword] = useState("");
    const [newStudentPhone, setNewStudentPhone] = useState("");
    const [newStudentSchool, setNewStudentSchool] = useState("");
    const [creatingStudent, setCreatingStudent] = useState(false);
    const [createStudentMsg, setCreateStudentMsg] = useState("");

    // Admin find admin IDs for student DM
    const [adminUsers, setAdminUsers] = useState<Profile[]>([]);

    // SMS Alert state
    const [smsMessage, setSmsMessage] = useState("");
    const [sendingSMS, setSendingSMS] = useState(false);
    const [smsResult, setSmsResult] = useState("");

    // Platform settings
    const [paywallEnabled, setPaywallEnabled] = useState(false);
    const [premiumPrice, setPremiumPrice] = useState(50);
    const [allPayments, setAllPayments] = useState<any[]>([]);
    const [savingSettings, setSavingSettings] = useState(false);

    // Search states
    const [studentSearch, setStudentSearch] = useState("");
    const [premiumSearch, setPremiumSearch] = useState("");

    // Student profile edit state
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editCourse, setEditCourse] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);

    // Fetch admin users for student "Chat Admin" tab
    useEffect(() => {
        if (!user || !profile) return;
        if (profile.role === "student") {
            supabase.from("profiles").select("id, full_name, role").eq("role", "admin").then(({ data }) => {
                if (data) setAdminUsers(data as Profile[]);
            });
        }
    }, [user, profile?.role]);

    // Fetch platform settings and payments for admin
    useEffect(() => {
        if (!user || !profile || profile.role !== "admin") return;
        const fetchSettings = async () => {
            const { data: settings } = await supabase.from("platform_settings").select("*");
            if (settings) {
                settings.forEach((s: any) => {
                    if (s.key === "paywall_enabled") setPaywallEnabled(s.value === true || s.value === "true");
                    if (s.key === "premium_price") setPremiumPrice(Number(s.value) || 50);
                });
            }
            const { data: payments } = await supabase.from("payments").select("*, profiles:user_id(full_name, school)").order("created_at", { ascending: false });
            if (payments) setAllPayments(payments);
        };
        fetchSettings();
    }, [user, profile?.role]);

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
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === 'messages' ? styles.active : ''}`}
                            onClick={() => setActiveTab('messages')}
                        >
                            <MessageCircle size={20} />
                            <span>Messages</span>
                            {unreadDMCount > 0 && <span className={styles.navBadge}>{unreadDMCount}</span>}
                        </Button>
                    )}
                    {!isStaff && (
                        <>
                            <Button
                                variant="ghost"
                                className={`${styles.navItem} ${activeTab === 'chat-admin' ? styles.active : ''}`}
                                onClick={() => setActiveTab('chat-admin')}
                            >
                                <MessageCircle size={20} />
                                <span>Chat Admin</span>
                            </Button>
                            <Button
                                variant="ghost"
                                className={`${styles.navItem} ${activeTab === 'study-group' ? styles.active : ''}`}
                                onClick={() => setActiveTab('study-group')}
                            >
                                <Users size={20} />
                                <span>Study Group</span>
                            </Button>
                        </>
                    )}
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === 'lessons' ? styles.active : ''}`}
                        onClick={() => setActiveTab('lessons')}
                    >
                        <GraduationCap size={20} />
                        <span>Past Lessons</span>
                    </Button>
                    {isStaff && (
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === 'schedule' ? styles.active : ''}`}
                            onClick={() => setActiveTab('schedule')}
                        >
                            <Shield size={20} />
                            <span>Schedule</span>
                        </Button>
                    )}
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === 'payments' ? styles.active : ''}`}
                            onClick={() => setActiveTab('payments')}
                        >
                            <CreditCard size={20} />
                            <span>Payments</span>
                        </Button>
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
                    className={`${styles.navItem} ${activeTab === "lessons" ? styles.active : ""}`}
                    onClick={() => setActiveTab("lessons")}
                >
                    <GraduationCap size={20} />
                </Button>
                {isStaff && (
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "schedule" ? styles.active : ""}`}
                        onClick={() => setActiveTab("schedule")}
                    >
                        <Shield size={20} />
                    </Button>
                )}
                {isAdmin && (
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "messages" ? styles.active : ""}`}
                        onClick={() => setActiveTab("messages")}
                    >
                        <MessageCircle size={20} />
                    </Button>
                )}
                {!isStaff && (
                    <>
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === "chat-admin" ? styles.active : ""}`}
                            onClick={() => setActiveTab("chat-admin")}
                        >
                            <MessageCircle size={20} />
                        </Button>
                        <Button
                            variant="ghost"
                            className={`${styles.navItem} ${activeTab === "study-group" ? styles.active : ""}`}
                            onClick={() => setActiveTab("study-group")}
                        >
                            <Users size={20} />
                        </Button>
                    </>
                )}
                {isAdmin && (
                    <Button
                        variant="ghost"
                        className={`${styles.navItem} ${activeTab === "payments" ? styles.active : ""}`}
                        onClick={() => setActiveTab("payments")}
                    >
                        <CreditCard size={20} />
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
                            isStaff ? (
                                <div className={styles.adminTools}>
                                    <div className={styles.videoPlayer}>
                                        <div className={styles.videoOverlay}>
                                            <div className={styles.liveBadge}>LIVE</div>
                                            <span>Staff Monitor</span>
                                        </div>
                                        <div className={styles.placeholderIcon}>
                                            <Video size={64} />
                                        </div>
                                    </div>
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
                                                                        console.log('Unlock clicked for', student.id);
                                                                        const { error } = await supabase.from('profiles').update({ is_unlocked: true }).eq('id', student.id);
                                                                        if (error) { console.error('Unlock error:', error); alert('Unlock failed: ' + error.message); }
                                                                        else { console.log('Unlock success'); fetchRaisedHands(); }
                                                                    }}
                                                                >
                                                                    Unlock
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        console.log('Relock clicked for', student.id);
                                                                        const { error } = await supabase.from('profiles').update({ is_unlocked: false }).eq('id', student.id);
                                                                        if (error) { console.error('Relock error:', error); alert('Relock failed: ' + error.message); }
                                                                        else { console.log('Relock success'); fetchRaisedHands(); }
                                                                    }}
                                                                >
                                                                    Relock
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    console.log('Lower hand clicked for', student.id);
                                                                    const { error } = await supabase.from('profiles').update({ is_hand_raised: false }).eq('id', student.id);
                                                                    if (error) { console.error('Lower error:', error); alert('Lower failed: ' + error.message); }
                                                                    else { console.log('Lower success'); fetchRaisedHands(); }
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
                                                    console.log('Lower All Hands clicked');
                                                    const ids = raisedHands.map(h => h.id);
                                                    const { error } = await supabase.from('profiles').update({ is_hand_raised: false }).in('id', ids);
                                                    if (error) { console.error('Lower All error:', error); alert('Lower All failed: ' + error.message); }
                                                    else { console.log('Lower All success'); fetchRaisedHands(); }
                                                }}
                                            >
                                                Lower All Hands
                                            </Button>
                                        </Card>
                                    )}

                                    {/* SMS Alert Card */}
                                    <Card className={styles.activityCard} title="📱 Send SMS Alert">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <textarea
                                                value={smsMessage}
                                                onChange={e => setSmsMessage(e.target.value)}
                                                placeholder="Type your SMS message here... (e.g. Class starting in 10 mins!)"
                                                rows={3}
                                                style={{
                                                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                                                    border: '1px solid var(--border)', background: 'var(--background)',
                                                    color: 'var(--foreground)', fontSize: '0.85rem', resize: 'vertical',
                                                    fontFamily: 'inherit'
                                                }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                                                    Sends to all students with phone numbers
                                                </span>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={!smsMessage.trim() || sendingSMS}
                                                    onClick={async () => {
                                                        setSendingSMS(true);
                                                        setSmsResult('');
                                                        try {
                                                            const res = await fetch('/api/sms/send', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ message: smsMessage })
                                                            });
                                                            const data = await res.json();
                                                            if (data.success) {
                                                                setSmsResult(`✅ Sent to ${data.recipientCount} students`);
                                                                setSmsMessage('');
                                                            } else {
                                                                setSmsResult(`❌ ${data.error || data.message}`);
                                                            }
                                                        } catch (err: any) {
                                                            setSmsResult(`❌ ${err.message}`);
                                                        }
                                                        setSendingSMS(false);
                                                    }}
                                                >
                                                    <Send size={14} style={{ marginRight: '0.3rem' }} />
                                                    {sendingSMS ? 'Sending...' : 'Send SMS'}
                                                </Button>
                                            </div>
                                            {smsResult && (
                                                <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>{smsResult}</p>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            ) : (
                                <div className={styles.studentView}>
                                    <>
                                        <div className={styles.videoPlayer}>
                                            <div className={styles.videoOverlay}>
                                                <div className={styles.liveBadge}>LIVE</div>
                                                <span>RGN Live Prep</span>
                                            </div>
                                            <div className={styles.placeholderIcon}>
                                                <Video size={64} />
                                            </div>
                                        </div>

                                        <div className={styles.stats}>
                                            <Card glass className={styles.statCard}>
                                                <Users size={24} color="var(--primary)" />
                                                <div>
                                                    <h4>{onlineCount}</h4>
                                                    <span>Online Now</span>
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
                                    </>
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
                                            <h4>{onlineCount}</h4>
                                            <span>Online Now</span>
                                        </div>
                                    </Card>
                                    <Card glass className={styles.statCard}>
                                        <Users size={24} color="var(--primary)" />
                                        <div>
                                            <h4>{isAdmin ? allStudents.length : allStudents.length || "---"}</h4>
                                            <span>{isAdmin ? "Total Registered Students" : "Total Students"}</span>
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
                            <div>
                                {/* Create Student + Export Actions */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setCreatingStudent(!creatingStudent)}
                                    >
                                        <UserPlus size={16} style={{ marginRight: '0.5rem' }} />
                                        {creatingStudent ? 'Cancel' : 'Create Student'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const csv = ['Name,Email,Phone,School,Role,Premium,Points',
                                                ...allStudents.map(s => `"${s.full_name}","","${s.phone_number || ''}","${s.school || ''}","${s.role}","${s.is_premium ? 'Yes' : 'No'}","${s.points}"`)
                                            ].join('\n');
                                            const blob = new Blob([csv], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url; a.download = 'rgn_students.csv'; a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                    >
                                        <Download size={16} style={{ marginRight: '0.5rem' }} />
                                        Export CSV
                                    </Button>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <Input
                                            placeholder="Search by name, email, or phone..."
                                            value={studentSearch}
                                            onChange={(e) => setStudentSearch(e.target.value)}
                                            style={{ marginBottom: 0 }}
                                        />
                                    </div>
                                </div>

                                {/* Create Student Form */}
                                {creatingStudent && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <Card title="Create Student Account">
                                            <form onSubmit={async (e) => {
                                                e.preventDefault();
                                                setCreateStudentMsg('');
                                                try {
                                                    const res = await fetch('/api/admin/create-student', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            full_name: newStudentName,
                                                            email: newStudentEmail,
                                                            password: newStudentPassword,
                                                            phone_number: newStudentPhone,
                                                            school: newStudentSchool
                                                        })
                                                    });
                                                    const data = await res.json();
                                                    if (data.error) throw new Error(data.error);
                                                    setCreateStudentMsg(`✅ ${data.message}`);
                                                    setNewStudentName(''); setNewStudentEmail(''); setNewStudentPassword(''); setNewStudentPhone(''); setNewStudentSchool('');
                                                } catch (err: any) {
                                                    setCreateStudentMsg(`❌ ${err.message}`);
                                                }
                                            }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                <Input label="Full Name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                                                <Input label="Email" type="email" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} required />
                                                <Input label="Password" type="password" value={newStudentPassword} onChange={e => setNewStudentPassword(e.target.value)} required />
                                                <Input label="Phone Number" type="tel" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} />
                                                <SearchableSelect
                                                    label="School"
                                                    options={NURSING_SCHOOLS}
                                                    value={newStudentSchool}
                                                    onChange={setNewStudentSchool}
                                                    placeholder="Select school..."
                                                />
                                                {createStudentMsg && <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{createStudentMsg}</p>}
                                                <Button type="submit" variant="primary">Create Account</Button>
                                            </form>
                                        </Card>
                                    </div>
                                )}
                                <Card title={`Registered Students (${allStudents.length})`}>
                                    <div className={styles.studentList}>
                                        {allStudents
                                            .filter(s => {
                                                const term = studentSearch.toLowerCase();
                                                const nameMatch = s.full_name?.toLowerCase().includes(term) || false;
                                                const phoneMatch = s.phone_number?.toLowerCase().includes(term) || false;
                                                const emailMatch = s.email?.toLowerCase().includes(term) || false;
                                                return nameMatch || phoneMatch || emailMatch;
                                            })
                                            .map(student => (
                                                <div key={student.id} className={styles.rankingItem}>
                                                    <div className={styles.avatar}>
                                                        {student.full_name.substring(0, 1)}
                                                    </div>
                                                    <div className={styles.studentInfo}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <span className={styles.studentName}>{student.full_name}</span>
                                                            {student.is_premium && <Crown size={14} style={{ color: '#FFD700' }} />}
                                                            <span className={`${styles.roleBadge} ${student.role === 'admin' ? styles.adminBadge : student.role === 'ta' ? styles.taBadge : styles.studentBadge}`}>
                                                                {student.role === 'admin' ? 'Admin' : student.role === 'ta' ? 'T.A.' : 'Student'}
                                                            </span>
                                                        </div>
                                                        <span className={styles.studentSchool}>{student.school}</span>
                                                    </div>
                                                    <div className={styles.studentRole}>
                                                        <span className={styles.points}>{student.points} pts</span>
                                                        {isAdmin && student.id !== profile.id && (
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className={student.is_unlocked ? styles.demoteBtn : styles.promoteBtn}
                                                                    disabled={updatingUserId === student.id}
                                                                    onClick={async () => {
                                                                        setUpdatingUserId(student.id);
                                                                        const { error } = await supabase
                                                                            .from('profiles')
                                                                            .update({ is_unlocked: !student.is_unlocked })
                                                                            .eq('id', student.id);

                                                                        if (error) {
                                                                            console.error('Unlock/Relock error:', error);
                                                                            alert('Unlock/Relock failed: ' + error.message);
                                                                        } else {
                                                                            fetchAllStudents();
                                                                        }
                                                                        setUpdatingUserId(null);
                                                                    }}
                                                                >
                                                                    {student.is_unlocked ? "Relock" : "Unlock"}
                                                                </Button>
                                                                {student.role !== 'admin' && (
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
                                                                                alert(`Could not update role: ${error.message}`);
                                                                            } else {
                                                                                fetchAllStudents();
                                                                            }
                                                                            setUpdatingUserId(null);
                                                                        }}
                                                                    >
                                                                        {student.role === 'student' ? "→ T.A." : "→ Student"}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className={student.role === 'admin' ? styles.demoteBtn : styles.adminPromoteBtn}
                                                                    disabled={updatingUserId === student.id}
                                                                    onClick={async () => {
                                                                        if (student.role !== 'admin') {
                                                                            const confirmed = window.confirm(
                                                                                `⚠️ Make "${student.full_name}" a full Admin?\n\nThis gives them complete control over the platform including:\n• Managing all users\n• Scheduling & ending classes\n• Accessing all admin features\n\nAre you sure?`
                                                                            );
                                                                            if (!confirmed) return;
                                                                        }
                                                                        setUpdatingUserId(student.id);
                                                                        const newRole = student.role === 'admin' ? 'student' : 'admin';
                                                                        const { error } = await supabase
                                                                            .from('profiles')
                                                                            .update({ role: newRole })
                                                                            .eq('id', student.id);

                                                                        if (error) {
                                                                            console.error("Admin promotion error:", error);
                                                                            alert(`Could not update role: ${error.message}`);
                                                                        } else {
                                                                            fetchAllStudents();
                                                                        }
                                                                        setUpdatingUserId(null);
                                                                    }}
                                                                >
                                                                    {student.role === 'admin' ? "Revoke Admin" : "→ Admin"}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        {allStudents.length === 0 && (
                                            <p className={styles.noData}>No students registered yet.</p>
                                        )}
                                    </div>
                                </Card>
                            </div>
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
                                                {editMode ? (
                                                    <Input
                                                        value={editName || profile.full_name}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                ) : (
                                                    <p>{profile.full_name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.settingsItem}>
                                            <div className={styles.settingsIcon}>
                                                <CreditCard size={20} />
                                            </div>
                                            <div className={styles.settingsInfo}>
                                                <label>Phone Number</label>
                                                {editMode ? (
                                                    <Input
                                                        value={editPhone || profile.phone_number || ""}
                                                        onChange={(e) => setEditPhone(e.target.value)}
                                                        placeholder="Enter phone number"
                                                    />
                                                ) : (
                                                    <p>{profile.phone_number || "Not Added"}</p>
                                                )}
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
                                                <GraduationCap size={20} />
                                            </div>
                                            <div className={styles.settingsInfo}>
                                                <label>Course</label>
                                                {editMode ? (
                                                    <select
                                                        className={styles.inputSelect}
                                                        value={editCourse || profile.course || ""}
                                                        onChange={(e) => setEditCourse(e.target.value)}
                                                    >
                                                        <option value="">Select a course</option>
                                                        {NURSING_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                ) : (
                                                    <p>{profile.course || "Not Specified"}</p>
                                                )}
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
                                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                        {editMode ? (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={savingProfile}
                                                    onClick={async () => {
                                                        setSavingProfile(true);
                                                        const { error } = await supabase
                                                            .from('profiles')
                                                            .update({
                                                                full_name: editName || profile.full_name,
                                                                phone_number: editPhone || profile.phone_number,
                                                                course: editCourse || profile.course
                                                            })
                                                            .eq('id', profile.id);

                                                        if (error) {
                                                            alert('Failed to update profile: ' + error.message);
                                                        } else {
                                                            const finalSchool = editName || profile.school;
                                                            const finalCourse = editCourse || profile.course;

                                                            if (finalSchool && finalSchool !== "Other / Not Listed") {
                                                                const { data: existingSchoolGroup } = await supabase.from('study_groups').select('id').eq('group_type', 'school').eq('school_name', finalSchool).single();
                                                                if (!existingSchoolGroup) {
                                                                    await supabase.from('study_groups').insert({
                                                                        school_name: finalSchool,
                                                                        group_type: 'school',
                                                                        description: `Study group for students at ${finalSchool}`
                                                                    });
                                                                }
                                                            }
                                                            if (finalCourse) {
                                                                const { data: existingCourseGroup } = await supabase.from('study_groups').select('id').eq('group_type', 'course').eq('course_name', finalCourse).single();
                                                                if (!existingCourseGroup) {
                                                                    await supabase.from('study_groups').insert({
                                                                        course_name: finalCourse,
                                                                        group_type: 'course',
                                                                        description: `Study group for students studying ${finalCourse}`
                                                                    });
                                                                }
                                                            }
                                                            setEditMode(false);
                                                        }
                                                        setSavingProfile(false);
                                                    }}
                                                >
                                                    {savingProfile ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setEditName(profile.full_name);
                                                setEditPhone(profile.phone_number || "");
                                                setEditMode(true);
                                            }}>Edit Profile</Button>
                                        )}
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
                        {activeTab === 'live' && (
                            <div className={styles.chatSection}>
                                {(paywallEnabled && !profile.is_premium && profile.role === 'student') ? (
                                    <Card className={styles.paywallCard}>
                                        <Crown size={48} color="#FFD700" />
                                        <h2>Live Classroom</h2>
                                        <p>Access to live interactive classes is a Premium feature.</p>
                                        <Button variant="primary" onClick={() => setActiveTab("payments")}>Upgrade for Access</Button>
                                    </Card>
                                ) : (
                                    <Chat userProfile={profile} isAdmin={profile.role === 'admin'} isTA={profile.role === 'ta'} />
                                )}
                            </div>
                        )}
                        {activeTab === 'lessons' && (
                            <div className={styles.lessonsSection}>
                                {(paywallEnabled && !profile.is_premium && profile.role === 'student') ? (
                                    <Card className={styles.paywallCard}>
                                        <Crown size={48} color="#FFD700" />
                                        <h2>Lesson Archive</h2>
                                        <p>Access to past lessons and materials is a Premium feature.</p>
                                        <Button variant="primary" onClick={() => setActiveTab("payments")}>Upgrade for Access</Button>
                                    </Card>
                                ) : (
                                    <LessonArchive userProfile={profile} />
                                )}
                            </div>
                        )}
                        {activeTab === 'schedule' && (
                            <div className={styles.scheduleSection}>
                                <LessonManager userProfile={profile} />
                            </div>
                        )}

                        {/* Admin Messages Tab */}
                        {activeTab === 'messages' && isAdmin && (
                            <div className={styles.chatSection}>
                                <AdminInbox />
                            </div>
                        )}

                        {/* Student Chat Admin Tab */}
                        {activeTab === 'chat-admin' && !isStaff && (
                            <div className={styles.chatSection}>
                                {(paywallEnabled && !profile.is_premium) ? (
                                    <Card className={styles.paywallCard}>
                                        <Crown size={48} color="#FFD700" />
                                        <h2>Direct Admin Access</h2>
                                        <p>Direct chat with instructors and admins is a Premium feature.</p>
                                        <Button variant="primary" onClick={() => setActiveTab("payments")}>Upgrade for Access</Button>
                                    </Card>
                                ) : adminUsers.length > 0 ? (
                                    <DirectChat
                                        otherUserId={adminUsers[0].id}
                                        otherUserName={adminUsers[0].full_name}
                                    />
                                ) : (
                                    <Card>
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary)' }}>
                                            <MessageCircle size={40} />
                                            <h3 style={{ marginTop: '1rem' }}>No Admin Available</h3>
                                            <p>Please try again later.</p>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Student Study Group Tab */}
                        {activeTab === 'study-group' && !isStaff && (
                            <div className={styles.chatSection}>
                                {(paywallEnabled && !profile.is_premium) ? (
                                    <Card className={styles.paywallCard}>
                                        <Crown size={48} color="#FFD700" />
                                        <h2>Study Groups</h2>
                                        <p>Collaboration in study groups is a Premium feature.</p>
                                        <Button variant="primary" onClick={() => setActiveTab("payments")}>Upgrade for Access</Button>
                                    </Card>
                                ) : (
                                    <StudyGroupChat />
                                )}
                            </div>
                        )}

                        {/* Admin Payments Tab */}
                        {activeTab === 'payments' && isAdmin && (
                            <div>
                                <Card title="Payment Control Center">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {/* Paywall Toggle */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--background)', borderRadius: '12px' }}>
                                            <div>
                                                <h4 style={{ margin: 0 }}>Paywall</h4>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary)' }}>Restrict features for non-premium users</p>
                                            </div>
                                            <Button
                                                variant={paywallEnabled ? 'primary' : 'outline'}
                                                size="sm"
                                                onClick={async () => {
                                                    const newVal = !paywallEnabled;
                                                    setPaywallEnabled(newVal);
                                                    await supabase.from('platform_settings').update({ value: newVal.toString() }).eq('key', 'paywall_enabled');
                                                }}
                                            >
                                                {paywallEnabled ? 'Enabled' : 'Disabled'}
                                            </Button>
                                        </div>

                                        {/* Premium Price */}
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', padding: '1rem', background: 'var(--background)', borderRadius: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Upgrade Price (GHS)</label>
                                                <Input
                                                    type="number"
                                                    value={premiumPrice}
                                                    onChange={(e) => setPremiumPrice(Number(e.target.value))}
                                                />
                                            </div>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={savingSettings}
                                                onClick={async () => {
                                                    setSavingSettings(true);
                                                    await supabase.from('platform_settings').update({ value: premiumPrice.toString() }).eq('key', 'premium_price');
                                                    setSavingSettings(false);
                                                }}
                                            >
                                                Save
                                            </Button>
                                        </div>

                                        {/* Revenue Summary */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                            <Card>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>GHS {allPayments.filter(p => p.status === 'success').reduce((sum: number, p: any) => sum + Number(p.amount), 0).toFixed(2)}</p>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Total Revenue</span>
                                                </div>
                                            </Card>
                                            <Card>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{allPayments.filter(p => p.status === 'success').length}</p>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Successful Payments</span>
                                                </div>
                                            </Card>
                                            <Card>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{allStudents.filter(s => s.is_premium).length}</p>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Premium Users</span>
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Manual Premium Toggle per Student */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                            <h4 style={{ margin: 0 }}>Manage Premium Access</h4>
                                            <div style={{ width: '250px' }}>
                                                <Input
                                                    placeholder="Search name, email, or phone..."
                                                    value={premiumSearch}
                                                    onChange={(e) => setPremiumSearch(e.target.value)}
                                                    style={{ marginBottom: 0 }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--background)', borderRadius: '12px', padding: '0 1rem' }}>
                                            {premiumSearch.trim().length === 0 ? (
                                                <p style={{ color: 'var(--secondary)', textAlign: 'center', padding: '2rem 0' }}>Type a student's name to manage their premium access.</p>
                                            ) : (
                                                allStudents
                                                    .filter(s => s.role === 'student')
                                                    .filter(s => {
                                                        const term = premiumSearch.toLowerCase();
                                                        const nameMatch = s.full_name?.toLowerCase().includes(term) || false;
                                                        const phoneMatch = s.phone_number?.toLowerCase().includes(term) || false;
                                                        const emailMatch = s.email?.toLowerCase().includes(term) || false;
                                                        return nameMatch || phoneMatch || emailMatch;
                                                    })
                                                    .map(student => (
                                                        <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                                                            <div>
                                                                <span style={{ fontWeight: 600 }}>{student.full_name}</span>
                                                                {student.is_premium && <Crown size={14} style={{ color: '#FFD700', marginLeft: '0.5rem' }} />}
                                                                <br />
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>{student.school}</span>
                                                            </div>
                                                            <Button
                                                                variant={student.is_premium ? 'outline' : 'primary'}
                                                                size="sm"
                                                                onClick={async () => {
                                                                    await supabase.from('profiles').update({ is_premium: !student.is_premium }).eq('id', student.id);
                                                                    setAllStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_premium: !s.is_premium } : s));
                                                                }}
                                                            >
                                                                {student.is_premium ? 'Revoke' : 'Grant Premium'}
                                                            </Button>
                                                        </div>
                                                    ))
                                            )}
                                        </div>

                                        {/* Payment History */}
                                        <h4>Payment History</h4>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {allPayments.length === 0 ? (
                                                <p style={{ color: 'var(--secondary)', textAlign: 'center' }}>No payments yet</p>
                                            ) : allPayments.map((p: any) => (
                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 600 }}>{p.profiles?.full_name || 'Unknown'}</span>
                                                        <br />
                                                        <span style={{ color: 'var(--secondary)', fontSize: '0.75rem' }}>
                                                            {new Date(p.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontWeight: 600 }}>GHS {p.amount}</span>
                                                        <br />
                                                        <span style={{ color: p.status === 'success' ? 'var(--primary)' : '#e53e3e', fontSize: '0.75rem' }}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
