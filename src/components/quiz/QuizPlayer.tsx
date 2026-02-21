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
}

interface QuizPlayerProps {
    quiz: Question[];
    timeLimit?: number; // in minutes
    onComplete?: (score: number) => void;
}

export const QuizPlayer = ({ quiz, timeLimit = 10, onComplete }: QuizPlayerProps) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<string[]>(new Array(quiz.length).fill(""));
    const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
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
        if (timeLeft <= 0 && !isFinished) {
            handleFinish();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
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
                <CheckCircle2 size={64} color="var(--success)" className={styles.resultIcon} />
                <h2>Quiz Completed!</h2>
                <div className={styles.scoreDisplay}>
                    <span className={styles.scoreNum}>{score}</span>
                    <span className={styles.scoreTotal}>/ {quiz.length}</span>
                </div>
                <p>Your score: {Math.round((score / quiz.length) * 100)}%</p>
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
                <div className={`${styles.timer} ${timeLeft < 60 ? styles.timerWarning : ""}`}>
                    <Clock size={18} />
                    <span>{formatTime(timeLeft)}</span>
                </div>
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
