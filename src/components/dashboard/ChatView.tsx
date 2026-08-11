import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchConversations, fetchMessages, fetchSourceById,
  createConversation, updateConversation, deleteConversation,
  uploadChatFile, createSourceRecord, invokeProcessSource,
  getStreamingToken, subscribeToSourceUpdates,
  type Conversation, type ChatMessage, type AttachedSource,
} from '@/services';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { useUpgradeModal, parseLimitError } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { format } from 'date-fns';
import {
  Send, Sparkles, GraduationCap, FlaskConical, ScrollText,
  Trash2, Loader2, Plus, FileText, X, BarChart3, HeartHandshake,
  CheckCircle2, AlertCircle, BookOpen, Folder, ClipboardCheck,
  Zap, Brain, Layers, ArrowRight, ChevronDown, ArrowUpRight,
  MessageSquarePlus, Search, MessageSquare, Pin, Archive,
  MoreHorizontal, PinOff, ArchiveRestore, History,
} from 'lucide-react';

/* ─── types ─── */
type Mode          = 'researcher' | 'summarizer' | 'analyst' | 'mentor' | 'tutor';
type ThinkingStage = 'initializing' | 'thinking' | 'evaluating' | 'displaying' | null;
interface QuickTask { id: string; label: string; icon: any; desc: string; prompt: string; accent: string }

interface LocalFolder { id: string; name: string; color: string }

/* ─── conv meta stored in localStorage ─── */
interface ConvMeta { pinned?: boolean; archived?: boolean }
function loadMeta(): Record<string, ConvMeta> {
  try { return JSON.parse(localStorage.getItem('notez_conv_meta') || '{}'); } catch { return {}; }
}
function saveMeta(m: Record<string, ConvMeta>) {
  try { localStorage.setItem('notez_conv_meta', JSON.stringify(m)); } catch {}
}

/* ─── constants ─── */
const MODES: { id: Mode; label: string; icon: any; tag: string }[] = [
  { id: 'researcher', label: 'Research',  icon: FlaskConical,   tag: 'Deep analysis & evidence'     },
  { id: 'summarizer', label: 'Summarize', icon: ScrollText,     tag: 'TL;DR & key bullets'          },
  { id: 'analyst',    label: 'Analyst',   icon: BarChart3,      tag: 'Trade-offs, risks, decisions' },
  { id: 'mentor',     label: 'Mentor',    icon: HeartHandshake, tag: 'Coach & encourage growth'     },
  { id: 'tutor',      label: 'Tutor',     icon: GraduationCap,  tag: 'Explain & teach clearly'      },
];

const FOLDER_SCOPE = { label: 'Ask this Folder', desc: 'Context from your notes' };

const AGENT_CARDS: QuickTask[] = [
  { id: 'explain',    label: 'Explain Simpler',      icon: BookOpen,       desc: 'Break down complex topics with analogies.',             prompt: 'Explain this concept in simpler language with an analogy I can relate to.', accent: 'border-l-notez-violet' },
  { id: 'summarize',  label: 'Summarize Folder',     icon: Folder,         desc: 'Condense notes into clear bullet-point summaries.',     prompt: 'Summarize the key points from this folder or unit in bullet points.', accent: 'border-l-notez-indigo' },
  { id: 'flashcards', label: 'Generate Flashcards',  icon: Layers,         desc: 'Turn your notes into Q&A flashcard pairs instantly.',   prompt: 'Generate 10 flashcard Q&A pairs from my notes on this topic.', accent: 'border-l-notez-success' },
  { id: 'studyplan',  label: 'Study Plan from Quiz', icon: ClipboardCheck, desc: 'Convert weak quiz answers into an actionable roadmap.', prompt: 'Based on my weak quiz answers, generate a focused study plan with specific actions.', accent: 'border-l-notez-warning' },
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
  { stage: 'initializing' as ThinkingStage, label: 'Initializing', icon: Zap,      color: 'text-foreground' },
  { stage: 'thinking'     as ThinkingStage, label: 'Thinking',     icon: Brain,    color: 'text-foreground' },
  { stage: 'evaluating'   as ThinkingStage, label: 'Evaluating',   icon: Search,   color: 'text-foreground' },
  { stage: 'displaying'   as ThinkingStage, label: 'Displaying',   icon: Sparkles, color: 'text-foreground' },
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
    } else if (deleting && charIdx > 0) {
      t = setTimeout(() => { setDisplay(current.slice(0, charIdx)); setCharIdx(c => c - 1); }, speed / 2);
    } else {
      setDisplay('');
      setCharIdx(0);
      setDeleting(false);
      setPhraseIdx(i => (i + 1) % phrases.length);
    }
    return () => clearTimeout(t);
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause]);
  return display;
}

/* ─── main component ─── */
export default function ChatView() {
  const { user } = useAuth();
  const { upgradeModal, handleLimitError, closeUpgradeModal } = useUpgradeModal();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convMeta, setConvMeta]           = useState<Record<string, ConvMeta>>(loadMeta);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]         = useState('');
  const [sending, setSending]             = useState(false);
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>(null);
  const [input, setInput]                 = useState('');
  const [mode, setMode]                   = useState<Mode>('tutor');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen]         = useState(false);
  const [attached, setAttached]           = useState<AttachedSource | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [inputFocused, setInputFocused]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggFilter, setSuggFilter]       = useState('');
  const [menuOpenId, setMenuOpenId]       = useState<string | null>(null);

  function readLocalFolders(): LocalFolder[] {
    try {
      const raw = localStorage.getItem('notez_folders');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.map((f: any) => ({ id: f.id, name: f.name, color: f.color }));
    } catch { return []; }
  }

  const [localFolders, setLocalFolders] = useState<LocalFolder[]>(readLocalFolders);

  const selectedFolder = localFolders.find(f => f.id === selectedFolderId) ?? null;

  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);
  const scopeRef    = useRef<HTMLDivElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_HINTS);
  const activeMode  = MODES.find(m => m.id === mode)!;
  const inChat      = messages.length > 0 || !!streaming;
  const filteredSuggestions = SUGGESTIONS.filter(s => s.toLowerCase().includes(suggFilter.toLowerCase())).slice(0, 6);

  // Sorted conversations: pinned first, then by updated_at, archived last
  const sortedConversations = useMemo(() => {
    const active = conversations.filter(c => !convMeta[c.id]?.archived);
    const archived = conversations.filter(c => convMeta[c.id]?.archived);
    const pinned = active.filter(c => convMeta[c.id]?.pinned);
    const unpinned = active.filter(c => !convMeta[c.id]?.pinned);
    return [...pinned, ...unpinned, ...archived];
  }, [conversations, convMeta]);

  const scopeLabel = selectedFolder?.name ?? FOLDER_SCOPE.label;

  useEffect(() => {
    const refreshFolders = () => setLocalFolders(readLocalFolders());
    window.addEventListener('storage', refreshFolders);
    return () => window.removeEventListener('storage', refreshFolders);
  }, []);

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
  const thinkingStageStartedAt = useRef(0);
  useEffect(() => {
    if (!sending) { setThinkingStage(null); return; }
    const stages: ThinkingStage[] = ['initializing', 'thinking', 'evaluating'];
    let i = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      if (i >= stages.length - 1) return;
      timeout = setTimeout(() => {
        i += 1;
        thinkingStageStartedAt.current = Date.now();
        setThinkingStage(stages[i]);
        advance();
      }, 900);
    };
    thinkingStageStartedAt.current = Date.now();
    setThinkingStage(stages[0]);
    advance();
    return () => { if (timeout) clearTimeout(timeout); };
  }, [sending]);
  useEffect(() => {
    if (!streaming || thinkingStage === 'displaying') return;
    const wait = Math.max(0, 400 - (Date.now() - thinkingStageStartedAt.current));
    const timeout = setTimeout(() => {
      thinkingStageStartedAt.current = Date.now();
      setThinkingStage('displaying');
    }, wait);
    return () => clearTimeout(timeout);
  }, [streaming, thinkingStage]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── palette action: "New Chat with Tutor" from ⌘K ── */
  useEffect(() => {
    const handler = () => {
      setMode('tutor');
      setActiveId(null);
      setMessages([]);
      setStreaming('');
      setAttached(null);
      setInput('');
      // Focus the textarea after the view settles
      setTimeout(() => textareaRef.current?.focus(), 120);
    };
    window.addEventListener('notez:new-chat-tutor', handler);
    return () => window.removeEventListener('notez:new-chat-tutor', handler);
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

  // "New chat" — just clears the active conversation instead of creating a blank DB row
  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setStreaming('');
    setAttached(null);
    setInput('');
  }

  async function deleteConv(id: string) {
    await deleteConversation(id);
    const newMeta = { ...convMeta };
    delete newMeta[id];
    setConvMeta(newMeta);
    saveMeta(newMeta);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
    setMenuOpenId(null);
  }

  function togglePin(id: string) {
    const updated = { ...convMeta, [id]: { ...convMeta[id], pinned: !convMeta[id]?.pinned } };
    setConvMeta(updated); saveMeta(updated); setMenuOpenId(null);
  }

  function toggleArchive(id: string) {
    const updated = { ...convMeta, [id]: { ...convMeta[id], archived: !convMeta[id]?.archived } };
    setConvMeta(updated); saveMeta(updated);
    if (convMeta[id]?.archived === false || !convMeta[id]?.archived) {
      // archiving — deselect if active
      if (activeId === id) { setActiveId(null); setMessages([]); }
    }
    setMenuOpenId(null);
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
    setInput(''); setSending(true); setStreaming(''); setShowSuggestions(false);
    try {
      let convId = activeId;
      if (!convId) {
        const prefix = `[${FOLDER_SCOPE.label}] `;
        const data = await createConversation(user.id, mode, prefix + msg.slice(0, 60), attached?.id);
        convId = data.id; setActiveId(convId); setConversations(prev => [data, ...prev]);
      } else {
        await updateConversation(convId, { mode, source_id: attached?.id ?? null });
      }
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: msg, created_at: new Date().toISOString() }]);

      // ── Prompt 14: inject real folder note content as scope ──────────────
      let folderContext = '';
      if (selectedFolder) {
        try {
          const raw = localStorage.getItem('notez_folders');
          if (raw) {
            const allFolders: any[] = JSON.parse(raw);
            const match = allFolders.find((f: any) => f.id === selectedFolder.id);
            if (match) {
              const noteTexts: string[] = [];
              let charCount = 0;
              const BUDGET = 11000;
              outer: for (const cat of (match.categories || [])) {
                for (const note of (cat.notes || [])) {
                  const chunk = `### ${note.title}\n${note.content || ''}`;
                  if (charCount + chunk.length > BUDGET) break outer;
                  noteTexts.push(chunk);
                  charCount += chunk.length;
                }
              }
              if (noteTexts.length > 0) {
                folderContext = `\n\n[FOLDER CONTENT — ${selectedFolder.name}]:\n${noteTexts.join('\n\n')}`;
              }
            }
          }
        } catch { /* fall through — folder name only */ }
      }

      const scopeHint = folderContext
        ? `\n\n[CONTEXT SCOPE: Folder — ${selectedFolder?.name}]${folderContext}`
        : `\n\n[CONTEXT SCOPE: ${selectedFolder ? `Folder: ${selectedFolder.name}` : FOLDER_SCOPE.label} — ${FOLDER_SCOPE.desc}.]`;

      // ── Prompt 14: Tutor-mode weak-spot memory from recent exam results ──
      let weakSpotHint = '';
      if (mode === 'tutor' && user) {
        try {
          const { data: recentExams } = await supabase
            .from('exam_results')
            .select('subject, score, total_questions, questions, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentExams && recentExams.length > 0) {
            // Filter to subject-relevant exams when a folder is selected
            const relevant = selectedFolder
              ? recentExams.filter((e: any) =>
                  e.subject?.toLowerCase().includes(selectedFolder.name.toLowerCase()) ||
                  selectedFolder.name.toLowerCase().includes((e.subject ?? '').toLowerCase())
                )
              : recentExams;

            const weakTopics: string[] = [];
            for (const exam of relevant.slice(0, 3)) {
              const pct = exam.total_questions > 0
                ? Math.round((exam.score / exam.total_questions) * 100)
                : 100;
              if (pct < 70 && Array.isArray(exam.questions)) {
                // Extract questions the student got wrong
                exam.questions
                  .filter((q: any) => q.selectedIndex !== undefined && q.selectedIndex !== q.correctIndex)
                  .slice(0, 3)
                  .forEach((q: any) => {
                    if (q.question) weakTopics.push(q.question.slice(0, 120));
                  });
              }
            }

            if (weakTopics.length > 0) {
              weakSpotHint = `\n\n[TUTOR NOTE — known weak areas from recent exams]:\n${weakTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nAddress these proactively if relevant to the student's question.`;
            }
          }
        } catch { /* fail silently — never break chat */ }
      }
      // ─────────────────────────────────────────────────────────────────────

      const token = await getStreamingToken();
      if (!token) throw new Error('Not authenticated — please sign in again.');
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: convId, message: msg + scopeHint + weakSpotHint, mode, sourceId: attached?.status === 'ready' ? attached.id : null, scope: 'folder' }),
      });
      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        // Try to parse as structured JSON error (e.g. USAGE_LIMIT_REACHED)
        try {
          const errJson = JSON.parse(errText);
          throw errJson; // throw the object — parseLimitError will handle it
        } catch (parseErr) {
          // Not JSON — throw as plain message
          if (typeof parseErr === 'object' && parseErr !== null && 'error' in (parseErr as object)) throw parseErr;
          throw new Error(`${resp.status}: ${errText || 'Stream failed'}`);
        }
      }
      const reader = resp.body.getReader(); const decoder = new TextDecoder(); let acc = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; acc += decoder.decode(value, { stream: true }); setStreaming(acc); }
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: acc, created_at: new Date().toISOString() }]);
      setStreaming(''); loadConversations();
    } catch (e: any) {
      console.error('Chat send error:', e);
      // Check for usage limit before showing generic error
      const limitErr = parseLimitError(e);
      if (limitErr) {
        handleLimitError(limitErr.field, limitErr.limit);
      } else {
        toast({ title: 'Chat error', description: e?.message || e?.error || 'The AI service is unavailable.', variant: 'destructive' });
      }
      setStreaming('');
    } finally { setSending(false); }
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function pickSuggestion(s: string) { setInput(s); setShowSuggestions(false); textareaRef.current?.focus(); }
  function pickCard(task: QuickTask) { setInput(task.prompt); textareaRef.current?.focus(); }

  /* ─── render ─── */
  return (
    <>
      <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] flex gap-3 min-w-0">

      {/* ══ Sidebar — conversations list only ══ */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-border bg-secondary overflow-hidden min-w-0">
        {/* New chat button */}
        <div className="p-2.5 border-b border-border">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-secondary hover:bg-secondary text-[13px] font-medium text-foreground transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4 text-foreground" /> New chat
          </button>
        </div>

        {/* Full conversation history */}
        <ScrollArea className="flex-1">
          <div ref={menuRef} className="p-2 space-y-0.5">
            {sortedConversations.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-3 text-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground opacity-60" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">No conversations yet. Start a new chat.</p>
              </div>
            )}
            {sortedConversations.map(c => {
              const meta = convMeta[c.id] ?? {};
              const isMenuOpen = menuOpenId === c.id;
              return (
                <div key={c.id} className="relative">
                  <div
                    onClick={() => { if (!isMenuOpen) { setActiveId(c.id); } }}
                    className={`group flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                      activeId === c.id
                        ? 'bg-secondary text-foreground'
                        : meta.archived
                        ? 'text-muted-foreground hover:bg-secondary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {/* pin indicator */}
                    {meta.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-foreground" />}
                    {meta.archived && !meta.pinned && <Archive className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
                    {!meta.pinned && !meta.archived && <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate leading-snug max-w-[120px]" title={c.title}>{c.title}</p>
                      <p className="text-[9px] font-mono text-muted-foreground mt-0.5 capitalize">{c.mode || 'tutor'}</p>
                    </div>

                    {/* ··· menu trigger */}
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : c.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-secondary"
                    >
                      <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Context menu */}
                  <AnimatePresence>
                    {isMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.1 }}
                        className="absolute left-0 top-full mt-0.5 z-50 w-44 rounded-xl border border-border bg-secondary shadow-xl overflow-hidden"
                      >
                        <button onClick={() => togglePin(c.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-foreground hover:bg-secondary transition-colors"
                        >
                          {meta.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          {meta.pinned ? 'Unpin' : 'Pin to top'}
                        </button>
                        <button onClick={() => toggleArchive(c.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-foreground hover:bg-secondary transition-colors"
                        >
                          {meta.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          {meta.archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <div className="border-t border-border" />
                        <button onClick={() => deleteConv(c.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* ══ Main panel ══ */}
      <div className="flex-1 flex w-full min-w-0 flex-col rounded-2xl border border-border bg-secondary overflow-hidden">

        {/* ── Top bar — scope picker + attachment ── */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 border-b border-border min-h-[48px] flex-wrap">
          {/* Mobile: conversations history sheet */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary text-[12px] text-foreground transition-colors">
                  <History className="h-3.5 w-3.5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-card border-border flex flex-col overflow-hidden">
                <div className="p-2.5 border-b border-border">
                  <button onClick={() => { newConversation(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-secondary hover:bg-secondary text-[13px] font-medium text-foreground transition-colors"
                  >
                    <MessageSquarePlus className="h-4 w-4 text-foreground" /> New chat
                  </button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-0.5">
                    {sortedConversations.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-10 px-3 text-center">
                        <MessageSquare className="h-7 w-7 text-muted-foreground opacity-60" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">No conversations yet. Start a new chat.</p>
                      </div>
                    )}
                    {sortedConversations.map(c => {
                      const meta = convMeta[c.id] ?? {};
                      return (
                        <div key={c.id}
                          onClick={() => setActiveId(c.id)}
                          className={`flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                            activeId === c.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          {meta.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-foreground" />}
                          {meta.archived && !meta.pinned && <Archive className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
                          {!meta.pinned && !meta.archived && <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] truncate leading-snug" title={c.title}>{c.title}</p>
                            <p className="text-[9px] font-mono text-muted-foreground mt-0.5 capitalize">{c.mode || 'tutor'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
          {/* Scope picker */}
          <div ref={scopeRef} className="relative">
            <button onClick={() => setScopeOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary text-[12px] font-medium text-foreground transition-colors"
            >
              <Folder className="h-3.5 w-3.5 text-foreground" />
              <span className="max-w-[120px] truncate">{scopeLabel}</span>
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {scopeOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.13 }}
                  className="absolute top-full mt-2 left-0 z-50 w-64 rounded-2xl border border-border bg-secondary shadow-2xl overflow-hidden"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-[12px] font-medium text-foreground">Ask this Folder</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Choose a folder from this workspace for context.</p>
                  </div>
                  {localFolders.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-4 py-3">No folders yet — create one in Folders.</p>
                  ) : (
                    <div className="py-1.5">
                      {localFolders.map(f => (
                        <button key={f.id}
                          onClick={() => { setSelectedFolderId(f.id); setScopeOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${selectedFolderId === f.id ? 'bg-secondary' : ''}`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                          <span className="text-[11px] text-foreground truncate flex-1">{f.name}</span>
                          {selectedFolderId === f.id && <CheckCircle2 className="h-3 w-3 text-foreground shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active mode badge — monochrome */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-[11px] text-muted-foreground">
            <activeMode.icon className="h-3.5 w-3.5 text-foreground" />
            <span className="font-medium text-foreground">{activeMode.label}</span>
          </div>

          {/* Attachment chip */}
          <AnimatePresence>
            {attached && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-[11px] max-w-[220px]"
              >
                {attached.status === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />
                  : attached.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground shrink-0" />}
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground">{attached.title}</span>
                <button onClick={() => setAttached(null)} className="ml-1 p-0.5 rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
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
                className="h-full flex flex-col items-center justify-center px-3 sm:px-6 py-3 overflow-y-auto"
              >
                {/* Orb */}
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                  className="relative w-10 h-10 mb-3 shrink-0"
                >
                  <div className="absolute inset-0 rounded-xl bg-secondary border border-border" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                      <circle cx="9"  cy="9"  r="3.2" fill="hsl(var(--foreground))" />
                      <circle cx="19" cy="9"  r="3.2" fill="hsl(var(--foreground))" />
                      <circle cx="9"  cy="19" r="3.2" fill="hsl(var(--foreground))" />
                      <circle cx="19" cy="19" r="3.2" fill="hsl(var(--foreground))" />
                      <circle cx="14" cy="14" r="2.2" fill="hsl(var(--foreground))" opacity="0.6" />
                    </svg>
                  </div>
                </motion.div>

                {/* Headline */}
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="text-xl md:text-2xl font-bold text-center mb-1.5 tracking-tight shrink-0 text-foreground"
                >
                  How can we <span className="text-foreground italic">assist</span> you today?
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
                  className="text-[11px] text-muted-foreground text-center max-w-md mb-4 leading-relaxed shrink-0"
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
                      whileHover={{ y: -2, boxShadow: '0 6px 24px hsl(var(--foreground) / 0.55)' }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => pickCard(card)}
                      className={`group text-left p-3 rounded-xl border border-l-2 ${card.accent} border-border bg-secondary hover:border-border hover:bg-secondary transition-all`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                          <card.icon className="text-foreground" style={{ width: 14, height: 14 }} />
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <p className="text-[12px] font-semibold text-foreground leading-snug mb-1">{card.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{card.desc}</p>
                    </motion.button>
                  ))}
                </motion.div>

                {/* ── AI Modes row ── */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                  className="w-full max-w-3xl shrink-0"
                >
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2 text-center">AI Modes</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {MODES.map((m, i) => (
                      <motion.button key={m.id}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.34 + i * 0.04 }}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setMode(m.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                          mode === m.id
                            ? 'border-border bg-secondary text-foreground'
                            : 'border-border bg-secondary text-muted-foreground hover:border-border hover:bg-secondary'
                        }`}
                      >
                        <m.icon className="h-3.5 w-3.5 shrink-0 text-foreground" />
                        <span>{m.label}</span>
                        {mode === m.id && <span className="w-1 h-1 rounded-full shrink-0 bg-[hsl(var(--foreground))]" />}
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
        <div className="px-3 pb-3 pt-2 border-t border-border bg-secondary shrink-0">
          <div ref={composerRef} className="max-w-3xl mx-auto relative">

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-border bg-secondary shadow-2xl overflow-hidden z-50"
                >
                  <div className="px-3 pt-2 pb-0.5 border-b border-border">
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Suggestions</p>
                  </div>
                  {filteredSuggestions.map((s, i) => (
                    <motion.button key={s}
                      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                      onMouseDown={() => pickSuggestion(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary transition-colors group"
                    >
                      <Search className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground flex-1 transition-colors">{s}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input bar — single row ── */}
            <motion.div
              animate={inputFocused
                ? { scale: 1.008, boxShadow: '0 0 0 1.5px hsl(var(--foreground) / 0.2), 0 0 28px hsl(var(--foreground) / 0.05)' }
                : { scale: 1, boxShadow: '0 0 0 1px hsl(var(--border))' }
              }
              transition={{ duration: 0.2 }}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary"
            >
              {/* Focus top-line */}
              <AnimatePresence>
                {inputFocused && (
                  <motion.div
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                    transition={{ duration: 0.28 }}
                    className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(var(--foreground)/0.4)] to-transparent origin-left pointer-events-none rounded-t-xl"
                  />
                )}
              </AnimatePresence>

              {/* + Attach button */}
              <input ref={fileRef} type="file" className="hidden" accept={ACCEPT} onChange={e => handleFiles(e.target.files)} />
              <motion.button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-secondary text-foreground hover:text-[hsl(var(--foreground))] hover:border-border hover:bg-secondary transition-all"
                aria-label="Attach file — PDF, Word, PPT, PNG, JPEG"
                title="Attach — PDF · Word · PPT · PNG · JPEG"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </motion.button>

              {/* Attached chip — inline */}
              <AnimatePresence>
                {attached && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-secondary text-[10px] max-w-[130px] shrink-0"
                  >
                    {attached.status === 'ready' ? <CheckCircle2 className="h-3 w-3 text-foreground shrink-0" />
                      : attached.status === 'failed' ? <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                      : <Loader2 className="h-3 w-3 animate-spin text-foreground shrink-0" />}
                    <span className="truncate text-muted-foreground">{attached.title}</span>
                    <button onClick={() => setAttached(null)} className="hover:text-destructive p-0.5 rounded"><X className="h-2.5 w-2.5" /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea + typewriter overlay */}
              <div className="relative flex-1 min-w-0 flex items-center">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    setSuggFilter(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={onKey}
                  onFocus={() => { setInputFocused(true); setShowSuggestions(true); }}
                  onBlur={() => setInputFocused(false)}
                  rows={1}
                  className="w-full bg-transparent text-[13px] text-foreground placeholder-transparent resize-none focus:outline-none leading-relaxed py-1"
                />

                {/* Typewriter ghost — only show when not focused AND no input */}
                {!input && !inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[13px] text-muted-foreground">
                    <span>{typewriterText}</span>
                    <span className="inline-block w-[1.5px] h-[13px] bg-[hsl(var(--muted-foreground))] ml-[2px] align-middle animate-pulse" />
                  </div>
                )}
                {!input && inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[13px] text-muted-foreground">
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
                    ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--accent-foreground))] shadow-[0_1px_10px_hsl(var(--foreground)/0.25)]'
                    : 'bg-secondary text-muted-foreground cursor-not-allowed'
                }`}
              >
                {sending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><span>Send</span><ArrowRight className="h-3 w-3" /></>
                }
              </motion.button>
            </motion.div>

            <p className="text-[9px] text-muted-foreground text-center mt-1.5 select-none hidden sm:block">
              ↵ send · Shift+↵ newline · attach PDF · Word · PPT · PNG · JPEG
            </p>
          </div>
        </div>

      </div>{/* end main panel */}
    </div>

    {/* Upgrade modal — fires when any AI call returns USAGE_LIMIT_REACHED */}
    <UpgradeModal
      open={upgradeModal.open}
      field={upgradeModal.field}
      limit={upgradeModal.limit}
      onClose={closeUpgradeModal}
    />
    </>
  );
}

/* ─────────────────────── ThinkingIndicator ─────────────────── */
function ThinkingIndicator({ stage }: { stage: ThinkingStage }) {
  if (!stage) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-center gap-2 py-1"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary">
        {THINKING_STAGES.map((s, i) => {
          const isActive = s.stage === stage;
          const isPast   = THINKING_STAGES.findIndex(x => x.stage === stage) > i;
          return (
            <motion.div key={String(s.stage)}
              animate={isActive ? { scale: [1, 1.25, 1] } : {}}
              transition={{ duration: 0.7, repeat: isActive ? Infinity : 0 }}
              className="flex items-center gap-1"
            >
              <s.icon className={`h-3.5 w-3.5 transition-colors ${isPast ? 'text-[hsl(var(--notez-success))]' : isActive ? s.color : 'text-muted-foreground'}`} />
              {isActive && <span className={`text-[10px] font-mono ${s.color}`}>{s.label}</span>}
            </motion.div>
          );
        })}
        <div className="flex gap-0.5 ml-1">
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }}
              className="w-1 h-1 rounded-full bg-[hsl(var(--muted-foreground))]"
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
      tabIndex={0}
      className={`group relative flex outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {isUser ? (
        <div className="max-w-[82%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[13px] bg-secondary border border-border text-foreground">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      ) : sections.hasStructure ? (
        <div className="max-w-[88%] space-y-2">
          {sections.answer && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl rounded-bl-sm px-4 py-3 bg-secondary border border-border"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-foreground" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-foreground">Answer</span>
              </div>
              <Markdown text={sections.answer + (streaming && !sections.material && !sections.nextActions ? ' ▍' : '')} />
            </motion.div>
          )}
          {sections.material && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-xl px-4 py-3 bg-secondary border border-border"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-foreground" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-foreground">Material Used</span>
              </div>
              <Markdown text={sections.material + (streaming && !sections.nextActions ? ' ▍' : '')} />
            </motion.div>
          )}
          {sections.nextActions && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-xl px-4 py-3 bg-secondary border border-border"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowRight className="h-3.5 w-3.5 text-foreground" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-foreground">Next Actions</span>
              </div>
              <Markdown text={sections.nextActions + (streaming ? ' ▍' : '')} />
            </motion.div>
          )}
          {!sections.answer && sections.raw && (
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-secondary border border-border">
              <Markdown text={sections.raw + (streaming ? ' ▍' : '')} />
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 bg-secondary border border-border">
          <Markdown text={message.content + (streaming ? ' ▍' : '')} />
        </div>
      )}
      {message.created_at && (
        <span className={`pointer-events-none absolute bottom-0 text-[10px] font-mono text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${isUser ? 'right-full mr-2' : 'left-full ml-2'}`}>
          {format(new Date(message.created_at), 'h:mm a')}
        </span>
      )}
    </motion.div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose max-w-none text-[13px] prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1 prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-code:text-[hsl(var(--foreground))]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
