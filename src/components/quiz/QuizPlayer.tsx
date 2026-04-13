"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Clock, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react";
import styles from "./QuizPlayer.module.css";

interface Question {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
}

interface QuizPlayerProps {
    quiz: Question[];
    timeLimit?: number; // in minutes
    onComplete?: (score: number) => void;
}

export const QuizPlayer = ({ quiz, timeLimit, onComplete }: QuizPlayerProps) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<string[]>(new Array(quiz.length).fill(""));
    const [timeLeft, setTimeLeft] = useState(timeLimit ? timeLimit * 60 : null);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);

    if (!quiz || quiz.length === 0) {
        return (
            <Card className={styles.resultsCard}>
                <AlertCircle size={64} color="var(--secondary)" className={styles.resultIcon} />
                <h2>No Quizzes Available</h2>
                <p>Check back later for new study sets!</p>
            </Card>
        );
    }

    useEffect(() => {
        if (timeLeft === null || isFinished) return;

        if (timeLeft <= 0) {
            handleFinish();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, isFinished]);

    const handleOptionSelect = (option: string) => {
        const newAnswers = [...answers];
        newAnswers[currentIdx] = option;
        setAnswers(newAnswers);
    };

    const handleFinish = () => {
        let finalScore = 0;
        answers.forEach((ans, idx) => {
            if (ans === quiz[idx].correctAnswer) finalScore++;
        });

        setScore(finalScore);
        setIsFinished(true);
        if (onComplete) onComplete(finalScore);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isFinished) {
        return (
            <Card className={styles.resultsCard}>
                <div className={styles.resultsHeader}>
                    <CheckCircle2 size={48} color="var(--success)" />
                    <div>
                        <h2>Quiz Finished!</h2>
                        <p>Score: <strong>{score}</strong> out of {quiz.length} ({Math.round((score / quiz.length) * 100)}%)</p>
                    </div>
                </div>

                <div className={styles.reviewSection}>
                    <h3>Review Answers</h3>
                    <div className={styles.reviewList}>
                        {quiz.map((q, idx) => {
                            const isCorrect = answers[idx] === q.correctAnswer;
                            return (
                                <div key={idx} className={`${styles.reviewItem} ${isCorrect ? styles.reviewCorrect : styles.reviewIncorrect}`}>
                                    <div className={styles.reviewQHeader}>
                                        <span className={styles.reviewNum}>Q{idx + 1}</span>
                                        {isCorrect ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    </div>
                                    <p className={styles.reviewText}>{q.question}</p>
                                    <div className={styles.reviewAnswers}>
                                        <div className={styles.reviewAnsRow}>
                                            <span className={styles.ansLabel}>Your Answer:</span>
                                            <span className={styles.ansValue}>{answers[idx] || "(No Answer)"}</span>
                                        </div>
                                        {!isCorrect && (
                                            <div className={styles.reviewAnsRow}>
                                                <span className={`${styles.ansLabel} ${styles.correctLabel}`}>Correct Answer:</span>
                                                <span className={styles.ansValue}>{q.correctAnswer}</span>
                                            </div>
                                        )}
                                    </div>
                                    {q.explanation && (
                                        <div className={styles.explanationArea}>
                                            <p><strong>Explanation:</strong> {q.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Button onClick={() => window.location.reload()} className={styles.restartBtn}>
                    <RefreshCcw size={18} />
                    Try Another Quiz
                </Button>
            </Card>
        );
    }

    const currentQuestion = quiz[currentIdx];

    return (
        <Card className={styles.quizCard}>
            <header className={styles.quizHeader}>
                <div className={styles.progress}>
                    Question {currentIdx + 1} of {quiz.length}
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${((currentIdx + 1) / quiz.length) * 100}%` }}
                        ></div>
                    </div>
                </div>
                {timeLeft !== null && (
                    <div className={`${styles.timer} ${timeLeft < 60 ? styles.timerWarning : ""}`}>
                        <Clock size={18} />
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                )}
            </header>

            <div className={styles.questionSection}>
                <h3 className={styles.questionText}>{currentQuestion.question}</h3>
                <div className={styles.optionsGrid}>
                    {currentQuestion.options.map((option, idx) => (
                        <button
                            key={idx}
                            className={`${styles.optionBtn} ${answers[currentIdx] === option ? styles.selected : ""}`}
                            onClick={() => handleOptionSelect(option)}
                        >
                            <span className={styles.optionLabel}>{String.fromCharCode(65 + idx)}</span>
                            <span className={styles.optionContent}>{option}</span>
                        </button>
                    ))}
                </div>
            </div>

            <footer className={styles.quizFooter}>
                <Button
                    variant="outline"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                >
                    Previous
                </Button>
                {currentIdx === quiz.length - 1 ? (
                    <Button variant="primary" onClick={handleFinish} disabled={!answers[currentIdx]}>
                        Submit Quiz
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        onClick={() => setCurrentIdx(currentIdx + 1)}
                        disabled={!answers[currentIdx]}
                    >
                        Next Question
                    </Button>
                )}
            </footer>
        </Card>
    );
};
