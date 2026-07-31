import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/lib/auth';
import {
  fetchConversations, fetchMessages, fetchSourceById,
  createConversation, updateConversation, deleteConversation,
  uploadChatFile, createSourceRecord, invokeProcessSource,
  getStreamingToken, subscribeToSourceUpdates,
  type Conversation, type ChatMessage, type AttachedSource,
} from '@/services';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import {
  Send, Sparkles, GraduationCap, FlaskConical, ScrollText,
  Trash2, Loader2, Plus, FileText, X, BarChart3, HeartHandshake,
  CheckCircle2, AlertCircle, BookOpen, Folder, ClipboardCheck,
  Zap, Brain, Layers, ArrowRight, ChevronDown, ArrowUpRight,
  MessageSquarePlus, Search,
} from 'lucide-react';

/* ─────────────────────── types ─────────────────────────────── */
type Mode         = 'researcher' | 'summarizer' | 'analyst' | 'mentor' | 'tutor';
type ContextScope = 'general' | 'folder' | 'quiz' | 'exam';
type ThinkingStage = 'initializing' | 'thinking' | 'evaluating' | 'displaying' | null;
interface QuickTask { id: string; label: string; icon: any; desc: string; prompt: string }

/* ─────────────────────── constants ─────────────────────────── */
const MODES = [
  { id: 'researcher' as Mode, label: 'Research',  icon: FlaskConical,   tag: 'Deep analysis & evidence',     color: '#38bdf8' },
  { id: 'summarizer' as Mode, label: 'Summarize', icon: ScrollText,     tag: 'TL;DR & key bullets',          color: '#fbbf24' },
  { id: 'analyst'    as Mode, label: 'Analyst',   icon: BarChart3,      tag: 'Trade-offs, risks, decisions', color: '#34d399' },
  { id: 'mentor'     as Mode, label: 'Mentor',    icon: HeartHandshake, tag: 'Coach & encourage growth',     color: '#fb7185' },
  { id: 'tutor'      as Mode, label: 'Tutor',     icon: GraduationCap,  tag: 'Explain & teach clearly',      color: '#a78bfa' },
];

const SCOPES = [
  { id: 'general' as ContextScope,  label: 'General',          icon: Sparkles,       desc: 'Open-ended conversation' },
  { id: 'folder'  as ContextScope,  label: 'Ask this Folder',  icon: Folder,         desc: 'Context from your notes' },
  { id: 'quiz'    as ContextScope,  label: 'Ask this Quiz',    icon: ClipboardCheck, desc: 'Based on quiz results' },
  { id: 'exam'    as ContextScope,  label: 'Ask this Exam',    icon: GraduationCap,  desc: 'From exam performance' },
];

const AGENT_CARDS: QuickTask[] = [
  { id: 'explain',    label: 'Explain Simpler',     icon: BookOpen,       desc: 'Break down complex topics with analogies and simple language.',           prompt: 'Explain this concept in simpler language with an analogy I can relate to.' },
  { id: 'summarize',  label: 'Summarize Folder',    icon: Folder,         desc: 'Condense your notes or unit into clear bullet-point summaries.',          prompt: 'Summarize the key points from this folder or unit in bullet points.' },
  { id: 'flashcards', label: 'Generate Flashcards', icon: Layers,         desc: 'Turn your notes into Q&A flashcard pairs instantly.',                     prompt: 'Generate 10 flashcard Q&A pairs from my notes on this topic.' },
  { id: 'studyplan',  label: 'Study Plan from Quiz',icon: ClipboardCheck, desc: 'Convert weak quiz answers into an actionable study roadmap.',             prompt: 'Based on my weak quiz answers, generate a focused study plan with specific actions.' },
];

const TYPEWRITER_HINTS = [
  'Ask about a concept from your notes…',
  'Summarize my Algorithms folder…',
  'Generate flashcards from Chapter 4…',
  'Explain recursion with an analogy…',
  'Turn my quiz results into a study plan…',
  'Compare merge sort and quick sort…',
  'What are the key points of this exam?',
];

const THINKING_STAGES = [
  { stage: 'initializing' as ThinkingStage, label: 'Initializing', icon: Zap,      color: 'text-sky-400' },
  { stage: 'thinking'     as ThinkingStage, label: 'Thinking',     icon: Brain,    color: 'text-violet-400' },
  { stage: 'evaluating'   as ThinkingStage, label: 'Evaluating',   icon: Search,   color: 'text-amber-400' },
  { stage: 'displaying'   as ThinkingStage, label: 'Displaying',   icon: Sparkles, color: 'text-emerald-400' },
];

const SUGGESTIONS = [
  'Explain Bayes theorem simply',
  'Summarize my Data Structures folder',
  'Generate flashcards on neural networks',
  'Compare REST and GraphQL',
  'Build a study plan from last quiz',
  'Explain recursion with a real example',
  'Summarize Chapter 5 key points',
  'What should I review before my exam?',
];

const ACCEPT    = '.pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg';
const ACCEPT_RE = /\.(pdf|docx?|pptx?|png|jpe?g)$/i;
function detectKind(n: string): 'pdf' | 'docx' | 'txt' {
  if (n.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g)$/.test(n.toLowerCase())) return 'txt'; // images sent as binary → txt fallback
  return 'docx';
}

/* ─────────────────────── typewriter hook ───────────────────── */
function useTypewriter(phrases: string[], speed = 55, pause = 2200) {
  const [display, setDisplay] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting && charIdx <= current.length) {
      timeout = setTimeout(() => {
        setDisplay(current.slice(0, charIdx));
        setCharIdx(c => c + 1);
      }, speed);
    } else if (!deleting && charIdx > current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx >= 0) {
      timeout = setTimeout(() => {
        setDisplay(current.slice(0, charIdx));
        setCharIdx(c => c - 1);
      }, speed / 2);
    } else {
      setDeleting(false);
      setPhraseIdx(i => (i + 1) % phrases.length);
    }
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause]);

  return display;
}

/* ─────────────────────── main component ────────────────────── */
export default function ChatView() {
  const { user } = useAuth();
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [activeId, setActiveId]             = useState<string | null>(null);
  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]           = useState('');
  const [sending, setSending]               = useState(false);
  const [thinkingStage, setThinkingStage]   = useState<ThinkingStage>(null);
  const [input, setInput]                   = useState('');
  const [mode, setMode]                     = useState<Mode>('tutor');
  const [scope, setScope]                   = useState<ContextScope>('general');
  const [scopeOpen, setScopeOpen]           = useState(false);
  const [attached, setAttached]             = useState<AttachedSource | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [inputFocused, setInputFocused]     = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');

  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_HINTS);
  const activeMode  = MODES.find(m => m.id === mode)!;
  const activeScope = SCOPES.find(s => s.id === scope)!;
  const inChat      = messages.length > 0 || !!streaming;

  const filteredSuggestions = SUGGESTIONS.filter(s =>
    s.toLowerCase().includes(suggestionFilter.toLowerCase())
  ).slice(0, 6);

  useEffect(() => { if (user?.id) loadConversations(); }, [user?.id]);
  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else { setMessages([]); setAttached(null); }
  }, [activeId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);
  useEffect(() => {
    if (!attached?.id) return;
    return subscribeToSourceUpdates(attached.id, ({ status, error }) => {
      setAttached(a => a?.id === attached.id ? { ...a, status: status as AttachedSource['status'], error } : a);
      if (status === 'failed') toast({ title: 'Attachment failed', description: error || 'Could not process file', variant: 'destructive' });
    });
  }, [attached?.id]);
  useEffect(() => {
    if (!sending) { setThinkingStage(null); return; }
    const stages: ThinkingStage[] = ['initializing', 'thinking', 'evaluating'];
    let i = 0; setThinkingStage(stages[0]);
    const iv = setInterval(() => { i++; if (i < stages.length) setThinkingStage(stages[i]); else clearInterval(iv); }, 900);
    return () => clearInterval(iv);
  }, [sending]);
  useEffect(() => { if (streaming && thinkingStage !== 'displaying') setThinkingStage('displaying'); }, [streaming]);

  // close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadConversations() {
    if (!user) return;
    setConversations(await fetchConversations());
  }
  async function loadMessages(id: string) {
    const data = await fetchMessages(id);
    setMessages(data);
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setMode(conv.mode as Mode);
      if (conv.source_id) setAttached(await fetchSourceById(conv.source_id));
      else setAttached(null);
    }
  }
  async function newConversation() {
    if (!user) return;
    const data = await createConversation(user.id, mode, 'New chat', attached?.id);
    setConversations(prev => [data, ...prev]);
    setActiveId(data.id); setMessages([]);
  }
  async function deleteConv(id: string) {
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }
  async function handleFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    const file = files[0];
    if (!ACCEPT_RE.test(file.name)) { toast({ title: 'Unsupported file', description: 'PDF, Word, PPT, PNG, JPEG only', variant: 'destructive' }); return; }
    if (file.size > 20 * 1024 * 1024) { toast({ title: 'File too large', description: 'Max 20MB', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const { path } = await uploadChatFile(user.id, file);
      const row = await createSourceRecord(user.id, file.name, detectKind(file.name), path);
      setAttached({ id: row.id, title: row.title, status: 'processing' });
      void invokeProcessSource(row.id);
      toast({ title: 'Attached', description: 'Processing…' });
    } catch (e: any) { toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function send(overrideMsg?: string) {
    const msg = (overrideMsg ?? input).trim();
    if (!msg || !user || sending) return;
    let convId = activeId;
    if (!convId) {
      const prefix = scope !== 'general' ? `[${activeScope.label}] ` : '';
      const data = await createConversation(user.id, mode, prefix + msg.slice(0, 60), attached?.id);
      convId = data.id; setActiveId(convId); setConversations(prev => [data, ...prev]);
    } else { await updateConversation(convId, { mode, source_id: attached?.id ?? null }); }

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: msg, created_at: new Date().toISOString() }]);
    setInput(''); setSending(true); setStreaming(''); setShowSuggestions(false);

    const scopeHint = scope !== 'general' ? `\n\n[CONTEXT SCOPE: ${activeScope.label} — ${activeScope.desc}. Cite platform material.]` : '';
    try {
      const token = await getStreamingToken();
      const resp = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: convId, message: msg + scopeHint, mode, sourceId: attached?.status === 'ready' ? attached.id : null, scope }),
      });
      if (!resp.ok || !resp.body) throw new Error((await resp.text()) || 'Stream failed');
      const reader = resp.body.getReader(); const decoder = new TextDecoder(); let acc = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; acc += decoder.decode(value, { stream: true }); setStreaming(acc); }
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: acc, created_at: new Date().toISOString() }]);
      setStreaming(''); loadConversations();
    } catch (e: any) { toast({ title: 'Chat error', description: e.message, variant: 'destructive' }); setStreaming(''); }
    finally { setSending(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function pickSuggestion(s: string) { setInput(s); setShowSuggestions(false); textareaRef.current?.focus(); }
  function pickAgentCard(task: QuickTask) { setInput(task.prompt); textareaRef.current?.focus(); }

  /* ─── render ─── */
  return (
    <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] flex gap-3">

      {/* ══ Sidebar ══ */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-[hsl(220_8%_14%)] bg-[hsl(220_8%_8%)] overflow-hidden">
        <div className="p-2.5 border-b border-[hsl(220_8%_13%)]">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[hsl(220_8%_13%)] hover:bg-[hsl(220_8%_17%)] text-[13px] font-medium transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" /> New chat
          </button>
        </div>
        {/* Mode list */}
        <div className="p-2.5 border-b border-[hsl(220_8%_13%)]">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_40%)] mb-2 px-1">Mode</p>
          {MODES.map((m, i) => {
            const on = m.id === mode;
            return (
              <motion.button key={m.id} onClick={() => setMode(m.id)}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }} whileHover={{ x: 2 }}
                className={`relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left mb-0.5 transition-all ${on ? 'bg-[hsl(220_8%_14%)]' : 'hover:bg-[hsl(220_8%_12%)]'}`}
              >
                {on && <span className="absolute left-0 inset-y-2 w-[3px] rounded-r-full" style={{ background: m.color }} />}
                <span className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ background: m.color + '18', border: `1px solid ${m.color}30` }}>
                  <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-none mb-0.5" style={{ color: on ? m.color : 'hsl(40 20% 80%)' }}>{m.label}</p>
                  <p className="text-[9px] text-[hsl(40_8%_45%)] truncate">{m.tag}</p>
                </div>
                {on && <motion.span layoutId="mode-dot" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />}
              </motion.button>
            );
          })}
        </div>
        {/* History */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 && <p className="text-[11px] text-[hsl(40_8%_40%)] text-center py-6">No chats yet</p>}
            {conversations.map(c => (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? 'bg-[hsl(220_8%_14%)] text-[hsl(40_20%_90%)]' : 'text-[hsl(40_8%_55%)] hover:bg-[hsl(220_8%_11%)]'}`}
              >
                <Sparkles className="h-3 w-3 shrink-0 opacity-60" />
                <span className="text-[11px] truncate flex-1">{c.title}</span>
                <button onClick={e => { e.stopPropagation(); deleteConv(c.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* ══ Main panel ══ */}
      <div className="flex-1 flex flex-col rounded-2xl border border-[hsl(220_8%_14%)] bg-[hsl(220_8%_8%)] overflow-hidden min-w-0">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(220_8%_13%)] min-h-[48px]">
          {/* Scope picker */}
          <div className="relative">
            <button onClick={() => setScopeOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_11%)] hover:bg-[hsl(220_8%_14%)] text-[12px] font-medium transition-colors"
            >
              <activeScope.icon className="h-3.5 w-3.5 text-[hsl(40_30%_75%)]" />
              <span className="text-[hsl(40_20%_85%)]">{activeScope.label}</span>
              <ChevronDown className={`h-3 w-3 text-[hsl(40_8%_45%)] transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {scopeOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.13 }}
                  className="absolute top-full mt-2 left-0 z-50 w-60 rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] shadow-2xl overflow-hidden"
                >
                  {SCOPES.map(s => (
                    <button key={s.id} onClick={() => { setScope(s.id); setScopeOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(220_8%_14%)] transition-colors ${scope === s.id ? 'bg-[hsl(220_8%_13%)]' : ''}`}
                    >
                      <s.icon className={`h-4 w-4 shrink-0 ${scope === s.id ? 'text-[hsl(40_30%_80%)]' : 'text-[hsl(40_8%_45%)]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[hsl(40_20%_88%)] leading-none mb-0.5">{s.label}</p>
                        <p className="text-[10px] text-[hsl(40_8%_50%)]">{s.desc}</p>
                      </div>
                      {scope === s.id && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(145_18%_55%)] shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {scope !== 'general' && (
            <motion.span initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-mono px-2 py-1 rounded-md bg-[hsl(145_18%_35%/0.15)] border border-[hsl(145_18%_35%/0.3)] text-[hsl(145_18%_65%)]"
            >
              context-scoped
            </motion.span>
          )}

          {/* Attachment chip */}
          <AnimatePresence>
            {attached && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_12%)] text-[11px] max-w-[220px]"
              >
                {attached.status === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  : attached.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(40_30%_75%)] shrink-0" />}
                <FileText className="h-3.5 w-3.5 text-[hsl(40_8%_50%)] shrink-0" />
                <span className="truncate text-[hsl(40_20%_80%)]">{attached.title}</span>
                <button onClick={() => setAttached(null)} className="ml-1 p-0.5 rounded hover:bg-[hsl(220_8%_18%)]"><X className="h-3 w-3" /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Messages / Hero ── */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {!inChat ? (
              /* ════ HERO — single-view, no scroll ════ */
              <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}
                className="h-full flex flex-col items-center justify-center px-6 py-3 overflow-hidden"
              >
                {/* Orb */}
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                  className="relative w-10 h-10 mb-3 shrink-0"
                >
                  <div className="absolute inset-0 rounded-xl bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_20%)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                      <circle cx="9"  cy="9"  r="3.2" fill="hsl(40 30% 80%)" />
                      <circle cx="19" cy="9"  r="3.2" fill="hsl(40 30% 80%)" />
                      <circle cx="9"  cy="19" r="3.2" fill="hsl(40 30% 80%)" />
                      <circle cx="19" cy="19" r="3.2" fill="hsl(40 30% 80%)" />
                      <circle cx="14" cy="14" r="2.2" fill="hsl(40 30% 60%)" opacity="0.6" />
                    </svg>
                  </div>
                </motion.div>

                {/* Headline */}
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="text-xl md:text-2xl font-bold text-center mb-1.5 tracking-tight shrink-0"
                >
                  How can we <span className="text-[hsl(40_30%_78%)] italic">assist</span> you today?
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
                  className="text-[11px] text-[hsl(40_8%_50%)] text-center max-w-md mb-4 leading-relaxed shrink-0"
                >
                  AI agents for research, summarisation, analysis, mentoring and tutoring — pick a task card to begin.
                </motion.p>

                {/* ── Agent cards — 4 in a row ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-3xl mb-4 shrink-0"
                >
                  {AGENT_CARDS.map((card, i) => (
                    <motion.button key={card.id}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 + i * 0.05 }}
                      whileHover={{ y: -2, boxShadow: '0 6px 24px hsl(0 0% 0% / 0.55)' }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => pickAgentCard(card)}
                      className="group text-left p-3 rounded-xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] hover:border-[hsl(220_8%_26%)] hover:bg-[hsl(220_8%_13%)] transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-[hsl(220_8%_15%)] border border-[hsl(220_8%_22%)] flex items-center justify-center shrink-0">
                          <card.icon className="text-[hsl(40_20%_72%)]" style={{ width: 14, height: 14 }} />
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(40_8%_38%)] group-hover:text-[hsl(40_20%_65%)] transition-colors" />
                      </div>
                      <p className="text-[12px] font-semibold text-[hsl(40_20%_86%)] leading-snug mb-1">{card.label}</p>
                      <p className="text-[10px] text-[hsl(40_8%_46%)] leading-relaxed">{card.desc}</p>
                    </motion.button>
                  ))}
                </motion.div>

                {/* ── AI Modes row ── */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                  className="w-full max-w-3xl shrink-0"
                >
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_36%)] mb-2 text-center">AI Modes</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {MODES.map((m, i) => (
                      <motion.button key={m.id}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.34 + i * 0.04 }}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setMode(m.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                          mode === m.id
                            ? 'border-[hsl(220_8%_26%)] bg-[hsl(220_8%_15%)]'
                            : 'border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] hover:border-[hsl(220_8%_22%)] hover:bg-[hsl(220_8%_13%)]'
                        }`}
                      >
                        <m.icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
                        <span style={{ color: mode === m.id ? m.color : 'hsl(40 8% 60%)' }}>{m.label}</span>
                        {mode === m.id && <span className="w-1 h-1 rounded-full shrink-0" style={{ background: m.color }} />}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              /* ════ MESSAGES — scrollable only after chat starts ════ */
              <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full overflow-auto"
              >
                <div ref={scrollRef} className="max-w-3xl mx-auto w-full px-4 py-5 space-y-4">
                  <AnimatePresence initial={false}>
                    {messages.map(m => <Bubble key={m.id} message={m} />)}
                  </AnimatePresence>
                  {streaming && <Bubble message={{ id: 'stream', role: 'assistant', content: streaming, created_at: '' }} streaming />}
                  {sending && <ThinkingIndicator stage={thinkingStage} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Composer — compact single-line ── */}
        <div className="px-3 pb-3 pt-2 border-t border-[hsl(220_8%_13%)] bg-[hsl(220_8%_8%)] shrink-0">
          <div ref={composerRef} className="max-w-3xl mx-auto relative">

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] shadow-2xl overflow-hidden z-50"
                >
                  <div className="px-3 pt-2 pb-0.5 border-b border-[hsl(220_8%_14%)]">
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_36%)]">Suggestions</p>
                  </div>
                  {filteredSuggestions.map((s, i) => (
                    <motion.button key={s}
                      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                      onMouseDown={() => pickSuggestion(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[hsl(220_8%_14%)] transition-colors group"
                    >
                      <Search className="h-3 w-3 text-[hsl(40_8%_36%)] group-hover:text-[hsl(40_20%_65%)] shrink-0 transition-colors" />
                      <span className="text-[11px] text-[hsl(40_8%_60%)] group-hover:text-[hsl(40_20%_82%)] flex-1 transition-colors">{s}</span>
                      <ArrowRight className="h-3 w-3 text-[hsl(40_8%_30%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input bar — single row ── */}
            <motion.div
              animate={inputFocused
                ? { boxShadow: '0 0 0 1.5px hsl(40 30% 68% / 0.2), 0 0 28px hsl(40 20% 72% / 0.05)' }
                : { boxShadow: '0 0 0 1px hsl(220 8% 20%)' }
              }
              transition={{ duration: 0.2 }}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(220_8%_11%)]"
            >
              {/* Focus top-line */}
              <AnimatePresence>
                {inputFocused && (
                  <motion.div
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                    transition={{ duration: 0.28 }}
                    className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(40_30%_70%/0.4)] to-transparent origin-left pointer-events-none rounded-t-xl"
                  />
                )}
              </AnimatePresence>

              {/* + Attach button */}
              <input ref={fileRef} type="file" className="hidden" accept={ACCEPT} onChange={e => handleFiles(e.target.files)} />
              <motion.button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_14%)] text-[hsl(40_20%_62%)] hover:text-[hsl(40_30%_82%)] hover:border-[hsl(220_8%_28%)] hover:bg-[hsl(220_8%_18%)] transition-all"
                aria-label="Attach file — PDF, Word, PPT, PNG, JPEG"
                title="Attach — PDF · Word · PPT · PNG · JPEG"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </motion.button>

              {/* Attached chip — inline */}
              <AnimatePresence>
                {attached && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_14%)] text-[10px] max-w-[130px] shrink-0"
                  >
                    {attached.status === 'ready' ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      : attached.status === 'failed' ? <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                      : <Loader2 className="h-3 w-3 animate-spin text-[hsl(40_30%_65%)] shrink-0" />}
                    <span className="truncate text-[hsl(40_8%_58%)]">{attached.title}</span>
                    <button onClick={() => setAttached(null)} className="shrink-0 p-0.5 rounded hover:bg-[hsl(220_8%_20%)]">
                      <X className="h-2.5 w-2.5 text-[hsl(40_8%_42%)]" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea — single line, grows to max 4 lines */}
              <div className="relative flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    setSuggestionFilter(e.target.value);
                    setShowSuggestions(inputFocused);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 88) + 'px';
                  }}
                  onKeyDown={onKey}
                  onFocus={() => { setInputFocused(true); setShowSuggestions(true); setSuggestionFilter(input); }}
                  onBlur={() => setInputFocused(false)}
                  rows={1}
                  placeholder=""
                  className="w-full bg-transparent text-[13px] text-[hsl(40_20%_86%)] resize-none outline-none leading-relaxed placeholder:text-transparent"
                  style={{ height: '32px', maxHeight: '88px' }}
                  aria-label="Chat input"
                />
                {/* Typewriter ghost */}
                {!input && !inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[13px] text-[hsl(40_8%_34%)]">
                    {typewriterText}
                    <span className="inline-block w-[1.5px] h-[13px] bg-[hsl(40_8%_34%)] ml-[2px] align-middle animate-pulse" />
                  </div>
                )}
                {!input && inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[13px] text-[hsl(40_8%_26%)]">
                    Type your question…
                  </div>
                )}
              </div>

              {/* Send button */}
              <motion.button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                whileHover={input.trim() && !sending ? { scale: 1.04 } : {}}
                whileTap={input.trim() && !sending ? { scale: 0.94 } : {}}
                className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12px] font-semibold shrink-0 transition-all select-none ${
                  input.trim() && !sending
                    ? 'bg-[hsl(40_30%_82%)] text-[hsl(220_10%_8%)] shadow-[0_1px_10px_hsl(40_30%_68%/0.25)]'
                    : 'bg-[hsl(220_8%_15%)] text-[hsl(40_8%_30%)] cursor-not-allowed'
                }`}
              >
                {sending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><span>Send</span><ArrowRight className="h-3 w-3" /></>
                }
              </motion.button>
            </motion.div>

            <p className="text-[9px] text-[hsl(40_8%_28%)] text-center mt-1.5 select-none">
              ↵ send · Shift+↵ newline · attach PDF · Word · PPT · PNG · JPEG
            </p>
          </div>
        </div>

      </div>{/* end main panel */}
    </div>
  );
}

/* ─────────────────────── ThinkingIndicator ─────────────────── */
function ThinkingIndicator({ stage }: { stage: ThinkingStage }) {
  if (!stage) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-center gap-2 py-1"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_11%)]">
        {THINKING_STAGES.map((s, i) => {
          const isActive = s.stage === stage;
          const isPast   = THINKING_STAGES.findIndex(x => x.stage === stage) > i;
          return (
            <motion.div key={String(s.stage)}
              animate={isActive ? { scale: [1, 1.25, 1] } : {}}
              transition={{ duration: 0.7, repeat: isActive ? Infinity : 0 }}
              className="flex items-center gap-1"
            >
              <s.icon className={`h-3.5 w-3.5 transition-colors ${isPast ? 'text-emerald-400' : isActive ? s.color : 'text-[hsl(40_8%_28%)]'}`} />
              {isActive && <span className={`text-[10px] font-mono ${s.color}`}>{s.label}</span>}
            </motion.div>
          );
        })}
        <div className="flex gap-0.5 ml-1">
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }}
              className="w-1 h-1 rounded-full bg-[hsl(40_8%_40%)]"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────── Bubble ────────────────────────────── */
interface ParsedSections { hasStructure: boolean; answer: string; material: string; nextActions: string; raw: string }

function parseStructured(content: string): ParsedSections {
  const a  = content.match(/##\s*(?:Answer|Here(?:'s| is)(?: the)? [Aa]nswer)[:\s\n]*([\s\S]*?)(?=##|$)/i);
  const m  = content.match(/##\s*(?:Material(?: Used| I Used)?|Sources?)[:\s\n]*([\s\S]*?)(?=##|$)/i);
  const na = content.match(/##\s*(?:Next (?:Actions?|Steps?)|What to Do Next)[:\s\n]*([\s\S]*?)(?=##|$)/i);
  return { hasStructure: !!(a || m || na), answer: a?.[1]?.trim() ?? '', material: m?.[1]?.trim() ?? '', nextActions: na?.[1]?.trim() ?? '', raw: content };
}

function Bubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser   = message.role === 'user';
  const sections = parseStructured(message.content);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {isUser ? (
        <div className="max-w-[82%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[13px] bg-[hsl(220_8%_15%)] border border-[hsl(220_8%_20%)] text-[hsl(40_20%_88%)]">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      ) : sections.hasStructure ? (
        <div className="max-w-[88%] space-y-2">
          {sections.answer && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl rounded-bl-sm px-4 py-3 bg-[hsl(220_8%_11%)] border border-[hsl(220_8%_18%)]"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-sky-400">Answer</span>
              </div>
              <Markdown text={sections.answer + (streaming && !sections.material && !sections.nextActions ? ' ▍' : '')} />
            </motion.div>
          )}
          {sections.material && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-xl px-4 py-3 bg-amber-400/5 border border-amber-400/15"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-400">Material Used</span>
              </div>
              <Markdown text={sections.material + (streaming && !sections.nextActions ? ' ▍' : '')} />
            </motion.div>
          )}
          {sections.nextActions && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-xl px-4 py-3 bg-emerald-400/5 border border-emerald-400/15"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-400">Next Actions</span>
              </div>
              <Markdown text={sections.nextActions + (streaming ? ' ▍' : '')} />
            </motion.div>
          )}
          {!sections.answer && sections.raw && (
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-[hsl(220_8%_11%)] border border-[hsl(220_8%_18%)]">
              <Markdown text={sections.raw + (streaming ? ' ▍' : '')} />
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 bg-[hsl(220_8%_11%)] border border-[hsl(220_8%_18%)]">
          <Markdown text={message.content + (streaming ? ' ▍' : '')} />
        </div>
      )}
    </motion.div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-[13px] prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1 prose-pre:bg-[hsl(220_8%_8%)] prose-pre:border prose-pre:border-[hsl(220_8%_18%)] prose-code:text-[hsl(40_30%_78%)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
