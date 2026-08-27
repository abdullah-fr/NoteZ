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
  fetchActivities, fetchChecklistItems, type Activity as ActivityType, type ChecklistItem,
} from '@/services';
import {
  Flame, Clock, GraduationCap, Sparkles, Loader2,
  Activity, CheckSquare, Flag, BookOpen,
  Folder, FileQuestion, Check, X, ChevronRight, Layers,
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import CardDisplay, { type CardDisplayItem } from './widgets/CardDisplay';

const MONTHLY_EXAM_GOAL = 10;

/* ══════════════════════════════════════════════════════════════
   CRAM COUNTDOWN BANNER
   Shows nearest Deadline event within 72 hours.
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
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      className="relative flex items-center gap-3 rounded-md border border-border/80 bg-card/80 px-4 py-3"
    >
      <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <p className="flex-1 text-[12px] text-foreground/90 leading-snug">
        <span className="font-medium">{nearest.title}</span>
        {' '}in{' '}
        <span className="font-mono text-foreground font-semibold">{timeLabel}</span>
        {activityMatch && (
          <> — you're{' '}
            <span className="font-mono text-foreground">{activityMatch.progress}%</span>
            {' '}through{' '}
            <span className="font-medium">{activityMatch.subject}</span>
          </>
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss deadline banner"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WEEKLY RECAP
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
    if (sessions.length === 0 && examResults.length === 0) return;
    fetchedRef.current = true;

    setLoading(true);

    const generateClientFallbackRecap = (): RecapData => {
      const recentMins = sessions.reduce((s, x) => s + (x.duration_minutes || 0), 0);
      const totalMins = progress.total_study_minutes || recentMins;
      const hours = Math.round(totalMins / 60);

      const recentExams = examResults.slice(-10);
      const avgScore = recentExams.length
        ? Math.round(recentExams.reduce((acc, e) => acc + (e.total_questions ? (e.score / e.total_questions) * 100 : 0), 0) / recentExams.length)
        : 80;

      const streak = progress.streak_days || 1;

      return {
        learning_speed: `${Math.max(15, Math.round(totalMins / Math.max(1, streak)))}m / day`,
        retention_rate: `${avgScore}%`,
        consistency_score: `${Math.min(100, streak * 14)}%`,
        strong_areas: ['Active Memory Recall', 'Study Consistency'],
        weak_areas: ['Timed Exam Simulation'],
        recommendations: [
          'Maintain your daily study momentum with short 25-minute focus blocks.',
          'Review weak exam questions in Flashcards to boost long-term memory.',
        ],
        message: `Great study momentum! You've logged ${hours > 0 ? `${hours} hours` : `${totalMins} minutes`} of active learning. Keep up the high retention rate!`,
      };
    };

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
    }).then(({ data, error }) => {
      if (data && !data.error && !error) {
        setRecap(data);
      } else {
        setRecap(generateClientFallbackRecap());
      }
      localStorage.setItem(RECAP_STORAGE_KEY, thisWeek);
    }).catch(() => {
      setRecap(generateClientFallbackRecap());
      localStorage.setItem(RECAP_STORAGE_KEY, thisWeek);
    }).finally(() => setLoading(false));
  }, [userId, sessions, examResults, progress]);

  if (dismissed || loading || !recap) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
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
        <button
          onClick={() => setDismissed(true)}
          className="h-6 w-6 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss weekly recap"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

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

      {recap.message && (
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{recap.message}</p>
      )}

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

      {recap.recommendations && recap.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Action items</p>
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
══════════════════════════════════════════════════════════════ */
interface FirstRunStep {
  id: 'folder' | 'exam' | 'focus';
  label: string;
  cta: string;
  icon: React.ElementType;
  done: boolean;
  navigate: string;
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
    { id: 'folder', label: 'Create a folder or note', cta: 'Open Folders →', icon: Folder, done: hasFolders, navigate: 'folders' },
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
      <span aria-hidden className="absolute left-0 top-0 h-px w-24 bg-foreground/40" />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-serif text-lg tracking-tight">Get started with NoteZ</h3>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
            {doneCount} / 3 complete
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          {steps.map(s => (
            <div
              key={s.id}
              className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                s.done ? 'bg-foreground/70' : 'bg-foreground/10 border border-border/60'
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
              className={`relative flex flex-col gap-2 rounded-sm border p-4 transition-all duration-200 ${
                step.done
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

/* ══════════════════════════════════════════════════════════════
   5-FEATURE CONCISE SUGGESTIONS & RECOMMENDATIONS
   Smooth right flow animation every 5 seconds.
   5 Features:
   1. Recent Activities
   2. Tasks
   3. Deadlines
   4. Exam Score
   5. Improvements
══════════════════════════════════════════════════════════════ */
interface SuggestionFeatureItem {
  id: string;
  category: string;
  categoryKey: 'activities' | 'tasks' | 'deadlines' | 'exam' | 'improvements';
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  badgeType?: 'default' | 'urgent' | 'highlight';
  actionLabel: string;
  navigateTarget: string;
}

function FiveFeatureSuggestions({
  activities,
  checklists,
  examResults,
  progress,
  onNavigate,
}: {
  activities: ActivityType[];
  checklists: ChecklistItem[];
  examResults: ExamResult[];
  progress: UserProgress;
  onNavigate?: (view: string) => void;
}) {
  const { events, getUpcoming } = useCalendar();
  const { tasks: timerTasks } = useTimer();
  const [activeIdx, setActiveIdx] = useState(0);

  // Compute the 5 feature items dynamically based on live user data
  const featureSuggestions = useMemo<SuggestionFeatureItem[]>(() => {
    // 1. RECENT ACTIVITIES
    let activityItem: SuggestionFeatureItem;
    const activeActivity = activities.find(a => a.progress < 100) || activities[0];
    if (activeActivity) {
      const itemsForActivity = checklists.filter(c => c.activity_id === activeActivity.id);
      const pendingCount = itemsForActivity.filter(c => !c.done).length;
      activityItem = {
        id: 'feat-activities',
        category: 'Recent Activities',
        categoryKey: 'activities',
        icon: Activity,
        title: activeActivity.title || `${activeActivity.subject || 'General'} Activity`,
        description: `${activeActivity.progress}% complete${pendingCount > 0 ? ` · ${pendingCount} pending checklist task${pendingCount > 1 ? 's' : ''}` : ' · Great progress on this module'}`,
        badge: `${activeActivity.progress}% Done`,
        badgeType: 'highlight',
        actionLabel: 'Open Activities',
        navigateTarget: 'activities',
      };
    } else {
      activityItem = {
        id: 'feat-activities',
        category: 'Recent Activities',
        categoryKey: 'activities',
        icon: Activity,
        title: 'Organize your Subject Activities',
        description: 'Create topic checklists and structured learning targets to track your course progress.',
        badge: 'Setup Topic',
        badgeType: 'default',
        actionLabel: 'Create Activity',
        navigateTarget: 'activities',
      };
    }

    // 2. TASKS (Focus Timer / Pomodoro Tasks)
    let taskItem: SuggestionFeatureItem;
    const pendingTimerTask = timerTasks.find(t => !t.done);
    const calendarTasks = events.filter(e => e.type === 'task' && !e.completed);
    if (pendingTimerTask) {
      taskItem = {
        id: 'feat-tasks',
        category: 'Focus Tasks',
        categoryKey: 'tasks',
        icon: CheckSquare,
        title: pendingTimerTask.label,
        description: `Scheduled for a ${pendingTimerTask.minutes}m deep focus block. Tackle it distraction-free.`,
        badge: `${pendingTimerTask.minutes}m Focus`,
        badgeType: 'highlight',
        actionLabel: 'Start Timer',
        navigateTarget: 'timer',
      };
    } else if (calendarTasks.length > 0) {
      const topTask = calendarTasks[0];
      taskItem = {
        id: 'feat-tasks',
        category: 'Focus Tasks',
        categoryKey: 'tasks',
        icon: CheckSquare,
        title: topTask.title,
        description: `Due ${dayLabel(topTask.date)}. Block 25 minutes now to complete this priority.`,
        badge: 'Priority Task',
        badgeType: 'highlight',
        actionLabel: 'Open Timer',
        navigateTarget: 'timer',
      };
    } else {
      taskItem = {
        id: 'feat-tasks',
        category: 'Focus Tasks',
        categoryKey: 'tasks',
        icon: CheckSquare,
        title: 'Plan your next Deep Work block',
        description: 'Set up focused 25-minute Pomodoro intervals to maintain active study momentum.',
        badge: '25m Session',
        badgeType: 'default',
        actionLabel: 'Start Focus',
        navigateTarget: 'timer',
      };
    }

    // 3. DEADLINES
    let deadlineItem: SuggestionFeatureItem;
    const upcomingDeadlines = getUpcoming(14).filter(e => e.type === 'deadline');
    if (upcomingDeadlines.length > 0) {
      const nearest = upcomingDeadlines[0];
      const days = differenceInCalendarDays(nearest.date, new Date());
      const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
      deadlineItem = {
        id: 'feat-deadlines',
        category: 'Deadlines',
        categoryKey: 'deadlines',
        icon: Flag,
        title: nearest.title,
        description: `Target date: ${format(nearest.date, 'EEEE, MMM d')} (${label}) · ${nearest.subject ? `Subject: ${nearest.subject}` : 'High priority deadline'}`,
        badge: label,
        badgeType: days <= 2 ? 'urgent' : 'highlight',
        actionLabel: 'View Calendar',
        navigateTarget: 'calendar',
      };
    } else {
      deadlineItem = {
        id: 'feat-deadlines',
        category: 'Deadlines',
        categoryKey: 'deadlines',
        icon: Flag,
        title: 'All upcoming deadlines are clear',
        description: 'Add exam dates, project milestones, or essay deadlines to stay organized ahead of time.',
        badge: 'On Track',
        badgeType: 'default',
        actionLabel: 'Open Calendar',
        navigateTarget: 'calendar',
      };
    }

    // 4. EXAM SCORE & PERFORMANCE
    let examItem: SuggestionFeatureItem;
    if (examResults.length > 0) {
      const latestExam = examResults[examResults.length - 1];
      const latestScorePct = latestExam.total_questions > 0
        ? Math.round((latestExam.score / latestExam.total_questions) * 100)
        : 85;
      const totalScore = examResults.reduce((acc, e) => acc + (e.total_questions ? (e.score / e.total_questions) * 100 : 0), 0);
      const avgScore = Math.round(totalScore / examResults.length);

      examItem = {
        id: 'feat-exam',
        category: 'Exam Score',
        categoryKey: 'exam',
        icon: GraduationCap,
        title: `${avgScore}% Average Mastery across ${examResults.length} exam${examResults.length > 1 ? 's' : ''}`,
        description: latestScorePct >= 80
          ? `Latest score was ${latestScorePct}%. Take another 10-minute simulation to lock in high performance.`
          : `Latest score was ${latestScorePct}%. Review missed questions in Flashcards or retake the simulation.`,
        badge: `${avgScore}% Avg`,
        badgeType: avgScore >= 80 ? 'highlight' : 'urgent',
        actionLabel: 'Take Exam',
        navigateTarget: 'exam',
      };
    } else {
      examItem = {
        id: 'feat-exam',
        category: 'Exam Score',
        categoryKey: 'exam',
        icon: GraduationCap,
        title: 'Simulate your first AI Mock Exam',
        description: 'Generate realistic test questions from your study materials and diagnose weak concepts.',
        badge: 'Diagnostic',
        badgeType: 'default',
        actionLabel: 'Create Exam',
        navigateTarget: 'exam',
      };
    }

    // 5. IMPROVEMENTS & RETENTION
    let improvementItem: SuggestionFeatureItem;
    if (progress.flashcards_reviewed < 20) {
      improvementItem = {
        id: 'feat-improvements',
        category: 'Improvements',
        categoryKey: 'improvements',
        icon: Sparkles,
        title: 'Boost recall with Spaced Repetition',
        description: 'Reviewing 10–15 flashcards daily reinforces active memory recall and prevents knowledge decay.',
        badge: 'Memory Boost',
        badgeType: 'highlight',
        actionLabel: 'Study Decks',
        navigateTarget: 'flashcards',
      };
    } else if (progress.streak_days < 3) {
      improvementItem = {
        id: 'feat-improvements',
        category: 'Improvements',
        categoryKey: 'improvements',
        icon: Sparkles,
        title: 'Build your Daily Study Streak',
        description: 'Complete at least 15 minutes of study today to build discipline and unlock streak freeze shields.',
        badge: 'Daily Habit',
        badgeType: 'highlight',
        actionLabel: 'Start Session',
        navigateTarget: 'timer',
      };
    } else {
      improvementItem = {
        id: 'feat-improvements',
        category: 'Improvements',
        categoryKey: 'improvements',
        icon: Sparkles,
        title: 'Optimal Study Rhythm Detected',
        description: 'Your study consistency is excellent. Maintain balanced 25-minute focus intervals with 5-minute pauses.',
        badge: 'Peak Routine',
        badgeType: 'highlight',
        actionLabel: 'View Progress',
        navigateTarget: 'activities',
      };
    }

    return [activityItem, taskItem, deadlineItem, examItem, improvementItem];
  }, [activities, checklists, examResults, progress, events, getUpcoming, timerTasks]);

  // Auto-advance without user controls so the five recommendations read as one calm stream.
  useEffect(() => {
    if (featureSuggestions.length === 0) return;
    const interval = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % featureSuggestions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featureSuggestions.length]);

  const current = featureSuggestions[activeIdx] || featureSuggestions[0];

  if (!current) return null;

  const Icon = current.icon;

  return (
    <div className="relative rounded-md border border-border bg-card overflow-hidden shadow-sm transition-all duration-200">
      {/* Top micro accent bar */}
      <span aria-hidden className="absolute left-0 top-0 h-px w-28 bg-foreground/40" />

      {/* Header bar — the recommendations advance automatically, without tab chrome. */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 bg-secondary/25 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-foreground/10 text-foreground">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-semibold text-foreground">
            Smart Recommendations
          </span>
        </div>

        <div
          className="flex items-center gap-1"
          aria-label={`Recommendation ${activeIdx + 1} of ${featureSuggestions.length}`}
        >
          {featureSuggestions.map((item, idx) => {
            return (
              <span
                key={item.id}
                aria-hidden
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === activeIdx ? 'w-5 bg-foreground/80' : 'w-1.5 bg-foreground/20'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main recommendation body with smooth right-flow slide animation */}
      <div className="relative min-h-[92px] p-4 flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
          >
            {/* Left: Icon & Suggestion Details */}
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border/80 bg-secondary/40 text-foreground transition-all duration-300">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {current.badge && (
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                        current.badgeType === 'urgent'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive font-semibold'
                          : current.badgeType === 'highlight'
                          ? 'border-foreground/20 bg-foreground/5 text-foreground font-medium'
                          : 'border-border/60 bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      {current.badge}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-foreground truncate tracking-tight">
                  {current.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-normal">
                  {current.description}
                </p>
              </div>
            </div>

            {/* Right: Direct Action Button */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                onClick={() => onNavigate?.(current.navigateTarget)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-secondary/30 text-xs font-mono uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-200"
              >
                <span>{current.actionLabel}</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 5-second animated linear progress bar */}
      <div className="h-[2px] w-full bg-border/40 overflow-hidden">
        <motion.div
          key={current.id}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: 'linear' }}
          className="h-full bg-foreground/60"
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OVERALL ENGAGEMENT SIGNAL
   One compact visualization for the five core learning features.
══════════════════════════════════════════════════════════════ */
interface EngagementFeature {
  id: 'notes' | 'exams' | 'flashcards' | 'focus' | 'activities';
  label: string;
  signal: number;
  detail: string;
  icon: React.ElementType;
}

function getStoredNoteCount(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const raw: unknown = JSON.parse(localStorage.getItem('notez_folders') || '[]');
    if (!Array.isArray(raw)) return 0;

    return raw.reduce((folderTotal, folder) => {
      if (!folder || typeof folder !== 'object') return folderTotal;
      const categories = (folder as { categories?: unknown }).categories;
      if (!Array.isArray(categories)) return folderTotal;

      return folderTotal + categories.reduce((categoryTotal, category) => {
        if (!category || typeof category !== 'object') return categoryTotal;
        const notes = (category as { notes?: unknown }).notes;
        return categoryTotal + (Array.isArray(notes) ? notes.length : 0);
      }, 0);
    }, 0);
  } catch {
    return 0;
  }
}

function AdvancedEngagementReport({
  sessions,
  examResults,
  activities,
  progress,
  noteCount,
}: {
  sessions: StudySession[];
  examResults: ExamResult[];
  activities: ActivityType[];
  progress: UserProgress;
  noteCount: number;
}) {
  const [hoveredFeature, setHoveredFeature] = useState<EngagementFeature['id'] | null>(null);

  const { features, overallSignal, totalMinutes, activeDays, examCount } = useMemo(() => {
    const sessionMinutes = sessions.reduce((total, session) => total + Math.max(0, session.duration_minutes || 0), 0);
    const totalMinutes = Math.max(progress.total_study_minutes || 0, sessionMinutes);
    const averageExamScore = examResults.length > 0
      ? Math.round(examResults.reduce((total, exam) => {
        return total + (exam.total_questions ? (exam.score / exam.total_questions) * 100 : 0);
      }, 0) / examResults.length)
      : 0;
    const averageActivityProgress = activities.length > 0
      ? Math.round(activities.reduce((total, activity) => total + Math.max(0, Math.min(100, activity.progress || 0)), 0) / activities.length)
      : 0;
    const activeDateKeys = new Set<string>();
    [...sessions.map(session => session.started_at), ...examResults.map(exam => exam.created_at)].forEach(value => {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) activeDateKeys.add(date.toISOString().slice(0, 10));
    });

    const features: EngagementFeature[] = [
      {
        id: 'notes',
        label: 'Notes',
        signal: Math.min(100, noteCount * 10),
        detail: `${noteCount} note${noteCount === 1 ? '' : 's'} saved`,
        icon: BookOpen,
      },
      {
        id: 'exams',
        label: 'Exams',
        signal: averageExamScore,
        detail: examResults.length > 0 ? `${averageExamScore}% average score` : 'No exam results yet',
        icon: GraduationCap,
      },
      {
        id: 'flashcards',
        label: 'Flashcards',
        signal: Math.min(100, Math.round((progress.flashcards_reviewed / 60) * 100)),
        detail: `${progress.flashcards_reviewed} reviewed · ${progress.quizzes_completed} quizzes`,
        icon: Layers,
      },
      {
        id: 'focus',
        label: 'Focus',
        signal: Math.min(100, Math.round((totalMinutes / 600) * 100)),
        detail: `${formatMinutes(totalMinutes)} focused`,
        icon: Clock,
      },
      {
        id: 'activities',
        label: 'Activities',
        signal: averageActivityProgress,
        detail: activities.length > 0 ? `${averageActivityProgress}% average completion` : 'No activity packages yet',
        icon: CheckSquare,
      },
    ];

    return {
      features,
      overallSignal: Math.round(features.reduce((total, feature) => total + feature.signal, 0) / features.length),
      totalMinutes,
      activeDays: activeDateKeys.size,
      examCount: examResults.length,
    };
  }, [activities, examResults, noteCount, progress, sessions]);

  const center = { x: 180, y: 148 };
  const radius = 91;
  const labelRadius = 124;
  const angleFor = (index: number, distance: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / features.length;
    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
    };
  };
  const pointsFor = (scale: number) => features.map((feature, index) => {
    const point = angleFor(index, radius * scale * (feature.signal / 100 || 0));
    return `${point.x},${point.y}`;
  }).join(' ');
  const status = overallSignal >= 75 ? 'In rhythm' : overallSignal >= 40 ? 'Building momentum' : 'Start your signal';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative overflow-hidden rounded-md border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <span aria-hidden className="absolute left-0 top-0 h-px w-28 bg-foreground/40" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-serif text-lg tracking-tight text-foreground">Engagement Activity</h3>
          </div>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            One view of your learning rhythm
          </p>
        </div>
        <span className="shrink-0 rounded-sm border border-border/70 bg-secondary/30 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {status}
        </span>
      </div>

      <div className="mt-4 grid items-center gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)]">
        <div className="relative mx-auto aspect-[1.2] w-full max-w-[30rem] overflow-hidden rounded-sm border border-border/60 bg-secondary/20 p-1 sm:p-2">
          <svg
            viewBox="0 0 360 300"
            className="h-full w-full"
            role="img"
            aria-label={`Overall engagement signal ${overallSignal} percent across Notes, Exams, Flashcards, Focus, and Activities`}
          >
            <motion.circle
              cx={center.x}
              cy={center.y}
              r="107"
              fill="none"
              stroke="hsl(var(--foreground) / 0.16)"
              strokeWidth="1"
              animate={{ r: [104, 111, 104], opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            {[0.25, 0.5, 0.75, 1].map(scale => (
              <polygon
                key={scale}
                points={pointsFor(scale)}
                fill="none"
                stroke="hsl(var(--border) / 0.9)"
                strokeWidth="1"
              />
            ))}

            {features.map((feature, index) => {
              const end = angleFor(index, radius);
              const label = angleFor(index, labelRadius);
              const isActive = hoveredFeature === feature.id;
              return (
                <g
                  key={feature.id}
                  onMouseEnter={() => setHoveredFeature(feature.id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="hsl(var(--border) / 0.8)"
                    strokeWidth="1"
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={label.x < center.x - 8 ? 'end' : label.x > center.x + 8 ? 'start' : 'middle'}
                    dominantBaseline="middle"
                    fill="hsl(var(--muted-foreground))"
                    className="font-mono text-[10px] uppercase tracking-wider"
                  >
                    {feature.label}
                  </text>
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r={isActive ? 5 : 3.5}
                    fill="hsl(var(--foreground))"
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}

            <motion.polygon
              points={pointsFor(1)}
              fill="hsl(var(--foreground) / 0.10)"
              stroke="hsl(var(--foreground) / 0.78)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ transformOrigin: `${center.x}px ${center.y}px` }}
            />
            <motion.circle
              cx={center.x}
              cy={center.y}
              r="35"
              fill="hsl(var(--card))"
              stroke="hsl(var(--foreground) / 0.28)"
              strokeWidth="1"
              animate={{ strokeOpacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <text x={center.x} y={center.y - 2} textAnchor="middle" fill="hsl(var(--foreground))" className="font-serif text-[24px] font-semibold">
              {overallSignal}%
            </text>
            <text x={center.x} y={center.y + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="font-mono text-[8px] uppercase tracking-[0.16em]">
              overall signal
            </text>
          </svg>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {features.map(feature => {
              const FeatureIcon = feature.icon;
              const isActive = hoveredFeature === feature.id;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onMouseEnter={() => setHoveredFeature(feature.id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  onFocus={() => setHoveredFeature(feature.id)}
                  onBlur={() => setHoveredFeature(null)}
                  className={`flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors ${
                    isActive ? 'border-foreground/40 bg-secondary/50' : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                  }`}
                  aria-label={`${feature.label}: ${feature.signal} percent. ${feature.detail}`}
                >
                  <FeatureIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-foreground">{feature.label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{feature.detail}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-foreground">{feature.signal}%</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border/60 pt-3 text-[10px] font-mono text-muted-foreground">
            <span>{activeDays} active day{activeDays === 1 ? '' : 's'}</span>
            <span className="px-1.5 text-border">·</span>
            <span>{formatMinutes(totalMinutes)} focus</span>
            <span className="px-1.5 text-border">·</span>
            <span>{examCount} exam{examCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
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
  const h = Math.floor(min / 60);
  const m = min % 60;
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
  const [activitiesList, setActivitiesList] = useState<ActivityType[]>([]);
  const [checklistsList, setChecklistsList] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activitySubjects, setActivitySubjects] = useState<{ subject: string; progress: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ progress: p, examResults: e, sessions: s }, acts, chks] = await Promise.all([
        fetchProgressData(user.id),
        fetchActivities(user.id).catch(() => []),
        fetchChecklistItems(user.id).catch(() => []),
      ]);
      setProgress(p);
      setExamResults(e);
      setSessions(s);
      setActivitiesList(acts);
      setChecklistsList(chks);

      // Build per-subject progress map from activities
      const subjectMap: Record<string, { total: number; count: number }> = {};
      acts.forEach((a) => {
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

  /* ── Core product metrics calculation ── */
  const examStats = useMemo(() => {
    if (examResults.length === 0) {
      return { avgScore: null, passedCount: 0, totalExams: 0 };
    }
    const totalScore = examResults.reduce((acc, e) => acc + (e.total_questions ? (e.score / e.total_questions) * 100 : 0), 0);
    const avgScore = Math.round(totalScore / examResults.length);
    const passedCount = examResults.filter(e => (e.score / (e.total_questions || 1)) >= 0.8).length;
    return { avgScore, passedCount, totalExams: examResults.length };
  }, [examResults]);

  /* ── first-run check ── */
  const isFirstRun = progress.total_study_minutes === 0 && progress.exams_completed === 0;
  const hasFolders = (() => {
    try { return JSON.parse(localStorage.getItem('notez_folders') || '[]').length > 0; } catch { return false; }
  })();
  const noteCount = getStoredNoteCount();
  const hasExams = examResults.length > 0;
  const hasSessions = sessions.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  /* ── 4 ONLY useful KPIs representing the core features ── */
  const overviewCards: CardDisplayItem[] = [
    {
      id: 'focus-mastery',
      title: 'Focus Mastery',
      value: formatMinutes(progress.total_study_minutes),
      description: `${sessions.length} session${sessions.length !== 1 ? 's' : ''} logged · Avg ${sessions.length > 0 ? Math.round(progress.total_study_minutes / sessions.length) : 0}m / session`,
      icon: Clock,
      actionLabel: 'Launch Timer',
      onActionClick: () => onNavigate?.('timer'),
    },
    {
      id: 'exam-accuracy',
      title: 'Exam Accuracy',
      value: examStats.avgScore !== null ? `${examStats.avgScore}%` : 'No Exams',
      description: `${examStats.totalExams || progress.exams_completed} completed · ${examStats.passedCount} passed (≥80%)`,
      icon: GraduationCap,
      actionLabel: 'Take Exam',
      onActionClick: () => onNavigate?.('exam'),
    },
    {
      id: 'flashcard-retention',
      title: 'Flashcard Retention',
      value: `${progress.flashcards_reviewed} Cards`,
      description: `${progress.quizzes_completed} quizzes taken · Active spaced recall`,
      icon: BookOpen,
      actionLabel: 'Study Decks',
      onActionClick: () => onNavigate?.('flashcards'),
    },
    {
      id: 'study-streak',
      title: 'Study Streak',
      value: `${progress.streak_days} Day${progress.streak_days === 1 ? '' : 's'}`,
      description: `${streakMessage(progress.streak_days)}${(progress.streak_freezes_available ?? 0) > 0 ? ` · ${progress.streak_freezes_available} freeze shield stored` : ''}`,
      icon: Flame,
      actionLabel: 'View Schedule',
      onActionClick: () => onNavigate?.('calendar'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 overflow-hidden">
      {/* ── Cram countdown banner ── */}
      <AnimatePresence>
        <CramCountdownBanner activities={activitySubjects} />
      </AnimatePresence>

      {/* ── Weekly recap ── */}
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

      {/* ── 4 Core Product Scorecards ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <CardDisplay items={overviewCards} columns={4} />
      </motion.div>

      {/* ── 5-Feature Concise Recommendations Widget (5s smooth right flow) ── */}
      <FiveFeatureSuggestions
        activities={activitiesList}
        checklists={checklistsList}
        examResults={examResults}
        progress={progress}
        onNavigate={onNavigate}
      />

      {/* ── Advanced GitHub-Style Engagement Report ── */}
      <AdvancedEngagementReport
        sessions={sessions}
        examResults={examResults}
        activities={activitiesList}
        progress={progress}
        noteCount={noteCount}
      />
    </div>
  );
}
