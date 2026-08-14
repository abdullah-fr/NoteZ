import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { generateExamWithGemini, saveExamResult, createActivity, addChecklistItems, type ExamQuestion } from '@/services';
import { toast } from 'sonner';
import { useUpgradeModal, parseLimitError } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { useTimer } from '@/lib/timer';
import {
  GraduationCap, Loader2, Check, X, Lightbulb, ArrowRight,
  RotateCcw, Trophy, Zap, Target, ChevronDown, ChevronUp, Brain, Sparkles,
  Timer, Folder, FileText, CheckSquare, Square, Clock, BookOpen, Award
} from 'lucide-react';

const examModes = [
  { id: 'practice', label: 'Practice', tag: 'Learn & review as you go' },
  { id: 'mock', label: 'Mock', tag: 'Simulate a real test' },
];

const difficulties = [
  { id: 'easy', label: 'Easy', tag: 'Fundamental concepts' },
  { id: 'medium', label: 'Medium', tag: 'Standard practice' },
  { id: 'hard', label: 'Hard', tag: 'Advanced challenge' },
];

const questionCounts = [5, 10, 15];

const timerOptions = [
  { minutes: 0, label: 'Untimed', tag: 'No time limit' },
  { minutes: 5, label: '5 Mins', tag: 'Quick blitz' },
  { minutes: 10, label: '10 Mins', tag: 'Balanced pace' },
  { minutes: 15, label: '15 Mins', tag: 'Standard exam' },
  { minutes: 30, label: '30 Mins', tag: 'Deep assessment' },
];

const LOADING_STEPS = [
  'Analyzing subject and target difficulty…',
  'Crafting contextual questions with Gemini 3.1 Flash Lite…',
  'Generating distractor options & explanations…',
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
  const { setExamMinutes, startExam, pauseExam, resetExam: resetTimerState, examTimeLeft, examRunning } = useTimer();

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('');
  const [examMode, setExamMode] = useState<'practice' | 'mock'>('practice');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [timerMinutes, setTimerMinutes] = useState(0);

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

  // When folder selection changes, select all notes inside that folder by default
  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    if (!folderId) {
      setSelectedNoteIds(new Set());
      return;
    }
    const folder = localFoldersData.find(f => f.id === folderId);
    if (folder) {
      setSelectedNoteIds(new Set(folder.notes.map(n => n.id)));
      if (!subject.trim()) {
        setSubject(folder.name);
      }
    }
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

  // Handle timer expiration during exam
  useEffect(() => {
    if (examRunning && examTimeLeft <= 0 && questions.length > 0 && !examCompleted && timerMinutes > 0) {
      setExamCompleted(true);
      pauseExam();
      toast.warning('Time is up! Exam auto-submitted.');
    }
  }, [examRunning, examTimeLeft, questions.length, examCompleted, pauseExam, timerMinutes]);

  // Multi-step loading rotator
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Keyboard shortcut focus
  useEffect(() => {
    const handler = () => { setTimeout(() => subjectInputRef.current?.focus(), 120); };
    window.addEventListener('notez:focus-exam-input', handler);
    return () => window.removeEventListener('notez:focus-exam-input', handler);
  }, []);

  const handleGenerateExam = async () => {
    // Empty Folder / No Notes check (Requirement 3.4)
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

    const targetSubject = subject.trim() || (currentFolder ? currentFolder.name : 'General Quiz');
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
        questionCount,
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

      if (timerMinutes > 0) {
        setExamMinutes(timerMinutes);
        startExam(timerMinutes);
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
        toast.error(e.message || 'Failed to generate exam');
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
      // Mock Mode: Store answer quietly without revealing feedback until complete
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
      // Complete Exam
      setExamCompleted(true);
      pauseExam();

      // Recalculate score for Mock Mode or Practice Mode
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

        // Auto-create remediation activity for wrong questions
        const wrongIndices = answers
          .map((a, i) => (a && !a.correct ? i : null))
          .filter((i): i is number => i !== null);
        if (wrongIndices.length >= 2) {
          const weakTopics = wrongIndices.slice(0, 5).map(i => {
            const q = questions[i];
            return q ? q.question.slice(0, 120) : null;
          }).filter(Boolean) as string[];

          createActivity(user.id, {
            title: `Review: ${targetSubject} (Weak Areas)`,
            subject: targetSubject || null,
            description: `Auto-generated from exam — ${wrongIndices.length} questions need review`,
          }).then(act => {
            addChecklistItems(weakTopics.map((label, idx) => ({
              activity_id: act.id,
              user_id: user.id,
              label: `Review concept: ${label}`,
              position: idx,
            })));
          }).catch(() => {/* silent */});
        }
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
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /* ────────────────── SETUP SCREEN ────────────────── */
  if (questions.length === 0 && !loading) {
    return (
      <div className="max-w-4xl mx-auto min-h-0 flex flex-col justify-center">
        {/* Header - Compact Desktop Spacing */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl tracking-tight text-foreground flex items-center gap-2">
                AI Exam Mode
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                Generate predictive exams from your folders & notes using Gemini 3.1 Flash Lite
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg border border-border bg-card font-mono text-[9px] uppercase tracking-wider text-muted-foreground shadow-2xs">
            Predictive Test Studio
          </span>
        </div>

        {/* Setup Card Container - Compact Desktop Grid Layout (Fits within 100vh) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3.5 shadow-xl shrink-0"
        >
          {/* Row 1: Subject (Left) & Generate From Folder (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Subject / Topic
              </label>
              <input
                ref={subjectInputRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateExam()}
                placeholder="e.g., Organic Chemistry, Machine Learning…"
                className="w-full h-9 px-3 rounded-lg bg-secondary/80 border border-border text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold flex items-center gap-1.5">
                <Folder className="h-3 w-3 text-primary" />
                Generate From Folder <span className="text-muted-foreground font-sans text-[10px] normal-case tracking-normal">(Uses notes)</span>
              </label>
              <select
                value={selectedFolderId ?? ''}
                onChange={e => handleFolderSelect(e.target.value || null)}
                className="w-full h-9 px-3 rounded-lg bg-secondary/80 border border-border text-[12px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              >
                <option value="">— Generic (Topic only) —</option>
                {localFoldersData.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.notes.length} notes)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Note Checklist when Folder is selected */}
          {currentFolder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-primary" />
                  Notes in {currentFolder.name} ({selectedNoteIds.size}/{currentFolder.notes.length} selected)
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAllNotes}
                  className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  {selectedNoteIds.size === currentFolder.notes.length ? 'Clear all' : 'Select all'}
                </button>
              </div>

              {currentFolder.notes.length === 0 ? (
                <p className="text-[11px] text-destructive font-medium py-1">
                  ⚠️ No study notes available in this folder to generate an exam from.
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
                        <span className="font-mono text-[9px] text-muted-foreground shrink-0 px-1.5 py-0.5 rounded bg-secondary">
                          {note.categoryName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Row 2: Exam Mode (Left) & Difficulty (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Exam Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {examModes.map(m => {
                  const isSelected = examMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setExamMode(m.id as 'practice' | 'mock')}
                      className={`relative p-2.5 rounded-xl text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-md scale-[1.01]'
                          : 'border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                      <p className={`font-bold text-[12px] ${isSelected ? 'text-foreground font-bold' : ''}`}>
                        {m.label}
                      </p>
                      <p className={`text-[9px] leading-tight mt-0.5 ${isSelected ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>
                        {m.tag}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {difficulties.map(d => {
                  const isSelected = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`relative p-2.5 rounded-xl text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-md scale-[1.01]'
                          : 'border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                      <p className={`font-bold text-[12px] capitalize ${isSelected ? 'text-foreground font-bold' : ''}`}>
                        {d.label}
                      </p>
                      <p className={`text-[9px] truncate mt-0.5 ${isSelected ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>
                        {d.tag}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3: Number of Questions (Left) & Exam Timer (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {questionCounts.map(count => {
                  const isSelected = questionCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`relative p-2 rounded-xl text-center transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-md scale-[1.01]'
                          : 'border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                      <span className={`text-lg font-bold font-serif ${isSelected ? 'text-foreground font-bold' : ''}`}>
                        {count}
                      </span>
                      <p className={`text-[9px] ${isSelected ? 'text-foreground/90 font-semibold' : 'text-muted-foreground'}`}>
                        Questions
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-primary" />
                Exam Timer <span className="text-muted-foreground font-sans text-[10px] normal-case tracking-normal">(Synced)</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {timerOptions.map(tOpt => {
                  const isSelected = timerMinutes === tOpt.minutes;
                  return (
                    <button
                      key={tOpt.minutes}
                      type="button"
                      onClick={() => setTimerMinutes(tOpt.minutes)}
                      className={`relative p-1.5 rounded-xl text-center transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-md scale-[1.01]'
                          : 'border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <p className={`font-bold text-[11px] ${isSelected ? 'text-foreground font-bold' : ''}`}>{tOpt.label}</p>
                      <p className={`text-[8px] truncate ${isSelected ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>{tOpt.tag}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            onClick={handleGenerateExam}
            disabled={!subject.trim() && !selectedFolderId}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Zap className="h-4 w-4" /> Generate AI Exam
          </button>
        </motion.div>
      </div>
    );
  }

  /* ────────────────── LOADING SCREEN ────────────────── */
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-12 text-center shadow-xl"
        >
          <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <Brain className="h-7 w-7 text-primary animate-pulse" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={loadingStep}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-base font-semibold text-foreground mb-1">
                {LOADING_STEPS[loadingStep]}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono capitalize">
                {questionCount} {difficulty} questions · {examMode} mode · {subject || currentFolder?.name}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="w-56 h-1.5 bg-secondary rounded-full mx-auto mt-6 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  /* ────────────────── RESULTS SCREEN (NO GRADE / NO PERCENTAGE) ────────────────── */
  if (examCompleted) {
    const totalCorrect = answers.reduce((acc, a) => (a && a.correct ? acc + 1 : acc), 0);
    const totalIncorrect = questions.length - totalCorrect;

    return (
      <div className="max-w-2xl mx-auto pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl"
        >
          <div className="text-center mb-6">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-primary" />
            <h2 className="text-2xl font-bold font-serif text-foreground">Exam Complete</h2>
            <p className="text-[11px] font-mono text-muted-foreground capitalize mt-1">
              {subject || currentFolder?.name} · {difficulty} · {examMode} Mode
            </p>
          </div>

          {/* Clean Result Counts: ONLY CORRECT & INCORRECT (Requirement 4) */}
          <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-4xl font-extrabold font-mono text-emerald-500">{totalCorrect}</p>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1">
                CORRECT
              </p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-4xl font-extrabold font-mono text-destructive">{totalIncorrect}</p>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-destructive mt-1">
                INCORRECT
              </p>
            </div>
          </div>

          {/* Detailed Question Review Accordion */}
          <div className="space-y-2 mb-6">
            <h3 className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
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
                    <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                      {ans?.correct ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="text-[12px] text-foreground font-medium line-clamp-2">
                        Q{i + 1}: {qItem.question}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border bg-card p-4 space-y-2.5 text-[12px] text-foreground"
                      >
                        <p><strong>Question:</strong> {qItem.question}</p>
                        <div className="space-y-1 my-2 pl-2 border-l-2 border-border">
                          {qItem.options.map((opt, oIdx) => (
                            <p key={oIdx} className={`text-xs ${oIdx === qItem.correctIndex ? 'font-bold text-emerald-500' : (ans?.selected === oIdx ? 'text-destructive font-medium' : 'text-muted-foreground')}`}>
                              {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === qItem.correctIndex ? '✓ (Correct)' : (ans?.selected === oIdx ? '✗ (Your answer)' : '')}
                            </p>
                          ))}
                        </div>
                        <div className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <p><strong>Explanation:</strong> {qItem.explanation}</p>
                        </div>
                        {ans && !ans.correct && (
                          <div className="flex items-start gap-1.5 text-destructive">
                            <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <p><strong>Selected option notes:</strong> {qItem.wrongExplanations?.[String(ans.selected)] || 'Review the correct answer option.'}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-1.5 text-primary pt-1">
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
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md"
          >
            <RotateCcw className="h-4 w-4" /> Take Another Exam
          </button>
        </motion.div>
      </div>
    );
  }

  /* ────────────────── ACTIVE QUESTION SCREEN ────────────────── */
  const q = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Active Exam Header Bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
          <GraduationCap className="h-4.5 w-4.5 text-primary shrink-0" />
          <span className="truncate">{subject || currentFolder?.name}</span>
        </h2>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live Countdown Timer accurately formatted */}
          {timerMinutes > 0 && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-all ${
              examTimeLeft < 60
                ? 'border-destructive bg-destructive/10 text-destructive animate-pulse'
                : 'border-primary/40 bg-primary/10 text-primary'
            }`}>
              <Timer className="h-3.5 w-3.5" />
              <span>{formatTimer(examTimeLeft)}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            <span className="capitalize">{difficulty}</span>
            <span>·</span>
            <span className="capitalize">{examMode}</span>
            <span>·</span>
            <span>Q{currentIndex + 1}/{questions.length}</span>
          </div>
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
                  className={`w-full p-3.5 rounded-xl text-left border text-[13px] transition-all flex items-center justify-between ${
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
              <div className="rounded-xl border border-border bg-secondary/60 p-4 text-[12px] text-foreground">
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
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md"
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
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-colors shadow-md disabled:opacity-40"
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
