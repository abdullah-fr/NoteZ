import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CTA() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto rounded-3xl border border-primary/20 bg-card/40 backdrop-blur-xl overflow-hidden p-10 md:p-16"
        >
          {/* Glow accents */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-notez-violet/15 blur-3xl pointer-events-none" />

          <div className="relative text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" /> Free forever for students
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight leading-[1.05]">
              Your best semester <span className="gradient-text">starts tonight.</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed">
              Sign up in ten seconds. No credit card. Cancel anything you don’t love.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="text-base px-8 h-12 glow-purple">
                <Link to="/signup">
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 h-12 border-border/60">
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
