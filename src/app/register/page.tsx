"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BookOpen, Mail, Lock, User } from "lucide-react";
import Link from "next/link";
import styles from "../login/login.module.css";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { NURSING_SCHOOLS } from "@/lib/schools";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { GraduationCap } from "lucide-react";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [school, setSchool] = useState("");
    const [customSchool, setCustomSchool] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

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
                        school: school === "Other / Not Listed" ? customSchool : school,
                    }
                }
            });

            if (signUpError) throw signUpError;

            // Hasten record creation by explicitly inserting the profile
            if (data?.user) {
                await supabase.from("profiles").upsert({
                    id: data.user.id,
                    full_name: fullName,
                    role: "student",
                    school: school === "Other / Not Listed" ? customSchool : school,
                    is_locked: false,
                    is_hand_raised: false
                });
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

                <form onSubmit={handleRegister} className={styles.form}>
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

                    <SearchableSelect
                        label="Nursing Institution"
                        options={NURSING_SCHOOLS}
                        value={school}
                        onChange={setSchool}
                        placeholder="Select your training college"
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
                        Create Account
                    </Button>
                </form>

                <div className={styles.footer}>
                    <span>Already have an account?</span>
                    <Link href="/login">Login</Link>
                </div>
            </Card>

            <div className={styles.pattern}></div>
        </div>
    );
}
