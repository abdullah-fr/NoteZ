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
  fetchActivities, fetchChecklistItems, fetchFlashcardActivity,
  type Activity as ActivityType, type ChecklistItem, type FlashcardActivity,
} from '@/services';
import {
  Clock, GraduationCap, Sparkles, Loader2,
  Activity, CheckSquare, Flag, BookOpen,
  Folder, FileQuestion, Check, X, ChevronRight, Layers,
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import CardDisplay, { type CardDisplayItem } from './widgets/CardDisplay';

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
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-secondary/30 text-xs font-mono uppercase tracking-[0.14em] text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200"
              >
                <span>{current.actionLabel}</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OVERALL ENGAGEMENT HISTOGRAM
   One compact, live visualization for the five core learning features.
══════════════════════════════════════════════════════════════ */
interface EngagementFeature {
  id: 'notes' | 'exams' | 'flashcards' | 'focus' | 'activities';
  label: string;
  detail: string;
  icon: React.ElementType;
  cells: number[];
  total: number;
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

function getStoredFolderCount(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const raw: unknown = JSON.parse(localStorage.getItem('notez_folders') || '[]');
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

function getStoredNoteDates(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw: unknown = JSON.parse(localStorage.getItem('notez_folders') || '[]');
    if (!Array.isArray(raw)) return [];

    return raw.flatMap(folder => {
      if (!folder || typeof folder !== 'object') return [];
      const categories = (folder as { categories?: unknown }).categories;
      if (!Array.isArray(categories)) return [];

      return categories.flatMap(category => {
        if (!category || typeof category !== 'object') return [];
        const notes = (category as { notes?: unknown }).notes;
        if (!Array.isArray(notes)) return [];

        return notes.flatMap(note => {
          if (!note || typeof note !== 'object') return [];
          const candidate = (note as { updatedAt?: unknown; createdAt?: unknown }).updatedAt
            ?? (note as { createdAt?: unknown }).createdAt;
          return typeof candidate === 'string' ? [candidate] : [];
        });
      });
    });
  } catch {
    return [];
  }
}

function getLastThirtyDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (29 - index));
    return day;
  });
}

function AdvancedEngagementReport({
  sessions,
  examResults,
  activities,
  checklists,
  flashcards,
  progress,
  noteCount,
}: {
  sessions: StudySession[];
  examResults: ExamResult[];
  activities: ActivityType[];
  checklists: ChecklistItem[];
  flashcards: FlashcardActivity[];
  progress: UserProgress;
  noteCount: number;
}) {
  const days = useMemo(() => getLastThirtyDays(), []);
  const dayKeys = useMemo(() => days.map(day => format(day, 'yyyy-MM-dd')), [days]);

  const { features, totalActions, activeDays, totalMinutes, examCount } = useMemo(() => {
    type FeatureId = EngagementFeature['id'];
    const featureIds: FeatureId[] = ['notes', 'exams', 'flashcards', 'focus', 'activities'];
    const cells = Object.fromEntries(featureIds.map(id => [id, Array(30).fill(0)])) as Record<FeatureId, number[]>;
    const indexByDay = new Map(dayKeys.map((key, index) => [key, index]));

    const addAction = (feature: FeatureId, timestamp: string | null | undefined, amount = 1) => {
      if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return;
      const index = indexByDay.get(format(new Date(timestamp), 'yyyy-MM-dd'));
      if (index === undefined) return;
      cells[feature][index] += Math.max(1, amount);
    };

    getStoredNoteDates().forEach(timestamp => addAction('notes', timestamp));
    examResults.forEach(exam => addAction('exams', exam.created_at));
    sessions.forEach(session => {
      addAction('focus', session.started_at, Math.max(1, Math.ceil((session.duration_minutes || 0) / 25)));
    });
    flashcards.forEach(card => addAction('flashcards', card.created_at));

    const completedByActivity = checklists.reduce<Record<string, number>>((counts, item) => {
      if (item.done) counts[item.activity_id] = (counts[item.activity_id] || 0) + 1;
      return counts;
    }, {});
    activities.forEach(activity => {
      const progressActions = activity.progress > 0 ? Math.ceil(activity.progress / 25) : 1;
      const completedActions = completedByActivity[activity.id] || 0;
      addAction('activities', activity.updated_at || activity.created_at, progressActions + completedActions);
    });

    const sessionMinutes = sessions.reduce((total, session) => total + Math.max(0, session.duration_minutes || 0), 0);
    const totalMinutes = Math.max(progress.total_study_minutes || 0, sessionMinutes);
    const averageExamScore = examResults.length > 0
      ? Math.round(examResults.reduce((total, exam) => total + (exam.total_questions ? (exam.score / exam.total_questions) * 100 : 0), 0) / examResults.length)
      : 0;
    const averageActivityProgress = activities.length > 0
      ? Math.round(activities.reduce((total, activity) => total + Math.max(0, Math.min(100, activity.progress || 0)), 0) / activities.length)
      : 0;

    const features: EngagementFeature[] = [
      { id: 'notes', label: 'Notes', detail: `${noteCount} note${noteCount === 1 ? '' : 's'} saved`, icon: BookOpen, cells: cells.notes, total: noteCount },
      { id: 'exams', label: 'Exams', detail: examResults.length > 0 ? `${averageExamScore}% average score` : 'No exam results yet', icon: GraduationCap, cells: cells.exams, total: examResults.length },
      { id: 'flashcards', label: 'Flashcards', detail: `${progress.flashcards_reviewed} reviewed · ${flashcards.length} cards`, icon: Layers, cells: cells.flashcards, total: progress.flashcards_reviewed },
      { id: 'focus', label: 'Focus', detail: `${formatMinutes(totalMinutes)} focused`, icon: Clock, cells: cells.focus, total: totalMinutes },
      { id: 'activities', label: 'Activities', detail: `${completedByActivity ? Object.values(completedByActivity).reduce((sum, count) => sum + count, 0) : 0} tasks complete · ${averageActivityProgress}% average`, icon: CheckSquare, cells: cells.activities, total: activities.length },
    ];

    return {
      features,
      totalActions: features.reduce((total, feature) => total + feature.cells.reduce((sum, value) => sum + value, 0), 0),
      activeDays: dayKeys.reduce((total, _, index) => total + (featureIds.some(id => cells[id][index] > 0) ? 1 : 0), 0),
      totalMinutes,
      examCount: examResults.length,
    };
  }, [activities, checklists, dayKeys, examResults, flashcards, noteCount, progress, sessions]);

  const maxCellValue = Math.max(1, ...features.flatMap(feature => feature.cells));
  const intensityAlpha = [0.06, 0.2, 0.38, 0.62, 0.88];
  const status = activeDays >= 6 ? 'In rhythm' : activeDays >= 3 ? 'Building momentum' : 'Start your signal';

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
            <h3 className="font-serif text-lg tracking-tight text-foreground">Monthly Performance Report</h3>
          </div>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Last 30 days across your study features
          </p>
        </div>
        <div className="shrink-0 text-right font-mono">
          <p className="text-sm font-semibold text-foreground">{totalActions} actions</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{status}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-1" role="img" aria-label="Monthly contribution activity heatmap showing Notes, Exams, Flashcards, Focus, and Activities across the last thirty days">
        <div className="mx-auto w-fit min-w-0 sm:min-w-[30rem]">
          <div className="grid grid-cols-[5rem_repeat(30,0.75rem)] items-end gap-1 px-1 sm:grid-cols-[6.25rem_repeat(30,0.9rem)] sm:gap-1.5">
            <span aria-hidden />
            {days.map((day, index) => (
              <div key={dayKeys[index]} className={`text-center font-mono text-[8px] tracking-tight ${index === days.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                <span className="block">{index === 0 || index === days.length - 1 || index % 5 === 0 ? format(day, 'd') : ''}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1.5">
            {features.map(feature => {
              const FeatureIcon = feature.icon;
              return (
                <div key={feature.id} className="grid grid-cols-[5rem_repeat(30,0.75rem)] items-center gap-1 px-1 sm:grid-cols-[6.25rem_repeat(30,0.9rem)] sm:gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <FeatureIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate sm:hidden">{feature.id === 'flashcards' ? 'Cards' : feature.id === 'activities' ? 'Tasks' : feature.label}</span>
                    <span className="hidden truncate sm:block">{feature.label}</span>
                  </div>
                  {feature.cells.map((value, index) => {
                    const level = value === 0 ? 0 : Math.max(1, Math.ceil((value / maxCellValue) * 4));
                    const label = `${feature.label}, ${format(days[index], 'EEEE, MMMM d')}: ${value} action${value === 1 ? '' : 's'}`;
                    return (
                      <motion.button
                        key={`${feature.id}-${dayKeys[index]}`}
                        type="button"
                        aria-label={label}
                        title={label}
                        whileHover={{ scale: 1.12 }}
                        transition={{ duration: 0.16 }}
                        className="aspect-square w-full min-w-0 rounded-[3px] border border-border/50 outline-none transition-[box-shadow,background-color] hover:border-foreground/40 focus-visible:ring-1 focus-visible:ring-foreground/70"
                        style={{
                          backgroundColor: `hsl(var(--foreground) / ${intensityAlpha[level]})`,
                          boxShadow: level > 0 ? `inset 0 0 0 1px hsl(var(--foreground) / ${Math.min(0.2, intensityAlpha[level] / 3)})` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
          <span>{activeDays} active day{activeDays === 1 ? '' : 's'}</span>
          <span className="text-border">·</span>
          <span>{formatMinutes(totalMinutes)} focus</span>
          <span className="text-border">·</span>
          <span>{examCount} exam{examCount === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(level => (
            <span
              key={level}
              aria-hidden
              className="h-3 w-3 rounded-[2px] border border-border/50"
              style={{ backgroundColor: `hsl(var(--foreground) / ${intensityAlpha[level]})` }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </motion.div>
  );
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
  const [flashcardsList, setFlashcardsList] = useState<FlashcardActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteCount, setNoteCount] = useState(getStoredNoteCount);
  const [folderCount, setFolderCount] = useState(getStoredFolderCount);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ progress: p, examResults: e, sessions: s }, acts, chks, cards] = await Promise.all([
        fetchProgressData(user.id),
        fetchActivities(user.id).catch(() => []),
        fetchChecklistItems(user.id).catch(() => []),
        fetchFlashcardActivity(user.id).catch(() => []),
      ]);
      setProgress(p);
      setExamResults(e);
      setSessions(s);
      setActivitiesList(acts);
      setChecklistsList(chks);
      setFlashcardsList(cards);
      setLoading(false);
    };
    load();
    return subscribeToProgressUpdates(user.id, load);
  }, [user]);

  useEffect(() => {
    const refreshFolderMetrics = () => {
      setNoteCount(getStoredNoteCount());
      setFolderCount(getStoredFolderCount());
    };

    window.addEventListener('notez:folders-updated', refreshFolderMetrics);
    window.addEventListener('storage', refreshFolderMetrics);
    return () => {
      window.removeEventListener('notez:folders-updated', refreshFolderMetrics);
      window.removeEventListener('storage', refreshFolderMetrics);
    };
  }, []);

  /* ── first-run check ── */
  const isFirstRun = progress.total_study_minutes === 0 && progress.exams_completed === 0;
  const hasFolders = folderCount > 0;
  const hasExams = examResults.length > 0;
  const hasSessions = sessions.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const averageActivityProgress = activitiesList.length > 0
    ? Math.round(activitiesList.reduce((total, activity) => total + Math.max(0, Math.min(100, activity.progress || 0)), 0) / activitiesList.length)
    : 0;
  const completedChecklistCount = checklistsList.filter(item => item.done).length;

  /* ── 4 useful KPIs representing the core features ── */
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
      id: 'activities-overview',
      title: 'Activities',
      value: `${activitiesList.length}`,
      description: activitiesList.length > 0
        ? `${averageActivityProgress}% average progress · ${completedChecklistCount} task${completedChecklistCount === 1 ? '' : 's'} complete`
        : 'Create a structured study plan',
      icon: CheckSquare,
      actionLabel: 'Open Activities',
      onActionClick: () => onNavigate?.('activities'),
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
      id: 'folders-overview',
      title: 'Folders',
      value: `${folderCount}`,
      description: `${noteCount} note${noteCount === 1 ? '' : 's'} organized across your study space`,
      icon: Folder,
      actionLabel: 'Open Folders',
      onActionClick: () => onNavigate?.('folders'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 overflow-hidden">
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
        checklists={checklistsList}
        flashcards={flashcardsList}
        progress={progress}
        noteCount={noteCount}
      />
    </div>
  );
}
