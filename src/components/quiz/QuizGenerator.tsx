"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Plus, Trash2, Edit3, Save } from "lucide-react";
import styles from "./QuizGenerator.module.css";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: string | null;
}

interface QuizGeneratorProps {
    userId: string;
}

export const QuizGenerator = ({ userId }: QuizGeneratorProps) => {
    const [activeTab, setActiveTab] = useState<"upload" | "manual">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error" | "review">("idle");
    const [message, setMessage] = useState("");
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);

    // New Quiz Settings
    const [quizTitle, setQuizTitle] = useState("");
    const [course, setCourse] = useState("RGN");
    const [isPremiumOnly, setIsPremiumOnly] = useState(false);
    const [timeLimit, setTimeLimit] = useState<number | "indefinite">(30);

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
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/quiz", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Parsing failed");
            }

            if (!data.quiz || data.quiz.length === 0) {
                throw new Error("No MCQ questions found in document");
            }

            // Assign unique temperory IDs for React rendering
            const parsedQuestions = data.quiz.map((q: any) => ({
                id: Math.random().toString(36).substring(7),
                question: q.question,
                options: q.options || ["", "", "", ""],
                correctAnswer: q.correctAnswer || null
            }));

            setQuestions(parsedQuestions);
            setQuizTitle(file.name.replace(/\.[^/.]+$/, "")); // Default title from filename
            setStatus("review");
            setMessage(`Extracted ${parsedQuestions.length} questions. Please review and provide missing answers.`);
        } catch (err: any) {
            setStatus("error");
            setMessage(err.message || "Failed to parse document. Please ensure it contains MCQs.");
        } finally {
            setIsUploading(false);
        }
    };

    const addManualQuestion = () => {
        setQuestions([...questions, {
            id: Math.random().toString(36).substring(7),
            question: "New Question...",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: null
        }]);
        if (status !== "review") setStatus("review");
    };

    const removeQuestion = (id: string) => {
        const updated = questions.filter(q => q.id !== id);
        setQuestions(updated);
        if (updated.length === 0) {
            setStatus("idle");
            setFile(null);
        }
    };

    const updateQuestionText = (id: string, text: string) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, question: text } : q));
    };

    const updateOptionText = (qId: string, optIndex: number, text: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const newOpts = [...q.options];
                newOpts[optIndex] = text;
                // If they edit the currently selected correct answer, update the reference
                let newCorrect = q.correctAnswer;
                if (q.correctAnswer === q.options[optIndex]) {
                    newCorrect = text;
                }
                return { ...q, options: newOpts, correctAnswer: newCorrect };
            }
            return q;
        }));
    };

    const selectCorrectAnswer = (qId: string, optionString: string) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, correctAnswer: optionString } : q));
    };

    const saveQuiz = async () => {
        // Validate
        const missing = questions.find(q => !q.correctAnswer || !q.options.includes(q.correctAnswer));
        if (missing) {
            setStatus("error");
            setMessage("Please select a Correct Answer for all questions before saving.");
            return;
        }

        if (questions.length === 0) {
            setStatus("error");
            setMessage("Cannot publish an empty quiz.");
            return;
        }

        setIsUploading(true);
        try {
            const response = await fetch("/api/quiz/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: quizTitle || "Untitled Quiz",
                    course,
                    is_premium_only: isPremiumOnly,
                    time_limit: timeLimit === "indefinite" ? null : timeLimit,
                    questions: questions.map(q => ({
                        question: q.question,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        explanation: (q as any).explanation || ""
                    })),
                    created_by: userId
                }),
            });

            if (!response.ok) throw new Error("Failed to save quiz to database");

            setStatus("success");
            setMessage(`Successfully published quiz with ${questions.length} questions!`);
            setQuestions([]);
            setFile(null);
            setQuizTitle("");
        } catch (err: any) {
            setStatus("error");
            setMessage(err.message || "Failed to save quiz");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <FileText size={24} color="var(--primary)" />
                <h3>Quiz Manager</h3>
            </div>

            {status !== "review" && status !== "success" ? (
                <>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            <Upload size={16} /> Document Upload
                        </button>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('manual')}
                        >
                            <Edit3 size={16} /> Manual Builder
                        </button>
                    </div>

                    {activeTab === "upload" ? (
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
                                <p>Questions and options will be auto-extracted. You can fill in missing answers later.</p>
                            </label>
                            <Button
                                variant="primary"
                                className={styles.actionBtn}
                                disabled={!file || isUploading}
                                onClick={handleUpload}
                                style={{ marginTop: '1rem' }}
                            >
                                {isUploading ? <><Loader2 className={styles.spinner} size={18} /> Parsing...</> : "Extract Questions"}
                            </Button>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                                Build a quiz entirely from scratch without uploading documents.
                            </p>
                            <Button variant="primary" onClick={addManualQuestion}>
                                <Plus size={18} /> Start New Quiz
                            </Button>
                        </div>
                    )}
                </>
            ) : null}

            {status === "review" && (
                <div className={styles.reviewContainer}>
                    <div className={styles.adminControls}>
                        <div className={styles.controlGroup}>
                            <label>Quiz Title</label>
                            <input
                                type="text"
                                value={quizTitle}
                                onChange={(e) => setQuizTitle(e.target.value)}
                                placeholder="Enter quiz title..."
                                className={styles.titleInput}
                            />
                        </div>
                        <div className={styles.controlRow}>
                            <div className={styles.controlGroup}>
                                <label>Course</label>
                                <select value={course} onChange={(e) => setCourse(e.target.value)} className={styles.selectInput}>
                                    <option value="RGN">RGN</option>
                                    <option value="PH">PH</option>
                                    <option value="MIDWIFERY">MIDWIFERY</option>
                                    <option value="MENTAL HEALTH">MENTAL HEALTH</option>
                                </select>
                            </div>
                            <div className={styles.controlGroup}>
                                <label>Time Limit (mins)</label>
                                <div className={styles.timeInputWrapper}>
                                    <input
                                        type="number"
                                        disabled={timeLimit === "indefinite"}
                                        value={timeLimit === "indefinite" ? "" : timeLimit}
                                        onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                                        className={styles.timeInput}
                                    />
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={timeLimit === "indefinite"}
                                            onChange={(e) => setTimeLimit(e.target.checked ? "indefinite" : 30)}
                                        />
                                        Indefinite
                                    </label>
                                </div>
                            </div>
                            <div className={styles.controlGroup}>
                                <label>Visibility</label>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isPremiumOnly}
                                        onChange={(e) => setIsPremiumOnly(e.target.checked)}
                                    />
                                    Premium Only
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.reviewHeader}>
                        <h4>Questions ({questions.length})</h4>
                        <Button variant="outline" size="sm" onClick={addManualQuestion}>
                            <Plus size={16} /> Add Question
                        </Button>
                    </div>

                    <div className={styles.questionList}>
                        {questions.map((q, i) => {
                            const isMissingAnswer = !q.correctAnswer || !q.options.includes(q.correctAnswer);

                            return (
                                <div key={q.id} className={`${styles.questionCard} ${isMissingAnswer ? styles.needsAttention : ''}`}>
                                    <div className={styles.qCardHeader}>
                                        <h5>Question {i + 1}</h5>
                                        <button className={styles.deleteBtn} onClick={() => removeQuestion(q.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <textarea
                                        className={styles.qInput}
                                        value={q.question}
                                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                                        rows={2}
                                    />

                                    <div className={styles.optionsList}>
                                        {q.options.map((opt, optIndex) => (
                                            <div key={optIndex} className={styles.optionRow}>
                                                <input
                                                    type="radio"
                                                    name={`correct-${q.id}`}
                                                    checked={q.correctAnswer === opt && opt.length > 0}
                                                    onChange={() => selectCorrectAnswer(q.id, opt)}
                                                />
                                                <input
                                                    type="text"
                                                    className={styles.optInput}
                                                    value={opt}
                                                    onChange={(e) => updateOptionText(q.id, optIndex, e.target.value)}
                                                    placeholder={`Option ${optIndex + 1}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {isMissingAnswer && (
                                        <div className={styles.missingWarning}>
                                            <AlertCircle size={14} /> Please select the correct answer
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.reviewActions}>
                        <Button
                            variant="primary"
                            className={styles.actionBtn}
                            onClick={saveQuiz}
                            disabled={isUploading || questions.length === 0}
                        >
                            {isUploading ? <Loader2 className={styles.spinner} size={18} /> : <Save size={18} />}
                            {isUploading ? " Publishing..." : " Publish Quiz"}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setStatus("idle");
                                setQuestions([]);
                                setFile(null);
                            }}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {status === "success" && (
                <div className={`${styles.status} ${styles.success}`}>
                    <CheckCircle size={18} />
                    <span>{message}</span>
                    <Button variant="outline" size="sm" onClick={() => setStatus("idle")} style={{ marginLeft: '1rem', color: 'black' }}>Build Another</Button>
                </div>
            )}

            {status === "error" && (
                <div className={`${styles.status} ${styles.error}`}>
                    <AlertCircle size={18} />
                    <span>{message}</span>
                </div>
            )}
        </Card>
    );
};
