import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, BookOpen, Brain, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section
      id="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden animated-bg pt-20 pb-16"
    >
      {/* Animated background glowing spheres */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] rounded-full bg-notez-purple/15 blur-3xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[24rem] h-[24rem] rounded-full bg-notez-violet/15 blur-3xl"
          animate={{ scale: [1.25, 1, 1.25], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/80 bg-card/60 backdrop-blur-md text-xs font-medium text-muted-foreground mb-8 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>The AI Study Companion for Serious Learners</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold mb-6 tracking-tight leading-[1.05]"
          >
            Learn smarter.{"\n"}
            <span className="gradient-text bg-clip-text text-transparent bg-gradient-to-r from-foreground via-muted-foreground to-foreground">
              Remember everything.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Turn any subject into flashcards, quizzes, and exams — and actually retain it with zero cognitive friction.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button asChild size="lg" className="text-lg px-9 h-14 glow-purple rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
              <Link to="/login">
                Start Learning Now
                <ArrowRight className="ml-2.5 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 h-14 rounded-xl border-border/80 hover:bg-secondary/60">
              <a href="#features">
                See Features
              </a>
            </Button>
          </motion.div>

          {/* Floating UI Tool Badges */}
          <div className="relative mt-16 h-24 sm:mt-20 sm:h-28 pointer-events-none select-none">
            <motion.div
              className="absolute left-2 sm:left-12 top-0 p-3.5 sm:p-4 rounded-2xl glass card-3d shadow-xl flex items-center gap-3 border border-border/60 bg-card/60 backdrop-blur-md"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-foreground">Smart Flashcards</p>
                <p className="text-[11px] text-muted-foreground">Spaced repetition</p>
              </div>
            </motion.div>

            <motion.div
              className="absolute right-2 sm:right-12 top-2 p-3.5 sm:p-4 rounded-2xl glass card-3d shadow-xl flex items-center gap-3 border border-border/60 bg-card/60 backdrop-blur-md"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="p-2 rounded-xl bg-notez-violet/20 text-notez-violet">
                <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-foreground">Adaptive AI Exams</p>
                <p className="text-[11px] text-muted-foreground">Real-time feedback</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
