import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { generateExam as requestGenerateExam, saveExamResult, createActivity, addChecklistItems, type ExamQuestion } from '@/services';
import { toast } from 'sonner';
import { useUpgradeModal, parseLimitError } from '@/hooks/use-upgrade-modal';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import {
  GraduationCap, Loader2, Check, X, Lightbulb, ArrowRight,
  RotateCcw, Trophy, Zap, Target, ChevronDown, ChevronUp, Brain, Sparkles,
} from 'lucide-react';

const difficulties = [
  { id: 'easy', label: 'Easy', tag: 'Fundamental concepts' },
  { id: 'medium', label: 'Medium', tag: 'Standard practice' },
  { id: 'hard', label: 'Hard', tag: 'Advanced challenge' },
];

const questionCounts = [5, 10, 15];

const LOADING_STEPS = [
  'Analyzing subject and target difficulty…',
  'Crafting contextual questions…',
  'Generating distractor options & explanations…',
  'Finalizing AI exam suite…',
];

export default function ExamQuizView() {
  const { user } = useAuth();
  const { upgradeModal, handleLimitError, closeUpgradeModal } = useUpgradeModal();
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
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

  // ── Prompt 15: folder scope ──────────────────────────────────────────────
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const localFolders: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem('notez_folders') || '[]').map((f: any) => ({ id: f.id, name: f.name })); }
    catch { return []; }
  })();

  function getFolderSourceText(folderId: string): string {
    try {
      const folders: any[] = JSON.parse(localStorage.getItem('notez_folders') || '[]');
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return '';
      const texts: string[] = [];
      let chars = 0;
      const BUDGET = 10000;
      outer: for (const cat of (folder.categories || [])) {
        for (const note of (cat.notes || [])) {
          const chunk = `${note.title}: ${note.content || ''}`;
          if (chars + chunk.length > BUDGET) break outer;
          texts.push(chunk);
          chars += chunk.length;
        }
      }
      return texts.join('\n');
    } catch { return ''; }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Multi-step loading message rotator
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Palette action: "Generate AI Exam" from ⌘K — focus the subject input
  useEffect(() => {
    const handler = () => { setTimeout(() => subjectInputRef.current?.focus(), 120); };
    window.addEventListener('notez:focus-exam-input', handler);
    return () => window.removeEventListener('notez:focus-exam-input', handler);
  }, []);

  const handleGenerateExam = async () => {
    if (!subject.trim()) { toast.error('Please enter a subject'); return; }
    setLoading(true);
    try {
      const sourceText = selectedFolderId ? getFolderSourceText(selectedFolderId) : undefined;
      const data = await requestGenerateExam({ subject, difficulty, questionCount, sourceText });

      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setScore(0);
      setExamCompleted(false);
      setAnswers([]);
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
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    const isCorrect = index === questions[currentIndex].correctIndex;
    if (isCorrect) setScore(prev => prev + 1);
    setAnswers(prev => [...prev, { selected: index, correct: isCorrect }]);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setExamCompleted(true);
      if (user) {
        saveExamResult(user.id, {
          subject,
          score,
          totalQuestions: questions.length,
          difficulty,
          questions,
        });

        // ── Prompt 15: auto-remediation — create Activity for weak topics ──
        const wrongIndices = answers
          .map((a, i) => (!a.correct ? i : null))
          .filter((i): i is number => i !== null);
        if (wrongIndices.length >= 2) {
          // Cluster wrong answers by a shared keyword or just use question text
          const weakTopics = wrongIndices.slice(0, 5).map(i => {
            const q = questions[i];
            return q ? q.question.slice(0, 120) : null;
          }).filter(Boolean) as string[];

          createActivity(user.id, {
              title: `Review: ${subject} (from your last exam)`,
              subject: subject || null,
              description: `Auto-generated from exam — ${wrongIndices.length} questions need work`,
            }).then(act => {
              addChecklistItems(weakTopics.map((label, idx) => ({
                activity_id: act.id,
                user_id: user.id,
                label: `Review: ${label}`,
                position: idx,
              })));
            }).catch(() => {/* silent */});
        }
        // ──────────────────────────────────────────────────────────────────
      }
    }
  };

  const resetExam = () => {
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setScore(0);
    setExamCompleted(false);
    setAnswers([]);
    setSubject('');
  };

  const getGrade = () => {
    const pct = (score / questions.length) * 100;
    if (pct >= 90) return { grade: 'A+', msg: 'Outstanding performance! You crushed it.' };
    if (pct >= 80) return { grade: 'A', msg: 'Great work! Strong grasp of material.' };
    if (pct >= 70) return { grade: 'B', msg: 'Good job, solid foundation.' };
    if (pct >= 60) return { grade: 'C', msg: 'Decent result, but review weak spots.' };
    if (pct >= 50) return { grade: 'D', msg: 'Needs work. Re-read course notes.' };
    return { grade: 'F', msg: 'Time to study up! Don\'t give up.' };
  };

  // Setup screen
  if (questions.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl tracking-tight flex items-center gap-2.5">
            <GraduationCap className="h-5 w-5 text-foreground" />
            AI Exam Mode
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Predictive test generator
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-secondary p-4 sm:p-6 space-y-6"
        >
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Subject / Topic
            </label>
            <input
              ref={subjectInputRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateExam()}
              placeholder="e.g., JavaScript Closures, Organic Chemistry, Linear Algebra…"
              className="w-full h-11 px-3.5 rounded-xl bg-secondary border border-border text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
            />
          </div>

          {/* Prompt 15: Folder scope toggle */}
          {localFolders.length > 0 && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Generate from folder <span className="text-muted-foreground normal-case tracking-normal">(optional — uses your own notes)</span>
              </label>
              <select
                value={selectedFolderId ?? ''}
                onChange={e => setSelectedFolderId(e.target.value || null)}
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-border transition-colors"
              >
                <option value="">— Generic (topic only) —</option>
                {localFolders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {difficulties.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    difficulty === d.id
                      ? 'border-border bg-secondary text-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <p className="font-semibold text-[13px] capitalize">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{d.tag}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Number of Questions
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {questionCounts.map(count => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    questionCount === count
                      ? 'border-border bg-secondary text-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span className="text-xl font-bold font-serif">{count}</span>
                  <p className="text-[10px] text-muted-foreground">Questions</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateExam}
            disabled={!subject.trim()}
            className="w-full h-11 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="h-4 w-4" /> Generate AI Exam
          </button>
        </motion.div>
      </div>
    );
  }

  // Loading screen with multi-step animation
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-secondary p-12 text-center"
        >
          <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-border border-t-[hsl(var(--foreground))] animate-spin" />
            <Brain className="h-7 w-7 text-foreground animate-pulse" />
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
              <p className="text-[11px] text-muted-foreground font-mono">
                {questionCount} {difficulty} questions · {subject}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="w-48 h-1 bg-secondary rounded-full mx-auto mt-6 overflow-hidden">
            <motion.div
              className="h-full bg-[hsl(var(--foreground))]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // Results screen
  if (examCompleted) {
    const { grade, msg } = getGrade();
    const pct = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-secondary p-6 md:p-8"
        >
          <div className="text-center mb-6">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-foreground" />
            <h2 className="text-2xl font-bold font-serif text-foreground">Exam Complete</h2>
            <p className="text-[11px] font-mono text-muted-foreground capitalize mt-1">
              {subject} · {difficulty}
            </p>
          </div>

          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="text-center mb-6"
          >
            <span className="text-7xl font-serif font-bold text-foreground">{grade}</span>
            <p className="text-[13px] text-muted-foreground mt-2">{msg}</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-border bg-secondary p-3 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">{score}</p>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">Correct</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary p-3 text-center">
              <p className="text-2xl font-bold font-mono text-muted-foreground">{questions.length - score}</p>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">Incorrect</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary p-3 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">{pct}%</p>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">Score</p>
            </div>
          </div>

          {/* Detailed review accordion */}
          <div className="space-y-2 mb-6">
            <h3 className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">Question Breakdown</h3>
            {questions.map((q, i) => {
              const ans = answers[i];
              const isExpanded = showDetailedFeedback === i;
              return (
                <div key={i} className="rounded-xl border border-border overflow-hidden bg-secondary">
                  <button
                    onClick={() => setShowDetailedFeedback(isExpanded ? null : i)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                      {ans?.correct ? (
                        <Check className="h-4 w-4 text-foreground shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-[12px] text-foreground line-clamp-2">
                        Q{i + 1}: {q.question}
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
                        className="overflow-hidden border-t border-border bg-secondary"
                      >
                        <div className="p-3.5 space-y-2 text-[12px] text-foreground">
                          <p><strong>Question:</strong> {q.question}</p>
                          <div className="flex items-start gap-1.5 text-foreground">
                            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <p><strong>Explanation:</strong> {q.explanation}</p>
                          </div>
                          {!ans?.correct && (
                            <div className="flex items-start gap-1.5 text-muted-foreground">
                              <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <p><strong>Selected answer notes:</strong> {q.wrongExplanations?.[String(ans?.selected)] || 'Review the correct answer.'}</p>
                            </div>
                          )}
                          <div className="flex items-start gap-1.5 text-foreground pt-1">
                            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <p><strong>Recommended approach:</strong> {q.betterApproach}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <button
            onClick={resetExam}
            className="w-full h-11 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Take Another Exam
          </button>
        </motion.div>
      </div>
    );
  }

  // Active question screen
  const q = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
          <GraduationCap className="h-4.5 w-4.5 text-foreground shrink-0" />
          {subject}
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground shrink-0">
          <Target className="h-3.5 w-3.5" />
          <span className="capitalize">{difficulty}</span>
          <span>·</span>
          <span>Q{currentIndex + 1}/{questions.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-secondary rounded-full mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-[hsl(var(--foreground))]"
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="rounded-2xl border border-border bg-secondary p-6 md:p-7"
        >
          <p className="text-[15px] font-medium text-foreground mb-6 leading-relaxed">
            {q.question}
          </p>

          <div className="space-y-2.5 mb-6">
            {q.options.map((opt, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === q.correctIndex;
              const isWrong = isSelected && !isCorrect;

              return (
                <motion.button
                  key={i}
                  whileHover={!showFeedback ? { scale: 1.005 } : {}}
                  whileTap={!showFeedback ? { scale: 0.99 } : {}}
                  animate={showFeedback && isWrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                  onClick={() => handleAnswer(i)}
                  disabled={showFeedback}
                  className={`w-full p-3.5 rounded-xl text-left border text-[13px] transition-all flex items-center justify-between ${
                    showFeedback
                      ? isCorrect
                        ? 'border-border bg-secondary text-foreground'
                        : isWrong
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-border bg-secondary text-muted-foreground'
                      : 'border-border bg-secondary text-foreground hover:bg-secondary hover:border-border'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                    <span className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="break-words line-clamp-3">{opt}</span>
                  </span>
                  {showFeedback && isCorrect && <Check className="h-4 w-4 text-foreground shrink-0" />}
                  {showFeedback && isWrong && <X className="h-4 w-4 text-destructive shrink-0" />}
                </motion.button>
              );
            })}
          </div>

          {/* Instant feedback */}
          {showFeedback && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
              <div className="rounded-xl border border-border bg-secondary p-4 text-[12px] text-foreground">
                <div className="flex items-start gap-2">
                  {selectedAnswer === q.correctIndex ? (
                    <Check className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold mb-0.5">
                      {selectedAnswer === q.correctIndex ? 'Correct' : 'Incorrect'}
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
                className="w-full h-11 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-accent transition-colors"
              >
                {currentIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="h-4 w-4" /></>
                ) : (
                  'View Results'
                )}
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-3 text-center text-[10px] font-mono text-muted-foreground">
        Score: {score}/{currentIndex + (showFeedback ? 1 : 0)}
      </div>

      {/* Upgrade modal — fires when exam generation limit is reached */}
      <UpgradeModal
        open={upgradeModal.open}
        field={upgradeModal.field}
        limit={upgradeModal.limit}
        onClose={closeUpgradeModal}
      />
    </div>
  );
}
