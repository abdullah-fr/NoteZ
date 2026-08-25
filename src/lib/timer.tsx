import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { logCompletedSession } from "@/services/timer.service";
import { supabase } from "@/integrations/supabase/client";

export const TIMER_OPTIONS = [15, 25, 30, 45, 60];

/* ─────────────────────────────────────────────────────────────
   FOCUS TIMER ENHANCED TYPES
───────────────────────────────────────────────────────────── */

export type FocusMode = "focus" | "break";

export interface FocusGoal {
  id: string;
  label: string;       // e.g. "Physics — Chapter 4"
  subject?: string;
  calendarEventId?: string;
}

export interface Routine {
  id: string;
  name: string;
  focusMins: number;
  breakMins: number;
  cycles: number;        // number of focus sessions before long break
  longBreakMins: number;
  autoStart: boolean;
  favorite: boolean;
  lastUsed?: number;     // epoch ms
}

export interface FocusSession {
  id: string;
  date: string;          // ISO date string yyyy-MM-dd
  startTime: string;     // HH:mm
  durationMins: number;
  mode: FocusMode;
  goalLabel?: string;
  subject?: string;
  status: "completed" | "partial" | "skipped";
}

export interface DailyGoalSettings {
  dailyMins: number;     // target focus minutes per day
  weeklyMins: number;    // target focus minutes per week
}

/* ─── Focus timer (existing, extended) ─── */
interface FocusTimerState {
  selectedMinutes: number;
  breakMinutes: number;
  timeLeft: number;
  totalSeconds: number;
  progress: number;
  isRunning: boolean;
  isCompleted: boolean;
  hasActiveSession: boolean;
  focusMode: FocusMode;
  currentCycle: number;
  totalCycles: number;
  sessionCount: number;
  activeGoal: FocusGoal | null;
  activeRoutine: Routine | null;
  autoStart: boolean;
  setAutoStart: (enabled: boolean) => void;
  // actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  addTime: (mins: number) => void;
  selectMinutes: (m: number) => void;
  setBreakMinutes: (m: number) => void;
  setFocusMode: (m: FocusMode) => void;
  setActiveGoal: (g: FocusGoal | null) => void;
  setActiveRoutine: (r: Routine | null) => void;
  // routines
  routines: Routine[];
  addRoutine: (r: Omit<Routine, "id" | "lastUsed">) => void;
  updateRoutine: (id: string, r: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  // session history
  sessionHistory: FocusSession[];
  // daily goal
  dailyGoal: DailyGoalSettings;
  setDailyGoal: (g: DailyGoalSettings) => void;
  // analytics helpers
  todayFocusMins: number;
  weekFocusMins: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;  // 0–100
  totalSessionsCompleted: number;
  avgSessionMins: number;
  // record partial/skipped
  recordPartialSession: (durationMins: number, status: "partial" | "skipped") => void;
}

/* ─── Task timer (unchanged) ─── */
export interface FloatingTask {
  id: string;
  label: string;
  minutes: number;
  done: boolean;
}
interface TaskTimerState {
  tasks: FloatingTask[];
  activeTaskIdx: number | null;
  taskTimeLeft: number;
  taskTotal: number;
  taskProgress: number;
  taskRunning: boolean;
  taskCompleted: boolean;
  hasTaskSession: boolean;
  addTask: (label: string, minutes: number) => void;
  removeTask: (id: string) => void;
  selectTask: (idx: number) => void;
  startTask: () => void;
  pauseTask: () => void;
  resetTask: () => void;
  nextTask: () => void;
}

/* ─── Exam timer (unchanged) ─── */
interface ExamTimerState {
  examMinutes: number;
  examTimeLeft: number;
  examTotal: number;
  examProgress: number;
  examRunning: boolean;
  examCompleted: boolean;
  hasExamSession: boolean;
  setExamMinutes: (m: number) => void;
  startExam: (overrideMinutes?: number) => void;
  pauseExam: () => void;
  resetExam: () => void;
}

export type TimerContextType = FocusTimerState & TaskTimerState & ExamTimerState;

const TimerContext = createContext<TimerContextType | undefined>(undefined);

/* ─────────────────────────────────────────────────────────────
   AUDIO CHIME & NOTIFICATIONS
───────────────────────────────────────────────────────────── */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    // 4-note crystal bell chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.14;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const overtoneGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      overtone.type = "triangle";
      overtone.frequency.setValueAtTime(freq * 2.01, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.6);

      overtoneGain.gain.setValueAtTime(0.001, startTime);
      overtoneGain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(ctx.destination);
      overtoneGain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.7);
      overtone.start(startTime);
      overtone.stop(startTime + 0.9);
    });
  } catch {}

  // Desktop Notification
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Focus Session Complete! 🎉", {
          body: "Great work! Time for a well-deserved break.",
          icon: "/favicon.svg",
        });
      }
    }
  } catch {}
}

function playBreakChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const notes = [659.25, 523.25];
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.3);
    });
  } catch {}

  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Break Finished! ⚡", {
          body: "Ready to start your next focused session?",
          icon: "/favicon.svg",
        });
      }
    }
  } catch {}
}

/* ─────────────────────────────────────────────────────────────
   COUNTDOWN HOOK
───────────────────────────────────────────────────────────── */
function useCountdown(initialSeconds: number) {
  const [timeLeft, setTimeLeft]   = useState(initialSeconds);
  const [total, setTotal]         = useState(initialSeconds);
  const [running, setRunning]     = useState(false);
  const [completed, setCompleted] = useState(false);
  const endRef = useRef<number | null>(null);
  const ivRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!endRef.current) return;
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem <= 0) { endRef.current = null; setRunning(false); setCompleted(true); playChime(); }
    };
    tick();
    ivRef.current = setInterval(tick, 250);
    const vis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { if (ivRef.current) clearInterval(ivRef.current); document.removeEventListener("visibilitychange", vis); };
  }, [running]);

  const start = useCallback((overrideSecs?: number) => {
    const secs = overrideSecs ?? (completed ? total : timeLeft);
    endRef.current = Date.now() + secs * 1000;
    setTimeLeft(secs); setCompleted(false); setRunning(true);
  }, [completed, total, timeLeft]);

  const pause = useCallback(() => {
    if (endRef.current) setTimeLeft(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    endRef.current = null; setRunning(false);
  }, []);

  const reset = useCallback((secs?: number) => {
    const t = secs ?? total;
    endRef.current = null; setRunning(false); setCompleted(false);
    setTotal(t); setTimeLeft(t);
  }, [total]);

  // Add time while running
  const addTime = useCallback((secs: number) => {
    if (endRef.current) {
      endRef.current += secs * 1000;
      setTimeLeft(prev => prev + secs);
    } else {
      setTimeLeft(prev => {
        const next = prev + secs;
        setTotal(t => Math.max(t, next));
        return next;
      });
    }
  }, []);

  const progress = total > 0 ? ((total - timeLeft) / total) * 100 : 0;
  return { timeLeft, total, running, completed, progress, start, pause, reset, setTotal, addTime, endRef };
}

/* ─────────────────────────────────────────────────────────────
   STORAGE KEYS
───────────────────────────────────────────────────────────── */
const SK_ROUTINES   = "notez_ft_routines";
const SK_SESSIONS   = "notez_ft_sessions";
const SK_DAILY_GOAL = "notez_ft_daily_goal";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveJson(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ─────────────────────────────────────────────────────────────
   FAMOUS FIXED ROUTINES
───────────────────────────────────────────────────────────── */
export const FIXED_ROUTINES: Routine[] = [
  { id: "r-pomodoro",   name: "Pomodoro",       focusMins: 25, breakMins: 5,  cycles: 4, longBreakMins: 0, autoStart: true, favorite: true },
  { id: "r-deepwork",   name: "Deep Work",      focusMins: 50, breakMins: 10, cycles: 3, longBreakMins: 0, autoStart: true, favorite: false },
  { id: "r-ultradian",  name: "Ultradian Flow", focusMins: 90, breakMins: 20, cycles: 2, longBreakMins: 0, autoStart: true, favorite: false },
  { id: "r-sprint",     name: "Study Sprint",   focusMins: 45, breakMins: 15, cycles: 3, longBreakMins: 0, autoStart: true, favorite: false },
];
const DEFAULT_ROUTINES = FIXED_ROUTINES;

/* ─────────────────────────────────────────────────────────────
   ANALYTICS HELPERS
───────────────────────────────────────────────────────────── */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function weekKeys() {
  const keys: string[] = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    keys.push(dd.toISOString().slice(0, 10));
  }
  return keys;
}

function calcAnalytics(sessions: FocusSession[]) {
  const focusSessions = sessions.filter(s => s.mode === "focus");
  const completed     = focusSessions.filter(s => s.status === "completed");
  const today         = todayKey();
  const week          = new Set(weekKeys());

  const todayMins = focusSessions
    .filter(s => s.date === today && s.status === "completed")
    .reduce((sum, s) => sum + s.durationMins, 0);

  const weekMins = focusSessions
    .filter(s => week.has(s.date) && s.status === "completed")
    .reduce((sum, s) => sum + s.durationMins, 0);

  // streak: consecutive calendar days with at least 1 completed focus session
  const completedDays = [...new Set(completed.map(s => s.date))].sort();
  let streak = 0;
  let best   = 0;
  let cur    = 0;
  let prev   = "";
  for (const day of completedDays) {
    if (!prev) { cur = 1; }
    else {
      const diff = (new Date(day).getTime() - new Date(prev).getTime()) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > best) best = cur;
    prev = day;
  }
  // does streak extend to today?
  const lastDay = completedDays[completedDays.length - 1];
  if (lastDay) {
    const diffToday = (new Date(today).getTime() - new Date(lastDay).getTime()) / 86400000;
    streak = diffToday <= 1 ? cur : 0;
  }

  const rate = focusSessions.length > 0
    ? Math.round((completed.length / focusSessions.length) * 100)
    : 0;

  const avgMins = completed.length > 0
    ? Math.round(completed.reduce((s, x) => s + x.durationMins, 0) / completed.length)
    : 0;

  return { todayMins, weekMins, streak, best, rate, total: completed.length, avgMins };
}

/* ─────────────────────────────────────────────────────────────
   TIMER PROVIDER
───────────────────────────────────────────────────────────── */
export function TimerProvider({ children }: { children: ReactNode }) {
  /* ── auth ── */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── Focus-enhanced state ── */
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [breakMins, setBreakMinsState]        = useState(5);
  const [focusMode, setFocusModeState]        = useState<FocusMode>("focus");
  const [currentCycle, setCurrentCycle]       = useState(1);
  const [sessionCount, setSessionCount]       = useState(0);
  const [activeGoal, setActiveGoalState]      = useState<FocusGoal | null>(null);
  const [activeRoutine, setActiveRoutineState] = useState<Routine | null>(null);
  const [autoStart, setAutoStartState]        = useState<boolean>(() => {
    return localStorage.getItem("notez_ft_autostart") === "true";
  });

  const setAutoStart = useCallback((enabled: boolean) => {
    setAutoStartState(enabled);
    try { localStorage.setItem("notez_ft_autostart", enabled ? "true" : "false"); } catch {}
  }, []);

  // routines
  const [routines, setRoutines] = useState<Routine[]>(() => {
    const saved = loadJson<Routine[]>(SK_ROUTINES, []);
    return saved.length > 0 ? saved : DEFAULT_ROUTINES;
  });
  useEffect(() => { saveJson(SK_ROUTINES, routines); }, [routines]);

  // session history
  const [sessionHistory, setSessionHistory] = useState<FocusSession[]>(
    () => loadJson<FocusSession[]>(SK_SESSIONS, [])
  );
  useEffect(() => { saveJson(SK_SESSIONS, sessionHistory); }, [sessionHistory]);

  // daily goal
  const [dailyGoal, setDailyGoalState] = useState<DailyGoalSettings>(
    () => loadJson<DailyGoalSettings>(SK_DAILY_GOAL, { dailyMins: 120, weeklyMins: 600 })
  );
  useEffect(() => { saveJson(SK_DAILY_GOAL, dailyGoal); }, [dailyGoal]);

  /* ── Focus countdown ── */
  const focus = useCountdown(25 * 60);
  const focusStartedAt   = useRef<Date | null>(null);
  const focusPrevRunning = useRef(false);
  const focusStartTime   = useRef<string>("");

  const totalCycles = activeRoutine?.cycles ?? 4;

  /* ── Helpers to build a local session entry ── */
  function makeSession(durationMins: number, status: FocusSession["status"]): FocusSession {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      date: now.toISOString().slice(0, 10),
      startTime: focusStartTime.current || now.toISOString().slice(11, 16),
      durationMins,
      mode: focusMode,
      goalLabel: activeGoal?.label,
      subject: activeGoal?.subject,
      status,
    };
  }

  function pushSession(s: FocusSession) {
    setSessionHistory(prev => [s, ...prev].slice(0, 500));
  }

  /* ── Focus actions ── */
  const focusStart = useCallback(() => {
    let mins = focusMode === "focus" ? selectedMinutes : breakMins;
    if (mins <= 0) {
      mins = focusMode === "focus" ? 25 : 5;
      if (focusMode === "focus") setSelectedMinutes(25);
      else setBreakMinsState(5);
    }
    const secs = focus.completed || focus.timeLeft <= 0
      ? mins * 60
      : focus.timeLeft;
    focusStartedAt.current = new Date();
    focusStartTime.current = new Date().toISOString().slice(11, 16);
    focus.start(secs);
  }, [focus, selectedMinutes, breakMins, focusMode]);

  const focusReset = useCallback(() => {
    const secs = focusMode === "focus" ? selectedMinutes * 60 : breakMins * 60;
    focus.reset(secs);
  }, [focus, selectedMinutes, breakMins, focusMode]);

  const focusSkip = useCallback(() => {
    if (focus.running && focusStartedAt.current) {
      const elapsed = Math.round((Date.now() - focusStartedAt.current.getTime()) / 60000);
      if (elapsed >= 1) {
        const s = makeSession(elapsed, "skipped");
        pushSession(s);
        if (focusMode === "focus" && userId) {
          logCompletedSession(userId, elapsed, "focus", focusStartedAt.current);
        }
      }
    }
    focusStartedAt.current = null;
    // advance mode
    if (focusMode === "focus") {
      const nextCycle = currentCycle >= totalCycles ? 1 : currentCycle + 1;
      setCurrentCycle(nextCycle);
      setFocusModeState("break");
      focus.reset(breakMins * 60);
    } else {
      setFocusModeState("focus");
      focus.reset(selectedMinutes * 60);
    }
  }, [focus, focusMode, currentCycle, totalCycles, breakMins, selectedMinutes, userId, activeGoal, activeRoutine]);

  const focusAddTime = useCallback((mins: number) => {
    if (focus.completed) return;
    const current = focusMode === "focus" ? selectedMinutes : breakMins;
    const next = Math.min(120, Math.max(5, current + mins));
    const applied = next - current;
    if (applied === 0) return;
    focus.addTime(applied * 60);
    if (focusMode === "focus") setSelectedMinutes(next);
    else setBreakMinsState(next);
  }, [focus, focusMode, selectedMinutes, breakMins]);

  const selectMinutes = useCallback((m: number) => {
    if (focus.running) return;
    setSelectedMinutes(m);
    focus.reset(m * 60);
  }, [focus]);

  const setBreakMinutesFn = useCallback((m: number) => {
    if (focus.running) return;
    setBreakMinsState(m);
    focus.reset(m * 60);
  }, [focus]);

  const setFocusModeFn = useCallback((m: FocusMode) => {
    if (focus.running) return;
    setFocusModeState(m);
    focus.reset((m === "focus" ? selectedMinutes : breakMins) * 60);
  }, [focus, selectedMinutes, breakMins]);

  const setActiveGoal = useCallback((g: FocusGoal | null) => {
    setActiveGoalState(g);
  }, []);

  const setActiveRoutineFn = useCallback((r: Routine | null) => {
    setActiveRoutineState(r);
    if (r && !focus.running) {
      setSelectedMinutes(r.focusMins);
      setBreakMinsState(r.breakMins);
      setFocusModeState("focus");
      focus.reset(r.focusMins * 60);
      setCurrentCycle(1);
    }
  }, [focus]);

  // Log on natural completion & handle mode transition
  useEffect(() => {
    if (focus.running) { focusPrevRunning.current = true; return; }
    if (focus.completed && focusPrevRunning.current && focusStartedAt.current) {
      const mins = focusMode === "focus" ? selectedMinutes : breakMins;
      const s = makeSession(mins, "completed");
      pushSession(s);

      if (focusMode === "focus") {
        setSessionCount(c => c + 1);
        if (userId) logCompletedSession(userId, selectedMinutes, "focus", focusStartedAt.current!);
        const nextCycle = currentCycle >= totalCycles ? 1 : currentCycle + 1;
        setCurrentCycle(nextCycle);
        playChime();

        // Switch to Break mode
        setFocusModeState("break");
        const bMins = breakMins > 0 ? breakMins : 5;
        const bSecs = bMins * 60;

        if (autoStart) {
          // If auto-start is ON, immediately start the break countdown
          focusStartedAt.current = new Date();
          focusStartTime.current = new Date().toISOString().slice(11, 16);
          focus.start(bSecs);
          return;
        } else {
          // If auto-start is OFF, reset dial to break duration in paused/ready state
          focus.reset(bSecs);
        }
      } else {
        // Break completed -> play break chime, switch to Focus mode
        playBreakChime();
        setFocusModeState("focus");
        const fMins = selectedMinutes > 0 ? selectedMinutes : 25;
        const fSecs = fMins * 60;

        if (autoStart) {
          focusStartedAt.current = new Date();
          focusStartTime.current = new Date().toISOString().slice(11, 16);
          focus.start(fSecs);
          return;
        } else {
          focus.reset(fSecs);
        }
      }
      focusStartedAt.current = null;
    }
    focusPrevRunning.current = false;
  }, [focus.completed, focus.running, focusMode, selectedMinutes, breakMins, currentCycle, totalCycles, userId, autoStart]);

  /* ── Routine management ── */
  const addRoutine = useCallback((r: Omit<Routine, "id" | "lastUsed">) => {
    const newR: Routine = { ...r, id: crypto.randomUUID(), lastUsed: Date.now() };
    setRoutines(prev => [newR, ...prev]);
  }, []);

  const updateRoutine = useCallback((id: string, partial: Partial<Routine>) => {
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...partial } : r));
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
  }, []);

  const recordPartialSession = useCallback((durationMins: number, status: "partial" | "skipped") => {
    const s = makeSession(durationMins, status);
    pushSession(s);
  }, [focusMode, activeGoal]);

  /* ── Analytics (derived) ── */
  const analytics = calcAnalytics(sessionHistory);

  const focusTotalSeconds = (focusMode === "focus" ? selectedMinutes : breakMins) * 60;
  const focusHasSession   = focus.running || focus.completed || focus.timeLeft < focusTotalSeconds;

  /* ── Daily goal setter ── */
  const setDailyGoalFn = useCallback((g: DailyGoalSettings) => {
    setDailyGoalState(g);
  }, []);

  /* ═══════════════════════════════════════════════════════
     TASK TIMER (unchanged)
  ═══════════════════════════════════════════════════════ */
  const [tasks, setTasks]           = useState<FloatingTask[]>([]);
  const [activeTaskIdx, setActiveTaskIdx] = useState<number | null>(null);
  const task = useCountdown(300);
  const taskStartedAt   = useRef<Date | null>(null);
  const taskPrevRunning = useRef(false);

  const prevTaskIdx = useRef<number | null>(null);
  useEffect(() => {
    if (activeTaskIdx !== prevTaskIdx.current) {
      const t = activeTaskIdx !== null ? (tasks[activeTaskIdx]?.minutes ?? 5) * 60 : 300;
      task.reset(t);
    }
    prevTaskIdx.current = activeTaskIdx;
  }, [activeTaskIdx]);

  useEffect(() => {
    if (task.completed && activeTaskIdx !== null) {
      setTasks(prev => prev.map((t, i) => i === activeTaskIdx ? { ...t, done: true } : t));
    }
  }, [task.completed, activeTaskIdx]);

  useEffect(() => {
    if (task.running) { taskStartedAt.current = taskStartedAt.current ?? new Date(); taskPrevRunning.current = true; return; }
    if (task.completed && taskPrevRunning.current && userId && taskStartedAt.current && activeTaskIdx !== null) {
      const mins = tasks[activeTaskIdx]?.minutes ?? Math.round(task.total / 60);
      logCompletedSession(userId, mins, "task", taskStartedAt.current);
      taskStartedAt.current = null;
    }
    taskPrevRunning.current = false;
  }, [task.completed, task.running, userId, activeTaskIdx]);

  const addTask = useCallback((label: string, minutes: number) => {
    setTasks(prev => [...prev, { id: crypto.randomUUID(), label, minutes, done: false }]);
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (activeTaskIdx === idx) { setActiveTaskIdx(null); task.reset(); }
      else if (activeTaskIdx !== null && idx < activeTaskIdx) setActiveTaskIdx(a => a !== null ? a - 1 : null);
      return prev.filter(t => t.id !== id);
    });
  }, [activeTaskIdx, task]);

  const selectTask = useCallback((idx: number) => {
    if (task.running) task.pause();
    setActiveTaskIdx(idx);
  }, [task]);

  const nextTask = useCallback(() => {
    if (activeTaskIdx === null) return;
    const next = tasks.findIndex((t, i) => i > activeTaskIdx && !t.done);
    if (next !== -1) selectTask(next);
  }, [activeTaskIdx, tasks, selectTask]);

  const activeT = activeTaskIdx !== null ? tasks[activeTaskIdx] : null;
  const taskHasSession = task.running || (activeT !== null && !task.completed && task.timeLeft < (activeT?.minutes ?? 5) * 60);

  /* ═══════════════════════════════════════════════════════
     EXAM TIMER (unchanged)
  ═══════════════════════════════════════════════════════ */
  const [examMinutes, setExamMinutesState] = useState(15);
  const exam = useCountdown(15 * 60);
  const examStartedAt   = useRef<Date | null>(null);
  const examPrevRunning = useRef(false);

  const setExamMinutes = useCallback((m: number) => {
    setExamMinutesState(m);
    exam.reset(m * 60);
  }, [exam]);

  const startExam = useCallback((overrideMinutes?: number) => {
    const mins = (overrideMinutes !== undefined && overrideMinutes > 0) ? overrideMinutes : examMinutes;
    setExamMinutesState(mins);
    examStartedAt.current = new Date();
    exam.start(mins * 60);
  }, [exam, examMinutes]);

  const pauseExam  = useCallback(() => exam.pause(), [exam]);
  const resetExam  = useCallback(() => exam.reset(examMinutes * 60), [exam, examMinutes]);
  const examHasSession = exam.running || exam.completed || (examMinutes > 0 && exam.timeLeft < examMinutes * 60);

  useEffect(() => {
    if (exam.running) { examPrevRunning.current = true; return; }
    if (exam.completed && examPrevRunning.current && userId && examStartedAt.current) {
      logCompletedSession(userId, examMinutes, "exam", examStartedAt.current);
      examStartedAt.current = null;
    }
    examPrevRunning.current = false;
  }, [exam.completed, exam.running, userId, examMinutes]);

  /* ═══════════════════════════════════════════════════════
     CONTEXT VALUE
  ═══════════════════════════════════════════════════════ */
  const value: TimerContextType = {
    // focus (extended)
    selectedMinutes,
    breakMinutes: breakMins,
    timeLeft: focus.timeLeft,
    totalSeconds: focusTotalSeconds,
    progress: focus.progress,
    isRunning: focus.running,
    isCompleted: focus.completed,
    hasActiveSession: focusHasSession,
    focusMode,
    currentCycle,
    totalCycles,
    sessionCount,
    activeGoal,
    activeRoutine,
    autoStart,
    setAutoStart,
    start: focusStart,
    pause: focus.pause,
    reset: focusReset,
    skip: focusSkip,
    addTime: focusAddTime,
    selectMinutes,
    setBreakMinutes: setBreakMinutesFn,
    setFocusMode: setFocusModeFn,
    setActiveGoal,
    setActiveRoutine: setActiveRoutineFn,
    routines,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    sessionHistory,
    dailyGoal,
    setDailyGoal: setDailyGoalFn,
    todayFocusMins: analytics.todayMins,
    weekFocusMins: analytics.weekMins,
    currentStreak: analytics.streak,
    bestStreak: analytics.best,
    completionRate: analytics.rate,
    totalSessionsCompleted: analytics.total,
    avgSessionMins: analytics.avgMins,
    recordPartialSession,
    // task
    tasks, activeTaskIdx,
    taskTimeLeft: task.timeLeft, taskTotal: task.total,
    taskProgress: task.progress, taskRunning: task.running, taskCompleted: task.completed,
    hasTaskSession: taskHasSession,
    addTask, removeTask, selectTask,
    startTask: task.start, pauseTask: task.pause,
    resetTask: () => task.reset(activeT ? activeT.minutes * 60 : 300),
    nextTask,
    // exam
    examMinutes, examTimeLeft: exam.timeLeft, examTotal: exam.total,
    examProgress: exam.progress, examRunning: exam.running, examCompleted: exam.completed,
    hasExamSession: examHasSession,
    setExamMinutes, startExam, pauseExam, resetExam,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within a TimerProvider");
  return ctx;
}
