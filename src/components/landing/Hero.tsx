import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, BookOpen, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden animated-bg">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-notez-purple/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-notez-violet/10 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold mb-6 tracking-tight leading-[1.05]"
          >
            Learn smarter.{"\n"}
            <span className="gradient-text">Remember everything.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            The AI study companion for serious learners. Turn any subject into
            flashcards, quizzes, and exams — and actually retain it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-lg px-8 h-14 glow-purple">
              <Link to="/login">
                Start Learning Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 h-14">
              <a href="#features">
                See Features
              </a>
            </Button>
          </motion.div>

          {/* Floating icons */}
          <div className="relative mt-20">
            <motion.div
              className="absolute -left-10 top-0 p-4 rounded-2xl glass card-3d"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <BookOpen className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.div
              className="absolute -right-10 top-10 p-4 rounded-2xl glass card-3d"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <Brain className="h-8 w-8 text-notez-violet" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
