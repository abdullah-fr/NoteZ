import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckSquare,
  Flag,
  Trash2,
  StickyNote,
  Clock,
  ChevronDown,
  CalendarDays,
  Video,
  Link2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";

import { useCalendar, type EventType, type CalendarEvent } from "@/lib/calendar";

// Normalizes a pasted link so it always opens as an absolute URL.
function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const eventTypeConfig: Record<
  EventType,
  {
    icon: any;
    label: string;
    dot: string;
    text: string;
    ring: string;
    bg: string;
    gradient: string;
    border: string;
  }
> = {
  task: {
    icon: CheckSquare,
    label: "Task",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    border: "border-l-emerald-500",
  },
  deadline: {
    icon: Flag,
    label: "Deadline",
    dot: "bg-red-500",
    text: "text-red-400",
    ring: "ring-red-500/40",
    bg: "bg-red-500/10",
    gradient: "from-red-500/20 via-red-500/5 to-transparent",
    border: "border-l-red-500",
  },
  event: {
    icon: CalendarDays,
    label: "Event",
    dot: "bg-blue-500",
    text: "text-blue-400",
    ring: "ring-blue-500/40",
    bg: "bg-blue-500/10",
    gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
    border: "border-l-blue-500",
  },
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

function TimeDropdown({
  hour,
  minute,
  ampm,
  onHour,
  onMinute,
  onAmpm,
}: {
  hour: number;
  minute: number;
  ampm: "AM" | "PM";
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
  onAmpm: (a: "AM" | "PM") => void;
}) {
  const [open, setOpen] = useState(false);

  const display = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors text-sm"
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left font-mono">{display}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-border/60 bg-card/98 backdrop-blur-xl shadow-2xl p-3"
          >
            <div className="flex gap-3">
              {/* Hours */}
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Hour
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        onHour(h);
                      }}
                      className={`h-7 rounded-md text-xs font-mono transition-all ${
                        hour === h
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes + AM/PM */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                    Min
                  </p>
                  <div className="flex flex-col gap-1">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        onClick={() => onMinute(Number(m))}
                        className={`h-7 w-12 rounded-md text-xs font-mono transition-all ${
                          minute === Number(m)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        :{m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                    AM/PM
                  </p>
                  <div className="flex flex-col gap-1">
                    {(["AM", "PM"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => onAmpm(a)}
                        className={`h-7 w-12 rounded-md text-xs font-mono transition-all ${
                          ampm === a
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline font-medium"
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

const blankForm = {
  type: "task" as EventType,
  title: "",
  note: "",
  link: "",
  hour: 9,
  minute: 0,
  ampm: "AM" as "AM" | "PM",
};

export default function CalendarView() {
  const { events, addEvent, removeEvent, toggleEvent, getEventsForDate } = useCalendar();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [activeType, setActiveType] = useState<EventType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const paddedDays: (Date | null)[] = Array(startDayOfWeek)
    .fill(null)
    .concat(daysInMonth);

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const startAdding = (type: EventType) => {
    setForm({ ...blankForm, type });
    setActiveType(type);
    setShowForm(true);
  };

  const handleAddEvent = () => {
    if (!selectedDate || !form.title.trim()) return;
    const event: CalendarEvent = {
      id: Date.now().toString(),
      date: selectedDate,
      type: form.type,
      title: form.title,
      note: form.note || undefined,
      link:
        form.type === "event" && form.link.trim()
          ? normalizeLink(form.link)
          : undefined,
      hour: form.hour,
      minute: form.minute,
      ampm: form.ampm,
      completed: false,
    };
    addEvent(event);
    setForm(blankForm);
    setShowForm(false);
    setActiveType(null);
  };

  const handleDelete = (id: string) => removeEvent(id);
  const handleToggle = (id: string) => toggleEvent(id);

  const dotsByDate = useMemo(() => {
    const m = new Map<string, EventType[]>();
    events.forEach((e) => {
      const k = format(e.date, "yyyy-MM-dd");
      m.set(k, [...(m.get(k) || []), e.type]);
    });
    return m;
  }, [events]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <CalendarIcon className="h-7 w-7 text-primary" />
          Study Calendar
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-xl font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-3">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs text-muted-foreground font-medium py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {paddedDays.map((day, idx) => {
                if (!day)
                  return <div key={`e-${idx}`} className="aspect-square" />;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const dots = dotsByDate.get(format(day, "yyyy-MM-dd")) || [];

                return (
                  <motion.button
                    key={day.toISOString()}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all border-2 ${
                      isSelected
                        ? "bg-foreground text-background border-foreground"
                        : isTodayDate
                          ? "bg-primary/20 border-primary"
                          : "bg-background border-transparent hover:bg-foreground/10 hover:border-border"
                    } ${!isCurrentMonth ? "opacity-30" : ""}`}
                  >
                    <span className="text-base font-medium">
                      {format(day, "d")}
                    </span>
                    {dots.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dots.slice(0, 3).map((type, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${eventTypeConfig[type].dot}`}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-4">
              {(Object.keys(eventTypeConfig) as EventType[]).map((key) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${eventTypeConfig[key].dot}`}
                  />
                  {eventTypeConfig[key].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-1 space-y-4">
          <AnimatePresence mode="wait">
            {selectedDate ? (
              <motion.div
                key={selectedDate.toISOString()}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass rounded-2xl p-5 space-y-4"
              >
                {/* Date header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {format(selectedDate, "EEEE")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedDate, "MMMM d, yyyy")}
                    </p>
                  </div>
                  {!showForm && (
                    <Button size="sm" onClick={() => setActiveType("picker")}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  )}
                </div>

                {/* Type picker */}
                <AnimatePresence>
                  {activeType === "picker" && !showForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pt-1">
                        {(["task", "deadline", "event"] as EventType[]).map(
                          (t, i) => {
                            const cfg = eventTypeConfig[t];
                            return (
                              <motion.button
                                key={t}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => startAdding(t)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/40 ${cfg.bg} hover:brightness-110 transition-all text-left`}
                              >
                                <cfg.icon className={`h-4 w-4 ${cfg.text}`} />
                                <span className="text-sm font-medium">
                                  {cfg.label}
                                </span>
                              </motion.button>
                            );
                          },
                        )}
                        <button
                          onClick={() => setActiveType(null)}
                          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Event form */}
                <AnimatePresence>
                  {showForm && activeType && activeType !== "picker" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`rounded-xl p-4 space-y-3 border border-border/30 bg-gradient-to-br ${eventTypeConfig[activeType].gradient}`}
                      >
                        {/* Type label */}
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${eventTypeConfig[activeType].dot}`}
                          />
                          <span className={eventTypeConfig[activeType].text}>
                            New {eventTypeConfig[activeType].label}
                          </span>
                        </div>

                        {/* Title */}
                        <Input
                          value={form.title}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, title: e.target.value }))
                          }
                          placeholder="Title…"
                          className="bg-background/50"
                        />

                        {/* Time picker */}
                        <TimeDropdown
                          hour={form.hour}
                          minute={form.minute}
                          ampm={form.ampm}
                          onHour={(h) => setForm((p) => ({ ...p, hour: h }))}
                          onMinute={(m) =>
                            setForm((p) => ({ ...p, minute: m }))
                          }
                          onAmpm={(a) => setForm((p) => ({ ...p, ampm: a }))}
                        />

                        {/* Note */}
                        <div className="relative">
                          <StickyNote className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                          <Textarea
                            value={form.note}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, note: e.target.value }))
                            }
                            placeholder="Note (optional)…"
                            className="bg-background/50 pl-9 min-h-[70px] resize-none"
                          />
                        </div>

                        {/* Meeting link — events only */}
                        {activeType === "event" && (
                          <div className="space-y-1.5">
                            <div className="relative">
                              <Video className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                              <Input
                                value={form.link}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    link: e.target.value,
                                  }))
                                }
                                placeholder="Paste meeting link (Zoom, Meet, Teams…)"
                                className="bg-background/50 pl-9"
                                inputMode="url"
                              />
                            </div>
                            {form.link.trim() && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 pl-1">
                                <Link2 className="h-3 w-3" />
                                Saved as a video conference link
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddEvent}
                            size="sm"
                            className="flex-1"
                            disabled={!form.title.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowForm(false);
                              setActiveType(null);
                              setForm(blankForm);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Events list */}
                <div className="space-y-2.5">
                  {selectedDateEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No events for this day
                    </p>
                  ) : (
                    selectedDateEvents.map((event) => {
                      const cfg = eventTypeConfig[event.type];
                      const timeStr = `${String(event.hour).padStart(2, "0")}:${String(event.minute).padStart(2, "0")} ${event.ampm}`;
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative overflow-hidden rounded-xl p-3.5 group border-l-4 ${cfg.border} bg-gradient-to-br ${cfg.gradient} ring-1 ${cfg.ring} ${event.completed ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <button
                                onClick={() => handleToggle(event.id)}
                                className="mt-0.5 shrink-0"
                              >
                                <cfg.icon
                                  className={`h-4 w-4 ${event.completed ? "text-emerald-400" : cfg.text}`}
                                />
                              </button>
                              <div className="min-w-0">
                                <p
                                  className={`font-semibold text-sm ${event.completed ? "line-through" : ""}`}
                                >
                                  {event.title}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" /> {timeStr}
                                </p>
                                {event.link && (
                                  <a
                                    href={event.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={event.link}
                                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 px-2 py-1 text-xs font-medium transition-colors"
                                  >
                                    <Video className="h-3.5 w-3.5" />
                                    Join video call
                                  </a>
                                )}
                                {event.note && (
                                  <div className="mt-2 rounded-md bg-background/40 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <StickyNote className="h-3 w-3" /> Note
                                    </p>
                                    <p className="text-xs">{event.note}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => handleDelete(event.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-6 text-center"
              >
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select a date to view or add events
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
