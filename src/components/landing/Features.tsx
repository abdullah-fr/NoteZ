import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dashboardVideo from '../../../videos/dashboard.mov';
import dashboardPreview from '../../../videos/dashboard-preview.jpg';
import {
  ArrowRight,
  ChevronDown,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  GraduationCap,
  Layers,
  ListChecks,
  MessageSquare,
  Mic,
  PanelLeft,
  PenLine,
  Play,
  Send,
  Sparkles,
  Timer,
  Upload,
  WandSparkles,
} from 'lucide-react';

type FeatureId =
  | 'dashboard'
  | 'folders'
  | 'exam'
  | 'flashcards'
  | 'activities'
  | 'notez-ai'
  | 'calendar'
  | 'focus-timer';

interface FeatureItem {
  id: FeatureId;
  title: string;
  icon: typeof Folder;
  eyebrow: string;
  description: string;
  workflow: string;
}

const features: FeatureItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: PanelLeft,
    eyebrow: 'Your study overview',
    description: 'See folders, practice, activities, and focus progress at a glance so the next useful action is always close.',
    workflow: 'Review your momentum',
  },
  {
    id: 'folders',
    title: 'Folders',
    icon: Folder,
    eyebrow: 'Material and editor',
    description: 'Create folders, keep notes together, import documents, and work in a rich editor with AI assistance and an outline rail.',
    workflow: 'Organize and write',
  },
  {
    id: 'exam',
    title: 'Exam',
    icon: GraduationCap,
    eyebrow: 'Practice and feedback',
    description: 'Generate a practice or mock exam from your material, answer questions, and use the results to see where to review next.',
    workflow: 'Test your understanding',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    icon: Layers,
    eyebrow: 'Active recall',
    description: 'Generate cards from notes, reveal the answer, and review each card with spaced-repetition ratings.',
    workflow: 'Strengthen recall',
  },
  {
    id: 'activities',
    title: 'Activities',
    icon: ListChecks,
    eyebrow: 'Material to action',
    description: 'Import study material and turn it into task packages you can complete, track, and revisit.',
    workflow: 'Turn plans into progress',
  },
  {
    id: 'notez-ai',
    title: 'NoteZ AI',
    icon: MessageSquare,
    eyebrow: 'Context-aware study chat',
    description: 'Ask about a folder or note, choose a thinking mode, and get explanations grounded in the material you are studying.',
    workflow: 'Ask better questions',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    icon: CalendarDays,
    eyebrow: 'Plan the week',
    description: 'Keep tasks, deadlines, and events together with clear priorities and study blocks you can act on.',
    workflow: 'Make time visible',
  },
  {
    id: 'focus-timer',
    title: 'Focus Timer',
    icon: Timer,
    eyebrow: 'Focused sessions',
    description: 'Start a Focus session, switch to Break when it is time, and keep your study rhythm connected to the rest of NoteZ.',
    workflow: 'Protect deep work',
  },
];

function DemoFrame({ feature, index, children }: { feature: FeatureItem; index: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="rounded-2xl border border-border/80 bg-card/70 shadow-xl overflow-hidden"
      aria-label={`${feature.title} product demonstration`}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/70 bg-secondary/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </div>
          <span className="truncate text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            NoteZ / {feature.title}
          </span>
        </div>
        <span className="shrink-0 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-primary">
          Product demo
        </span>
      </div>

      <div className={feature.id === 'dashboard' ? 'p-2 sm:p-3' : 'p-4 sm:p-6 min-h-[360px] flex items-center'}>
        {children}
      </div>

      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-t border-border/70 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span className="shrink-0">Section {String(index + 1).padStart(2, '0')} / 08</span>
        <div className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((index + 1) / features.length) * 100}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
        <span className="shrink-0 text-foreground/50">Interactive</span>
      </div>
    </motion.div>
  );
}

function DashboardDemo() {
  return (
    <div className="relative aspect-video max-h-[calc(100vh-10rem)] w-full overflow-hidden rounded-xl bg-background/70">
      <video
        src={dashboardVideo}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 block h-full w-full object-contain"
        aria-label="NoteZ dashboard product demonstration"
        onLoadedMetadata={(event) => {
          event.currentTarget.defaultPlaybackRate = 1.5;
          event.currentTarget.playbackRate = 1.5;
        }}
        onPlay={(event) => {
          event.currentTarget.playbackRate = 1.5;
        }}
      />
    </div>
  );
}

function FeaturePreview({ feature, onViewDemo }: { feature: FeatureItem; onViewDemo: () => void }) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-xl"
      aria-label={`${feature.title} section preview`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-secondary/20 px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        </div>
        <button
          type="button"
          onClick={onViewDemo}
          className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-primary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={`View full ${feature.title} demo`}
        >
          View full demo
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {feature.id === 'dashboard' ? (
        <img
          src={dashboardPreview}
          alt="NoteZ dashboard overview"
          className="block aspect-[1264/755] w-full object-cover object-top"
        />
      ) : (
        <div className="flex aspect-[1264/755] flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-xl font-semibold text-foreground">{feature.title}</p>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{feature.eyebrow}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FoldersDemo() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Folders / Operating Systems</p>
          <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Write, import, and keep context</h3>
        </div>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] font-semibold text-primary">
          <Upload className="h-3.5 w-3.5" /> Import document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)_92px] gap-3">
        <div className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 px-1.5 pb-2 border-b border-border/60 text-[10px] font-semibold text-foreground">
            <Folder className="h-3.5 w-3.5 text-primary" /> Folders
          </div>
          {['Operating Systems', 'SQA Notes', 'Algorithms'].map((folder, index) => (
            <div key={folder} className={`rounded-lg px-2 py-2 text-[10px] ${index === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>
              {folder}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/70 bg-background/70 p-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate text-xs font-semibold text-foreground">Process Scheduling Notes</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
              <PenLine className="h-3 w-3" /> Editing
            </div>
          </div>
          <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-display text-sm font-semibold text-foreground">CPU scheduling</p>
            <p>Choose the next process from the ready queue to keep the processor productive.</p>
            <p><span className="font-semibold text-primary underline decoration-primary/70 underline-offset-2">Shortest Job First</span> can reduce average waiting time when burst lengths are known.</p>
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2 text-[10px] text-primary">
              <WandSparkles className="h-3.5 w-3.5 shrink-0" /> AI Assist: explain the highlighted concept
            </div>
            <motion.span className="inline-block h-3.5 w-px bg-primary align-middle" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Outline</p>
          {['CPU scheduling', 'Algorithms', 'Trade-offs'].map((item, index) => (
            <div key={item} className={`border-l-2 pl-2 text-[9px] ${index === 0 ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExamDemo() {
  const options = [
    { label: 'It reduces context switching overhead', correct: true },
    { label: 'It removes the ready queue', correct: false },
    { label: 'It guarantees zero waiting time', correct: false },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><GraduationCap className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-foreground">Operating Systems Exam</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Practice mode · Question 4 of 10</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-primary"><Timer className="h-3.5 w-3.5" /> Focus Timer synced</span>
      </div>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><motion.div className="h-full rounded-full bg-primary" initial={{ width: '0%' }} animate={{ width: '40%' }} transition={{ duration: 0.6 }} /></div>

      <div className="rounded-xl border border-border/70 bg-background/70 p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold leading-relaxed text-foreground">Why can a shorter scheduling quantum improve responsiveness?</p>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[11px] ${option.correct ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground'}`}>
              <span>{option.label}</span>
              {option.correct && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary"><Sparkles className="h-3 w-3" /> Result feedback</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Correct. Shorter turns let waiting processes receive attention sooner.</p>
        </div>
      </div>
    </div>
  );
}

function FlashcardsDemo() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Flashcards / Operating Systems</p>
          <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Review what needs practice</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> Generated from notes</span>
      </div>

      <button type="button" onClick={() => setFlipped((value) => !value)} className="w-full rounded-xl border border-primary/35 bg-primary/10 p-5 sm:p-7 text-left transition-colors hover:bg-primary/15">
        <div className="flex items-center justify-between gap-3 mb-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Card 04 / 12</span>
          <span className="text-[10px] font-medium text-primary">{flipped ? 'Answer' : 'Click to reveal'}</span>
        </div>
        {flipped ? (
          <p className="font-display text-lg sm:text-xl font-semibold leading-relaxed text-primary">Round Robin gives each process a fixed time slice before moving to the next.</p>
        ) : (
          <p className="font-display text-lg sm:text-xl font-semibold leading-relaxed text-foreground">What is the purpose of a scheduling quantum?</p>
        )}
      </button>

      <div className="grid grid-cols-4 gap-2">
        {[['Again', '10m'], ['Hard', '1d'], ['Good', '3d'], ['Easy', '7d']].map(([label, time], index) => (
          <button key={label} type="button" className={`rounded-lg border px-2 py-2 text-center transition-colors ${index === 2 ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30'}`}>
            <span className="block text-[10px] font-semibold">{label}</span>
            <span className="block text-[9px] opacity-70">{time}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivitiesDemo() {
  const tasks = [
    { label: 'Define preemptive scheduling', done: true },
    { label: 'Compare FCFS and Round Robin', done: true },
    { label: 'Explain waiting-time trade-offs', done: false },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Activities / Imported material</p>
          <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">A document becomes a plan</h3>
        </div>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-[10px] font-semibold text-foreground">
          <Upload className="h-3.5 w-3.5 text-primary" /> Import document
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><FileText className="h-4 w-4" /></div>
            <div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground">Operating Systems.pdf</p><p className="text-[10px] text-muted-foreground">Generated task package</p></div>
          </div>
          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-mono text-primary">2 / 3</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><motion.div className="h-full w-2/3 rounded-full bg-primary" animate={{ width: ['58%', '66%', '58%'] }} transition={{ duration: 2.8, repeat: Infinity }} /></div>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.label} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
              <span className={`h-4 w-4 rounded-md border flex items-center justify-center ${task.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}><Check className="h-3 w-3" /></span>
              <span className={`text-[11px] ${task.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotezAiDemo() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Brain className="h-5 w-5" /></div>
          <div><p className="text-xs font-semibold text-foreground">NoteZ AI</p><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ask this Folder / Note</p></div>
        </div>
        <span className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground">Thinking: <strong className="text-foreground">High</strong></span>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
        <div className="ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-secondary px-3 py-2.5 text-[11px] leading-relaxed text-foreground">Explain the difference between preemptive and non-preemptive scheduling.</div>
        <div className="flex gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-lg border border-primary/25 bg-primary/10 flex items-center justify-center text-primary"><Sparkles className="h-3.5 w-3.5" /></div>
          <div className="min-w-0 rounded-xl rounded-bl-sm border border-border/70 bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground mb-1.5">The short version</p>
            <p>Preemptive scheduling can interrupt a running process; non-preemptive scheduling lets it continue until its current turn finishes.</p>
            <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-md bg-primary/10 px-2 py-1 text-[9px] text-primary">From Operating Systems</span><span className="rounded-md bg-secondary px-2 py-1 text-[9px] text-muted-foreground">Summarize</span></div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
        <span className="text-[10px] text-muted-foreground flex-1">Ask a follow-up question…</span>
        <Mic className="h-3.5 w-3.5 text-muted-foreground" />
        <Send className="h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
}

function CalendarDemo() {
  const events = [
    { time: '09:00 AM', title: 'Review Operating Systems', type: 'Task', priority: 'High', color: 'text-rose-400' },
    { time: '12:30 PM', title: 'Flashcard review', type: 'Task', priority: 'Medium', color: 'text-amber-400' },
    { time: '04:00 PM', title: 'Mock exam deadline', type: 'Deadline', priority: 'Low', color: 'text-emerald-400' },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Calendar / Today</p><h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Today’s plan</h3></div>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] font-semibold text-primary"><CalendarDays className="h-3.5 w-3.5" /> Add</button>
      </div>
      <div className="rounded-xl border border-border/70 bg-background/70 p-3 space-y-2">
        {events.map((event, index) => (
          <motion.div key={event.title} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-3">
            <span className="w-16 shrink-0 text-[10px] font-mono text-muted-foreground">{event.time}</span>
            <div className="h-8 w-px bg-primary/40" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground">{event.title}</p><p className="text-[10px] text-muted-foreground">{event.type}</p></div>
            <span className={`shrink-0 text-[10px] font-semibold ${event.color}`}>◆ {event.priority}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FocusTimerDemo() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Focus Timer</p><h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Make room for deep work</h3></div>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-primary"><Clock3 className="h-3.5 w-3.5" /> Linked to your study flow</span>
      </div>
      <div className="rounded-xl border border-border/70 bg-background/70 p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative h-36 w-36 shrink-0 rounded-full border-[7px] border-secondary border-t-primary border-r-primary/60 flex items-center justify-center">
          <div className="text-center"><p className="font-mono text-2xl font-semibold text-foreground">25:00</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Focus</p></div>
        </div>
        <div className="w-full space-y-4">
          <div className="flex rounded-lg border border-border/70 bg-card p-1"><span className="flex-1 rounded-md bg-primary/10 py-2 text-center text-[11px] font-semibold text-primary">Focus</span><span className="flex-1 py-2 text-center text-[11px] text-muted-foreground">Break</span></div>
          <div><p className="text-xs font-semibold text-foreground">Operating Systems review</p><p className="mt-1 text-[10px] text-muted-foreground">Session 02 · notes and flashcards stay in reach</p></div>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[11px] font-semibold text-primary-foreground"><Play className="h-3.5 w-3.5 fill-current" /> Start Focus</button>
        </div>
      </div>
    </div>
  );
}

function FeatureDemo({ feature, index }: { feature: FeatureItem; index: number }) {
  let content: ReactNode;
  switch (feature.id) {
    case 'dashboard': content = <DashboardDemo />; break;
    case 'folders': content = <FoldersDemo />; break;
    case 'exam': content = <ExamDemo />; break;
    case 'flashcards': content = <FlashcardsDemo />; break;
    case 'activities': content = <ActivitiesDemo />; break;
    case 'notez-ai': content = <NotezAiDemo />; break;
    case 'calendar': content = <CalendarDemo />; break;
    case 'focus-timer': content = <FocusTimerDemo />; break;
  }

  return (
    <DemoFrame feature={feature} index={index}>
      {content}
    </DemoFrame>
  );
}

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = features[activeIndex];
  const ActiveIcon = activeFeature.icon;
  const scrollToDemo = () => {
    document.getElementById('feature-demo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section id="features" className="relative overflow-hidden bg-background/50 py-20 sm:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] lg:grid-rows-[auto_auto] lg:gap-x-10 lg:gap-y-4">
          <div className="max-w-3xl lg:col-start-1 lg:row-start-1">
            <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.24em] text-primary">The NoteZ workflow</p>
            <h2 className="mb-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Study material in.<br /><span className="text-primary">Momentum out.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Move from organized material to focused practice, feedback, and better recall through the sections you actually use.
            </p>
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:sticky lg:top-28">
            <div className="border-l-2 border-border/70 pl-3" aria-label="NoteZ sections">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-pressed={isActive}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground group-hover:text-foreground'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">{feature.title}</span>
                      <span className={`block truncate text-[10px] ${isActive ? 'text-primary/80' : 'text-muted-foreground/70'}`}>{feature.workflow}</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-50">{String(index + 1).padStart(2, '0')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:flex lg:h-full lg:flex-col lg:justify-end">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <ActiveIcon className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em]">{activeFeature.eyebrow}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{activeFeature.title}</h3>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{activeFeature.description}</p>
              </div>
              <ArrowRight className="mb-1 hidden h-5 w-5 shrink-0 text-primary sm:block" />
            </div>

          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <AnimatePresence mode="wait" initial={false}>
              <FeaturePreview key={activeFeature.id} feature={activeFeature} onViewDemo={scrollToDemo} />
            </AnimatePresence>
          </div>
        </div>

        <div id="feature-demo" className="mt-10 scroll-mt-24 sm:mt-14">
          <AnimatePresence mode="wait" initial={false}>
            <FeatureDemo key={activeFeature.id} feature={activeFeature} index={activeIndex} />
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
