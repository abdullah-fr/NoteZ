import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ListChecks, GraduationCap,
  Play, Pause, RotateCcw, Square, Check,
  Plus, Trash2, ChevronRight, ChevronLeft,
  Clock, Target, Zap, SkipForward, Coffee, Settings2,
} from 'lucide-react';
import { useTimer } from '@/lib/timer';
import { useTranslation } from 'react-i18next';

/* ─── types ─── */
type Tab = 'focus' | 'task' | 'exam';
type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

interface Task {
  id: string;
  label: string;
  minutes: number;
  done: boolean;
}

interface ExamQuestion {
  id: string;
  label: string;
  allocatedSeconds: number;
  done: boolean;
}

/* ─── constants ─── */
const TASK_OPTIONS = [1, 2, 5, 10];
const EXAM_PER_Q = [0.5, 1, 1.5, 2, 3, 5];

/* ─── tiny local timer hook ─── */
function useLocalTimer(initialSeconds: number) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [total, setTotal] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const endRef = useRef<number | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!endRef.current) return;
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem <= 0) { endRef.current = null; setRunning(false); setCompleted(true); }
    };
    tick();
    ivRef.current = setInterval(tick, 250);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { if (ivRef.current) clearInterval(ivRef.current); document.removeEventListener('visibilitychange', vis); };
  }, [running]);

  const start = useCallback(() => {
    const secs = completed ? total : timeLeft;
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
  return { timeLeft, total, running, completed, progress, start, pause, reset };
}

/* ─── helpers ─── */
function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function Ring({ progress, size = 200, stroke = 10, color }: { progress: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   POMODORO TIMER — Work → Short Break → ... → Long Break
══════════════════════════════════════════════════════════════ */
const PHASE_COLORS: Record<PomodoroPhase, string> = {
  focus: 'hsl(var(--timer-purple))',
  shortBreak: 'hsl(142, 70%, 55%)',
  longBreak: 'hsl(210, 80%, 55%)',
};

function PomodoroTimer() {
  const { t } = useTranslation();

  // Settings
  const [focusMins, setFocusMins] = useState(25);
  const [shortBreakMins, setShortBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);
  const [cyclesPerLong, setCyclesPerLong] = useState(4);
  const [showSettings, setShowSettings] = useState(false);

  // Pomodoro state
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [autoTransition, setAutoTransition] = useState(true);

  const phaseSeconds = phase === 'focus' ? focusMins * 60
    : phase === 'shortBreak' ? shortBreakMins * 60
    : longBreakMins * 60;

  const [timeLeft, setTimeLeft] = useState(phaseSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const endRef = useRef<number | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick logic
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      if (!endRef.current) return;
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem <= 0) {
        endRef.current = null;
        setIsRunning(false);
        setIsCompleted(true);
      }
    };
    tick();
    ivRef.current = setInterval(tick, 250);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { if (ivRef.current) clearInterval(ivRef.current); document.removeEventListener('visibilitychange', vis); };
  }, [isRunning]);

  // Auto-transition when phase completes
  useEffect(() => {
    if (!isCompleted) return;
    if (phase === 'focus') {
      setTotalSessions(s => s + 1);
    }
    if (!autoTransition) return;
    const timeout = setTimeout(() => {
      advancePhase();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isCompleted]);

  function advancePhase() {
    if (phase === 'focus') {
      if (currentCycle >= cyclesPerLong) {
        // Long break after N cycles
        startPhase('longBreak');
        setCurrentCycle(1);
      } else {
        startPhase('shortBreak');
      }
    } else {
      // After any break → focus
      if (phase === 'longBreak') {
        setCurrentCycle(1);
      } else {
        setCurrentCycle(c => c + 1);
      }
      startPhase('focus');
    }
  }

  function startPhase(p: PomodoroPhase) {
    const secs = p === 'focus' ? focusMins * 60 : p === 'shortBreak' ? shortBreakMins * 60 : longBreakMins * 60;
    setPhase(p);
    setTimeLeft(secs);
    setIsCompleted(false);
    setIsRunning(false);
    endRef.current = null;
  }

  function handleStart() {
    const secs = isCompleted ? phaseSeconds : timeLeft;
    endRef.current = Date.now() + secs * 1000;
    if (isCompleted) setTimeLeft(phaseSeconds);
    setIsCompleted(false);
    setIsRunning(true);
  }

  function handlePause() {
    if (endRef.current) setTimeLeft(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    endRef.current = null;
    setIsRunning(false);
  }

  function handleReset() {
    endRef.current = null;
    setIsRunning(false);
    setIsCompleted(false);
    setTimeLeft(phaseSeconds);
  }

  function handleSkip() {
    endRef.current = null;
    setIsRunning(false);
    setIsCompleted(false);
    advancePhase();
  }

  // Sync timeLeft when settings change and not running
  useEffect(() => {
    if (!isRunning && !isCompleted) {
      setTimeLeft(phaseSeconds);
    }
  }, [focusMins, shortBreakMins, longBreakMins, phase]);

  const progress = phaseSeconds > 0 ? ((phaseSeconds - timeLeft) / phaseSeconds) * 100 : 0;
  const phaseColor = PHASE_COLORS[phase];
  const phaseLabel = phase === 'focus' ? t('timer.focus') : phase === 'shortBreak' ? t('timer.shortBreak') : t('timer.longBreak');

  return (
    <div className="flex flex-col items-center gap-5 max-w-sm mx-auto pt-2">
      {/* Phase selector pills */}
      <div className="flex gap-1 p-1 rounded-xl bg-background border border-border w-full">
        {(['focus', 'shortBreak', 'longBreak'] as PomodoroPhase[]).map(p => (
          <button
            key={p}
            onClick={() => { if (!isRunning) startPhase(p); }}
            disabled={isRunning}
            className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all disabled:cursor-not-allowed ${
              phase === p
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={phase === p ? { backgroundColor: PHASE_COLORS[p] } : undefined}
          >
            {p === 'focus' ? `🎯 ${t('timer.focus')}` : p === 'shortBreak' ? `☕ ${t('timer.shortBreak')}` : `🌿 ${t('timer.longBreak')}`}
          </button>
        ))}
      </div>

      {/* Cycle indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: cyclesPerLong }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i < currentCycle - (phase === 'focus' && !isCompleted ? 1 : 0)
                ? 'bg-emerald-500'
                : i === currentCycle - 1 && phase === 'focus'
                ? `animate-pulse`
                : 'bg-border'
            }`}
            style={i === currentCycle - 1 && phase === 'focus' ? { backgroundColor: phaseColor } : undefined}
          />
        ))}
        <span className="text-[10px] font-mono text-muted-foreground ml-1">
          {t('timer.cycleOf', { current: currentCycle, total: cyclesPerLong })}
        </span>
      </div>

      {/* Ring */}
      <div className="relative shrink-0">
        <Ring progress={progress} size={200} stroke={10} color={phaseColor} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isCompleted ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-1">
              {phase === 'focus' ? (
                <>
                  <Check className="h-10 w-10 text-notez-success" />
                  <span className="text-[13px] font-medium text-notez-success">{t('timer.sessionDone')}</span>
                </>
              ) : (
                <>
                  <Coffee className="h-10 w-10 text-emerald-500" />
                  <span className="text-[13px] font-medium text-emerald-500">{t('timer.breakTime')}</span>
                </>
              )}
            </motion.div>
          ) : (
            <>
              <motion.span key={timeLeft} initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-[42px] font-bold font-mono tracking-tight text-foreground leading-none"
              >
                {fmt(timeLeft)}
              </motion.span>
              <span className="text-[11px] text-muted-foreground mt-1 font-mono">
                {isRunning ? (phase === 'focus' ? t('timer.focusing') : '☕ Break…') : phaseLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!isRunning ? (
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={handleStart}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: phaseColor, boxShadow: `0 0 20px ${phaseColor}40` }}
          >
            <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
          </motion.button>
        ) : (
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={handlePause}
            className="w-14 h-14 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Pause className="h-6 w-6 text-foreground" fill="currentColor" />
          </motion.button>
        )}
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={handleReset}
          className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <RotateCcw className="text-muted-foreground" style={{ width: 18, height: 18 }} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={handleSkip}
          title="Skip to next phase"
          className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <SkipForward className="text-muted-foreground" style={{ width: 18, height: 18 }} />
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'animate-pulse' : 'bg-secondary'}`}
            style={isRunning ? { backgroundColor: phaseColor } : undefined} />
          <span>{isRunning ? phaseLabel : isCompleted ? t('timer.sessionDone') : t('timer.ready')}</span>
        </div>
        {totalSessions > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-secondary border border-border" style={{ color: phaseColor }}>
            {totalSessions} done
          </span>
        )}
      </div>

      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(s => !s)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Settings
      </button>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-border bg-background">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Focus (min)</label>
                <input type="number" min={1} max={120} value={focusMins}
                  onChange={e => setFocusMins(Math.max(1, +e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground text-center outline-none disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Short Break</label>
                <input type="number" min={1} max={30} value={shortBreakMins}
                  onChange={e => setShortBreakMins(Math.max(1, +e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground text-center outline-none disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Long Break</label>
                <input type="number" min={1} max={60} value={longBreakMins}
                  onChange={e => setLongBreakMins(Math.max(1, +e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground text-center outline-none disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cycles</label>
                <input type="number" min={1} max={10} value={cyclesPerLong}
                  onChange={e => setCyclesPerLong(Math.max(1, +e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground text-center outline-none disabled:opacity-40"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <button
                  onClick={() => setAutoTransition(a => !a)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${autoTransition ? 'bg-emerald-500' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoTransition ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[11px] text-muted-foreground">Auto-transition to next phase</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK TIMER
══════════════════════════════════════════════════════════════ */
function TaskTimer() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newMins, setNewMins] = useState(5);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTask = activeIdx !== null ? tasks[activeIdx] : null;
  const timer = useLocalTimer(activeTask ? activeTask.minutes * 60 : 300);

  const prevIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeIdx !== prevIdxRef.current) {
      const t = activeIdx !== null ? (tasks[activeIdx]?.minutes ?? 5) * 60 : 300;
      timer.reset(t);
    }
    prevIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    if (timer.completed && activeIdx !== null) {
      setTasks(prev => prev.map((t, i) => i === activeIdx ? { ...t, done: true } : t));
    }
  }, [timer.completed, activeIdx]);

  function addTask() {
    if (!newLabel.trim()) return;
    setTasks(prev => [...prev, { id: crypto.randomUUID(), label: newLabel.trim(), minutes: newMins, done: false }]);
    setNewLabel('');
    inputRef.current?.focus();
  }

  function removeTask(id: string) {
    const idx = tasks.findIndex(t => t.id === id);
    if (activeIdx === idx) { setActiveIdx(null); timer.reset(); }
    else if (activeIdx !== null && idx < activeIdx) setActiveIdx(activeIdx - 1);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function selectTask(idx: number) {
    if (timer.running) timer.pause();
    setActiveIdx(idx);
  }

  function nextTask() {
    if (activeIdx === null) return;
    const next = tasks.findIndex((t, i) => i > activeIdx && !t.done);
    if (next !== -1) selectTask(next);
  }

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-5 pt-2">
      <p className="text-[12px] text-muted-foreground text-center leading-relaxed">
        Allocate a short deadline for each task. Complete it, move on. Short sprints drive real progress.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input ref={inputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Task name…"
          className="min-w-0 flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
        />
        <div className="flex flex-wrap gap-1">
          {TASK_OPTIONS.map(m => (
            <button key={m} onClick={() => setNewMins(m)}
              className={`px-2 py-2 rounded-lg text-[11px] font-mono transition-all ${newMins === m ? 'bg-[hsl(var(--timer-purple))] text-white' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary'
                }`}
            >{m}m</button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addTask}
          className="h-9 w-9 rounded-xl bg-[hsl(var(--timer-purple))] flex items-center justify-center hover:bg-[hsl(var(--timer-purple))] transition-colors shrink-0"
        >
          <Plus className="h-4 w-4 text-white" />
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          {tasks.length === 0 && (
            <div className="text-center py-8 text-[11px] text-muted-foreground">
              No tasks yet — add one above
            </div>
          )}
          {tasks.map((task, i) => (
            <motion.div key={task.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => selectTask(i)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${activeIdx === i
                  ? 'border-[hsl(var(--timer-purple))] bg-[hsl(var(--timer-purple))]'
                  : task.done
                    ? 'border-border bg-secondary opacity-50'
                    : 'border-border bg-secondary hover:border-border'
                }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${task.done ? 'border-notez-success bg-notez-success/20' : activeIdx === i ? 'border-[hsl(var(--timer-purple))]' : 'border-border'}`}>
                {task.done && <Check className="h-3 w-3 text-notez-success" />}
              </div>
              <span className={`flex-1 text-[13px] ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.label}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{task.minutes}m</span>
              {activeIdx === i && <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--timer-purple))] shrink-0" />}
              <button onClick={e => { e.stopPropagation(); removeTask(task.id); }}
                className="h-5 w-5 rounded flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-60 hover:text-destructive transition-all ml-1"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
          {tasks.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">{completedCount}/{tasks.length} tasks done</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          {activeTask ? (
            <>
              <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[hsl(var(--timer-purple))]">Active task</p>
              <p className="text-[13px] font-semibold text-foreground text-center">{activeTask.label}</p>
              <div className="relative">
                <Ring progress={timer.progress} size={160} stroke={8} color="hsl(var(--timer-purple))" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {timer.completed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                      <Check className="h-7 w-7 text-notez-success" />
                      <span className="text-[10px] text-notez-success mt-0.5">Done!</span>
                    </motion.div>
                  ) : (
                    <>
                      <span className="text-[28px] font-bold font-mono text-foreground leading-none">{fmt(timer.timeLeft)}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{timer.running ? 'Running' : 'Paused'}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!timer.running ? (
                  <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }} onClick={timer.start}
                    className="w-11 h-11 rounded-full bg-[hsl(var(--timer-purple))] flex items-center justify-center hover:bg-[hsl(var(--timer-purple))] transition-colors"
                  >
                    <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                  </motion.button>
                ) : (
                  <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }} onClick={timer.pause}
                    className="w-11 h-11 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Pause className="h-5 w-5 text-foreground" fill="currentColor" />
                  </motion.button>
                )}
                <button onClick={() => timer.reset(activeTask.minutes * 60)}
                  className="w-9 h-9 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <RotateCcw style={{ width: 15, height: 15 }} className="text-muted-foreground" />
                </button>
                <button onClick={nextTask} title="Next task"
                  className="w-9 h-9 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-secondary transition-colors"
                >
                  <ChevronRight style={{ width: 15, height: 15 }} className="text-muted-foreground" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ListChecks className="h-10 w-10 opacity-30" />
              <p className="text-[12px]">Select a task to start its timer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXAM TIMER
══════════════════════════════════════════════════════════════ */
function ExamTimer() {
  const { t } = useTranslation();
  type ExamMode = 'whole' | 'perQuestion';

  const [examMode, setExamMode] = useState<ExamMode>('whole');
  const [wholeMinutes, setWholeMinutes] = useState(60);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [newQLabel, setNewQLabel] = useState('');
  const [perQMins, setPerQMins] = useState(2);
  const [activeQIdx, setActiveQIdx] = useState<number | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  const wholeTimer = useLocalTimer(wholeMinutes * 60);
  const activeQ = activeQIdx !== null ? questions[activeQIdx] : null;
  const perQTimer = useLocalTimer(activeQ ? activeQ.allocatedSeconds : perQMins * 60);

  const prevQIdx = useRef<number | null>(null);
  useEffect(() => {
    if (activeQIdx !== prevQIdx.current && activeQ) {
      perQTimer.reset(activeQ.allocatedSeconds);
    }
    prevQIdx.current = activeQIdx;
  }, [activeQIdx]);

  useEffect(() => {
    if (perQTimer.completed && activeQIdx !== null) {
      setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, done: true } : q));
    }
  }, [perQTimer.completed, activeQIdx]);

  function addQuestion() {
    if (!newQLabel.trim()) return;
    setQuestions(prev => [...prev, {
      id: crypto.randomUUID(),
      label: newQLabel.trim(),
      allocatedSeconds: Math.round(perQMins * 60),
      done: false,
    }]);
    setNewQLabel('');
  }

  function removeQuestion(id: string) {
    const idx = questions.findIndex(q => q.id === id);
    if (activeQIdx === idx) { setActiveQIdx(null); perQTimer.reset(); }
    else if (activeQIdx !== null && idx < activeQIdx) setActiveQIdx(activeQIdx - 1);
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  function startExam() {
    setShowSetup(false);
    if (examMode === 'whole') wholeTimer.reset(wholeMinutes * 60);
    else if (questions.length > 0) { setActiveQIdx(0); perQTimer.reset(questions[0].allocatedSeconds); }
  }

  function nextQuestion() {
    if (activeQIdx === null) return;
    const next = questions.findIndex((q, i) => i > activeQIdx && !q.done);
    if (next !== -1) { setActiveQIdx(next); }
  }

  function prevQuestion() {
    if (activeQIdx === null || activeQIdx === 0) return;
    setActiveQIdx(activeQIdx - 1);
  }

  const completedQs = questions.filter(q => q.done).length;
  const totalTime = questions.reduce((acc, q) => acc + q.allocatedSeconds, 0);

  if (showSetup) return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pt-2">
      <p className="text-[12px] text-muted-foreground text-center leading-relaxed">
        Set a whole-exam countdown or allocate time per question — track exactly how much time each answer gets.
      </p>

      <div className="flex gap-2 p-1 rounded-xl bg-secondary border border-border">
        {(['whole', 'perQuestion'] as ExamMode[]).map(m => (
          <button key={m} onClick={() => setExamMode(m)}
            className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-all ${examMode === m ? 'bg-[hsl(var(--timer-purple))] text-white shadow-[0_0_14px_hsl(var(--timer-purple))]' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {m === 'whole' ? '⏱ Whole Exam Timer' : '📋 Per Question Timer'}
          </button>
        ))}
      </div>

      {examMode === 'whole' ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-muted-foreground text-center">Total exam duration</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {[30, 45, 60, 90, 120, 180].map(m => (
              <button key={m} onClick={() => setWholeMinutes(m)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${wholeMinutes === m ? 'bg-[hsl(var(--timer-purple))] text-white' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary'
                  }`}
              >{m < 60 ? `${m}m` : `${m / 60}h`}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-center mt-1">
            <input type="number" min={1} max={480} value={wholeMinutes}
              onChange={e => setWholeMinutes(Math.max(1, +e.target.value))}
              className="w-20 bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground outline-none text-center focus:border-border transition-colors"
            />
            <span className="text-[12px] text-muted-foreground">minutes total</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input value={newQLabel} onChange={e => setNewQLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
              placeholder="Question or scenario…"
              className="min-w-0 flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
            />
            <div className="flex flex-wrap gap-1">
              {EXAM_PER_Q.map(m => (
                <button key={m} onClick={() => setPerQMins(m)}
                  className={`px-2 py-2 rounded-lg text-[10px] font-mono transition-all ${perQMins === m ? 'bg-[hsl(var(--timer-purple))] text-white' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary'
                    }`}
                >{m}m</button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addQuestion}
              className="h-9 w-9 rounded-xl bg-[hsl(var(--timer-purple))] flex items-center justify-center hover:bg-[hsl(var(--timer-purple))] transition-colors shrink-0"
            >
              <Plus className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-auto">
            {questions.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Add questions above</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary">
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">Q{i + 1}</span>
                <span className="flex-1 text-[12px] text-foreground">{q.label}</span>
                <span className="text-[10px] font-mono text-[hsl(var(--timer-purple))] shrink-0">{fmt(q.allocatedSeconds)}</span>
                <button onClick={() => removeQuestion(q.id)} className="p-0.5 hover:text-destructive text-muted-foreground transition-colors"><Trash2 style={{ width: 12, height: 12 }} /></button>
              </div>
            ))}
          </div>

          {questions.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">{questions.length} questions · Total: {fmt(totalTime)}</p>
          )}
        </div>
      )}

      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startExam}
        className="w-full py-3 rounded-xl bg-[hsl(var(--timer-purple))] text-white font-semibold text-[14px] hover:bg-[hsl(var(--timer-purple))] transition-colors shadow-[0_0_20px_hsl(var(--timer-purple))]"
      >
        Start Exam Timer →
      </motion.button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <button onClick={() => { setShowSetup(true); wholeTimer.reset(); perQTimer.reset(); setActiveQIdx(null); }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft style={{ width: 14, height: 14 }} /> Setup
        </button>
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[hsl(var(--timer-purple))]">
          {examMode === 'whole' ? 'Whole Exam' : 'Per Question'}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {examMode === 'perQuestion' && questions.length > 0 ? `${completedQs}/${questions.length}` : ''}
        </span>
      </div>

      {examMode === 'whole' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Ring progress={wholeTimer.progress} size={200} stroke={10} color="hsl(var(--timer-purple))" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {wholeTimer.completed ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <Check className="h-8 w-8 text-notez-success" />
                  <span className="text-[12px] text-notez-success mt-1">Time's up!</span>
                </motion.div>
              ) : (
                <>
                  <span className="text-[36px] font-bold font-mono text-foreground leading-none">{fmt(wholeTimer.timeLeft)}</span>
                  <span className="text-[11px] text-muted-foreground mt-1">{fmt(wholeMinutes * 60)} total</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {!wholeTimer.running ? (
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={wholeTimer.start}
                className="w-14 h-14 rounded-full bg-[hsl(var(--timer-purple))] flex items-center justify-center shadow-[0_0_20px_hsl(var(--timer-purple)/0.3)] hover:bg-[hsl(var(--timer-purple))] transition-colors"
              >
                <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={wholeTimer.pause}
                className="w-14 h-14 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Pause className="h-5 w-5 text-foreground" fill="currentColor" />
              </motion.button>
            )}
            <button onClick={() => wholeTimer.reset(wholeMinutes * 60)}
              className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center self-center hover:bg-muted transition-colors"
            >
              <RotateCcw style={{ width: 15, height: 15 }} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {questions.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <GraduationCap className="h-8 w-8 opacity-30" />
                <p className="text-[11px]">No questions added</p>
              </div>
            )}
            {questions.map((q, i) => (
              <motion.div key={q.id}
                onClick={() => { if (perQTimer.running) perQTimer.pause(); setActiveQIdx(i); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${activeQIdx === i ? 'border-[hsl(var(--timer-purple))] bg-[hsl(var(--timer-purple))]'
                    : q.done ? 'border-border opacity-50' : 'border-border hover:border-border'
                  }`}
              >
                <span className={`text-[10px] font-mono shrink-0 ${q.done ? 'text-notez-success' : activeQIdx === i ? 'text-[hsl(var(--timer-purple))]' : 'text-muted-foreground'}`}>Q{i + 1}</span>
                <span className={`flex-1 text-[12px] ${q.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{q.label}</span>
                <span className="text-[10px] font-mono text-[hsl(var(--timer-purple))] shrink-0">{fmt(q.allocatedSeconds)}</span>
                {q.done && <Check className="h-3.5 w-3.5 text-notez-success shrink-0" />}
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            {activeQIdx !== null && activeQ ? (
              <>
                <p className="text-[10px] font-mono text-[hsl(var(--timer-purple))] uppercase tracking-[0.15em]">Q{activeQIdx + 1}</p>
                <p className="text-[12px] text-foreground text-center font-medium">{activeQ.label}</p>
                <div className="relative">
                  <Ring progress={perQTimer.progress} size={148} stroke={7} color="hsl(var(--timer-purple))" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {perQTimer.completed ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                        <Check className="h-6 w-6 text-notez-success" />
                        <span className="text-[9px] text-notez-success">Done</span>
                      </motion.div>
                    ) : (
                      <>
                        <span className="text-[24px] font-bold font-mono text-foreground leading-none">{fmt(perQTimer.timeLeft)}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">{perQTimer.running ? 'Running' : 'Paused'}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!perQTimer.running ? (
                    <button onClick={perQTimer.start} className="w-10 h-10 rounded-full bg-[hsl(var(--timer-purple))] flex items-center justify-center hover:bg-[hsl(var(--timer-purple))] transition-colors">
                      <Play className="text-white ml-0.5" fill="white" style={{ width: 18, height: 18 }} />
                    </button>
                  ) : (
                    <button onClick={perQTimer.pause} className="w-10 h-10 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                      <Pause className="h-4 w-4 text-foreground" fill="currentColor" />
                    </button>
                  )}
                  <button onClick={prevQuestion} className="w-8 h-8 rounded-lg border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronLeft style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                  </button>
                  <button onClick={nextQuestion} className="w-8 h-8 rounded-lg border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronRight style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <GraduationCap className="h-9 w-9 opacity-25" />
                <p className="text-[11px]">Select a question</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT — tabbed shell
══════════════════════════════════════════════════════════════ */
const TABS: { id: Tab; label: string; icon: any; color: string; descKey: string }[] = [
  { id: 'focus', label: 'Pomodoro', icon: Brain, color: 'hsl(var(--timer-purple))', descKey: 'timer.deepLearning' },
  { id: 'task', label: 'Task Timer', icon: ListChecks, color: 'hsl(var(--timer-purple))', descKey: 'timer.shortSprints' },
  { id: 'exam', label: 'Exam Timer', icon: GraduationCap, color: 'hsl(var(--timer-purple))', descKey: 'timer.examCountdown' },
];

export default function FocusTimerView() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Tab>('focus');
  const activeTab = TABS.find(t => t.id === active)!;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--timer-purple) / 0.12)', border: '1px solid hsl(var(--timer-purple) / 0.24)' }}>
          <activeTab.icon className="h-5 w-5" style={{ color: activeTab.color }} />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight leading-none">{activeTab.label}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t(activeTab.descKey)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-secondary border border-border mb-6">
        {TABS.map(tab => (
          <motion.button key={tab.id} onClick={() => setActive(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-medium transition-all ${active === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {active === tab.id && (
              <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl border"
                style={{ background: 'hsl(var(--timer-purple) / 0.10)', borderColor: 'hsl(var(--timer-purple) / 0.22)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <tab.icon className="h-4 w-4 relative z-10 shrink-0" style={{ color: active === tab.id ? tab.color : undefined }} />
            <span className="relative z-10 hidden sm:block">{tab.label}</span>
            <span className="relative z-10 sm:hidden text-[11px]">{tab.label.split(' ')[0]}</span>
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-border bg-secondary p-5">
        <AnimatePresence mode="wait">
          <motion.div key={active}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
          >
            {active === 'focus' && <PomodoroTimer />}
            {active === 'task' && <TaskTimer />}
            {active === 'exam' && <ExamTimer />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
