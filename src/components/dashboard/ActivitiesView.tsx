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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Trash2, ListChecks, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

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
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <ListChecks className="h-7 w-7" /> Activities
        </h2>
        <Button onClick={() => setShowForm(s => !s)} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Activity
        </Button>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl border border-border/70 p-4 bg-card/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Subject Progress</span>
          <span className="text-sm text-muted-foreground">{overall}%</span>
        </div>
        <Progress value={overall} className="h-2" />
        {bySubject.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {bySubject.map(s => (
              <div key={s.subject} className="rounded-md border border-border/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{s.subject}</span>
                  <span className="text-xs">{s.progress}%</span>
                </div>
                <Progress value={s.progress} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border/70 p-4 space-y-3 overflow-hidden"
          >
            <Input placeholder="Activity title" value={title} onChange={e => setTitle(e.target.value)} />
            <Input placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)} />
            <Input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Add task to checklist…"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftTask(); } }}
                />
                <Button type="button" variant="outline" onClick={addDraftTask}>Add</Button>
              </div>
              {draftTasks.length > 0 && (
                <ul className="space-y-1">
                  {draftTasks.map((t, i) => (
                    <li key={i} className="text-sm flex items-center justify-between rounded-sm border border-border/50 px-2 py-1">
                      <span>{t}</span>
                      <button onClick={() => setDraftTasks(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={createActivityHandler} className="flex-1">Create Activity</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activities yet. Create one to get started.</p>
        ) : (
          activities.map(a => {
            const list = itemsByActivity[a.id] || [];
            const pct = computeProgress(a.id);
            const open = expanded === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-border/70 overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="w-full p-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      {a.subject && <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-0.5">{a.subject}</div>}
                      {a.description && <div className="text-sm text-muted-foreground mt-1">{a.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{list.filter(i => i.done).length}/{list.length}</span>
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs w-10 text-right">{pct}%</span>
                  </div>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/70 overflow-hidden"
                    >
                      <div className="p-4 space-y-2">
                        {list.map(item => (
                          <div key={item.id} className="flex items-center gap-2 rounded-sm hover:bg-secondary/30 px-2 py-1.5">
                            <button
                              onClick={() => toggleItem(item)}
                              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                                item.done ? 'bg-foreground border-foreground' : 'border-border'
                              }`}
                            >
                              {item.done && <Check className="h-3.5 w-3.5 text-background" />}
                            </button>
                            <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.label}</span>
                            <button onClick={() => deleteItem(item)} className="opacity-50 hover:opacity-100">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <Input
                            placeholder="Add a task…"
                            value={newTaskByActivity[a.id] || ''}
                            onChange={e => setNewTaskByActivity(p => ({ ...p, [a.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemToActivity(a.id); } }}
                          />
                          <Button variant="outline" size="sm" onClick={() => addItemToActivity(a.id)}>Add</Button>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => deleteActivityHandler(a.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete activity
                          </Button>
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
