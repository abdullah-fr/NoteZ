import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import activitiesVideo from '../../../videos/activities.mov';
import activitiesPreview from '../../../videos/activities pic.png';
import calendarVideo from '../../../videos/calender.mov';
import calendarPreview from '../../../videos/calender pic.png';
import dashboardVideo from '../../../videos/dashboard.mov';
import dashboardPreview from '../../../videos/dashboard-preview.jpg';
import examVideo from '../../../videos/exam.mov';
import examPreview from '../../../videos/exam preview.png';
import flashcardsVideo from '../../../videos/flashcards.mov';
import flashcardsPreview from '../../../videos/flascard pic.png';
import focusTimerVideo from '../../../videos/focus timer.mov';
import focusTimerPreview from '../../../videos/focus timer pic.png';
import foldersVideo from '../../../videos/folders.mov';
import folderGraphPreview from '../../../videos/folder graph view.png';
import folderListPreview from '../../../videos/folder list view.png';
import notezAiVideo from '../../../videos/notez ai.mov';
import notezAiPreview from '../../../videos/notez ai pic.png';
import {
  ArrowRight,
  ChevronDown,
  CalendarDays,
  Folder,
  GraduationCap,
  Layers,
  ListChecks,
  MessageSquare,
  Pause,
  PanelLeft,
  Play,
  Timer,
} from 'lucide-react';

type FeatureId =
  | 'dashboard'
  | 'folders'
  | 'exam'
  | 'flashcards'
  | 'activities'
  | 'notez-ai'
  | 'calendar'
  | 'focus-timer';

interface FeatureItem {
  id: FeatureId;
  title: string;
  icon: typeof Folder;
  eyebrow: string;
  description: string;
  workflow: string;
}

const features: FeatureItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: PanelLeft,
    eyebrow: 'Your study overview',
    description: 'See folders, practice, activities, and focus progress at a glance so the next useful action is always close.',
    workflow: 'Review your momentum',
  },
  {
    id: 'folders',
    title: 'Folders',
    icon: Folder,
    eyebrow: 'Material and editor',
    description: 'Create folders, keep notes together, import documents, and work in a rich editor with AI assistance and an outline rail.',
    workflow: 'Organize and write',
  },
  {
    id: 'exam',
    title: 'Exam',
    icon: GraduationCap,
    eyebrow: 'Practice and feedback',
    description: 'Generate a practice or mock exam from your material, answer questions, and use the results to see where to review next.',
    workflow: 'Test your understanding',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    icon: Layers,
    eyebrow: 'Active recall',
    description: 'Generate cards from notes, reveal the answer, and review each card with spaced-repetition ratings.',
    workflow: 'Strengthen recall',
  },
  {
    id: 'activities',
    title: 'Activities',
    icon: ListChecks,
    eyebrow: 'Material to action',
    description: 'Import study material and turn it into task packages you can complete, track, and revisit.',
    workflow: 'Turn plans into progress',
  },
  {
    id: 'notez-ai',
    title: 'NoteZ AI',
    icon: MessageSquare,
    eyebrow: 'Context-aware study chat',
    description: 'Ask about a folder or note, choose a thinking mode, and get explanations grounded in the material you are studying.',
    workflow: 'Ask better questions',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    icon: CalendarDays,
    eyebrow: 'Plan the week',
    description: 'Keep tasks, deadlines, and events together with clear priorities and study blocks you can act on.',
    workflow: 'Make time visible',
  },
  {
    id: 'focus-timer',
    title: 'Focus Timer',
    icon: Timer,
    eyebrow: 'Focused sessions',
    description: 'Start a Focus session, switch to Break when it is time, and keep your study rhythm connected to the rest of NoteZ.',
    workflow: 'Protect deep work',
  },
];

const folderPreviewSlides = [
  {
    src: folderListPreview,
    alt: 'NoteZ folders in list view with notes and folder actions',
    label: 'List view',
  },
  {
    src: folderGraphPreview,
    alt: 'NoteZ folders in graph view with connected notes',
    label: 'Graph view',
  },
] as const;

function DemoFrame({ feature, children }: { feature: FeatureItem; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="rounded-2xl border border-border/80 bg-card/70 shadow-xl overflow-hidden"
      aria-label={`${feature.title} product demonstration`}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/70 bg-secondary/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </div>
          <span className="truncate text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            NoteZ / {feature.title}
          </span>
        </div>
        <span className="shrink-0 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-primary">
          Product demo
        </span>
      </div>

      <div className={feature.id === 'dashboard' || feature.id === 'exam' ? 'p-2 sm:p-3' : 'p-4 sm:p-6 min-h-[360px] flex items-center'}>
        {children}
      </div>

    </motion.div>
  );
}

function DashboardDemo() {
  return (
    <div className="relative aspect-video max-h-[calc(100vh-10rem)] w-full overflow-hidden rounded-xl bg-background/70">
      <video
        src={dashboardVideo}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="theme-adaptive-media absolute inset-0 block h-full w-full object-contain"
        aria-label="NoteZ dashboard product demonstration"
        onLoadedMetadata={(event) => {
          event.currentTarget.defaultPlaybackRate = 1.5;
          event.currentTarget.playbackRate = 1.5;
        }}
        onPlay={(event) => {
          event.currentTarget.playbackRate = 1.5;
        }}
      />
    </div>
  );
}

function FolderPreviewSlideshow() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % folderPreviewSlides.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activePreview = folderPreviewSlides[activeSlide];

  return (
    <div className="relative h-full w-full overflow-hidden bg-background/70" aria-label="Folders view preview">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={activePreview.src}
          src={activePreview.src}
          alt={activePreview.alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
        />
      </AnimatePresence>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1.5 shadow-lg backdrop-blur-sm" aria-label="Choose folders preview">
        {folderPreviewSlides.map((slide, index) => (
          <button
            key={slide.label}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Show folders ${slide.label}`}
            aria-current={activeSlide === index ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${activeSlide === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/50 hover:bg-muted-foreground'}`}
          />
        ))}
      </div>
    </div>
  );
}

function FeaturePreview({ feature, onViewDemo }: { feature: FeatureItem; onViewDemo: () => void }) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-xl lg:flex lg:h-full lg:flex-col"
      aria-label={`${feature.title} section preview`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-secondary/20 px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        </div>
        <button
          type="button"
          onClick={onViewDemo}
          className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-primary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={`View full ${feature.title} demo`}
        >
          View full demo
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative aspect-[2760/1520] w-full overflow-hidden bg-background/70 lg:min-h-0 lg:flex-1 lg:aspect-auto">
        {feature.id === 'dashboard' ? (
          <img
            src={dashboardPreview}
            alt="NoteZ dashboard overview"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'folders' ? (
          <FolderPreviewSlideshow />
        ) : feature.id === 'exam' ? (
          <img
            src={examPreview}
            alt="NoteZ exam simulation and practice"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'flashcards' ? (
          <img
            src={flashcardsPreview}
            alt="NoteZ flashcards generated from notes"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'activities' ? (
          <img
            src={activitiesPreview}
            alt="NoteZ activities generated from study material"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'notez-ai' ? (
          <img
            src={notezAiPreview}
            alt="NoteZ AI study chat"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'calendar' ? (
          <img
            src={calendarPreview}
            alt="NoteZ study calendar"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : feature.id === 'focus-timer' ? (
          <img
            src={focusTimerPreview}
            alt="NoteZ Focus Timer"
            className="theme-adaptive-media absolute inset-0 block h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">{feature.title}</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{feature.eyebrow}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function useSmoothVideoProgress(videoRef: { current: HTMLVideoElement | null }, isPlaying: boolean, setCurrentTime: (time: number) => void) {
  useEffect(() => {
    if (!isPlaying) return undefined;

    let frameId = 0;
    const updateProgress = () => {
      const video = videoRef.current;
      if (!video) return;

      setCurrentTime(video.currentTime);
      if (!video.paused && !video.ended) frameId = window.requestAnimationFrame(updateProgress);
    };

    frameId = window.requestAnimationFrame(updateProgress);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, setCurrentTime, videoRef]);
}

function ExamVideoDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useSmoothVideoProgress(videoRef, isPlaying, setCurrentTime);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.currentTarget.value);
    setCurrentTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="relative aspect-video bg-background">
        <video
          ref={videoRef}
          src={examVideo}
          poster={examPreview}
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="theme-adaptive-media absolute inset-0 block h-full w-full object-contain"
          aria-label="NoteZ exam product demonstration"
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration);
          }}
          onDurationChange={(event) => {
            setDuration(event.currentTarget.duration);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 bg-secondary/20 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={isPlaying ? 'Pause exam demo' : 'Play exam demo'}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        </button>
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">{formatVideoTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.01"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          className="h-1.5 min-w-[8rem] flex-1 cursor-pointer accent-primary"
          aria-label="Seek exam demo"
        />
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">{formatVideoTime(duration)}</span>
      </div>
    </div>
  );
}

function ProductVideoDemo({ src, poster, title }: { src: string; poster: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useSmoothVideoProgress(videoRef, isPlaying, setCurrentTime);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.currentTarget.value);
    setCurrentTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="relative aspect-video bg-background">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="theme-adaptive-media absolute inset-0 block h-full w-full object-contain"
          aria-label={`${title} product demonstration`}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration);
          }}
          onDurationChange={(event) => {
            setDuration(event.currentTarget.duration);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 bg-secondary/20 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={isPlaying ? `Pause ${title} demo` : `Play ${title} demo`}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        </button>
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">{formatVideoTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.01"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          className="h-1.5 min-w-[8rem] flex-1 cursor-pointer accent-primary"
          aria-label={`Seek ${title} demo`}
        />
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">{formatVideoTime(duration)}</span>
      </div>
    </div>
  );
}

function FeatureDemo({ feature }: { feature: FeatureItem }) {
  let content: ReactNode;
  switch (feature.id) {
    case 'dashboard': content = <DashboardDemo />; break;
    case 'folders': content = <ProductVideoDemo src={foldersVideo} poster={folderListPreview} title="Folders" />; break;
    case 'exam': content = <ExamVideoDemo />; break;
    case 'flashcards': content = <ProductVideoDemo src={flashcardsVideo} poster={flashcardsPreview} title="Flashcards" />; break;
    case 'activities': content = <ProductVideoDemo src={activitiesVideo} poster={activitiesPreview} title="Activities" />; break;
    case 'notez-ai': content = <ProductVideoDemo src={notezAiVideo} poster={notezAiPreview} title="NoteZ AI" />; break;
    case 'calendar': content = <ProductVideoDemo src={calendarVideo} poster={calendarPreview} title="Calendar" />; break;
    case 'focus-timer': content = <ProductVideoDemo src={focusTimerVideo} poster={focusTimerPreview} title="Focus Timer" />; break;
  }

  return (
    <DemoFrame feature={feature}>
      {content}
    </DemoFrame>
  );
}

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = features[activeIndex];
  const ActiveIcon = activeFeature.icon;
  const scrollToDemo = () => {
    document.getElementById('feature-demo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section id="features" className="relative overflow-hidden bg-background/50 py-20 sm:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] lg:grid-rows-[108px_auto] lg:gap-x-10 lg:gap-y-4">
          <div className="max-w-3xl lg:col-start-1 lg:row-start-1 lg:flex lg:h-full lg:flex-col lg:justify-end">
            <div className="min-w-0 lg:min-h-[106px]">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.24em] text-primary">The NoteZ workflow</p>
              <h2 className="mb-2 font-display text-[1.625rem] font-semibold leading-[1.05] tracking-tight">
                Study material in. <span className="text-primary">Momentum out.</span>
              </h2>
              <p className="max-w-sm text-[11px] leading-[1.35] text-muted-foreground">
                Move from organized material to focused practice, feedback, and better recall.
              </p>
            </div>
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:sticky lg:top-28">
            <div className="border-l-2 border-border/70 pl-3" aria-label="NoteZ sections">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-pressed={isActive}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground group-hover:text-foreground'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">{feature.title}</span>
                      <span className={`block truncate text-[10px] ${isActive ? 'text-primary/80' : 'text-muted-foreground/70'}`}>{feature.workflow}</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-50">{String(index + 1).padStart(2, '0')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:flex lg:h-full lg:flex-col lg:justify-end">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <ActiveIcon className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em]">{activeFeature.eyebrow}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{activeFeature.title}</h3>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground lg:h-[39px] lg:line-clamp-2">{activeFeature.description}</p>
              </div>
              <ArrowRight className="mb-1 hidden h-5 w-5 shrink-0 text-primary sm:block" />
            </div>

          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-2 lg:self-stretch">
            <AnimatePresence mode="wait" initial={false}>
              <FeaturePreview key={activeFeature.id} feature={activeFeature} onViewDemo={scrollToDemo} />
            </AnimatePresence>
          </div>
        </div>

        <div id="feature-demo" className="mt-10 scroll-mt-24 sm:mt-14">
          <AnimatePresence mode="wait" initial={false}>
            <FeatureDemo key={activeFeature.id} feature={activeFeature} />
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
