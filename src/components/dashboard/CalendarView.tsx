/**
 * CalendarView — Clean, Fully Functional & 100% Mobile Responsive Study Calendar
 *
 * Updates:
 * 1. Functional Month, Week, and Day views with smooth switching.
 * 2. Clean, human-crafted aesthetics: ONLY icons & calendar dots are colored (Green Task, Red Deadline, Yellow Meeting). No oversaturated AI-like colored backgrounds.
 * 3. Specific single time per activity (e.g. 03:00 PM), with no start/end duration complexity.
 * 4. 100% mobile-friendly responsive layout that stacks and scrolls gracefully on all screen sizes.
 */

import { useState, useMemo, useEffect, useRef, type ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  CheckSquare, Flag, Video, Clock, ChevronDown, StickyNote,
  Trash2, Link2, Circle,
  Play, Folder, Edit2, Check, ListChecks, ExternalLink
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, isToday,
  startOfWeek, endOfWeek, addDays, differenceInCalendarDays,
} from "date-fns";
import {
  useCalendar, type EventType, type EventPriority, type CalendarEvent
} from "@/lib/calendar";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────
   HELPERS & CONFIG
───────────────────────────────────────────────────────────── */
function normalizeLink(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  const candidate = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function getCurrentTimeDefaults() {
  const now = new Date();
  let h = now.getHours();
  const m = Math.ceil(now.getMinutes() / 5) * 5 % 60;
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: h, minute: m, ampm };
}

// 3 Activity Types — clean neutral styling with colored icons
export const TYPE_CONFIG: Record<EventType, {
  label: string;
  icon: ElementType;
  dotColor: string;
  iconColor: string;
}> = {
  task: {
    label: "Task",
    icon: CheckSquare,
    dotColor: "bg-emerald-500",
    iconColor: "text-emerald-400",
  },
  deadline: {
    label: "Deadline",
    icon: Flag,
    dotColor: "bg-rose-500",
    iconColor: "text-rose-400",
  },
  event: {
    label: "Meeting",
    icon: Video,
    dotColor: "bg-amber-400",
    iconColor: "text-amber-400",
  },
};

const ALL_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const ALL_MINUTE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function formatTime(hour: number, minute: number, ampm: "AM" | "PM") {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
}

/* ─────────────────────────────────────────────────────────────
   TIME DROPDOWN SELECTOR (Single Specific Time)
───────────────────────────────────────────────────────────── */
function TimeDropdown({
  hour, minute, ampm,
  onHour, onMinute, onAmpm,
}: {
  hour: number; minute: number; ampm: "AM" | "PM";
  onHour: (h: number) => void; onMinute: (m: number) => void; onAmpm: (a: "AM" | "PM") => void;
}) {
  const [open, setOpen] = useState(false);
  const display = formatTime(hour, minute, ampm);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-xl border border-border/80 bg-secondary/60 hover:bg-secondary transition-colors text-xs text-foreground"
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left font-mono font-medium">{display}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl border border-border bg-card shadow-2xl p-3 max-h-[60vh] overflow-y-auto space-y-3"
          >
            {/* Hour Grid */}
            <div>
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Hour (1-12)</p>
              <div className="grid grid-cols-6 gap-1">
                {ALL_HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onHour(h)}
                    className={`h-7 rounded-lg text-xs font-mono transition-all ${
                      hour === h
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute Grid */}
            <div className="pt-2 border-t border-border/60">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Minute</p>
              <div className="grid grid-cols-6 gap-1">
                {ALL_MINUTE_PRESETS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMinute(m)}
                    className={`h-6 rounded-md text-xs font-mono transition-all ${
                      minute === m
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    :{String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* AM / PM Toggle */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Period</span>
              <div className="flex gap-1">
                {(["AM", "PM"] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onAmpm(a)}
                    className={`h-7 px-3 rounded-lg text-xs font-mono transition-all ${
                      ampm === a
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADD / EDIT ACTIVITY MODAL
───────────────────────────────────────────────────────────── */
interface ActivityModalProps {
  initial?: CalendarEvent | null;
  defaultDate: Date;
  defaultType?: EventType;
  onSave: (event: CalendarEvent) => void;
  onClose: () => void;
}

function ActivityModal({ initial, defaultDate, defaultType = "task", onSave, onClose }: ActivityModalProps) {
  const [type, setType] = useState<EventType>(initial?.type || defaultType);
  const [title, setTitle] = useState(initial?.title || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [priority, setPriority] = useState<EventPriority>(initial?.priority || "medium");
  const [note, setNote] = useState(initial?.note || "");
  const [link, setLink] = useState(initial?.link || "");

  const initialTime = initial ? { hour: initial.hour, minute: initial.minute, ampm: initial.ampm } : getCurrentTimeDefaults();
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [ampm, setAmpm] = useState(initialTime.ampm);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const ev: CalendarEvent = {
      id: initial?.id || Date.now().toString(),
      date: defaultDate,
      type,
      title: title.trim(),
      subject: subject.trim() || undefined,
      priority,
      note: note.trim() || undefined,
      link: type === "event" && link.trim() ? normalizeLink(link) : undefined,
      hour,
      minute: minute || 0,
      ampm,
      completed: initial?.completed ?? false,
    };
    onSave(ev);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-2xl overflow-x-hidden overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {initial ? "Edit Activity" : "Add Activity"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(defaultDate, "MMMM d, yyyy")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 3 Activities Selector (Clean neutral buttons with colored icons) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Activity Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["task", "deadline", "event"] as EventType[]).map(t => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? "border-primary bg-primary/15 text-foreground font-bold shadow-xs ring-1 ring-primary/40"
                        : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Physics Revision, Math Problem Set…"
              className="w-full h-9 px-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Time Specific (Single time, no duration clutter) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Time
            </label>
            <TimeDropdown
              hour={hour}
              minute={minute}
              ampm={ampm}
              onHour={setHour}
              onMinute={setMinute}
              onAmpm={setAmpm}
            />
          </div>

          {/* Subject & Priority in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Subject / Folder (optional)
              </label>
              <div className="relative">
                <Folder className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Physics Notes"
                  className="w-full h-9 pl-8 pr-2.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as EventPriority)}
                className="w-full h-9 px-2.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Meeting Link if Meeting */}
          {type === "event" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Meeting URL (optional)
              </label>
              <div className="relative">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full h-9 pl-8 pr-2.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add key notes or instructions…"
              className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-40 shadow-xs transition-colors"
            >
              {initial ? "Save Changes" : "Create Activity"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROGRESS DONUT GAUGE
───────────────────────────────────────────────────────────── */
function ProgressDonut({ completedCount, totalCount }: { completedCount: number; totalCount: number }) {
  const sz = 84;
  const sw = 7.5;
  const r = (sz - sw) / 2;
  const circ = 2 * Math.PI * r;
  const cx = sz / 2;
  const cy = sz / 2;

  const frac = totalCount > 0 ? Math.min(1, Math.max(0, completedCount / totalCount)) : 0;
  const arcLength = frac * circ;

  return (
    <div className="relative shrink-0" style={{ width: sz, height: sz }}>
      <svg width={sz} height={sz} className="-rotate-90">
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={sw}
          strokeOpacity={0.35}
        />
        {frac > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={sw}
            strokeDasharray={`${arcLength} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
        <span className="text-xs font-mono font-bold text-foreground leading-none">
          {completedCount}/{totalCount}
        </span>
        <span className="text-[8.5px] font-mono text-muted-foreground/80 mt-1 leading-tight">
          Completed
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN CALENDAR VIEW
───────────────────────────────────────────────────────────── */
export default function CalendarView({ onStartFocus }: { onStartFocus?: (event: CalendarEvent) => void }) {
  const { events, addEvent, updateEvent, removeEvent, toggleEvent, getEventsForDate, getUpcoming } = useCalendar();

  // Navigation & View State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate]         = useState<Date>(new Date());
  const [viewMode, setViewMode]                 = useState<"month" | "week" | "day">("month");

  // Modal State
  const [showAddModal, setShowAddModal]         = useState(false);
  const [editingEvent, setEditingEvent]         = useState<CalendarEvent | null>(null);
  const [modalDefaultType, setModalDefaultType] = useState<EventType>("task");

  // Notification reminder ref
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  /* ── Calendar Month Grid Calculations ── */
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd   = endOfMonth(currentMonthDate);
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow   = monthStart.getDay(); // 0 = Sun
  const paddedMonthDays: (Date | null)[] = Array(startDow).fill(null).concat(monthDays);

  /* ── Week View Calculations ── */
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd   = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Map dates to 3 activity types for colored dot indicators
  const dotMap = useMemo(() => {
    const m = new Map<string, EventType[]>();
    events.forEach(e => {
      const k = format(e.date instanceof Date ? e.date : new Date(e.date), "yyyy-MM-dd");
      const list = m.get(k) || [];
      if (!list.includes(e.type)) {
        list.push(e.type);
      }
      m.set(k, list);
    });
    return m;
  }, [events]);

  // Selected date events
  const selectedDayEvents = useMemo(() => {
    return getEventsForDate(selectedDate);
  }, [getEventsForDate, selectedDate]);

  // Progress metrics for selected date
  const { completedCount, totalCount, progressPercent } = useMemo(() => {
    const total = selectedDayEvents.length;
    const comp = selectedDayEvents.filter(ev => ev.completed).length;
    const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
    return {
      completedCount: comp,
      totalCount: total,
      progressPercent: pct,
    };
  }, [selectedDayEvents]);

  /* ── Handlers ── */
  function handlePrev() {
    if (viewMode === "month") setCurrentMonthDate(prev => subMonths(prev, 1));
    else if (viewMode === "week") setSelectedDate(prev => addDays(prev, -7));
    else setSelectedDate(prev => addDays(prev, -1));
  }

  function handleNext() {
    if (viewMode === "month") setCurrentMonthDate(prev => addMonths(prev, 1));
    else if (viewMode === "week") setSelectedDate(prev => addDays(prev, 7));
    else setSelectedDate(prev => addDays(prev, 1));
  }

  function handleGoToday() {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDate(today);
  }

  function openAddWith(type: EventType) {
    setModalDefaultType(type);
    setEditingEvent(null);
    setShowAddModal(true);
  }

  function handleSaveActivity(ev: CalendarEvent) {
    if (editingEvent) {
      updateEvent(ev.id, ev);
      toast.success("Activity updated");
    } else {
      addEvent(ev);
      toast.success(`Added ${TYPE_CONFIG[ev.type].label}: ${ev.title}`);
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground overflow-y-auto lg:overflow-hidden p-3 sm:p-4 lg:p-5 gap-3 sm:gap-4 select-none">

      {/* ══════════════════════════════════════════════════════════════
          1. HEADER TOP BAR (FULLY RESPONSIVE ON ALL SCREENS)
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pb-2.5 border-b border-border/40">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-secondary/70 border border-border/60 flex items-center justify-center text-foreground shrink-0 shadow-xs">
            <CalendarIcon className="h-4.5 w-4.5 text-foreground" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight">
              Study Calendar
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              Plan your study. Stay consistent. Achieve more.
            </p>
          </div>
        </div>

        {/* Right: View Toggle, Navigation, Today, + Add Activity */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented View Switch: Month | Week | Day */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border/60 shadow-xs">
            {(["month", "week", "day"] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono capitalize transition-all ${
                  viewMode === mode
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1 bg-secondary/40 border border-border/60 rounded-xl px-1.5 py-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Previous"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-xs font-bold text-foreground px-1.5 min-w-[95px] text-center truncate">
              {format(viewMode === "month" ? currentMonthDate : selectedDate, "MMM yyyy")}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={handleGoToday}
            className="h-8 px-2.5 sm:px-3 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-xs font-mono font-medium text-foreground transition-colors"
          >
            Today
          </button>

          {/* + Add Activity Button */}
          <button
            type="button"
            onClick={() => openAddWith("task")}
            className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" /> Add Activity
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. MAIN BODY (2-COLUMN ON DESKTOP, RESPONSIVE FLOW ON MOBILE)
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 content-start lg:content-stretch lg:grid-cols-[minmax(0,1fr)_minmax(320px,36%)] xl:grid-cols-[minmax(0,1fr)_minmax(360px,35%)] gap-3 sm:gap-4 overflow-y-visible lg:overflow-hidden">

        {/* ── LEFT COLUMN: Calendar Display (Month / Week / Day) + Upcoming Important ── */}
        <div className="contents lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden lg:gap-3.5">

          {/* ══════════════════════════════════════════════════════════
              VIEW 1: MONTH VIEW (7x5/6 GRID)
          ══════════════════════════════════════════════════════════ */}
          {viewMode === "month" && (
            <div className="order-1 lg:order-none rounded-3xl border border-border/70 bg-card/85 p-3 sm:p-4 flex-1 min-h-[350px] sm:min-h-[390px] lg:min-h-0 flex flex-col justify-between shadow-xs">
              <div className="w-full flex flex-col h-full min-h-0">

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-2 border-b border-border/40 pb-2 shrink-0">
                  {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                    <div key={d} className="text-center text-[10px] sm:text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground/80 font-bold">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Month Day Cells Grid */}
                <div className="grid grid-cols-7 grid-rows-5 sm:grid-rows-6 gap-1 sm:gap-1.5 flex-1 min-h-0 h-full">
                  {paddedMonthDays.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="rounded-xl border border-transparent" />;
                    const isSel   = selectedDate && isSameDay(day, selectedDate);
                    const isNow   = isToday(day);
                    const inMonth = isSameMonth(day, currentMonthDate);
                    const dots    = dotMap.get(format(day, "yyyy-MM-dd")) || [];

                    return (
                      <motion.button
                        key={day.toISOString()}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedDate(day)}
                        className={`rounded-2xl flex flex-col items-center justify-between p-1.5 sm:p-2 relative transition-all border text-left cursor-pointer h-full min-h-[44px] ${
                          isSel
                            ? "bg-primary text-primary-foreground font-bold border-primary shadow-md"
                            : isNow
                            ? "bg-secondary/90 border-primary/40 text-foreground font-semibold"
                            : dots.length > 0
                            ? "bg-secondary/40 border-border/60 text-foreground hover:bg-secondary/70 hover:border-border"
                            : "bg-secondary/20 border-border/30 text-muted-foreground hover:bg-secondary/50"
                        } ${!inMonth ? "opacity-25" : ""}`}
                      >
                        {/* Day Number */}
                        <span className={`absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-mono leading-none lg:static lg:block lg:self-start ${
                          isSel ? "text-primary-foreground font-bold" : inMonth ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {format(day, "d")}
                        </span>

                        {/* Activity colored dots */}
                        <div className="flex items-center justify-center gap-1 my-0.5 min-h-[6px]">
                          {dots.map((type, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_CONFIG[type].dotColor} ${
                                isSel ? "ring-1 ring-primary-foreground/40" : ""
                              }`}
                              title={TYPE_CONFIG[type].label}
                            />
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Bottom Legend */}
                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between px-1 shrink-0 text-xs font-mono">
                  <div className="flex items-center gap-3.5">
                    {(["task", "deadline", "event"] as EventType[]).map(k => (
                      <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <span className={`w-2 h-2 rounded-full ${TYPE_CONFIG[k].dotColor}`} />
                        {TYPE_CONFIG[k].label}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline font-mono">
                    {events.length} activities scheduled
                  </span>
                </div>

              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 2: WEEK VIEW (7 HORIZONTAL DAY COLUMNS)
          ══════════════════════════════════════════════════════════ */}
          {viewMode === "week" && (
            <div className="order-1 lg:order-none rounded-3xl border border-border/70 bg-card/85 p-3.5 sm:p-4 flex-1 min-h-[350px] lg:min-h-0 flex flex-col shadow-xs overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-wider">
                  Week of {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  7 Days View
                </span>
              </div>

              {/* 7 Columns for Week */}
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {weekDays.map(day => {
                  const isSel = isSameDay(day, selectedDate);
                  const isNow = isToday(day);
                  const dayEvents = getEventsForDate(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`rounded-2xl border p-2 flex flex-col cursor-pointer transition-all hover:bg-secondary/40 ${
                        isSel ? "border-primary" : "border-border/60"
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-border/40 mb-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">
                          {format(day, "EEE")}
                        </span>
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded-md ${
                          isNow ? "text-primary" : "text-foreground"
                        }`}>
                          {format(day, "d")}
                        </span>
                      </div>

                      {/* Day Activities */}
                      <div className="flex-1 space-y-1.5 overflow-y-auto">
                        {dayEvents.length === 0 ? (
                          <div className="h-full flex items-center justify-center py-4">
                            <span className="text-[10px] font-mono text-muted-foreground/40">Empty</span>
                          </div>
                        ) : (
                          dayEvents.map(ev => {
                            const cfg = TYPE_CONFIG[ev.type];
                            const Icon = cfg.icon;
                            return (
                              <div
                                key={ev.id}
                                className="rounded-xl border border-border/50 bg-card/90 p-1.5 flex items-start gap-1.5 shadow-2xs"
                              >
                                <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${cfg.iconColor}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                                    {ev.title}
                                  </p>
                                  <p className="text-[9.5px] font-mono text-muted-foreground">
                                    {formatTime(ev.hour, ev.minute, ev.ampm)}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 3: DAY VIEW (DETAILED CHRONOLOGICAL TIMELINE)
          ══════════════════════════════════════════════════════════ */}
          {viewMode === "day" && (
            <div className="order-1 lg:order-none rounded-3xl border border-border/70 bg-card/85 p-3.5 sm:p-4 flex-1 min-h-[350px] lg:min-h-0 flex flex-col shadow-xs overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-wider">
                  Timeline for {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </span>
                <button
                  type="button"
                  onClick={() => openAddWith("task")}
                  className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Event
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {selectedDayEvents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="h-7 w-7 text-muted-foreground/30 mb-2" />
                    <p className="text-xs font-semibold text-foreground">No events for this day</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Click + Add Activity to schedule</p>
                  </div>
                ) : (
                  selectedDayEvents.map(ev => {
                    const cfg = TYPE_CONFIG[ev.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={ev.id}
                        className="rounded-2xl border border-border/60 bg-secondary/30 p-3 flex items-start gap-3 shadow-2xs hover:bg-secondary/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-xl bg-card border border-border/70 flex items-center justify-center shrink-0">
                          <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs sm:text-sm font-bold text-foreground truncate">{ev.title}</p>
                            <span className="text-[10px] font-mono text-muted-foreground/80">· {cfg.label}</span>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {formatTime(ev.hour, ev.minute, ev.ampm)}
                          </p>
                          {ev.subject && (
                            <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 flex items-center gap-1">
                              <Folder className="h-3 w-3" /> {ev.subject}
                            </p>
                          )}
                        </div>
                        {onStartFocus && !ev.completed && (
                          <button
                            type="button"
                            onClick={() => onStartFocus(ev)}
                            className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Focus</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              Upcoming Important (Clean Cards with Colored Icons Only)
          ══════════════════════════════════════════════════════════ */}
          <div className="order-4 lg:order-none rounded-2xl border border-border/70 bg-card/85 p-3.5 shrink-0 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
                Upcoming Important
              </p>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                Next 30 days
              </span>
            </div>

            {(() => {
              const futureEvents = getUpcoming(30).filter(ev => {
                const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
                return differenceInCalendarDays(d, new Date()) >= 1;
              }).slice(0, 5);

              if (futureEvents.length === 0) {
                return (
                  <div className="py-3 text-center text-xs text-muted-foreground font-mono">
                    No upcoming deadlines or events ahead
                  </div>
                );
              }

              return (
                <div className="space-y-1">
                  {futureEvents.map(ev => {
                    const cfg = TYPE_CONFIG[ev.type];
                    const Icon = cfg.icon;
                    const dDate = ev.date instanceof Date ? ev.date : new Date(ev.date);
                    const diff = differenceInCalendarDays(dDate, new Date());
                    const diffLabel = diff === 1 ? "Tomorrow" : `In ${diff} days`;

                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedDate(dDate)}
                        className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-secondary/50 cursor-pointer transition-colors group"
                      >
                        {/* Colored dot indicator */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />

                        {/* Title */}
                        <p className="text-[11px] font-semibold text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
                          {ev.title}
                        </p>

                        {/* Date chip */}
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {format(dDate, "MMM d")}
                        </span>

                        {/* Countdown badge */}
                        <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-secondary/80 text-muted-foreground">
                          {diffLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>{/* End left column */}

        {/* ── RIGHT COLUMN: Today's Progress + Today's Plan + Quick Actions ── */}
        <div className="contents lg:flex lg:flex-col lg:min-h-0 lg:gap-3.5 lg:overflow-hidden lg:h-full">

          {/* 1. Selected Date Title & Activity Count Header */}
          <div className="hidden lg:flex rounded-2xl border border-border/70 bg-card/85 p-3.5 shrink-0 shadow-xs items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground leading-tight">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {isToday(selectedDate) ? "Today's Schedule" : "Scheduled Day"}
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-secondary/80 border border-border/60 text-muted-foreground font-semibold">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? "activity" : "activities"}
            </span>
          </div>

          {/* 2. Today's Progress (Donut + Linear Bar + Metrics) */}
          <div className="order-3 lg:order-none rounded-2xl border border-border/70 bg-card/85 p-3.5 shrink-0 shadow-xs space-y-2.5">
            <div className="flex items-center gap-3.5">
              <ProgressDonut completedCount={completedCount} totalCount={totalCount} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Today's Progress</span>
                  <span className="text-xs font-mono font-bold text-primary">
                    {progressPercent}%
                  </span>
                </div>

                {/* Linear progress bar */}
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground pt-0.5">
                  <span>{completedCount} completed</span>
                  <span>{Math.max(0, totalCount - completedCount)} remaining</span>
                </div>

                <div className="text-[10px] font-mono text-muted-foreground/80">
                  {completedCount} / {totalCount} activities done
                </div>
              </div>
            </div>
          </div>

          {/* 3. Today's Plan (Activity Cards List with Start Focus & Checkmark) */}
          <div className="order-2 lg:order-none rounded-2xl border border-border/70 bg-card/85 p-3.5 flex-1 min-h-[220px] lg:min-h-0 flex flex-col shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground font-bold">
                Today's Plan
              </p>
              <button
                type="button"
                onClick={() => openAddWith("task")}
                className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2">
              {selectedDayEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                  <ListChecks className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs font-semibold text-foreground">No activities for this day</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    Click + Add Activity or use Quick Actions below
                  </p>
                </div>
              ) : (
                selectedDayEvents.map(ev => {
                  const cfg = TYPE_CONFIG[ev.type];
                  const Icon = cfg.icon;
                  const timeStr = formatTime(ev.hour, ev.minute, ev.ampm);

                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-2xl border p-3 flex items-start gap-2.5 transition-all group ${
                        ev.completed
                          ? "border-border/40 bg-secondary/20 opacity-60"
                          : "border-border/60 bg-card/90 hover:border-border hover:bg-secondary/30"
                      }`}
                    >
                      {/* Clean neutral box with colored icon */}
                      <div className="w-8 h-8 rounded-xl bg-secondary/80 border border-border/70 flex items-center justify-center shrink-0">
                        <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                      </div>

                      {/* Content Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs sm:text-sm font-bold text-foreground truncate ${ev.completed ? "line-through text-muted-foreground" : ""}`}>
                            {ev.title}
                          </p>
                          <span className="text-[9.5px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-secondary text-muted-foreground">
                            {cfg.label}
                          </span>
                        </div>

                        {/* Single Specific Time */}
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          {timeStr}
                        </p>

                        {/* Subject & Priority Meta */}
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80 mt-1">
                          {ev.subject && (
                            <span className="flex items-center gap-1 truncate">
                              <Folder className="h-3 w-3" /> {ev.subject}
                            </span>
                          )}
                          {ev.priority && (
                            <span className={`capitalize ${cfg.iconColor} ${ev.priority === "high" ? "font-bold" : ""}`}>
                              ♦ {ev.priority}
                            </span>
                          )}
                        </div>

                        {/* Meeting Join Link */}
                        {ev.link && normalizeLink(ev.link) && (
                          <a
                            href={normalizeLink(ev.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Join Meeting
                          </a>
                        )}
                      </div>

                      {/* Right Actions: [▶ Start Focus] + [Checkmark] + [Delete] */}
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {onStartFocus && !ev.completed && (
                          <button
                            type="button"
                            onClick={() => onStartFocus(ev)}
                            className="h-7 px-2.5 rounded-lg border border-border/80 bg-secondary/80 hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all shadow-2xs"
                            title="Start focus timer"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span className="hidden sm:inline">Start Focus</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleEvent(ev.id)}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                            ev.completed
                              ? "bg-secondary/60 border-border/80 text-emerald-400"
                              : "border-border/80 bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                          title={ev.completed ? "Mark incomplete" : "Mark completed"}
                        >
                          {ev.completed ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Circle className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => removeEvent(ev.id)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 rounded-md p-1 text-foreground hover:bg-secondary transition-opacity"
                          title="Delete activity"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>



        </div>{/* End right column */}

      </div>{/* End main body */}

      {/* ══════════════════════════════════════════════════════════════
          ADD / EDIT ACTIVITY MODAL
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <ActivityModal
            initial={editingEvent}
            defaultDate={selectedDate}
            defaultType={modalDefaultType}
            onSave={handleSaveActivity}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
