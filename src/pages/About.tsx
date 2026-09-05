import { ArrowRight, BookOpen, BrainCircuit, Clock3, Layers3, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PublicPageShell } from '@/components/landing/PublicPageShell';

const PRINCIPLES = [
  {
    icon: BookOpen,
    title: 'Start with your material',
    description: 'Your notes, folders, and sources stay at the center of the learning experience.',
  },
  {
    icon: BrainCircuit,
    title: 'Practice with purpose',
    description: 'Turn understanding into recall with focused explanations, flashcards, quizzes, and exams.',
  },
  {
    icon: Clock3,
    title: 'Build steady momentum',
    description: 'Use activities, calendar planning, and focus sessions to make progress visible and repeatable.',
  },
];

export default function About() {
  return (
    <PublicPageShell
      eyebrow="About NoteZ"
      title="A calmer way to learn what matters."
      description="NoteZ is a focused study workspace for turning scattered material into clear practice and consistent progress."
    >
      <div className="space-y-14 sm:space-y-20">
        <section className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-start">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Why NoteZ exists
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Less time organizing your study life. More time learning.
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              Studying often gets split between notes, reminders, random tabs, and tools that never share context. NoteZ brings that loop into one workspace so the path from material to mastery feels easier to follow.
            </p>
            <p>
              We keep the product practical: a clear place to capture ideas, tools that help you practice, and simple signals that show where your momentum is going.
            </p>
          </div>
        </section>

        <section aria-labelledby="notez-loop-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                The NoteZ loop
              </p>
              <h2 id="notez-loop-title" className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Capture. Practice. Remember.
              </h2>
            </div>
            <Layers3 className="hidden h-8 w-8 text-primary sm:block" aria-hidden="true" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/50 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 rounded-3xl border border-border/70 bg-card/50 p-6 shadow-sm sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em]">Built around your study space</span>
            </div>
            <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Your learning system should feel useful before it feels complicated.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              That is the standard we use for NoteZ: keep the important context close, make the next action obvious, and help serious learners keep going.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Button asChild>
              <Link to="/signup">
                Start learning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">See plans</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
