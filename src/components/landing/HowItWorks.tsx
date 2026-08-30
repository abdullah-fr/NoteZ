import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  Check,
  FileText,
  Folder,
  FolderPlus,
  GraduationCap,
  Layers,
  ListChecks,
  MessageSquare,
  PenLine,
  Upload,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const steps = [
  {
    step: '01',
    id: 'step-1',
    icon: UserPlus,
    title: 'Open your workspace',
    subtitle: 'Start in seconds',
    description: 'Sign up with Google or email and land in your study dashboard without a setup questionnaire.',
    badge: 'Step 01 • Instant Access',
  },
  {
    step: '02',
    id: 'step-2',
    icon: FolderPlus,
    title: 'Create or import material',
    subtitle: 'Folders + rich editor',
    description: 'Create a folder and note, or bring in supported study documents. Keep the material organized and readable in the editor.',
    badge: 'Step 02 • Build Your Material',
  },
  {
    step: '03',
    id: 'step-3',
    icon: Brain,
    title: 'Study from what you made',
    subtitle: 'Practice with context',
    description: 'Ask NoteZ AI, generate flashcards or exams, turn material into activities, and protect time with Focus sessions.',
    badge: 'Step 03 • Learn and Practice',
  },
];

function WorkspacePreview({ signedIn, onSignIn }: { signedIn: boolean; onSignIn: () => void }) {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-border/80 bg-background/70 p-5 space-y-4 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><UserPlus className="h-5 w-5" /></div>
      <div><h4 className="font-display text-base font-semibold text-foreground">Your study workspace</h4><p className="mt-1 text-xs text-muted-foreground">Sign in, then start with your own material.</p></div>
      {signedIn ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary"><Check className="h-4 w-4" /> Dashboard ready</div>
      ) : (
        <button type="button" onClick={onSignIn} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"><UserPlus className="h-3.5 w-3.5" /> Open NoteZ</button>
      )}
    </div>
  );
}

function MaterialPreview({ imported, onImport }: { imported: boolean; onImport: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
      <div className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 border-b border-border/60 px-1.5 pb-2 text-[10px] font-semibold text-foreground"><Folder className="h-3.5 w-3.5 text-primary" /> Folders</div>
        {['Operating Systems', 'SQA Notes', 'Algorithms'].map((folder, index) => <div key={folder} className={`rounded-lg px-2 py-2 text-[10px] ${index === 0 ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground'}`}>{folder}</div>)}
      </div>
      <div className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5"><div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-xs font-semibold text-foreground">Process Scheduling Notes</span></div><PenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></div>
        {imported ? (
          <>
            <p className="font-display text-sm font-semibold text-foreground">CPU scheduling</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Imported text keeps its headings, alignment, color, and underline so it is ready to study.</p>
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2 text-[10px] text-primary"><Check className="h-3.5 w-3.5" /> Formatting preserved</div>
          </>
        ) : (
          <button type="button" onClick={onImport} className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"><Upload className="h-5 w-5 text-primary" /><span className="text-[11px] font-medium text-foreground">Import a document or write a note</span><span className="text-[10px] text-muted-foreground">Start with your own study material</span></button>
        )}
      </div>
    </div>
  );
}

function StudyPreview() {
  const actions = [
    { label: 'Ask NoteZ AI', detail: 'Explain this note', icon: MessageSquare },
    { label: 'Generate flashcards', detail: 'Practice active recall', icon: Layers },
    { label: 'Generate an exam', detail: 'Check understanding', icon: GraduationCap },
    { label: 'Create activities', detail: 'Make a task package', icon: ListChecks },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-background/70 p-4"><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Operating Systems / Process Scheduling</p><p className="mt-2 text-sm font-semibold text-foreground">What do you want to do with this material?</p></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ label, detail, icon: Icon }, index) => <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-3 py-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-foreground">{label}</span><span className="block truncate text-[10px] text-muted-foreground">{detail}</span></span></motion.div>)}
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [imported, setImported] = useState(false);
  const active = steps[activeStep];

  let preview: ReactNode;
  if (activeStep === 0) preview = <WorkspacePreview signedIn={signedIn} onSignIn={() => setSignedIn(true)} />;
  else if (activeStep === 1) preview = <MaterialPreview imported={imported} onImport={() => setImported(true)} />;
  else preview = <StudyPreview />;

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-background py-20 sm:py-28">
      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.24em] text-primary">How NoteZ works</p>
          <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">From your material to <span className="text-primary">real practice.</span></h2>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">Start with the workspace, bring in what you need to learn, and use the tools around it.</p>
        </motion.div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col justify-center gap-3 lg:col-span-5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              return <button key={step.id} type="button" onClick={() => setActiveStep(index)} aria-pressed={isActive} className={`relative rounded-xl border p-4 text-left transition-colors sm:p-5 ${isActive ? 'border-primary/60 bg-card shadow-md ring-1 ring-primary/20' : 'border-border/60 bg-card/30 hover:border-border hover:bg-card/60'}`}>
                {isActive && <span className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-primary" />}
                <span className="flex items-start gap-3.5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-primary text-primary-foreground' : 'border border-primary/20 bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-mono font-semibold text-primary">{step.badge}</span><span className="text-[10px] font-mono text-muted-foreground/50">{step.step}</span></span><span className="block font-display text-base font-semibold text-foreground">{step.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{step.description}</span></span>
                </span>
              </button>;
            })}
          </div>

          <div className="lg:col-span-7">
            <div className="flex h-full min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xl backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3"><div className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" /><span className="ml-2 truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{active.title} · Step {activeStep + 1} of 3</span></div><span className="shrink-0 text-[10px] font-mono text-muted-foreground">{active.subtitle}</span></div>
              <div className="my-6 flex flex-1 items-center"><AnimatePresence mode="wait" initial={false}><motion.div key={active.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">{preview}</motion.div></AnimatePresence></div>
              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3"><div className="flex gap-1.5" aria-label="Choose onboarding step">{steps.map((step, index) => <button key={step.id} type="button" onClick={() => setActiveStep(index)} aria-label={`Show ${step.title}`} className={`h-1.5 rounded-full transition-all ${activeStep === index ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground'}`} />)}</div><Button asChild size="sm" className="rounded-lg px-4 text-xs font-medium"><Link to="/signup">Get started <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
