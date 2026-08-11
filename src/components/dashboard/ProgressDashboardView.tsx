import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useTimer } from '@/lib/timer';
import { useCalendar, dayLabel } from '@/lib/calendar';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchProgressData, subscribeToProgressUpdates,
  type UserProgress, type ExamResult, type StudySession,
} from '@/services';
import { fetchActivities, fetchChecklistItems } from '@/services';
import {
  Flame, Clock, GraduationCap, Sparkles, CalendarRange, Loader2,
  Activity, CheckSquare, Flag, CalendarDays, AlertCircle, BookOpen, Brain,
  Folder, FileQuestion, Check, X, ChevronRight,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, isWithinInterval, parseISO,
  eachDayOfInterval, getDay, differenceInCalendarDays, addMonths,
} from 'date-fns';
import CardDisplay, { type CardDisplayItem } from './widgets/CardDisplay';

const MONTHLY_EXAM_GOAL = 10;

/* ══════════════════════════════════════════════════════════════
   CRAM COUNTDOWN BANNER  (Prompt 12)
   Shows nearest Deadline event within 72 hours.
   Dismissible per-session; never stacks multiple banners.
══════════════════════════════════════════════════════════════ */
function CramCountdownBanner({ activities }: { activities: { subject: string; progress: number }[] }) {
  const { getUpcoming } = useCalendar();
  const [dismissed, setDismissed] = useState(false);

  const nearest = useMemo(() => {
    return getUpcoming(3).find(e => e.type === 'deadline') ?? null;
  }, [getUpcoming]);

  const activityMatch = useMemo(() => {
    if (!nearest) return null;
    const needle = nearest.title.toLowerCase();
    return activities.find(a =>
      needle.includes(a.subject.toLowerCase()) ||
      a.subject.toLowerCase().includes(needle.split(' ')[0])
    ) ?? null;
  }, [nearest, activities]);

  if (!nearest || dismissed) return null;

  const hoursAway = Math.round(
    (nearest.date.getTime() - Date.now()) / 3_600_000
  );
  const timeLabel = hoursAway < 24
    ? `${hoursAway}h`
    : `${Math.round(hoursAway / 24)}d`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
      className="relative flex items-center gap-3 rounded-sm border border-border/80 bg-card/80 px-4 py-3"
    >
      <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <p className="flex-1 text-[12px] text-foreground/90 leading-snug">
        <span className="font-medium">{nearest.title}</span>
        {' '}in{' '}
        <span className="font-mono text-foreground">{timeLabel}</span>
        {activityMatch && (
          <> — you're{' '}
            <span className="font-mono text-foreground">{activityMatch.progress}%</span>
            {' '}through{' '}
            <span className="font-medium">{activityMatch.subject}</span>
          </>
        )}
      </p>
      <button onClick={() => setDismissed(true)}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss deadline banner"
      ><X className="h-3 w-3" /></button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WEEKLY RECAP  (Prompt 9)
   Calls coach-advice once per week on first login after Mon rollover.
   Dismissible for the session; reappears next week.
══════════════════════════════════════════════════════════════ */
const RECAP_STORAGE_KEY = 'notez_recap_shown_week';

function getISOWeek(d: Date) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
}

interface RecapData {
  learning_speed?: string;
  retention_rate?: string;
  consistency_score?: string;
  strong_areas?: string[];
  weak_areas?: string[];
  recommendations?: string[];
  message?: string;
}

function WeeklyRecap({
  userId, sessions, examResults, progress,
}: {
  userId: string;
  sessions: StudySession[];
  examResults: ExamResult[];
  progress: UserProgress;
}) {
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const thisWeek = `${new Date().getFullYear()}-W${getISOWeek(new Date())}`;
    const shown = localStorage.getItem(RECAP_STORAGE_KEY);
    if (shown === thisWeek || fetchedRef.current) return;
    // Only show if the user has at least some history
    if (sessions.length === 0 && examResults.length === 0) return;
    fetchedRef.current = true;

    setLoading(true);
    supabase.functions.invoke('coach-advice', {
      body: {
        type: 'progress-analysis',
        context: {
          sessions: sessions.slice(-50),
          examResults: examResults.slice(-20),
          progress,
          period: 'last_7_days',
        },
      },
    }).then(({ data }) => {
      if (data && !data.error) {
        setRecap(data);
        localStorage.setItem(RECAP_STORAGE_KEY, thisWeek);
      }
    }).catch(() => {/* fail silently — never break dashboard */ })
      .finally(() => setLoading(false));
  }, [userId, sessions.length, examResults.length]);

  if (dismissed || loading || !recap) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-md border border-border bg-card p-5"
    >
      <span aria-hidden className="absolute left-0 top-0 h-px w-24 bg-foreground/40" />
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-lg tracking-tight">Weekly Recap</h3>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
            Your last 7 days
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="h-6 w-6 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss weekly recap"
        ><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Metrics row */}
      {(recap.learning_speed || recap.retention_rate || recap.consistency_score) && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Learning Speed', value: recap.learning_speed },
            { label: 'Retention Rate', value: recap.retention_rate },
            { label: 'Consistency', value: recap.consistency_score },
          ].filter(m => m.value).map(m => (
            <div key={m.label} className="rounded-sm border border-border/60 bg-secondary/30 p-3">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{m.label}</p>
              <p className="font-serif text-lg mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      {recap.message && (
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{recap.message}</p>
      )}

      {/* Areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recap.strong_areas && recap.strong_areas.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Strong areas</p>
            <ul className="space-y-1">
              {recap.strong_areas.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80">
                  <Check className="h-3 w-3 text-foreground/60 shrink-0" />{a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {recap.weak_areas && recap.weak_areas.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Needs work</p>
            <ul className="space-y-1">
              {recap.weak_areas.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80">
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />{a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {recap.recommendations && recap.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">This week</p>
          <ul className="space-y-1">
            {recap.recommendations.slice(0, 3).map((r, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-snug">
                {i + 1}. {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FIRST-RUN CHECKLIST
   Shown only when the account has zero activity. Disappears
   permanently once all three steps are complete.
══════════════════════════════════════════════════════════════ */
interface FirstRunStep {
  id: 'folder' | 'exam' | 'focus';
  label: string;
  cta: string;
  icon: React.ElementType;
  done: boolean;
  navigate: string; // view key passed to onNavigate
}

function FirstRunChecklist({
  hasFolders,
  hasExams,
  hasSessions,
  onNavigate,
}: {
  hasFolders: boolean;
  hasExams: boolean;
  hasSessions: boolean;
  onNavigate: (view: string) => void;
}) {
  const steps: FirstRunStep[] = [
    { id: 'folder', label: 'Create a folder', cta: 'Open Folders →', icon: Folder, done: hasFolders, navigate: 'folders' },
    { id: 'exam', label: 'Generate your first AI exam', cta: 'Try Exams →', icon: FileQuestion, done: hasExams, navigate: 'exam' },
    { id: 'focus', label: 'Start a 15-minute focus session', cta: 'Start Timer →', icon: Clock, done: hasSessions, navigate: 'focus' },
  ];
  const allDone = steps.every(s => s.done);
  if (allDone) return null;

  const doneCount = steps.filter(s => s.done).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-md border border-border bg-card p-5"
    >
      {/* Top-left accent line — matches CardDisplay */}
      <span aria-hidden className="absolute left-0 top-0 h-px w-24 bg-foreground/40" />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-serif text-lg tracking-tight">Get your first Learning Score</h3>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
            {doneCount} / 3 complete
          </p>
        </div>
        {/* Mini progress bar */}
        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          {steps.map(s => (
            <div
              key={s.id}
              className={`h-1.5 w-8 rounded-full transition-all duration-500 ${s.done ? 'bg-foreground/70' : 'bg-foreground/10 border border-border/60'
                }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`relative flex flex-col gap-2 rounded-sm border p-4 transition-all duration-200 ${step.done
                  ? 'border-border/40 bg-secondary/20 opacity-60'
                  : 'border-border/70 bg-secondary/30 hover:border-foreground/30 hover:bg-secondary/50'
                }`}
            >
              <div className="flex items-center gap-2">
                {step.done ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-foreground/30 bg-foreground/10">
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-border/60 bg-secondary/40">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <p className={`text-xs font-medium leading-snug ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {step.label}
                </p>
              </div>
              {!step.done && (
                <button
                  onClick={() => onNavigate(step.navigate)}
                  className="mt-auto self-start text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {step.cta}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}


/* ── static study suggestions ────────────────────────────────── */
const SUGGESTIONS = [
  { icon: BookOpen, text: 'Review your weakest flashcard deck today' },
  { icon: Brain, text: 'Take a 5-min quiz to reinforce recent notes' },
  { icon: Sparkles, text: 'Consistent short sessions beat marathon cramming' },
  { icon: Clock, text: 'Schedule a 25-min focus block before the day ends' },
  { icon: GraduationCap, text: 'Check your exam history and target weak topics' },
  { icon: Flag, text: 'Set a deadline for your next assignment to stay on track' },
];

/* ══════════════════════════════════════════════════════════════
   UPCOMING TASKS TICKER
══════════════════════════════════════════════════════════════ */
function UpcomingTicker({
  monthlyExamRate,
}: {
  monthlyExamRate: { pct: number; count: number; daysLeft: number };
}) {
  const { events, getUpcoming } = useCalendar();
  const { tasks: timerTasks } = useTimer();
  const [idx, setIdx] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Build the full item list every time dependencies change */
  const items = useMemo(() => {
    const result: { icon: any; label: string; badge?: string }[] = [];

    /* 1 — calendar deadlines / tasks from the next 14 days */
    getUpcoming(14).forEach(ev => {
      const Icon = ev.type === 'task' ? CheckSquare : ev.type === 'deadline' ? Flag : CalendarDays;
      result.push({ icon: Icon, label: ev.title, badge: dayLabel(ev.date) });
    });

    /* 2 — pending timer tasks */
    timerTasks.filter(t => !t.done).forEach(t => {
      result.push({ icon: Clock, label: t.label, badge: `${t.minutes}m` });
    });

    /* 3 — exam score reminder */
    if (monthlyExamRate.pct < 50) {
      result.push({
        icon: AlertCircle,
        label: `${monthlyExamRate.count}/${MONTHLY_EXAM_GOAL} exams this month`,
        badge: `${monthlyExamRate.daysLeft}d left`,
      });
    }

    /* 4 — static suggestions / recommendations */
    SUGGESTIONS.forEach(s => result.push({ icon: s.icon, label: s.text }));

    return result;
  }, [events, getUpcoming, timerTasks, monthlyExamRate]);

  /* Advance the ticker every 3 s */
  useEffect(() => {
    if (items.length === 0) return;
    ivRef.current = setInterval(() => setIdx(i => (i + 1) % items.length), 3000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [items.length]);

  /* Reset index when list rebuilds so it never goes out of range */
  useEffect(() => { setIdx(0); }, [items.length]);

  const current = items[idx] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="flex items-center gap-0 border border-border bg-secondary rounded-xl overflow-hidden h-11"
    >
      {/* Left label */}
      <div className="flex items-center gap-2 px-3 md:px-4 h-full border-r border-border shrink-0 bg-secondary">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground select-none whitespace-nowrap">
          Upcoming Tasks
        </span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 h-full overflow-hidden relative px-4 flex items-center min-w-0">
        {items.length === 0 ? (
          <span className="text-[11px] text-muted-foreground italic">All clear — no upcoming activities</span>
        ) : (
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="w-full flex items-center gap-2.5 truncate"
              >
                <current.icon className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span className="text-[12px] font-medium text-foreground truncate leading-none">
                  {current.label}
                </span>
                {current.badge && (
                  <span className="text-[10px] font-mono text-foreground bg-secondary border border-border rounded-md px-1.5 py-0.5 shrink-0">
                    {current.badge}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Right counter */}
      {items.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 h-full border-l border-border shrink-0">
          {/* Dot progress bar */}
          <div className="flex gap-1">
            {items.slice(0, Math.min(items.length, 10)).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: i === idx % Math.min(items.length, 10) ? 1 : 0.25 }}
                transition={{ duration: 0.3 }}
                className="w-1 h-1 rounded-full bg-[hsl(var(--foreground))]"
              />
            ))}
            {items.length > 10 && (
              <span className="text-[9px] font-mono text-muted-foreground ml-0.5">+{items.length - 10}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */
function streakMessage(days: number): string {
  if (days <= 0) return 'Begin today — every expert was once a beginner.';
  if (days < 3) return 'A spark has been lit. Keep it burning.';
  if (days < 7) return 'Momentum is building. Stay consistent.';
  if (days < 14) return 'Discipline is becoming habit. Impressive.';
  if (days < 30) return 'Two weeks strong — you are unstoppable.';
  if (days < 60) return 'A monthly master. Greatness is your routine.';
  return 'Legendary streak. You inspire by example.';
}
function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ProgressDashboardView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<UserProgress>({
    xp: 0, level: 1, streak_days: 0, total_study_minutes: 0,
    exams_completed: 0, flashcards_reviewed: 0, quizzes_completed: 0,
  });
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  // Activities for cram banner subject matching
  const [activitySubjects, setActivitySubjects] = useState<{ subject: string; progress: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ progress: p, examResults: e, sessions: s }, acts] = await Promise.all([
        fetchProgressData(user.id),
        fetchActivities(user.id).catch(() => []),
      ]);
      setProgress(p); setExamResults(e); setSessions(s);
      // Build per-subject progress map from activities
      const subjectMap: Record<string, { total: number; count: number }> = {};
      acts.forEach((a: any) => {
        const k = a.subject || 'General';
        subjectMap[k] ??= { total: 0, count: 0 };
        subjectMap[k].total += a.progress || 0;
        subjectMap[k].count += 1;
      });
      setActivitySubjects(
        Object.entries(subjectMap).map(([subject, v]) => ({
          subject,
          progress: Math.round(v.total / v.count),
        }))
      );
      setLoading(false);
    };
    load();
    return subscribeToProgressUpdates(user.id, load);
  }, [user]);

  /* ── monthly tracker stats ── */
  const trackerStats = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now); const end = endOfMonth(now);
    const inRange = (iso: string) => isWithinInterval(parseISO(iso), { start, end });
    const ps = sessions.filter(s => inRange(s.started_at));
    const pe = examResults.filter(e => inRange(e.created_at));
    const studyMinutes = ps.reduce((sum, s) => sum + s.duration_minutes, 0);
    const activeDaySet = new Set<string>();
    ps.forEach(s => activeDaySet.add(format(parseISO(s.started_at), 'yyyy-MM-dd')));
    pe.forEach(e => activeDaySet.add(format(parseISO(e.created_at), 'yyyy-MM-dd')));
    return { studyMinutes, activitiesCompleted: ps.length + pe.length, activeDays: activeDaySet.size };
  }, [sessions, examResults]);

  /* ── heatmap (12-month) ── */
  const heatmap = useMemo(() => {
    const now = new Date();
    const dayCounts = new Map<string, number>();
    sessions.forEach(s => { const k = format(parseISO(s.started_at), 'yyyy-MM-dd'); dayCounts.set(k, (dayCounts.get(k) || 0) + Math.max(1, Math.round(s.duration_minutes / 15))); });
    examResults.forEach(e => { const k = format(parseISO(e.created_at), 'yyyy-MM-dd'); dayCounts.set(k, (dayCounts.get(k) || 0) + 2); });
    const rangeStart = startOfMonth(now);
    const rangeEnd = endOfMonth(addMonths(rangeStart, 11));
    const all = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const max = Math.max(...Array.from(dayCounts.values()), 1);
    const pad = (getDay(rangeStart) + 6) % 7;
    const cells = [
      ...Array.from({ length: pad }, () => null as null | { date: Date; count: number; intensity: number }),
      ...all.map(d => { const count = dayCounts.get(format(d, 'yyyy-MM-dd')) || 0; return { date: d, count, intensity: count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)) }; }),
    ];
    const weeks: (typeof cells[number])[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const first = week.find(Boolean);
      if (!first) return;
      const m = first.date.getMonth();
      if (m !== lastMonth) { monthLabels.push({ col, label: format(first.date, 'MMM yyyy') }); lastMonth = m; }
    });
    return { weeks, monthLabels };
  }, [sessions, examResults]);

  /* ── monthly exam rate ── */
  const monthlyExamRate = useMemo(() => {
    const now = new Date(); const ms = startOfMonth(now); const me = endOfMonth(now);
    const count = examResults.filter(e => isWithinInterval(parseISO(e.created_at), { start: ms, end: me })).length;
    const pct = Math.min(100, Math.round((count / MONTHLY_EXAM_GOAL) * 100));
    return { count, pct, daysLeft: differenceInCalendarDays(me, now) };
  }, [examResults]);

  /* ── learning score /10 ── */
  const learningScore = useMemo(() => {
    const r14 = sessions.filter(s => differenceInCalendarDays(new Date(), parseISO(s.started_at)) <= 14);
    const m14 = r14.reduce((sum, s) => sum + s.duration_minutes, 0);
    const c = (Math.min(1, m14 / 600) * 0.35) + (Math.min(1, progress.streak_days / 14) * 0.25)
      + (Math.min(1, monthlyExamRate.count / MONTHLY_EXAM_GOAL) * 0.2)
      + (Math.min(1, (progress.quizzes_completed + progress.flashcards_reviewed / 5) / 30) * 0.2);
    return Math.round(c * 100) / 10;
  }, [sessions, progress, monthlyExamRate]);

  /* ── first-run checklist ── */
  const isFirstRun = progress.total_study_minutes === 0 && progress.exams_completed === 0;
  const hasFolders = (() => {
    try { return JSON.parse(localStorage.getItem('notez_folders') || '[]').length > 0; } catch { return false; }
  })();
  const hasExams = examResults.length > 0;
  const hasSessions = sessions.length > 0;

  /* ── per-subject progress (for cram banner) — real data from Activities ── */
  const subjectActivities = activitySubjects;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-foreground" /></div>;
  }

  const overviewCards: CardDisplayItem[] = [
    { id: 'focus-time', title: 'Focus Time', value: formatMinutes(progress.total_study_minutes), description: 'Total time in deep focus.', icon: Clock },
    { id: 'learning-score', title: 'Learning Score', value: `${learningScore.toFixed(1)} / 10`, description: 'Composite of focus, streak, exams & activities.', icon: Sparkles },
    { id: 'streak', title: 'Streak', value: `${progress.streak_days}d`, description: `${streakMessage(progress.streak_days)}${(progress as any).streak_freezes_available > 0 ? ` · ${(progress as any).streak_freezes_available}🧊 freeze${(progress as any).streak_freezes_available !== 1 ? 's' : ''} stored` : ''}`, icon: Flame },
    { id: 'exam-rate', title: 'Exam Completion', value: `${monthlyExamRate.pct}%`, description: `${monthlyExamRate.count}/${MONTHLY_EXAM_GOAL} this month · resets in ${monthlyExamRate.daysLeft}d`, icon: GraduationCap },
  ];

  const intensityClass = (lvl: number) => {
    switch (lvl) {
      case 0: return 'bg-foreground/[0.04] border-border/40';
      case 1: return 'bg-foreground/20 border-foreground/10';
      case 2: return 'bg-foreground/40 border-foreground/20';
      case 3: return 'bg-foreground/65 border-foreground/30';
      default: return 'bg-foreground border-foreground/40';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-3xl tracking-tight text-foreground">Dashboard</h2>
          <p className="mt-1 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Realtime study metrics</p>
        </div>
        <div className="flex items-center gap-1.5 border border-border bg-secondary/40 rounded-sm px-3 py-1.5 shrink-0">
          <Flame className="h-4 w-4 text-foreground" />
          <span className="text-xs font-mono">{progress.streak_days}d</span>
        </div>
      </div>

      {/* ── Cram countdown banner (Prompt 12) ── */}
      <AnimatePresence>
        <CramCountdownBanner activities={subjectActivities} />
      </AnimatePresence>

      {/* ── Weekly recap (Prompt 9) ── */}
      <AnimatePresence>
        {user && !isFirstRun && (
          <WeeklyRecap
            userId={user.id}
            sessions={sessions}
            examResults={examResults}
            progress={progress}
          />
        )}
      </AnimatePresence>

      {/* ── First-run checklist (new accounts only) ── */}
      <AnimatePresence>
        {isFirstRun && (
          <FirstRunChecklist
            hasFolders={hasFolders}
            hasExams={hasExams}
            hasSessions={hasSessions}
            onNavigate={onNavigate ?? (() => { })}
          />
        )}
      </AnimatePresence>

      {/* ── Overview cards ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <CardDisplay items={overviewCards} columns={4} />
      </motion.div>

      {/* ── Upcoming Tasks ticker ── */}
      <UpcomingTicker monthlyExamRate={monthlyExamRate} />

      {/* ── Engagement Report ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="relative overflow-hidden rounded-md border border-border bg-card p-6"
      >
        <span aria-hidden className="absolute left-0 top-0 h-px w-24 bg-foreground/40" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground shrink-0" />
              Engagement Report
            </h3>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mt-1">Monthly contributions</p>
          </div>
          <div className="flex items-center gap-1.5 border border-border bg-secondary/40 rounded-sm px-3 py-1.5 self-start sm:self-auto">
            <CalendarRange className="h-3.5 w-3.5 text-foreground" />
            <span className="text-xs font-mono uppercase tracking-[0.16em]">Monthly</span>
          </div>
        </div>

        {/* Summary trio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Study Time', value: formatMinutes(trackerStats.studyMinutes) },
            { label: 'Activities Completed', value: String(trackerStats.activitiesCompleted) },
            { label: 'Active Days', value: String(trackerStats.activeDays) },
          ].map(stat => (
            <div key={stat.label} className="rounded-sm border border-border/70 bg-secondary/30 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-serif text-2xl">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Contribution heatmap */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="inline-block min-w-full">
            <div className="flex gap-[3px] pl-10 mb-1">
              {heatmap.weeks.map((_, col) => {
                const lbl = heatmap.monthLabels.find(m => m.col === col);
                return (
                  <div key={col} className="w-[12px] text-[10px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {lbl ? lbl.label : ''}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              <div className="flex flex-col gap-[3px] pr-2 w-8">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                  <div key={i} className="h-[12px] text-[9px] font-mono leading-[12px] text-muted-foreground">{d}</div>
                ))}
              </div>
              {heatmap.weeks.map((week, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, ri) => {
                    const cell = week[ri];
                    if (!cell) return <div key={ri} className="w-[12px] h-[12px]" />;
                    return (
                      <div key={ri}
                        title={`${format(cell.date, 'MMM d, yyyy')} · ${cell.count} contributions`}
                        className={`w-[12px] h-[12px] rounded-[2px] border transition-colors ${intensityClass(cell.intensity)} hover:border-foreground`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 pr-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Less</span>
              {[0, 1, 2, 3, 4].map(lvl => <div key={lvl} className={`w-[12px] h-[12px] rounded-[2px] border ${intensityClass(lvl)}`} />)}
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
