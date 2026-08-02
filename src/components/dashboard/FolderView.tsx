import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderOpen, Plus, Trash2, Edit3, Save, X,
  FileText, ArrowLeft, Search, ChevronRight, BookOpen,
  ClipboardList, Layers, Tag, MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';

/* ─── types ─── */
type CategoryType = 'unit' | 'assignment' | 'project' | 'custom';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  name: string;           // e.g. "Unit 1", "Assignment 3", custom
  type: CategoryType;
  notes: Note[];
}

interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  categories: Category[];
}

/* ─── constants ─── */
const FOLDER_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
];

const CATEGORY_PRESETS: { type: CategoryType; label: string; icon: any; color: string }[] = [
  { type: 'unit',       label: 'Unit',       icon: BookOpen,      color: '#6366f1' },
  { type: 'assignment', label: 'Assignment', icon: ClipboardList, color: '#f59e0b' },
  { type: 'project',    label: 'Project',    icon: Layers,        color: '#10b981' },
  { type: 'custom',     label: 'Custom',     icon: Tag,           color: '#ec4899' },
];

function catMeta(type: CategoryType) {
  return CATEGORY_PRESETS.find(p => p.type === type) ?? CATEGORY_PRESETS[3];
}

/* ─── helpers ─── */
function uid() { return crypto.randomUUID(); }

/* ══════════════════════════════════════════════════════════════
   NOTE READER
══════════════════════════════════════════════════════════════ */
interface NoteReaderProps {
  note: Note;
  folderColor: string;
  breadcrumb: string;
  onBack: () => void;
  onEdit: (n: Note) => void;
  onDelete: (id: string) => void;
}
function NoteReader({ note, folderColor, breadcrumb, onBack, onEdit, onDelete }: NoteReaderProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <p className="text-[10px] font-mono text-[hsl(40_8%_40%)] mb-3">{breadcrumb}</p>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-[hsl(40_8%_52%)] hover:text-[hsl(40_20%_75%)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{note.title}</h2>
          <p className="text-[10px] text-[hsl(40_8%_42%)]">{format(note.updatedAt, 'MMM d, yyyy · h:mm a')}</p>
        </div>
        <button onClick={() => onEdit(note)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_13%)] text-[12px] hover:bg-[hsl(220_8%_17%)] transition-colors"
        >
          <Edit3 className="h-3.5 w-3.5" /> Edit
        </button>
        <button onClick={() => onDelete(note.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/20 bg-red-400/5 text-red-400 text-[12px] hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)] p-6 min-h-[300px]">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[hsl(40_20%_82%)]">
          {note.content || <span className="text-[hsl(40_8%_38%)] italic">No content.</span>}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTE FORM (inline)
══════════════════════════════════════════════════════════════ */
interface NoteFormProps {
  editingId: string | null;
  title: string; setTitle: (v: string) => void;
  content: string; setContent: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}
function NoteForm({ editingId, title, setTitle, content, setContent, onSave, onCancel }: NoteFormProps) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4"
    >
      <div className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_10%)] p-4 space-y-3">
        <h3 className="text-[12px] font-semibold flex items-center gap-2 text-[hsl(40_20%_82%)]">
          {editingId ? <Edit3 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editingId ? 'Edit Note' : 'New Note'}
        </h3>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Note title…"
          className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
        />
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Write your note here…"
          rows={6}
          className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none resize-none focus:border-[hsl(220_8%_32%)] transition-colors"
        />
        <div className="flex gap-2">
          <button onClick={onSave} disabled={!title.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" /> {editingId ? 'Update' : 'Save'}
          </button>
          <button onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function FolderView() {
  /* ── navigation state ── */
  const [view, setView] = useState<'folders' | 'categories' | 'notes' | 'reader'>('folders');
  const [activeFolder,   setActiveFolder]   = useState<FolderItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeNote,     setActiveNote]     = useState<Note | null>(null);

  /* ── data ── */
  const [folders, setFolders] = useState<FolderItem[]>([]);

  /* ── folder form ── */
  const [showFolderForm,  setShowFolderForm]  = useState(false);
  const [folderName,      setFolderName]      = useState('');
  const [folderColor,     setFolderColor]     = useState(FOLDER_COLORS[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  /* ── category form ── */
  const [showCatForm,    setShowCatForm]    = useState(false);
  const [catType,        setCatType]        = useState<CategoryType>('unit');
  const [catName,        setCatName]        = useState('');
  const [editingCatId,   setEditingCatId]   = useState<string | null>(null);

  /* ── note form ── */
  const [showNoteForm,   setShowNoteForm]   = useState(false);
  const [noteTitle,      setNoteTitle]      = useState('');
  const [noteContent,    setNoteContent]    = useState('');
  const [editingNoteId,  setEditingNoteId]  = useState<string | null>(null);

  /* ── search ── */
  const [search, setSearch] = useState('');

  /* ═══ helpers: sync active refs into folders array ═══════════ */
  function syncFolder(updated: FolderItem) {
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
    setActiveFolder(updated);
  }
  function syncCategory(updatedCat: Category) {
    if (!activeFolder) return;
    const updatedFolder = {
      ...activeFolder,
      categories: activeFolder.categories.map(c => c.id === updatedCat.id ? updatedCat : c),
    };
    syncFolder(updatedFolder);
    setActiveCategory(updatedCat);
  }

  /* ═══ FOLDER ACTIONS ══════════════════════════════════════════ */
  function saveFolder() {
    if (!folderName.trim()) return;
    if (editingFolderId) {
      const updated = folders.find(f => f.id === editingFolderId)!;
      const upd = { ...updated, name: folderName, color: folderColor };
      setFolders(prev => prev.map(f => f.id === editingFolderId ? upd : f));
      if (activeFolder?.id === editingFolderId) setActiveFolder(upd);
    } else {
      setFolders(prev => [{ id: uid(), name: folderName, color: folderColor, createdAt: new Date(), categories: [] }, ...prev]);
    }
    cancelFolderForm();
  }
  function editFolder(f: FolderItem) {
    setFolderName(f.name); setFolderColor(f.color); setEditingFolderId(f.id); setShowFolderForm(true);
  }
  function deleteFolder(id: string) {
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolder?.id === id) { setActiveFolder(null); setView('folders'); }
  }
  function cancelFolderForm() {
    setShowFolderForm(false); setFolderName(''); setFolderColor(FOLDER_COLORS[0]); setEditingFolderId(null);
  }
  function openFolder(f: FolderItem) { setActiveFolder(f); setActiveCategory(null); setView('categories'); }

  /* ═══ CATEGORY ACTIONS ════════════════════════════════════════ */
  function saveCategory() {
    if (!catName.trim() || !activeFolder) return;
    if (editingCatId) {
      const updatedCats = activeFolder.categories.map(c =>
        c.id === editingCatId ? { ...c, name: catName, type: catType } : c
      );
      const upd = { ...activeFolder, categories: updatedCats };
      syncFolder(upd);
      if (activeCategory?.id === editingCatId) setActiveCategory({ ...activeCategory, name: catName, type: catType });
    } else {
      const newCat: Category = { id: uid(), name: catName, type: catType, notes: [] };
      const upd = { ...activeFolder, categories: [newCat, ...activeFolder.categories] };
      syncFolder(upd);
    }
    cancelCatForm();
  }
  function editCategory(c: Category) {
    setCatName(c.name); setCatType(c.type); setEditingCatId(c.id); setShowCatForm(true);
  }
  function deleteCategory(id: string) {
    if (!activeFolder) return;
    const upd = { ...activeFolder, categories: activeFolder.categories.filter(c => c.id !== id) };
    syncFolder(upd);
    if (activeCategory?.id === id) { setActiveCategory(null); setView('categories'); }
  }
  function cancelCatForm() {
    setShowCatForm(false); setCatName(''); setCatType('unit'); setEditingCatId(null);
  }
  function openCategory(c: Category) { setActiveCategory(c); setView('notes'); }

  /* ═══ NOTE ACTIONS ════════════════════════════════════════════ */
  function saveNote() {
    if (!noteTitle.trim() || !activeFolder || !activeCategory) return;
    const now = new Date();
    let updatedNotes: Note[];
    if (editingNoteId) {
      updatedNotes = activeCategory.notes.map(n =>
        n.id === editingNoteId ? { ...n, title: noteTitle, content: noteContent, updatedAt: now } : n
      );
      if (activeNote?.id === editingNoteId) setActiveNote({ ...activeNote, title: noteTitle, content: noteContent, updatedAt: now });
    } else {
      updatedNotes = [{ id: uid(), title: noteTitle, content: noteContent, createdAt: now, updatedAt: now }, ...activeCategory.notes];
    }
    syncCategory({ ...activeCategory, notes: updatedNotes });
    cancelNoteForm();
  }
  function editNote(n: Note) {
    setNoteTitle(n.title); setNoteContent(n.content); setEditingNoteId(n.id);
    setActiveNote(null); setView('notes'); setShowNoteForm(true);
  }
  function deleteNote(id: string) {
    if (!activeCategory) return;
    const updatedNotes = activeCategory.notes.filter(n => n.id !== id);
    syncCategory({ ...activeCategory, notes: updatedNotes });
    if (activeNote?.id === id) { setActiveNote(null); setView('notes'); }
  }
  function cancelNoteForm() {
    setShowNoteForm(false); setNoteTitle(''); setNoteContent(''); setEditingNoteId(null);
  }
  function openNote(n: Note) { setActiveNote(n); setView('reader'); }

  /* ═══ DERIVED ═════════════════════════════════════════════════ */
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const totalNotes = (f: FolderItem) => f.categories.reduce((a, c) => a + c.notes.length, 0);

  /* ═══ NOTE READER VIEW ════════════════════════════════════════ */
  if (view === 'reader' && activeNote && activeFolder && activeCategory) {
    return (
      <NoteReader
        note={activeNote}
        folderColor={activeFolder.color}
        breadcrumb={`${activeFolder.name} / ${activeCategory.name}`}
        onBack={() => setView('notes')}
        onEdit={editNote}
        onDelete={id => { deleteNote(id); setView('notes'); }}
      />
    );
  }

  /* ═══ NOTES VIEW ══════════════════════════════════════════════ */
  if (view === 'notes' && activeFolder && activeCategory) {
    const meta = catMeta(activeCategory.type);
    return (
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb nav */}
        <div className="flex items-center gap-1.5 text-[11px] text-[hsl(40_8%_42%)] mb-4 font-mono flex-wrap">
          <button onClick={() => setView('folders')} className="hover:text-[hsl(40_20%_70%)] transition-colors">Folders</button>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <button onClick={() => setView('categories')} className="hover:text-[hsl(40_20%_70%)] transition-colors" style={{ color: activeFolder.color }}>{activeFolder.name}</button>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="text-[hsl(40_8%_52%)]">{activeCategory.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[hsl(220_8%_16%)] border border-[hsl(220_8%_22%)]">
              <meta.icon className="h-4 w-4 text-[hsl(40_20%_65%)]" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold leading-none">{activeCategory.name}</h2>
              <p className="text-[10px] text-[hsl(40_8%_42%)] mt-0.5">{activeCategory.notes.length} note{activeCategory.notes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => { cancelNoteForm(); setShowNoteForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[12px] font-medium hover:bg-[hsl(220_8%_17%)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Note
          </button>
        </div>

        {/* Note form */}
        <AnimatePresence>
          {showNoteForm && (
            <NoteForm editingId={editingNoteId}
              title={noteTitle} setTitle={setNoteTitle}
              content={noteContent} setContent={setNoteContent}
              onSave={saveNote} onCancel={cancelNoteForm}
            />
          )}
        </AnimatePresence>

        {/* Notes grid */}
        {activeCategory.notes.length === 0 && !showNoteForm ? (
          <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-12 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-[hsl(40_8%_30%)]" />
            <p className="text-[13px] text-[hsl(40_8%_40%)]">No notes yet. Create your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeCategory.notes.map((note, i) => (
              <motion.div key={note.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group rounded-xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] p-4 hover:border-[hsl(220_8%_26%)] transition-all cursor-pointer"
                onClick={() => openNote(note)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-[hsl(40_8%_45%)] shrink-0" />
                    <h3 className="font-medium text-[13px] truncate text-[hsl(40_20%_84%)]">{note.title}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={e => { e.stopPropagation(); editNote(note); }}
                      className="h-6 w-6 rounded flex items-center justify-center hover:bg-[hsl(220_8%_18%)] text-[hsl(40_8%_50%)] hover:text-[hsl(40_20%_75%)] transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                      className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-400/10 text-[hsl(40_8%_50%)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[hsl(40_8%_44%)] line-clamp-2 mb-3">
                  {note.content || <span className="italic">Empty note</span>}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[hsl(40_8%_38%)]">
                  <span>{format(note.updatedAt, 'MMM d, yyyy')}</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ═══ CATEGORIES VIEW ═════════════════════════════════════════ */
  if (view === 'categories' && activeFolder) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-[hsl(40_8%_42%)] mb-4 font-mono">
          <button onClick={() => setView('folders')} className="hover:text-[hsl(40_20%_70%)] transition-colors">Folders</button>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span style={{ color: activeFolder.color }}>{activeFolder.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)]">
              <FolderOpen className="h-4 w-4" style={{ color: activeFolder.color }} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold leading-none">{activeFolder.name}</h2>
              <p className="text-[10px] text-[hsl(40_8%_42%)] mt-0.5">
                {activeFolder.categories.length} section{activeFolder.categories.length !== 1 ? 's' : ''} · {totalNotes(activeFolder)} note{totalNotes(activeFolder) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={() => { cancelCatForm(); setShowCatForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[12px] font-medium hover:bg-[hsl(220_8%_17%)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Section
          </button>
        </div>

        {/* Category form */}
        <AnimatePresence>
          {showCatForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4"
            >
              <div className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_10%)] p-4 space-y-3">
                <h3 className="text-[12px] font-semibold text-[hsl(40_20%_82%)] flex items-center gap-2">
                  {editingCatId ? <Edit3 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {editingCatId ? 'Edit Section' : 'New Section'}
                </h3>
                {/* Type selector */}
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_PRESETS.map(p => (
                    <button key={p.type} onClick={() => setCatType(p.type)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-medium transition-all ${
                        catType === p.type
                          ? 'bg-[hsl(220_8%_20%)] border-[hsl(220_8%_32%)] text-[hsl(40_20%_85%)]'
                          : 'bg-[hsl(220_8%_13%)] border-[hsl(220_8%_20%)] text-[hsl(40_8%_50%)] hover:bg-[hsl(220_8%_17%)] hover:text-[hsl(40_20%_72%)]'
                      }`}
                    >
                      <p.icon className={`h-4 w-4 ${catType === p.type ? 'text-[hsl(40_20%_75%)]' : 'text-[hsl(40_8%_45%)]'}`} />
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Name */}
                <input value={catName} onChange={e => setCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveCategory()}
                  placeholder={catType === 'custom' ? 'Section name…' : `e.g. ${catType === 'unit' ? 'Unit 1 — Algebra' : catType === 'assignment' ? 'Assignment 3' : 'Final Project'}`}
                  className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_35%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
                />
                <div className="flex gap-2">
                  <button onClick={saveCategory} disabled={!catName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="h-3.5 w-3.5" /> {editingCatId ? 'Update' : 'Create'}
                  </button>
                  <button onClick={cancelCatForm}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories list */}
        {activeFolder.categories.length === 0 && !showCatForm ? (
          <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-12 text-center">
            <Layers className="h-10 w-10 mx-auto mb-3 text-[hsl(40_8%_30%)]" />
            <p className="text-[13px] text-[hsl(40_8%_40%)]">No sections yet. Add a Unit, Assignment, Project or custom section.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeFolder.categories.map((cat, i) => {
              const meta = catMeta(cat.type);
              return (
                <motion.div key={cat.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] hover:border-[hsl(220_8%_26%)] hover:bg-[hsl(220_8%_12%)] cursor-pointer transition-all"
                  onClick={() => openCategory(cat)}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[hsl(220_8%_16%)] border border-[hsl(220_8%_22%)]">
                    <meta.icon className="h-4.5 w-4.5 text-[hsl(40_20%_65%)]" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[hsl(40_20%_86%)] truncate">{cat.name}</p>
                    <p className="text-[10px] text-[hsl(40_8%_42%)]">
                      <span className="font-medium text-[hsl(40_8%_52%)]">{meta.label}</span>
                      <span className="mx-1 opacity-40">·</span>
                      {cat.notes.length} note{cat.notes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); editCategory(cat); }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_14%)] hover:bg-[hsl(220_8%_19%)] text-[hsl(40_8%_50%)] hover:text-[hsl(40_20%_75%)] transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 text-red-400/60 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[hsl(40_8%_38%)] shrink-0" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ═══ FOLDERS LIST VIEW ═══════════════════════════════════════ */
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2.5">
          <Folder className="h-6 w-6 text-primary" />
          Folders
        </h2>
        <button onClick={() => { cancelFolderForm(); setShowFolderForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[12px] font-medium hover:bg-[hsl(220_8%_17%)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Folder
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(40_8%_40%)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search folders…"
          className="w-full bg-[hsl(220_8%_12%)] border border-[hsl(220_8%_20%)] rounded-xl pl-9 pr-3 py-2 text-[13px] text-[hsl(40_20%_82%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_28%)] transition-colors"
        />
      </div>

      {/* Folder form */}
      <AnimatePresence>
        {showFolderForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4"
          >
            <div className="rounded-2xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_10%)] p-4 space-y-3">
              <h3 className="text-[12px] font-semibold text-[hsl(40_20%_82%)] flex items-center gap-2">
                <Folder className="h-3.5 w-3.5" />
                {editingFolderId ? 'Rename Folder' : 'New Folder'}
              </h3>
              <input value={folderName} onChange={e => setFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveFolder()}
                placeholder="Folder name…"
                className="w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors"
              />
              <div>
                <p className="text-[10px] text-[hsl(40_8%_44%)] mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map(c => (
                    <button key={c} onClick={() => setFolderColor(c)}
                      className={`w-7 h-7 rounded-lg transition-all ${folderColor === c ? 'ring-2 ring-offset-2 ring-offset-[hsl(220_8%_10%)] scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c, outlineColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveFolder} disabled={!folderName.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="h-3.5 w-3.5" /> {editingFolderId ? 'Save' : 'Create'}
                </button>
                <button onClick={cancelFolderForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220_8%_22%)] text-[12px] text-[hsl(40_8%_52%)] hover:bg-[hsl(220_8%_14%)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folders grid */}
      {filteredFolders.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_9%)] p-14 text-center">
          <Folder className="h-12 w-12 mx-auto mb-4 text-[hsl(40_8%_28%)]" />
          <p className="text-[13px] text-[hsl(40_8%_40%)]">
            {search ? 'No folders match your search.' : 'No folders yet. Create one to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredFolders.map((folder, i) => (
            <motion.div key={folder.id}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className="group relative rounded-2xl border border-[hsl(220_8%_16%)] bg-[hsl(220_8%_10%)] p-4 hover:border-[hsl(220_8%_26%)] hover:bg-[hsl(220_8%_12%)] cursor-pointer transition-all"
              onClick={() => openFolder(folder)}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 bg-[hsl(220_8%_14%)] border border-[hsl(220_8%_20%)]">
                <Folder className="h-5.5 w-5.5" style={{ color: folder.color, width: 22, height: 22 }} />
              </div>
              <h3 className="font-semibold text-[13px] text-[hsl(40_20%_84%)] truncate mb-1">{folder.name}</h3>
              <p className="text-[10px] text-[hsl(40_8%_42%)]">
                {folder.categories.length} section{folder.categories.length !== 1 ? 's' : ''}
                <span className="mx-1 opacity-40">·</span>
                {totalNotes(folder)} note{totalNotes(folder) !== 1 ? 's' : ''}
              </p>

              {/* Section type badges */}
              {folder.categories.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[...new Set(folder.categories.map(c => c.type))].slice(0, 3).map(type => {
                    const m = catMeta(type);
                    return (
                      <span key={type} className="text-[9px] px-1.5 py-0.5 rounded-md font-medium bg-[hsl(220_8%_16%)] text-[hsl(40_8%_55%)]"
                      >{m.label}</span>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); editFolder(folder); }}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_14%)] hover:bg-[hsl(220_8%_20%)] text-[hsl(40_8%_50%)] hover:text-[hsl(40_20%_72%)] transition-all"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 text-red-400/50 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
