import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { generateExamWithGemini, saveExamResult, type ExamQuestion } from '@/services';
import { toast } from 'sonner';
import { useUpgradeModal, parseLimitError } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { useTimer } from '@/lib/timer';
import {
  BookOpen, Zap, Pencil, Loader2, Check, X, Lightbulb, ArrowRight,
  RotateCcw, Trophy, Target, ChevronDown, ChevronUp, Brain,
  Folder, FileText, CheckSquare, Square, Clock, Award
} from 'lucide-react';

/* Custom Exam Paper with Pencil Icon */
function ExamPaperPencilIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px' }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Paper Sheet */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {/* Exam lines */}
      <line x1="8" y1="12" x2="12" y2="12" />
      <line x1="8" y1="16" x2="10" y2="16" />
      {/* Pencil writing on paper */}
      <path d="M18.4 12.6l-5.8 5.8-2.6.8.8-2.6 5.8-5.8a1.5 1.5 0 0 1 2.1 2.1z" />
    </svg>
  );
}

const examModes = [
  { id: 'practice', label: 'Practice Mode', tag: 'Get instant answers and detailed explanations as you progress.' },
  { id: 'mock', label: 'Mock Exam', tag: 'Simulate real test conditions and get feedback at the end.' },
];

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

export default function ExamQuizView() {
  const { user } = useAuth();
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

  // Load folders and notes from localStorage
  const localFoldersData: LocalFolderData[] = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('notez_folders') || '[]');
      return raw.map((f: any) => {
        const notes: FolderNote[] = [];
        (f.categories || []).forEach((cat: any) => {
          (cat.notes || []).forEach((n: any) => {
            notes.push({
              id: n.id,
              title: n.title || 'Untitled Note',
              content: n.content || '',
              categoryName: cat.name || 'Notes',
            });
          });
        });
        return {
          id: f.id,
          name: f.name || 'Folder',
          notes,
        };
      });
    } catch {
      return [];
    }
  })();

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
  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setStudyDropdownOpen(false);
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

    setLoading(true);
    try {
      const sourceText = selectedFolderId ? getSelectedNotesSourceText() : undefined;
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
      const activeMinutes = isCustomTimer ? Math.max(1, parseInt(customTimerInput) || 10) : timerMinutes;
      if (activeMinutes > 0) {
        setExamMinutes(activeMinutes);
        startExam(activeMinutes);
      } else {
        pauseExam();
        resetTimerState();
      }
    } catch (e: any) {
      console.error(e);
      const limitErr = parseLimitError(e);
      if (limitErr) {
        handleLimitError(limitErr.field, limitErr.limit);
      } else {
        toast.error(e.message || 'The exam service encountered an issue. Please try again.');
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

  /* ────────────────── SETUP SCREEN ────────────────── */
  if (questions.length === 0 && !loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-5 pb-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <ExamPaperPencilIcon className="h-5 w-5 text-primary" />
              </div>
              Exam & Quiz Studio
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Create personalized practice quizzes and timed mock exams from your notes or any topic.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl border border-border bg-secondary/80 text-xs font-medium text-foreground flex items-center gap-1.5 shadow-2xs">
              <Zap className="h-3.5 w-3.5 text-primary" /> AI Generator
            </span>
            <span className="px-3 py-1.5 rounded-xl border border-border bg-secondary/80 text-xs font-medium text-foreground flex items-center gap-1.5 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-primary" /> Timer Synced
            </span>
          </div>
        </div>

        {/* 2-Column Main Layout: Setup Configuration on Left, Live Preview & Tips on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left / Main Config Card (8 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-8 rounded-2xl border border-border/80 bg-card p-5 md:p-6 space-y-5 shadow-xl"
          >
            {/* Row 1: Subject & Custom Study Material Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                  <span>Subject or Topic</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Letters only</span>
                </label>
                <div className="relative">
                  <input
                    ref={subjectInputRef}
                    value={subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateExam()}
                    placeholder="e.g., Data Structures, Operating Systems..."
                    className="w-full h-11 px-4 rounded-xl bg-secondary/60 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Custom Optimized Dropdown for Study Material */}
              <div ref={dropdownRef} className="relative">
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                  <span>Study Material</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Optional source folder</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStudyDropdownOpen(open => !open)}
                  className="w-full h-11 px-4 rounded-xl bg-secondary/60 border border-border/80 text-xs text-foreground flex items-center justify-between font-medium hover:bg-secondary transition-colors outline-none focus:border-primary shadow-2xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {currentFolder ? `${currentFolder.name} (${currentFolder.notes.length} notes)` : 'Topic Only (Generic)'}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${studyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Sleek Custom Dropdown Menu */}
                <AnimatePresence>
                  {studyDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 left-0 top-full mt-1 z-30 rounded-xl border border-border bg-card p-1.5 shadow-xl max-h-48 overflow-y-auto space-y-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleFolderSelect(null)}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedFolderId === null
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                          Topic Only (Generic)
                        </span>
                        {selectedFolderId === null && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </button>

                      {localFoldersData.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleFolderSelect(f.id)}
                          className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedFolderId === f.id
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'text-foreground hover:bg-secondary'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate pr-2">
                            <Folder className="h-3.5 w-3.5 text-primary-foreground shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </span>
                          <span className="font-mono text-[10px] opacity-80 shrink-0">
                            {f.notes.length} notes
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Compact Note Checklist when Folder is selected */}
            {currentFolder && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl border border-border bg-secondary/30 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Notes in {currentFolder.name} ({selectedNoteIds.size}/{currentFolder.notes.length} selected)
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAllNotes}
                    className="text-[11px] text-primary font-semibold hover:underline"
                  >
                    {selectedNoteIds.size === currentFolder.notes.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>

                {currentFolder.notes.length === 0 ? (
                  <p className="text-[11px] text-destructive font-medium py-0.5">
                    ⚠️ No notes available in this folder.
                  </p>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {currentFolder.notes.map(note => {
                      const isChecked = selectedNoteIds.has(note.id);
                      return (
                        <div
                          key={note.id}
                          onClick={() => toggleNoteSelection(note.id)}
                          className={`flex items-center justify-between p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                            isChecked
                              ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                              : 'border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            {isChecked ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="truncate">{note.title}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground shrink-0 px-1.5 py-0.5 rounded bg-secondary">
                            {note.categoryName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Row 2: Exam Mode */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Exam Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExamMode('practice')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                    examMode === 'practice'
                      ? 'border-2 border-primary/80 bg-primary/80 text-primary-foreground font-bold shadow-sm'
                      : 'border-border/80 bg-secondary/70 text-foreground/90 hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                      examMode === 'practice'
                        ? 'bg-primary-foreground/15 border-primary-foreground/30 text-primary-foreground'
                        : 'bg-secondary border-border/80 text-foreground'
                    }`}>
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${examMode === 'practice' ? 'text-primary-foreground' : 'text-foreground'}`}>
                        Practice Mode
                      </p>
                      <p className={`text-[11px] leading-snug mt-1 ${examMode === 'practice' ? 'text-primary-foreground/80 font-medium' : 'text-muted-foreground font-medium'}`}>
                        Get instant answers and detailed step-by-step explanations as you progress.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    examMode === 'practice' ? 'border-primary-foreground bg-primary-foreground/20' : 'border-muted-foreground/50'
                  }`}>
                    {examMode === 'practice' && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExamMode('mock')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                    examMode === 'mock'
                      ? 'border-2 border-primary/80 bg-primary/80 text-primary-foreground font-bold shadow-sm'
                      : 'border-border/80 bg-secondary/70 text-foreground/90 hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                      examMode === 'mock'
                        ? 'bg-primary-foreground/15 border-primary-foreground/30 text-primary-foreground'
                        : 'bg-secondary border-border/80 text-foreground'
                    }`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${examMode === 'mock' ? 'text-primary-foreground' : 'text-foreground'}`}>
                        Mock Exam
                      </p>
                      <p className={`text-[11px] leading-snug mt-1 ${examMode === 'mock' ? 'text-primary-foreground/80 font-medium' : 'text-muted-foreground font-medium'}`}>
                        Simulate real timed test conditions and review full score breakdown at the end.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    examMode === 'mock' ? 'border-primary-foreground bg-primary-foreground/20' : 'border-muted-foreground/50'
                  }`}>
                    {examMode === 'mock' && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Row 3: Difficulty & Questions (2 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {difficulties.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`py-2 px-3 rounded-xl text-center text-xs transition-all ${
                        difficulty === d.id
                          ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80 shadow-sm'
                          : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                  <span>Number of Questions</span>
                  {isCustomQuestions && <span className="text-[10px] text-muted-foreground font-normal">Max 30</span>}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {questionCounts.map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setIsCustomQuestions(false);
                        setQuestionCount(count);
                      }}
                      className={`py-2 px-1 rounded-xl text-center text-xs transition-all ${
                        !isCustomQuestions && questionCount === count
                          ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80 shadow-sm'
                          : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomQuestions(true);
                      const qty = Math.min(30, Math.max(1, parseInt(customQuestionsInput) || 20));
                      setQuestionCount(qty);
                    }}
                    className={`py-2 px-1 rounded-xl text-center text-xs transition-all ${
                      isCustomQuestions
                        ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80 shadow-sm'
                        : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom Questions Input Box */}
                {isCustomQuestions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 flex items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground font-medium">Questions:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={customQuestionsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomQuestionsInput(val);
                        let qty = parseInt(val) || 0;
                        if (qty > 30) {
                          qty = 30;
                          toast.info('Maximum limit of 30 questions applied.');
                        }
                        setQuestionCount(qty);
                      }}
                      className="w-20 h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground text-center font-bold outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground font-medium">(1-30)</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Row 4: Exam Timer (Full Width across card with 6 spacious buttons) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Exam Timer
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">Synced with Pomodoro</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {defaultTimerOptions.map(tOpt => (
                  <button
                    key={tOpt.minutes}
                    type="button"
                    onClick={() => {
                      setIsCustomTimer(false);
                      setTimerMinutes(tOpt.minutes);
                    }}
                    className={`py-2 px-2 rounded-xl text-center text-xs transition-all ${
                      !isCustomTimer && timerMinutes === tOpt.minutes
                        ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80 shadow-sm'
                        : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {tOpt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTimer(true);
                    const mins = parseInt(customTimerInput) || 20;
                    setTimerMinutes(mins);
                  }}
                  className={`py-2 px-2 rounded-xl text-center text-xs transition-all ${
                    isCustomTimer
                      ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80 shadow-sm'
                      : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Custom Timer Input Box */}
              {isCustomTimer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 flex items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground font-medium">Duration:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customTimerInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTimerInput(val);
                      const mins = parseInt(val) || 0;
                      setTimerMinutes(mins);
                    }}
                    className="w-20 h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground text-center font-bold outline-none focus:border-primary"
                  />
                  <span className="text-xs text-foreground font-medium">Minutes</span>
                </motion.div>
              )}
            </div>

            {/* Action Button: Exam Paper with Pencil Icon */}
            <button
              onClick={handleGenerateExam}
              disabled={!subject.trim() && !selectedFolderId}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mt-3"
            >
              <ExamPaperPencilIcon className="h-5 w-5 text-primary shrink-0" />
              <span>Generate Exam</span>
            </button>
          </motion.div>

          {/* Right Column: Live Configuration Overview & Study Tips (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border/80 bg-card p-5 space-y-3.5 shadow-md"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Exam Configuration Summary
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Topic / Scope</span>
                  <span className="font-semibold text-foreground truncate max-w-[140px]">
                    {subject.trim() || (currentFolder ? currentFolder.name : 'General Topic')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Study Material</span>
                  <span className="font-medium text-foreground">
                    {currentFolder ? `${selectedNoteIds.size} notes selected` : 'Topic (AI Generator)'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Exam Mode</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 capitalize">
                    {examMode === 'practice' ? '⚡ Practice Mode' : '📝 Mock Exam'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Total Questions</span>
                  <span className="font-mono font-bold text-foreground">
                    {isCustomQuestions ? customQuestionsInput || 20 : questionCount} Qs
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className="font-semibold capitalize text-foreground">
                    {difficulty}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Time Limit</span>
                  <span className="font-mono font-semibold text-foreground">
                    {timerMinutes === 0 ? 'Untimed (Self-paced)' : `${timerMinutes} Minutes`}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Study Mode Tips Card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-border/70 bg-secondary/35 p-5 space-y-2.5 shadow-2xs"
            >
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-primary" /> Study Pro-Tips
              </h4>
              <ul className="text-[11.5px] text-muted-foreground space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Practice Mode</strong> is best for active learning with instant feedback and concept explanations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Mock Exam</strong> simulates real exam pressure with a score breakdown and study roadmap.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Attach your folders to generate targeted questions directly from your class notes.</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────── STAGED PROGRESS LOADING SCREEN ────────────────── */
  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-10 text-center shadow-xl"
        >
          <div className="relative w-14 h-14 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <Brain className="h-6 w-6 text-primary animate-pulse" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={loadingStep}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold mb-2">
                Step {loadingStep + 1} of {LOADING_STEPS.length}
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {LOADING_STEPS[loadingStep]}
              </h3>
              <p className="text-xs text-muted-foreground font-medium capitalize">
                {isCustomQuestions ? customQuestionsInput : questionCount} {difficulty} questions · {examMode} mode · {subject || currentFolder?.name}
              </p>
            </motion.div>
          </AnimatePresence>

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

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Active Exam Header Bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
          <ExamPaperPencilIcon className="h-5 w-5 text-primary shrink-0" />
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
