import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Calculator, FlaskConical, Globe, Code, Music, Palette, Languages,
  ArrowRight, Loader2, ChevronLeft, Check
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchEnrolledSubjects, enrollSubject, type Subject } from '@/services';
import { useToast } from '@/hooks/use-toast';

interface SubCategory { name: string; description: string; }
interface Subject { name: string; icon: any; color: string; subCategories: SubCategory[]; }

const presetSubjects: Subject[] = [
  { name: 'Mathematics', icon: Calculator, color: '#8B5CF6', subCategories: [
    { name: 'Algebra', description: 'Equations, inequalities, and polynomials' },
    { name: 'Calculus', description: 'Derivatives, integrals, and limits' },
    { name: 'Statistics', description: 'Probability, distributions, and analysis' },
    { name: 'Geometry', description: 'Shapes, angles, and spatial reasoning' },
    { name: 'Trigonometry', description: 'Sine, cosine, and trigonometric functions' },
    { name: 'Linear Algebra', description: 'Vectors, matrices, and transformations' },
    { name: 'Discrete Math', description: 'Logic, sets, and combinatorics' },
    { name: 'Number Theory', description: 'Primes, divisibility, and modular arithmetic' },
    { name: 'Differential Equations', description: 'ODEs, PDEs, and applications' },
    { name: 'Real Analysis', description: 'Sequences, series, and convergence' },
  ]},
  { name: 'Science', icon: FlaskConical, color: '#22C55E', subCategories: [
    { name: 'Physics', description: 'Mechanics, thermodynamics, and waves' },
    { name: 'Chemistry', description: 'Organic, inorganic, and physical chemistry' },
    { name: 'Biology', description: 'Cell biology, genetics, and evolution' },
    { name: 'Astronomy', description: 'Stars, planets, and cosmology' },
    { name: 'Environmental Science', description: 'Ecosystems and sustainability' },
    { name: 'Earth Science', description: 'Geology, meteorology, and oceanography' },
    { name: 'Biochemistry', description: 'Molecular biology and metabolism' },
    { name: 'Neuroscience', description: 'Brain, neurons, and cognition' },
    { name: 'Quantum Mechanics', description: 'Wave functions and quantum states' },
    { name: 'Microbiology', description: 'Bacteria, viruses, and microorganisms' },
  ]},
  { name: 'History', icon: Globe, color: '#F59E0B', subCategories: [
    { name: 'Ancient History', description: 'Mesopotamia, Egypt, Greece, and Rome' },
    { name: 'Medieval History', description: 'Feudalism, crusades, and empires' },
    { name: 'Modern History', description: 'Renaissance to industrial revolution' },
    { name: 'World War I & II', description: 'Causes, events, and aftermath' },
    { name: 'American History', description: 'Colonial era to present day' },
    { name: 'Asian History', description: 'China, Japan, India, and Southeast Asia' },
    { name: 'African History', description: 'Kingdoms, colonialism, and independence' },
    { name: 'Art History', description: 'Movements, artists, and masterpieces' },
    { name: 'Political History', description: 'Governments, revolutions, and ideologies' },
    { name: 'Economic History', description: 'Trade, markets, and globalization' },
  ]},
  { name: 'Literature', icon: BookOpen, color: '#EC4899', subCategories: [
    { name: 'Classic Literature', description: 'Shakespeare, Dickens, and Austen' },
    { name: 'Modern Fiction', description: 'Contemporary novels and short stories' },
    { name: 'Poetry', description: 'Forms, analysis, and famous poets' },
    { name: 'Drama & Theatre', description: 'Plays, performance, and criticism' },
    { name: 'World Literature', description: 'Global authors and traditions' },
    { name: 'Creative Writing', description: 'Fiction, non-fiction, and storytelling' },
    { name: 'Literary Theory', description: 'Criticism, deconstruction, and analysis' },
    { name: 'American Literature', description: 'Twain, Fitzgerald, and Morrison' },
    { name: "Children's Literature", description: 'Fairy tales to young adult fiction' },
    { name: 'Science Fiction & Fantasy', description: 'Speculative genres and world-building' },
  ]},
  { name: 'Programming', icon: Code, color: '#3B82F6', subCategories: [
    { name: 'Python', description: 'General-purpose scripting and automation' },
    { name: 'JavaScript', description: 'Web development and Node.js' },
    { name: 'Data Structures', description: 'Arrays, trees, graphs, and hash maps' },
    { name: 'Algorithms', description: 'Sorting, searching, and optimization' },
    { name: 'Web Development', description: 'HTML, CSS, React, and full-stack' },
    { name: 'Machine Learning', description: 'Neural networks and AI models' },
    { name: 'Database Systems', description: 'SQL, NoSQL, and data modeling' },
    { name: 'Mobile Development', description: 'iOS, Android, and cross-platform' },
    { name: 'DevOps & Cloud', description: 'CI/CD, Docker, and AWS/GCP' },
    { name: 'Cybersecurity', description: 'Encryption, vulnerabilities, and defense' },
  ]},
  { name: 'Music', icon: Music, color: '#EF4444', subCategories: [
    { name: 'Music Theory', description: 'Scales, chords, and harmony' },
    { name: 'Piano', description: 'Technique, repertoire, and practice' },
    { name: 'Guitar', description: 'Acoustic, electric, and fingerstyle' },
    { name: 'Vocal Training', description: 'Breathing, range, and performance' },
    { name: 'Music Production', description: 'DAWs, mixing, and mastering' },
    { name: 'Music History', description: 'Classical, jazz, rock, and beyond' },
    { name: 'Composition', description: 'Songwriting and arranging' },
    { name: 'Ear Training', description: 'Interval recognition and sight-reading' },
    { name: 'Orchestra & Ensemble', description: 'Conducting and group performance' },
    { name: 'Electronic Music', description: 'Synthesis, sampling, and DJing' },
  ]},
  { name: 'Art', icon: Palette, color: '#14B8A6', subCategories: [
    { name: 'Drawing', description: 'Pencil, charcoal, and ink techniques' },
    { name: 'Painting', description: 'Oil, acrylic, and watercolor' },
    { name: 'Digital Art', description: 'Illustration, 3D modeling, and design' },
    { name: 'Photography', description: 'Composition, lighting, and editing' },
    { name: 'Sculpture', description: 'Clay, stone, and mixed media' },
    { name: 'Graphic Design', description: 'Typography, layout, and branding' },
    { name: 'Animation', description: '2D, 3D, and motion graphics' },
    { name: 'Art History', description: 'Movements from Renaissance to modern' },
    { name: 'Ceramics', description: 'Pottery, glazing, and kiln techniques' },
    { name: 'Printmaking', description: 'Linocut, etching, and screen printing' },
  ]},
  { name: 'Languages', icon: Languages, color: '#A855F7', subCategories: [
    { name: 'Spanish', description: 'Grammar, vocabulary, and conversation' },
    { name: 'French', description: 'Pronunciation, writing, and culture' },
    { name: 'Mandarin Chinese', description: 'Characters, tones, and pinyin' },
    { name: 'German', description: 'Grammar, cases, and vocabulary' },
    { name: 'Japanese', description: 'Hiragana, katakana, and kanji' },
    { name: 'Arabic', description: 'Script, grammar, and dialects' },
    { name: 'Korean', description: 'Hangul, grammar, and expressions' },
    { name: 'Portuguese', description: 'Brazilian and European variants' },
    { name: 'Italian', description: 'Grammar, vocabulary, and pronunciation' },
    { name: 'Linguistics', description: 'Phonetics, syntax, and semantics' },
  ]},
];

export default function CourseView() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolled, setEnrolled] = useState<Subject[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadEnrolled = async () => {
    if (!user) return;
    const data = await fetchEnrolledSubjects(user.id);
    setEnrolled(data);
  };

  useEffect(() => { loadEnrolled(); }, [user?.id]);

  const handleEnroll = async () => {
    if (!selectedSubject || !selectedSubCategory) {
      toast({ title: 'Select a course', description: 'Pick a subject and specialization.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const preset = presetSubjects.find(p => p.name === selectedSubject);
      await enrollSubject(user?.id!, {
        name: `${selectedSubject} — ${selectedSubCategory}`,
        color: preset?.color || '#8B5CF6',
        icon: preset ? preset.icon.name?.toLowerCase() : 'book',
        description: preset?.subCategories.find(s => s.name === selectedSubCategory)?.description || '',
      });
      toast({ title: 'Enrolled', description: `${selectedSubject} — ${selectedSubCategory} added.` });
      setSelectedSubject(null);
      setSelectedSubCategory(null);
      setExpandedSubject(null);
      loadEnrolled();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const activeSubject = presetSubjects.find(s => s.name === expandedSubject);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Browse <span className="gradient-text">Courses</span>
        </h1>
        <p className="text-muted-foreground">Explore subjects and enroll in a specialization to study.</p>
      </div>

      {enrolled.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Your Courses</h2>
          <div className="flex flex-wrap gap-2">
            {enrolled.map((e, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-sm glass border border-border" style={{ borderColor: e.color + '60' }}>
                {e.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {expandedSubject && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mb-6">
            <Button variant="ghost" onClick={() => setExpandedSubject(null)}>
              <ChevronLeft className="h-4 w-4 mr-2" /> All Courses
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!expandedSubject ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {presetSubjects.map((subject, index) => {
              const Icon = subject.icon;
              const isActive = selectedSubject === subject.name;
              return (
                <motion.button key={subject.name}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => setExpandedSubject(subject.name)}
                  className={`relative p-6 rounded-2xl transition-all duration-300 group overflow-hidden border-2 ${isActive ? 'border-primary glow-purple' : 'border-transparent hover:border-primary/40'}`}
                  style={{ background: isActive ? `linear-gradient(135deg, hsl(var(--background)) 0%, ${subject.color}15 50%, hsl(var(--background)) 100%)` : undefined }}>
                  <div className="glass absolute inset-0 rounded-2xl" />
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: subject.color + '20' }}>
                      <Icon className="h-7 w-7" style={{ color: subject.color }} />
                    </div>
                    <p className="font-semibold text-lg">{subject.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{subject.subCategories.length} specializations</p>
                  </div>
                  {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div key="subcategories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8">
            {activeSubject && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: activeSubject.color + '20' }}>
                    <activeSubject.icon className="h-6 w-6" style={{ color: activeSubject.color }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{activeSubject.name}</h2>
                    <p className="text-sm text-muted-foreground">Select a specialization</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeSubject.subCategories.map((sub, i) => {
                    const isSelected = selectedSubject === activeSubject.name && selectedSubCategory === sub.name;
                    return (
                      <motion.button key={sub.name}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        onClick={() => { setSelectedSubject(activeSubject.name); setSelectedSubCategory(sub.name); }}
                        className={`p-4 rounded-xl text-left transition-all border-2 group ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent glass hover:border-primary/40'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{sub.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sub.description}</p>
                          </div>
                          {isSelected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass rounded-2xl p-6">
        <div>
          {selectedSubject && selectedSubCategory ? (
            <p className="text-foreground font-medium">
              Selected: <span className="text-primary">{selectedSubject}</span>{' → '}<span className="text-primary">{selectedSubCategory}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">No course selected yet</p>
          )}
        </div>
        <Button onClick={handleEnroll} size="lg" className="glow-purple px-8" disabled={loading || !selectedSubject || !selectedSubCategory}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Enroll<ArrowRight className="ml-2 h-5 w-5" /></>)}
        </Button>
      </div>
    </div>
  );
}