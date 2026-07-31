import { motion } from 'framer-motion';
import { UserPlus, BookOpen, Trophy } from 'lucide-react';

const steps = [
  { icon: UserPlus, step: '01', title: 'Sign up', description: 'Google or email. Ten seconds, no credit card, no friction.' },
  { icon: BookOpen, step: '02', title: 'Pick a subject', description: 'Tell us what you’re studying. We tailor the entire workspace to it.' },
  { icon: Trophy, step: '03', title: 'Start a streak', description: 'Quiz, flashcards, focus sessions — XP and streak tracking from day one.' },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 md:mb-20 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-muted-foreground mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> 60 seconds to start
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight leading-[1.1]">
            From zero to <span className="gradient-text">studying</span> in three steps.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            No setup wizards. No 12-step onboarding. Just open it and learn.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="relative p-6 md:p-7 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="font-display text-3xl font-bold text-muted-foreground/30 tracking-tight">{step.step}</span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2 tracking-tight">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
