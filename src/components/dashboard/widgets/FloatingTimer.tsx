import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Clock } from 'lucide-react';
import { useTimer } from '@/lib/timer';

export default function FloatingTimer({ onClose }: { onClose: () => void }) {
  const {
    // focus
    timeLeft: focusTimeLeft, isRunning: focusRunning, start: focusStart, pause: focusPause, reset: focusReset,
    hasActiveSession,
    // task
    taskTimeLeft, taskRunning, startTask, pauseTask, resetTask,
    activeTaskIdx, tasks,
    hasTaskSession,
    // exam
    examTimeLeft, examRunning, startExam, pauseExam, resetExam,
    hasExamSession,
  } = useTimer();

  if (!hasActiveSession && !hasTaskSession && !hasExamSession) return null;

  const activeTask = activeTaskIdx !== null ? tasks[activeTaskIdx] : null;

  let modeLabel = 'Focus Session';
  let timeLeft = focusTimeLeft;
  let running = focusRunning;
  let onStart = focusStart;
  let onPause = focusPause;
  let onReset = () => focusReset();

  if (hasTaskSession) {
    modeLabel = activeTask ? activeTask.label : 'Task Timer';
    timeLeft = taskTimeLeft;
    running = taskRunning;
    onStart = startTask;
    onPause = pauseTask;
    onReset = () => resetTask();
  } else if (hasExamSession) {
    modeLabel = 'Exam Timer';
    timeLeft = examTimeLeft;
    running = examRunning;
    onStart = startExam;
    onPause = pauseExam;
    onReset = () => resetExam();
  }

  function fmt(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 rounded-2xl border border-border bg-secondary/95 backdrop-blur-md shadow-2xl p-2 sm:p-3 flex items-center gap-2 sm:gap-3 max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-center gap-2 pl-1">
        <div className="w-2 h-2 rounded-full bg-[hsl(var(--foreground))] animate-pulse" />
        <Clock className="h-4 w-4 text-foreground shrink-0" />
      </div>

      <div className="min-w-0 pr-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate max-w-[80px] sm:max-w-[140px]">
          {modeLabel}
        </p>
        <p className="text-sm font-mono font-bold text-foreground leading-none mt-0.5">
          {fmt(timeLeft)}
        </p>
      </div>

      <div className="flex items-center gap-1 border-l border-border pl-2">
        <button
          onClick={running ? onPause : onStart}
          className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary border border-border flex items-center justify-center text-foreground transition-colors"
          aria-label={running ? 'Pause' : 'Start'}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>

        <button
          onClick={onReset}
          className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors ml-1"
          aria-label="Close float widget"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
