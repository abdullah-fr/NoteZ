import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { generateExamWithGemini, saveExamResult, type ExamQuestion } from '@/services';
import { toast } from 'sonner';
import { useUpgradeModal, parseLimitError } from '@/hooks/use-upgrade-modal';
import { useFolderStorage } from '@/hooks/useFolderStorage';
import type { FolderItem } from '@/hooks/useFolderStorage';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { useTimer } from '@/lib/timer';
import { getExamModerationMessage } from '@/lib/exam-safety';
import {
  BookOpen, Zap, Pencil, Loader2, Check, X, Lightbulb, ArrowRight,
  RotateCcw, Trophy, Target, ChevronDown, ChevronUp, Brain,
  Folder, FileText, FileCheck2, CheckSquare, Square, Clock, Award, Timer,
  Edit2, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/* Shared exam mark used in the setup header, CTA, and empty state. */
function ExamIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <FileCheck2 aria-hidden="true" className={`shrink-0 ${className}`} />;
}

const difficulties = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const questionCounts = [5, 10, 15];

const defaultTimerOptions = [
  { minutes: 0, label: 'Untimed' },
  { minutes: 5, label: '5m' },
  { minutes: 10, label: '10m' },
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
];

const LOADING_STEPS = [
  'Preparing study material & notes…',
  'Crafting contextual questions…',
  'Validating options & explanations…',
  'Finalizing AI exam suite…',
];

interface FolderNote {
  id: string;
  title: string;
  content: string;
  categoryName: string;
}

interface LocalFolderData {
  id: string;
  name: string;
  notes: FolderNote[];
}

function toLocalFolderData(folders: FolderItem[]): LocalFolderData[] {
  return folders.map(folder => ({
    id: folder.id,
    name: folder.name || 'Folder',
    notes: folder.categories.flatMap(category => category.notes.map(note => ({
      id: note.id,
      title: note.title || 'Untitled Note',
      content: note.content || '',
      categoryName: category.name || 'Notes',
    }))),
  }));
}

interface RecentExam {
  id: string;
  subject: string;
  score: number;
  total_questions: number;
  difficulty: string;
  created_at: string;
  questions: ExamQuestion[];
}

interface WeakArea {
  name: string;
  percent: number;
  attempts: number;
  trend: number | null;
  insight: string;
  priority: number;
}

function cleanNoteText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   HELPER: format time from ISO date string
───────────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseStoredQuestions(value: unknown): ExamQuestion[] {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item): ExamQuestion[] => {
    if (!isRecord(item)) return [];
    const record = item;
    const options = Array.isArray(record.options)
      ? record.options.filter((option): option is string => typeof option === 'string')
      : [];
    if (typeof record.question !== 'string' || options.length < 2) return [];

    const rawCorrectIndex = typeof record.correctIndex === 'number' ? record.correctIndex : 0;
    const correctIndex = Math.min(Math.max(Math.round(rawCorrectIndex), 0), options.length - 1);
    return [{
      question: record.question,
      options,
      correctIndex,
      explanation: typeof record.explanation === 'string' ? record.explanation : '',
      wrongExplanations: {},
      betterApproach: typeof record.betterApproach === 'string' ? record.betterApproach : '',
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function HistoryResultModal({ exam, onClose }: { exam: RecentExam; onClose: () => void }) {
  const questions = parseStoredQuestions(exam.questions);
  const percentage = exam.total_questions > 0
    ? Math.round((exam.score / exam.total_questions) * 100)
    : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5">
        <motion.button
          type="button"
          aria-label="Close exam history result"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-result-title"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          className="relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100vh-2.5rem)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Exam history</p>
                <h2 id="history-result-title" className="truncate font-serif text-xl tracking-tight text-foreground sm:text-2xl">
                  {exam.subject}
                </h2>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {fmtRelativeDate(exam.created_at)} · {exam.difficulty} · {exam.total_questions} questions
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close exam history result"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5">
              <span className="text-xs font-semibold text-foreground">Final score</span>
              <span className="font-mono text-lg font-bold text-primary">{exam.score}/{exam.total_questions} · {percentage}%</span>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-5 text-center">
                <p className="text-sm font-semibold text-foreground">Answer details unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  This exam’s score is saved, but its question data was not stored with the result.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Correct answers</p>
                {questions.map((question, index) => (
                  <div key={`${exam.id}-${index}`} className="rounded-xl border border-border/70 bg-secondary/25 p-3.5 sm:p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{index + 1}.</span>
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-foreground">{question.question}</p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {question.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === question.correctIndex;
                        return (
                          <div
                            key={`${exam.id}-${index}-${optionIndex}`}
                            className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                              isCorrect
                                ? 'border-primary/40 bg-primary/10 text-foreground'
                                : 'border-border/50 bg-card/40 text-muted-foreground'
                            }`}
                          >
                            <span className="shrink-0 font-mono font-bold">{String.fromCharCode(65 + optionIndex)}.</span>
                            <span className="min-w-0 flex-1">{option}</span>
                            {isCorrect && <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                    {question.explanation && (
                      <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
                        {question.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function ExamQuizView() {
  const { user } = useAuth();
  const { folders } = useFolderStorage(user?.id);
  const { upgradeModal, handleLimitError, closeUpgradeModal } = useUpgradeModal();
  const { setExamMinutes, startExam, pauseExam, resetExam: resetTimerState, examTimeLeft, examRunning, examCompleted: timerExamCompleted } = useTimer();

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('');
  const [examMode, setExamMode] = useState<'practice' | 'mock'>('practice');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [isCustomQuestions, setIsCustomQuestions] = useState(false);
  const [customQuestionsInput, setCustomQuestionsInput] = useState('20');

  // Timer Selection: 0 (untimed), preset minutes, or custom
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [isCustomTimer, setIsCustomTimer] = useState(false);
  const [customTimerInput, setCustomTimerInput] = useState('20');

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [examCompleted, setExamCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [answers, setAnswers] = useState<{ selected: number; correct: boolean }[]>([]);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState<number | null>(null);

  // Folder & Notes Scope Selection
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [studyDropdownOpen, setStudyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Recent exam results
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);
  const [selectedHistoryExam, setSelectedHistoryExam] = useState<RecentExam | null>(null);

  // Load recent exam results
  useEffect(() => {
    if (!user) return;
    const loadRecent = async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select('id, subject, score, total_questions, difficulty, created_at, questions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        setRecentExams((data as unknown as RecentExam[]).map(exam => ({
          ...exam,
          questions: parseStoredQuestions(exam.questions),
        })));
      }
    };
    loadRecent();
  }, [user, examCompleted]);

  const localFoldersData = useMemo(() => toLocalFolderData(folders), [folders]);

  const currentFolder = localFoldersData.find(f => f.id === selectedFolderId);

  // Close study dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStudyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When folder selection changes, select all notes inside that folder by default
  const handleFolderSelect = (folderId: string | null, closeDropdown = true) => {
    setSelectedFolderId(folderId);
    if (closeDropdown) setStudyDropdownOpen(false);
    if (!folderId) {
      setSelectedNoteIds(new Set());
      return;
    }
    const folder = localFoldersData.find(f => f.id === folderId);
    if (folder) {
      setSelectedNoteIds(new Set(folder.notes.map(n => n.id)));
      if (!subject.trim()) {
        const folderNameLetters = folder.name.replace(/[^a-zA-Z\s]/g, '');
        setSubject(folderNameLetters);
      }
    }
  };

  // Subject Input Validation (Keystroke Enforcement): Only allow letters and spaces
  const handleSubjectChange = (val: string) => {
    const lettersOnly = val.replace(/[^a-zA-Z\s]/g, '');
    setSubject(lettersOnly);
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleSelectAllNotes = () => {
    if (!currentFolder) return;
    if (selectedNoteIds.size === currentFolder.notes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(currentFolder.notes.map(n => n.id)));
    }
  };

  function getSelectedNotesSourceText(): string {
    if (!currentFolder) return '';
    const parts: string[] = [];
    let idx = 1;
    for (const note of currentFolder.notes) {
      if (selectedNoteIds.has(note.id)) {
        const cleanContent = cleanNoteText(note.content);
        if (cleanContent) {
          parts.push(`--- NOTE ${idx}: ${note.title} (Category: ${note.categoryName}) ---\n${cleanContent}`);
          idx++;
        }
      }
    }
    return parts.join('\n\n');
  }

  // Handle timer expiration during exam — use the countdown's own completed flag
  useEffect(() => {
    if (timerExamCompleted && questions.length > 0 && !examCompleted && timerMinutes > 0) {
      setExamCompleted(true);
      pauseExam();
      toast.warning('Time is up! Exam auto-submitted.');

      // Compute final score from whatever was answered
      const finalScore = answers.reduce((acc, curr) => (curr && curr.correct ? acc + 1 : acc), 0);
      setScore(finalScore);

      if (user) {
        const targetSubject = subject.trim() || (currentFolder ? currentFolder.name : 'General Quiz');
        saveExamResult(user.id, {
          subject: targetSubject,
          score: finalScore,
          totalQuestions: questions.length,
          difficulty,
          questions,
        });
      }
    }
  }, [timerExamCompleted, questions.length, examCompleted, pauseExam, timerMinutes, answers, user, subject, currentFolder, difficulty, questions]);

  // Multi-step loading rotator (Staged progress, forward-only)
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  // Keyboard shortcut focus
  useEffect(() => {
    const handler = () => { setTimeout(() => subjectInputRef.current?.focus(), 120); };
    window.addEventListener('notez:focus-exam-input', handler);
    return () => window.removeEventListener('notez:focus-exam-input', handler);
  }, []);

  const handleGenerateExam = async () => {
    const trimmedSubject = subject.trim();

    if (!selectedFolderId && !trimmedSubject) {
      toast.error('Please enter a subject or topic name.');
      subjectInputRef.current?.focus();
      return;
    }

    if (selectedFolderId) {
      if (!currentFolder || currentFolder.notes.length === 0) {
        toast.error('No study notes are available in this folder to generate an exam from.');
        return;
      }
      if (selectedNoteIds.size === 0) {
        toast.error('Please select at least one note from the folder to generate an exam.');
        return;
      }
    }

    const targetSubject = trimmedSubject || (currentFolder ? currentFolder.name : 'General Quiz');
    const effectiveQuestionCount = isCustomQuestions
      ? Math.min(30, Math.max(1, parseInt(customQuestionsInput) || 10))
      : questionCount;
    const sourceText = selectedFolderId ? getSelectedNotesSourceText() : undefined;
    const moderationMessage = getExamModerationMessage(`${targetSubject}\n${sourceText || ''}`);
    if (moderationMessage) {
      toast.error(moderationMessage);
      return;
    }

    setLoadingStep(0);
    setLoading(true);
    try {
      if (selectedFolderId && (!sourceText || sourceText.trim().length === 0)) {
        toast.error('No study notes are available in this folder to generate an exam from.');
        setLoading(false);
        return;
      }

      const data = await generateExamWithGemini({
        subject: targetSubject,
        difficulty,
        questionCount: effectiveQuestionCount,
        mode: examMode,
        sourceText,
      });

      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setScore(0);
      setExamCompleted(false);
      setAnswers([]);

      // Effective active timer minutes (Custom vs Preset)
      const activeMinutes = isCustomTimer
        ? Math.min(60, Math.max(1, parseInt(customTimerInput) || 10))
        : timerMinutes;
      if (activeMinutes > 0) {
        setExamMinutes(activeMinutes);
        startExam(activeMinutes);
      } else {
        pauseExam();
        resetTimerState();
      }
    } catch (e: unknown) {
      console.error(e);
      const limitErr = parseLimitError(e);
      if (limitErr) {
        handleLimitError(limitErr.field, limitErr.limit, {
          balance: limitErr.balance,
          required: limitErr.required,
          resetDate: limitErr.resetDate,
        });
      } else {
        toast.error(e instanceof Error ? e.message : 'The exam service encountered an issue. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);

    if (examMode === 'practice') {
      if (showFeedback) return;
      setShowFeedback(true);
      const isCorrect = index === questions[currentIndex].correctIndex;
      if (isCorrect) setScore(prev => prev + 1);
      setAnswers(prev => [...prev, { selected: index, correct: isCorrect }]);
    } else {
      const isCorrect = index === questions[currentIndex].correctIndex;
      setAnswers(prev => {
        const next = [...prev];
        next[currentIndex] = { selected: index, correct: isCorrect };
        return next;
      });
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      const nextAns = answers[currentIndex + 1];
      setSelectedAnswer(nextAns ? nextAns.selected : null);
      setShowFeedback(false);
    } else {
      setExamCompleted(true);
      pauseExam();

      const finalScore = answers.reduce((acc, curr) => (curr && curr.correct ? acc + 1 : acc), 0);
      setScore(finalScore);

      if (user) {
        const targetSubject = subject.trim() || (currentFolder ? currentFolder.name : 'General Quiz');
        saveExamResult(user.id, {
          subject: targetSubject,
          score: finalScore,
          totalQuestions: questions.length,
          difficulty,
          questions,
        });
      }
    }
  };

  const handleResetExam = () => {
    pauseExam();
    resetTimerState();
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setScore(0);
    setExamCompleted(false);
    setAnswers([]);

    setSubject('');
    setSelectedFolderId(null);
    setSelectedNoteIds(new Set());
    setExamMode('practice');
    setDifficulty('medium');
    setQuestionCount(10);
    setIsCustomQuestions(false);
    setTimerMinutes(0);
    setIsCustomTimer(false);
  };

  /* ── Weak areas ranked from accuracy, recency, and score trend ── */
  const weakAreas = useMemo<WeakArea[]>(() => {
    const subjectMap = new Map<string, RecentExam[]>();
    for (const exam of recentExams) {
      const exams = subjectMap.get(exam.subject) || [];
      exams.push(exam);
      subjectMap.set(exam.subject, exams);
    }

    return Array.from(subjectMap.entries())
      .map(([name, exams]) => {
        const chronological = [...exams].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const totalQuestions = chronological.reduce((sum, exam) => sum + exam.total_questions, 0);
        const totalCorrect = chronological.reduce((sum, exam) => sum + exam.score, 0);
        const percent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const latest = chronological[chronological.length - 1];
        const previous = chronological.slice(0, -1);
        const previousQuestions = previous.reduce((sum, exam) => sum + exam.total_questions, 0);
        const previousCorrect = previous.reduce((sum, exam) => sum + exam.score, 0);
        const previousPercent = previousQuestions > 0 ? Math.round((previousCorrect / previousQuestions) * 100) : null;
        const latestPercent = latest.total_questions > 0
          ? Math.round((latest.score / latest.total_questions) * 100)
          : percent;
        const trend = previousPercent === null ? null : latestPercent - previousPercent;
        const priority = (100 - percent) + (trend !== null && trend < 0 ? Math.abs(trend) * 0.75 : 0);
        const insight = percent < 50
          ? 'Priority review · below 50% accuracy'
          : trend !== null && trend <= -10
            ? `Needs attention · down ${Math.abs(trend)} pts recently`
            : 'Review next · build another strong attempt';

        return { name, percent, attempts: chronological.length, trend, insight, priority };
      })
      .filter(area => area.percent < 70 || (area.trend !== null && area.trend <= -10))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }, [recentExams]);

  /* ────────────────── SETUP SCREEN (Clean, Fit-to-screen on Desktop) ────────────────── */
  if (questions.length === 0 && !loading) {
    return (
      <div className="w-full min-h-full lg:h-full flex flex-col bg-background text-foreground overflow-y-auto lg:overflow-hidden p-3 sm:p-4 select-none">

        {/* ══════════════════════════════════════════════════════════════
            MAIN BODY (2-COLUMN GRID FIT ON DESKTOP)
        ══════════════════════════════════════════════════════════════ */}
        <div className="w-full h-auto min-h-full lg:h-full lg:min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,33%)] gap-3 sm:gap-3.5 overflow-y-auto lg:overflow-hidden">

          {/* ── LEFT COLUMN: Configuration Panel ── */}
          <div className="rounded-2xl lg:rounded-3xl border border-border/70 bg-card/85 p-4 sm:p-5 lg:p-6 shadow-xs flex flex-col justify-between h-auto lg:h-full min-h-0 overflow-y-auto overflow-x-hidden gap-3.5 sm:gap-4">

            {/* Header: Title & AI Badge */}
            <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                  <ExamIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Exam Simulation & Practice</span>
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                    Generate AI-crafted questions from your notes or any study topic
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2.5 py-1 rounded-md bg-secondary border border-border/70 text-muted-foreground">
                <Brain className="h-3 w-3 text-primary" />
                <span>AI Powered</span>
              </span>
            </div>

            {/* Step 1: Subject or Folder Source */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                  Select Study Material or Topic
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">Topic or Folder Source</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Subject Topic Input */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Subject / Topic Name
                  </label>
                  <div className="relative">
                    <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      ref={subjectInputRef}
                      value={subject}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerateExam()}
                      placeholder="e.g., Operating Systems"
                      className="w-full h-9 sm:h-10 pl-9 pr-8 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                    />
                    {subject && (
                      <button
                        type="button"
                        onClick={() => setSubject('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-secondary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Folder Source Dropdown */}
                <div ref={dropdownRef} className="relative">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Folder Source (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setStudyDropdownOpen(open => !open)}
                    aria-expanded={studyDropdownOpen}
                    aria-haspopup="listbox"
                    className="w-full h-9 sm:h-10 px-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground flex items-center justify-between font-medium hover:bg-secondary/80 transition-colors outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {currentFolder ? (
                          <>
                            {currentFolder.name}
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              · {selectedNoteIds.size}/{currentFolder.notes.length} notes
                            </span>
                          </>
                        ) : 'Topic Only (AI Generator)'}
                      </span>
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${studyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Custom Dropdown Menu */}
                  <AnimatePresence>
                    {studyDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        role="listbox"
                        className="absolute right-0 left-0 top-full mt-1.5 z-40 max-h-[min(65vh,28rem)] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl space-y-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => handleFolderSelect(null)}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                            selectedFolderId === null
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'text-foreground hover:bg-secondary'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                            Topic Only (AI Generator)
                          </span>
                          {selectedFolderId === null && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </button>

                        {localFoldersData.map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFolderSelect(f.id, false)}
                            className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                              selectedFolderId === f.id
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'text-foreground hover:bg-secondary'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate pr-2">
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{f.name}</span>
                            </span>
                            <span className="font-mono text-[10px] opacity-80 shrink-0">
                              {f.notes.length} notes
                            </span>
                          </button>
                        ))}

                        {currentFolder && (
                          <div className="mt-1.5 border-t border-border/70 pt-1.5">
                            <div className="flex items-center justify-between px-2 py-1">
                              <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                Choose notes
                              </span>
                              {currentFolder.notes.length > 0 && (
                                <button
                                  type="button"
                                  onClick={toggleSelectAllNotes}
                                  className="text-[10px] font-semibold text-primary hover:underline"
                                >
                                  {selectedNoteIds.size === currentFolder.notes.length ? 'Deselect all' : 'Select all'}
                                </button>
                              )}
                            </div>

                            {currentFolder.notes.length === 0 ? (
                              <p className="px-2 py-1 text-xs font-medium text-destructive">
                                No notes found in this folder.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {currentFolder.notes.map(note => {
                                  const isChecked = selectedNoteIds.has(note.id);
                                  return (
                                    <button
                                      key={note.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isChecked}
                                      onClick={() => toggleNoteSelection(note.id)}
                                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 p-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        {isChecked ? (
                                          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                                        ) : (
                                          <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="truncate">{note.title}</span>
                                      </span>
                                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        {note.categoryName}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            <p className="px-2 pt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                              Only selected notes will be used for this exam.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Step 2: Exam Mode Selection */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-1.5">
                <span className="w-4.5 h-4.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                Choose Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Practice Mode Card */}
                <button
                  type="button"
                  onClick={() => setExamMode('practice')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    examMode === 'practice'
                      ? 'border-primary/60 bg-secondary/80 font-medium shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        examMode === 'practice' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border text-foreground'
                      }`}>
                        <Zap className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-tight">Practice Mode</h4>
                        <span className="text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground">
                          Instant Explanations
                        </span>
                      </div>
                    </div>
                    {examMode === 'practice' && (
                      <div className="w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-2">
                    Step-by-step guidance with instant answer validation & deep explanations.
                  </p>
                </button>

                {/* Mock Exam Card */}
                <button
                  type="button"
                  onClick={() => setExamMode('mock')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    examMode === 'mock'
                      ? 'border-primary/60 bg-secondary/80 font-medium shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        examMode === 'mock' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border text-foreground'
                      }`}>
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-tight">Mock Exam</h4>
                        <span className="text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground">
                          Timed Simulation
                        </span>
                      </div>
                    </div>
                    {examMode === 'mock' && (
                      <div className="w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-2">
                    Simulate real exam pressure with no hints and a final score breakdown.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 3 & 4: Difficulty + Questions on same row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Difficulty */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {difficulties.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`py-2 px-2 rounded-xl text-center text-xs transition-all cursor-pointer font-medium border ${
                        difficulty === d.id
                          ? 'border-primary/60 bg-secondary/90 font-bold text-foreground shadow-xs ring-1 ring-primary/25'
                          : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                  Questions
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {questionCounts.map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setIsCustomQuestions(false);
                        setQuestionCount(count);
                      }}
                      className={`py-2 px-1 rounded-xl text-center text-xs transition-all cursor-pointer font-medium border ${
                        !isCustomQuestions && questionCount === count
                          ? 'border-primary/60 bg-secondary/90 font-bold text-foreground shadow-xs ring-1 ring-primary/25'
                          : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      {count} Qs
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomQuestions(true);
                      const qty = Math.min(30, Math.max(1, parseInt(customQuestionsInput) || 20));
                      setCustomQuestionsInput(String(qty));
                      setQuestionCount(qty);
                    }}
                    className={`py-2 px-1 rounded-xl text-center text-xs transition-all cursor-pointer font-medium border ${
                      isCustomQuestions
                        ? 'border-primary/60 bg-secondary/90 font-bold text-foreground shadow-xs ring-1 ring-primary/25'
                        : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomQuestions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-1.5 flex items-center gap-2"
                  >
                    <span className="text-[11px] text-muted-foreground">Count:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={customQuestionsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setCustomQuestionsInput('');
                          setQuestionCount(0);
                          return;
                        }
                        const numericValue = Number(val);
                        const cappedValue = Number.isFinite(numericValue)
                          ? Math.min(30, Math.max(0, Math.trunc(numericValue)))
                          : 0;
                        setCustomQuestionsInput(String(cappedValue));
                        setQuestionCount(cappedValue);
                      }}
                      className="w-16 h-7 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground text-center font-bold outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground">(1-30)</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Step 5: Timer Duration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">5</span>
                  Timer Duration
                </label>
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3 text-primary" /> Synced with Focus Timer
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {defaultTimerOptions.map(tOpt => (
                  <button
                    key={tOpt.minutes}
                    type="button"
                    onClick={() => {
                      setIsCustomTimer(false);
                      setTimerMinutes(tOpt.minutes);
                    }}
                    className={`py-2 px-2 rounded-xl text-center text-xs transition-all cursor-pointer font-medium border ${
                      !isCustomTimer && timerMinutes === tOpt.minutes
                        ? 'border-primary/60 bg-secondary/90 font-bold text-foreground shadow-xs ring-1 ring-primary/25'
                        : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    }`}
                  >
                    {tOpt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTimer(true);
                    const mins = Math.min(60, Math.max(1, parseInt(customTimerInput) || 20));
                    setCustomTimerInput(String(mins));
                    setTimerMinutes(mins);
                  }}
                  className={`py-2 px-2 rounded-xl text-center text-xs transition-all cursor-pointer font-medium border ${
                    isCustomTimer
                      ? 'border-primary/60 bg-secondary/90 font-bold text-foreground shadow-xs ring-1 ring-primary/25'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomTimer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-1.5 flex items-center gap-2"
                >
                  <span className="text-[11px] text-muted-foreground">Duration:</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={customTimerInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCustomTimerInput('');
                        setTimerMinutes(0);
                        return;
                      }
                      const numericValue = Number(val);
                      const cappedValue = Number.isFinite(numericValue)
                        ? Math.min(60, Math.max(0, Math.trunc(numericValue)))
                        : 0;
                      setCustomTimerInput(String(cappedValue));
                      setTimerMinutes(cappedValue);
                    }}
                    className="w-16 h-7 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground text-center font-bold outline-none focus:border-primary"
                  />
                  <span className="text-xs text-foreground font-medium">Minutes</span>
                </motion.div>
              )}
            </div>

            {/* Generate Exam Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={handleGenerateExam}
              disabled={!subject.trim() && !selectedFolderId}
              className="w-full h-11 sm:h-12 rounded-xl border border-primary/40 bg-primary/60 text-primary-foreground text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/70 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 mt-2"
            >
              <ExamIcon className="h-4.5 w-4.5 text-primary-foreground shrink-0" />
              <span>Generate Personalized Exam</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </motion.button>
          </div>{/* End left column */}

          {/* ── RIGHT COLUMN: Weak Areas and History ── */}
          <div className="flex flex-col lg:grid lg:grid-rows-2 min-h-0 gap-3 h-auto lg:h-full lg:overflow-hidden">

            {/* 1. Areas to improve */}
            <div className="rounded-2xl border border-border/70 bg-card/85 p-3.5 min-h-0 max-h-[min(36rem,70vh)] lg:max-h-none lg:overflow-y-auto shadow-xs space-y-2">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                <p className="text-[13px] font-mono uppercase tracking-[0.16em] text-foreground font-bold leading-none">
                  Areas to improve
                </p>
                <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">Accuracy + trend</span>
              </div>

              {recentExams.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  Complete exams to discover review priorities from your results.
                </p>
              ) : weakAreas.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  No urgent weak areas detected. Keep practicing to confirm your progress.
                </p>
              ) : (
                <div className="space-y-2">
                  {weakAreas.map((area) => (
                    <div key={area.name} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">{area.name}</span>
                        <span className="block truncate text-[9px] font-mono text-muted-foreground">{area.insight}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 w-8 text-right">{area.percent}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${area.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {weakAreas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (weakAreas.length > 0) {
                      setSubject(recentExams[0]?.subject || weakAreas[0].name);
                      subjectInputRef.current?.focus();
                    }
                  }}
                  className="w-full mt-1 text-xs font-semibold text-foreground hover:text-primary flex items-center justify-end gap-1 transition-colors"
                >
                  Practice areas to improve <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 2. Exam history */}
            <div className="rounded-2xl border border-border/70 bg-card/85 p-3.5 min-h-[10rem] max-h-[min(36rem,70vh)] lg:max-h-none lg:min-h-0 flex min-h-0 flex-col shadow-xs overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-[13px] font-mono uppercase tracking-[0.16em] text-foreground font-bold leading-none">
                  History
                </p>
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {recentExams.length} {recentExams.length === 1 ? 'exam' : 'exams'}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                {recentExams.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                    <Trophy className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">No exams yet</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Generate your first exam to see history
                    </p>
                  </div>
                ) : (
                  recentExams.map(ex => {
                    const pct = ex.total_questions > 0 ? Math.round((ex.score / ex.total_questions) * 100) : 0;
                    const dur = Math.round(ex.total_questions * 0.8);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => setSelectedHistoryExam(ex)}
                        aria-label={`Open result for ${ex.subject}`}
                        className="group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-secondary/50"
                      >
                        {/* Neutral exam icon — result status is shown as text */}
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/60 text-primary">
                          <FileCheck2 className="h-3.5 w-3.5" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {ex.subject}
                          </p>
                          <p className="text-[9.5px] font-mono text-muted-foreground">
                            {ex.total_questions} Qs • {dur}m • {pct}%
                          </p>
                        </div>

                        {/* Date / Time */}
                        <div className="text-right shrink-0">
                          <p className="text-[9.5px] font-mono text-muted-foreground">{fmtRelativeDate(ex.created_at)}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/60">{fmtTime(ex.created_at)}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          </div>{/* End right column */}

          </div>{/* End main body */}

        {selectedHistoryExam && (
          <HistoryResultModal
            exam={selectedHistoryExam}
            onClose={() => setSelectedHistoryExam(null)}
          />
        )}

        {/* Upgrade Modal */}
        <UpgradeModal
          open={upgradeModal.open}
          field={upgradeModal.field}
          limit={upgradeModal.limit}
          onClose={closeUpgradeModal}
        />
      </div>
    );
  }

  /* ────────────────── STAGED PROGRESS LOADING SCREEN ────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          className="flex min-h-[13rem] w-full max-w-xl flex-col justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-xl sm:p-10"
        >
          <div className="relative w-14 h-14 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <Brain className="h-6 w-6 text-primary animate-pulse" />
          </div>

          <div className="min-h-[4.5rem]">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold mb-2">
                Step {loadingStep + 1} of {LOADING_STEPS.length}
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {LOADING_STEPS[loadingStep]}
              </h3>
              <p className="text-xs text-muted-foreground font-medium capitalize">
                {isCustomQuestions ? customQuestionsInput : questionCount} {difficulty} questions · {examMode} mode · {subject || currentFolder?.name}
              </p>
          </div>

          {/* Smooth Continuous Shimmer Bar */}
          <div className="w-56 h-1.5 bg-secondary rounded-full mx-auto mt-6 overflow-hidden relative">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '15%' }}
              animate={{ width: `${Math.min(95, ((loadingStep + 1) / LOADING_STEPS.length) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  /* ────────────────── RESULTS SCREEN ────────────────── */
  if (examCompleted) {
    const totalCorrect = answers.reduce((acc, a) => (a && a.correct ? acc + 1 : acc), 0);
    const totalIncorrect = questions.length - totalCorrect;

    return (
      <div className="max-w-4xl mx-auto pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl"
        >
          <div className="text-center mb-6">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-primary" />
            <h2 className="text-2xl font-bold font-serif text-foreground">Exam Complete</h2>
            <p className="text-xs text-muted-foreground capitalize mt-1 font-medium">
              {subject || currentFolder?.name} · {difficulty} · {examMode} Mode
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-3xl font-bold font-mono text-emerald-500">{totalCorrect}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1">
                CORRECT
              </p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-3xl font-bold font-mono text-destructive">{totalIncorrect}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive mt-1">
                INCORRECT
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Question Breakdown & Explanations
            </h3>
            {questions.map((qItem, i) => {
              const ans = answers[i];
              const isExpanded = showDetailedFeedback === i;
              return (
                <div key={i} className="rounded-xl border border-border overflow-hidden bg-secondary/40">
                  <button
                    onClick={() => setShowDetailedFeedback(isExpanded ? null : i)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                        {i + 1}.
                      </span>
                      <p className="text-xs font-medium text-foreground truncate">
                        {qItem.question}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ans?.correct ? (
                        <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="text-[11px] text-destructive font-semibold flex items-center gap-1">
                          <X className="h-3.5 w-3.5" /> Incorrect
                        </span>
                      )}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="p-4 bg-background/50 border-t border-border/60 text-xs space-y-3"
                      >
                        <div>
                          <span className="text-muted-foreground font-medium">Your answer: </span>
                          <span className={`font-semibold ${ans?.correct ? 'text-emerald-500' : 'text-destructive'}`}>
                            {ans ? `${String.fromCharCode(65 + ans.selected)}. ${qItem.options[ans.selected]}` : 'Skipped'}
                          </span>
                        </div>

                        {!ans?.correct && (
                          <div>
                            <span className="text-muted-foreground font-medium">Correct answer: </span>
                            <span className="font-semibold text-emerald-500">
                              {String.fromCharCode(65 + qItem.correctIndex)}. {qItem.options[qItem.correctIndex]}
                            </span>
                          </div>
                        )}

                        <div className="p-3 rounded-lg bg-secondary/80 text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">Explanation: </strong> {qItem.explanation}
                        </div>

                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-foreground leading-relaxed flex items-start gap-2">
                          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <p><strong>Recommended Strategy:</strong> {qItem.betterApproach}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleResetExam}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md"
          >
            <RotateCcw className="h-4 w-4" /> Generate Exam Again
          </button>
        </motion.div>
      </div>
    );
  }

  /* ────────────────── ACTIVE QUESTION SCREEN ────────────────── */
  const q = questions[currentIndex];

  if (!q) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
          <ExamIcon className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h2 className="text-base font-semibold text-foreground">This exam could not be opened</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The question data is unavailable. Return to setup and generate the exam again.
          </p>
          <button
            type="button"
            onClick={handleResetExam}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Return to setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Active Exam Header Bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
          <ExamIcon className="h-5 w-5 text-primary shrink-0" />
          <span className="truncate">{subject || currentFolder?.name}</span>
        </h2>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="capitalize">{difficulty}</span>
          <span>·</span>
          <span className="capitalize">{examMode}</span>
          <span>·</span>
          <span>Q{currentIndex + 1}/{questions.length}</span>
        </div>
      </div>

      {/* Question Dots Navigation */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto py-1">
        {questions.map((_, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered = answers[idx] !== undefined;
          return (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setSelectedAnswer(answers[idx] ? answers[idx].selected : null);
                setShowFeedback(examMode === 'practice' && answers[idx] !== undefined);
              }}
              className={`h-2 rounded-full transition-all ${
                isCurrent
                  ? 'w-6 bg-primary'
                  : isAnswered
                    ? 'w-3 bg-primary/50'
                    : 'w-2 bg-secondary border border-border'
              }`}
              title={`Go to Q${idx + 1}`}
            />
          );
        })}
      </div>

      {/* Active Question Box */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="rounded-2xl border border-border bg-card p-6 md:p-7 shadow-xl"
        >
          <p className="text-[15px] font-medium text-foreground mb-6 leading-relaxed">
            {q.question}
          </p>

          {/* Multiple Choice Options */}
          <div className="space-y-2.5 mb-6">
            {q.options.map((opt, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === q.correctIndex;
              const isWrong = isSelected && !isCorrect;

              return (
                <motion.button
                  key={i}
                  whileHover={(!showFeedback || examMode === 'mock') ? { scale: 1.005 } : {}}
                  whileTap={(!showFeedback || examMode === 'mock') ? { scale: 0.99 } : {}}
                  animate={(showFeedback && isWrong && examMode === 'practice') ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                  onClick={() => handleAnswer(i)}
                  disabled={showFeedback && examMode === 'practice'}
                  className={`w-full p-3.5 rounded-xl text-left border text-xs transition-all flex items-center justify-between ${
                    examMode === 'practice' && showFeedback
                      ? isCorrect
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground font-semibold'
                        : isWrong
                          ? 'border-destructive/50 bg-destructive/10 text-destructive font-semibold'
                          : 'border-border bg-secondary/40 text-muted-foreground opacity-60'
                      : isSelected
                        ? 'border-primary bg-primary/10 text-foreground font-semibold ring-2 ring-primary/20'
                        : 'border-border bg-secondary/60 text-foreground hover:bg-secondary hover:border-primary/50'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                    <span className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center text-[10px] font-mono text-foreground font-semibold shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="break-words line-clamp-3">{opt}</span>
                  </span>
                  {examMode === 'practice' && showFeedback && isCorrect && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {examMode === 'practice' && showFeedback && isWrong && <X className="h-4 w-4 text-destructive shrink-0" />}
                  {examMode === 'mock' && isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </motion.button>
              );
            })}
          </div>

          {/* Instant Question Feedback for Practice Mode */}
          {examMode === 'practice' && showFeedback && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
              <div className="rounded-xl border border-border bg-secondary/60 p-4 text-xs text-foreground">
                <div className="flex items-start gap-2">
                  {selectedAnswer === q.correctIndex ? (
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold mb-0.5">
                      {selectedAnswer === q.correctIndex ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedAnswer === q.correctIndex
                        ? q.explanation
                        : q.wrongExplanations?.[String(selectedAnswer)] || q.explanation}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={nextQuestion}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md"
              >
                {currentIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="h-4 w-4" /></>
                ) : (
                  'View Exam Results'
                )}
              </button>
            </motion.div>
          )}

          {/* Controls for Mock Mode */}
          {examMode === 'mock' && (
            <div className="pt-2">
              <button
                onClick={nextQuestion}
                disabled={selectedAnswer === null}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md disabled:opacity-40"
              >
                {currentIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="h-4 w-4" /></>
                ) : (
                  'Submit Exam'
                )}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModal.open}
        field={upgradeModal.field}
        limit={upgradeModal.limit}
        onClose={closeUpgradeModal}
      />
    </div>
  );
}
