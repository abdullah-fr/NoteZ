import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rating } from 'ts-fsrs';
import { useAuth } from '@/lib/auth';
import {
  fetchFlashcards, fetchDueCards, addFlashcard, deleteFlashcard,
  reviewCard, seedDefaultCardsIfEmpty, type Flashcard,
} from '@/services/flashcard.service';
import { Shuffle, ChevronLeft, ChevronRight, Layers, Plus, Trash2, RotateCw, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

/* ── rating labels ── */
const RATINGS: { rating: Rating; label: string; key: string; desc: string }[] = [
  { rating: Rating.Again, label: 'Again', key: '1', desc: 'Completely forgot' },
  { rating: Rating.Hard,  label: 'Hard',  key: '2', desc: 'Recalled with effort' },
  { rating: Rating.Good,  label: 'Good',  key: '3', desc: 'Recalled correctly' },
  { rating: Rating.Easy,  label: 'Easy',  key: '4', desc: 'Recalled instantly' },
];

export default function FlashcardsView() {
  const { user } = useAuth();
  const [allCards, setAllCards]       = useState<Flashcard[]>([]);
  const [queue, setQueue]             = useState<Flashcard[]>([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [flipped, setFlipped]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [reviewing, setReviewing]     = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQ, setNewQ]               = useState('');
  const [newA, setNewA]               = useState('');
  const [sessionDone, setSessionDone] = useState(0); // reviewed this session

  /* ── load ── */
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await seedDefaultCardsIfEmpty(user.id);
      const [due, all] = await Promise.all([
        fetchDueCards(user.id),
        fetchFlashcards(user.id),
      ]);
      setAllCards(all);
      // Queue: due cards first, then unseen/new cards
      const dueIds = new Set(due.map(c => c.id));
      const newCards = all.filter(c => !dueIds.has(c.id) && c.review_count === 0);
      setQueue([...due, ...newCards]);
      setCurrentIdx(0);
      setFlipped(false);
    } catch (e: any) {
      toast.error('Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* ── keyboard shortcuts for ratings ── */
  useEffect(() => {
    if (!flipped) return;
    const handler = (e: KeyboardEvent) => {
      const r = RATINGS.find(r => r.key === e.key);
      if (r) handleRate(r.rating);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, currentIdx, queue]);

  const currentCard = queue[currentIdx];
  const dueCount    = queue.filter(c => new Date(c.due_at) <= new Date()).length;

  /* ── review ── */
  async function handleRate(rating: Rating) {
    if (!currentCard || reviewing) return;
    setReviewing(true);
    try {
      const updated = await reviewCard(currentCard, rating);
      setAllCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      setSessionDone(n => n + 1);
      // Advance
      setFlipped(false);
      setTimeout(() => {
        if (currentIdx + 1 < queue.length) {
          setCurrentIdx(i => i + 1);
        } else {
          // Session complete — reload to pick up any Again cards now due
          load();
          setSessionDone(0);
        }
      }, 120);
    } catch {
      toast.error('Failed to save review');
    } finally {
      setReviewing(false);
    }
  }

  /* ── add ── */
  async function handleAdd() {
    if (!user || !newQ.trim() || !newA.trim()) return;
    try {
      const card = await addFlashcard(user.id, newQ.trim(), newA.trim());
      setAllCards(prev => [...prev, card]);
      setQueue(prev => [...prev, card]);
      setNewQ(''); setNewA('');
      setShowAddForm(false);
      toast.success('Flashcard added');
    } catch { toast.error('Failed to add card'); }
  }

  /* ── delete ── */
  async function handleDelete() {
    if (!currentCard) return;
    try {
      await deleteFlashcard(currentCard.id);
      const newQueue = queue.filter(c => c.id !== currentCard.id);
      setQueue(newQueue);
      setAllCards(prev => prev.filter(c => c.id !== currentCard.id));
      setCurrentIdx(i => Math.min(i, newQueue.length - 1));
      setFlipped(false);
    } catch { toast.error('Failed to delete card'); }
  }

  /* ── shuffle ── */
  function handleShuffle() {
    setQueue(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIdx(0);
    setFlipped(false);
  }

  /* ── render ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-5 gap-2 flex-wrap">
        <h2 className="font-serif text-2xl tracking-tight flex items-center gap-2.5 shrink-0">
          <Layers className="h-5 w-5 text-foreground" />
          Flashcards
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Due badge */}
          {dueCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/15 border border-destructive/25 text-destructive text-[11px] font-mono">
              <Clock className="h-3 w-3" /> {dueCount} due
            </span>
          )}
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Card
          </button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-secondary p-4 space-y-3">
              <input value={newQ} onChange={e => setNewQ(e.target.value)}
                placeholder="Question…"
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
              />
              <input value={newA} onChange={e => setNewA(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Answer…"
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={!newQ.trim() || !newA.trim()}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-40"
                >Save</button>
                <button onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
                >Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-border bg-secondary p-12 text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-[14px] font-medium text-foreground mb-1">All caught up</p>
          <p className="text-[12px] text-muted-foreground">No cards due. Add new ones or come back tomorrow.</p>
        </div>
      ) : (
        <>
          {/* Counter + session progress */}
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-3">
            <span>Card {currentIdx + 1} / {queue.length}</span>
            <span className="flex items-center gap-1.5">
              {sessionDone > 0 && <span className="text-foreground">{sessionDone} reviewed this session</span>}
              {currentCard && (
                <span className={currentCard.review_count === 0 ? 'text-notez-indigo/70' : 'text-muted-foreground'}>
                  {currentCard.review_count === 0 ? 'New' : `Reviewed ${currentCard.review_count}×`}
                </span>
              )}
            </span>
          </div>

          {/* Card */}
          <div className="perspective-1000 mb-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentCard?.id}-${flipped ? 'a' : 'q'}`}
                initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={() => !flipped && setFlipped(true)}
                className="min-h-[260px] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden border border-border bg-secondary shadow-2xl cursor-pointer"
              >
                <span className="absolute left-0 top-0 h-px w-16 bg-[hsl(var(--foreground))]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
                  {flipped ? 'Answer' : 'Question — click to reveal'}
                </span>
                <p className="text-lg text-center font-medium leading-relaxed text-foreground max-w-lg">
                  {flipped ? currentCard?.answer : currentCard?.question}
                </p>
                {!flipped && (
                  <span className="text-[10px] font-mono text-muted-foreground mt-5 flex items-center gap-1">
                    <RotateCw className="h-3 w-3" /> Click to flip
                  </span>
                )}
                {flipped && currentCard?.due_at && (
                  <span className="text-[10px] font-mono text-muted-foreground mt-4">
                    Next due: {formatDistanceToNow(new Date(currentCard.due_at), { addSuffix: true })}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Rating buttons — only visible after flip */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5"
              >
                {RATINGS.map(r => (
                  <button key={r.rating} onClick={() => handleRate(r.rating)} disabled={reviewing}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary hover:border-border transition-all disabled:opacity-40"
                  >
                    <span className="text-[13px] font-semibold text-foreground">{r.label}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{r.desc}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">Press {r.key}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav controls */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={() => { setCurrentIdx(i => Math.max(0, i - 1)); setFlipped(false); }}
              disabled={currentIdx === 0}
              className="h-9 w-9 rounded-xl border border-border bg-secondary hover:bg-secondary flex items-center justify-center text-foreground transition-colors disabled:opacity-30"
            ><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={handleShuffle}
              className="h-9 px-3.5 rounded-xl border border-border bg-secondary hover:bg-secondary flex items-center gap-1.5 text-[12px] font-mono text-foreground transition-colors"
            ><Shuffle className="h-3.5 w-3.5" /> Shuffle</button>
            <button onClick={() => { setCurrentIdx(i => Math.min(queue.length - 1, i + 1)); setFlipped(false); }}
              disabled={currentIdx >= queue.length - 1}
              className="h-9 px-4 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-30"
            >Next</button>
            <button onClick={handleDelete} disabled={queue.length <= 1}
              className="h-9 w-9 rounded-xl border border-border bg-secondary hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-30"
            ><Trash2 className="h-3.5 w-3.5" /></button>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-5 flex-wrap max-w-md mx-auto">
            {queue.slice(0, 30).map((c, i) => (
              <button key={c.id} onClick={() => { setCurrentIdx(i); setFlipped(false); }}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIdx ? 'bg-[hsl(var(--foreground))] w-4'
                  : c.review_count === 0 ? 'bg-notez-indigo/40 w-1.5'
                  : 'bg-secondary w-1.5 hover:bg-secondary'
                }`}
              />
            ))}
            {queue.length > 30 && (
              <span className="text-[9px] font-mono text-muted-foreground">+{queue.length - 30}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
