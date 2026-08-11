import { supabase } from '@/integrations/supabase/client';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FSRSCard,
  type RecordLog,
} from 'ts-fsrs';

export type { Rating };

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  subject_id: string | null;
  user_id: string;
  due_at: string;
  stability: number;
  difficulty: number;
  last_reviewed_at: string | null;
  review_count: number;
  state: number; // 0=New 1=Learning 2=Review 3=Relearning
  created_at: string;
}

const f = fsrs(generatorParameters({ enable_fuzz: true }));

type FlashcardRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  question: string;
  answer: string;
  created_at: string;
  due_at?: string | null;
  stability?: number | null;
  difficulty?: number | null;
  last_reviewed_at?: string | null;
  review_count?: number | null;
  state?: number | null;
};

function normalizeCard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    user_id: row.user_id,
    subject_id: row.subject_id ?? null,
    question: row.question,
    answer: row.answer,
    created_at: row.created_at,
    due_at: row.due_at ?? row.created_at,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    last_reviewed_at: row.last_reviewed_at ?? null,
    review_count: row.review_count ?? 0,
    state: row.state ?? 0,
  };
}

const LEGACY_SELECT = 'id,user_id,subject_id,question,answer,created_at';

async function fetchCards(userId: string, dueOnly: boolean): Promise<Flashcard[]> {
  const modernQuery = supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId);
  const modernResult = dueOnly
    ? await modernQuery.lte('due_at', new Date().toISOString()).order('due_at', { ascending: true })
    : await modernQuery.order('due_at', { ascending: true });

  if (!modernResult.error) {
    return ((modernResult.data ?? []) as unknown as FlashcardRow[]).map(normalizeCard);
  }

  // Older deployments have the original six-column table but not the FSRS
  // columns yet. Keep the card view usable until that migration is applied.
  const legacyResult = await supabase
    .from('flashcards')
    .select(LEGACY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (legacyResult.error) throw modernResult.error;
  return ((legacyResult.data ?? []) as unknown as FlashcardRow[]).map(normalizeCard);
}

const DEFAULT_SEEDS = [
  { question: 'What is photosynthesis?', answer: 'The process by which plants convert sunlight, water, and CO₂ into glucose and oxygen.' },
  { question: "What is Newton's First Law?", answer: 'An object at rest stays at rest and an object in motion stays in motion unless acted upon by an external force.' },
  { question: 'What is the Pythagorean theorem?', answer: 'In a right triangle, a² + b² = c², where c is the hypotenuse.' },
  { question: 'What is DNA?', answer: 'Deoxyribonucleic acid — the molecule that carries genetic instructions for all living organisms.' },
  { question: 'What is the speed of light?', answer: 'Approximately 299,792 km/s (186,282 mi/s) in a vacuum.' },
];

/* ── fetch ── */
export async function fetchFlashcards(userId: string): Promise<Flashcard[]> {
  return fetchCards(userId, false);
}

/** Returns only cards that are due right now (due_at <= now). */
export async function fetchDueCards(userId: string): Promise<Flashcard[]> {
  return fetchCards(userId, true);
}

/** Count of due cards — used by the badge. */
export async function fetchDueCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_at', new Date().toISOString());
  if (error) return 0;
  return count ?? 0;
}

/* ── seed new accounts ── */
export async function seedDefaultCardsIfEmpty(userId: string): Promise<void> {
  const { count } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) > 0) return;

  const now = new Date().toISOString();
  const rows = DEFAULT_SEEDS.map(s => ({
    user_id: userId,
    question: s.question,
    answer: s.answer,
    due_at: now,
    stability: 0,
    difficulty: 0,
    last_reviewed_at: null,
    review_count: 0,
    state: 0,
  }));
  const modernInsert = await supabase.from('flashcards').insert(rows);
  if (modernInsert.error) {
    const legacyRows = DEFAULT_SEEDS.map(s => ({ user_id: userId, question: s.question, answer: s.answer }));
    const legacyInsert = await supabase.from('flashcards').insert(legacyRows);
    if (legacyInsert.error) throw modernInsert.error;
  }
}

/* ── add / delete ── */
export async function addFlashcard(
  userId: string,
  question: string,
  answer: string,
  subjectId?: string | null,
): Promise<Flashcard> {
  const modernResult = await supabase
    .from('flashcards')
    .insert({
      user_id: userId,
      question,
      answer,
      subject_id: subjectId ?? null,
      due_at: new Date().toISOString(),
      stability: 0,
      difficulty: 0,
      review_count: 0,
      state: 0,
    })
    .select()
    .single();
  if (!modernResult.error) return normalizeCard(modernResult.data as unknown as FlashcardRow);

  const legacyResult = await supabase
    .from('flashcards')
    .insert({ user_id: userId, question, answer, subject_id: subjectId ?? null })
    .select()
    .single();
  if (legacyResult.error) throw modernResult.error;
  return normalizeCard(legacyResult.data as unknown as FlashcardRow);
}

export async function deleteFlashcard(id: string): Promise<void> {
  const { error } = await supabase.from('flashcards').delete().eq('id', id);
  if (error) throw error;
}

/* ── FSRS review ── */
/**
 * Records a review for a card using the FSRS algorithm and writes the
 * updated scheduling data back to Supabase.
 *
 * @param card  The flashcard being reviewed.
 * @param rating  Again=1, Hard=2, Good=3, Easy=4
 * @returns The updated card row.
 */
export async function reviewCard(card: Flashcard, rating: Rating): Promise<Flashcard> {
  const fsrsCard: FSRSCard = {
    due:            new Date(card.due_at),
    stability:      card.stability,
    difficulty:     card.difficulty,
    elapsed_days:   0,
    scheduled_days: 0,
    reps:           card.review_count,
    lapses:         0,
    state:          card.state as FSRSCard['state'],
    last_review:    card.last_reviewed_at ? new Date(card.last_reviewed_at) : undefined,
  };

  const now = new Date();
  const scheduling: RecordLog = f.repeat(fsrsCard, now);
  const next = scheduling[rating].card;

  const patch = {
    due_at:            next.due.toISOString(),
    stability:         next.stability,
    difficulty:        next.difficulty,
    last_reviewed_at:  now.toISOString(),
    review_count:      next.reps,
    state:             next.state,
  };

  const modernResult = await supabase
    .from('flashcards')
    .update(patch)
    .eq('id', card.id)
    .select()
    .single();
  if (!modernResult.error) return normalizeCard(modernResult.data as unknown as FlashcardRow);

  // Legacy tables cannot persist FSRS scheduling fields; keep the review
  // result usable in the current session rather than breaking the deck.
  return { ...card, ...patch, due_at: patch.due_at };
}
