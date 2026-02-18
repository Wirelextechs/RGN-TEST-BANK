"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import styles from "./QuizGenerator.module.css";

export const QuizGenerator = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus("idle");
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setStatus("idle");

        try {
            // For this demo, we simulate the API call to Gemini
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/quiz", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Parsing failed");

            const data = await response.json();
            setStatus("success");
            setMessage(`Successfully generated ${data.quiz.length} questions!`);
        } catch (err) {
            setStatus("error");
            setMessage("Failed to parse document. Please ensure it contains MCQs.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <FileText size={24} color="var(--primary)" />
                <h3>AI Quiz Generator</h3>
            </div>

            <div className={styles.uploadArea}>
                <input
                    type="file"
                    id="quiz-file"
                    className={styles.fileInput}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                />
                <label htmlFor="quiz-file" className={styles.uploadLabel}>
                    <Upload size={32} />
                    <span>{file ? file.name : "Click to upload PDF or Word Document"}</span>
                    <p>MCQ questions will be automatically extracted</p>
                </label>
            </div>

            {status !== "idle" && (
                <div className={`${styles.status} ${styles[status]}`}>
                    {status === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span>{message}</span>
                </div>
            )}

            <Button
                variant="primary"
                className={styles.actionBtn}
                disabled={!file || isUploading}
                onClick={handleUpload}
            >
                {isUploading ? (
                    <>
                        <Loader2 className={styles.spinner} size={18} />
                        Parsing Document...
                    </>
                ) : (
                    "Generate Quiz"
                )}
            </Button>
        </Card>
    );
};
