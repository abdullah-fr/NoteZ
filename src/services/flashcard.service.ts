import { supabase } from '@/integrations/supabase/client';
import { checkAndDeductCredits, refundCredits } from '@/lib/credits';
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


/* ── fetch ── */
export async function fetchFlashcards(userId: string): Promise<Flashcard[]> {
  return fetchCards(userId, false);
}

/** Returns only cards that are due right now (due_at <= now). */
export async function fetchDueCards(userId: string): Promise<Flashcard[]> {
  return fetchCards(userId, true);
}

/** Count of due cards — used by the badge. Safely handles legacy table schemas without error. */
export async function fetchDueCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('due_at', new Date().toISOString());
    if (!error && count !== null) return count;
    // If we got a 400 (column doesn't exist), fall through to legacy
  } catch {
    /* fallback to total cards count if due_at column doesn't exist */
  }

  try {
    const legacy = await supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (legacy.error) return 0;
    return legacy.count ?? 0;
  } catch {
    return 0;
  }
}

/* ── seed — kept as no-op for backward compat ── */
export async function seedDefaultCardsIfEmpty(_userId: string): Promise<void> {
  // No longer seeds default cards — user only sees cards they created or generated.
  return;
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

/* ── Generate flashcards from notes via Gemini ── */
export interface GenerateFlashcardsPayload {
  sourceText: string;
  subject: string;
  count?: number;
}

export async function generateFlashcardsFromNotes(
  payload: GenerateFlashcardsPayload,
  userId?: string,
): Promise<{ question: string; answer: string }[]> {
  const cardCount = payload.count || 10;

  // Credit check & deduction
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = userId || authData?.user?.id;

  const creditRes = await checkAndDeductCredits(
    effectiveUserId,
    'generate_flashcards',
    20,
    `Flashcard Deck: ${payload.subject} (${cardCount} cards)`,
    { subject: payload.subject, count: cardCount },
  );

  if (!creditRes.success) {
    const err: any = new Error(
      `You need 20 credits to generate flashcards, but you currently have ${creditRes.balanceAfter ?? 0} credits.`,
    );
    err.error = creditRes.code || 'INSUFFICIENT_CREDITS';
    err.field = 'generate_flashcards';
    err.action = 'generate_flashcards';
    err.limit = 20;
    err.required = 20;
    err.balance = creditRes.balanceAfter;
    err.resetDate = creditRes.resetDate;
    throw err;
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-flashcards', {
      body: {
        sourceText: payload.sourceText,
        subject: payload.subject,
        count: cardCount,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate flashcards');

    if (Array.isArray(data?.cards) && data.cards.length > 0) {
      return data.cards.map((c: any) => ({
        question: c.question || 'Question',
        answer: c.answer || 'Answer',
      }));
    }

    throw new Error('No flashcards returned from AI service.');
  } catch (err: any) {
    console.error('Flashcard service error:', err);
    await refundCredits(effectiveUserId, 20, 'generate_flashcards', err?.message || 'Flashcard generation failed');
    throw new Error(err?.message || 'Unable to generate flashcards. Please try again in a moment.');
  }
}


