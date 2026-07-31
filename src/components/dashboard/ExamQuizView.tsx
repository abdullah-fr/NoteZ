import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { generateExam, saveExamResult, type ExamQuestion } from '@/services';
import { toast } from 'sonner';
import {
  GraduationCap, Loader2, Check, X, Lightbulb, ArrowRight,
  RotateCcw, Trophy, Zap, Target, ChevronDown, ChevronUp
} from 'lucide-react';

const difficulties = [
  { id: 'easy', label: 'Easy', color: 'text-green-400', icon: '🟢' },
  { id: 'medium', label: 'Medium', color: 'text-yellow-400', icon: '🟡' },
  { id: 'hard', label: 'Hard', color: 'text-red-400', icon: '🔴' },
];

const questionCounts = [5, 10, 15];

export default function ExamView() {
  const { user } = useAuth();
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
  const [answers, setAnswers] = useState<{ selected: number; correct: boolean }[]>([]);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState<number | null>(null);

  const generateExam = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    setLoading(true);
    try {
      const data = await generateExam({ subject, difficulty, questionCount });

      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setScore(0);
      setExamCompleted(false);
      setAnswers([]);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to generate exam');
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
      // Save result
      if (user) {
        saveExamResult(user.id, {
          subject,
          score,
          totalQuestions: questions.length,
          difficulty,
          questions,
        });
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
    if (pct >= 90) return { grade: 'A+', color: 'text-green-400', msg: 'Outstanding! You crushed it! 🏆' };
    if (pct >= 80) return { grade: 'A', color: 'text-green-400', msg: 'Excellent performance! 🌟' };
    if (pct >= 70) return { grade: 'B', color: 'text-primary', msg: 'Good job, keep pushing! 💪' };
    if (pct >= 60) return { grade: 'C', color: 'text-yellow-400', msg: 'Not bad, but you can do better! 📚' };
    if (pct >= 50) return { grade: 'D', color: 'text-orange-400', msg: 'Needs work. Review the material. 🔄' };
    return { grade: 'F', color: 'text-destructive', msg: 'Time to hit the books! Don\'t give up! 💡' };
  };

  // Setup screen
  if (questions.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          AI Exam Mode
        </h2>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">Subject / Topic</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., JavaScript Closures, Organic Chemistry, Linear Algebra..."
              className="w-full h-12 text-lg px-4 rounded-xl bg-muted/30 border border-border/50 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {difficulties.map(d => (
                <motion.button
                  key={d.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDifficulty(d.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    difficulty === d.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/30 bg-muted/20 hover:border-border'
                  }`}
                >
                  <span className="text-2xl">{d.icon}</span>
                  <p className={`font-medium mt-1 ${d.color}`}>{d.label}</p>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">Number of Questions</label>
            <div className="grid grid-cols-3 gap-3">
              {questionCounts.map(count => (
                <motion.button
                  key={count}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setQuestionCount(count)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    questionCount === count
                      ? 'border-primary bg-primary/10'
                      : 'border-border/30 bg-muted/20 hover:border-border'
                  }`}
                >
                  <span className="text-2xl font-bold">{count}</span>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </motion.button>
              ))}
            </div>
          </div>

          <Button onClick={generateExam} disabled={!subject.trim()} className="w-full h-14 text-lg" size="lg">
            <Zap className="h-5 w-5 mr-2" /> Generate AI Exam
          </Button>
        </motion.div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-16 text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-semibold mb-2">Generating Your Exam...</h3>
          <p className="text-muted-foreground">AI is crafting {questionCount} {difficulty} questions about {subject}</p>
        </motion.div>
      </div>
    );
  }

  // Results
  if (examCompleted) {
    const { grade, color, msg } = getGrade();
    const pct = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-3xl font-bold mb-2">Exam Complete!</h2>
            <p className="text-muted-foreground">{subject} • {difficulty}</p>
          </div>

          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="text-center mb-8">
            <span className={`text-8xl font-bold ${color}`}>{grade}</span>
            <p className="text-xl mt-2">{msg}</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{score}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-destructive">{questions.length - score}</p>
              <p className="text-sm text-muted-foreground">Wrong</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-primary">{pct}%</p>
              <p className="text-sm text-muted-foreground">Score</p>
            </div>
          </div>

          {/* Detailed review */}
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-lg">Question Review</h3>
            {questions.map((q, i) => {
              const ans = answers[i];
              return (
                <div key={i} className="rounded-xl border border-border/30 overflow-hidden">
                  <button
                    onClick={() => setShowDetailedFeedback(showDetailedFeedback === i ? null : i)}
                    className={`w-full p-4 flex items-center justify-between text-left ${
                      ans?.correct ? 'bg-green-500/10' : 'bg-destructive/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {ans?.correct ? <Check className="h-5 w-5 text-green-400" /> : <X className="h-5 w-5 text-destructive" />}
                      <span className="font-medium text-sm">Q{i + 1}: {q.question.substring(0, 60)}...</span>
                    </div>
                    {showDetailedFeedback === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <AnimatePresence>
                    {showDetailedFeedback === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-3 border-t border-border/30">
                          <p className="text-sm"><strong>Question:</strong> {q.question}</p>
                          <div className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <p><strong>Correct:</strong> {q.explanation}</p>
                          </div>
                          {!ans?.correct && (
                            <div className="flex items-start gap-2 text-sm">
                              <X className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <p><strong>Why wrong:</strong> {q.wrongExplanations?.[String(ans?.selected)] || 'Review the correct answer above.'}</p>
                            </div>
                          )}
                          <div className="flex items-start gap-2 text-sm">
                            <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <p><strong>Better approach:</strong> {q.betterApproach}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <Button onClick={resetExam} className="w-full" size="lg">
            <RotateCcw className="h-4 w-4 mr-2" /> Take Another Exam
          </Button>
        </motion.div>
      </div>
    );
  }

  // Active exam
  const q = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          {subject} Exam
        </h2>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>{difficulty}</span>
          <span>•</span>
          <span>Q{currentIndex + 1}/{questions.length}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full h-2 bg-muted/30 rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-purple-400"
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="glass rounded-2xl p-8"
        >
          <p className="text-lg font-medium mb-6">{q.question}</p>

          <div className="space-y-3 mb-6">
            {q.options.map((opt, i) => (
              <motion.button
                key={i}
                whileHover={!showFeedback ? { scale: 1.01 } : {}}
                whileTap={!showFeedback ? { scale: 0.99 } : {}}
                onClick={() => handleAnswer(i)}
                disabled={showFeedback}
                className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                  showFeedback
                    ? i === q.correctIndex
                      ? 'bg-green-500/20 border-green-500'
                      : i === selectedAnswer
                        ? 'bg-destructive/20 border-destructive'
                        : 'bg-muted/30 border-transparent'
                    : 'bg-muted/30 border-transparent hover:bg-muted/50 hover:border-primary/50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-sm font-medium">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {showFeedback && i === q.correctIndex && <Check className="h-5 w-5 text-green-400 ml-auto" />}
                  {showFeedback && i === selectedAnswer && i !== q.correctIndex && <X className="h-5 w-5 text-destructive ml-auto" />}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Instant feedback */}
          {showFeedback && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {selectedAnswer === q.correctIndex ? (
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-400 mb-1">✅ Correct!</p>
                      <p className="text-sm text-muted-foreground">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/30">
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-destructive mb-1">❌ Incorrect</p>
                      <p className="text-sm text-muted-foreground">{q.wrongExplanations?.[String(selectedAnswer)] || q.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-primary/10 rounded-xl p-4 border border-primary/30">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-primary mb-1">💡 Better Approach</p>
                    <p className="text-sm text-muted-foreground">{q.betterApproach}</p>
                  </div>
                </div>
              </div>

              <Button onClick={nextQuestion} className="w-full" size="lg">
                {currentIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="h-4 w-4 ml-2" /></>
                ) : (
                  'See Results'
                )}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        Score: {score}/{currentIndex + (showFeedback ? 1 : 0)}
      </div>
    </div>
  );
}
