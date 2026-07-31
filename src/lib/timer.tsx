import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export const TIMER_OPTIONS = [15, 25, 30, 45, 60];

/* ─── Focus timer (existing, unchanged) ─── */
interface FocusTimerState {
  selectedMinutes: number;
  timeLeft: number;
  totalSeconds: number;
  progress: number;
  isRunning: boolean;
  isCompleted: boolean;
  hasActiveSession: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  selectMinutes: (m: number) => void;
}

/* ─── Task timer ─── */
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

/* ─── Exam timer ─── */
interface ExamTimerState {
  examMinutes: number;
  examTimeLeft: number;
  examTotal: number;
  examProgress: number;
  examRunning: boolean;
  examCompleted: boolean;
  hasExamSession: boolean;
  setExamMinutes: (m: number) => void;
  startExam: () => void;
  pauseExam: () => void;
  resetExam: () => void;
}

export type TimerContextType = FocusTimerState & TaskTimerState & ExamTimerState;

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const CHIME =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+fm5eLcGRbZ3WDkJycm5WLfW1iZHN/jZeZlZCIe29pbnN8hoyRkI2He3JwcXV6foOGh4WDf3x6eHh4eHt9f4GCgoGAfnx6eXl6e319fn5+fX17enl5ent8fH19fX18e3p5eXp7fH19fXx8e3p6enp7fH19fXx8e3p6ent8fHx8fHx7e3t7e3t8fHx8fHx7e3t7e3t8fHx8fHx7e3t7e3t8fHx8fHx7e3t7e3t8fHx8fHt7e3t7e3x8fHx8e3t7e3t7fHx8fHx7e3t7e3t8fHx8fHx7e3t7e3t8fHx8fHt7e3t7e3x8fHx8e3t7e3t7fHx8fA==";

function playChime() {
  try { new Audio(CHIME).play().catch(() => {}); } catch {}
}

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

  const progress = total > 0 ? ((total - timeLeft) / total) * 100 : 0;
  return { timeLeft, total, running, completed, progress, start, pause, reset, setTotal };
}

export function TimerProvider({ children }: { children: ReactNode }) {
  /* ── Focus timer ── */
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const focus = useCountdown(25 * 60);

  const focusStart = useCallback(() => {
    const secs = focus.completed ? selectedMinutes * 60 : focus.timeLeft;
    focus.start(secs);
  }, [focus, selectedMinutes]);

  const focusReset = useCallback(() => { focus.reset(selectedMinutes * 60); }, [focus, selectedMinutes]);

  const selectMinutes = useCallback((m: number) => {
    if (focus.running) return;
    setSelectedMinutes(m); focus.reset(m * 60);
  }, [focus]);

  const focusTotalSeconds = selectedMinutes * 60;
  const focusHasSession   = focus.running || focus.completed || focus.timeLeft < focusTotalSeconds;

  /* ── Task timer ── */
  const [tasks, setTasks]           = useState<FloatingTask[]>([]);
  const [activeTaskIdx, setActiveTaskIdx] = useState<number | null>(null);
  const task = useCountdown(300);

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

  /* ── Exam timer ── */
  const [examMinutes, setExamMinutesState] = useState(60);
  const exam = useCountdown(60 * 60);

  const setExamMinutes = useCallback((m: number) => {
    setExamMinutesState(m); if (!exam.running) exam.reset(m * 60);
  }, [exam]);

  const startExam  = useCallback(() => { exam.start(exam.completed ? examMinutes * 60 : exam.timeLeft); }, [exam, examMinutes]);
  const pauseExam  = useCallback(() => exam.pause(), [exam]);
  const resetExam  = useCallback(() => exam.reset(examMinutes * 60), [exam, examMinutes]);
  const examHasSession = exam.running || exam.completed || exam.timeLeft < examMinutes * 60;

  /* ── Context value ── */
  const value: TimerContextType = {
    // focus
    selectedMinutes, timeLeft: focus.timeLeft, totalSeconds: focusTotalSeconds,
    progress: focus.progress, isRunning: focus.running, isCompleted: focus.completed,
    hasActiveSession: focusHasSession,
    start: focusStart, pause: focus.pause, reset: focusReset, selectMinutes,
    // task
    tasks, activeTaskIdx, taskTimeLeft: task.timeLeft, taskTotal: task.total,
    taskProgress: task.progress, taskRunning: task.running, taskCompleted: task.completed,
    hasTaskSession: taskHasSession,
    addTask, removeTask, selectTask,
    startTask: task.start, pauseTask: task.pause, resetTask: () => task.reset(activeT ? activeT.minutes * 60 : 300),
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
