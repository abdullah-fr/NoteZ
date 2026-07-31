import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Brain, RotateCcw, Trophy } from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

const generateQuizQuestions = (topic: string, count: number): QuizQuestion[] => {
  // Sample questions - in production, these would be AI-generated based on the topic
  const allQuestions: QuizQuestion[] = [
    { question: `What is the primary concept of ${topic}?`, options: ['Definition A', 'Definition B', 'Definition C', 'Definition D'], correct: 0 },
    { question: `Which of these is NOT related to ${topic}?`, options: ['Related 1', 'Related 2', 'Unrelated', 'Related 3'], correct: 2 },
    { question: `When was ${topic} first introduced?`, options: ['1990s', '2000s', '2010s', '2020s'], correct: 1 },
    { question: `Who is known for pioneering ${topic}?`, options: ['Expert A', 'Expert B', 'Expert C', 'Expert D'], correct: 0 },
    { question: `What is a key benefit of ${topic}?`, options: ['Benefit A', 'Benefit B', 'Benefit C', 'All of the above'], correct: 3 },
    { question: `Which industry uses ${topic} the most?`, options: ['Healthcare', 'Finance', 'Education', 'Technology'], correct: 3 },
    { question: `What is a common misconception about ${topic}?`, options: ['Myth A', 'Myth B', 'Myth C', 'Myth D'], correct: 1 },
    { question: `How does ${topic} improve productivity?`, options: ['Automation', 'Organization', 'Communication', 'All of the above'], correct: 3 },
    { question: `What skill is essential for ${topic}?`, options: ['Critical thinking', 'Memorization', 'Speed', 'None'], correct: 0 },
    { question: `What is the future trend of ${topic}?`, options: ['AI Integration', 'Decline', 'Stagnation', 'Manual processes'], correct: 0 },
    { question: `Which platform best supports ${topic}?`, options: ['Web', 'Mobile', 'Desktop', 'All platforms'], correct: 3 },
    { question: `What resource is best for learning ${topic}?`, options: ['Books', 'Videos', 'Practice', 'All of the above'], correct: 3 },
    { question: `What challenge is common in ${topic}?`, options: ['Complexity', 'Cost', 'Time', 'All of the above'], correct: 3 },
    { question: `How long does it take to master ${topic}?`, options: ['Days', 'Weeks', 'Months', 'Years'], correct: 2 },
    { question: `What certification exists for ${topic}?`, options: ['Basic', 'Advanced', 'Expert', 'All levels'], correct: 3 },
    { question: `Which company leads in ${topic}?`, options: ['Company A', 'Company B', 'Company C', 'Multiple'], correct: 3 },
    { question: `What tool is essential for ${topic}?`, options: ['Tool A', 'Tool B', 'Tool C', 'Depends on use case'], correct: 3 },
    { question: `What metric measures success in ${topic}?`, options: ['Speed', 'Accuracy', 'Efficiency', 'All of the above'], correct: 3 },
    { question: `What is the beginner's first step in ${topic}?`, options: ['Research', 'Practice', 'Observation', 'All of the above'], correct: 0 },
    { question: `What makes ${topic} unique?`, options: ['Approach', 'Results', 'Methodology', 'All of the above'], correct: 3 },
  ];
  
  return allQuestions.slice(0, count);
};

export default function QuizView() {
  const [topic, setTopic] = useState('');
  const [quizCount, setQuizCount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const startQuiz = (count: number) => {
    if (!topic.trim()) return;
    setQuizCount(count);
    setQuestions(generateQuizQuestions(topic, count));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizCompleted(false);
    setAnswers([]);
  };

  const checkAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    const isCorrect = index === questions[currentIndex].correct;
    if (isCorrect) setScore(prev => prev + 1);
    setAnswers(prev => [...prev, isCorrect]);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const resetQuiz = () => {
    setTopic('');
    setQuizCount(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizCompleted(false);
    setAnswers([]);
  };

  const getGrade = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 90) return { grade: 'A+', color: 'text-notez-success', message: 'Outstanding!' };
    if (percentage >= 80) return { grade: 'A', color: 'text-notez-success', message: 'Excellent!' };
    if (percentage >= 70) return { grade: 'B', color: 'text-notez-accent', message: 'Good job!' };
    if (percentage >= 60) return { grade: 'C', color: 'text-yellow-500', message: 'Keep practicing!' };
    if (percentage >= 50) return { grade: 'D', color: 'text-orange-500', message: 'Needs improvement' };
    return { grade: 'F', color: 'text-destructive', message: 'Try again!' };
  };

  // Topic and count selection
  if (!quizCount) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary" />
          Quiz Mode
        </h2>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8"
        >
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">
              Enter your topic or subject
            </label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., JavaScript, Biology, World History..."
              className="bg-muted/30 border-border/50 h-12 text-lg"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-4 text-muted-foreground">
              Select number of questions
            </label>
            <div className="grid grid-cols-3 gap-4">
              {[5, 10, 20].map(count => (
                <motion.button
                  key={count}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startQuiz(count)}
                  disabled={!topic.trim()}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    topic.trim()
                      ? 'border-primary/50 bg-gradient-to-br from-primary/10 to-notez-purple/10 hover:border-primary hover:shadow-glow cursor-pointer'
                      : 'border-border/30 bg-muted/20 cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-3xl font-bold">{count}</span>
                  <p className="text-sm text-muted-foreground mt-1">Questions</p>
                </motion.button>
              ))}
            </div>
          </div>
          
          {!topic.trim() && (
            <p className="text-sm text-muted-foreground text-center">
              Enter a topic above to start the quiz
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // Quiz completed - show results
  if (quizCompleted) {
    const { grade, color, message } = getGrade();
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-8 text-center"
        >
          <Trophy className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground mb-6">Topic: {topic}</p>
          
          <div className="mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className={`text-8xl font-bold ${color}`}
            >
              {grade}
            </motion.div>
            <p className="text-xl mt-2">{message}</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-3xl font-bold text-notez-success">{score}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-3xl font-bold text-destructive">{questions.length - score}</p>
              <p className="text-sm text-muted-foreground">Wrong</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-3xl font-bold text-primary">{percentage}%</p>
              <p className="text-sm text-muted-foreground">Score</p>
            </div>
          </div>
          
          <div className="flex gap-4 mb-6">
            {answers.map((correct, i) => (
              <div 
                key={i} 
                className={`w-3 h-3 rounded-full ${correct ? 'bg-notez-success' : 'bg-destructive'}`}
              />
            ))}
          </div>
          
          <Button onClick={resetQuiz} className="w-full" size="lg">
            <RotateCcw className="h-4 w-4 mr-2" /> Start New Quiz
          </Button>
        </motion.div>
      </div>
    );
  }

  // Quiz in progress
  const q = questions[currentIndex];
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary" />
          Quiz: {topic}
        </h2>
        <div className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-muted/30 rounded-full mb-6 overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-primary to-notez-purple"
          initial={{ width: 0 }}
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
          <p className="text-xl mb-6">{q.question}</p>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <motion.button
                key={i}
                whileHover={!showResult ? { scale: 1.01 } : {}}
                whileTap={!showResult ? { scale: 0.99 } : {}}
                onClick={() => checkAnswer(i)}
                disabled={showResult}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  showResult
                    ? i === q.correct 
                      ? 'bg-notez-success/20 border-notez-success' 
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
                  {showResult && i === q.correct && <Check className="h-5 w-5 text-notez-success" />}
                  {showResult && i === selectedAnswer && i !== q.correct && <X className="h-5 w-5 text-destructive" />}
                  {opt}
                </span>
              </motion.button>
            ))}
          </div>
          
          {showResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Button onClick={nextQuestion} className="w-full" size="lg">
                {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Score indicator */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Current Score: {score}/{currentIndex + (showResult ? 1 : 0)}
      </div>
    </div>
  );
}
