import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const { count: c } = await supabase
        .from('flashcards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .lte('due_at', new Date().toISOString());
      setCount(c ?? 0);
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
