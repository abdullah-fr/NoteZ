import { useLayoutEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface IntroProps {
  onComplete?: () => void;
}

export function ChalkboardIntro({ onComplete }: IntroProps) {
  const [isDone, setIsDone] = useState(false);
  const controls = useAnimation();

  useLayoutEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let cancelled = false;
    const runAnimation = async () => {
      setIsDone(false);
      await controls.start('visible');
      if (!cancelled) {
        setIsDone(true);
      }
      if (!cancelled && onComplete) {
        timer = setTimeout(() => {
          onComplete();
        }, 1000);
      }
    };
    runAnimation();
    return () => {
      cancelled = true;
      controls.stop();
      if (timer) clearTimeout(timer);
    };
  }, [controls, onComplete]);

  const handleScrollDown = () => {
    const heroEl = document.getElementById('hero-section');
    if (heroEl) {
      heroEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="relative w-full min-h-[90vh] sm:min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden select-none border-b border-border/40"
    >
      {/* Premium Ambient Background Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Violet/Gold Glowing Orbs */}
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-primary/10 blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] rounded-full bg-notez-warning/10 blur-[100px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Delicate Dark Grid Backdrop */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Intro Header Top Bar */}
      <div className="absolute top-20 sm:top-24 left-0 right-0 px-6 flex justify-between items-center text-[11px] font-mono tracking-widest text-muted-foreground uppercase pointer-events-none max-w-7xl mx-auto">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          NoteZ Studio Intro
        </span>
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-4xl text-center">
        
        {/* Animated Handwriting SVG for "NoteZ" */}
        <div className="relative my-2 w-full max-w-2xl flex justify-center">
          <svg
            viewBox="0 0 850 240"
            className="hero-wordmark w-full h-auto"
          >
            {/* Ambient Stroke Glow Shadow */}
            <defs>
              <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Letter 'N' */}
            <motion.path
              d="M 70 200 L 75 50 L 180 190 L 185 45"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 1.1, ease: "easeInOut" }}
              className="hero-wordmark-glow"
              filter="url(#neon-glow)"
            />

            {/* Letter 'o' */}
            <motion.path
              d="M 235 145 C 215 90, 315 90, 295 150 C 280 200, 215 195, 235 145 Z M 290 135 C 305 120, 330 140, 340 140"
              fill="none"
              stroke="currentColor"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 0.9, delay: 0.8, ease: "easeInOut" }}
              className="hero-wordmark-glow"
              filter="url(#neon-glow)"
            />

            {/* Letter 't' */}
            <motion.path
              d="M 370 65 L 365 195 C 365 205, 385 200, 395 190"
              fill="none"
              stroke="currentColor"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 0.8, delay: 1.6, ease: "easeInOut" }}
              className="hero-wordmark-glow"
              filter="url(#neon-glow)"
            />
            {/* Crossbar of 't' */}
            <motion.path
              d="M 330 125 L 405 120"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 0.4, delay: 2.3, ease: "easeInOut" }}
            />

            {/* Letter 'e' */}
            <motion.path
              d="M 430 145 L 495 135 C 490 90, 420 100, 430 155 C 440 195, 490 190, 510 175"
              fill="none"
              stroke="currentColor"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 0.9, delay: 2.6, ease: "easeInOut" }}
              className="hero-wordmark-glow"
              filter="url(#neon-glow)"
            />

            {/* Capital 'Z' */}
            <motion.path
              d="M 545 55 L 685 55 L 565 195 L 705 195"
              fill="none"
              stroke="currentColor"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 1.0, delay: 3.4, ease: "easeInOut" }}
              className="hero-wordmark-glow"
              filter="url(#neon-glow)"
            />

            {/* Underline Calligraphic Flourish */}
            <motion.path
              d="M 50 225 Q 360 245, 730 220 C 760 215, 775 235, 745 242 Q 480 250, 220 238"
              fill="none"
              stroke="url(#flourish-gradient)"
              strokeWidth="6"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 0.9 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 1.2, delay: 4.3, ease: "easeInOut" }}
            />
            <defs>
              <linearGradient id="flourish-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="currentColor" />
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="100%" stopColor="hsl(var(--notez-warning))" />
              </linearGradient>
            </defs>

            {/* Sparkle Dots */}
            <motion.circle
              cx="745"
              cy="65"
              r="6"
              fill="hsl(var(--notez-warning))"
              variants={{
                hidden: { scale: 0, opacity: 0 },
                visible: { scale: 1, opacity: 1 },
              }}
              initial="hidden"
              animate={controls}
              transition={{ duration: 0.3, delay: 5.2 }}
            />
          </svg>
        </div>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.8 }}
          className="space-y-3 mt-4"
        >
          <p className="font-display italic text-2xl sm:text-3xl text-foreground font-medium tracking-wide">
            Not your average tutor
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:text-xs">
            TRANSFORM ANY SUBJECT INTO FLASHCARDS, QUIZZES &amp; EXAMS
          </p>
        </motion.div>

        {/* Scroll Down Trigger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isDone ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-col items-center gap-3 cursor-pointer group"
          onClick={handleScrollDown}
        >
          <button
            className="px-7 py-3 rounded-full bg-card/80 hover:bg-card text-foreground font-medium text-xs sm:text-sm flex items-center gap-2.5 border border-border/80 shadow-2xl backdrop-blur-xl group-hover:scale-105 transition-all"
          >
            <span>Scroll Down to Discover NoteZ</span>
            <ChevronDown className="w-4 h-4 animate-bounce text-primary" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
