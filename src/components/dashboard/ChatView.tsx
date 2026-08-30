import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  createConversation, updateConversation,
  uploadChatFile, createSourceRecord, invokeProcessSource,
  getStreamingToken, subscribeToSourceUpdates, fetchExamHistory,
  type ChatMessage, type AttachedSource, type ExamHistoryEntry,
} from '@/services';
import { toast } from '@/hooks/use-toast';
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { format } from 'date-fns';
import { htmlToPlainText } from './note-utils';
import { useCalendar, dayLabel, type CalendarEvent } from '@/lib/calendar';
import { reportCreditFunctionError, syncCreditsAfterRequest } from '@/lib/credits';
import {
  Sparkles, GraduationCap, FlaskConical, ScrollText,
  Loader2, Plus, FileText, X, BarChart3, HeartHandshake,
  CheckCircle2, AlertCircle, BookOpen, Folder, ClipboardCheck,
  Brain, Calendar, ArrowRight, ChevronDown, ArrowUpRight,
  Search, Terminal, Code2, Compass, Check, Copy, CheckCheck,
  Mic, MicOff,
} from 'lucide-react';
import React from 'react';

/* ─── types ─── */
type Mode          = 'researcher' | 'summarizer' | 'analyst';
type ThinkingStage = 'initializing' | 'thinking' | 'evaluating' | 'displaying' | null;
type ThinkingLevel = 'low' | 'high' | 'max';

/* ─── Error Boundary to prevent black screen crashes ─── */
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ChatView ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full w-full p-8 text-center">
          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">Something went wrong rendering the chat.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  { id: 'researcher', label: 'Research',  icon: FlaskConical,   tag: 'Deep analysis & evidence' },
  { id: 'summarizer', label: 'Summarize', icon: ScrollText,     tag: 'TL;DR & key bullets' },
  { id: 'analyst',    label: 'Analyst',   icon: BarChart3,      tag: 'Trade-offs, risks, decisions' },
];

const FOLDER_SCOPE = { label: 'Ask this Folder', desc: 'Context from your notes' };

const AGENT_CARDS: QuickTask[] = [
  { id: 'explain',    label: 'Explain Simpler',          icon: BookOpen,       desc: 'Break down complex topics with analogies.',             prompt: 'Explain this concept in simpler language with an analogy I can relate to.', accent: 'border-l-notez-violet' },
  { id: 'summarize',  label: 'Summarize Folder / Notes', icon: Folder,         desc: 'Condense folders or individual notes into clear structured summaries.', prompt: 'Summarize the key points from my notes in bullet points.', accent: 'border-l-notez-indigo' },
  { id: 'calendar',   label: 'Analyze Calendar',         icon: Calendar,       desc: 'Review upcoming tasks, deadlines & events from your calendar.', prompt: 'Analyze my upcoming calendar events and help me prioritize my tasks.', accent: 'border-l-notez-success' },
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

/* Suggestions removed — user preference */

const ACCEPT    = '.pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg';
const ACCEPT_RE = /\.(pdf|docx?|pptx?|png|jpe?g)$/i;
const MAX_COMPOSER_TEXTAREA_HEIGHT = 160;
const IDLE_VOLUME_BARS = Array.from({ length: 12 }, () => 0.14);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getHistoryQuestions(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap(item => {
    if (!isRecord(item) || typeof item.question !== 'string') return [];
    const question = item.question.trim();
    return question ? [question] : [];
  });
}

function buildExamHistoryContext(history: ExamHistoryEntry[]): string {
  if (history.length === 0) {
    return `

[QUIZ/EXAM HISTORY]
No completed quiz or exam results are currently available in the user's NoteZ workspace. Do not ask the user to paste missed questions; explain that there is no saved history to analyze yet and provide a useful starter plan based on that limitation.`;
  }

  const entries: string[] = [];
  let characterCount = 0;
  const budget = 9000;

  for (const exam of history) {
    const total = Number.isFinite(exam.total_questions) ? exam.total_questions : 0;
    const score = Number.isFinite(exam.score) ? exam.score : 0;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const questions = getHistoryQuestions(exam.questions)
      .slice(0, 8)
      .map(question => `- ${question.slice(0, 240)}`)
      .join('\n');
    const entry = [
      `Exam: ${exam.subject || 'Untitled exam'}`,
      `Score: ${score}/${total} (${percent}%)` ,
      `Difficulty: ${exam.difficulty || 'unknown'}`,
      `Completed: ${exam.created_at || 'unknown'}`,
      questions ? `Question topics represented in this attempt:\n${questions}` : '',
    ].filter(Boolean).join('\n');

    if (characterCount + entry.length > budget) break;
    entries.push(entry);
    characterCount += entry.length;
  }

  return `

[QUIZ/EXAM HISTORY — USE THIS DATA DIRECTLY]
The following saved NoteZ exam results belong to the current user. Use the scores to identify the weakest subjects and use the question topics to make the plan specific. The saved records contain performance totals and generated question topics, but not the user's individual selected answers, so do not claim to know an exact missed answer.

${entries.join('\n\n')}

[STUDY-PLAN INSTRUCTION]
Generate the focused study plan from this history. Do not ask the user to paste specific missed questions or topics when the history above is available. Mention the weakest evidence-based areas, explain why they are prioritized, and give concrete study actions and a review schedule.`;
}

/* ─── main component ─── */
function ChatViewInner() {
  const { user } = useAuth();
  const { upgradeModal, closeUpgradeModal } = useUpgradeModal();
  const { getUpcoming } = useCalendar();
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]         = useState('');
  const [sending, setSending]             = useState(false);
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>(null);
  const [input, setInput]                 = useState('');
  const [mode, setMode]                   = useState<Mode | null>(null);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('high');
  const [thinkingOpen, setThinkingOpen]   = useState(false);
  const [selectedFolderId, setSelectedFolderId]   = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId]       = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [scopeOpen, setScopeOpen]         = useState(false);
  const [attached, setAttached]           = useState<AttachedSource | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [inputFocused, setInputFocused]   = useState(false);
  const [activeCardId, setActiveCardId]   = useState<string | null>(null);
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

  const isListeningRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [volumeBars, setVolumeBars] = useState<number[]>(IDLE_VOLUME_BARS);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const preListeningInputRef = useRef('');

  /* ── Clean teardown of all audio resources ── */
  const stopAudioTracks = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVolumeBars(IDLE_VOLUME_BARS);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  /* ── Cancel: discard spoken text & audio, restore original input ── */
  const cancelListening = useCallback(() => {
    stopAudioTracks();
    setIsTranscribing(false);
    setInput(preListeningInputRef.current);
  }, [stopAudioTracks]);

  /* ── Confirm / Done: finish speech recognition & focus composer ── */
  const confirmListening = useCallback(async () => {
    stopAudioTracks();
    setIsTranscribing(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [stopAudioTracks]);

  /* ── Start Voice Dictation (Native Browser Web Speech API with 0 API costs) ── */
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: 'Browser Voice Support',
        description: 'Voice speech-to-text is supported natively in Google Chrome, Apple Safari, and Microsoft Edge.',
      });
      return;
    }

    preListeningInputRef.current = input;
    audioChunksRef.current = [];

    try {
      // 1. Acquire mic media stream for live equalizer animation
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      // Enable the animation loop before its first frame. The loop exits when
      // this ref is false, so setting it afterwards would stop it immediately.
      isListeningRef.current = true;
      setIsListening(true);
      setVolumeBars(IDLE_VOLUME_BARS);

      // 2. Set up AudioContext real live volume equalizer bars
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => undefined);
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);

          const timeData = new Uint8Array(analyser.fftSize);
          const frequencyData = new Uint8Array(analyser.frequencyBinCount);
          let smoothedLevel = 0;
          const updateVolumeBars = () => {
            if (!isListeningRef.current) return;
            analyser.getByteTimeDomainData(timeData);
            analyser.getByteFrequencyData(frequencyData);

            // RMS detects whether the microphone is actually receiving a
            // voice signal; frequency bands give each bar its own movement.
            let sumSquares = 0;
            for (const sample of timeData) {
              const centered = (sample - 128) / 128;
              sumSquares += centered * centered;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);
            const voiceLevel = Math.max(0, Math.min(1, (rms - 0.012) * 9));
            smoothedLevel = smoothedLevel * 0.78 + voiceLevel * 0.22;

            const newBars = Array.from({ length: 12 }, (_, index) => {
              const start = Math.floor((index / 12) * frequencyData.length);
              const end = Math.max(start + 1, Math.floor(((index + 1) / 12) * frequencyData.length));
              let bandTotal = 0;
              for (let i = start; i < end; i++) bandTotal += frequencyData[i] || 0;
              const bandLevel = bandTotal / ((end - start) * 255);
              return Math.max(0.14, Math.min(1, 0.14 + smoothedLevel * (0.7 + bandLevel * 1.4)));
            });
            setVolumeBars(newBars);
            animFrameRef.current = requestAnimationFrame(updateVolumeBars);
          };
          updateVolumeBars();
        }
      } catch (e) {
        console.warn('AudioContext visualization setup note:', e);
      }

      // 3. Native Web Speech API
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let committedText = input;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        if (finalTranscript) {
          const separator = committedText && !committedText.endsWith(' ') ? ' ' : '';
          committedText = committedText + separator + finalTranscript.trim();
          setInput(committedText);
        } else if (interimTranscript) {
          const separator = committedText && !committedText.endsWith(' ') ? ' ' : '';
          setInput(committedText + separator + interimTranscript.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition status:', err?.error);
      };

      recognition.onend = () => {
        if (isListeningRef.current && recognitionRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (micErr) {
      console.error('Microphone access error:', micErr);
      toast({
        title: 'Microphone Access Required',
        description: 'Please grant microphone permissions in your browser to use voice dictation.',
        variant: 'destructive',
      });
      stopAudioTracks();
    }
  }, [input, stopAudioTracks]);


  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudioTracks();
    };
  }, [stopAudioTracks]);

  const [localFolders, setLocalFolders] = useState<LocalFolder[]>(readLocalFolders);
  const selectedFolder = localFolders.find(f => f.id === selectedFolderId) ?? null;
  const selectedNote = selectedFolder?.notes.find(n => n.id === selectedNoteId) ?? null;

  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scopeRef    = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const chatRequestIdRef = useRef(0);

  const resizeComposerTextarea = useCallback((element?: HTMLTextAreaElement | null) => {
    const textarea = element ?? textareaRef.current;
    if (!textarea) return;

    // Measure from the natural content height, then cap the composer so long
    // prompts become internally scrollable instead of taking over the page.
    textarea.style.height = 'auto';
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(contentHeight, MAX_COMPOSER_TEXTAREA_HEIGHT)}px`;
    textarea.style.overflowY = contentHeight > MAX_COMPOSER_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeComposerTextarea();
  }, [input, resizeComposerTextarea]);

  const activeCard  = AGENT_CARDS.find(c => c.id === activeCardId) ?? null;
  const typewriterText = useTypewriter(TYPEWRITER_HINTS);
  const activeMode  = mode ? (MODES.find(m => m.id === mode) ?? null) : null;
  const inChat      = messages.length > 0 || !!streaming || sending;
  const showHomePlaceholder = !inChat && !input;
  const scopeLabel  = selectedNote
    ? `${selectedFolder?.name} / ${selectedNote.title}`
    : (selectedFolder?.name ?? 'Ask this Folder / Note');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  /* ── Auto-scroll to bottom like ChatGPT ── */
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

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
    chatRequestIdRef.current += 1;
    stopAudioTracks();
    setIsTranscribing(false);
    setActiveId(null);
    setMessages([]);
    setStreaming('');
    setSending(false);
    setThinkingStage(null);
    setLastSentMsg('');
    setAttached(null);
    setMode(null);
    setActiveCardId(null);
    setScopeOpen(false);
    setThinkingOpen(false);
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
    const rawInput = (overrideMsg ?? input).trim();
    let msg = rawInput;

    if (activeCard) {
      if (rawInput) {
        msg = `[ACTIVE FEATURE: ${activeCard.label}]\nUser Prompt: ${rawInput}\n(Please apply feature "${activeCard.label}" logic to answer the user prompt above)`;
      } else {
        if (activeCard.id === 'summarize' && selectedFolder) {
          msg = selectedNote
            ? `Summarize the key points from my "${selectedNote.title}" note in bullet points.`
            : `Summarize the key points and concepts in my "${selectedFolder.name}" folder.`;
        } else if (activeCard.id === 'calendar') {
          const upcoming = getUpcoming(14);
          if (upcoming.length > 0) {
            const eventLines = upcoming.map((ev: CalendarEvent) => {
              const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
              return `- [${ev.type.toUpperCase()}] "${ev.title}" on ${dayLabel(d)} (${format(d, 'MMM d')}) at ${ev.hour}:${String(ev.minute).padStart(2, '0')} ${ev.ampm}${ev.completed ? ' ✅ Done' : ''}`;
            }).join('\n');
            msg = `Here are my upcoming calendar events for the next 2 weeks:\n${eventLines}\n\nAnalyze these events and help me prioritize my tasks. What should I focus on first?`;
          } else {
            msg = 'I have no upcoming calendar events in the next 2 weeks. Can you help me plan my study schedule?';
          }
        } else {
          msg = activeCard.prompt;
        }
      }
    }

    if (!msg || !user || sending) return;
    const requestId = ++chatRequestIdRef.current;
    const quizStudyPlanRequested = activeCard?.id === 'studyplan'
      || (/\bstudy plan\b/i.test(msg) && /\b(quiz|exam|assessment)\b/i.test(msg));
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setLastSentMsg(msg);
    setInput(''); setSending(true); setStreaming(''); setActiveCardId(null);

    try {
      const effectiveMode = mode || 'researcher';
      let convId = activeId;
      if (!convId) {
        const prefix = selectedNote
          ? `[Note: ${selectedNote.title}] `
          : selectedFolder
          ? `[Folder: ${selectedFolder.name}] `
          : '';
        const data = await createConversation(user.id, effectiveMode, prefix + msg.slice(0, 60), attached?.id);
        if (requestId !== chatRequestIdRef.current) return;
        convId = data.id;
        setActiveId(convId);
      } else {
        if (requestId !== chatRequestIdRef.current) return;
        await updateConversation(convId, { mode: effectiveMode, source_id: attached?.id ?? null });
      }

      const userMsgObj: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: msg, created_at: new Date().toISOString() };
      if (requestId !== chatRequestIdRef.current) return;
      setMessages(prev => [...prev, userMsgObj]);

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

      let quizHistoryContext = '';
      if (quizStudyPlanRequested) {
        try {
          const examHistory = await fetchExamHistory(user.id);
          quizHistoryContext = buildExamHistoryContext(examHistory);
        } catch (historyError) {
          console.warn('Could not load quiz history for AI study plan:', historyError);
          quizHistoryContext = `

[QUIZ/EXAM HISTORY]
The workspace could not load saved exam history for this request. Do not ask the user to paste missed questions; acknowledge that the saved history was unavailable and provide a useful general study-plan framework.`;
        }
      }

      // Chat prompt construction is handled by the ai-chat Edge Function.

      let rawText = '';
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('ai-chat', {
        body: {
          conversationId: convId,
          message: msg,
          context: `${scopeHint}${quizHistoryContext}`,
          mode: effectiveMode,
          sourceId: attached?.id,
          scope: scopeTitle,
        },
      });
      if (edgeErr) throw edgeErr;

      if (typeof edgeData === 'string') rawText = edgeData;
      else if (edgeData?.content) rawText = edgeData.content;
      if (!rawText) throw new Error('The AI chat service returned an empty response.');
      await syncCreditsAfterRequest(user.id);

      // Add assistant message (with guaranteed string fallback)
      const responseContent = rawText;

      if (requestId !== chatRequestIdRef.current) return;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: responseContent, created_at: new Date().toISOString() }]);
    } catch (e: unknown) {
      if (requestId !== chatRequestIdRef.current) return;
      const creditLimit = await reportCreditFunctionError(e);
      await syncCreditsAfterRequest(user?.id);
      // The global credit dialog is the complete response for exhausted
      // allowances. Avoid stacking a generic red error toast underneath it.
      if (!creditLimit) {
        const message = e instanceof Error ? e.message : 'Please try sending your message again.';
        toast({ title: 'Error sending message', description: message, variant: 'destructive' });
      }
    } finally {
      if (requestId === chatRequestIdRef.current) {
        setSending(false);
        setStreaming('');
        setThinkingStage(null);
      }
    }
  }

  /* ── Clicking quick cards attaches feature pill badge to input bar ── */
  function pickCard(c: QuickTask) {
    setActiveCardId(prev => (prev === c.id ? null : c.id));
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  /* ── Clicking follow-up fills the search/composer box for user to edit & send ── */
  function handleSelectFollowUp(prompt: string) {
    setInput(prompt);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = prompt.length;
        textareaRef.current.setSelectionRange(len, len);
      }
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
                    className="absolute top-full mt-1.5 left-0 z-50 w-[calc(100vw-1.5rem)] sm:w-96 rounded-2xl border border-border bg-card shadow-2xl p-2.5"
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
                    className="absolute top-full mt-1.5 left-auto right-0 z-50 w-56 sm:left-0 sm:right-auto sm:w-60 rounded-xl border border-border bg-card shadow-2xl p-1.5 space-y-0.5"
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
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
                    {AGENT_CARDS.map((card, i) => {
                      const isSelected = activeCardId === card.id;
                      return (
                        <motion.button
                          key={card.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.19 + i * 0.05 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => pickCard(card)}
                          data-card-id={card.id}
                          className={`group text-left p-3 sm:p-4 rounded-xl border border-l-2 ${card.accent} transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-border bg-card/60 hover:bg-secondary/70'
                          } ai-agent-card`}
                        >
                          <div>
                            <div className="flex items-start justify-between mb-2 sm:mb-3">
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-foreground'
                              }`}>
                                <card.icon style={{ width: 14, height: 14 }} />
                              </div>
                              <ArrowUpRight className={`h-3.5 w-3.5 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                            </div>
                            <p className="text-[11.5px] sm:text-[13px] font-semibold text-foreground leading-snug mb-0.5 sm:mb-1">{card.label}</p>
                            <p className="text-[10px] sm:text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2">{card.desc}</p>
                          </div>
                        </motion.button>
                      );
                    })}
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
                      {MODES.map((m, i) => {
                        const isSelected = mode === m.id;
                        return (
                          <motion.button
                            key={m.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.34 + i * 0.04 }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setMode(prev => prev === m.id ? null : m.id)}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10.5px] sm:text-[12px] font-medium transition-all ${
                              isSelected
                                ? 'border-foreground/40 bg-card text-white font-bold shadow-xs'
                                : 'border-border/60 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground'
                            }`}
                          >
                            <m.icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-foreground'}`} />
                            <span>{m.label}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-white" />}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              /* ════ ACTIVE MESSAGES — Optimized chat bubble area ════ */
              <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full w-full">
                <div className="max-w-3xl lg:max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                  <AnimatePresence initial={false}>
                    {messages.map(m => (
                      <ChatErrorBoundary key={m.id}>
                        <Bubble message={m} onSelectFollowUp={handleSelectFollowUp} />
                      </ChatErrorBoundary>
                    ))}
                  </AnimatePresence>
                  {streaming && (
                    <ChatErrorBoundary>
                      <Bubble message={{ id: 'stream', role: 'assistant', content: streaming, created_at: '' }} streaming />
                    </ChatErrorBoundary>
                  )}
                  {sending && <NoteZThinkingIndicator stage={thinkingStage} simple={isSimpleMessage(lastSentMsg)} folderName={selectedFolder?.name} attachedTitle={attached?.title} />}
                  <div ref={bottomRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Composer — Responsive, focus zoom effect ── */}
        <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2 bg-background/90 backdrop-blur-md shrink-0 w-full">
          <div ref={composerRef} className="max-w-3xl lg:max-w-4xl mx-auto relative w-full">

            {/* ── Input bar ── */}
            <div className="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs transition-all duration-200 ease-out">

              <AnimatePresence mode="wait">
                {isListening ? (
                  /* ═══════ LISTENING OVERLAY — ChatGPT-style ✕ Cancel / ✓ Done ═══════ */
                  <motion.div
                    key="listening-overlay"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 w-full"
                  >
                    {/* ✕ Cancel — discard spoken text */}
                    <motion.button
                      type="button"
                      onClick={cancelListening}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center shrink-0 border border-foreground/20 bg-secondary/60 text-foreground/70 hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                      aria-label="Cancel voice input"
                      title="Cancel — discard spoken text"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>

                    {/* Sound Wave Visualizer — center, fills remaining space */}
                    <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
                      {/* Pulsing mic icon */}
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative mr-2 shrink-0"
                      >
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-foreground/10 border border-foreground/20 flex items-center justify-center">
                          <Mic className="h-4 w-4 text-foreground/80" />
                        </div>
                        <span className="absolute inset-0 rounded-full bg-foreground/8 animate-ping pointer-events-none" />
                      </motion.div>

                      {/* Real live audio volume equalizer bars */}
                      <div className="flex items-center gap-[3px] h-8" data-testid="voice-bars">
                        {volumeBars.map((vol, i) => (
                          <motion.span
                            key={i}
                            className="w-[2.5px] rounded-full bg-gradient-to-t from-foreground/50 to-foreground/90"
                            animate={{
                              height: [`${Math.max(4, vol * 22)}px`],
                            }}
                            transition={{
                              duration: 0.1,
                              ease: 'easeOut',
                            }}
                          />
                        ))}
                      </div>

                      {/* "Listening..." or "Transcribing..." label */}
                      <span className="ml-2.5 text-[11px] sm:text-[12px] font-medium text-foreground/60 tracking-wide select-none shrink-0">
                        {isTranscribing ? 'Transcribing audio…' : 'Listening…'}
                      </span>
                    </div>

                    {/* ✓ Done — keep text & transcribe audio */}
                    <motion.button
                      type="button"
                      onClick={confirmListening}
                      disabled={isTranscribing}
                      whileHover={!isTranscribing ? { scale: 1.08 } : {}}
                      whileTap={!isTranscribing ? { scale: 0.92 } : {}}
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      aria-label="Done — keep spoken text"
                      title="Done — keep spoken text"
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </motion.button>
                  </motion.div>
                ) : (
                  /* ═══════ NORMAL INPUT BAR ═══════ */
                  <motion.div
                    key="normal-input"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    // Keep attachment, microphone, and send controls anchored to
                    // the bottom edge while the textarea grows upward.
                    className="flex items-end gap-2 w-full"
                  >
                    {/* + Attach button */}
                    <input ref={fileRef} type="file" className="hidden" accept={ACCEPT} onChange={e => handleFiles(e.target.files)} />
                    <motion.button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0 border border-border/60 bg-secondary/60 text-foreground hover:bg-secondary transition-all cursor-pointer"
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

                    {/* Active Feature Card Tag Pill (like ChatGPT Web Search) */}
                    <AnimatePresence>
                      {activeCard && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/35 text-primary text-[11.5px] sm:text-[12px] font-semibold shrink-0 select-none"
                        >
                          <activeCard.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[130px] sm:max-w-[190px]">{activeCard.label}</span>
                          <button
                            type="button"
                            onClick={() => setActiveCardId(null)}
                            className="p-0.5 rounded-md hover:bg-primary/20 text-primary/70 hover:text-primary transition-colors"
                            title="Remove feature"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Active AI Mode Tag Pill (Bold White Text Effect) */}
                    <AnimatePresence>
                      {activeMode && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-foreground/40 text-white font-bold text-[12px] shadow-sm shrink-0 select-none backdrop-blur-md"
                        >
                          <activeMode.icon className="h-3.5 w-3.5 text-white shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-[170px] text-white font-bold">{activeMode.label} Mode</span>
                          <button
                            type="button"
                            onClick={() => setMode(null)}
                            className="p-0.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                            title="Remove AI mode"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Textarea + typewriter overlay */}
                    <div className="relative flex-1 min-w-0 flex items-end">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => {
                          setInput(e.target.value);
                          resizeComposerTextarea(e.currentTarget);
                        }}
                        onKeyDown={onKey}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        rows={1}
                        className="w-full bg-transparent text-[12.5px] sm:text-[13.5px] text-foreground placeholder-transparent resize-none focus:outline-none leading-relaxed py-0.5 sm:py-1"
                      />

                      {/* Home-only rotating suggestions; active conversations use a neutral follow-up hint. */}
                      {showHomePlaceholder && !inputFocused && (
                        <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[12.5px] sm:text-[13.5px] text-muted-foreground/60">
                          <span className="truncate">{typewriterText}</span>
                          <span className="inline-block w-[1.5px] h-[13px] bg-muted-foreground ml-[2px] align-middle animate-pulse shrink-0" />
                        </div>
                      )}
                      {showHomePlaceholder && inputFocused && (
                        <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[12.5px] sm:text-[13.5px] text-muted-foreground/40">
                          Type your question…
                        </div>
                      )}
                      {!showHomePlaceholder && !input && (
                        <div className="absolute inset-0 flex items-center pointer-events-none select-none text-[12.5px] sm:text-[13.5px] text-muted-foreground/40">
                          Ask a follow-up question…
                        </div>
                      )}
                    </div>

                    {/* 🎤 Mic button — right side */}
                    <motion.button
                      type="button"
                      onClick={startListening}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border border-border/60 bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                      aria-label="Voice dictation"
                      title="Voice dictation (Speech to Text)"
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </motion.button>

                    {/* Send button */}
                    <motion.button
                      onClick={() => send()}
                      disabled={sending || (!input.trim() && !activeCardId)}
                      whileHover={(input.trim() || activeCardId) && !sending ? { scale: 1.02 } : {}}
                      whileTap={(input.trim() || activeCardId) && !sending ? { scale: 0.96 } : {}}
                      className={`flex items-center gap-1 px-3 sm:px-4 h-7 sm:h-8 rounded-lg sm:rounded-xl text-[11px] sm:text-[12.5px] font-semibold shrink-0 transition-all select-none ${
                        (input.trim() || activeCardId) && !sending
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                          : 'bg-secondary/60 text-muted-foreground/50 cursor-not-allowed border border-border/40'
                      }`}
                    >
                      {sending
                        ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                        : <><span>Send</span><ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></>
                      }
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 text-center mt-1.5 select-none hidden sm:block font-mono">
              ↵ send · Shift+↵ newline
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

export default function ChatView() {
  return (
    <ChatErrorBoundary>
      <ChatViewInner />
    </ChatErrorBoundary>
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

/* ─── helper to parse follow-ups from response text ─── */
function parseFollowUps(rawContent?: string): { cleanText: string; followUps: string[] } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanText: '', followUps: [] };
  }

  // Support multiple marker variants
  const markers = [
    'NEXT_FOLLOW_UPS:',
    '**NEXT_FOLLOW_UPS:**',
    'Follow-ups:',
    '**Follow-ups:**',
    'Follow-up Questions:',
    '**Follow-up Questions:**',
    'Suggested Follow-ups:',
    '**Suggested Follow-ups:**',
  ];

  let markerFound: string | null = null;
  let idx = -1;

  for (const m of markers) {
    const pos = rawContent.lastIndexOf(m);
    if (pos !== -1 && (idx === -1 || pos > idx)) {
      idx = pos;
      markerFound = m;
    }
  }

  if (idx === -1 || !markerFound) {
    return { cleanText: rawContent, followUps: [] };
  }

  let cleanText = rawContent.slice(0, idx).trim();
  if (cleanText.endsWith('---')) {
    cleanText = cleanText.slice(0, -3).trim();
  }

  const followUpBlock = rawContent.slice(idx + markerFound.length);
  const lines = followUpBlock
    .split('\n')
    .map(l => l.trim().replace(/^[-*•\d.)\]]+\s*/, '').replace(/^\[|\]$/g, '').trim())
    .filter(l => l.length > 5 && !l.startsWith('---'));

  return {
    cleanText: cleanText || rawContent,
    followUps: lines.slice(0, 3),
  };
}

/* ─────────────────────── Clean Message Bubble ────────────────────────────── */
function Bubble({
  message,
  streaming,
  onSelectFollowUp,
}: {
  message: ChatMessage;
  streaming?: boolean;
  onSelectFollowUp?: (prompt: string) => void;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const textToCopy = message?.content || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message?.content]);

  const { cleanText, followUps } = useMemo(() => parseFollowUps(message.content), [message.content]);

  // Dynamic contextual follow-ups generated specifically from the message topic
  const displayFollowUps = useMemo(() => {
    if (followUps.length > 0) return followUps;

    const content = (cleanText || message?.content || '').toLowerCase();
    if (content.includes('book') || content.includes('author') || content.includes('read')) {
      return [
        "Create a structured chapter-by-chapter reading plan for these books.",
        "Show me a step-by-step example problem from the top recommended book.",
        "Compare the depth and difficulty of these recommendations.",
      ];
    }
    if (content.includes('math') || content.includes('calculus') || content.includes('algebra') || content.includes('equation')) {
      return [
        "Walk me through a step-by-step example problem with full explanations.",
        "What foundational prerequisites should I review before starting this topic?",
        "Generate 3 practice quiz problems with step-by-step solutions.",
      ];
    }
    if (content.includes('code') || content.includes('python') || content.includes('function') || content.includes('program')) {
      return [
        "Show a complete working code example with detailed inline comments.",
        "Explain the common edge cases and performance pitfalls with this approach.",
        "Refactor this example for modern production best practices.",
      ];
    }
    if (content.includes('exam') || content.includes('test') || content.includes('quiz')) {
      return [
        "Generate a 5-question practice exam with detailed answer keys.",
        "What are the highest-yield exam concepts I must prioritize?",
        "Create a targeted 7-day revision schedule for this exam.",
      ];
    }
    if (content.includes('schedule') || content.includes('calendar') || content.includes('task') || content.includes('time')) {
      return [
        "Prioritize these tasks into a high-impact daily schedule.",
        "Break down this timeline into manageable 45-minute study blocks.",
        "Give me active recall techniques to retain this material faster.",
      ];
    }

    return [
      "Elaborate deeper on the most important concept mentioned above.",
      "Give me a real-world case study and practical application of this.",
      "What are the next advanced topics I should explore following this?",
    ];
  }, [followUps, cleanText, message?.content]);

  const CopyBtn = (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center"
      title={copied ? "Copied to clipboard!" : "Copy response"}
      aria-label="Copy response"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );

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
        /* User Message — right-aligned bubble with copy icon */
        <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] rounded-2xl rounded-tr-sm px-3.5 sm:px-4 py-2.5 sm:py-3 bg-secondary text-foreground text-[13px] sm:text-[14px] leading-relaxed shadow-xs border border-border/60 group/user">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[9px] sm:text-[10px] font-mono text-primary font-semibold uppercase tracking-wider">YOU</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {message.created_at ? (
                <span className="text-[8.5px] sm:text-[9.5px] font-mono text-muted-foreground/50">
                  {(() => { try { return format(new Date(message.created_at), 'h:mm a'); } catch { return ''; } })()}
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-card/70 text-muted-foreground/60 hover:text-foreground transition-all flex items-center justify-center"
                title={copied ? "Copied to clipboard!" : "Copy prompt"}
                aria-label="Copy prompt"
              >
                {copied ? <CheckCheck className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-foreground/95">{message.content}</p>
        </div>
      ) : (
        /* Assistant Message — full-width clean typography */
        <div className="w-full text-foreground text-[13px] sm:text-[14px] leading-relaxed space-y-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[12.5px] font-semibold text-foreground pb-0.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
            </div>
            <span className="font-serif text-[12px] sm:text-[13px] tracking-tight">NoteZ AI</span>
            {message.created_at ? (
              <span className="text-[8.5px] sm:text-[9.5px] font-mono text-muted-foreground/50 font-normal ml-auto">
                {(() => { try { return format(new Date(message.created_at), 'h:mm a'); } catch { return ''; } })()}
              </span>
            ) : null}
          </div>

          {/* Markdown Content */}
          <div className="text-foreground/95">
            <Markdown text={cleanText + (streaming ? ' ▍' : '')} />
          </div>

          {/* Bottom Action Bar — response actions stay below the answer */}
          {!streaming && (
            <div className="flex items-center gap-1.5 pt-1 mt-2 text-muted-foreground" aria-label="Assistant response actions" data-testid="assistant-response-actions">
              {CopyBtn}
            </div>
          )}

          {/* Follow-up Prompts Section — 3 clickable choices at the end */}
          {!streaming && (
            <div className="mt-4 pt-3 border-t border-border/50 space-y-2 select-none">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                <span>Follow-ups</span>
              </div>
              <div className="space-y-1.5">
                {displayFollowUps.map((fu, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onSelectFollowUp?.(fu)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border/60 bg-secondary/40 hover:bg-secondary hover:border-primary/40 text-left transition-all group cursor-pointer"
                    title="Insert prompt into chat box"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      <span className="text-[12px] text-foreground/90 group-hover:text-foreground font-medium truncate">{fu}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      Insert ↵
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Markdown({ text }: { text?: string }) {
  const safeText = typeof text === 'string' ? text : '';
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
            <p className="mb-2.5 leading-relaxed text-foreground/90 font-normal">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1 text-foreground/90 font-normal">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1 text-foreground/90 font-normal">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/60 pl-3 my-3 italic text-muted-foreground bg-secondary/40 py-1.5 rounded-r-lg">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            if (match) {
              return (
                <div className="my-3 rounded-xl border border-border/80 bg-secondary/90 overflow-hidden font-mono text-[12px]">
                  <div className="px-3 py-1.5 border-b border-border/60 bg-secondary flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{match[1]}</span>
                  </div>
                  <pre className="p-3 overflow-x-auto text-foreground font-mono">
                    <code>{codeString}</code>
                  </pre>
                </div>
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
        {safeText}
      </ReactMarkdown>
    </div>
  );
}
