"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BookOpen, Mail, Lock } from "lucide-react";
import Link from "next/link";
import styles from "./login.module.css";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to sign in");
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
                    <h1>Welcome Back</h1>
                    <p>Login to your student or instructor account</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
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

                    {error && <div className={styles.error}>{error}</div>}

                    <Button type="submit" size="lg" isLoading={isLoading} className={styles.submitBtn}>
                        Login
                    </Button>
                </form>

                <div className={styles.footer}>
                    <span>Don't have an account?</span>
                    <Link href="/register">Sign up</Link>
                </div>
            </Card>

            <div className={styles.pattern}></div>
        </div>
    );
}
