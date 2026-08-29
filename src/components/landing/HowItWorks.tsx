import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, BookOpen, Trophy, Check, ArrowRight, Flame, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const steps = [
  {
    step: '01',
    id: 'step-1',
    icon: UserPlus,
    title: 'Sign up in 10 seconds',
    subtitle: 'Zero friction onboarding',
    description: 'Google or email authentication. No credit card required, no setup wizards, no 12-step questionnaires.',
    badge: 'Step 01 • Instant Access',
  },
  {
    step: '02',
    id: 'step-2',
    icon: BookOpen,
    title: 'Pick your subject',
    subtitle: 'AI workspace customization',
    description: 'Tell us what you’re studying — whether it’s Medicine, CS, Law, or Math. NoteZ instantly tailors flashcards & exams.',
    badge: 'Step 02 • Tailored AI',
  },
  {
    step: '03',
    id: 'step-3',
    icon: Trophy,
    title: 'Start a study streak',
    subtitle: 'XP & retention rewards',
    description: 'Quizzes, flashcards, and Pomodoro focus sessions track into your daily streak & level up your XP from day one.',
    badge: 'Step 03 • Gamified Mastery',
  },
];

const subjects = [
  { name: 'Computer Science', icon: '💻', count: '14,200 notes' },
  { name: 'Medical Science', icon: '🩺', count: '28,900 cards' },
  { name: 'Law & Ethics', icon: '⚖️', count: '9,400 FAQs' },
  { name: 'Mathematics', icon: '📐', count: '11,100 examples' },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [streakCount, setStreakCount] = useState(7);
  const [signedIn, setSignedIn] = useState(false);

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden bg-background">
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/80 bg-card/60 backdrop-blur-md text-xs font-medium text-muted-foreground mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>60 Seconds to Start</span>
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3 leading-[1.1]">
            From zero to <span className="gradient-text bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground">studying</span> in three steps.
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            No setup wizards. No 12-step onboarding. Just open it and learn.
          </p>
        </motion.div>

        {/* 2 Column Step Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* Left Column: Step List */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-center">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`cursor-pointer p-4 sm:p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? 'border-primary/60 bg-card/90 shadow-md ring-1 ring-primary/20'
                      : 'border-border/60 bg-card/30 hover:bg-card/60 hover:border-border'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}

                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-mono font-semibold text-primary">{step.badge}</span>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/40">{step.step}</span>
                      </div>
                      <h3 className="font-display text-base font-bold tracking-tight text-foreground mb-0.5">
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Step Preview Box */}
          <div className="lg:col-span-7">
            <div className="p-5 sm:p-7 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-xl h-full flex flex-col justify-between relative overflow-hidden min-h-[320px]">
              
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-[11px] font-mono text-muted-foreground">Interactive Simulator • Step {activeStep + 1} of 3</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                  {steps[activeStep].subtitle}
                </span>
              </div>

              {/* Simulation Content */}
              <div className="my-4">
                <AnimatePresence mode="wait">
                  {activeStep === 0 && (
                    <motion.div
                      key="step-0-sim"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 text-center py-2"
                    >
                      <div className="max-w-sm mx-auto p-5 rounded-xl border border-border/80 bg-secondary/30 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-display font-semibold text-sm">One-Click Authentication</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">No credit card or wizard setup.</p>
                        </div>

                        {!signedIn ? (
                          <button
                            onClick={() => setSignedIn(true)}
                            className="w-full py-2.5 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Simulate Google Sign-In</span>
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Signed in as student@notez.ai — Ready!</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 1 && (
                    <motion.div
                      key="step-1-sim"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 py-1"
                    >
                      <p className="text-[11px] text-muted-foreground font-mono uppercase text-center">Click a subject to customize workspace:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {subjects.map((sub, idx) => (
                          <div
                            key={sub.name}
                            onClick={() => setSelectedSubject(idx)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                              selectedSubject === idx
                                ? 'bg-primary/10 border-primary text-foreground font-semibold shadow'
                                : 'bg-secondary/30 border-border/60 hover:bg-secondary/60 text-muted-foreground'
                            }`}
                          >
                            <span className="text-xl">{sub.icon}</span>
                            <div>
                              <p className="text-xs text-foreground font-medium">{sub.name}</p>
                              <p className="text-[10px] text-muted-foreground">{sub.count}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div
                      key="step-2-sim"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 text-center py-1"
                    >
                      <div className="p-5 rounded-xl border border-border/80 bg-secondary/30 max-w-sm mx-auto space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
                          <Flame className="w-3.5 h-3.5 fill-amber-400" />
                          <span>Streak Active: {streakCount} Days!</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Every completed session adds XP and builds retention momentum.</p>

                        <div className="flex justify-center">
                          <button
                            onClick={() => setStreakCount((prev) => prev + 1)}
                            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:opacity-90 transition-all shadow"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Complete Quiz (+1 Day Streak)</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`h-1.5 rounded-full cursor-pointer transition-all ${
                        activeStep === i ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground'
                      }`}
                    />
                  ))}
                </div>

                <Button asChild size="sm" className="rounded-lg px-4 text-xs font-medium glow-purple">
                  <Link to="/signup">
                    <span>Get Started Free</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
