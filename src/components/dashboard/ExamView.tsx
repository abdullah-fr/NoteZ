import { useState } from 'react';
import { GraduationCap, Layers, ListChecks } from 'lucide-react';
import ExamQuizView from './ExamQuizView';
import FlashcardsView from './FlashcardsView';
import ActivitiesView from './ActivitiesView';

type Tab = 'quiz' | 'flashcards' | 'activities';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'quiz', label: 'Quiz Exam', icon: GraduationCap },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'activities', label: 'Activities', icon: ListChecks },
];

export default function ExamView() {
  const [tab, setTab] = useState<Tab>('quiz');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${active
                  ? 'border-[hsl(var(--foreground))] text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'quiz' && <ExamQuizView />}
      {tab === 'flashcards' && <FlashcardsView />}
      {tab === 'activities' && <ActivitiesView />}
    </div>
  );
}
