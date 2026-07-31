import { motion } from 'framer-motion';
import { 
  Brain, FileQuestion, Layers, Calendar, FileText, Timer, Lightbulb, Zap
} from 'lucide-react';

const features = [
  { icon: Brain, title: 'Adaptive AI exams', description: 'Diagnostic questions that get harder as you improve. Instant explanations on every answer.' },
  { icon: Layers, title: 'Spaced flashcards', description: 'Review what you’re about to forget. Active recall, the way memory actually works.' },
  { icon: FileQuestion, title: 'Topic FAQs', description: 'Skim the questions everyone asks about a subject — answered, searchable, deep-linked.' },
  { icon: Lightbulb, title: 'Worked examples', description: 'Real-world problems with step-by-step reasoning. Copy, tweak, learn by doing.' },
  { icon: Calendar, title: 'Study planner', description: 'Plan sessions around your exam date. We schedule the right thing on the right day.' },
  { icon: FileText, title: 'Smart notes', description: 'Notes that organize themselves by subject and topic. Find anything in two keystrokes.' },
  { icon: Timer, title: 'Focus sessions', description: 'Pomodoro built-in. Deep work tracked into your streak and XP automatically.' },
  { icon: Zap, title: 'Built for speed', description: 'Keyboard-first, mobile-first, dark by default. No bloat, no waiting.' },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 md:mb-20 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-muted-foreground mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Everything in one place
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight leading-[1.1]">
            One app. <span className="gradient-text">Every study tool.</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Stop juggling Notion, Anki, and ten Chrome tabs. NoteZ replaces them with one calm, fast workspace.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group"
            >
              <div className="h-full p-5 md:p-6 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm hover:border-primary/30 hover:bg-card/70 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-base font-semibold mb-1.5 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
