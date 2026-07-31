import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  { name: 'Sarah Chen',        profession: 'Medical Student',             review: 'NoteZ transformed how I study for exams. The flashcard system and quizzes helped me ace my boards!' },
  { name: 'James Wilson',      profession: 'Software Engineer',           review: 'Perfect for learning new programming concepts. The focus timer keeps me productive for hours.' },
  { name: 'Emily Rodriguez',   profession: 'Law Student',                 review: 'The calendar feature helps me plan my study sessions. I feel much more organised than ever before.' },
  { name: 'David Kim',         profession: 'PhD Researcher',              review: 'The AI-powered quizzes are incredible. They adapt to my level and push me to learn deeper concepts.' },
  { name: 'Aisha Patel',       profession: 'High School Teacher',         review: 'I recommend NoteZ to all my students. Real-world examples make abstract topics tangible.' },
  { name: 'Marcus Thompson',   profession: 'MBA Candidate',               review: 'From flashcards to focus timers — everything I need in one place. My GPA improved a full point!' },
  { name: 'Priya Nair',        profession: 'UX Designer',                 review: 'The folder system keeps my research notes perfectly organised. I can find anything in seconds.' },
  { name: "Liam O'Brien",      profession: 'Mechanical Engineer',         review: 'The focus timer with floating mode is a game changer. I stay on task even while navigating the app.' },
  { name: 'Mei Lin',           profession: 'Data Scientist',              review: 'Generating a full exam from my own notes in one click is something I never knew I needed.' },
  { name: 'Carlos Rivera',     profession: 'Product Manager',             review: 'The AI chat modes — Researcher, Analyst, Tutor — feel like having a personal study coach.' },
  { name: 'Fatima Al-Hassan',  profession: 'Biomedical Researcher',       review: 'Clean dark interface, no distractions. NoteZ is the only study app that actually fits my workflow.' },
  { name: 'Noah Bennett',      profession: 'Civil Engineer',              review: 'Being able to colour-code folders makes managing semester projects a breeze.' },
  { name: 'Isabella Gomez',    profession: 'Pharmacist',                  review: 'The calendar meeting link feature saves me from scrambling before every online lecture.' },
  { name: 'Ethan Park',        profession: 'Electrical Engineer',         review: 'Flashcard sessions paired with the Pomodoro timer helped me retain circuit theory much faster.' },
  { name: 'Zara Ahmed',        profession: 'Graphic Designer',            review: 'I love that the timer keeps running as a floating widget even when I switch to notes mode.' },
  { name: 'Oliver Hughes',     profession: 'Financial Analyst',           review: 'The shared timer stays in sync across all views. No more losing my focus count mid-session.' },
  { name: 'Nia Owusu',         profession: 'Public Health Specialist',    review: 'Generating custom quizzes from uploaded sources cut my prep time for presentations in half.' },
  { name: 'Hiroshi Tanaka',    profession: 'Robotics Engineer',           review: 'The AI Summariser mode condenses lengthy technical manuals into crisp bullet points.' },
  { name: 'Amara Diallo',      profession: 'Economist',                   review: 'Progress dashboard gives me a clear picture of where I am and what topics still need work.' },
  { name: 'Lucas Fernandez',   profession: 'DevOps Engineer',             review: 'NoteZ replaced three different apps I was juggling. One clean tool for everything I need.' },
  { name: 'Sofia Johansson',   profession: 'Cognitive Psychologist',      review: 'The Mentor chat mode walks me through concepts step by step — absolutely brilliant.' },
  { name: 'Ravi Sharma',       profession: 'Power Systems Engineer',      review: 'I passed my power systems exam on the first attempt after using NoteZ flashcards for two weeks.' },
  { name: 'Grace Okonkwo',     profession: 'Nurse Practitioner',          review: 'Dark theme, smooth animations and a fast search palette. My favourite study app by far.' },
  { name: 'Felix Bauer',       profession: 'Cybersecurity Analyst',       review: 'The Cmd+K palette lets me jump to any section instantly — tiny feature, massive time saver.' },
  { name: 'Yuki Sato',         profession: 'Molecular Biologist',         review: 'Auto-saving notes inside folders means I never lose work between sessions. Total peace of mind.' },
  { name: 'Tariq Hassan',      profession: 'Structural Engineer',         review: 'The exam generator turned my revision notes into a proper mock paper in under a minute.' },
  { name: 'Hannah Müller',     profession: 'Clinical Psychologist',       review: 'Switching chat modes mid-conversation without losing context is incredibly useful.' },
  { name: 'Kofi Mensah',       profession: 'Network Engineer',            review: 'I schedule study blocks on the calendar, link the video call, and NoteZ handles the rest.' },
  { name: 'Elena Petrova',     profession: 'Astrophysicist',              review: 'The responsive sidebar collapses cleanly on my laptop — the UI adapts beautifully to any screen.' },
  { name: 'Ahmad Karim',       profession: 'Machine Learning Engineer',   review: 'Using the Analyst mode to debug my logic saved me countless hours of re-reading.' },
  { name: 'Simone Dubois',     profession: 'Architect',                   review: 'NoteZ has the best note-taking experience I have found. Fast, minimal, and distraction-free.' },
  { name: 'Tunde Adeyemi',     profession: 'Petroleum Engineer',          review: 'Being able to nest notes inside colour-coded folders mirrors exactly how my brain organises topics.' },
  { name: 'Clara Svensson',    profession: 'Statistician',                review: 'The Tutor mode explains SQL concepts as if it knows exactly where I am struggling — impressive.' },
  { name: 'Arjun Mehta',       profession: 'Aerospace Engineer',          review: 'Generating a 20-question exam from my notes took about 30 seconds. Absolutely unreal.' },
  { name: 'Lena Fischer',      profession: 'Environmental Scientist',     review: 'Progress tracking finally motivates me to stay consistent. Seeing the streaks grow is addictive.' },
  { name: 'Diego Morales',     profession: 'Radiologist',                 review: 'The floating timer follows me across views so I never accidentally break my Pomodoro block.' },
  { name: 'Amina Traoré',      profession: 'Data Analyst',                review: 'AI-generated flashcards from my own data sets gave me a totally new way to memorise patterns.' },
  { name: "Patrick O'Neill",   profession: 'Blockchain Developer',        review: 'Clean, dark, and fast. NoteZ does not slow me down the way bloated study apps always did.' },
  { name: 'Yuna Kim',          profession: 'Bioinformatician',            review: 'The Researcher mode helps me cross-reference multiple topics without leaving the chat.' },
  { name: 'Tobias Schmitt',    profession: 'Geotechnical Engineer',       review: 'Custom time dropdowns in the calendar make scheduling lab sessions precise to the minute.' },
  { name: 'Nadia Belkacem',    profession: 'Dentist',                     review: 'From creating a folder to finishing a quiz — the whole loop feels seamless and intuitive.' },
  { name: 'Kwame Asante',      profession: 'Embedded Systems Engineer',   review: 'The Sources view lets me attach reference documents and generate questions from them directly.' },
  { name: 'Valentina Cruz',    profession: 'Actuarial Scientist',         review: 'I use the calendar Task type every morning to plan my review schedule — keeps me on track.' },
  { name: 'Shun Watanabe',     profession: 'Quantum Physicist',           review: 'NoteZ replaced my sticky-note wall. Everything is digital, searchable, and always accessible.' },
  { name: 'Isabela Santos',    profession: 'Veterinarian',                review: 'The sidebar groups sections logically — Study, Practice, Tools. Exactly how I think about learning.' },
  { name: 'Bruno Leclerc',     profession: 'Chemical Engineer',           review: 'Seeing my study session history on the Progress dashboard helps me identify weak spots quickly.' },
  { name: 'Chioma Ezeh',       profession: 'Epidemiologist',              review: 'NoteZ is the only app that makes reviewing 500 flashcards feel manageable and even enjoyable.' },
  { name: 'Mikael Lindqvist',  profession: 'Controls Engineer',           review: 'The note editor inside folders is snappy, and renaming or recolouring is just one click away.' },
  { name: 'Naledi Dlamini',    profession: 'Urban Planner',               review: 'I pulled an all-nighter with NoteZ and the dark theme was genuinely easy on my eyes all night.' },
  { name: 'André Dupont',      profession: 'Neuroscientist',              review: 'Collapsible sidebar on smaller screens is a great touch — full focus on content when needed.' },
  { name: 'Keiko Yamamoto',    profession: 'Forensic Accountant',         review: 'The AI chat remembers context within a conversation, so follow-up questions are always accurate.' },
];

// Duplicate for seamless infinite loop
const doubled = [...testimonials, ...testimonials];

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('');
}

function TestimonialCard({ t }: { t: typeof testimonials[0] }) {
  return (
    <div className="flex-shrink-0 w-72 mx-3 p-5 rounded-xl border border-border bg-card flex flex-col gap-3 shadow-[0_1px_0_hsl(40_20%_94%/0.03)_inset,0_2px_8px_hsl(0_0%_0%/0.45)]">
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-[hsl(40_30%_75%)] text-[hsl(40_30%_75%)]" />
        ))}
      </div>
      <div className="relative">
        <Quote className="absolute -top-1 -left-1 h-5 w-5 text-[hsl(220_8%_28%)]" />
        <p className="text-[13px] leading-relaxed text-[hsl(40_8%_72%)] pl-5 line-clamp-4">
          {t.review}
        </p>
      </div>
      <div className="flex items-center gap-2.5 pt-2 border-t border-border/60 mt-auto">
        <div className="w-8 h-8 rounded-full bg-[hsl(220_8%_16%)] border border-[hsl(220_8%_22%)] flex items-center justify-center text-[11px] font-semibold text-[hsl(40_20%_80%)] shrink-0">
          {initials(t.name)}
        </div>
        <div>
          <p className="text-[13px] font-medium text-[hsl(40_20%_94%)] leading-tight">{t.name}</p>
          <p className="text-[11px] text-[hsl(40_8%_55%)] leading-tight">{t.profession}</p>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 50%, hsl(220 8% 11%), transparent)' }}
      />

      <div className="container mx-auto px-4 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Loved by <span className="text-[hsl(40_30%_82%)]">Students</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of learners who have transformed their study habits.
          </p>
        </motion.div>
      </div>

      {/* Single scrolling row */}
      <div className="overflow-hidden relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />

        <motion.div
          className="flex"
          animate={{ x: ['-50%', '0%'] }}
          transition={{
            duration: 180,
            repeat: Infinity,
            ease: 'linear',
            repeatType: 'loop',
          }}
          style={{ width: 'max-content' }}
        >
          {doubled.map((t, i) => (
            <TestimonialCard key={`${t.name}-${i}`} t={t} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
