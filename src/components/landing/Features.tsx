import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Brain,
  Layers,
  FileQuestion,
  Lightbulb,
  Calendar,
  FileText,
  Timer,
  Zap,
  CheckCircle2,
  Sparkles,
  Flame,
  Search,
  Command,
  Code2,
  Check,
  ChevronRight
} from 'lucide-react';

interface FeatureItem {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  mockupType: string;
}

const features: FeatureItem[] = [
  {
    id: 'ai-exams',
    icon: Brain,
    title: 'Adaptive AI exams',
    subtitle: 'Real-time difficulty adjustment',
    description: 'Diagnostic questions that get harder as you improve. Instant step-by-step explanations on every answer.',
    badge: 'AI Diagnostic',
    mockupType: 'exam',
  },
  {
    id: 'spaced-cards',
    icon: Layers,
    title: 'Spaced flashcards',
    subtitle: 'Scientifically proven retention',
    description: 'Review what you’re about to forget. Active recall powered by FSRS algorithm — the way memory actually works.',
    badge: 'Spaced Repetition',
    mockupType: 'flashcard',
  },
  {
    id: 'topic-faqs',
    icon: FileQuestion,
    title: 'Topic FAQs',
    subtitle: 'Instant answer repository',
    description: 'Skim the questions everyone asks about a subject — answered, searchable, and deep-linked into your notes.',
    badge: 'Instant Q&A',
    mockupType: 'faq',
  },
  {
    id: 'worked-examples',
    icon: Lightbulb,
    title: 'Worked examples',
    subtitle: 'Step-by-step problem solver',
    description: 'Real-world problems with step-by-step reasoning. Copy, tweak, and learn by active doing.',
    badge: 'Step-by-step',
    mockupType: 'worked',
  },
  {
    id: 'study-planner',
    icon: Calendar,
    title: 'Study planner',
    subtitle: 'Exam date countdown & scheduling',
    description: 'Plan sessions around your exam date. We schedule the right material on the right day so you never cram.',
    badge: 'Smart Calendar',
    mockupType: 'planner',
  },
  {
    id: 'smart-notes',
    icon: FileText,
    title: 'Smart notes',
    subtitle: 'Self-organizing workspace',
    description: 'Notes that organize themselves by subject and topic. Find anything across your workspace in two keystrokes.',
    badge: 'Auto-Organized',
    mockupType: 'notes',
  },
  {
    id: 'focus-sessions',
    icon: Timer,
    title: 'Focus sessions',
    subtitle: 'Integrated Pomodoro & Streaks',
    description: 'Pomodoro timer built-in. Deep work tracked into your streak counter and XP rewards automatically.',
    badge: 'Deep Work',
    mockupType: 'focus',
  },
  {
    id: 'built-for-speed',
    icon: Zap,
    title: 'Built for speed',
    subtitle: 'Keyboard-first architecture',
    description: 'Keyboard-first, mobile-first, dark by default. Instant response times with no bloat and no waiting.',
    badge: 'Sub-50ms',
    mockupType: 'speed',
  },
];

// Visual Picture Component for Feature Mockups
function FeatureMockup({ type }: { type: string }) {
  const [flipped, setFlipped] = useState(false);

  switch (type) {
    case 'exam':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-3.5 font-sans">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Adaptive Exam • Q4 of 10</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Score: 92% (High)
            </span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-foreground mb-2.5">
              How does Long-Term Potentiation (LTP) strengthen synaptic efficacy in the hippocampus?
            </p>
            <div className="space-y-1.5">
              {[
                { text: 'By increasing NMDA receptor density & Ca2+ influx', correct: true },
                { text: 'By decreasing neurotransmitter release', correct: false },
                { text: 'By blocking AMPA receptors permanently', correct: false },
              ].map((opt, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between border transition-all ${
                    opt.correct
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium'
                      : 'bg-secondary/40 border-border/50 text-muted-foreground'
                  }`}
                >
                  <span>{opt.text}</span>
                  {opt.correct && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground/90 space-y-1">
            <span className="font-semibold flex items-center gap-1.5 text-primary text-[11px]">
              <Sparkles className="w-3 h-3" /> AI Explanation:
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              LTP relies on high-frequency stimulation causing persistent glutamate binding to NMDA receptors, triggering intracellular Ca2+ cascades.
            </p>
          </div>
        </div>
      );

    case 'flashcard':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Card 14 of 48 • Neuroscience</span>
            <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <Flame className="w-3 h-3 fill-amber-400" /> Due Today
            </span>
          </div>

          <div
            onClick={() => setFlipped(!flipped)}
            className="p-4 rounded-lg border border-dashed border-border/80 bg-secondary/30 text-center cursor-pointer hover:border-primary/50 transition-all flex flex-col items-center justify-center min-h-[90px]"
          >
            {!flipped ? (
              <>
                <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">FRONT (Click to Flip)</p>
                <p className="text-xs sm:text-sm font-medium text-foreground">Define "Cognitive Load Theory" in instructional design.</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-emerald-400 uppercase font-mono mb-1">BACK (ANSWER)</p>
                <p className="text-xs sm:text-sm font-medium text-emerald-200">
                  Working memory capacity limit: Intrinsic, Extraneous, and Germane load.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-border/60">
            {[
              { label: 'Again', time: '10m', color: 'hover:bg-rose-500/20 text-rose-400 border-rose-500/30' },
              { label: 'Hard', time: '1d', color: 'hover:bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { label: 'Good', time: '3d', color: 'hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
              { label: 'Easy', time: '7d', color: 'hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
            ].map((btn) => (
              <button
                key={btn.label}
                className={`py-1 px-1.5 rounded border text-center text-[11px] transition-colors bg-secondary/50 ${btn.color}`}
              >
                <div className="font-semibold">{btn.label}</div>
                <div className="text-[9px] opacity-75">{btn.time}</div>
              </button>
            ))}
          </div>
        </div>
      );

    case 'faq':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              readOnly
              value="Search FAQs: 'How to calculate standard deviation?'"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-secondary/50 border border-border/60 text-xs text-foreground focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            {[
              { q: 'What is the physical meaning of Eigenvalues?', tag: 'Linear Algebra', count: '1.2k views' },
              { q: 'How does Backpropagation calculate gradients?', tag: 'Machine Learning', count: '3.4k views' },
              { q: 'What is the difference between MIT & Apache license?', tag: 'Computer Science', count: '890 views' },
            ].map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground mb-0.5">{item.q}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {item.tag}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'worked':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-primary" /> Worked Example: Binary Search Tree Insert
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium">
              Copy & Tweak
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="p-2 rounded-lg bg-secondary/60 border border-border/50 font-mono text-emerald-400 text-[11px]">
              Step 1: Compare target key with current node value.
            </div>
            <div className="p-2 rounded-lg bg-secondary/60 border border-border/50 font-mono text-blue-400 text-[11px]">
              Step 2: If key &lt; node.val, recurse left; else recurse right.
            </div>
            <div className="p-2 rounded-lg bg-secondary/60 border border-border/50 font-mono text-amber-300 text-[11px]">
              Step 3: Attach new TreeNode at null position.
            </div>
          </div>
        </div>
      );

    case 'planner':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Exam Date: Dec 18, 2026</p>
              <p className="text-[10px] text-amber-400 font-mono">⏳ 12 Days Remaining</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              On Track (84%)
            </span>
          </div>

          <div className="space-y-1.5">
            {[
              { time: '09:00 AM', task: 'Neuroscience Chapter 4 Flashcards', done: true },
              { time: '11:30 AM', task: 'Adaptive Quiz: Action Potentials', done: true },
              { time: '03:00 PM', task: 'Focus Session: Practice Exam 2', done: false },
            ].map((item, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-500 text-black' : 'border border-border'}`}>
                    {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={item.done ? 'line-through text-muted-foreground text-[11px]' : 'text-foreground font-medium text-[11px]'}>
                    {item.task}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'notes':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold text-foreground">📁 Workspace / Medical Science</span>
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Command className="w-3 h-3" /> K
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 space-y-0.5">
              <p className="font-medium text-foreground text-[11px]">📄 Apoptosis vs Necrosis.md</p>
              <p className="text-[9px] text-muted-foreground">Updated 2 mins ago</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 space-y-0.5">
              <p className="font-medium text-foreground text-[11px]">📄 Ischemic Injury Notes.md</p>
              <p className="text-[9px] text-muted-foreground">Updated 1 hr ago</p>
            </div>
          </div>
        </div>
      );

    case 'focus':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary flex items-center justify-center shadow-md">
              <span className="text-sm font-mono font-bold text-foreground">25:00</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Deep Work Pomodoro</p>
              <p className="text-[11px] text-muted-foreground">Session 3 of 4 • Organic Chemistry</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5 fill-amber-400" /> 14 Day Streak
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  +150 XP
                </span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'speed':
      return (
        <div className="w-full rounded-xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Instant Command Palette
            </span>
            <span className="text-[9px] font-mono text-emerald-400">Response time: 14ms</span>
          </div>

          <div className="space-y-1">
            {[
              { cmd: 'Cmd + Shift + F', action: 'Create Flashcard Deck' },
              { cmd: 'Cmd + Shift + Q', action: 'Generate Diagnostic Quiz' },
              { cmd: 'Cmd + Shift + T', action: 'Start Pomodoro Session' },
            ].map((item, idx) => (
              <div key={idx} className="p-1.5 rounded bg-secondary/30 border border-border/40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">{item.action}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[9px] text-foreground">
                  {item.cmd}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section id="features" className="relative py-16 sm:py-24 bg-background/50 overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Mobile Section Header */}
        <div className="lg:hidden text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-muted-foreground mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Everything in One Workspace
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight mb-2">
            One app. <span className="gradient-text">One solution.</span>
          </h2>
          <p className="text-muted-foreground text-xs max-w-md mx-auto">
            Stop juggling Notion, Anki, and ten Chrome tabs. NoteZ replaces them with one calm workspace.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Sticky Left Column */}
          <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-28 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/80 bg-card/60 backdrop-blur-md text-xs font-medium text-muted-foreground mb-4">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Everything in One Workspace</span>
              </div>

              <h2 className="font-display text-4xl xl:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
                One app.{"\n"}
                <span className="gradient-text bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground">
                  One solution.
                </span>
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Stop juggling Notion, Anki, and ten Chrome tabs. NoteZ replaces them with one calm, ultra-fast workspace designed for deep learning.
              </p>

              {/* Progress Index List */}
              <div className="space-y-1 border-l-2 border-border/60 pl-4">
                {features.map((feature, idx) => (
                  <button
                    key={feature.id}
                    onClick={() => {
                      setActiveIndex(idx);
                      const el = document.getElementById(`feature-card-${feature.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                      activeIndex === idx
                        ? 'text-primary bg-primary/10 font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                        activeIndex === idx ? 'bg-primary scale-125' : 'bg-border'
                      }`} />
                      {feature.title}
                    </span>
                    <span className="font-mono text-[10px] opacity-60">0{idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Feature Cards */}
          <div className="lg:col-span-7 space-y-8 sm:space-y-10">
            {features.map((feature, idx) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                index={idx}
                onInView={() => setActiveIndex(idx)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
  onInView,
}: {
  feature: FeatureItem;
  index: number;
  onInView: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.4 });

  useEffect(() => {
    if (isInView) {
      onInView();
    }
  }, [isInView, onInView]);

  return (
    <motion.div
      id={`feature-card-${feature.id}`}
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="p-5 sm:p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-lg hover:border-primary/40 transition-all space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <feature.icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {feature.badge}
            </span>
            <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
              {feature.title}
            </h3>
          </div>
        </div>
        <span className="text-xl font-display font-bold text-muted-foreground/30 font-mono">
          0{index + 1}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold text-primary mb-0.5">
          {feature.subtitle}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>

      <div>
        <FeatureMockup type={feature.mockupType} />
      </div>
    </motion.div>
  );
}
