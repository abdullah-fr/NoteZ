/**
 * Prompt 24 — Public/Class Flashcard Deck Marketplace
 * Browse public decks, one-click import (copies cards — never a live link).
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { addFlashcard } from '@/services/flashcard.service';
import { Layers, Search, Download, Loader2, X, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface PublicDeck {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  card_count: number;
  created_at: string;
}

interface DeckCard {
  question: string;
  answer: string;
}

export default function DeckMarketplace() {
  const { user } = useAuth();
  const [decks, setDecks]           = useState<PublicDeck[]>([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [previewing, setPreviewing] = useState<PublicDeck | null>(null);
  const [previewCards, setPreviewCards] = useState<DeckCard[]>([]);
  const [importing, setImporting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('flashcard_decks')
      .select('id, title, subject, description, card_count, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);
    setDecks((data ?? []) as PublicDeck[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = decks.filter(d =>
    !query || d.title.toLowerCase().includes(query.toLowerCase()) ||
    (d.subject ?? '').toLowerCase().includes(query.toLowerCase())
  );

  async function openPreview(deck: PublicDeck) {
    setPreviewing(deck);
    const { data } = await supabase
      .from('flashcards')
      .select('question, answer')
      .eq('deck_id', deck.id)
      .limit(5);
    setPreviewCards((data ?? []) as DeckCard[]);
  }

  async function importDeck(deck: PublicDeck) {
    if (!user) return;
    setImporting(true);
    try {
      const { data: cards } = await supabase
        .from('flashcards')
        .select('question, answer')
        .eq('deck_id', deck.id);
      if (!cards?.length) { toast.error('No cards in this deck'); return; }
      for (const c of cards) {
        await addFlashcard(user.id, c.question, c.answer);
      }
      toast.success(`${cards.length} cards imported to your flashcards`);
      setPreviewing(null);
    } catch { toast.error('Import failed'); }
    finally { setImporting(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-foreground" />
        <h2 className="font-serif text-2xl tracking-tight">Public Flashcard Decks</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by title or subject…"
          className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-secondary p-12 text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">No public decks yet. Be the first to publish one from your Flashcards.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d, i) => (
            <motion.div key={d.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2 px-3 md:px-4 py-3 rounded-2xl border border-border bg-secondary hover:border-border transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{d.title}</p>
                {d.subject && <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{d.subject}</p>}
                {d.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.description}</p>}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{d.card_count} cards</span>
              <button onClick={() => openPreview(d)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
              ><Download className="h-3 w-3" /> Import</button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {previewing && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-[2px]" onClick={() => setPreviewing(null)}
            />
            <motion.div key="panel"
              initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl overflow-y-auto max-h-[90dvh]"
            >
              <span aria-hidden className="absolute left-0 top-0 h-px w-24 bg-foreground/40 rounded-tl-2xl" />
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif text-lg tracking-tight">{previewing.title}</h3>
                  {previewing.subject && <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-0.5">{previewing.subject}</p>}
                </div>
                <button onClick={() => setPreviewing(null)} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {previewCards.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Preview (first 5 cards)</p>
                  {previewCards.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-[11px] font-medium text-foreground/90">{c.question}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{c.answer}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => importDeck(previewing)} disabled={importing}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-sm border border-foreground/80 bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {importing ? 'Importing…' : `Import all ${previewing.card_count} cards`}
              </button>
              <p className="text-[10px] text-muted-foreground/50 mt-2 text-center font-mono">Cards are copied to your account — changes to the original don't affect you.</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
