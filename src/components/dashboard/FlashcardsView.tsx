import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rating } from 'ts-fsrs';
import { useAuth } from '@/lib/auth';
import {
  fetchFlashcards, addFlashcard, deleteFlashcard,
  reviewCard, generateFlashcardsFromNotes, type Flashcard,
} from '@/services/flashcard.service';
import {
  Shuffle, ChevronLeft, Layers, Plus, Trash2, RotateCw,
  Loader2, Folder, FileText, CheckSquare, Square, ChevronDown,
  Sparkles, Brain,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── rating labels ── */
const RATINGS: { rating: Rating; label: string; key: string; desc: string }[] = [
  { rating: Rating.Again, label: 'Again', key: '1', desc: 'Completely forgot' },
  { rating: Rating.Hard,  label: 'Hard',  key: '2', desc: 'Recalled with effort' },
  { rating: Rating.Good,  label: 'Good',  key: '3', desc: 'Recalled correctly' },
  { rating: Rating.Easy,  label: 'Easy',  key: '4', desc: 'Recalled instantly' },
];

/* ── helper to strip HTML from note content ── */
function cleanNoteText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

interface FolderNote {
  id: string;
  title: string;
  content: string;
  categoryName: string;
}

interface LocalFolderData {
  id: string;
  name: string;
  notes: FolderNote[];
}

const GENERATE_STEPS = [
  'Reading your notes…',
  'Extracting key concepts…',
  'Creating flashcard pairs…',
  'Finalizing cards…',
];

export default function FlashcardsView() {
  const { user } = useAuth();
  const [allCards, setAllCards]       = useState<Flashcard[]>([]);
  const [queue, setQueue]            = useState<Flashcard[]>([]);
  const [currentIdx, setCurrentIdx]  = useState(0);
  const [flipped, setFlipped]        = useState(false);
  const [loading, setLoading]        = useState(true);
  const [reviewing, setReviewing]    = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQ, setNewQ]              = useState('');
  const [newA, setNewA]              = useState('');

  // Navigation direction state for distinct card change animation ('next' = 1, 'prev' = -1)
  const [slideDirection, setSlideDirection] = useState<number>(1);

  // Dynamic folders state
  const [foldersData, setFoldersData] = useState<LocalFolderData[]>([]);

  // Generate from Notes state
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generating, setGenerating]  = useState(false);
  const [generateStep, setGenerateStep] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [genCardCount, setGenCardCount] = useState(10);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load folders from localStorage
  const loadLocalFolders = useCallback(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('notez_folders') || '[]');
      const parsed: LocalFolderData[] = raw.map((f: any) => {
        const notes: FolderNote[] = [];
        (f.categories || []).forEach((cat: any) => {
          (cat.notes || []).forEach((n: any) => {
            notes.push({
              id: n.id,
              title: n.title || 'Untitled Note',
              content: n.content || '',
              categoryName: cat.name || 'Notes',
            });
          });
        });
        return { id: f.id, name: f.name || 'Folder', notes };
      });
      setFoldersData(parsed);
    } catch {
      setFoldersData([]);
    }
  }, []);

  useEffect(() => {
    loadLocalFolders();
    const handleUpdate = () => loadLocalFolders();
    window.addEventListener('notez:folders-updated', handleUpdate);
    return () => window.removeEventListener('notez:folders-updated', handleUpdate);
  }, [loadLocalFolders]);

  const currentFolder = foldersData.find(f => f.id === selectedFolderId);

  // Close folder dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── load cards ── */
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const all = await fetchFlashcards(user.id);
      setAllCards(all);
      setQueue(all);
      setCurrentIdx(0);
      setFlipped(false);
    } catch (e: any) {
      toast.error('Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* ── keyboard shortcuts (left/right nav) ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextCard();
      if (e.key === 'ArrowLeft')  handlePrevCard();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, queue]);

  /* ── generate steps rotator ── */
  useEffect(() => {
    if (!generating) return;
    setGenerateStep(0);
    const interval = setInterval(() => {
      setGenerateStep(prev => (prev < GENERATE_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [generating]);

  const currentCard = queue[currentIdx];

  /* ── review (kept internal, no UI shown) ── */
  async function handleRate() {
    // no-op: rating UI removed, cards are browsed freely
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
      setCurrentIdx(i => Math.max(0, Math.min(i, newQueue.length - 1)));
      setFlipped(false);
      toast.success('Flashcard deleted');
    } catch { toast.error('Failed to delete card'); }
  }

  /* ── shuffle ── */
  function handleShuffle() {
    setSlideDirection(1);
    setQueue(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIdx(0);
    setFlipped(false);
  }

  /* ── card navigation ── */
  function handleNextCard() {
    if (currentIdx < queue.length - 1) {
      setSlideDirection(1);
      setCurrentIdx(i => i + 1);
      setFlipped(false);
    }
  }

  function handlePrevCard() {
    if (currentIdx > 0) {
      setSlideDirection(-1);
      setCurrentIdx(i => i - 1);
      setFlipped(false);
    }
  }

  function handleJumpToCard(idx: number) {
    setSlideDirection(idx > currentIdx ? 1 : -1);
    setCurrentIdx(idx);
    setFlipped(false);
  }

  /* ── folder selection for generate ── */
  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setFolderDropdownOpen(false);
    if (!folderId) {
      setSelectedNoteIds(new Set());
      return;
    }
    const folder = foldersData.find(f => f.id === folderId);
    if (folder) {
      setSelectedNoteIds(new Set(folder.notes.map(n => n.id)));
    }
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const toggleSelectAllNotes = () => {
    if (!currentFolder) return;
    if (selectedNoteIds.size === currentFolder.notes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(currentFolder.notes.map(n => n.id)));
    }
  };

  function getSelectedNotesSourceText(): string {
    if (!currentFolder) return '';
    const parts: string[] = [];
    let idx = 1;
    for (const note of currentFolder.notes) {
      if (selectedNoteIds.has(note.id)) {
        const cleanContent = cleanNoteText(note.content);
        if (cleanContent) {
          parts.push(`--- NOTE ${idx}: ${note.title} (Category: ${note.categoryName}) ---\n${cleanContent}`);
          idx++;
        }
      }
    }
    return parts.join('\n\n');
  }

  /* ── generate flashcards from notes ── */
  async function handleGenerateFromNotes() {
    if (!user || !currentFolder) return;
    if (selectedNoteIds.size === 0) {
      toast.error('Please select at least one note.');
      return;
    }
    const sourceText = getSelectedNotesSourceText();
    if (!sourceText.trim()) {
      toast.error('Selected notes have no readable content.');
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateFlashcardsFromNotes({
        sourceText,
        subject: currentFolder.name,
        count: genCardCount,
      });

      // Insert each generated card
      const newCards: Flashcard[] = [];
      for (const g of generated) {
        try {
          const card = await addFlashcard(user.id, g.question, g.answer);
          newCards.push(card);
        } catch {
          // skip individual failures
        }
      }

      if (newCards.length > 0) {
        setAllCards(prev => [...prev, ...newCards]);
        setQueue(prev => [...prev, ...newCards]);
        toast.success(`${newCards.length} flashcards generated from your notes!`);
        setShowGeneratePanel(false);
        setSelectedFolderId(null);
        setSelectedNoteIds(new Set());
      } else {
        toast.error('No flashcards could be generated. Please try again.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setGenerating(false);
    }
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
      {/* Actions */}
      <div className="flex items-center justify-end mb-5 gap-2 flex-wrap">
        <button
          onClick={() => {
            loadLocalFolders();
            setShowGeneratePanel(v => !v);
            if (showAddForm) setShowAddForm(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-[12px] font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate from Notes
        </button>
        <button
          onClick={() => { setShowAddForm(v => !v); if (showGeneratePanel) setShowGeneratePanel(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Card
        </button>
      </div>

      {/* Generate from Notes Panel */}
      <AnimatePresence>
        {showGeneratePanel && !generating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 relative"
          >
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-lg relative">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Generate Flashcards from Notes</span>
              </div>

              {/* Folder dropdown */}
              <div ref={dropdownRef} className="relative z-20">
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Select Folder
                </label>
                <button
                  type="button"
                  onClick={() => {
                    loadLocalFolders();
                    setFolderDropdownOpen(v => !v);
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-secondary/60 border border-border/80 text-xs text-foreground flex items-center justify-between font-medium hover:bg-secondary transition-colors outline-none focus:border-primary"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {currentFolder ? `${currentFolder.name} (${currentFolder.notes.length} notes)` : 'Choose a folder…'}
                    </span>
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown overlay menu */}
                <AnimatePresence>
                  {folderDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 left-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-card p-1.5 shadow-2xl max-h-60 overflow-y-auto space-y-0.5"
                    >
                      {foldersData.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground px-2.5 py-2">No folders found. Create a folder and add notes first.</p>
                      ) : (
                        foldersData.map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFolderSelect(f.id)}
                            className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                              selectedFolderId === f.id
                                ? 'bg-primary/80 text-primary-foreground font-semibold'
                                : 'text-foreground hover:bg-secondary'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate pr-2">
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate font-medium">{f.name}</span>
                            </span>
                            <span className="font-mono text-[10px] opacity-80 shrink-0">
                              {f.notes.length} {f.notes.length === 1 ? 'note' : 'notes'}
                            </span>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Note checklist when folder is selected */}
              {currentFolder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-xl border border-border bg-secondary/30 p-2.5 space-y-1.5 relative z-10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Notes ({selectedNoteIds.size}/{currentFolder.notes.length} selected)
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAllNotes}
                      className="text-[11px] text-primary font-semibold hover:underline"
                    >
                      {selectedNoteIds.size === currentFolder.notes.length ? 'Clear all' : 'Select all'}
                    </button>
                  </div>

                  {currentFolder.notes.length === 0 ? (
                    <p className="text-[11px] text-destructive font-medium py-0.5">
                      ⚠️ No notes in this folder.
                    </p>
                  ) : (
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {currentFolder.notes.map(note => {
                        const isChecked = selectedNoteIds.has(note.id);
                        return (
                          <div
                            key={note.id}
                            onClick={() => toggleNoteSelection(note.id)}
                            className={`flex items-center justify-between p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                              isChecked
                                ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                                : 'border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              {isChecked ? (
                                <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate">{note.title}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground shrink-0 px-1.5 py-0.5 rounded bg-secondary">
                              {note.categoryName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Card count selector */}
              {currentFolder && currentFolder.notes.length > 0 && (
                <div className="flex items-center gap-3 relative z-10">
                  <span className="text-[11px] font-semibold text-foreground">Cards to generate:</span>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGenCardCount(n)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                          genCardCount === n
                            ? 'bg-primary/80 text-primary-foreground font-bold border border-primary/80'
                            : 'bg-secondary/70 border border-border/80 text-foreground/90 font-medium hover:bg-secondary'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate button */}
              <div className="flex gap-2 pt-1 relative z-10">
                <button
                  onClick={handleGenerateFromNotes}
                  disabled={!currentFolder || selectedNoteIds.size === 0}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate Flashcards
                </button>
                <button
                  onClick={() => { setShowGeneratePanel(false); setSelectedFolderId(null); setSelectedNoteIds(new Set()); }}
                  className="px-4 h-10 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generating loading screen */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="mb-5 rounded-2xl border border-border bg-card p-8 text-center shadow-xl"
          >
            <div className="relative w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <Brain className="h-5 w-5 text-primary animate-pulse" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={generateStep}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold mb-2">
                  Step {generateStep + 1} of {GENERATE_STEPS.length}
                </span>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {GENERATE_STEPS[generateStep]}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Generating {genCardCount} cards from {currentFolder?.name || 'your notes'}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="w-48 h-1.5 bg-secondary rounded-full mx-auto mt-5 overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: '15%' }}
                animate={{ width: `${Math.min(95, ((generateStep + 1) / GENERATE_STEPS.length) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <p className="text-[14px] font-medium text-foreground mb-1">No flashcards yet</p>
          <p className="text-[12px] text-muted-foreground">Add cards manually or generate them from your notes.</p>
        </div>
      ) : (
        <>
          {/* Counter */}
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-3">
            <span>Card {currentIdx + 1} / {queue.length}</span>
          </div>

          {/* Outer Slide Animation Container for Next / Previous Card Navigation */}
          <div className="perspective-1000 mb-5 relative overflow-hidden">
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={currentCard?.id}
                custom={slideDirection}
                variants={{
                  enter: (dir: number) => ({
                    x: dir > 0 ? 80 : -80,
                    opacity: 0,
                    scale: 0.96,
                  }),
                  center: {
                    x: 0,
                    opacity: 1,
                    scale: 1,
                  },
                  exit: (dir: number) => ({
                    x: dir > 0 ? -80 : 80,
                    opacity: 0,
                    scale: 0.96,
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {/* Inner 3D Card Flip Animation for Question vs Answer */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentCard?.id}-${flipped ? 'ans' : 'quest'}`}
                    initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    onClick={() => setFlipped(f => !f)}
                    className="min-h-[260px] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden border border-border bg-secondary shadow-2xl cursor-pointer"
                  >
                    <span className="absolute left-0 top-0 h-px w-16 bg-[hsl(var(--foreground))]" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
                      {flipped ? 'Answer' : 'Question — click to reveal'}
                    </span>
                    <p className="text-lg text-center font-medium leading-relaxed text-foreground max-w-lg">
                      {flipped ? currentCard?.answer : currentCard?.question}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground mt-5 flex items-center gap-1">
                      <RotateCw className="h-3 w-3" /> {flipped ? 'Click to show question' : 'Click to flip'}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>


          {/* Nav controls */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handlePrevCard}
              disabled={currentIdx === 0}
              className="h-9 w-9 rounded-xl border border-border bg-secondary hover:bg-secondary flex items-center justify-center text-foreground transition-colors disabled:opacity-30"
              title="Previous Card"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleShuffle}
              className="h-9 px-3.5 rounded-xl border border-border bg-secondary hover:bg-secondary flex items-center gap-1.5 text-[12px] font-mono text-foreground transition-colors"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </button>
            <button
              onClick={handleNextCard}
              disabled={currentIdx >= queue.length - 1}
              className="h-9 px-4 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-30"
            >
              Next
            </button>
            <button
              onClick={handleDelete}
              disabled={queue.length === 0}
              className="h-9 w-9 rounded-xl border border-border bg-secondary hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-30"
              title="Delete Card"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-5 flex-wrap max-w-md mx-auto">
            {queue.slice(0, 30).map((c, i) => (
              <button
                key={c.id}
                onClick={() => handleJumpToCard(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIdx ? 'bg-[hsl(var(--foreground))] w-4'
                  : 'bg-secondary w-1.5 hover:bg-muted-foreground/40'
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
