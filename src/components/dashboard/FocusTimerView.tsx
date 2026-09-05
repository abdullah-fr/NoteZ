/**
 * FocusTimerView — Refined, 100% Responsive & Fixed Routines Focus Timer
 *
 * Updates:
 * 1. Custom 1-minute timer sets and counts down accurately without overriding.
 * 2. Fixed Routines: Curated famous scientific routines (Pomodoro 25/5m, Deep Work 50/10m, Ultradian Flow 90/20m, Study Sprint 45/15m). User add/edit routine removed.
 * 3. Pomodoro auto-transition: When 25m focus completes, break timer immediately starts counting down with chime notification!
 * 4. Soothing rain audio synthesized with stereo pink noise & droplet textures.
 * 5. Clean footer without duplicate icon & 100% responsive mobile layout without any overlapping.
 */

import {
  useState, useEffect, useRef, useMemo, useCallback,
  PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, RotateCcw, X,
  Target, Coffee, Edit2,
  BarChart2, Folder,
  Volume2, VolumeX, CheckCircle2, Circle, AlertCircle,
  ChevronDown, Check,
} from "lucide-react";
import { useTimer, FIXED_ROUTINES, type FocusGoal, type Routine, type FocusSession, type FocusMode } from "@/lib/timer";
import { useCalendar } from "@/lib/calendar";
import { ambientEngine, AMBIENT_TRACKS, type AmbientTrack } from "@/lib/ambientAudio";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const STEP_MINS = 5;
const QUICK_PRESETS = [15, 25, 30, 45, 60, 90];
const STUDENT_TIPS = [
  "Consistency is more important than intensity. Small daily focus builds great results.",
  "25 minutes of deep focus beats 3 hours of distracted skimming.",
  "One focused hour today saves three stressful hours before finals.",
  "Active recall during focused sessions builds unbreakable memory.",
  "Protect your focus environment like your grades depend on it.",
  "Quality of study time always trumps quantity of idle seat time.",
  "Focus on progress, not perfection — one interval at a time.",
  "Mastering time management is mastering stress-free success.",
];

/* ─────────────────────────────────────────────────────────────
   FORMATTING HELPERS
───────────────────────────────────────────────────────────── */
function fmtMSec(secs: number) {
  if (secs <= 0) return "0m 00s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
function fmtMins(mins: number) {
  if (!mins || mins <= 0) return "0m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtHHMM(mins: number) {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function fmtTime(iso: string) {
  const [hStr, mStr] = iso.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${mStr || "00"} ${ampm}`;
}
function fmtDateLabel(dateStr: string) {
  const today = todayKey();
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ─────────────────────────────────────────────────────────────
   CIRCULAR TIMER RING (DYNAMIC & RESPONSIVE)
───────────────────────────────────────────────────────────── */
interface RingProps {
  progress: number;
  displayTime: string;
  isRunning: boolean;
  isBreak: boolean;
  isCompleted: boolean;
  selectedMins: number;
  timeLeft: number;
  onDragChange?: (m: number) => void;
  size: number;
}

function CircularTimerRing({
  displayTime, isRunning, isBreak, isCompleted, selectedMins, timeLeft, onDragChange, size,
}: RingProps) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const stroke = Math.max(9, size * 0.044);
  const r    = (size - stroke * 2.8) / 2;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  const cy   = size / 2;

  // Dynamic dial scale
  const dialBaseMins = selectedMins > 120 ? 180 : selectedMins > 60 ? 120 : 60;

  // Fill fraction (0 to 1)
  const fillFrac = isRunning
    ? Math.min(1, Math.max(0, (timeLeft / 60) / dialBaseMins))
    : Math.min(1, Math.max(0, selectedMins / dialBaseMins));

  // Arc length in pixels
  const arcLength = fillFrac <= 0 ? 0 : Math.max(0.001, fillFrac * circ);

  // Knob coordinates (12 o'clock = -90 deg)
  const dotAngleRad = (fillFrac * 360 - 90) * (Math.PI / 180);
  const dotX = cx + r * Math.cos(dotAngleRad);
  const dotY = cy + r * Math.sin(dotAngleRad);

  const arcColor = isBreak ? "#10b981" : "hsl(var(--primary))";

  function angleToDuration(clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return selectedMins;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left - cx;
    const y = clientY - rect.top  - cy;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    const rawMins = (deg / 360) * dialBaseMins;
    let snapped = Math.round(rawMins / STEP_MINS) * STEP_MINS;
    if (snapped === 0 && deg > 340) snapped = dialBaseMins;
    return Math.min(dialBaseMins, Math.max(0, snapped));
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (isRunning) return;
    dragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    onDragChange?.(angleToDuration(e.clientX, e.clientY));
  }
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging.current || isRunning) return;
    onDragChange?.(angleToDuration(e.clientX, e.clientY));
  }
  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    dragging.current = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  }

  const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
  const totalTicks = 60;
  for (let i = 0; i < totalTicks; i++) {
    const frac  = i / totalTicks;
    const aRad  = (frac * 360 - 90) * (Math.PI / 180);
    const major = i % 5 === 0;
    const outer = r - stroke * 0.75;
    const inner = r - (major ? stroke * 1.55 : stroke * 1.1);
    ticks.push({
      x1: cx + inner * Math.cos(aRad), y1: cy + inner * Math.sin(aRad),
      x2: cx + outer * Math.cos(aRad), y2: cy + outer * Math.sin(aRad),
      major,
    });
  }

  const cardinalLabels = [
    { label: String(dialBaseMins), deg: 0 },
    { label: String(Math.round(dialBaseMins * 0.25)), deg: 90 },
    { label: String(Math.round(dialBaseMins * 0.5)), deg: 180 },
    { label: String(Math.round(dialBaseMins * 0.75)), deg: 270 },
  ].map(item => {
    const aRad = (item.deg - 90) * (Math.PI / 180);
    const lr   = r + stroke * 1.48;
    return {
      label: item.label,
      x: cx + lr * Math.cos(aRad),
      y: cy + lr * Math.sin(aRad),
    };
  });

  const labelSize     = Math.max(9.5, size * 0.040);
  const timeSize      = Math.max(20, size * 0.118);
  const modeLabelSize = Math.max(8.5, size * 0.032);

  return (
    <div
      className="relative flex items-center justify-center select-none touch-none shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Timer: ${displayTime}`}
    >
      {cardinalLabels.map(lp => (
        <div
          key={lp.label}
          className="absolute font-mono font-medium text-muted-foreground/80 pointer-events-none"
          style={{
            left: lp.x,
            top: lp.y,
            fontSize: labelSize,
            transform: "translate(-50%, -50%)",
          }}
        >
          {lp.label}
        </div>
      ))}

      <svg
        ref={svgRef}
        width={size}
        height={size}
        className={`block absolute inset-0 ${!isRunning ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeOpacity={0.25}
          style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
        />

        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="hsl(var(--foreground))"
            strokeWidth={t.major ? 1.6 : 0.8}
            strokeOpacity={t.major ? 0.45 : 0.18}
            strokeLinecap="round"
          />
        ))}

        {fillFrac > 0 && (
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={arcColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circ}`}
            strokeDashoffset={0}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${cx}px ${cy}px`,
              transition: isRunning ? "stroke-dasharray 0.35s ease-out" : "none",
            }}
          />
        )}

        {!isRunning && (
          <g style={{ cursor: "grab" }}>
            <circle
              cx={dotX} cy={dotY}
              r={stroke * 0.9}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--card))"
              strokeWidth={2}
              className="drop-shadow-md"
            />
            <circle
              cx={dotX} cy={dotY}
              r={stroke * 0.38}
              fill="hsl(var(--card))"
            />
          </g>
        )}
      </svg>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
        style={{ paddingLeft: stroke * 1.8, paddingRight: stroke * 1.8 }}
      >
        {!isRunning && !isCompleted && (
          <span
            className="font-mono uppercase tracking-[0.22em] text-muted-foreground/75 font-semibold leading-none mb-1"
            style={{ fontSize: modeLabelSize }}
          >
            {selectedMins === 0 ? "TAP PLAY OR DRAG" : "DRAG TO SET TIME"}
          </span>
        )}

        <span
          className="font-mono font-bold tracking-tight text-foreground leading-none"
          style={{ fontSize: timeSize }}
        >
          {displayTime}
        </span>

        <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full border border-border/60 bg-secondary/60 backdrop-blur-xs shadow-xs">
          {isBreak ? (
            <Coffee className="h-2.5 w-2.5 text-emerald-500" />
          ) : (
            <Target className="h-2.5 w-2.5 text-primary" />
          )}
          <span
            className="font-mono uppercase tracking-[0.16em] text-foreground font-semibold"
            style={{ fontSize: modeLabelSize * 0.95 }}
          >
            {isBreak ? "BREAK TIME" : "FOCUS SESSION"}
          </span>
        </div>

        {!isRunning && !isCompleted && (
          <span
            className="font-mono text-muted-foreground/55 mt-1"
            style={{ fontSize: modeLabelSize * 0.85 }}
          >
            5 min increments
          </span>
        )}

        {isRunning && (
          <span
            className="font-mono text-muted-foreground/70 mt-1"
            style={{ fontSize: modeLabelSize * 0.85 }}
          >
            {isBreak ? "Recharging…" : "Deep focus…"}
          </span>
        )}

        {isCompleted && (
          <span
            className="font-mono text-primary font-bold mt-1"
            style={{ fontSize: modeLabelSize }}
          >
            Complete 🎉
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TODAY OVERVIEW DONUT
───────────────────────────────────────────────────────────── */
function TodayDonut({ focusMins, breakMins }: { focusMins: number; breakMins: number }) {
  const sz = 92;
  const sw = 9.5;
  const r = (sz - sw) / 2;
  const circ = 2 * Math.PI * r;
  const cx = sz / 2;
  const cy = sz / 2;
  const total = focusMins + breakMins || 1;
  const fFrac = focusMins / total;
  const bFrac = breakMins / total;

  return (
    <div className="relative flex-shrink-0" style={{ width: sz, height: sz }}>
      <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={sw} strokeOpacity={0.4} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={sw}
          strokeDasharray={`${circ * fFrac} ${circ * (1 - fFrac)}`}
          strokeLinecap="round"
        />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#10b981"
          strokeWidth={sw}
          strokeDasharray={`${circ * bFrac} ${circ * (1 - bFrac)}`}
          strokeDashoffset={-(circ * fFrac)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs font-mono font-bold text-foreground leading-none">
          {fmtHHMM(focusMins)}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground mt-0.5">
          Focused
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SESSION ROW
───────────────────────────────────────────────────────────── */
function SessionRow({ s }: { s: FocusSession }) {
  const isFocus = s.mode === "focus";
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/30 transition-colors border-b border-border/25 last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border/50 ${
        isFocus ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
      }`}>
        {isFocus ? <Target className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate leading-tight">
          {s.goalLabel ?? (isFocus ? "Deep Focus Session" : "Break")}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
          {fmtMins(s.durationMins)} · {isFocus ? "Focus" : "Break"}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[11px] text-muted-foreground leading-tight">{fmtDateLabel(s.date)}</p>
        <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">{fmtTime(s.startTime)}</p>
      </div>

      <div className="shrink-0 ml-1">
        {s.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : s.status === "partial" ? (
          <AlertCircle className="h-4 w-4 text-amber-500/70" />
        ) : (
          <Circle className="h-4 w-4 text-border/60" />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CUSTOM DURATION MODAL (Direct 1 to 180 Minutes)
───────────────────────────────────────────────────────────── */
function CustomDurationModal({
  currentMins,
  isBreak,
  onSetDuration,
  onClose,
}: {
  currentMins: number;
  isBreak: boolean;
  onSetDuration: (mins: number) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState<number>(currentMins > 0 ? currentMins : isBreak ? 5 : 25);
  const presets = isBreak ? [3, 5, 10, 15, 20, 30] : [1, 5, 10, 20, 35, 50, 75, 90, 120];

  function apply() {
    const valid = Math.min(180, Math.max(1, Math.round(Number(val) || 1)));
    onSetDuration(valid);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isBreak ? "Custom Break Duration" : "Custom Focus Duration"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set custom timer duration (1 to 180 minutes)
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Number input with stepper */}
        <div className="flex items-center justify-center gap-3 py-1.5">
          <button
            type="button"
            onClick={() => setVal(v => Math.max(1, (v || 1) - 1))}
            className="w-9 h-9 rounded-xl border border-border bg-secondary text-foreground flex items-center justify-center text-base font-bold hover:bg-secondary/80 active:scale-95 transition-all"
          >
            −
          </button>
          <div className="flex items-baseline justify-center gap-1.5 min-w-[120px] bg-secondary/50 border border-border rounded-xl py-2 px-3">
            <input
              type="number"
              min={1}
              max={180}
              value={val === 0 ? "" : val}
              onChange={e => {
                const parsed = parseInt(e.target.value, 10);
                setVal(isNaN(parsed) ? 0 : parsed);
              }}
              className="w-16 text-center font-mono font-bold text-2xl text-foreground bg-transparent outline-none"
              autoFocus
            />
            <span className="text-sm font-mono text-muted-foreground font-semibold">min</span>
          </div>
          <button
            type="button"
            onClick={() => setVal(v => Math.min(180, (v || 0) + 1))}
            className="w-9 h-9 rounded-xl border border-border bg-secondary text-foreground flex items-center justify-center text-base font-bold hover:bg-secondary/80 active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {/* Quick chip options */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">Quick Options</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setVal(p)}
                className={`h-7 px-3 rounded-lg border text-xs font-mono font-medium transition-all ${
                  val === p
                    ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                    : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}m
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={apply}
            disabled={!val || val < 1}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Set Timer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GOAL PICKER MODAL
───────────────────────────────────────────────────────────── */
function GoalPicker({ current, onSelect, onClose }: {
  current: FocusGoal | null;
  onSelect: (g: FocusGoal | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(current?.label ?? "");
  const [subj, setSubj] = useState(current?.subject ?? "");

  function save() {
    if (!text.trim()) {
      onSelect(null);
    } else {
      onSelect({
        id: current?.id || crypto.randomUUID(),
        label: text.trim(),
        subject: subj.trim() || undefined,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Set Current Goal</h3>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">Goal description</label>
          <input
            type="text"
            placeholder="e.g. Exam Prep, Math Revision, Essay Writing…"
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            className="w-full h-9 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">Subject (optional)</label>
          <input
            type="text"
            placeholder="e.g. Science, Literature, Work…"
            value={subj}
            onChange={e => setSubj(e.target.value)}
            className="w-full h-9 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Save Goal
          </button>
          {current && (
            <button
              type="button"
              onClick={() => { onSelect(null); onClose(); }}
              className="px-4 h-9 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ANALYTICS DRAWER
───────────────────────────────────────────────────────────── */
function AnalyticsDrawer({ onClose, ctx }: {
  onClose: () => void;
  ctx: ReturnType<typeof useTimer>;
}) {
  const {
    todayFocusMins, weekFocusMins, completionRate, totalSessionsCompleted, avgSessionMins, sessionHistory,
  } = ctx;

  const rows = [
    { label: "Today Focus",     val: fmtHHMM(todayFocusMins) },
    { label: "Weekly Focus",    val: fmtHHMM(weekFocusMins) },
    { label: "Total Sessions",  val: String(totalSessionsCompleted) },
    { label: "Avg Session",     val: fmtMins(avgSessionMins || 0) },
    { label: "Completion Rate", val: `${completionRate}%` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="w-84 max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" /> Focus Analytics
            </h3>
            <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {rows.map(r => (
              <div key={r.label} className="flex items-center justify-between text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono font-bold text-foreground">{r.val}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-2">Session History</p>
            {sessionHistory.slice(0, 10).length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions recorded yet.</p>
            ) : (
              sessionHistory.slice(0, 10).map(s => <SessionRow key={s.id} s={s} />)
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN FOCUS TIMER VIEW
───────────────────────────────────────────────────────────── */
export default function FocusTimerView() {
  const timerCtx = useTimer();
  const { toggleEvent } = useCalendar();
  const {
    selectedMinutes, breakMinutes, timeLeft, progress, isRunning, isCompleted,
    focusMode, currentCycle, totalCycles,
    activeGoal, activeRoutine,
    autoStart, setAutoStart,
    start, pause, addTime,
    selectMinutes, setBreakMinutes, setFocusMode, setActiveGoal, setActiveRoutine,
    sessionHistory,
    todayFocusMins,
  } = timerCtx;

  const isBreak = focusMode === "break";

  /* ── UI state ── */
  const [showGoalPicker,  setShowGoalPicker]  = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showAnalytics,   setShowAnalytics]   = useState(false);

  /* ── Ambient sound player state ── */
  const [currentTrack,    setCurrentTrack]    = useState<AmbientTrack>("off");
  const [ambientVolume,   setAmbientVolume]   = useState(0.5);
  const [trackMenuOpen,   setTrackMenuOpen]   = useState(false);

  const [tipIdx] = useState(() => Math.floor(Math.random() * STUDENT_TIPS.length));

  // Calendar study session auto-completion
  const prevCompleted = useRef(false);
  const calendarEventCompleted = useRef<string | null>(null);
  useEffect(() => {
    if (isCompleted && !prevCompleted.current) {
      const calendarEventId = !isBreak ? activeGoal?.calendarEventId : undefined;
      if (calendarEventId && calendarEventCompleted.current !== calendarEventId) {
        toggleEvent(calendarEventId);
        calendarEventCompleted.current = calendarEventId;
      }
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted, isBreak, activeGoal, toggleEvent]);

  /* ── Responsive Ring Size Calculation ── */
  const [ringSize, setRingSize] = useState(240);
  useEffect(() => {
    function calc() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let finalSize: number;
      if (vw < 640) {
        finalSize = Math.min(210, Math.max(175, vw - 120));
      } else if (vw < 1024) {
        finalSize = 225;
      } else {
        let maxH = 260;
        if (vh >= 1000) maxH = 290;
        else if (vh >= 850) maxH = 250;
        else if (vh >= 740) maxH = 220;
        else maxH = 195;

        const maxW = Math.min(vw * 0.38, 320);
        finalSize = Math.max(180, Math.min(maxH, maxW));
      }
      setRingSize(finalSize);
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  /* ── Derived statistics ── */
  const displayTime = fmtMSec(timeLeft);

  const todayBreakMins = useMemo(() => {
    const today = todayKey();
    return sessionHistory
      .filter(s => s.date === today && s.mode === "break" && s.status === "completed")
      .reduce((sum, s) => sum + s.durationMins, 0);
  }, [sessionHistory]);

  const todaySessionCount = useMemo(() => {
    const today = todayKey();
    return sessionHistory.filter(s => s.date === today && s.mode === "focus" && s.status === "completed").length;
  }, [sessionHistory]);

  const recentlyUsed = useMemo(() => {
    const labels = sessionHistory.slice(0, 12)
      .filter(s => s.mode === "focus")
      .map(s => `${s.durationMins}m Focus`);
    const unique = [...new Set(labels)].slice(0, 3);
    return unique.length > 0 ? unique : ["25m Pomodoro", "50m Deep Work", "45m Sprint"];
  }, [sessionHistory]);

  /* ── Mode Switch ── */
  function switchMode(m: FocusMode) {
    if (isRunning) return;
    setFocusMode(m);
  }

  /* ── Drag duration change ── */
  function handleDragChange(mins: number) {
    if (isRunning) return;
    if (isBreak) setBreakMinutes(mins);
    else selectMinutes(mins);
  }

  /* ── Reset timer to zero ── */
  function handleResetToZero() {
    pause();
    if (isBreak) {
      setBreakMinutes(0);
    } else {
      selectMinutes(0);
    }
  }

  /* ── Play / Pause Handler ── */
  function handlePlayPause() {
    if (isRunning) {
      pause();
    } else {
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      } catch {}

      if (!isBreak && selectedMinutes <= 0) {
        selectMinutes(25);
      } else if (isBreak && breakMinutes <= 0) {
        setBreakMinutes(5);
      }
      start();
    }
  }

  /* ── Ambient Track Select ── */
  const handleSelectTrack = useCallback((track: AmbientTrack) => {
    setCurrentTrack(track);
    ambientEngine.playTrack(track);
    setTrackMenuOpen(false);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setAmbientVolume(vol);
    ambientEngine.setVolume(vol);
  }, []);

  const activeTrackObj = AMBIENT_TRACKS.find(t => t.id === currentTrack) || AMBIENT_TRACKS[0];

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground overflow-y-auto lg:overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════
          1. CURRENT GOAL CARD (Fully Responsive)
      ══════════════════════════════════════════════════════════════ */}
      <div className="px-3 sm:px-6 lg:px-7 pt-2.5 pb-2 shrink-0">
        <div className="rounded-2xl border border-border/50 bg-card/70 p-2.5 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
          {/* Left Goal Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-secondary/80 border border-border/40 flex items-center justify-center text-muted-foreground shrink-0">
              <Folder className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground/80 block leading-tight">
                Current Goal
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[160px] sm:max-w-none">
                  {activeGoal?.label ?? "Deep Focus Session"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowGoalPicker(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
                  aria-label="Edit goal"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Session / Cycle & Auto-Start Indicators */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block leading-tight">
                Session
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {currentCycle} / {totalCycles}
              </span>
            </div>

            <div className="w-px h-6 bg-border/40 hidden sm:block" />

            <div className="hidden sm:block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block leading-tight">
                Cycle
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                1 / 2
              </span>
            </div>

            <div className="w-px h-6 bg-border/40" />

            {/* Auto-start switch */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground hidden md:inline">Auto-start</span>
              <button
                type="button"
                onClick={() => setAutoStart(!autoStart)}
                className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${
                  autoStart ? "bg-primary" : "bg-secondary border border-border"
                }`}
                aria-label="Toggle auto-start"
                title={autoStart ? "Auto-start is ON" : "Auto-start is OFF"}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-card shadow-xs transition-transform ${
                    autoStart ? "translate-x-4 bg-primary-foreground" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. MAIN BODY (2-COLUMN GRID ON DESKTOP, FLOW ON MOBILE)
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 content-start lg:content-stretch lg:grid-cols-[minmax(0,1fr)_minmax(310px,36%)] xl:grid-cols-[minmax(0,1fr)_minmax(350px,35%)] gap-3 sm:gap-4 px-3 sm:px-6 lg:px-7 pb-3 lg:pb-2 overflow-y-visible lg:overflow-hidden">

        {/* ── LEFT COLUMN ──────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 lg:overflow-hidden gap-3 sm:gap-3.5">

          {/* Main Circular Timer Card */}
          <div className="rounded-3xl border border-border/60 bg-card/85 flex-1 min-h-[350px] sm:min-h-[380px] lg:min-h-0 flex flex-col justify-between items-center p-3.5 sm:p-4 shadow-sm relative overflow-visible">

            {/* Focus / Break Mode Selector INSIDE top of timer card */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-secondary/80 border border-border/60 w-fit shrink-0 shadow-xs mt-0.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => switchMode("focus")}
                className={`px-5 sm:px-6 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  focusMode === "focus"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Focus
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => switchMode("break")}
                className={`px-5 sm:px-6 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  focusMode === "break"
                    ? "bg-emerald-500 text-white font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Break
              </button>
            </div>

            {/* Centered Dial with Dynamic Scale & Knob */}
            <div className="flex-1 min-h-0 flex items-center justify-center w-full py-2">
              <CircularTimerRing
                progress={progress}
                displayTime={displayTime}
                isRunning={isRunning}
                isBreak={isBreak}
                isCompleted={isCompleted}
                selectedMins={isBreak ? breakMinutes : selectedMinutes}
                timeLeft={timeLeft}
                onDragChange={handleDragChange}
                size={ringSize}
              />
            </div>

            {/* Timer Controls Row: [-5m] [↺ Reset to 0] [▶ Play / ❚❚ Pause] [+5m] */}
            <div className="flex items-center justify-center gap-2.5 pt-1 pb-1 shrink-0">
              {/* -5m */}
              <button
                type="button"
                onClick={() => addTime(-5)}
                disabled={isCompleted || timeLeft <= 0}
                aria-label="Subtract 5 minutes"
                className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center text-xs font-mono font-bold transition-all disabled:opacity-30 active:scale-95 shadow-xs"
              >
                −5m
              </button>

              {/* Reset to 0 */}
              <button
                type="button"
                onClick={handleResetToZero}
                aria-label="Reset timer to zero"
                title="Reset timer to 0"
                className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-all active:scale-95 shadow-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Refined Play/Pause Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={handlePlayPause}
                aria-label={isRunning ? "Pause timer" : "Start timer"}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md transition-transform ${
                  isBreak
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-primary text-primary-foreground hover:brightness-105"
                }`}
              >
                {isRunning ? (
                  <Pause className="h-4.5 w-4.5 fill-current text-current" />
                ) : (
                  <Play className="h-4.5 w-4.5 fill-current text-current ml-0.5" />
                )}
              </motion.button>

              {/* +5m */}
              <button
                type="button"
                onClick={() => addTime(5)}
                disabled={isCompleted}
                aria-label="Add 5 minutes"
                className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center text-xs font-mono font-bold transition-all active:scale-95 shadow-xs"
              >
                +5m
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="shrink-0 space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
              Quick Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map(m => {
                const active = !isRunning && focusMode === "focus" && selectedMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={isRunning}
                    onClick={() => { selectMinutes(m); setFocusMode("focus"); }}
                    className={`h-8 px-4 rounded-xl border text-xs font-mono transition-all ${
                      active
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs scale-[1.02]"
                        : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } ${isRunning ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {m}m
                  </button>
                );
              })}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setShowCustomModal(true)}
                className="h-8 px-3.5 rounded-xl border border-dashed border-border text-xs font-mono font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                Custom
              </button>
            </div>
          </div>

          {/* Fixed Routines (Curated Famous Scientific Routines) */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
                Fixed Routines
              </p>
              <span className="text-[11px] font-mono text-muted-foreground/75">
                Scientifically proven rhythms
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FIXED_ROUTINES.map(r => {
                const active = activeRoutine?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => { if (!isRunning) setActiveRoutine(active ? null : r); }}
                    className={`relative rounded-xl border py-2 px-3 cursor-pointer transition-all ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                        : "border-border/60 bg-card/80 hover:bg-secondary/40 hover:border-border"
                    } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className={`text-xs sm:text-sm font-bold truncate leading-tight ${active ? "text-primary" : "text-foreground"}`}>
                          {r.name}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {active ? (
                            <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                              <Check className="h-2.5 w-2.5 stroke-[3]" /> {r.cycles}c
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground/75">
                              {r.cycles} {r.cycles === 1 ? "cyc" : "cycles"}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {r.focusMins} / {r.breakMins}m
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 pt-0.5">
also            </p>
          </div>

        </div>{/* End left column */}

        {/* ── RIGHT COLUMN (Today Overview + EXPANDED Recent Sessions) ── */}
        <div className="flex flex-col lg:min-h-0 gap-3 sm:gap-3.5 lg:overflow-hidden lg:h-full">

          {/* 1. Today Overview Card */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3.5 shrink-0 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
                Today Overview
              </p>
              <button
                type="button"
                onClick={() => setShowAnalytics(true)}
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <BarChart2 className="h-3.5 w-3.5" /> Details
              </button>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <TodayDonut focusMins={todayFocusMins} breakMins={todayBreakMins} />
              <div className="flex-1 space-y-2 min-w-0">
                {[
                  { dot: "bg-primary", label: "Focus", val: fmtHHMM(todayFocusMins) },
                  { dot: "bg-emerald-500", label: "Breaks", val: fmtHHMM(todayBreakMins) },
                  { dot: "bg-muted-foreground/60", label: "Sessions", val: String(todaySessionCount) },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                      <span className="text-xs text-muted-foreground truncate">{row.label}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground shrink-0">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Recent Sessions */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3.5 flex-1 min-h-[220px] lg:min-h-0 flex flex-col shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
                Recent Sessions
              </p>
              <span className="text-xs font-mono text-muted-foreground/70">
                {sessionHistory.length} total
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-0.5">
              {sessionHistory.length === 0 ? (
                <div className="text-center py-8 space-y-1.5 flex flex-col items-center justify-center h-full">
                  <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground mb-1">
                    <Target className="h-5 w-5 opacity-40" />
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold">No sessions yet.</p>
                  <p className="text-xs font-mono text-muted-foreground/60">Start your first focus session!</p>
                </div>
              ) : (
                sessionHistory.map(s => <SessionRow key={s.id} s={s} />)
              )}
            </div>
          </div>

        </div>{/* End right column */}

      </div>{/* End main body */}

      {/* ══════════════════════════════════════════════════════════════
          3. FOOTER: PRO TIP & AMBIENT SOUND PLAYER
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 sm:px-6 lg:px-7 py-2.5 border-t border-border/40 bg-card/40 shrink-0 text-xs gap-2.5">
        {/* Left: Pro Tip */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-amber-400 text-sm shrink-0">💡</span>
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider shrink-0">
            Pro Tip
          </span>
          <p className="text-xs text-muted-foreground italic truncate min-w-0">
            {STUDENT_TIPS[tipIdx]}
          </p>
        </div>

        {/* Right: Ambient Sound Player */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTrackMenuOpen(o => !o)}
              className="h-8 px-2.5 rounded-xl border border-border bg-secondary/60 text-foreground text-xs font-mono flex items-center gap-1.5 hover:bg-secondary transition-colors"
            >
              <span>{activeTrackObj.icon}</span>
              <span className="truncate max-w-[85px] sm:max-w-none">{activeTrackObj.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </button>

            {trackMenuOpen && (
              <div className="absolute bottom-full right-0 mb-1.5 w-48 rounded-2xl border border-border bg-card p-1.5 shadow-xl z-50 space-y-0.5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground px-2 py-1 font-semibold">
                  Ambient Audio
                </p>
                {AMBIENT_TRACKS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTrack(t.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      currentTrack === t.id
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                    {currentTrack === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentTrack !== "off") {
                handleSelectTrack("off");
              } else {
                handleSelectTrack("lofi");
              }
            }}
            className="w-8 h-8 rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title={currentTrack !== "off" ? "Mute ambient audio" : "Play ambient audio"}
          >
            {currentTrack !== "off" ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={currentTrack === "off" ? 0 : ambientVolume}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1.5 accent-primary bg-secondary rounded-lg cursor-pointer hidden sm:inline-block"
            title={`Volume: ${Math.round(ambientVolume * 100)}%`}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODALS & OVERLAYS
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCustomModal && (
          <CustomDurationModal
            currentMins={isBreak ? breakMinutes : selectedMinutes}
            isBreak={isBreak}
            onSetDuration={mins => {
              if (isBreak) {
                setBreakMinutes(mins);
              } else {
                setFocusMode("focus");
                selectMinutes(mins);
              }
            }}
            onClose={() => setShowCustomModal(false)}
          />
        )}
        {showGoalPicker && (
          <GoalPicker
            current={activeGoal}
            onSelect={setActiveGoal}
            onClose={() => setShowGoalPicker(false)}
          />
        )}
        {showAnalytics && (
          <AnalyticsDrawer onClose={() => setShowAnalytics(false)} ctx={timerCtx} />
        )}
      </AnimatePresence>

    </div>
  );
}
