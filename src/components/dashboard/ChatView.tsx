import { useEffect, useRef, useState } from 'react';
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
  MessageSquarePlus, Search, MessageSquare,
} from 'lucide-react';

/* ─── types ─── */
type Mode          = 'researcher' | 'summarizer' | 'analyst' | 'mentor' | 'tutor';
type ContextScope  = 'general' | 'folder' | 'quiz' | 'exam';
type ThinkingStage = 'initializing' | 'thinking' | 'evaluating' | 'displaying' | null;
interface QuickTask { id: string; label: string; icon: any; desc: string; prompt: string }

/* ─── constants ─── */
// All modes use monochrome styling — no accent colors
const MODES: { id: Mode; label: string; icon: any; tag: string }[] = [
  { id: 'researcher', label: 'Research',  icon: FlaskConical,   tag: 'Deep analysis & evidence'     },
  { id: 'summarizer', label: 'Summarize', icon: ScrollText,     tag: 'TL;DR & key bullets'          },
  { id: 'analyst',    label: 'Analyst',   icon: BarChart3,      tag: 'Trade-offs, risks, decisions' },
  { id: 'mentor',     label: 'Mentor',    icon: HeartHandshake, tag: 'Coach & encourage growth'     },
  { id: 'tutor',      label: 'Tutor',     icon: GraduationCap,  tag: 'Explain & teach clearly'      },
];

const SCOPES = [
  { id: 'general' as ContextScope, label: 'General',         icon: Sparkles,       desc: 'Open-ended conversation' },
  { id: 'folder'  as ContextScope, label: 'Ask this Folder', icon: Folder,         desc: 'Context from your notes' },
  { id: 'quiz'    as ContextScope, label: 'Ask this Quiz',   icon: ClipboardCheck, desc: 'Based on quiz results'   },
  { id: 'exam'    as ContextScope, label: 'Ask this Exam',   icon: GraduationCap,  desc: 'From exam performance'   },
];

const AGENT_CARDS: QuickTask[] = [
  { id: 'explain',    label: 'Explain Simpler',      icon: BookOpen,       desc: 'Break down complex topics with analogies.',             prompt: 'Explain this concept in simpler language with an analogy I can relate to.' },
  { id: 'summarize',  label: 'Summarize Folder',     icon: Folder,         desc: 'Condense notes into clear bullet-point summaries.',     prompt: 'Summarize the key points from this folder or unit in bullet points.' },
  { id: 'flashcards', label: 'Generate Flashcards',  icon: Layers,         desc: 'Turn your notes into Q&A flashcard pairs instantly.',   prompt: 'Generate 10 flashcard Q&A pairs from my notes on this topic.' },
  { id: 'studyplan',  label: 'Study Plan from Quiz', icon: ClipboardCheck, desc: 'Convert weak quiz answers into an actionable roadmap.', prompt: 'Based on my weak quiz answers, generate a focused study plan with specific actions.' },
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
  { stage: 'initializing' as ThinkingStage, label: 'Initializing', icon: Zap,      color: 'text-[hsl(40_20%_62%)]' },
  { stage: 'thinking'     as ThinkingStage, label: 'Thinking',     icon: Brain,    color: 'text-[hsl(40_20%_68%)]' },
  { stage: 'evaluating'   as ThinkingStage, label: 'Evaluating',   icon: Search,   color: 'text-[hsl(40_20%_58%)]' },
  { stage: 'displaying'   as ThinkingStage, label: 'Displaying',   icon: Sparkles, color: 'text-[hsl(40_20%_72%)]' },
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
  if (/\.(png|jpe?g)$/.test(n.toLowerCase())) return 'txt';
  return 'docx';
}

/* ─── typewriter hook ─── */
function useTypewriter(phrases: string[], speed = 55, pause = 2200) {
  const [display, setDisplay] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const current = phrases[phraseIdx];
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && charIdx <= current.length) {
      t = setTimeout(() => { setDisplay(current.slice(0, charIdx)); setCharIdx(c => c + 1); }, speed);
    } else if (!deleting && charIdx > current.length) {
      t = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx >= 0) {
      t = setTimeout(() => { setDisplay(current.slice(0, charIdx)); setCharIdx(c => c - 1); }, speed / 2);
    } else {
      setDeleting(false); setPhraseIdx(i => (i + 1) % phrases.length);
    }
    return () => clearTimeout(t);
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause]);
  return display;
}

/* ─── main component ─── */
export default function ChatView() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]         = useState('');
  const [sending, setSending]             = useState(false);
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>(null);
  const [input, setInput]                 = useState('');
  const [mode, setMode]                   = useState<Mode>('tutor');
  const [scope, setScope]                 = useState<ContextScope>('general');
  const [scopeOpen, setScopeOpen]         = useState(false);
  const [attached, setAttached]           = useState<AttachedSource | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [inputFocused, setInputFocused]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggFilter, setSuggFilter]       = useState('');

  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_HINTS);
  const activeMode  = MODES.find(m => m.id === mode)!;
  const activeScope = SCOPES.find(s => s.id === scope)!;
  const inChat      = messages.length > 0 || !!streaming;
  const filteredSuggestions = SUGGESTIONS.filter(s => s.toLowerCase().includes(suggFilter.toLowerCase())).slice(0, 6);

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
    const scopeHint = scope !== 'general' ? `\n\n[CONTEXT SCOPE: ${activeScope.label} — ${activeScope.desc}.]` : '';
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
  function pickCard(task: QuickTask) { setInput(task.prompt); textareaRef.current?.focus(); }

  /* ─── render ─── */
  return (
    <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] flex gap-3">

      {/* ══ Sidebar — conversations list only ══ */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-[hsl(220_8%_14%)] bg-[hsl(220_8%_8%)] overflow-hidden">
        {/* New chat button */}
        <div className="p-2.5 border-b border-[hsl(220_8%_13%)]">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[hsl(220_8%_13%)] hover:bg-[hsl(220_8%_17%)] text-[13px] font-medium text-[hsl(40_20%_78%)] transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4 text-[hsl(40_20%_62%)]" /> New chat
          </button>
        </div>

        {/* Full conversation history */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-3 text-center">
                <MessageSquare className="h-7 w-7 text-[hsl(40_8%_30%)] opacity-60" />
                <p className="text-[11px] text-[hsl(40_8%_38%)] leading-relaxed">No conversations yet. Start a new chat.</p>
              </div>
            )}
            {conversations.map(c => (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                className={`group flex items-start gap-2 px-2.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  activeId === c.id
                    ? 'bg-[hsl(220_8%_15%)] text-[hsl(40_20%_88%)]'
                    : 'text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_12%)] hover:text-[hsl(40_20%_72%)]'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] truncate leading-snug">{c.title}</p>
                  {/* Mode badge */}
                  <p className="text-[9px] font-mono text-[hsl(40_8%_38%)] mt-0.5 capitalize">
                    {c.mode || 'tutor'}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteConv(c.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-[hsl(220_8%_18%)]"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3 w-3 text-[hsl(40_8%_42%)] hover:text-red-400 transition-colors" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* ══ Main panel ══ */}
      <div className="flex-1 flex flex-col rounded-2xl border border-[hsl(220_8%_14%)] bg-[hsl(220_8%_8%)] overflow-hidden min-w-0">

        {/* ── Top bar — scope picker + attachment ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(220_8%_13%)] min-h-[48px]">
          {/* Scope picker */}
          <div className="relative">
            <button onClick={() => setScopeOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_11%)] hover:bg-[hsl(220_8%_14%)] text-[12px] font-medium text-[hsl(40_20%_75%)] transition-colors"
            >
              <activeScope.icon className="h-3.5 w-3.5 text-[hsl(40_20%_58%)]" />
              <span>{activeScope.label}</span>
              <ChevronDown className={`h-3 w-3 text-[hsl(40_8%_42%)] transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
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
                      <s.icon className="h-4 w-4 shrink-0 text-[hsl(40_8%_48%)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[hsl(40_20%_82%)] leading-none mb-0.5">{s.label}</p>
                        <p className="text-[10px] text-[hsl(40_8%_46%)]">{s.desc}</p>
                      </div>
                      {scope === s.id && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(40_20%_60%)] shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active mode badge — monochrome */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_11%)] text-[11px] text-[hsl(40_8%_52%)]">
            <activeMode.icon className="h-3.5 w-3.5 text-[hsl(40_20%_55%)]" />
            <span className="font-medium text-[hsl(40_20%_68%)]">{activeMode.label}</span>
          </div>

          {/* Attachment chip */}
          <AnimatePresence>
            {attached && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_12%)] text-[11px] max-w-[220px]"
              >
                {attached.status === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(40_20%_65%)] shrink-0" />
                  : attached.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(40_20%_58%)] shrink-0" />}
                <FileText className="h-3.5 w-3.5 text-[hsl(40_8%_48%)] shrink-0" />
                <span className="truncate text-[hsl(40_20%_72%)]">{attached.title}</span>
                <button onClick={() => setAttached(null)} className="ml-1 p-0.5 rounded hover:bg-[hsl(220_8%_18%)]"><X className="h-3 w-3" /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
