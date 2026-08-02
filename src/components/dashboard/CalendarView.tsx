import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  CheckSquare, Flag, Video, Clock, ChevronDown, StickyNote,
  Trash2, Link2,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, isToday,
} from "date-fns";
import { useCalendar, type EventType, type CalendarEvent } from "@/lib/calendar";

/* ─── helpers ─── */
function normalizeLink(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/* ─── monochrome type config ─── */
const TYPE_CFG: Record<EventType, { icon: any; label: string; dot: string }> = {
  task:     { icon: CheckSquare, label: "Task",     dot: "bg-[hsl(40_20%_58%)]" },
  deadline: { icon: Flag,        label: "Deadline", dot: "bg-[hsl(40_12%_45%)]" },
  event:    { icon: Video,       label: "Meeting",  dot: "bg-[hsl(40_8%_38%)]"  },
};

const ALL_HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12

/* ═══════════════════════════════════════════════════════════
   TIME DROPDOWN — every hour, AM/PM, smooth animation
═══════════════════════════════════════════════════════════ */
function TimeDropdown({
  hour, ampm,
  onHour, onAmpm,
}: {
  hour: number; ampm: "AM" | "PM";
  onHour: (h: number) => void; onAmpm: (a: "AM" | "PM") => void;
}) {
  const [open, setOpen] = useState(false);
  const display = `${String(hour).padStart(2, "0")}:00 ${ampm}`;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_12%)] hover:bg-[hsl(220_8%_15%)] transition-colors text-[13px] text-[hsl(40_20%_80%)]"
      >
        <Clock className="h-3.5 w-3.5 text-[hsl(40_8%_46%)] shrink-0" />
        <span className="flex-1 text-left font-mono">{display}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="h-3.5 w-3.5 text-[hsl(40_8%_42%)]" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 right-0 mt-1.5 z-40 rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] shadow-2xl p-3"
          >
            <div className="flex gap-3">
              {/* Hour grid */}
              <div className="flex-1">
                <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[hsl(40_8%_40%)] mb-2">Hour</p>
                <div className="grid grid-cols-4 gap-1">
                  {ALL_HOURS.map(h => (
                    <button key={h} onClick={() => onHour(h)}
                      className={`h-7 rounded-lg text-[11px] font-mono transition-all ${
                        hour === h
                          ? "bg-[hsl(220_8%_22%)] text-[hsl(40_20%_88%)] border border-[hsl(220_8%_30%)]"
                          : "text-[hsl(40_8%_50%)] hover:bg-[hsl(220_8%_16%)] hover:text-[hsl(40_20%_75%)]"
                      }`}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
              {/* AM/PM */}
              <div className="flex flex-col gap-1.5 justify-start pt-5">
                {(["AM", "PM"] as const).map(a => (
                  <button key={a} onClick={() => onAmpm(a)}
                    className={`h-8 w-14 rounded-lg text-[11px] font-mono transition-all ${
                      ampm === a
                        ? "bg-[hsl(220_8%_22%)] text-[hsl(40_20%_88%)] border border-[hsl(220_8%_30%)]"
                        : "text-[hsl(40_8%_50%)] hover:bg-[hsl(220_8%_16%)] hover:text-[hsl(40_20%_75%)] border border-transparent"
                    }`}
                  >{a}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[hsl(220_8%_16%)] flex justify-end">
              <button onClick={() => setOpen(false)}
                className="text-[11px] font-medium text-[hsl(40_20%_62%)] hover:text-[hsl(40_20%_80%)] transition-colors"
              >Done</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════ */
const blank = { type: "task" as EventType, title: "", note: "", link: "", hour: 9, ampm: "AM" as "AM" | "PM" };

export default function CalendarView() {
  const { events, addEvent, removeEvent, toggleEvent, getEventsForDate } = useCalendar();
  const [month, setMonth]           = useState(new Date());
  const [selected, setSelected]     = useState<Date | null>(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(blank);

  const monthStart   = startOfMonth(month);
  const monthEnd     = endOfMonth(month);
  const days         = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow     = monthStart.getDay(); // 0=Sun
  const padded: (Date | null)[] = Array(startDow).fill(null).concat(days);
  const dateEvents   = selected ? getEventsForDate(selected) : [];

  const dotMap = useMemo(() => {
    const m = new Map<string, EventType[]>();
    events.forEach(e => { const k = format(e.date, "yyyy-MM-dd"); m.set(k, [...(m.get(k) || []), e.type]); });
    return m;
  }, [events]);

  function startAdding(t: EventType) { setForm({ ...blank, type: t }); setPickerOpen(false); setShowForm(true); }
  function cancel() { setShowForm(false); setPickerOpen(false); setForm(blank); }

  function save() {
    if (!selected || !form.title.trim()) return;
    const ev: CalendarEvent = {
      id: Date.now().toString(), date: selected, type: form.type,
      title: form.title, note: form.note || undefined,
      link: form.type === "event" && form.link.trim() ? normalizeLink(form.link) : undefined,
      hour: form.hour, minute: 0, ampm: form.ampm, completed: false,
    };
    addEvent(ev); cancel();
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2.5 text-[hsl(40_20%_88%)]">
          <CalendarIcon className="h-5 w-5 text-[hsl(40_20%_60%)]" />
          Study Calendar
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

        {/* ══ Calendar grid ══ */}
        <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMonth(subMonths(month, 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_12%)] hover:bg-[hsl(220_8%_16%)] text-[hsl(40_20%_65%)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-[15px] font-semibold text-[hsl(40_20%_84%)]">
              {format(month, "MMMM yyyy")}
            </h3>
            <button onClick={() => setMonth(addMonths(month, 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_12%)] hover:bg-[hsl(220_8%_16%)] text-[hsl(40_20%_65%)] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-mono uppercase tracking-[0.12em] text-[hsl(40_8%_38%)] py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells — compact */}
          <div className="grid grid-cols-7 gap-px">
            {padded.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="h-9" />;
              const isSel     = selected && isSameDay(day, selected);
              const isNow     = isToday(day);
              const inMonth   = isSameMonth(day, month);
              const dots      = dotMap.get(format(day, "yyyy-MM-dd")) || [];
              return (
                <motion.button key={day.toISOString()}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                  onClick={() => { setSelected(day); setShowForm(false); setPickerOpen(false); }}
                  className={`h-9 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                    isSel
                      ? "bg-[hsl(40_20%_82%)] text-[hsl(220_10%_8%)]"
                      : isNow
                      ? "bg-[hsl(220_8%_18%)] border border-[hsl(40_20%_45%/0.5)] text-[hsl(40_20%_85%)]"
                      : "hover:bg-[hsl(220_8%_15%)] text-[hsl(40_20%_78%)]"
                  } ${!inMonth ? "opacity-25" : ""}`}
                >
                  <span className={`text-[12px] font-medium leading-none ${isSel ? "text-[hsl(220_10%_8%)]" : ""}`}>
                    {format(day, "d")}
                  </span>
                  {dots.length > 0 && (
                    <div className="flex gap-[2px] mt-[2px]">
                      {dots.slice(0, 3).map((type, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${TYPE_CFG[type].dot}`} />
                      ))}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-[hsl(220_8%_15%)] flex gap-5">
            {(Object.keys(TYPE_CFG) as EventType[]).map(k => (
              <span key={k} className="flex items-center gap-1.5 text-[10px] text-[hsl(40_8%_44%)] font-mono">
                <span className={`w-2 h-2 rounded-full ${TYPE_CFG[k].dot}`} />
                {TYPE_CFG[k].label}
              </span>
            ))}
          </div>
        </div>

        {/* ══ Right panel ══ */}
        <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Date header */}
              <div className="px-4 pt-4 pb-3 border-b border-[hsl(220_8%_15%)]">
                <p className="text-[15px] font-semibold text-[hsl(40_20%_86%)] leading-none">
                  {format(selected, "EEEE")}
                </p>
                <p className="text-[11px] font-mono text-[hsl(40_8%_44%)] mt-0.5">
                  {format(selected, "MMMM d, yyyy")}
                </p>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Add button / type picker */}
                {!showForm && (
                  <div>
                    <AnimatePresence>
                      {!pickerOpen ? (
                        <motion.button key="add-btn"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onClick={() => setPickerOpen(true)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_46%)] hover:border-[hsl(220_8%_30%)] hover:text-[hsl(40_20%_65%)] hover:bg-[hsl(220_8%_12%)] transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add activity
                        </motion.button>
                      ) : (
                        <motion.div key="type-picker"
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_11%)] p-3 space-y-1.5"
                        >
                          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_38%)] mb-2">Choose type</p>
                          {(["task", "deadline", "event"] as EventType[]).map((t, i) => {
                            const cfg = TYPE_CFG[t];
                            return (
                              <motion.button key={t}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileHover={{ x: 3 }}
                                onClick={() => startAdding(t)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_13%)] hover:border-[hsl(220_8%_26%)] hover:bg-[hsl(220_8%_16%)] text-left transition-all group"
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(220_8%_17%)] border border-[hsl(220_8%_22%)] group-hover:bg-[hsl(220_8%_21%)] transition-colors shrink-0">
                                  <cfg.icon className="h-3.5 w-3.5 text-[hsl(40_20%_62%)]" />
                                </div>
                                <div>
                                  <p className="text-[12px] font-medium text-[hsl(40_20%_80%)]">{cfg.label}</p>
                                  <p className="text-[9px] text-[hsl(40_8%_42%)]">
                                    {t === 'task' ? 'Track a to-do with time' : t === 'deadline' ? 'Set a firm due date' : 'Schedule with a meeting link'}
                                  </p>
                                </div>
                              </motion.button>
                            );
                          })}
                          <button onClick={() => setPickerOpen(false)}
                            className="w-full text-[10px] text-[hsl(40_8%_38%)] hover:text-[hsl(40_20%_60%)] transition-colors py-1.5 text-center"
                          >Cancel</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Form */}
                <AnimatePresence>
                  {showForm && (
                    <motion.div key="form"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                      className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_11%)] p-4 space-y-3"
                    >
                      {/* Form header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[hsl(220_8%_17%)] border border-[hsl(220_8%_22%)]">
                            {(() => { const I = TYPE_CFG[form.type].icon; return <I className="h-3.5 w-3.5 text-[hsl(40_20%_60%)]" />; })()}
                          </div>
                          <span className="text-[11px] font-semibold text-[hsl(40_20%_76%)] uppercase tracking-[0.12em]">
                            New {TYPE_CFG[form.type].label}
                          </span>
                        </div>
                        <button onClick={cancel} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-[hsl(220_8%_18%)] text-[hsl(40_8%_44%)] transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Title */}
                      <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="Title…"
                        className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_30%)] transition-colors"
                      />

                      {/* Time */}
                      <TimeDropdown hour={form.hour} ampm={form.ampm}
                        onHour={h => setForm(p => ({ ...p, hour: h }))}
                        onAmpm={a => setForm(p => ({ ...p, ampm: a }))}
                      />

                      {/* Note */}
                      <div className="relative">
                        <StickyNote className="absolute left-3 top-[11px] h-3.5 w-3.5 text-[hsl(40_8%_40%)]" />
                        <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                          placeholder="Note (optional)…"
                          rows={3}
                          className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-xl pl-9 pr-3 py-2 text-[12px] text-[hsl(40_20%_80%)] placeholder:text-[hsl(40_8%_36%)] outline-none resize-none focus:border-[hsl(220_8%_30%)] transition-colors"
                        />
                      </div>

                      {/* Meeting link — only for meeting type */}
                      {form.type === "event" && (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(40_8%_40%)]" />
                            <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                              placeholder="Paste meeting link (Zoom, Meet, Teams…)"
                              inputMode="url"
                              className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-xl pl-9 pr-3 py-2 text-[12px] text-[hsl(40_20%_80%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_30%)] transition-colors"
                            />
                          </div>
                          {form.link.trim() && (
                            <p className="text-[10px] text-[hsl(40_8%_44%)] flex items-center gap-1 pl-1">
                              <Link2 className="h-3 w-3" /> Saved as a meeting link
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={save} disabled={!form.title.trim()}
                          className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[hsl(40_20%_82%)] text-[hsl(220_10%_8%)] hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >Save</button>
                        <button onClick={cancel}
                          className="px-4 py-2 rounded-xl text-[12px] border border-[hsl(220_8%_22%)] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
                        >Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Events list */}
                {dateEvents.length === 0 && !showForm && !pickerOpen && (
                  <p className="text-[12px] text-[hsl(40_8%_38%)] text-center py-6 italic">No activities for this day</p>
                )}
                {dateEvents.map(ev => {
                  const cfg = TYPE_CFG[ev.type];
                  const timeStr = `${String(ev.hour).padStart(2, "0")}:00 ${ev.ampm}`;
                  return (
                    <motion.div key={ev.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`group rounded-xl border-l-[3px] border-[hsl(220_8%_28%)] bg-[hsl(220_8%_11%)] border border-[hsl(220_8%_17%)] px-3 py-2.5 flex items-start gap-2.5 transition-all hover:border-[hsl(220_8%_24%)] ${ev.completed ? "opacity-40" : ""}`}
                    >
                      <button onClick={() => toggleEvent(ev.id)} className="shrink-0 mt-0.5">
                        <cfg.icon className="h-3.5 w-3.5 text-[hsl(40_20%_55%)]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium text-[hsl(40_20%_82%)] leading-snug ${ev.completed ? "line-through" : ""}`}>{ev.title}</p>
                        <p className="text-[10px] font-mono text-[hsl(40_8%_44%)] mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{timeStr}
                          <span className="ml-1.5 text-[hsl(40_8%_38%)]">{cfg.label}</span>
                        </p>
                        {ev.link && (
                          <a href={ev.link} target="_blank" rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[hsl(40_20%_58%)] hover:text-[hsl(40_20%_78%)] transition-colors"
                          >
                            <Video className="h-3 w-3" /> Join meeting
                          </a>
                        )}
                        {ev.note && (
                          <p className="mt-1 text-[11px] text-[hsl(40_8%_46%)] leading-relaxed">{ev.note}</p>
                        )}
                      </div>
                      <button onClick={() => removeEvent(ev.id)}
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-[hsl(220_8%_18%)] transition-all"
                      >
                        <Trash2 className="h-3 w-3 text-[hsl(40_8%_40%)] hover:text-red-400 transition-colors" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
              <CalendarIcon className="h-10 w-10 text-[hsl(40_8%_28%)]" />
              <p className="text-[12px] text-[hsl(40_8%_38%)]">Select a date to view or add activities</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
