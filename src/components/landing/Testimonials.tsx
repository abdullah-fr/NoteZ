import { Quote, Star } from 'lucide-react';

const testimonials = [
  { name: 'Sarah Chen', profession: 'Third-Year Medical Student', review: 'The folders keep my lecture notes together, and turning them into flashcards makes revision feel much more deliberate.' },
  { name: 'James Wilson', profession: 'Junior, Computer Science', review: 'The Focus Timer keeps me working, while the editor gives me one calm place to build my study material.' },
  { name: 'Emily Rodriguez', profession: 'Second-Year Law Student', review: 'I can move from a note to a question, then back to the exact context I was reviewing. That flow is excellent.' },
  { name: 'David Kim', profession: 'PhD Candidate, Materials Science', review: 'The AI explains difficult ideas in the context of my notes instead of giving me a disconnected generic answer.' },
  { name: 'Aisha Patel', profession: 'Senior, Mathematics Education', review: 'Generating an exam from my own notes gives me a much clearer picture of what I actually understand.' },
  { name: 'Marcus Thompson', profession: 'MBA Student', review: 'The whole learning loop feels connected: write, ask, practise, and return to the material that needs work.' },
  { name: 'Priya Nair', profession: 'Master’s Student, HCI', review: 'The folder system keeps my research notes organized, and I can find the right note without losing my train of thought.' },
  { name: 'Liam O’Brien', profession: 'Junior, Mechanical Engineering', review: 'The Focus Timer is simple enough to use every day, and my notes remain right there when I need them.' },
  { name: 'Mei Lin', profession: 'Graduate Student, Data Science', review: 'A full practice exam from my own study notes in a few clicks is exactly what my revision routine was missing.' },
  { name: 'Carlos Rivera', profession: 'Senior, Information Systems', review: 'NoteZ AI understands whether I am asking about a folder, a note, or a concept. That context makes the answers useful.' },
  { name: 'Fatima Al-Hassan', profession: 'PhD Candidate, Biomedical Science', review: 'The interface stays focused, and the rich editor makes it easy to turn rough material into notes I can actually review.' },
  { name: 'Noah Bennett', profession: 'Senior, Civil Engineering', review: 'Color-coded folders make it easy to separate projects, while the calendar keeps deadlines visible.' },
  { name: 'Nia Owusu', profession: 'Master’s Student, Public Health', review: 'Importing my course material and turning it into activities cut down the time I spent planning revision.' },
  { name: 'Hiroshi Tanaka', profession: 'Graduate Student, Robotics', review: 'The AI summary gives me a clear starting point, then I can open the source note and study the details.' },
  { name: 'Amara Diallo', profession: 'Junior, Economics', review: 'The dashboard gives me a useful view of what I have studied and what still needs attention.' },
  { name: 'Sofia Johansson', profession: 'Graduate Student, Cognitive Science', review: 'The chat is especially good for follow-up questions because the conversation keeps the study context in view.' },
  { name: 'Ravi Sharma', profession: 'Junior, Electrical Engineering', review: 'Flashcards made from my own explanations are helping me remember the concepts instead of just recognizing them.' },
  { name: 'Yuki Sato', profession: 'PhD Candidate, Molecular Biology', review: 'Auto-saving notes inside folders means I can focus on the idea instead of worrying about where I saved it.' },
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('');
}

function TestimonialCard({ name, profession, review }: typeof testimonials[number]) {
  return (
    <article className="flex w-[min(22rem,82vw)] shrink-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_0_hsl(var(--foreground)/0.03)_inset,0_2px_8px_hsl(var(--foreground)/0.12)] sm:w-80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-0.5" aria-label="5 out of 5 stars">
          {[0, 1, 2, 3, 4].map((star) => <Star key={star} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
        </div>
        <Quote className="h-4 w-4 text-border" />
      </div>
      <p className="line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">{review}</p>
      <div className="mt-auto flex items-center gap-2.5 border-t border-border/60 pt-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-foreground">{initials(name)}</div>
        <div className="min-w-0"><p className="truncate text-[12px] font-medium leading-tight text-foreground">{name}</p><p className="truncate text-[10px] leading-tight text-muted-foreground">{profession}</p></div>
      </div>
    </article>
  );
}

function TestimonialRow({ items, direction, label }: { items: typeof testimonials; direction: 'left' | 'right'; label: string }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden" onMouseEnter={(event) => { event.currentTarget.dataset.paused = 'true'; }} onMouseLeave={(event) => { delete event.currentTarget.dataset.paused; }}>
      <div className={`testimonial-marquee-track flex ${direction === 'left' ? 'testimonial-marquee-left' : 'testimonial-marquee-right'}`} aria-label={label}>
        {doubled.map((testimonial, index) => <TestimonialCard key={`${testimonial.name}-${index}`} {...testimonial} />)}
      </div>
    </div>
  );
}

export function Testimonials() {
  const rows = [testimonials.slice(0, 6), testimonials.slice(6, 12), testimonials.slice(12, 18)];

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'radial-gradient(ellipse 80% 45% at 50% 50%, hsl(var(--border)), transparent)' }} />
      <div className="container relative z-10 mx-auto mb-12 max-w-6xl px-4 text-center">
        <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.24em] text-primary">Student notes</p>
        <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Built for the way <span className="text-primary">you learn.</span></h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">A few words from learners using NoteZ to make their material, practice, and focus time work together.</p>
      </div>

      <div className="space-y-4">
        <TestimonialRow items={rows[0]} direction="left" label="Student testimonials, moving right to left" />
        <TestimonialRow items={rows[1]} direction="right" label="Student testimonials, moving left to right" />
        <TestimonialRow items={rows[2]} direction="left" label="Student testimonials, moving right to left" />
      </div>
    </section>
  );
}
