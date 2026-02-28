"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BookOpen, Mail, Lock, User, Phone } from "lucide-react";
import Link from "next/link";
import styles from "../login/login.module.css";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { NURSING_SCHOOLS } from "@/lib/schools";
import { NURSING_COURSES } from "@/lib/courses";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { Suspense } from "react";

function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [school, setSchool] = useState("");
    const [customSchool, setCustomSchool] = useState("");
    const [course, setCourse] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const setupCode = searchParams.get("setup_code");
    const isAdminMode = setupCode === "RGN_ADMIN_2026";

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone_number: phone,
                        school: school === "Other / Not Listed" ? customSchool : school,
                        course: course,
                        role: isAdminMode ? "admin" : "student"
                    }
                }
            });

            if (signUpError) throw signUpError;

            // Hasten record creation by explicitly inserting the profile
            if (data?.user) {
                const finalSchool = school === "Other / Not Listed" ? customSchool : school;

                await supabase.from("profiles").upsert({
                    id: data.user.id,
                    full_name: fullName,
                    role: isAdminMode ? "admin" : "student",
                    school: finalSchool,
                    course: course,
                    phone_number: phone,
                    is_locked: false,
                    is_hand_raised: false,
                    points: 0
                });

                // Auto-create study groups if they don't exist
                if (finalSchool) {
                    const { data: existingSchoolGroup } = await supabase.from('study_groups').select('id').eq('group_type', 'school').eq('school_name', finalSchool).single();
                    if (!existingSchoolGroup) {
                        await supabase.from('study_groups').insert({
                            school_name: finalSchool,
                            group_type: 'school',
                            description: `Study group for students at ${finalSchool}`
                        });
                    }
                }
                if (course) {
                    const { data: existingCourseGroup } = await supabase.from('study_groups').select('id').eq('group_type', 'course').eq('course_name', course).single();
                    if (!existingCourseGroup) {
                        await supabase.from('study_groups').insert({
                            course_name: course,
                            group_type: 'course',
                            description: `Study group for students studying ${course}`
                        });
                    }
                }
            }

            // Since email confirmation is disabled, session should be available immediately
            router.push("/dashboard");
            router.refresh(); // Refresh to ensure useAuth hook picks up the new session
        } catch (err: any) {
            setError(err.message || "Failed to sign up");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleRegister} className={styles.form}>
            {isAdminMode && (
                <div className={styles.adminBadge} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(19, 96, 59, 0.1)',
                    color: 'var(--primary)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    border: '1px solid var(--primary)'
                }}>
                    <ShieldCheck size={20} />
                    <span>Administrator Setup Mode Active</span>
                </div>
            )}
            <Input
                label="Full Name"
                type="text"
                placeholder="Kojo Antwi"
                icon={<User size={18} />}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
            />
            <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                icon={<Mail size={18} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={<Lock size={18} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <Input
                label="Phone Number"
                type="tel"
                placeholder="0XX XXX XXXX"
                icon={<Phone size={18} />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
            />

            <SearchableSelect
                label="Nursing Institution"
                options={NURSING_SCHOOLS}
                value={school}
                onChange={setSchool}
                placeholder="Select your training college"
                required
            />

            <SearchableSelect
                label="Nursing Course / Category"
                options={NURSING_COURSES.map(c => ({ name: c }))}
                value={course}
                onChange={setCourse}
                placeholder="Select your nursing course"
                required
            />

            {school === "Other / Not Listed" && (
                <Input
                    label="Specify School"
                    type="text"
                    placeholder="Enter your school name"
                    icon={<GraduationCap size={18} />}
                    value={customSchool}
                    onChange={(e) => setCustomSchool(e.target.value)}
                    required
                />
            )}

            {error && <div className={styles.error}>{error}</div>}

            <Button type="submit" size="lg" isLoading={isLoading} className={styles.submitBtn}>
                {isAdminMode ? "Create Admin Account" : "Create Account"}
            </Button>
        </form>
    );
}

export default function RegisterPage() {
    return (
        <div className={styles.container}>
            <Link href="/" className={styles.backLink}>
                <BookOpen size={24} />
                <span>RGN TEST BANK GH</span>
            </Link>

            <Card glass className={styles.loginCard}>
                <div className={styles.header}>
                    <h1>Create Account</h1>
                    <p>Join the study platform for nursing excellence</p>
                </div>

                <Suspense fallback={<div className={styles.loading}>Loading Registration...</div>}>
                    <RegisterForm />
                </Suspense>

                <div className={styles.footer}>
                    <span>Already have an account?</span>
                    <Link href="/login">Login</Link>
                </div>
            </Card>

            <div className={styles.pattern}></div>
        </div>
    );
}
