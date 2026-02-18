import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BookOpen, Video, FileText, BarChart3, Users } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <BookOpen className={styles.icon} />
          <span>RGN TEST BANK GH</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/login">Login</Link>
          <Button variant="primary" size="sm">Get Started</Button>
        </nav>
      </header>

      <main className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className="animate-fade-in">Master Your Nursing Exams with <span className={styles.highlight}>Confidence</span></h1>
          <p className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            The all-in-one study platform for Ghanaian nursing students. Live interactive classes, AI-powered quiz generation, and detailed analytics.
          </p>
          <div className={styles.actions + " animate-fade-in"} style={{ animationDelay: '0.2s' }}>
            <Button size="lg">Start Studying Now</Button>
            <Button variant="outline" size="lg">View Demo Class</Button>
          </div>
        </div>

        <div className={styles.heroImage + " animate-scale-in"}>
          <Card glass className={styles.previewCard}>
            <div className={styles.cardHeader}>
              <Users size={18} />
              <span>Live Class in Session</span>
              <div className={styles.liveIndicator}>LIVE</div>
            </div>
            <div className={styles.videoPlaceholder}>
              <Video size={48} />
            </div>
          </Card>
        </div>
      </main>

      <section className={styles.features}>
        <Card className={styles.featureCard}>
          <Video className={styles.featureIcon} />
          <h3>Live Classroom</h3>
          <p>Interactive group chat, poll participation, and a "Raise Hand" system designed for focused learning.</p>
        </Card>
        <Card className={styles.featureCard}>
          <FileText className={styles.featureIcon} />
          <h3>AI Quiz Generator</h3>
          <p>Upload your PDFs or Word docs and let our AI transform them into interactive quizzes instantly.</p>
        </Card>
        <Card className={styles.featureCard}>
          <BarChart3 className={styles.featureIcon} />
          <h3>Smart Analytics</h3>
          <p>Track your progress and stay competitive with the "Most Active User" class rankings.</p>
        </Card>
      </section>
    </div>
  );
}
