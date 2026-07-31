import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, ChevronLeft, ChevronRight, Layers, Plus, Trash2 } from 'lucide-react';

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Layers className="h-7 w-7 text-primary" />
          Flashcards
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" /> Add Card
        </Button>
      </div>

      {/* Add new card form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="glass rounded-xl p-4 space-y-3">
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter question..."
                className="bg-muted/30"
              />
              <Input
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Enter answer..."
                className="bg-muted/30"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddCard} size="sm" className="flex-1">
                  Add Flashcard
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card counter */}
      <div className="text-center text-sm text-muted-foreground mb-4">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      {/* Flashcard */}
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
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="min-h-[320px] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(270 50% 15%) 50%, hsl(var(--background)) 100%)',
                boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.25), inset 0 0 60px rgba(139, 92, 246, 0.1)',
                border: '1px solid hsl(var(--primary) / 0.3)',
              }}
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-notez-purple/10 rounded-full blur-3xl" />
              </div>
              
              <span className="text-xs uppercase tracking-wider text-muted-foreground mb-4 relative z-10">
                {flipped ? 'Answer' : 'Question'}
              </span>
              <p className="text-xl text-center font-medium relative z-10 leading-relaxed">
                {flipped ? currentCard.answer : currentCard.question}
              </p>
              <span className="text-xs text-muted-foreground mt-6 relative z-10">
                Click to flip
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={handlePrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="outline" onClick={handleShuffle}>
          <Shuffle className="h-4 w-4 mr-2" /> Shuffle
        </Button>
        <Button onClick={handleNext}>
          Next Card
        </Button>
        <Button variant="outline" size="icon" onClick={handleDeleteCard} disabled={flashcards.length <= 1}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-6 flex-wrap max-w-md mx-auto">
        {flashcards.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setFlipped(false); }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex 
                ? 'bg-primary w-4' 
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
