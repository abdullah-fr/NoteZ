import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDueCount } from '@/services/flashcard.service';

/**
 * Returns the count of flashcards due right now for the given user.
 * Subscribes to Realtime so the count updates live as cards are reviewed.
 * Returns 0 on any error — never throws.
 */
export function useDueCardsCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    async function fetch() {
      const c = await fetchDueCount(userId!);
      setCount(c);
    }

    fetch();

    // Update document title
    const channel = supabase
      .channel(`due-cards-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'flashcards',
        filter: `user_id=eq.${userId}`,
      }, () => fetch())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  // Update <title> whenever count changes
  useEffect(() => {
    const base = 'NoteZ';
    document.title = count > 0 ? `(${count}) ${base}` : base;
    return () => { document.title = base; };
  }, [count]);

  return count;
}
