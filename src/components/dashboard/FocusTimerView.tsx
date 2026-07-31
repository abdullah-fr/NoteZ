import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ListChecks, GraduationCap,
  Play, Pause, RotateCcw, Square, Check,
  Plus, Trash2, ChevronRight, ChevronLeft,
  Clock, Target, Zap,
} from 'lucide-react';
import { useTimer } from '@/lib/timer';

/* ─── types ─── */
type Tab = 'focus' | 'task' | 'exam';

interface Task {
  id: string;
  label: string;
  minutes: number;
  done: boolean;
}

interface ExamQuestion {
  id: string;
  label: string;
  allocatedSeconds: number; // per-question allocated time
  done: boolean;
}

/* ─── constants ─── */
const FOCUS_OPTIONS  = [15, 25, 30, 45, 60, 90];
const TASK_OPTIONS   = [1, 2, 3, 5, 8, 10, 15];
const EXAM_PER_Q     = [0.5, 1, 1.5, 2, 3, 5]; // minutes per question

/* ─── tiny local timer hook (independent of global provider) ─── */
function useLocalTimer(initialSeconds: number) {
  const [timeLeft, setTimeLeft]     = useState(initialSeconds);
  const [total, setTotal]           = useState(initialSeconds);
  const [running, setRunning]       = useState(false);
  const [completed, setCompleted]   = useState(false);
  const endRef                      = useRef<number | null>(null);
  const ivRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const start  = useCallback(() => {
    const secs = completed ? total : timeLeft;
    endRef.current = Date.now() + secs * 1000;
    setTimeLeft(secs); setCompleted(false); setRunning(true);
  }, [completed, total, timeLeft]);

  const pause  = useCallback(() => {
    if (endRef.current) setTimeLeft(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    endRef.current = null; setRunning(false);
  }, []);

  const reset  = useCallback((secs?: number) => {
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
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function Ring({ progress, size = 200, stroke = 10, color }: { progress: number; size?: number; stroke?: number; color: string }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(220 8% 16%)" strokeWidth={stroke} />
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   FOCUS TIMER — uses global context so floating widget syncs
══════════════════════════════════════════════════════════════ */
function FocusTimer() {
  const { selectedMinutes, timeLeft, progress, isRunning, isCompleted, start, pause, reset, selectMinutes } = useTimer();
  const [sessions, setSessions] = useState(0);

  // count completed sessions
  const prevCompleted = useRef(false);
  useEffect(() => {
    if (isCompleted && !prevCompleted.current) setSessions(s => s + 1);
    prevCompleted.current = isCompleted;
  }, [isCompleted]);

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto pt-2">
      {/* Description */}
      <p className="text-[12px] text-[hsl(40_8%_48%)] text-center leading-relaxed">
        Deep focus for learning concepts, reviewing study material, and planning your study guides.
      </p>

      {/* Ring */}
      <div className="relative shrink-0">
        <Ring progress={progress} size={200} stroke={10} color="#a78bfa" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isCompleted ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-1">
              <Check className="h-10 w-10 text-emerald-400" />
              <span className="text-[13px] font-medium text-emerald-400">Session done!</span>
            </motion.div>
          ) : (
            <>
              <motion.span key={timeLeft} initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-[42px] font-bold font-mono tracking-tight text-[hsl(40_20%_92%)] leading-none"
              >
                {fmt(timeLeft)}
              </motion.span>
              <span className="text-[11px] text-[hsl(40_8%_48%)] mt-1 font-mono">
                {isRunning ? 'Focusing…' : 'Ready'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Duration pills */}
      <div className="flex gap-2 flex-wrap justify-center">
        {FOCUS_OPTIONS.map(m => (
          <button key={m} onClick={() => selectMinutes(m)} disabled={isRunning}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedMinutes === m && !isRunning
                ? 'bg-[hsl(270_50%_55%)] text-white shadow-[0_0_12px_hsl(270_50%_55%/0.3)]'
                : 'bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)] text-[hsl(40_8%_58%)] hover:bg-[hsl(220_8%_18%)] hover:text-[hsl(40_20%_78%)]'
            }`}
          >{m}m</button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isRunning ? (
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={start}
            className="w-14 h-14 rounded-full bg-[hsl(270_50%_55%)] flex items-center justify-center shadow-[0_0_20px_hsl(270_50%_55%/0.4)] hover:bg-[hsl(270_50%_60%)] transition-colors"
          >
            <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
          </motion.button>
        ) : (
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={pause}
            className="w-14 h-14 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
          >
            <Pause className="h-6 w-6 text-[hsl(40_20%_80%)]" fill="currentColor" />
          </motion.button>
        )}
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={() => reset()}
          className="w-12 h-12 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
        >
          <RotateCcw className="h-4.5 w-4.5 text-[hsl(40_8%_52%)]" style={{ width: 18, height: 18 }} />
        </motion.button>
      </div>

      {/* Session counter */}
      <div className="flex items-center gap-2 text-[11px] text-[hsl(40_8%_42%)]">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[hsl(270_50%_60%)] animate-pulse' : 'bg-[hsl(220_8%_28%)]'}`} />
        <span>{isRunning ? 'Session in progress' : isCompleted ? 'Session complete' : 'Ready to start'}</span>
        {sessions > 0 && <span className="ml-2 px-2 py-0.5 rounded-md bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)] text-[hsl(270_40%_65%)]">{sessions} done</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK TIMER
══════════════════════════════════════════════════════════════ */
function TaskTimer() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [newLabel, setNewLabel]     = useState('');
  const [newMins, setNewMins]       = useState(5);
  const [activeIdx, setActiveIdx]   = useState<number | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const activeTask = activeIdx !== null ? tasks[activeIdx] : null;
  const timer = useLocalTimer(activeTask ? activeTask.minutes * 60 : 300);

  // Reset timer when active task changes
  const prevIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeIdx !== prevIdxRef.current) {
      const t = activeIdx !== null ? (tasks[activeIdx]?.minutes ?? 5) * 60 : 300;
      timer.reset(t);
    }
    prevIdxRef.current = activeIdx;
  }, [activeIdx]);

  // Mark task done when timer completes
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
      <p className="text-[12px] text-[hsl(40_8%_48%)] text-center leading-relaxed">
        Allocate a short deadline for each task. Complete it, move on. Short sprints drive real progress.
      </p>

      {/* Add task form */}
      <div className="flex gap-2 items-center">
        <input ref={inputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Task name…"
          className="flex-1 bg-[hsl(220_8%_12%)] border border-[hsl(220_8%_20%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_35%)] outline-none focus:border-[hsl(220_8%_30%)] transition-colors"
        />
        {/* Duration pills */}
        <div className="flex gap-1">
          {TASK_OPTIONS.map(m => (
            <button key={m} onClick={() => setNewMins(m)}
              className={`px-2 py-2 rounded-lg text-[11px] font-mono transition-all ${
                newMins === m ? 'bg-[hsl(32_70%_48%)] text-white' : 'bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)] text-[hsl(40_8%_50%)] hover:bg-[hsl(220_8%_18%)]'
              }`}
            >{m}m</button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addTask}
          className="h-9 w-9 rounded-xl bg-[hsl(32_70%_48%)] flex items-center justify-center hover:bg-[hsl(32_70%_54%)] transition-colors shrink-0"
        >
          <Plus className="h-4 w-4 text-white" />
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Task list */}
        <div className="space-y-1.5">
          {tasks.length === 0 && (
            <div className="text-center py-8 text-[11px] text-[hsl(40_8%_36%)]">
              No tasks yet — add one above
            </div>
          )}
          {tasks.map((task, i) => (
            <motion.div key={task.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => selectTask(i)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                activeIdx === i
                  ? 'border-[hsl(32_70%_45%)] bg-[hsl(32_70%_40%/0.12)]'
                  : task.done
                  ? 'border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] opacity-50'
                  : 'border-[hsl(220_8%_18%)] bg-[hsl(220_8%_11%)] hover:border-[hsl(220_8%_26%)]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${task.done ? 'border-emerald-400 bg-emerald-400/20' : activeIdx === i ? 'border-[hsl(32_70%_55%)]' : 'border-[hsl(220_8%_28%)]'}`}>
                {task.done && <Check className="h-3 w-3 text-emerald-400" />}
              </div>
              <span className={`flex-1 text-[13px] ${task.done ? 'line-through text-[hsl(40_8%_40%)]' : 'text-[hsl(40_20%_82%)]'}`}>
                {task.label}
              </span>
              <span className="text-[10px] font-mono text-[hsl(40_8%_42%)] shrink-0">{task.minutes}m</span>
              {activeIdx === i && <ChevronRight className="h-3.5 w-3.5 text-[hsl(32_70%_55%)] shrink-0" />}
              <button onClick={e => { e.stopPropagation(); removeTask(task.id); }}
                className="h-5 w-5 rounded flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-60 hover:text-red-400 transition-all ml-1"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
          {tasks.length > 0 && (
            <p className="text-[10px] text-[hsl(40_8%_36%)] text-center pt-1">{completedCount}/{tasks.length} tasks done</p>
          )}
        </div>

        {/* Active task timer */}
        <div className="flex flex-col items-center gap-3">
          {activeTask ? (
            <>
              <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[hsl(32_70%_55%)]">Active task</p>
              <p className="text-[13px] font-semibold text-[hsl(40_20%_86%)] text-center">{activeTask.label}</p>
              <div className="relative">
                <Ring progress={timer.progress} size={160} stroke={8} color="hsl(32 70% 55%)" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {timer.completed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                      <Check className="h-7 w-7 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 mt-0.5">Done!</span>
                    </motion.div>
                  ) : (
                    <>
                      <span className="text-[28px] font-bold font-mono text-[hsl(40_20%_92%)] leading-none">{fmt(timer.timeLeft)}</span>
                      <span className="text-[10px] text-[hsl(40_8%_45%)] mt-0.5">{timer.running ? 'Running' : 'Paused'}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!timer.running ? (
                  <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }} onClick={timer.start}
                    className="w-11 h-11 rounded-full bg-[hsl(32_70%_48%)] flex items-center justify-center hover:bg-[hsl(32_70%_54%)] transition-colors"
                  >
                    <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                  </motion.button>
                ) : (
                  <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }} onClick={timer.pause}
                    className="w-11 h-11 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                  >
                    <Pause className="h-5 w-5 text-[hsl(40_20%_78%)]" fill="currentColor" />
                  </motion.button>
                )}
                <button onClick={() => timer.reset(activeTask.minutes * 60)}
                  className="w-9 h-9 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
                >
                  <RotateCcw style={{ width: 15, height: 15 }} className="text-[hsl(40_8%_50%)]" />
                </button>
                <button onClick={nextTask} title="Next task"
                  className="w-9 h-9 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
                >
                  <ChevronRight style={{ width: 15, height: 15 }} className="text-[hsl(40_8%_50%)]" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[hsl(40_8%_36%)]">
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
  type ExamMode = 'whole' | 'perQuestion';

  const [examMode, setExamMode]           = useState<ExamMode>('whole');
  const [wholeMinutes, setWholeMinutes]   = useState(60);
  const [questions, setQuestions]         = useState<ExamQuestion[]>([]);
  const [newQLabel, setNewQLabel]         = useState('');
  const [perQMins, setPerQMins]           = useState(2);
  const [activeQIdx, setActiveQIdx]       = useState<number | null>(null);
  const [showSetup, setShowSetup]         = useState(true);

  // Whole exam timer
  const wholeTimer = useLocalTimer(wholeMinutes * 60);

  // Per-question timer
  const activeQ     = activeQIdx !== null ? questions[activeQIdx] : null;
  const perQTimer   = useLocalTimer(activeQ ? activeQ.allocatedSeconds : perQMins * 60);

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
  const totalTime   = questions.reduce((acc, q) => acc + q.allocatedSeconds, 0);

  if (showSetup) return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pt-2">
      <p className="text-[12px] text-[hsl(40_8%_48%)] text-center leading-relaxed">
        Set a whole-exam countdown or allocate time per question — track exactly how much time each answer gets.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-[hsl(220_8%_11%)] border border-[hsl(220_8%_18%)]">
        {(['whole', 'perQuestion'] as ExamMode[]).map(m => (
          <button key={m} onClick={() => setExamMode(m)}
            className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-all ${
              examMode === m ? 'bg-[hsl(200_70%_45%)] text-white shadow-[0_0_14px_hsl(200_70%_45%/0.35)]' : 'text-[hsl(40_8%_50%)] hover:text-[hsl(40_20%_72%)]'
            }`}
          >
            {m === 'whole' ? '⏱ Whole Exam Timer' : '📋 Per Question Timer'}
          </button>
        ))}
      </div>

      {examMode === 'whole' ? (
        /* Whole exam duration */
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-[hsl(40_8%_44%)] text-center">Total exam duration</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {[30, 45, 60, 90, 120, 180].map(m => (
              <button key={m} onClick={() => setWholeMinutes(m)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                  wholeMinutes === m ? 'bg-[hsl(200_70%_45%)] text-white' : 'bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)] text-[hsl(40_8%_55%)] hover:bg-[hsl(220_8%_18%)]'
                }`}
              >{m < 60 ? `${m}m` : `${m/60}h`}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-center mt-1">
            <input type="number" min={1} max={480} value={wholeMinutes}
              onChange={e => setWholeMinutes(Math.max(1, +e.target.value))}
              className="w-20 bg-[hsl(220_8%_12%)] border border-[hsl(220_8%_22%)] rounded-lg px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] outline-none text-center focus:border-[hsl(220_8%_32%)] transition-colors"
            />
            <span className="text-[12px] text-[hsl(40_8%_44%)]">minutes total</span>
          </div>
        </div>
      ) : (
        /* Per-question setup */
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <input value={newQLabel} onChange={e => setNewQLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
              placeholder="Question or scenario…"
              className="flex-1 bg-[hsl(220_8%_12%)] border border-[hsl(220_8%_20%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_34%)] outline-none focus:border-[hsl(220_8%_30%)] transition-colors"
            />
            <div className="flex gap-1">
              {EXAM_PER_Q.map(m => (
                <button key={m} onClick={() => setPerQMins(m)}
                  className={`px-2 py-2 rounded-lg text-[10px] font-mono transition-all ${
                    perQMins === m ? 'bg-[hsl(200_70%_45%)] text-white' : 'bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)] text-[hsl(40_8%_48%)] hover:bg-[hsl(220_8%_18%)]'
                  }`}
                >{m}m</button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addQuestion}
              className="h-9 w-9 rounded-xl bg-[hsl(200_70%_45%)] flex items-center justify-center hover:bg-[hsl(200_70%_51%)] transition-colors shrink-0"
            >
              <Plus className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-auto">
            {questions.length === 0 && <p className="text-[11px] text-[hsl(40_8%_35%)] text-center py-3">Add questions above — or start without them for a generic per-question timer</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(220_8%_17%)] bg-[hsl(220_8%_11%)]">
                <span className="text-[11px] text-[hsl(40_8%_45%)] font-mono shrink-0">Q{i+1}</span>
                <span className="flex-1 text-[12px] text-[hsl(40_20%_78%)]">{q.label}</span>
                <span className="text-[10px] font-mono text-[hsl(200_50%_55%)] shrink-0">{fmt(q.allocatedSeconds)}</span>
                <button onClick={() => removeQuestion(q.id)} className="p-0.5 hover:text-red-400 text-[hsl(40_8%_40%)] transition-colors"><Trash2 style={{ width: 12, height: 12 }} /></button>
              </div>
            ))}
          </div>

          {questions.length > 0 && (
            <p className="text-[10px] text-[hsl(40_8%_38%)] text-center">{questions.length} questions · Total: {fmt(totalTime)}</p>
          )}
        </div>
      )}

      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startExam}
        className="w-full py-3 rounded-xl bg-[hsl(200_70%_45%)] text-white font-semibold text-[14px] hover:bg-[hsl(200_70%_51%)] transition-colors shadow-[0_0_20px_hsl(200_70%_45%/0.3)]"
      >
        Start Exam Timer →
      </motion.button>
    </div>
  );

  /* ── Active exam session ── */
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <button onClick={() => { setShowSetup(true); wholeTimer.reset(); perQTimer.reset(); setActiveQIdx(null); }}
          className="flex items-center gap-1 text-[11px] text-[hsl(40_8%_44%)] hover:text-[hsl(40_20%_70%)] transition-colors"
        >
          <ChevronLeft style={{ width: 14, height: 14 }} /> Setup
        </button>
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[hsl(200_50%_55%)]">
          {examMode === 'whole' ? 'Whole Exam' : 'Per Question'}
        </span>
        <span className="text-[11px] text-[hsl(40_8%_40%)]">
          {examMode === 'perQuestion' && questions.length > 0 ? `${completedQs}/${questions.length}` : ''}
        </span>
      </div>

      {examMode === 'whole' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Ring progress={wholeTimer.progress} size={180} stroke={9} color="hsl(200 70% 55%)" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {wholeTimer.completed ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <Check className="h-8 w-8 text-emerald-400" />
                  <span className="text-[12px] text-emerald-400 mt-1">Time's up!</span>
                </motion.div>
              ) : (
                <>
                  <span className="text-[36px] font-bold font-mono text-[hsl(40_20%_92%)] leading-none">{fmt(wholeTimer.timeLeft)}</span>
                  <span className="text-[11px] text-[hsl(40_8%_46%)] mt-1">{fmt(wholeMinutes * 60)} total</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {!wholeTimer.running ? (
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={wholeTimer.start}
                className="w-12 h-12 rounded-full bg-[hsl(200_70%_45%)] flex items-center justify-center hover:bg-[hsl(200_70%_51%)] transition-colors"
              >
                <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={wholeTimer.pause}
                className="w-12 h-12 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
              >
                <Pause className="h-5 w-5 text-[hsl(40_20%_78%)]" fill="currentColor" />
              </motion.button>
            )}
            <button onClick={() => wholeTimer.reset(wholeMinutes * 60)}
              className="w-10 h-10 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center self-center hover:bg-[hsl(220_8%_17%)] transition-colors"
            >
              <RotateCcw style={{ width: 15, height: 15 }} className="text-[hsl(40_8%_50%)]" />
            </button>
          </div>
        </div>
      ) : (
        /* Per-question view */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Question list */}
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {questions.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-[hsl(40_8%_36%)]">
                <GraduationCap className="h-8 w-8 opacity-30" />
                <p className="text-[11px]">No questions added</p>
              </div>
            )}
            {questions.map((q, i) => (
              <motion.div key={q.id}
                onClick={() => { if (perQTimer.running) perQTimer.pause(); setActiveQIdx(i); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  activeQIdx === i ? 'border-[hsl(200_70%_42%)] bg-[hsl(200_70%_40%/0.1)]'
                  : q.done ? 'border-[hsl(220_8%_15%)] opacity-50' : 'border-[hsl(220_8%_18%)] hover:border-[hsl(220_8%_25%)]'
                }`}
              >
                <span className={`text-[10px] font-mono shrink-0 ${q.done ? 'text-emerald-400' : activeQIdx === i ? 'text-[hsl(200_50%_60%)]' : 'text-[hsl(40_8%_42%)]'}`}>Q{i+1}</span>
                <span className={`flex-1 text-[12px] ${q.done ? 'line-through text-[hsl(40_8%_40%)]' : 'text-[hsl(40_20%_80%)]'}`}>{q.label}</span>
                <span className="text-[10px] font-mono text-[hsl(200_50%_52%)] shrink-0">{fmt(q.allocatedSeconds)}</span>
                {q.done && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </motion.div>
            ))}
          </div>

          {/* Active question timer */}
          <div className="flex flex-col items-center gap-3">
            {activeQIdx !== null && activeQ ? (
              <>
                <p className="text-[10px] font-mono text-[hsl(200_50%_55%)] uppercase tracking-[0.15em]">Q{activeQIdx+1}</p>
                <p className="text-[12px] text-[hsl(40_20%_82%)] text-center font-medium">{activeQ.label}</p>
                <div className="relative">
                  <Ring progress={perQTimer.progress} size={148} stroke={7} color="hsl(200 70% 55%)" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {perQTimer.completed ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                        <Check className="h-6 w-6 text-emerald-400" />
                        <span className="text-[9px] text-emerald-400">Done</span>
                      </motion.div>
                    ) : (
                      <>
                        <span className="text-[24px] font-bold font-mono text-[hsl(40_20%_92%)] leading-none">{fmt(perQTimer.timeLeft)}</span>
                        <span className="text-[9px] text-[hsl(40_8%_44%)] mt-0.5">{perQTimer.running ? 'Running' : 'Paused'}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!perQTimer.running ? (
                    <button onClick={perQTimer.start} className="w-10 h-10 rounded-full bg-[hsl(200_70%_45%)] flex items-center justify-center hover:bg-[hsl(200_70%_51%)] transition-colors">
                      <Play className="h-4.5 w-4.5 text-white ml-0.5" fill="white" style={{ width: 18, height: 18 }} />
                    </button>
                  ) : (
                    <button onClick={perQTimer.pause} className="w-10 h-10 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors">
                      <Pause className="h-4 w-4 text-[hsl(40_20%_78%)]" fill="currentColor" />
                    </button>
                  )}
                  <button onClick={prevQuestion} className="w-8 h-8 rounded-lg border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors">
                    <ChevronLeft style={{ width: 14, height: 14 }} className="text-[hsl(40_8%_50%)]" />
                  </button>
                  <button onClick={nextQuestion} className="w-8 h-8 rounded-lg border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors">
                    <ChevronRight style={{ width: 14, height: 14 }} className="text-[hsl(40_8%_50%)]" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-[hsl(40_8%_35%)]">
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
const TABS: { id: Tab; label: string; icon: any; color: string; desc: string }[] = [
  { id: 'focus', label: 'Focus Timer', icon: Brain,         color: '#a78bfa', desc: 'Deep learning sessions' },
  { id: 'task',  label: 'Task Timer',  icon: ListChecks,    color: 'hsl(32 70% 55%)', desc: 'Short task sprints' },
  { id: 'exam',  label: 'Exam Timer',  icon: GraduationCap, color: 'hsl(200 70% 55%)', desc: 'Exam countdown' },
];

export default function FocusTimerView() {
  const [active, setActive] = useState<Tab>('focus');
  const activeTab = TABS.find(t => t.id === active)!;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: activeTab.color + '20', border: `1px solid ${activeTab.color}35` }}>
          <activeTab.icon className="h-5 w-5" style={{ color: activeTab.color }} />
        </div>
        <div>
          <h2 className="text-[18px] font-bold leading-none">{activeTab.label}</h2>
          <p className="text-[11px] text-[hsl(40_8%_46%)] mt-0.5">{activeTab.desc}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-[hsl(220_8%_10%)] border border-[hsl(220_8%_16%)] mb-6">
        {TABS.map(tab => (
          <motion.button key={tab.id} onClick={() => setActive(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
              active === tab.id ? 'text-[hsl(40_20%_90%)]' : 'text-[hsl(40_8%_45%)] hover:text-[hsl(40_20%_68%)]'
            }`}
          >
            {active === tab.id && (
              <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl border"
                style={{ background: tab.color + '15', borderColor: tab.color + '30' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <tab.icon className="h-4 w-4 relative z-10 shrink-0" style={{ color: active === tab.id ? tab.color : undefined }} />
            <span className="relative z-10 hidden sm:block">{tab.label}</span>
            {active === tab.id && <span className="relative z-10 sm:hidden">{tab.label.split(' ')[0]}</span>}
          </motion.button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-5">
        <AnimatePresence mode="wait">
          <motion.div key={active}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
          >
            {active === 'focus' && <FocusTimer />}
            {active === 'task'  && <TaskTimer />}
            {active === 'exam'  && <ExamTimer />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
