import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, ChevronLeft, ChevronRight, Layers, Plus, Trash2, RotateCw } from 'lucide-react';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

const defaultFlashcards: Flashcard[] = [
  { id: '1', question: 'What is photosynthesis?', answer: 'The process by which plants convert sunlight, water, and CO2 into glucose and oxygen.' },
  { id: '2', question: 'What is the speed of light?', answer: 'Approximately 299,792 kilometers per second (186,282 miles per second).' },
  { id: '3', question: 'What is Newton\'s First Law?', answer: 'An object at rest stays at rest, and an object in motion stays in motion unless acted upon by an external force.' },
  { id: '4', question: 'What is the Pythagorean theorem?', answer: 'In a right triangle, a² + b² = c², where c is the hypotenuse.' },
  { id: '5', question: 'What is DNA?', answer: 'Deoxyribonucleic acid - a molecule that carries genetic instructions for development and functioning of living organisms.' },
];

export default function FlashcardsView() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(defaultFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const currentCard = flashcards[currentIndex];

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setFlipped(false);
  };

  const handlePrev = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const handleNext = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handleAddCard = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const newCard: Flashcard = {
      id: Date.now().toString(),
      question: newQuestion,
      answer: newAnswer,
    };
    setFlashcards(prev => [...prev, newCard]);
    setNewQuestion('');
    setNewAnswer('');
    setShowAddForm(false);
  };

  const handleDeleteCard = () => {
    if (flashcards.length <= 1) return;
    const newCards = flashcards.filter((_, i) => i !== currentIndex);
    setFlashcards(newCards);
    setCurrentIndex(prev => Math.min(prev, newCards.length - 1));
    setFlipped(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2.5">
          <Layers className="h-5.5 w-5.5 text-[hsl(40_20%_80%)]" />
          Flashcards
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[12px] font-medium text-[hsl(40_20%_80%)] hover:bg-[hsl(220_8%_17%)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Card
        </button>
      </div>

      {/* Add new card form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_10%)] p-4 space-y-3">
              <input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter question…"
                className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
              />
              <input
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Enter answer…"
                className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddCard}
                  disabled={!newQuestion.trim() || !newAnswer.trim()}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40"
                >
                  Save Flashcard
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card counter */}
      <div className="text-center text-[11px] font-mono text-[hsl(40_8%_44%)] mb-3">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      {/* Flashcard container */}
      <div className="perspective-1000 mb-6">
        <motion.div
          onClick={() => setFlipped(!flipped)}
          className="relative cursor-pointer"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={flipped ? 'answer' : 'question'}
              initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="min-h-[300px] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] shadow-2xl"
            >
              {/* Subtle top accent line */}
              <span className="absolute left-0 top-0 h-px w-16 bg-[hsl(40_20%_55%)]" />

              {/* Background ambient glow */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-foreground/[0.03] rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-foreground/[0.02] rounded-full blur-3xl" />
              </div>
              
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40_8%_44%)] mb-4 relative z-10">
                {flipped ? 'Answer' : 'Question'}
              </span>
              <p className="text-lg text-center font-medium leading-relaxed relative z-10 text-[hsl(40_20%_86%)] max-w-lg">
                {flipped ? currentCard.answer : currentCard.question}
              </p>
              <span className="text-[10px] font-mono text-[hsl(40_8%_38%)] mt-6 relative z-10 flex items-center gap-1">
                <RotateCw className="h-3 w-3" /> Click to flip
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2.5">
        <button
          onClick={handlePrev}
          className="h-9 w-9 rounded-xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_12%)] hover:bg-[hsl(220_8%_16%)] flex items-center justify-center text-[hsl(40_20%_80%)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleShuffle}
          className="h-9 px-3.5 rounded-xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_12%)] hover:bg-[hsl(220_8%_16%)] flex items-center gap-1.5 text-[12px] font-mono text-[hsl(40_20%_80%)] transition-colors"
        >
          <Shuffle className="h-3.5 w-3.5" /> Shuffle
        </button>
        <button
          onClick={handleNext}
          className="h-9 px-4 rounded-xl bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors"
        >
          Next Card
        </button>
        <button
          onClick={handleDeleteCard}
          disabled={flashcards.length <= 1}
          className="h-9 w-9 rounded-xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_12%)] hover:bg-red-400/10 hover:text-red-400 flex items-center justify-center text-[hsl(40_8%_50%)] transition-colors disabled:opacity-40 disabled:hover:bg-[hsl(220_8%_12%)] disabled:hover:text-[hsl(40_8%_50%)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-5 flex-wrap max-w-md mx-auto">
        {flashcards.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setFlipped(false); }}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[hsl(40_20%_75%)] w-4'
                : 'bg-[hsl(220_8%_20%)] w-1.5 hover:bg-[hsl(220_8%_30%)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
