import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  lastUpdated?: string;
};

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
  lastUpdated,
}: PublicPageShellProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | NoteZ`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground animated-bg">
      <Navbar />

      <main className="pt-24 sm:pt-28">
        <section className="border-b border-border/60">
          <div className="container mx-auto max-w-5xl px-4 pb-12 sm:pb-16">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to NoteZ
            </Link>

            <p className="mb-4 text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>
            {lastUpdated && (
              <p className="mt-5 text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground/75">
                Last updated: {lastUpdated}
              </p>
            )}
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 py-12 sm:py-16 md:py-20">
          {children}
        </section>
      </main>

      <Footer />
    </div>
  );
}

type PolicySectionProps = {
  title: string;
  children: ReactNode;
};

export function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="border-b border-border/50 pb-8 last:border-b-0 last:pb-0 sm:pb-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="space-y-3 pl-5 marker:text-primary">{children}</ul>;
}
