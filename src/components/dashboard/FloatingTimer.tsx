import { useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  Brain, ListChecks, GraduationCap,
  Play, Pause, RotateCcw, X, GripHorizontal,
  Check, Plus, Trash2, ChevronRight, ChevronLeft,
  Minus,
} from "lucide-react";
import { useTimer } from "@/lib/timer";

interface Props { onClose: () => void }

type Tab = "focus" | "task" | "exam";

const TABS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: "focus", label: "Focus", icon: Brain,         color: "#a78bfa" },
  { id: "task",  label: "Task",  icon: ListChecks,    color: "hsl(32 70% 55%)" },
  { id: "exam",  label: "Exam",  icon: GraduationCap, color: "hsl(200 70% 55%)" },
];

/* ── tiny ring ── */
function Ring({ progress, color, size = 52 }: { progress: number; color: string; size?: number }) {
  const r    = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(220 8% 18%)" strokeWidth={4} />
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

export default function FloatingTimer({ onClose }: Props) {
  const timer = useTimer();
  const [tab, setTab]           = useState<Tab>("focus");
  const [collapsed, setCollapsed] = useState(false);
  const [newLabel, setNewLabel]  = useState("");
  const [newMins, setNewMins]    = useState(5);
  const [examMinsInput, setExamMinsInput] = useState(timer.examMinutes);

  const dragControls  = useDragControls();
  const constraintRef = useRef<HTMLDivElement>(null);

  const activeTab = TABS.find(t => t.id === tab)!;
  const activeTask = timer.activeTaskIdx !== null ? timer.tasks[timer.activeTaskIdx] : null;

  function addTask() {
    if (!newLabel.trim()) return;
    timer.addTask(newLabel.trim(), newMins);
    setNewLabel("");
  }

  return (
    <div ref={constraintRef} className="fixed inset-0 pointer-events-none z-50">
      <motion.div
        drag dragControls={dragControls} dragMomentum={false}
        dragConstraints={constraintRef}
        initial={{ x: typeof window !== "undefined" ? window.innerWidth - 260 : 0, y: 80 }}
        className="absolute pointer-events-auto select-none"
        style={{ width: collapsed ? 180 : 250 }}
      >
        <div className="rounded-2xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_9%)/0.97] backdrop-blur-xl shadow-[0_8px_40px_hsl(0_0%_0%/0.6)] overflow-hidden">

          {/* ── Drag handle / header ── */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-[hsl(220_8%_15%)] cursor-grab active:cursor-grabbing bg-[hsl(220_8%_11%)]"
            onPointerDown={e => dragControls.start(e)}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-[hsl(40_8%_40%)]" />
              <activeTab.icon className="h-3.5 w-3.5" style={{ color: activeTab.color }} />
              <span className="text-[11px] font-mono font-medium text-[hsl(40_8%_55%)] uppercase tracking-wider">
                {activeTab.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCollapsed(v => !v)}
                className="h-5 w-5 rounded flex items-center justify-center hover:bg-[hsl(220_8%_18%)] text-[hsl(40_8%_45%)] hover:text-[hsl(40_20%_72%)] transition-colors"
                title={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </button>
              <button onClick={onClose}
                className="h-5 w-5 rounded flex items-center justify-center hover:bg-red-400/20 text-[hsl(40_8%_45%)] hover:text-red-400 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* ── Tab strip ── */}
          {!collapsed && (
            <div className="flex border-b border-[hsl(220_8%_15%)]">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors ${
                    tab === t.id ? "border-b-2 text-[hsl(40_20%_85%)]" : "text-[hsl(40_8%_42%)] hover:text-[hsl(40_20%_65%)]"
                  }`}
                  style={{ borderColor: tab === t.id ? t.color : "transparent" }}
                >
                  <t.icon className="h-3 w-3" style={{ color: tab === t.id ? t.color : undefined }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Body ── */}
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div key={tab}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                className="p-3"
              >
                {/* ════ FOCUS ════ */}
                {tab === "focus" && (
                  <div className="flex flex-col items-center gap-2.5">
                    {/* ring */}
                    <div className="relative">
                      <Ring progress={timer.progress} color="#a78bfa" size={60} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {timer.isCompleted
                          ? <Check className="h-4 w-4 text-emerald-400" />
                          : <span className="text-[13px] font-bold font-mono text-[hsl(40_20%_90%)]">{fmt(timer.timeLeft)}</span>
                        }
                      </div>
                    </div>
                    {/* status */}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${timer.isRunning ? "bg-[#a78bfa] animate-pulse" : timer.isCompleted ? "bg-emerald-400" : "bg-[hsl(220_8%_32%)]"}`} />
                      <span className="text-[10px] font-mono text-[hsl(40_8%_48%)]">
                        {timer.isRunning ? "focusing" : timer.isCompleted ? "done!" : `${timer.selectedMinutes}m`}
                      </span>
                    </div>
                    {/* duration pills */}
                    <div className="flex gap-1 flex-wrap justify-center">
                      {[15, 25, 30, 45, 60].map(m => (
                        <button key={m} onClick={() => timer.selectMinutes(m)} disabled={timer.isRunning}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all disabled:opacity-40 ${
                            timer.selectedMinutes === m ? "bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/30" : "bg-[hsl(220_8%_14%)] text-[hsl(40_8%_48%)] border border-[hsl(220_8%_20%)] hover:bg-[hsl(220_8%_18%)]"
                          }`}
                        >{m}m</button>
                      ))}
                    </div>
                    {/* controls */}
                    <div className="flex items-center gap-2">
                      {!timer.isRunning ? (
                        <button onClick={timer.start}
                          className="w-8 h-8 rounded-full bg-[#a78bfa]/20 border border-[#a78bfa]/40 flex items-center justify-center hover:bg-[#a78bfa]/30 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5 text-[#a78bfa] ml-0.5" fill="#a78bfa" />
                        </button>
                      ) : (
                        <button onClick={timer.pause}
                          className="w-8 h-8 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                        >
                          <Pause className="h-3.5 w-3.5 text-[hsl(40_20%_75%)]" fill="currentColor" />
                        </button>
                      )}
                      <button onClick={timer.reset}
                        className="w-7 h-7 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
                      >
                        <RotateCcw className="h-3 w-3 text-[hsl(40_8%_48%)]" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ════ TASK ════ */}
                {tab === "task" && (
                  <div className="flex flex-col gap-2.5">
                    {/* Add task */}
                    <div className="flex gap-1.5 items-center">
                      <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addTask()}
                        placeholder="Task name…"
                        className="flex-1 min-w-0 bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-lg px-2 py-1 text-[11px] text-[hsl(40_20%_82%)] placeholder:text-[hsl(40_8%_34%)] outline-none"
                      />
                      <select value={newMins} onChange={e => setNewMins(+e.target.value)}
                        className="bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-lg px-1 py-1 text-[10px] text-[hsl(40_8%_55%)] outline-none"
                      >
                        {[1,2,3,5,8,10,15].map(m => <option key={m} value={m}>{m}m</option>)}
                      </select>
                      <button onClick={addTask}
                        className="w-6 h-6 rounded-lg bg-[hsl(32_70%_48%)/0.2] border border-[hsl(32_70%_48%)/0.4] flex items-center justify-center hover:bg-[hsl(32_70%_48%)/0.35] transition-colors shrink-0"
                      >
                        <Plus className="h-3 w-3" style={{ color: "hsl(32 70% 60%)" }} />
                      </button>
                    </div>

                    {/* Task list */}
                    <div className="space-y-1 max-h-28 overflow-auto">
                      {timer.tasks.length === 0 && (
                        <p className="text-[10px] text-[hsl(40_8%_36%)] text-center py-2">No tasks yet</p>
                      )}
                      {timer.tasks.map((t, i) => (
                        <div key={t.id} onClick={() => timer.selectTask(i)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                            timer.activeTaskIdx === i
                              ? "border-[hsl(32_70%_45%)] bg-[hsl(32_70%_40%/0.12)]"
                              : t.done ? "border-[hsl(220_8%_15%)] opacity-40"
                              : "border-[hsl(220_8%_18%)] hover:border-[hsl(220_8%_25%)]"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${t.done ? "border-emerald-400 bg-emerald-400/20" : "border-[hsl(220_8%_30%)]"}`}>
                            {t.done && <Check className="h-2 w-2 text-emerald-400" />}
                          </div>
                          <span className={`flex-1 text-[10px] truncate ${t.done ? "line-through text-[hsl(40_8%_38%)]" : "text-[hsl(40_20%_78%)]"}`}>{t.label}</span>
                          <span className="text-[9px] font-mono text-[hsl(40_8%_40%)] shrink-0">{t.minutes}m</span>
                          <button onClick={e => { e.stopPropagation(); timer.removeTask(t.id); }}
                            className="h-4 w-4 flex items-center justify-center hover:text-red-400 text-[hsl(40_8%_38%)] transition-colors"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Active task timer */}
                    {activeTask && (
                      <div className="flex items-center gap-2 pt-1.5 border-t border-[hsl(220_8%_15%)]">
                        <div className="relative shrink-0">
                          <Ring progress={timer.taskProgress} color="hsl(32 70% 55%)" size={44} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            {timer.taskCompleted
                              ? <Check className="h-3 w-3 text-emerald-400" />
                              : <span className="text-[9px] font-bold font-mono text-[hsl(40_20%_90%)]">{fmt(timer.taskTimeLeft)}</span>
                            }
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-[hsl(40_20%_78%)] truncate">{activeTask.label}</p>
                          <p className="text-[9px] text-[hsl(40_8%_42%)]">{activeTask.minutes}m slot</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!timer.taskRunning ? (
                            <button onClick={timer.startTask}
                              className="w-6 h-6 rounded-full bg-[hsl(32_70%_48%)/0.2] border border-[hsl(32_70%_48%)/0.4] flex items-center justify-center hover:bg-[hsl(32_70%_48%)/0.35] transition-colors"
                            >
                              <Play className="h-3 w-3 ml-[1px]" style={{ color: "hsl(32 70% 60%)" }} fill="hsl(32 70% 60%)" />
                            </button>
                          ) : (
                            <button onClick={timer.pauseTask}
                              className="w-6 h-6 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                            >
                              <Pause className="h-3 w-3 text-[hsl(40_20%_72%)]" fill="currentColor" />
                            </button>
                          )}
                          <button onClick={timer.nextTask}
                            className="w-6 h-6 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
                          >
                            <ChevronRight className="h-3 w-3 text-[hsl(40_8%_48%)]" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ════ EXAM ════ */}
                {tab === "exam" && (
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="relative">
                      <Ring progress={timer.examProgress} color="hsl(200 70% 55%)" size={60} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {timer.examCompleted
                          ? <Check className="h-4 w-4 text-emerald-400" />
                          : <span className="text-[11px] font-bold font-mono text-[hsl(40_20%_90%)]">{fmt(timer.examTimeLeft)}</span>
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${timer.examRunning ? "bg-[hsl(200_70%_55%)] animate-pulse" : timer.examCompleted ? "bg-emerald-400" : "bg-[hsl(220_8%_32%)]"}`} />
                      <span className="text-[10px] font-mono text-[hsl(40_8%_48%)]">
                        {timer.examRunning ? "exam running" : timer.examCompleted ? "time's up!" : `${timer.examMinutes}m exam`}
                      </span>
                    </div>
                    {/* Duration */}
                    {!timer.examRunning && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setExamMinsInput(m => Math.max(1, m - 5))}
                          className="w-6 h-6 rounded-md border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                        >
                          <ChevronLeft className="h-3 w-3 text-[hsl(40_8%_50%)]" />
                        </button>
                        <input type="number" min={1} value={examMinsInput}
                          onChange={e => setExamMinsInput(Math.max(1, +e.target.value))}
                          onBlur={() => timer.setExamMinutes(examMinsInput)}
                          className="w-12 bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)] rounded-lg px-1 py-0.5 text-[11px] text-[hsl(40_20%_82%)] text-center outline-none"
                        />
                        <span className="text-[10px] text-[hsl(40_8%_44%)]">min</span>
                        <button onClick={() => setExamMinsInput(m => m + 5)}
                          className="w-6 h-6 rounded-md border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                        >
                          <ChevronRight className="h-3 w-3 text-[hsl(40_8%_50%)]" />
                        </button>
                      </div>
                    )}
                    {/* Quick presets */}
                    {!timer.examRunning && (
                      <div className="flex gap-1 flex-wrap justify-center">
                        {[30, 60, 90, 120].map(m => (
                          <button key={m} onClick={() => { setExamMinsInput(m); timer.setExamMinutes(m); }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all ${
                              timer.examMinutes === m ? "bg-[hsl(200_70%_45%)/0.2] text-[hsl(200_70%_65%)] border border-[hsl(200_70%_45%)/0.35]" : "bg-[hsl(220_8%_14%)] text-[hsl(40_8%_48%)] border border-[hsl(220_8%_20%)] hover:bg-[hsl(220_8%_18%)]"
                            }`}
                          >{m < 60 ? `${m}m` : `${m/60}h`}</button>
                        ))}
                      </div>
                    )}
                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      {!timer.examRunning ? (
                        <button onClick={() => { timer.setExamMinutes(examMinsInput); timer.startExam(); }}
                          className="w-8 h-8 rounded-full bg-[hsl(200_70%_45%)/0.2] border border-[hsl(200_70%_45%)/0.4] flex items-center justify-center hover:bg-[hsl(200_70%_45%)/0.35] transition-colors"
                        >
                          <Play className="h-3.5 w-3.5 ml-0.5" style={{ color: "hsl(200 70% 65%)" }} fill="hsl(200 70% 65%)" />
                        </button>
                      ) : (
                        <button onClick={timer.pauseExam}
                          className="w-8 h-8 rounded-full border border-[hsl(220_8%_24%)] bg-[hsl(220_8%_14%)] flex items-center justify-center hover:bg-[hsl(220_8%_18%)] transition-colors"
                        >
                          <Pause className="h-3.5 w-3.5 text-[hsl(40_20%_75%)]" fill="currentColor" />
                        </button>
                      )}
                      <button onClick={timer.resetExam}
                        className="w-7 h-7 rounded-full border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] flex items-center justify-center hover:bg-[hsl(220_8%_17%)] transition-colors"
                      >
                        <RotateCcw className="h-3 w-3 text-[hsl(40_8%_48%)]" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed mini view */}
          {collapsed && (
            <div className="flex items-center gap-2 px-3 py-2">
              {tab === "focus" && (
                <>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${timer.isRunning ? "bg-[#a78bfa] animate-pulse" : "bg-[hsl(220_8%_30%)]"}`} />
                  <span className="text-[12px] font-mono font-bold text-[hsl(40_20%_88%)]">{fmt(timer.timeLeft)}</span>
                  {!timer.isRunning
                    ? <button onClick={timer.start} className="ml-auto w-6 h-6 rounded-full bg-[#a78bfa]/20 border border-[#a78bfa]/40 flex items-center justify-center"><Play className="h-3 w-3 text-[#a78bfa] ml-[1px]" fill="#a78bfa" /></button>
                    : <button onClick={timer.pause} className="ml-auto w-6 h-6 rounded-full border border-[hsl(220_8%_24%)] flex items-center justify-center"><Pause className="h-3 w-3 text-[hsl(40_20%_72%)]" fill="currentColor" /></button>
                  }
                </>
              )}
              {tab === "task" && (
                <>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${timer.taskRunning ? "bg-[hsl(32_70%_55%)] animate-pulse" : "bg-[hsl(220_8%_30%)]"}`} />
                  <span className="text-[12px] font-mono font-bold text-[hsl(40_20%_88%)]">{fmt(timer.taskTimeLeft)}</span>
                  {!timer.taskRunning
                    ? <button onClick={timer.startTask} className="ml-auto w-6 h-6 rounded-full bg-[hsl(32_70%_48%)/0.2] border border-[hsl(32_70%_48%)/0.4] flex items-center justify-center"><Play className="h-3 w-3 ml-[1px]" style={{ color: "hsl(32 70% 60%)" }} fill="hsl(32 70% 60%)" /></button>
                    : <button onClick={timer.pauseTask} className="ml-auto w-6 h-6 rounded-full border border-[hsl(220_8%_24%)] flex items-center justify-center"><Pause className="h-3 w-3 text-[hsl(40_20%_72%)]" fill="currentColor" /></button>
                  }
                </>
              )}
              {tab === "exam" && (
                <>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${timer.examRunning ? "bg-[hsl(200_70%_55%)] animate-pulse" : "bg-[hsl(220_8%_30%)]"}`} />
                  <span className="text-[12px] font-mono font-bold text-[hsl(40_20%_88%)]">{fmt(timer.examTimeLeft)}</span>
                  {!timer.examRunning
                    ? <button onClick={timer.startExam} className="ml-auto w-6 h-6 rounded-full bg-[hsl(200_70%_45%)/0.2] border border-[hsl(200_70%_45%)/0.4] flex items-center justify-center"><Play className="h-3 w-3 ml-[1px]" style={{ color: "hsl(200 70% 65%)" }} fill="hsl(200 70% 65%)" /></button>
                    : <button onClick={timer.pauseExam} className="ml-auto w-6 h-6 rounded-full border border-[hsl(220_8%_24%)] flex items-center justify-center"><Pause className="h-3 w-3 text-[hsl(40_20%_72%)]" fill="currentColor" /></button>
                  }
                </>
              )}
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
