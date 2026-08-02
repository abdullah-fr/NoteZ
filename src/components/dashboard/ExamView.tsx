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
      <div className="flex items-center gap-1 border-b border-[hsl(220_8%_16%)]">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-[hsl(40_20%_75%)] text-[hsl(40_20%_88%)] font-semibold'
                  : 'border-transparent text-[hsl(40_8%_48%)] hover:text-[hsl(40_20%_75%)]'
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
