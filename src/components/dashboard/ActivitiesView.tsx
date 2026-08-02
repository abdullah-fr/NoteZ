import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import {
  fetchActivities,
  fetchChecklistItems,
  createActivity,
  updateActivityProgress,
  deleteActivity,
  addChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  type Activity,
  type ChecklistItem,
} from '@/services';
import { toast } from 'sonner';
import { Plus, Trash2, ListChecks, Check, X, ChevronDown, ChevronUp, Layers, BookOpen } from 'lucide-react';

export default function ActivitiesView() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [draftTasks, setDraftTasks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTaskByActivity, setNewTaskByActivity] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [acts, checklists] = await Promise.all([
      fetchActivities(user.id),
      fetchChecklistItems(user.id),
    ]);
    setActivities(acts);
    setItems(checklists);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const itemsByActivity = useMemo(() => {
    const m: Record<string, ChecklistItem[]> = {};
    items.forEach(i => { (m[i.activity_id] ||= []).push(i); });
    return m;
  }, [items]);

  const computeProgress = (activityId: string) => {
    const list = itemsByActivity[activityId] || [];
    if (!list.length) return 0;
    return Math.round((list.filter(i => i.done).length / list.length) * 100);
  };

  const persistProgress = async (activityId: string, value: number) => {
    await updateActivityProgress(activityId, value);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, progress: value } : a));
  };

  const addDraftTask = () => {
    if (!taskInput.trim()) return;
    setDraftTasks(prev => [...prev, taskInput.trim()]);
    setTaskInput('');
  };

  const createActivityHandler = async () => {
    if (!user || !title.trim()) return toast.error('Title required');
    const data = await createActivity(user.id, {
      title,
      description: description || null,
      subject: subject || null,
    });
    if (draftTasks.length) {
      await addChecklistItems(
        draftTasks.map((label, idx) => ({
          activity_id: data.id,
          user_id: user.id,
          label,
          position: idx,
        })),
      );
    }
    toast.success('Activity created');
    setTitle(''); setSubject(''); setDescription(''); setDraftTasks([]); setShowForm(false);
    load();
  };

  const toggleItem = async (item: ChecklistItem) => {
    const newDone = !item.done;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i));
    await toggleChecklistItem(item.id, newDone);
    const list = (itemsByActivity[item.activity_id] || []).map(i => i.id === item.id ? { ...i, done: newDone } : i);
    const pct = list.length ? Math.round((list.filter(i => i.done).length / list.length) * 100) : 0;
    persistProgress(item.activity_id, pct);
  };

  const addItemToActivity = async (activityId: string) => {
    const label = (newTaskByActivity[activityId] || '').trim();
    if (!label || !user) return;
    const position = (itemsByActivity[activityId]?.length || 0);
    const data = await addChecklistItem(activityId, user.id, label, position);
    setItems(prev => [...prev, data]);
    setNewTaskByActivity(p => ({ ...p, [activityId]: '' }));
    const list = [...(itemsByActivity[activityId] || []), data];
    const pct = list.length ? Math.round((list.filter(i => i.done).length / list.length) * 100) : 0;
    persistProgress(activityId, pct);
  };

  const deleteItem = async (item: ChecklistItem) => {
    await deleteChecklistItem(item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    const list = (itemsByActivity[item.activity_id] || []).filter(i => i.id !== item.id);
    const pct = list.length ? Math.round((list.filter(i => i.done).length / list.length) * 100) : 0;
    persistProgress(item.activity_id, pct);
  };

  const deleteActivityHandler = async (id: string) => {
    await deleteActivity(id);
    setActivities(prev => prev.filter(a => a.id !== id));
    setItems(prev => prev.filter(i => i.activity_id !== id));
  };

  const overall = useMemo(() => {
    if (!activities.length) return 0;
    return Math.round(activities.reduce((s, a) => s + (a.progress || 0), 0) / activities.length);
  }, [activities]);

  const bySubject = useMemo(() => {
    const m: Record<string, { total: number; count: number }> = {};
    activities.forEach(a => {
      const k = a.subject || 'General';
      m[k] ||= { total: 0, count: 0 };
      m[k].total += a.progress || 0;
      m[k].count += 1;
    });
    return Object.entries(m).map(([s, v]) => ({ subject: s, progress: Math.round(v.total / v.count) }));
  }, [activities]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2.5">
          <ListChecks className="h-5.5 w-5.5 text-[hsl(40_20%_80%)]" />
          Activities & Work Breakdown
        </h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[12px] font-medium text-[hsl(40_20%_80%)] hover:bg-[hsl(220_8%_17%)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Activity
        </button>
      </div>

      {/* Overall progress banner */}
      <div className="rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_44%)]">Overall Subject Progress</span>
          <span className="text-[12px] font-mono text-[hsl(40_20%_80%)]">{overall}%</span>
        </div>
        <div className="w-full h-1.5 bg-[hsl(220_8%_16%)] rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(40_20%_65%)] transition-all duration-300" style={{ width: `${overall}%` }} />
        </div>

        {bySubject.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {bySubject.map(s => (
              <div key={s.subject} className="rounded-xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_13%)] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(40_8%_46%)]">{s.subject}</span>
                  <span className="text-[11px] font-mono text-[hsl(40_20%_78%)]">{s.progress}%</span>
                </div>
                <div className="w-full h-1 bg-[hsl(220_8%_18%)] rounded-full overflow-hidden">
                  <div className="h-full bg-[hsl(40_20%_60%)] transition-all duration-300" style={{ width: `${s.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Activity form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_10%)] p-4 space-y-3 overflow-hidden"
          >
            <h3 className="text-[12px] font-semibold text-[hsl(40_20%_82%)] flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-[hsl(40_20%_65%)]" /> New Activity Package
            </h3>
            <input
              placeholder="Activity title (e.g. Unit 3 Review & Practice)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
            />
            <input
              placeholder="Subject (e.g. Computer Science)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
            />
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  placeholder="Add breakdown task to checklist…"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftTask(); } }}
                  className="flex-1 bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
                />
                <button
                  type="button"
                  onClick={addDraftTask}
                  className="px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_20%_80%)] hover:bg-[hsl(220_8%_16%)] transition-colors"
                >
                  Add Task
                </button>
              </div>
              {draftTasks.length > 0 && (
                <ul className="space-y-1">
                  {draftTasks.map((t, i) => (
                    <li key={i} className="text-[12px] text-[hsl(40_20%_80%)] flex items-center justify-between rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_12%)] px-3 py-1.5">
                      <span>{t}</span>
                      <button onClick={() => setDraftTasks(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5 text-[hsl(40_8%_44%)] hover:text-red-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={createActivityHandler}
                disabled={!title.trim()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40"
              >
                Create Activity
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activities list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-[12px] text-[hsl(40_8%_44%)] font-mono">Loading activities…</p>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-12 text-center">
            <ListChecks className="h-10 w-10 mx-auto mb-3 text-[hsl(40_8%_30%)]" />
            <p className="text-[13px] text-[hsl(40_8%_40%)]">No activities yet. Create your first work breakdown package.</p>
          </div>
        ) : (
          activities.map(a => {
            const list = itemsByActivity[a.id] || [];
            const pct = computeProgress(a.id);
            const open = expanded === a.id;
            return (
              <div key={a.id} className="rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="w-full p-4 text-left hover:bg-[hsl(220_8%_12%)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-semibold text-[14px] text-[hsl(40_20%_86%)]">{a.title}</div>
                      {a.subject && (
                        <div className="text-[9px] font-mono uppercase tracking-widest text-[hsl(40_8%_46%)] mt-0.5">
                          {a.subject}
                        </div>
                      )}
                      {a.description && (
                        <div className="text-[12px] text-[hsl(40_8%_52%)] mt-1">
                          {a.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-[hsl(40_8%_44%)]">
                        {list.filter(i => i.done).length}/{list.length}
                      </span>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-[hsl(40_8%_44%)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[hsl(40_8%_44%)]" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-[hsl(220_8%_16%)] rounded-full overflow-hidden">
                      <div className="h-full bg-[hsl(40_20%_65%)] transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right text-[hsl(40_8%_46%)]">{pct}%</span>
                  </div>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[hsl(220_8%_16%)] overflow-hidden bg-[hsl(220_8%_11%)]"
                    >
                      <div className="p-4 space-y-2">
                        {list.map(item => (
                          <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_13%)] px-3 py-2">
                            <button
                              onClick={() => toggleItem(item)}
                              className={`h-4.5 w-4.5 rounded flex items-center justify-center border transition-colors ${
                                item.done ? 'bg-[hsl(40_20%_75%)] border-[hsl(40_20%_75%)]' : 'border-[hsl(220_8%_28%)]'
                              }`}
                            >
                              {item.done && <Check className="h-3 w-3 text-[hsl(220_10%_8%)]" />}
                            </button>
                            <span className={`flex-1 text-[12px] ${item.done ? 'line-through text-[hsl(40_8%_40%)]' : 'text-[hsl(40_20%_82%)]'}`}>
                              {item.label}
                            </span>
                            <button onClick={() => deleteItem(item)} className="text-[hsl(40_8%_40%)] hover:text-red-400 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <input
                            placeholder="Add a task…"
                            value={newTaskByActivity[a.id] || ''}
                            onChange={e => setNewTaskByActivity(p => ({ ...p, [a.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemToActivity(a.id); } }}
                            className="flex-1 bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-1.5 text-[12px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
                          />
                          <button
                            onClick={() => addItemToActivity(a.id)}
                            className="px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_20%_80%)] hover:bg-[hsl(220_8%_16%)] transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => deleteActivityHandler(a.id)}
                            className="text-[11px] font-mono text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> Delete activity
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
