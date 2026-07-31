import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileQuestion, ChevronDown, Search, Tag } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  name: string;
  faqs: FAQ[];
}

const faqDatabase: Record<string, FAQCategory> = {
  programming: {
    name: 'Programming',
    faqs: [
      { question: 'What is a variable?', answer: 'A variable is a named storage location in memory that holds a value. Variables can store different types of data like numbers, text, or boolean values.' },
      { question: 'What is a function?', answer: 'A function is a reusable block of code that performs a specific task. Functions can accept inputs (parameters) and return outputs.' },
      { question: 'What is an array?', answer: 'An array is a data structure that stores multiple values in a single variable. Elements in an array are accessed by their index.' },
      { question: 'What is object-oriented programming?', answer: 'OOP is a programming paradigm based on objects containing data and code. It uses concepts like classes, inheritance, encapsulation, and polymorphism.' },
      { question: 'What is recursion?', answer: 'Recursion is when a function calls itself to solve a problem by breaking it down into smaller sub-problems. It requires a base case to stop.' },
      { question: 'What is an API?', answer: 'An API (Application Programming Interface) is a set of protocols that allows different software applications to communicate with each other.' },
    ]
  },
  science: {
    name: 'Science',
    faqs: [
      { question: 'What is the scientific method?', answer: 'The scientific method is a systematic approach to research: observe, hypothesize, experiment, analyze, and conclude.' },
      { question: 'What is photosynthesis?', answer: 'Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen.' },
      { question: 'What is an atom?', answer: 'An atom is the smallest unit of matter that retains the properties of an element. It consists of protons, neutrons, and electrons.' },
      { question: 'What is DNA?', answer: 'DNA (Deoxyribonucleic acid) is the molecule that carries genetic information for development and functioning of living organisms.' },
      { question: 'What is gravity?', answer: 'Gravity is a fundamental force of attraction between objects with mass. On Earth, it gives weight to objects and causes them to fall.' },
      { question: 'What is the water cycle?', answer: 'The water cycle describes how water evaporates, forms clouds through condensation, falls as precipitation, and collects in bodies of water.' },
    ]
  },
  mathematics: {
    name: 'Mathematics',
    faqs: [
      { question: 'What is the Pythagorean theorem?', answer: 'In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides: a² + b² = c².' },
      { question: 'What is calculus?', answer: 'Calculus is a branch of mathematics dealing with rates of change (differential calculus) and accumulation of quantities (integral calculus).' },
      { question: 'What is a prime number?', answer: 'A prime number is a natural number greater than 1 that can only be divided by 1 and itself without leaving a remainder.' },
      { question: 'What is algebra?', answer: 'Algebra is a branch of mathematics using symbols and letters to represent numbers and quantities in equations and formulas.' },
      { question: 'What is a derivative?', answer: 'A derivative measures how a function changes as its input changes. It represents the instantaneous rate of change or slope.' },
      { question: 'What is probability?', answer: 'Probability is a measure of the likelihood that an event will occur, expressed as a number between 0 (impossible) and 1 (certain).' },
    ]
  },
  history: {
    name: 'History',
    faqs: [
      { question: 'What was the Renaissance?', answer: 'The Renaissance was a cultural movement from the 14th to 17th century, marking the transition from Middle Ages to modernity in Europe.' },
      { question: 'What caused World War I?', answer: 'WWI was triggered by the assassination of Archduke Franz Ferdinand, combined with nationalism, militarism, imperialism, and alliances.' },
      { question: 'What was the Industrial Revolution?', answer: 'The Industrial Revolution was a period of major industrialization from the late 1700s, transforming economies from agrarian to manufacturing.' },
      { question: 'Who was Julius Caesar?', answer: 'Julius Caesar was a Roman general and statesman who played a critical role in transforming the Roman Republic into the Roman Empire.' },
      { question: 'What was the Cold War?', answer: 'The Cold War was a period of geopolitical tension between the USA and USSR (1947-1991), characterized by political, military, and economic rivalry.' },
      { question: 'What was the French Revolution?', answer: 'The French Revolution (1789-1799) was a period of radical political and societal change in France that overthrew the monarchy.' },
    ]
  },
};

const niches = Object.keys(faqDatabase);

export default function FAQsView() {
  const [topic, setTopic] = useState('');
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const currentFaqs = selectedNiche 
    ? faqDatabase[selectedNiche].faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectNiche = (niche: string) => {
    setSelectedNiche(niche);
    setExpandedIndex(null);
  };

  const handleBack = () => {
    setSelectedNiche(null);
    setSearchQuery('');
    setExpandedIndex(null);
  };

  // Niche selection
  if (!selectedNiche) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <FileQuestion className="h-7 w-7 text-primary" />
          FAQs
        </h2>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8"
        >
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">
              Or enter a custom topic
            </label>
            <div className="flex gap-2">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Machine Learning, Climate Change..."
                className="bg-muted/30 border-border/50"
              />
              <Button 
                onClick={() => topic.trim() && handleSelectNiche('programming')}
                disabled={!topic.trim()}
              >
                Search
              </Button>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-6">
            <label className="block text-sm font-medium mb-4 text-muted-foreground">
              Select a category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {niches.map(niche => (
                <motion.button
                  key={niche}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectNiche(niche)}
                  className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-all flex items-center gap-3"
                >
                  <Tag className="h-5 w-5 text-primary" />
                  <span className="font-medium capitalize">{faqDatabase[niche].name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // FAQs list
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <FileQuestion className="h-7 w-7 text-primary" />
          {faqDatabase[selectedNiche].name} FAQs
        </h2>
        <Button variant="outline" size="sm" onClick={handleBack}>
          Back to Categories
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions..."
          className="pl-10 bg-muted/30 border-border/50"
        />
      </div>
      
      {/* FAQs */}
      <div className="space-y-3">
        {currentFaqs.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No FAQs found matching your search.</p>
          </div>
        ) : (
          currentFaqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <span className="font-medium">{faq.question}</span>
                <motion.div
                  animate={{ rotate: expandedIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 text-muted-foreground border-t border-border/30">
                      <p className="pt-4 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
