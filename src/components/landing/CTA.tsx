import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CTA() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-20 md:py-28" aria-labelledby="landing-onboarding-title">
      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-xl sm:p-14 md:p-16"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
            <div className="absolute inset-x-10 top-8 border-t border-dashed border-border/60" />
            <div className="absolute inset-x-10 bottom-8 border-t border-dashed border-border/60" />
          </div>

          <div className="relative mx-auto max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> NoteZ / Start here
            </span>
            <h2 id="landing-onboarding-title" className="mb-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Bring your material.<br /><span className="text-primary">Build your momentum.</span>
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
              Create a folder, write or import your notes, and turn them into focused practice in one calm workspace.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link to="/signup">
                  Create your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">Folders · Rich editor · AI study tools</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
