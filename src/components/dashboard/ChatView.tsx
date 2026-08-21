import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  createConversation, updateConversation,
  uploadChatFile, createSourceRecord, invokeProcessSource,
  getStreamingToken, subscribeToSourceUpdates,
  type ChatMessage, type AttachedSource,
} from '@/services';
import { toast } from '@/hooks/use-toast';
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { format } from 'date-fns';
import { htmlToPlainText } from './note-utils';
import {
  Sparkles, GraduationCap, FlaskConical, ScrollText,
  Loader2, Plus, FileText, X, BarChart3, HeartHandshake,
  CheckCircle2, AlertCircle, BookOpen, Folder, ClipboardCheck,
  Brain, Layers, ArrowRight, ChevronDown, ArrowUpRight,
  Search, Terminal, Code2, Compass, Check,
} from 'lucide-react';

/* ─── types ─── */
type Mode          = 'researcher' | 'summarizer' | 'analyst' | 'mentor' | 'tutor';
type ThinkingStage = 'initializing' | 'thinking' | 'evaluating' | 'displaying' | null;
type ThinkingLevel = 'low' | 'high' | 'max';

const THINKING_LEVELS: { id: ThinkingLevel; label: string; desc: string }[] = [
  { id: 'low',  label: 'Low',  desc: 'Fast & direct response' },
  { id: 'high', label: 'High', desc: 'Deep reasoning (Recommended)' },
  { id: 'max',  label: 'Max',  desc: 'Maximum intelligence & detail' },
];

interface QuickTask { id: string; label: string; icon: any; desc: string; prompt: string; accent: string }
interface LocalNote { id: string; title: string; content: string }
interface LocalFolder { id: string; name: string; color: string; notes: LocalNote[] }

/* ─── constants ─── */
const MODES: { id: Mode; label: string; icon: any; tag: string }[] = [
  { id: 'tutor',      label: 'Tutor',     icon: GraduationCap,  tag: 'Explain & teach clearly'      },
  { id: 'researcher', label: 'Research',  icon: FlaskConical,   tag: 'Deep analysis & evidence'     },
  { id: 'summarizer', label: 'Summarize', icon: ScrollText,     tag: 'TL;DR & key bullets'          },
  { id: 'analyst',    label: 'Analyst',   icon: BarChart3,      tag: 'Trade-offs, risks, decisions' },
  { id: 'mentor',     label: 'Mentor',    icon: HeartHandshake, tag: 'Coach & encourage growth'     },
];

const FOLDER_SCOPE = { label: 'Ask this Folder', desc: 'Context from your notes' };

const AGENT_CARDS: QuickTask[] = [
  { id: 'explain',    label: 'Explain Simpler',          icon: BookOpen,       desc: 'Break down complex topics with analogies.',             prompt: 'Explain this concept in simpler language with an analogy I can relate to.', accent: 'border-l-notez-violet' },
  { id: 'summarize',  label: 'Summarize Folder / Notes', icon: Folder,         desc: 'Condense folders or individual notes into clear structured summaries.', prompt: 'Summarize the key points from my notes in bullet points.', accent: 'border-l-notez-indigo' },
  { id: 'flashcards', label: 'Generate Flashcards',      icon: Layers,         desc: 'Turn your notes into Q&A flashcard pairs instantly.',   prompt: 'Generate 10 flashcard Q&A pairs from my notes on this topic.', accent: 'border-l-notez-success' },
  { id: 'studyplan',  label: 'Study Plan from Quiz',     icon: ClipboardCheck, desc: 'Convert weak quiz answers into an actionable roadmap.', prompt: 'Based on my weak quiz answers, generate a focused study plan with specific actions.', accent: 'border-l-notez-warning' },
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

/* ─── NoteZ Brand Spark Icon ─── */
function NoteZBrandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <circle cx="9"  cy="9"  r="3.2" fill="currentColor" />
      <circle cx="19" cy="9"  r="3.2" fill="currentColor" />
      <circle cx="9"  cy="19" r="3.2" fill="currentColor" />
      <circle cx="19" cy="19" r="3.2" fill="currentColor" />
      <circle cx="14" cy="14" r="2.2" fill="hsl(var(--primary))" />
    </svg>
  );
}

/* ─── helpers ─── */
function isSimpleMessage(msg: string): boolean {
  const simple = /^(h(i|ello|ey|owdy)|yo|sup|thanks|thank you|ok|okay|yes|no|cool|nice|great|good|bye|goodbye|morning|evening|night|what'?s up|how are you)[!?.\s]*$/i;
  return simple.test(msg.trim()) || msg.trim().length < 12;
}

/* ─── main component ─── */
export default function ChatView() {
  const { user } = useAuth();
  const { upgradeModal, closeUpgradeModal } = useUpgradeModal();
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]         = useState('');
  const [sending, setSending]             = useState(false);
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>(null);
  const [input, setInput]                 = useState('');
  const [mode, setMode]                   = useState<Mode>('tutor');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('high');
  const [thinkingOpen, setThinkingOpen]   = useState(false);
  const [selectedFolderId, setSelectedFolderId]   = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId]       = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [scopeOpen, setScopeOpen]         = useState(false);
  const [attached, setAttached]           = useState<AttachedSource | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [inputFocused, setInputFocused]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggFilter, setSuggFilter]       = useState('');
  const [lastSentMsg, setLastSentMsg]     = useState('');

  function readLocalFolders(): LocalFolder[] {
    try {
      const raw = localStorage.getItem('notez_folders');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.map((f: any) => {
        const allNotes: LocalNote[] = [];
        if (Array.isArray(f.categories)) {
          for (const cat of f.categories) {
            if (Array.isArray(cat.notes)) {
              for (const n of cat.notes) {
                allNotes.push({
                  id: n.id,
                  title: n.title || 'Untitled Note',
                  content: n.content || '',
                });
              }
            }
          }
        }
        return {
          id: f.id,
          name: f.name,
          color: f.color || '#8B5CF6',
          notes: allNotes,
        };
      });
    } catch { return []; }
  }

  const [localFolders, setLocalFolders] = useState<LocalFolder[]>(readLocalFolders);
  const selectedFolder = localFolders.find(f => f.id === selectedFolderId) ?? null;
  const selectedNote = selectedFolder?.notes.find(n => n.id === selectedNoteId) ?? null;

  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scopeRef    = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_HINTS);
  const activeMode  = MODES.find(m => m.id === mode)!;
  const inChat      = messages.length > 0 || !!streaming;
  const filteredSuggestions = SUGGESTIONS.filter(s => s.toLowerCase().includes(suggFilter.toLowerCase())).slice(0, 6);
  const scopeLabel  = selectedNote
    ? `${selectedFolder?.name} / ${selectedNote.title}`
    : (selectedFolder?.name ?? 'Ask this Folder / Note');

  useEffect(() => {
    const refreshFolders = () => setLocalFolders(readLocalFolders());
    window.addEventListener('storage', refreshFolders);
    window.addEventListener('notez:folders-updated', refreshFolders);
    return () => {
      window.removeEventListener('storage', refreshFolders);
      window.removeEventListener('notez:folders-updated', refreshFolders);
    };
  }, []);

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
    const simple = isSimpleMessage(lastSentMsg);
    // Simple messages: skip straight to a single quick "thinking" stage
    if (simple) {
      thinkingStageStartedAt.current = Date.now();
      setThinkingStage('thinking');
      return;
    }
    // Complex messages: full step-by-step pipeline
    const stages: ThinkingStage[] = ['initializing', 'thinking', 'evaluating', 'displaying'];
    let i = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      if (i >= stages.length - 1) return;
      timeout = setTimeout(() => {
        i += 1;
        thinkingStageStartedAt.current = Date.now();
        setThinkingStage(stages[i]);
        advance();
      }, 1200);
    };
    thinkingStageStartedAt.current = Date.now();
    setThinkingStage(stages[0]);
    advance();
    return () => { if (timeout) clearTimeout(timeout); };
  }, [sending, lastSentMsg]);

  useEffect(() => {
    if (!streaming || thinkingStage === 'displaying') return;
    const wait = Math.max(0, 300 - (Date.now() - thinkingStageStartedAt.current));
    const timeout = setTimeout(() => {
      thinkingStageStartedAt.current = Date.now();
      setThinkingStage('displaying');
    }, wait);
    return () => clearTimeout(timeout);
  }, [streaming, thinkingStage]);

  // Click outside handling for all popups
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
      if (thinkingRef.current && !thinkingRef.current.contains(e.target as Node)) setThinkingOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleFolderExpanded(folderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  /* ── "New Chat" resets all messages and state ── */
  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setStreaming('');
    setAttached(null);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    const file = files[0];

    // Validate file type
    if (!ACCEPT_RE.test(file.name)) {
      toast({ title: 'Unsupported file type', description: 'Only PDF, Word (.doc, .docx), PowerPoint (.pptx), PNG, and JPEG files are supported.', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: `Max file size is 20MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`, variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    // Validate file not empty
    if (file.size === 0) {
      toast({ title: 'Empty file', description: 'The selected file is empty. Please choose a valid file.', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // Paid feature gate — show upgrade modal
    toast({
      title: '📎 Attachments — Premium Feature',
      description: 'File attachments are available on the Pro plan. Upgrade to unlock this feature.',
      variant: 'default',
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send(overrideMsg?: string) {
    const msg = (overrideMsg ?? input).trim();
    if (!msg || !user || sending) return;
    setLastSentMsg(msg);
    setInput(''); setSending(true); setStreaming(''); setShowSuggestions(false);

    try {
      let convId = activeId;
      if (!convId) {
        const prefix = selectedNote
          ? `[Note: ${selectedNote.title}] `
          : selectedFolder
          ? `[Folder: ${selectedFolder.name}] `
          : '';
        const data = await createConversation(user.id, mode, prefix + msg.slice(0, 60), attached?.id);
        convId = data.id;
        setActiveId(convId);
      } else {
        await updateConversation(convId, { mode, source_id: attached?.id ?? null });
      }

      const userMsgObj: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: msg, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, userMsgObj]);

      // Save user message to Supabase DB
      try {
        await supabase.from('chat_messages').insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'user',
          content: msg,
        });
      } catch (err) {
        console.error('Failed to save user message to DB:', err);
      }

      let folderContext = '';
      if (selectedFolder) {
        if (selectedNote) {
          const plainText = htmlToPlainText(selectedNote.content);
          folderContext = `\n\n[ATTACHED NOTE CONTENT — "${selectedNote.title}" in Folder "${selectedFolder.name}"]:\n${plainText || '(Note content is empty)'}\n\n[INSTRUCTION: The user has attached the note above. Fulfill their request (summarize, explain, answer questions) directly using this content. DO NOT ask the user to upload or paste notes.]`;
        } else {
          const noteTexts: string[] = [];
          let charCount = 0;
          const BUDGET = 14000;
          for (const note of selectedFolder.notes) {
            const plainText = htmlToPlainText(note.content);
            const chunk = `### Note: ${note.title}\n${plainText || '(Empty note)'}`;
            if (charCount + chunk.length > BUDGET) break;
            noteTexts.push(chunk);
            charCount += chunk.length;
          }
          if (noteTexts.length > 0) {
            folderContext = `\n\n[ATTACHED FOLDER CONTENT — "${selectedFolder.name}" (${selectedFolder.notes.length} notes)]:\n${noteTexts.join('\n\n')}\n\n[INSTRUCTION: The user has attached their notes from folder "${selectedFolder.name}" above. Fulfill their request directly using these notes. DO NOT ask the user to upload or paste notes.]`;
          } else {
            folderContext = `\n\n[ATTACHED FOLDER — "${selectedFolder.name}" (No notes stored in this folder yet)]`;
          }
        }
      }

      const scopeTitle = selectedNote
        ? `Note: ${selectedNote.title} (Folder: ${selectedFolder?.name})`
        : selectedFolder
        ? `Folder: ${selectedFolder.name}`
        : 'general';

      const scopeHint = folderContext
        ? `\n\n[CONTEXT SCOPE: ${scopeTitle}]${folderContext}`
        : '';

      const token = await getStreamingToken();
      let streamSuccess = false;

      // ── Edge Function call with SSE streaming ──
      if (token) {
        try {
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              conversationId: convId,
              message: msg + scopeHint,
              mode,
              sourceId: attached?.status === 'ready' ? attached.id : null,
              scope: scopeTitle,
            }),
          });

          if (resp.ok && resp.body) {
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let acc = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              acc += decoder.decode(value, { stream: true });
              setStreaming(acc);
            }
            if (acc.trim()) {
              setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: acc, created_at: new Date().toISOString() }]);
              setStreaming('');
              streamSuccess = true;
            }
          }
        } catch {
          /* Edge function failed — proceed to Gemini direct proxy fallback */
        }
      }

      // ── Direct Gemini Fallback (/api/ai-chat-proxy & direct API) ──
      if (!streamSuccess) {
        const systemPrompt = `You are NoteZ AI, an advanced, intelligent academic tutor and study assistant.
Mode: ${mode}. Thinking level: ${thinkingLevel}.

CRITICAL INSTRUCTIONS FOR FORMATTING, STRUCTURE & RELEVANCE:
- FORMATTING & LAYOUT (Crucial):
  * For study guides, explanations, and summaries, always use structured Markdown with clear hierarchy:
    - Main numbered section headers: "### 1. Section Title", "### 2. Section Title"
    - Bullet points with bold lead-ins for key points: "- **Key Concept / Term:** Clear, detailed explanation."
    - Highlight key terms with bold text (\`**term**\`) for scannability.
    - For summaries, include an initial overview sentence/paragraph, structured sections with bullets, and a final summary callout:
      "> **In one sentence / Key Takeaway:** Core summary here."
    - Ensure clean blank lines between headers, paragraphs, and lists so text never looks cramped or plain.
- GREETINGS & CASUAL CHAT: If the user says "hello", "hi", "hey", or casual greetings, respond naturally and warmly in ONE OR TWO short sentences (e.g., "Hello! How can I help you with your studies or notes today?"). DO NOT output long unprompted introductions or essays.
- DIRECT ANSWERS: Answer questions directly without generic opening filler ("Sure, I can help with that", "Hello, I am NoteZ AI").
- DIRECT CITATION: When study context, folders, or notes are provided in the prompt, base your responses directly on them. DO NOT tell the user to upload or paste notes.`;

        // Format conversational turns so follow-ups work naturally
        const turns = messages.slice(-8).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

        const currentTurn = {
          role: 'user',
          parts: [{ text: msg + scopeHint }],
        };

        const payload = {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [...turns, currentTurn],
          generationConfig: {
            temperature: thinkingLevel === 'low' ? 0.3 : thinkingLevel === 'high' ? 0.7 : 0.9,
          },
        };

        let rawText = '';
        let fallbackOk = false;

        // 1. Try Vite proxy endpoint first
        try {
          const fallbackRes = await fetch('/api/ai-chat-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawText) fallbackOk = true;
          }
        } catch {
          /* proxy call failed */
        }

        // 2. Direct fetch to Gemini API as secondary fallback
        if (!fallbackOk) {
          const chatApiKey = import.meta.env.VITE_GEMINI_CHAT_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
          if (chatApiKey) {
            const directRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${chatApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }
            );

            if (directRes.ok) {
              const data = await directRes.json();
              rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (rawText) fallbackOk = true;
            }
          }
        }

        if (fallbackOk && rawText) {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: rawText, created_at: new Date().toISOString() }]);
          // Save assistant message to DB
          try {
            await supabase.from('chat_messages').insert({
              conversation_id: convId,
              user_id: user.id,
              role: 'assistant',
              content: rawText,
            });
          } catch { /* silent */ }
        }
      }
    } catch (e: any) {
      toast({ title: 'Error sending message', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setStreaming('');
      setThinkingStage(null);
    }
  }

  /* ── Clicking quick cards populates the input without auto-sending ── */
  function pickCard(c: QuickTask) {
    let promptText = c.prompt;
    if (c.id === 'summarize' && selectedFolder) {
      if (selectedNote) {
        promptText = `Summarize the key points from my "${selectedNote.title}" note in bullet points.`;
      } else {
        promptText = `Summarize the key points and concepts in my "${selectedFolder.name}" folder.`;
      }
    }
    setInput(promptText);
    setTimeout(() => {
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.selectionStart = promptText.length;
        textareaRef.current.selectionEnd = promptText.length;
      }
    }, 50);
  }

  function pickSuggestion(s: string) {
    setInput(s);
    setShowSuggestions(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /* ─── render ─── */
  return (
    <>
      <div className="h-full flex flex-col w-full min-w-0 bg-background overflow-hidden relative">

        {/* ── Top Bar — Clean, focused Header ── */}
        <header className="min-h-[52px] px-3 sm:px-5 lg:px-6 border-b border-border/60 flex items-center justify-between gap-2 bg-card/40 backdrop-blur-md shrink-0 z-30 relative w-full mt-0 pt-[env(safe-area-inset-top)]">
          {/* Left controls: Scope (Folder / Specific Note) & Thinking Level */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap shrink min-w-0">

            {/* Scope picker (Folder or Specific Note) */}
            <div ref={scopeRef} className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScopeOpen(o => !o);
                  setThinkingOpen(false);
                }}
                className="flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-border/60 bg-secondary/60 hover:bg-secondary text-[11px] sm:text-[12px] font-medium text-foreground transition-all whitespace-nowrap"
                title="Select study folder or specific note scope"
              >
                {selectedNote ? (
                  <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
                ) : (
                  <Folder className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
                )}
                <span className="max-w-[100px] sm:max-w-[180px] truncate">{scopeLabel}</span>
                <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {scopeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-1.5 left-0 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl p-2.5"
                  >
                    <div className="border-b border-border/70 px-2.5 pb-2 mb-1.5">
                      <p className="text-[12px] font-semibold text-foreground">Ask this Folder or Note</p>
                      <p className="text-[10px] text-muted-foreground">Attach a folder or individual note as study context.</p>
                    </div>
                    <div className="py-1 max-h-72 overflow-y-auto pr-2 space-y-1.5">
                      {/* General Option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedFolderId(null); setSelectedNoteId(null); setScopeOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                          !selectedFolderId && !selectedNoteId ? 'bg-primary/15 border border-primary/25 text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <span className="text-[11.5px] truncate">General (All Notes / Workspace)</span>
                        {!selectedFolderId && !selectedNoteId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>

                      <div className="h-px bg-border/60 my-1" />

                      {/* Folder & Notes List */}
                      {localFolders.length === 0 ? (
                        <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
                          No folders found in your workspace.
                        </div>
                      ) : (
                        localFolders.map(f => {
                          const isFolderSelected = selectedFolderId === f.id && !selectedNoteId;
                          const isFolderExpanded = expandedFolderIds.has(f.id) || selectedFolderId === f.id;
                          const hasNotes = f.notes.length > 0;

                          return (
                            <div key={f.id} className="rounded-xl overflow-hidden border border-border/50 bg-secondary/25 transition-all">
                              {/* Folder Row Header */}
                              <div
                                className={`flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                                  isFolderSelected
                                    ? 'bg-primary/15 text-foreground font-medium'
                                    : 'hover:bg-secondary/60 text-foreground'
                                }`}
                                onClick={() => {
                                  if (hasNotes) {
                                    // Toggle expand if has notes
                                    setExpandedFolderIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(f.id)) next.delete(f.id);
                                      else next.add(f.id);
                                      return next;
                                    });
                                  } else {
                                    setSelectedFolderId(f.id);
                                    setSelectedNoteId(null);
                                    setScopeOpen(false);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                                  <span className="text-[12px] font-medium truncate text-foreground">{f.name}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                    ({f.notes.length} {f.notes.length === 1 ? 'note' : 'notes'})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {/* Button to select entire folder */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFolderId(f.id);
                                      setSelectedNoteId(null);
                                      setScopeOpen(false);
                                    }}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                                      isFolderSelected
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/60'
                                    }`}
                                    title="Select entire folder as context"
                                  >
                                    {isFolderSelected ? 'Selected' : 'All notes'}
                                  </button>

                                  {hasNotes && (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleFolderExpanded(f.id, e)}
                                      className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                      title={isFolderExpanded ? 'Collapse notes' : 'Expand notes'}
                                    >
                                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFolderExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Nested Notes inside Folder */}
                              {hasNotes && isFolderExpanded && (
                                <div className="pl-5 pr-2 pb-1.5 pt-1 space-y-1 bg-background/60 border-t border-border/30">
                                  {f.notes.map(note => {
                                    const isNoteSelected = selectedFolderId === f.id && selectedNoteId === note.id;
                                    return (
                                      <button
                                        key={note.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFolderId(f.id);
                                          setSelectedNoteId(note.id);
                                          setScopeOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                                          isNoteSelected
                                            ? 'bg-primary/20 text-foreground font-semibold border border-primary/35'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <span className="text-[11.5px] truncate">{note.title}</span>
                                        </div>
                                        {isNoteSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Thinking Level Dropdown */}
            <div ref={thinkingRef} className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setThinkingOpen(o => !o);
                  setScopeOpen(false);
                }}
                className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-border/60 bg-secondary/60 hover:bg-secondary text-[11px] sm:text-[12px] font-medium text-foreground transition-all whitespace-nowrap"
                title="Select Intelligence Thinking Level"
              >
                <Brain className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
                <span className="hidden sm:inline text-muted-foreground">Thinking:</span>
                <strong className="capitalize text-foreground font-semibold">{thinkingLevel}</strong>
                <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground transition-transform ${thinkingOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {thinkingOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-1.5 left-0 z-50 w-56 sm:w-60 rounded-xl border border-border bg-card shadow-2xl p-1.5 space-y-0.5"
                  >
                    <div className="px-3 py-1.5 border-b border-border/80 mb-1">
                      <p className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-primary" /> Intelligence Thinking
                      </p>
                      <p className="text-[10px] text-muted-foreground">Select AI reasoning depth</p>
                    </div>
                    {THINKING_LEVELS.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setThinkingLevel(l.id);
                          setThinkingOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                          thinkingLevel === l.id
                            ? 'bg-primary/10 border border-primary/20 text-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <div>
                          <p className="text-[12px] capitalize font-medium text-foreground">{l.label}</p>
                          <p className="text-[10px] text-muted-foreground">{l.desc}</p>
                        </div>
                        {thinkingLevel === l.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: New Chat button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Attachment chip — only show if attached */}
            <AnimatePresence>
              {attached && (
                <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="hidden sm:flex items-center gap-1.5 h-7 px-2 rounded-lg border border-border bg-secondary text-[10px] max-w-[140px]"
                >
                  {attached.status === 'ready' ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    : attached.status === 'failed' ? <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                    : <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  <span className="truncate text-foreground font-medium">{attached.title}</span>
                  <button onClick={() => setAttached(null)} className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* New Chat */}
            <button
              type="button"
              onClick={newConversation}
              className="flex items-center gap-1 h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-primary text-primary-foreground text-[11px] sm:text-[12px] font-medium hover:bg-primary/90 transition-all active:scale-[0.97] whitespace-nowrap"
              title="Start a fresh chat (clears current conversation)"
            >
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden xs:inline">New chat</span>
            </button>
          </div>
        </header>

        {/* ── Chat Messages & Hero Area ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
          <AnimatePresence mode="wait">
            {!inChat ? (
              /* ════ HERO — Responsive Empty State ════ */
              <motion.div
                key="hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="h-full flex flex-col items-center justify-center px-3 sm:px-6 lg:px-10 py-6 sm:py-10 overflow-y-auto"
              >
                <div className="max-w-3xl lg:max-w-4xl w-full flex flex-col items-center my-auto text-center">
                  {/* NoteZ Brand Orb */}
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                    className="relative w-11 h-11 sm:w-13 sm:h-13 mb-3 sm:mb-4 shrink-0 rounded-xl sm:rounded-2xl bg-secondary/80 border border-border/80 flex items-center justify-center shadow-xs text-foreground"
                  >
                    <NoteZBrandIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 tracking-tight shrink-0 text-foreground"
                  >
                    What can <span className="text-primary font-serif">NoteZ AI</span> help you learn today?
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.13 }}
                    className="text-[12px] sm:text-[13px] text-muted-foreground max-w-md sm:max-w-lg mb-6 sm:mb-8 leading-relaxed shrink-0"
                  >
                    Deep research, concise summarization, structural analysis, and step-by-step tutoring.
                  </motion.p>

                  {/* ── Quick Agent Cards — 2 cols on mobile, 4 on desktop ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.17 }}
                    className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full mb-6 sm:mb-8 shrink-0 text-left"
                  >
                    {AGENT_CARDS.map((card, i) => (
                      <motion.button
                        key={card.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.19 + i * 0.05 }}
                        whileHover={{ y: -2, boxShadow: '0 8px 28px hsl(var(--foreground) / 0.12)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => pickCard(card)}
                        className={`group text-left p-3 sm:p-4 rounded-xl border border-l-2 ${card.accent} border-border bg-card/60 hover:bg-secondary/70 transition-all flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-2 sm:mb-3">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                              <card.icon className="text-foreground" style={{ width: 14, height: 14 }} />
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                          <p className="text-[11.5px] sm:text-[13px] font-semibold text-foreground leading-snug mb-0.5 sm:mb-1">{card.label}</p>
                          <p className="text-[10px] sm:text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2">{card.desc}</p>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>

                  {/* ── AI Modes Row ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32 }}
                    className="w-full shrink-0"
                  >
                    <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2.5 sm:mb-3 text-center">AI MODES</p>
                    <div className="flex gap-1.5 sm:gap-2.5 justify-center flex-wrap">
                      {MODES.map((m, i) => (
                        <motion.button
                          key={m.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.34 + i * 0.04 }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setMode(m.id)}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10.5px] sm:text-[12px] font-medium transition-all ${
                            mode === m.id
                              ? 'border-border/90 bg-secondary text-foreground shadow-xs'
                              : 'border-border/60 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground'
                          }`}
                        >
                          <m.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-foreground" />
                          <span>{m.label}</span>
                          {mode === m.id && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary" />}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              /* ════ ACTIVE MESSAGES — Optimized chat bubble area ════ */
              <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full w-full">
                <div ref={scrollRef} className="max-w-3xl lg:max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                  <AnimatePresence initial={false}>
                    {messages.map(m => <Bubble key={m.id} message={m} />)}
                  </AnimatePresence>
                  {streaming && <Bubble message={{ id: 'stream', role: 'assistant', content: streaming, created_at: '' }} streaming />}
                  {sending && <NoteZThinkingIndicator stage={thinkingStage} simple={isSimpleMessage(lastSentMsg)} folderName={selectedFolder?.name} attachedTitle={attached?.title} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Composer — Responsive, focus zoom effect ── */}
        <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2 border-t border-border/50 bg-background/90 backdrop-blur-md shrink-0 w-full">
          <div ref={composerRef} className="max-w-3xl lg:max-w-4xl mx-auto relative w-full">

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-border bg-card shadow-2xl overflow-hidden z-50 p-1.5 backdrop-blur-md"
                >
                  <div className="px-3 pt-1.5 pb-1 border-b border-border/60">
                    <p className="text-[9px] sm:text-[9.5px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Suggestions</p>
                  </div>
                  <div className="py-0.5">
                    {filteredSuggestions.map((s, i) => (
                      <motion.button
                        key={s}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                        onMouseDown={() => pickSuggestion(s)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left hover:bg-secondary transition-colors group"
                      >
                        <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                        <span className="text-[11px] sm:text-[12px] text-muted-foreground group-hover:text-foreground flex-1 transition-colors">{s}</span>
                        <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input bar with Zoom-in / Focus Effect ── */}
            <div className="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs focus-within:scale-[1.005] focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 focus-within:shadow-lg transition-all duration-200 ease-out">

              {/* + Attach button */}
              <input ref={fileRef} type="file" className="hidden" accept={ACCEPT} onChange={e => handleFiles(e.target.files)} />
              <motion.button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0 border border-border/60 bg-secondary/60 text-foreground hover:bg-secondary transition-all"
                aria-label="Attach file (Premium feature)"
                title="Attach — Premium feature"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </motion.button>

              {/* Attached chip — inline */}
              <AnimatePresence>
                {attached && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border/80 bg-secondary/80 text-[10px] sm:text-[11px] max-w-[120px] sm:max-w-[180px] shrink-0"
                  >
                    {attached.status === 'ready' ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      : attached.status === 'failed' ? <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                      : <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                    <span className="truncate text-foreground/90 font-medium">{attached.title}</span>
                    <button onClick={() => setAttached(null)} className="hover:text-destructive p-0.5 rounded-md"><X className="h-2.5 w-2.5" /></button>
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
                  className="w-full bg-transparent text-[12.5px] sm:text-[13.5px] text-foreground placeholder-transparent resize-none focus:outline-none leading-relaxed py-0.5 sm:py-1"
                />

                {/* Typewriter ghost — only show when not focused AND no input */}
                {!input && !inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[12.5px] sm:text-[13.5px] text-muted-foreground/60">
                    <span className="truncate">{typewriterText}</span>
                    <span className="inline-block w-[1.5px] h-[13px] bg-muted-foreground ml-[2px] align-middle animate-pulse shrink-0" />
                  </div>
                )}
                {!input && inputFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[12.5px] sm:text-[13.5px] text-muted-foreground/40">
                    Type your question…
                  </div>
                )}
              </div>

              {/* Send button */}
              <motion.button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                whileHover={input.trim() && !sending ? { scale: 1.02 } : {}}
                whileTap={input.trim() && !sending ? { scale: 0.96 } : {}}
                className={`flex items-center gap-1 px-3 sm:px-4 h-7 sm:h-8 rounded-lg sm:rounded-xl text-[11px] sm:text-[12.5px] font-semibold shrink-0 transition-all select-none ${
                  input.trim() && !sending
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                    : 'bg-secondary/60 text-muted-foreground/50 cursor-not-allowed border border-border/40'
                }`}
              >
                {sending
                  ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                  : <><span>Send</span><ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></>
                }
              </motion.button>
            </div>

            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 text-center mt-1.5 select-none hidden sm:block font-mono">
              ↵ send · Shift+↵ newline · Attachments available on Pro plan
            </p>
          </div>
        </div>

      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        open={upgradeModal.open}
        field={upgradeModal.field}
        limit={upgradeModal.limit}
        onClose={closeUpgradeModal}
      />
    </>
  );
}

/* ─────────────────────── NoteZ Thinking Indicator — Adaptive ─────────────────── */
function NoteZThinkingIndicator({
  stage,
  simple = false,
  folderName,
  attachedTitle,
}: {
  stage: ThinkingStage;
  simple?: boolean;
  folderName?: string;
  attachedTitle?: string;
}) {
  if (!stage) return null;

  // Simple messages: just show a minimal spinner, no pipeline
  if (simple) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="flex items-center gap-2 py-2 px-1 select-none"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 flex items-center justify-center text-primary shrink-0"
        >
          <NoteZBrandIcon className="w-3.5 h-3.5" />
        </motion.div>
        <span className="text-[12px] sm:text-[13px] text-muted-foreground">Thinking…</span>
        <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
      </motion.div>
    );
  }

  // Complex messages: full step-by-step pipeline
  const steps = [
    {
      id: 'step-1',
      title: attachedTitle ? `Loaded attachment: ${attachedTitle}` : folderName ? `Referencing folder: ${folderName}` : 'Analyzing inquiry intent',
      icon: attachedTitle ? FileText : folderName ? Folder : Compass,
      stageIndex: 0,
    },
    {
      id: 'step-2',
      title: 'Evaluating study context & materials',
      icon: Terminal,
      stageIndex: 1,
    },
    {
      id: 'step-3',
      title: 'Structuring explanation & key insights',
      icon: Code2,
      stageIndex: 2,
    },
  ];

  const currentStageIndex =
    stage === 'initializing' ? 0 :
    stage === 'thinking' ? 1 :
    stage === 'evaluating' ? 2 : 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="w-full flex flex-col items-start py-2 select-none text-foreground"
    >
      <div className="px-1 sm:px-2 py-1.5 max-w-md sm:max-w-lg w-full">

        {/* Top Active Pulsing NoteZ Spark Header */}
        <div className="flex items-center gap-2 mb-2">
          <motion.div
            animate={{ rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 flex items-center justify-center text-primary shrink-0"
          >
            <NoteZBrandIcon className="w-4 h-4" />
          </motion.div>
          <span className="text-[12px] sm:text-[13px] font-semibold text-foreground tracking-tight">
            {stage === 'initializing' ? 'Analyzing your question…' :
             stage === 'thinking' ? 'Reasoning through inquiry…' :
             stage === 'evaluating' ? 'Synthesizing response…' : 'Composing answer…'}
          </span>
        </div>

        {/* Vertical Pipeline */}
        <div className="border-l border-border/70 ml-2 pl-3 sm:pl-4 py-0.5 space-y-2">
          {steps.map(step => {
            const isCompleted = currentStageIndex > step.stageIndex;
            const isCurrent   = currentStageIndex === step.stageIndex;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-2 text-[11px] sm:text-[12px] transition-colors duration-300 ${
                  isCompleted
                    ? 'text-muted-foreground/70'
                    : isCurrent
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground/35'
                }`}
              >
                <step.icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 ${isCurrent ? 'text-primary animate-pulse' : 'text-muted-foreground/60'}`} />
                <span className="truncate">{step.title}</span>
                {isCompleted && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary ml-auto shrink-0" />}
                {isCurrent && <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin text-primary ml-auto shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────── Clean Message Bubble — Optimized Layout ────────────────────────────── */
function Bubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      tabIndex={0}
      className={`group relative flex w-full outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {isUser ? (
        /* User Message — right-aligned bubble */
        <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] rounded-2xl rounded-tr-sm px-3.5 sm:px-4 py-2.5 sm:py-3 bg-secondary text-foreground text-[13px] sm:text-[14px] leading-relaxed shadow-xs border border-border/60">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[9px] sm:text-[10px] font-mono text-primary font-semibold uppercase tracking-wider">YOU</span>
            {message.created_at && (
              <span className="text-[8.5px] sm:text-[9.5px] font-mono text-muted-foreground/50">
                {format(new Date(message.created_at), 'h:mm a')}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-foreground/95">{message.content}</p>
        </div>
      ) : (
        /* Assistant Message — full-width clean typography */
        <div className="w-full text-foreground text-[13px] sm:text-[14px] leading-relaxed space-y-1.5 sm:space-y-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[12.5px] font-semibold text-foreground pb-0.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
            </div>
            <span className="font-serif text-[12px] sm:text-[13px] tracking-tight">NoteZ AI</span>
            {message.created_at && (
              <span className="text-[8.5px] sm:text-[9.5px] font-mono text-muted-foreground/50 font-normal ml-auto">
                {format(new Date(message.created_at), 'h:mm a')}
              </span>
            )}
          </div>

          {/* Markdown Content */}
          <div className="text-foreground/95">
            <Markdown text={message.content + (streaming ? ' ▍' : '')} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="text-foreground select-text overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[16px] sm:text-[18px] font-bold text-foreground mt-4 mb-2 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] sm:text-[16.5px] font-bold text-foreground mt-3.5 mb-2 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13.5px] sm:text-[15px] font-semibold text-foreground mt-3 mb-1.5 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[13px] sm:text-[14px] font-semibold text-foreground mt-2.5 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-foreground/95 my-2">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-[13.5px] sm:text-[14px] text-foreground/95">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-[13.5px] sm:text-[14px] text-foreground/95">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/70 bg-secondary/40 rounded-r-xl px-3.5 py-2.5 my-3 text-[13px] sm:text-[13.5px] text-foreground/90 not-italic shadow-xs">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }: any) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-secondary/80 border border-border/70 rounded px-1.5 py-0.5 font-mono text-[12px] text-primary" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-secondary/60 border border-border/70 rounded-xl p-3.5 my-3 overflow-x-auto text-[12px] sm:text-[12.5px] font-mono leading-relaxed">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-4 border-border/70" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
