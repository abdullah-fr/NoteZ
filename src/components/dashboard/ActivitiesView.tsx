import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { getSubjectColor } from '@/lib/subjectColors';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchActivities, fetchChecklistItems, createActivity,
  updateActivityProgress, deleteActivity, addChecklistItems,
  addChecklistItem, toggleChecklistItem, deleteChecklistItem,
  generateActivitiesFromDoc, cleanTaskLabel,
  type Activity, type ChecklistItem,
} from '@/services';
import { uploadSourceFile, triggerProcessSource, subscribeToSourceChanges } from '@/services/sources.service';
import { toast } from 'sonner';
import { Plus, Trash2, ListChecks, Check, X, ChevronDown, ChevronUp, Layers, BookOpen, Upload, Loader2, Edit3, Save, CheckCircle2 } from 'lucide-react';

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

  /* ── syllabus import (Prompt 17) ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  type ImportStep = 'idle' | 'uploading' | 'processing' | 'reviewing' | 'saving';
  interface DraftActivity { title: string; subject: string; description: string; tasks: string[] }
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [importDraft, setImportDraft] = useState<DraftActivity[]>([]);
  const [importSourceId, setImportSourceId] = useState<string | null>(null);

  async function handleSyllabusFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setImportStep('uploading');
    try {
      let docText = '';
      try {
        const source = await uploadSourceFile(user.id, file);
        setImportSourceId(source.id);
        setImportStep('processing');
        await triggerProcessSource(source.id);

        // Poll for processed text (max 30s)
        for (let attempt = 0; attempt < 12; attempt++) {
          const { data } = await supabase.from('sources').select('status, extracted_text, summary, error').eq('id', source.id).single();
          if (data?.status === 'ready') {
            docText = data.extracted_text || data.summary || '';
            break;
          }
          if (data?.status === 'failed') break;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch {
        /* Fallback */
      }

      // Fallback text reading
      if (!docText.trim()) {
        docText = await file.text().catch(() => file.name);
      }

      setImportStep('processing');
      const drafts = await generateActivitiesFromDoc(docText, file.name);
      if (!drafts || drafts.length === 0) {
        toast.error('Could not generate activity breakdown from this document.');
        setImportStep('idle');
        return;
      }

      setImportDraft(drafts);
      setImportStep('reviewing');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process document');
      setImportStep('idle');
    }
  }

  async function saveImportedActivities() {
    if (!user || !importDraft.length) return;
    setImportStep('saving');
    try {
      for (const draft of importDraft) {
        const act = await createActivity(user.id, {
          title: draft.title,
          subject: draft.subject || null,
          description: draft.description || null,
        });
        if (draft.tasks.length) {
          await addChecklistItems(draft.tasks.map((label, idx) => ({
            activity_id: act.id, user_id: user.id, label, position: idx,
          })));
        }
      }
      toast.success(`${importDraft.length} activities imported`);
      setImportStep('idle');
      setImportDraft([]);
      load();
    } catch {
      toast.error('Failed to save activities');
      setImportStep('idle');
    }
  }

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
    if (pct === 100) {
      toast.success('🎉 Activity package 100% completed!');
      setTimeout(() => setExpanded(prev => prev === item.activity_id ? null : prev), 400);
    }
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

  const filteredActivities = useMemo(() => {
    return activities.filter(a => computeProgress(a.id) < 100);
  }, [activities, itemsByActivity]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden file input supporting PDF, Word, PPT */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden" onChange={handleSyllabusFile} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importStep !== 'idle'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[11px] font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {importStep === 'uploading' || importStep === 'processing' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {importStep === 'uploading' ? 'Uploading…'
              : importStep === 'processing' ? 'Generating Checklists…'
              : 'Import Document (PDF, Word, PPT)'}
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Task Package
          </button>
        </div>
      </div>

      {/* Syllabus import review panel */}
      <AnimatePresence>
        {importStep === 'reviewing' && importDraft.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-secondary p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Review imported work breakdown</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{importDraft.length} activities detected — edit before saving</p>
              </div>
              <button onClick={() => { setImportStep('idle'); setImportDraft([]); }}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
              ><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {importDraft.map((act, i) => (
                <div key={i} className="rounded-xl border border-border bg-secondary p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <input value={act.title}
                      onChange={e => setImportDraft(prev => prev.map((a, j) => j === i ? { ...a, title: e.target.value } : a))}
                      className="flex-1 bg-transparent text-[13px] font-semibold text-foreground outline-none border-b border-transparent focus:border-border transition-colors"
                    />
                    <button onClick={() => setImportDraft(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    ><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {act.subject && (
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{act.subject}</p>
                  )}
                  <ul className="space-y-0.5">
                    {act.tasks.map((t, ti) => (
                      <li key={ti} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[hsl(var(--muted-foreground))] shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveImportedActivities} disabled={importStep === 'saving'}
                className="flex-1 py-2 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-40"
              >{importStep === 'saving' ? 'Saving…' : `Save ${importDraft.length} activities`}</button>
              <button onClick={() => { setImportStep('idle'); setImportDraft([]); }}
                className="px-4 py-2 rounded-xl border border-border text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
              >Discard</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall progress banner */}
      <div className="rounded-2xl border border-border bg-secondary p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Overall Subject Progress</span>
          <span className="text-[12px] font-mono text-foreground">{overall}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(var(--foreground))] transition-all duration-300" style={{ width: `${overall}%` }} />
        </div>

        {bySubject.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {bySubject.map(s => {
              const subjectColor = getSubjectColor(s.subject);
              return (
                <div key={s.subject} className="rounded-xl border border-border bg-secondary p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: subjectColor }}
                      />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.subject}</span>
                    </div>
                    <span className="text-[11px] font-mono text-foreground">{s.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${s.progress}%`, backgroundColor: subjectColor, opacity: 0.75 }}
                    />
                  </div>
                </div>
              );
            })}
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
            className="rounded-2xl border border-border bg-secondary p-4 space-y-3 overflow-hidden"
          >
            <h3 className="text-[12px] font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-foreground" /> New Activity Package
            </h3>
            <input
              placeholder="Activity title (e.g. Unit 3 Review & Practice)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
            />
            <input
              placeholder="Subject (e.g. Computer Science)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
            />
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  placeholder="Add breakdown task to checklist…"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftTask(); } }}
                  className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
                />
                <button
                  type="button"
                  onClick={addDraftTask}
                  className="px-3 py-1.5 rounded-xl border border-border text-[12px] text-foreground hover:bg-secondary transition-colors"
                >
                  Add Task
                </button>
              </div>
              {draftTasks.length > 0 && (
                <ul className="space-y-1">
                  {draftTasks.map((t, i) => (
                    <li key={i} className="text-[12px] text-foreground flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-1.5">
                      <span>{t}</span>
                      <button onClick={() => setDraftTasks(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-40"
              >
                Create Activity
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
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
          <p className="text-[12px] text-muted-foreground font-mono">Loading task packages…</p>
        ) : filteredActivities.length === 0 ? (
          <div className="rounded-2xl border border-border bg-secondary p-10 text-center">
            <ListChecks className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-[14px] font-medium text-foreground mb-1">Track your study action plans here</p>
            <p className="text-[12px] text-muted-foreground mb-4 max-w-xs mx-auto">
              Import a document (PDF, Word, PPT) or create a new task package. Break complex assignments into manageable steps.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-secondary text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create your first task package
            </button>
          </div>
        ) : (
          filteredActivities.map(a => {
            const list = itemsByActivity[a.id] || [];
            const pct = computeProgress(a.id);
            const isCompleted = pct === 100 && list.length > 0;
            const open = expanded === a.id;
            return (
              <div key={a.id} className={`rounded-2xl border bg-secondary overflow-hidden transition-all ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border'}`}>
                <button
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="w-full p-4 text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-[14px] ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{a.title}</span>
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> 100% Done
                          </span>
                        )}
                      </div>
                      {a.subject && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: getSubjectColor(a.subject) }}
                          />
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                            {a.subject}
                          </div>
                        </div>
                      )}
                      {a.description && (
                        <div className="text-[12px] text-muted-foreground mt-1">
                          {a.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {list.filter(i => i.done).length}/{list.length}
                      </span>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: a.subject ? getSubjectColor(a.subject) : 'hsl(var(--foreground))',
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right text-muted-foreground">{pct}%</span>
                  </div>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden bg-secondary"
                    >
                      <div className="p-4 space-y-2">
                        {list.map(item => (
                          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3.5 py-2.5 hover:border-border transition-all">
                            <button
                              onClick={() => toggleItem(item)}
                              className={`h-5 w-5 rounded-md flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer ${
                                item.done
                                  ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                                  : 'border-muted-foreground/40 hover:border-primary bg-background/80'
                              }`}
                              title={item.done ? "Mark incomplete" : "Mark completed"}
                            >
                              {item.done ? (
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-sm bg-transparent hover:bg-primary/30" />
                              )}
                            </button>
                            <span className={`flex-1 text-[13px] leading-snug ${item.done ? 'line-through text-muted-foreground font-normal' : 'text-foreground font-medium'}`}>
                              {cleanTaskLabel(item.label)}
                            </span>
                            <button onClick={() => deleteItem(item)} className="text-muted-foreground/50 hover:text-destructive p-1 rounded transition-colors">
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
                            className="flex-1 bg-secondary border border-border rounded-xl px-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
                          />
                          <button
                            onClick={() => addItemToActivity(a.id)}
                            className="px-3 py-1.5 rounded-xl border border-border text-[12px] text-foreground hover:bg-secondary transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => deleteActivityHandler(a.id)}
                            className="text-[11px] font-mono text-destructive/60 hover:text-destructive flex items-center gap-1 transition-colors"
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
