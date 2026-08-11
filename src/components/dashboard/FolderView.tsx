
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, Plus, Trash2, Edit3, Save, X,
  FileText, Search, ChevronRight, ArrowLeft,
  LayoutGrid, List, Network,
  ArrowDownAZ, Check, ChevronDown,
  Sparkles, Upload, Download, Loader2, Copy, Archive, ArchiveRestore,
  HardDrive, Square,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import FolderGraphView from './FolderGraphView';
import NoteEditor from './NoteEditor';
import { htmlToPlainText } from './note-utils';
import { useAuth } from '@/lib/auth';
import { createConversation, getStreamingToken } from '@/services/chat.service';
import { fetchSources, triggerProcessSource, uploadSourceFile } from '@/services/sources.service';

/* ─── types ─── */
type CategoryType = 'unit' | 'assignment' | 'project' | 'custom';
type FolderListMode = 'grid' | 'list' | 'graph';
type FolderSort = 'newest' | 'modified' | 'oldest' | 'name' | 'notes';
type NoteSort = 'updated' | 'created' | 'title';
type StoredFolder = Omit<FolderItem, 'createdAt' | 'updatedAt' | 'categories'> & { createdAt: string; updatedAt?: string; categories: StoredCategory[] };
type StoredCategory = Omit<Category, 'notes'> & { notes: StoredNote[] };
type StoredNote = Omit<Note, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };

interface Note {
  id: string;
  title: string;
  content: string; // stored as HTML from Lexical
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  notes: Note[];
}

interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt?: Date;
  categories: Category[];
  archived?: boolean;
}

/* ─── constants ─── */
const FOLDER_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
];

function uid() { return crypto.randomUUID(); }

function createFolderGraphDemo(count = 20, offset = 0): FolderItem[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const number = index + offset + 1;
    const folderId = `demo-folder-${number}`;
    const createdAt = new Date(now - index * 86_400_000);
    return {
      id: folderId,
      name: `Study Folder ${String(number).padStart(2, '0')}`,
      color: FOLDER_COLORS[index % FOLDER_COLORS.length],
      createdAt,
      updatedAt: createdAt,
      categories: [
        {
          id: `${folderId}-concepts`,
          name: 'Core Concepts',
          type: 'unit',
          notes: [{
            id: `${folderId}-concept-note`,
            title: `Key ideas ${number}`,
            content: `<p>Reference notes for Study Folder ${number}.</p>`,
            createdAt,
            updatedAt: createdAt,
          }],
        },
        {
          id: `${folderId}-practice`,
          name: 'Practice',
          type: 'assignment',
          notes: [{
            id: `${folderId}-practice-note`,
            title: `Practice set ${number}`,
            content: '<p>Questions and worked examples to review.</p>',
            createdAt,
            updatedAt: createdAt,
          }],
        },
      ],
    };
  });
}

function folderNotes(folder: FolderItem): Note[] {
  return (folder.categories ?? []).flatMap(category => category.notes ?? []);
}

function notesCategory(folder: FolderItem): Category {
  return { id: `${folder.id}-notes`, name: 'Notes', type: 'custom', notes: folderNotes(folder) };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function textToHtml(value: string): string {
  return value.split(/\n{2,}/).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`).join('');
}

function FolderCheckbox({ checked, label, onToggle, className = '' }: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={event => { event.stopPropagation(); onToggle(); }}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary/80 text-transparent hover:border-primary/60 hover:bg-secondary'} ${className}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTE FORM — uses Lexical editor
══════════════════════════════════════════════════════════════ */
function NoteForm({ editingId, title, setTitle, content, setContent, onSave, onCancel, onHelpWrite, onDelete, onUploadDocument }: {
  editingId: string | null;
  title: string; setTitle: (v: string) => void;
  content: string; setContent: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  onHelpWrite?: (prompt: string) => Promise<string>;
  onDelete?: () => void;
  onUploadDocument?: (file: File) => Promise<string>;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPrompt, setHelpPrompt] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleHelpWrite() {
    if (!helpPrompt.trim() || !onHelpWrite) return;
    setHelpLoading(true);
    setActionError('');
    try {
      const generated = await onHelpWrite(helpPrompt.trim());
      setContent(`${content}${content ? '<p><br /></p>' : ''}${textToHtml(generated)}`);
      setEditorRevision(value => value + 1);
      setHelpPrompt('');
      setHelpOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Gemini writing help is unavailable.');
    } finally {
      setHelpLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setActionError('');
    try {
      const isPlainText = /\.(txt|md|html?|csv)$/i.test(file.name);
      const imported = isPlainText || !onUploadDocument ? await file.text() : await onUploadDocument(file);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
      const importedHtml = /\.html?$/i.test(file.name) && isPlainText ? imported : textToHtml(imported.slice(0, 100_000));
      setContent(importedHtml);
      setEditorRevision(value => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not import that document.');
    } finally {
      setUploading(false);
    }
  }

  function downloadWordDocument() {
    const htmlDocument = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || 'NoteZ note')}</title></head><body>${content || '<p></p>'}</body></html>`;
    const blob = new Blob([htmlDocument], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.trim() || 'NoteZ note'}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyNote() {
    const plainText = htmlToPlainText(content);
    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([content], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard?.writeText(plainText);
      }
      setCopyMessage('Copied');
      window.setTimeout(() => setCopyMessage(''), 1800);
    } catch {
      setActionError('Copy was blocked by the browser.');
    }
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} className="min-h-full w-full overflow-visible"
    >
      <div className="flex min-h-screen w-full flex-col gap-3 bg-background p-4 md:p-6">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Note title…"
          className="w-full bg-background/30 border border-border rounded-xl px-3 py-2.5 text-[14px] font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
        {/* Lexical rich-text editor */}
        <NoteEditor
          key={`${editingId ?? 'new'}-${editorRevision}`}
          initialHtml={content}
          onChange={setContent}
          autoFocus={!editingId}
          minHeight={Math.max(420, (typeof window !== 'undefined' ? window.innerHeight : 720) - 250)}
        />
        {helpOpen && <div className="rounded-xl border border-border bg-background/30 p-3 space-y-2">
          <div className="flex items-center justify-between text-[12px] font-medium text-foreground"><span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Draft with AI</span><button type="button" onClick={() => setHelpOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div>
          <div className="flex gap-2">
            <input value={helpPrompt} onChange={e => setHelpPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHelpWrite()} placeholder="Draft, expand, or rephrase this note…" className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground" autoFocus />
            <button type="button" onClick={handleHelpWrite} disabled={helpLoading || !helpPrompt.trim()} className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-40">{helpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Draft'}</button>
          </div>
          {actionError && <p className="text-[11px] text-destructive">{actionError}</p>}
        </div>}
        {actionError && !helpOpen && <p className="text-[11px] text-destructive">{actionError}</p>}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:-mb-6 md:px-6">
          <span className="mr-auto font-mono text-[10px] text-muted-foreground">Words: {htmlToPlainText(content).trim() ? htmlToPlainText(content).trim().split(/\s+/).length : 0} · Characters: {htmlToPlainText(content).length}</span>
          <span className="hidden text-[10px] font-mono text-muted-foreground lg:inline">⌘/Ctrl + S to save</span>
          <button type="button" onClick={() => { setActionError(''); setHelpOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary"><Sparkles className="h-3.5 w-3.5 text-primary" /> Draft with AI</button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary disabled:opacity-50">{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import document</button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.html,.csv,.doc,.docx,.pdf" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void handleUpload(file); e.currentTarget.value = ''; }} />
          <button type="button" onClick={downloadWordDocument} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary"><Download className="h-3.5 w-3.5" /> Download</button>
          <button type="button" onClick={() => void copyNote()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary"><Copy className="h-3.5 w-3.5" /> {copyMessage || 'Copy'}</button>
          {editingId && onDelete && <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
          <button onClick={onSave} disabled={!title.trim()} className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-semibold text-[hsl(var(--accent-foreground))] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> {editingId ? 'Update' : 'Save'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary">
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
export default function FolderView({ initialFolderId, initialScope = 'active', onFolderOpen, onFolderList }: {
  initialFolderId?: string;
  initialScope?: 'active' | 'archived';
  onFolderOpen?: () => void;
  onFolderList?: () => void;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<'folders' | 'notes'>('folders');
  const [folderScope, setFolderScope] = useState<'active' | 'archived'>(initialScope);
  const [activeFolder,   setActiveFolder]   = useState<FolderItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeNote,     setActiveNote]     = useState<Note | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  /* ── folder list display mode: grid | list | graph ── */
  const [listMode, setListMode] = useState<FolderListMode>('list');

  /* ── data ── */
  const [folders, setFoldersRaw] = useState<FolderItem[]>(() => {
    try {
      const raw = localStorage.getItem('notez_folders');
      if (!raw) return import.meta.env.DEV ? createFolderGraphDemo() : [];
      const stored = JSON.parse(raw) as StoredFolder[];
      return stored.map(f => ({
        ...f, createdAt: new Date(f.createdAt), updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(f.createdAt),
        categories: (f.categories ?? []).map(c => ({
          ...c, notes: (c.notes ?? []).map(n => ({
            ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt),
          })),
        })),
      }));
    } catch { return []; }
  });

  useEffect(() => {
    if (!initialFolderId) return;
    const folder = folders.find(item => item.id === initialFolderId);
    if (folder) {
      setActiveFolder(folder);
      setActiveCategory(notesCategory(folder));
      setView('notes');
      onFolderOpen?.();
    }
  }, [initialFolderId, folders, onFolderOpen]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const demoFolders = folders.length < 20
      ? createFolderGraphDemo(20 - folders.length, folders.length)
      : [];
    const nextFolders = demoFolders.length > 0 ? [...folders, ...demoFolders] : folders;

    try {
      localStorage.setItem('notez_folders', JSON.stringify(nextFolders));
      window.dispatchEvent(new Event('notez:folders-updated'));
    } catch (error) { void error; }

    if (demoFolders.length > 0) setFoldersRaw(nextFolders);
  }, [folders]);

  function setFolders(updater: FolderItem[] | ((prev: FolderItem[]) => FolderItem[])) {
    setFoldersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('notez_folders', JSON.stringify(next));
        window.dispatchEvent(new Event('notez:folders-updated'));
      } catch (error) { void error; }
      return next;
    });
  }

  /* ── forms state ── */
  const [showFolderForm,  setShowFolderForm]  = useState(false);
  const [folderName,      setFolderName]      = useState('');
  const [folderColor,     setFolderColor]     = useState(FOLDER_COLORS[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showNoteForm,   setShowNoteForm]   = useState(false);
  const [noteTitle,      setNoteTitle]      = useState('');
  const [noteContent,    setNoteContent]    = useState('');
  const [editingNoteId,  setEditingNoteId]  = useState<string | null>(null);
  const [search,         setSearch]         = useState('');
  const [noteSearch,     setNoteSearch]     = useState('');
  const [sortBy,         setSortBy]         = useState<FolderSort>('newest');
  const [sortOpen,       setSortOpen]       = useState(false);
  const [noteSort,       setNoteSort]       = useState<NoteSort>('updated');
  const [noteSortOpen,   setNoteSortOpen]   = useState(false);
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const noteSortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFolderScope(initialScope);
    setView('folders');
    setActiveFolder(null);
    setActiveCategory(null);
    setActiveNote(null);
    setShowNoteForm(false);
    setSelectedFolderIds(new Set());
    setSelectMode(false);
  }, [initialScope]);

  useEffect(() => {
    if (showFolderForm || editingFolderId) {
      requestAnimationFrame(() => {
        folderNameInputRef.current?.focus();
        folderNameInputRef.current?.select();
      });
    }
  }, [showFolderForm, editingFolderId]);

  useEffect(() => {
    if (!sortOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [sortOpen]);

  useEffect(() => {
    if (!noteSortOpen) return;
    const close = (event: MouseEvent) => {
      if (!noteSortMenuRef.current?.contains(event.target as Node)) setNoteSortOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [noteSortOpen]);

  /* ── palette: "New Folder" from ⌘K ── */
  useEffect(() => {
    const handler = () => { setView('folders'); cancelFolderForm(); setShowFolderForm(true); };
    window.addEventListener('notez:new-folder', handler);
    return () => window.removeEventListener('notez:new-folder', handler);
  }, []);

  /* ── sync helpers ── */
  function syncFolder(updated: FolderItem) {
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
    setActiveFolder(updated);
  }
  function syncCategory(updatedCat: Category) {
    if (!activeFolder) return;
    const upd = { ...activeFolder, updatedAt: new Date(), categories: [{ ...updatedCat, id: `${activeFolder.id}-notes`, name: 'Notes', type: 'custom' as CategoryType }] };
    syncFolder(upd); setActiveCategory(updatedCat);
  }

  /* ── folder actions ── */
  function saveFolder() {
    if (!folderName.trim()) return;
    if (editingFolderId) {
      const upd = { ...folders.find(f => f.id === editingFolderId)!, name: folderName, color: folderColor, updatedAt: new Date() };
      setFolders(prev => prev.map(f => f.id === editingFolderId ? upd : f));
      if (activeFolder?.id === editingFolderId) setActiveFolder(upd);
    } else {
      const now = new Date();
      setFolders(prev => [{ id: uid(), name: folderName, color: folderColor, createdAt: now, updatedAt: now, categories: [], archived: false }, ...prev]);
    }
    cancelFolderForm();
  }
  function editFolder(f: FolderItem) {
    setFolderName(f.name);
    setFolderColor(f.color);
    setEditingFolderId(f.id);
    // Rename is rendered inside the row/card being edited, not in the
    // library toolbar.
    setShowFolderForm(false);
  }
  function deleteFolder(id: string) {
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolder?.id === id) { setActiveFolder(null); setView('folders'); }
  }
  function cancelFolderForm() { setShowFolderForm(false); setFolderName(''); setFolderColor(FOLDER_COLORS[0]); setEditingFolderId(null); }
  function openFolder(f: FolderItem) {
    // Normalize older/local data before switching into the note workspace. A
    // malformed legacy folder should never take down the whole dashboard.
    const folder = {
      ...f,
      categories: (Array.isArray(f.categories) ? f.categories : []).map(category => ({
        ...category,
        notes: Array.isArray(category.notes) ? category.notes : [],
      })),
    };
    setActiveFolder(folder);
    setActiveCategory(notesCategory(folder));
    setActiveNote(null);
    setShowNoteForm(false);
    setView('notes');
    onFolderOpen?.();
  }

  function restoreFolder(id: string) {
    setFolders(previous => previous.map(folder => folder.id === id ? { ...folder, archived: false, updatedAt: new Date() } : folder));
  }

  function returnToFolderList() {
    setView('folders');
    setActiveFolder(null);
    setActiveCategory(null);
    setActiveNote(null);
    setShowNoteForm(false);
    onFolderList?.();
  }

  function toggleFolderSelection(id: string) {
    setSelectedFolderIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function archiveSelected() {
    if (selectedFolderIds.size === 0) return;
    const archived = folderScope === 'active';
    setFolders(previous => previous.map(folder => selectedFolderIds.has(folder.id) ? { ...folder, archived, updatedAt: new Date() } : folder));
    setSelectedFolderIds(new Set());
    setSelectMode(false);
  }

  function deleteSelected() {
    if (selectedFolderIds.size === 0) return;
    const count = selectedFolderIds.size;
    if (!window.confirm(`Delete ${count} selected folder${count === 1 ? '' : 's'} permanently?`)) return;
    setFolders(previous => previous.filter(folder => !selectedFolderIds.has(folder.id)));
    setSelectedFolderIds(new Set());
    setSelectMode(false);
  }

  /* ── note actions ── */
  function saveNote() {
    if (!noteTitle.trim() || !activeFolder || !activeCategory) return;
    const now = new Date();
    const updatedNotes = editingNoteId
      ? activeCategory.notes.map(n => n.id === editingNoteId ? { ...n, title: noteTitle, content: noteContent, updatedAt: now } : n)
      : [{ id: uid(), title: noteTitle, content: noteContent, createdAt: now, updatedAt: now }, ...activeCategory.notes];
    if (editingNoteId && activeNote?.id === editingNoteId)
      setActiveNote({ ...activeNote, title: noteTitle, content: noteContent, updatedAt: now });
    syncCategory({ ...activeCategory, notes: updatedNotes });
    cancelNoteForm();
  }
  function editNote(n: Note) { setNoteTitle(n.title); setNoteContent(n.content); setEditingNoteId(n.id); setActiveNote(n); setView('notes'); setShowNoteForm(true); }
  function deleteNote(id: string) {
    if (!activeCategory) return;
    syncCategory({ ...activeCategory, notes: activeCategory.notes.filter(n => n.id !== id) });
    if (activeNote?.id === id) { setActiveNote(null); setView('notes'); }
  }
  function cancelNoteForm() { setShowNoteForm(false); setNoteTitle(''); setNoteContent(''); setEditingNoteId(null); }
  function startNewNote() {
    setActiveNote(null);
    cancelNoteForm();
    setShowNoteForm(true);
    setView('notes');
  }

  async function uploadDocument(file: File): Promise<string> {
    if (!user) throw new Error('Please sign in again to upload a document.');
    const source = await uploadSourceFile(user.id, file);
    await triggerProcessSource(source.id);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const sources = await fetchSources();
      const current = sources.find(item => item.id === source.id);
      if (current?.status === 'ready') return current.extracted_text ?? current.summary ?? '';
      if (current?.status === 'failed') throw new Error(current.error || 'The document could not be processed.');
      await new Promise(resolve => window.setTimeout(resolve, 1000));
    }
    throw new Error('Document processing timed out.');
  }

  async function helpWrite(prompt: string): Promise<string> {
    if (!user) throw new Error('Please sign in again to use Gemini writing help.');
    const conversation = await createConversation(user.id, 'tutor', `Note writing · ${prompt.slice(0, 48)}`);
    const token = await getStreamingToken();
    if (!token) throw new Error('Please sign in again to use Gemini writing help.');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        conversationId: conversation.id,
        message: `Help me write content for my note. ${prompt}`,
        mode: 'tutor',
        scope: 'folder',
      }),
    });
    if (!response.ok || !response.body) {
      const detail = await response.text();
      let message = '';
      try {
        const payload = JSON.parse(detail) as { error?: string };
        message = payload.error || '';
      } catch { /* use the status fallback below */ }
      throw new Error(message || `Gemini writing help failed (${response.status}).`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result.replace(/^data:\s?/gm, '').replace(/\n{2,}/g, '\n').trim();
  }

  const totalNotes = (f: FolderItem) => (f.categories ?? []).reduce((a, c) => a + (c.notes ?? []).length, 0);
  const folderModifiedAt = (folder: FolderItem) => (folder.categories ?? []).reduce((latest, category) => (category.notes ?? []).reduce((noteLatest, note) => Math.max(noteLatest, note.updatedAt.getTime()), latest), folder.updatedAt?.getTime() ?? folder.createdAt.getTime());
  const folderSizeBytes = (folder: FolderItem) => (folder.categories ?? []).reduce((total, category) => total + (category.notes ?? []).reduce((noteTotal, note) => noteTotal + new Blob([htmlToPlainText(note.content)]).size, 0), 0);
  const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const visibleFolders = folders.filter(folder => folderScope === 'archived' ? folder.archived === true : folder.archived !== true);
  const filteredFolders = visibleFolders
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime();
      if (sortBy === 'notes') return totalNotes(b) - totalNotes(a) || b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === 'modified') return folderModifiedAt(b) - folderModifiedAt(a);
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  const sortedNotes = activeCategory ? [...activeCategory.notes].sort((a, b) => {
    if (noteSort === 'title') return a.title.localeCompare(b.title);
    if (noteSort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  }) : [];
  const visibleNotes = sortedNotes.filter(note => {
    const query = noteSearch.trim().toLowerCase();
    return !query || `${note.title} ${htmlToPlainText(note.content)}`.toLowerCase().includes(query);
  });

  const allVisibleSelected = filteredFolders.length > 0 && filteredFolders.every(folder => selectedFolderIds.has(folder.id));
  function toggleSelectAll() {
    setSelectedFolderIds(allVisibleSelected ? new Set() : new Set(filteredFolders.map(folder => folder.id)));
  }

  // Archived is intentionally a recovery shelf, not a second folder library.
  // Keep it quiet: show the archived folders and the one action that belongs
  // here, restoring them to the active folder list.
  if (folderScope === 'archived') {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="mb-5">
          <h1 className="font-serif text-xl leading-none tracking-tight">Archived</h1>
          <p className="mt-1 text-[11px] text-muted-foreground">{visibleFolders.length} folder{visibleFolders.length === 1 ? '' : 's'}</p>
        </div>
        {visibleFolders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
            <Archive className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <p className="text-[13px] font-medium text-foreground">Nothing archived</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleFolders.map(folder => (
              <div key={folder.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground" title={folder.name}>{folder.name}</span>
                <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{totalNotes(folder)} note{totalNotes(folder) === 1 ? '' : 's'}</span>
                <button type="button" onClick={() => restoreFolder(folder.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-background">
                  <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────── NOTES WORKSPACE VIEW ────────────────── */
  if (view === 'notes' && activeFolder && activeCategory) {
    return (
      <div className="flex min-h-screen w-full overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-40 shrink-0 flex-col border-r border-border bg-card/80 shadow-[inset_-1px_0_0_hsl(var(--border))] md:flex">
          <div className="space-y-2 border-b border-border p-2.5">
            <button onClick={returnToFolderList} title="Back to folders" className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{activeFolder.name}</span>
            </button>
            <button onClick={startNewNote} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-background transition-colors">
              <Plus className="h-3.5 w-3.5" /> New Note
            </button>
          </div>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={noteSearch} onChange={event => setNoteSearch(event.target.value)} placeholder="Search notes…" className="w-full rounded-lg border border-border bg-background/40 py-2 pl-8 pr-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
              <div ref={noteSortMenuRef} className="relative">
                <button type="button" onClick={() => setNoteSortOpen(open => !open)} aria-label="Sort notes" aria-haspopup="menu" aria-expanded={noteSortOpen} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowDownAZ className="h-3.5 w-3.5" /></button>
                {noteSortOpen && <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[150px] rounded-xl border border-border bg-card p-1.5 shadow-lg">
                  {([['updated', 'Recently updated'], ['created', 'Recently created'], ['title', 'Title A–Z']] as [NoteSort, string][]).map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={noteSort === value} onClick={() => { setNoteSort(value); setNoteSortOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-secondary">{label}{noteSort === value && <Check className="h-3.5 w-3.5 text-primary" />}</button>)}
                </div>}
              </div>
            </div>
            {visibleNotes.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">No matching notes.</p>
            ) : visibleNotes.map(note => (
              <div key={note.id} className={`group mb-0.5 flex items-center gap-1 rounded-lg ${activeNote?.id === note.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}>
                <button onClick={() => editNote(note)} title={note.title} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[12px]">{note.title || 'Untitled note'}</button>
                <button onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`} className="mr-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto p-0">
          {/* Mobile-only top bar for notes workspace */}
          <div className="md:hidden flex items-center gap-2 border-b border-border px-3 py-2 bg-background/95 sticky top-0 z-10">
            <button onClick={returnToFolderList}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[100px]">{activeFolder.name}</span>
            </button>
            <span className="text-muted-foreground mx-1">/</span>
            <span className="text-[11px] text-foreground truncate flex-1">
              {activeNote?.title || 'Notes'}
            </span>
            <button onClick={startNewNote}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-[11px] font-medium text-foreground hover:bg-background shrink-0"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <AnimatePresence>
            {showNoteForm && <NoteForm editingId={editingNoteId} title={noteTitle} setTitle={setNoteTitle} content={noteContent} setContent={setNoteContent} onSave={saveNote} onCancel={cancelNoteForm} onHelpWrite={helpWrite} onUploadDocument={uploadDocument} onDelete={editingNoteId ? () => { deleteNote(editingNoteId); cancelNoteForm(); } : undefined} />}
          </AnimatePresence>
          {!showNoteForm && <div className="flex min-h-screen w-full items-center justify-center bg-background p-8 text-center">
            <div><FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="mb-1 text-[13px] font-medium text-foreground">Choose a note to continue</p><p className="mb-4 text-[12px] text-muted-foreground">Or start a fresh note in this folder.</p><button onClick={startNewNote} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-background"><Plus className="h-3.5 w-3.5" /> New Note</button></div>
          </div>}
        </section>
      </div>
    );
  }

  /* ─────────────────── FOLDERS LIST VIEW (default) ─────────── */
  return (
    <div className="mx-auto max-w-5xl p-3 md:p-4">
      {/* ── Folder library toolbar ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="flex shrink-0 items-baseline gap-2 pr-1">
          <h1 className="font-serif text-base leading-none tracking-tight">{folderScope === 'archived' ? 'Archived' : 'Folders'}</h1>
          <span className="text-[11px] text-muted-foreground">{filteredFolders.length}</span>
        </div>
        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search folders…"
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
          />
        </div>
        <div ref={sortMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setSortOpen(open => !open)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            className="h-9 inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 text-[12px] text-foreground transition-colors hover:bg-background"
          >
            <ArrowDownAZ className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{sortBy === 'newest' ? 'Newest' : sortBy === 'modified' ? 'Recently modified' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'name' ? 'Name A–Z' : 'Most notes'}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>
          {sortOpen && (
            <div role="menu" aria-label="Sort folders" className="absolute right-0 top-full z-30 mt-2 min-w-[150px] rounded-xl border border-border bg-card p-1.5 shadow-lg">
              {([
                ['newest', 'Newest'],
                ['modified', 'Recently modified'],
                ['oldest', 'Oldest'],
                ['name', 'Name A–Z'],
                ['notes', 'Most notes'],
              ] as [FolderSort, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortBy === value}
                  onClick={() => { setSortBy(value); setSortOpen(false); }}
                  className="flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-secondary"
                >
                  {label}
                  {sortBy === value && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl border border-border bg-secondary">
          {([['list', List], ['grid', LayoutGrid], ['graph', Network]] as [FolderListMode, LucideIcon][]).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setListMode(mode)} title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${listMode === mode ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        {selectMode && <>
          <button onClick={toggleSelectAll} disabled={filteredFolders.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">
            <Check className="h-3.5 w-3.5" /> {allVisibleSelected ? 'Clear all' : 'Select all'}
          </button>
          <button onClick={archiveSelected} disabled={selectedFolderIds.size === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
          <button onClick={deleteSelected} disabled={selectedFolderIds.size === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <button onClick={() => { setSelectMode(false); setSelectedFolderIds(new Set()); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-background">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </>}
        {!selectMode && <button onClick={() => { setSelectMode(true); setSelectedFolderIds(new Set()); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-background">
          <Square className="h-3.5 w-3.5" /> Select
        </button>}
        {/* New Folder */}
        {!selectMode && <button onClick={() => { cancelFolderForm(); setShowFolderForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-[12px] font-medium hover:bg-secondary transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Folder
        </button>}
        {selectedFolderIds.size > 0 && <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-mono text-muted-foreground">{selectedFolderIds.size} selected</span>}
      </div>

      {/* Inline folder editor — creation and renaming happen in place. */}
      <AnimatePresence initial={false}>
        {showFolderForm && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-2.5"
          >
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={folderNameInputRef}
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveFolder();
                if (e.key === 'Escape') cancelFolderForm();
              }}
              placeholder="Folder name…"
              aria-label={editingFolderId ? 'Rename folder' : 'New folder name'}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button onClick={saveFolder} disabled={!folderName.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--accent))] px-3 py-1.5 text-[12px] font-semibold text-[hsl(var(--accent-foreground))] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">
              <Save className="h-3.5 w-3.5" /> {editingFolderId ? 'Save' : 'Create'}
            </button>
            <button onClick={cancelFolderForm} aria-label="Cancel folder edit" className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Folder content based on listMode ── */}
      {filteredFolders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-secondary p-10 text-center">
          <Folder className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          {search ? (
            <p className="text-[13px] text-muted-foreground">No folders match your search.</p>
          ) : folderScope === 'archived' ? (
            <>
              <p className="mb-1 text-[14px] font-medium text-foreground">Nothing archived</p>
              <p className="mx-auto max-w-xs text-[12px] text-muted-foreground">Archived folders will stay here until you restore them.</p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium text-foreground mb-1">Start with a subject folder</p>
              <p className="text-[12px] text-muted-foreground mb-4 max-w-xs mx-auto">Folders keep your notes organised by subject. Every expert was once a beginner — create your first one.</p>
              <button onClick={() => { cancelFolderForm(); setShowFolderForm(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-secondary text-[12px] font-medium text-foreground hover:bg-secondary transition-colors">
                <Plus className="h-3.5 w-3.5" /> Create your first folder
              </button>
            </>
          )}
        </div>

      ) : listMode === 'graph' ? (
        /* ── GRAPH mode ── */
        <div key="graph">
        <FolderGraphView
          folders={filteredFolders}
          onSelectFolder={folderId => {
            const folder = folders.find(f => f.id === folderId);
            if (folder) openFolder(folder);
          }}
          onSelectSection={(folderId, sectionId) => {
            const folder = folders.find(f => f.id === folderId);
            if (folder) openFolder(folder);
          }}
          onSelectNote={(folderId, sectionId, noteId) => {
            const folder = folders.find(f => f.id === folderId);
            const cat = folder?.categories.find(c => c.id === sectionId);
            const note = cat?.notes.find(n => n.id === noteId);
            if (folder && note) {
              setActiveFolder(folder);
              setActiveCategory(notesCategory(folder));
              editNote(note);
            } else if (folder) {
              openFolder(folder);
            }
          }}
        />
        </div>

      ) : listMode === 'list' ? (
        /* ── LIST mode ── */
        <div key="list">
          <div className="mb-1 hidden grid-cols-[minmax(220px,1.8fr)_80px_140px_140px_90px_72px] items-center gap-3 px-4 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground lg:grid">
            <span>Folder</span><span>Notes</span><span>Created</span><span>Modified</span><span>Size</span><span />
          </div>
          <div className="space-y-1.5">
          {filteredFolders.map((folder, i) => (
            <div key={folder.id} className="relative">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-secondary px-3 py-3 transition-all hover:border-border hover:bg-background lg:grid-cols-[minmax(220px,1.8fr)_80px_140px_140px_90px_72px] lg:px-4"
                onClick={() => openFolder(folder)}>
              {editingFolderId === folder.id ? (
                <div className="col-span-full flex min-w-0 items-center gap-2" onClick={event => event.stopPropagation()}>
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input ref={folderNameInputRef} value={folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') cancelFolderForm(); }} aria-label={`Rename ${folder.name}`} className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[13px] font-semibold text-foreground outline-none focus:border-primary/50" autoFocus />
                  <button onClick={saveFolder} disabled={!folderName.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[hsl(var(--accent))] px-2.5 py-1.5 text-[11px] font-semibold text-[hsl(var(--accent-foreground))] disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save</button>
                  <button onClick={cancelFolderForm} className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Cancel rename"><X className="mx-auto h-3.5 w-3.5" /></button>
                </div>
              ) : <>
                <div className="flex min-w-0 items-center gap-2">
                  {selectMode && <FolderCheckbox checked={selectedFolderIds.has(folder.id)} onToggle={() => toggleFolderSelection(folder.id)} label={`Select ${folder.name}`} />}
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-[13px] font-semibold text-foreground" title={folder.name}>{folder.name}</p>
                </div>
                <span className="text-[10px] text-muted-foreground sm:text-left">{totalNotes(folder)}</span>
                <span className="hidden text-[11px] text-muted-foreground lg:block">{format(folder.createdAt, 'MMM d, yyyy')}</span>
                <span className="hidden text-[11px] text-muted-foreground lg:block">{format(new Date(folderModifiedAt(folder)), 'MMM d, yyyy')}</span>
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex"><HardDrive className="h-3 w-3" />{formatBytes(folderSizeBytes(folder))}</span>
                <div className="flex items-center justify-end gap-1">
                  <div className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${selectMode ? 'pointer-events-none hidden' : ''}`}>
                    <button onClick={e => { e.stopPropagation(); editFolder(folder); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="h-3 w-3" /></button>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
                </div>
              </>}
              </motion.div>
            </div>
          ))}
          </div>
        </div>

      ) : (
        /* ── GRID mode (default) ── */
        <div key="grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredFolders.map((folder, i) => (
            <motion.div key={folder.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className="group relative rounded-2xl border border-border bg-secondary p-4 hover:border-border hover:bg-secondary cursor-pointer transition-all"
              onClick={() => openFolder(folder)}>
              {selectMode && <FolderCheckbox checked={selectedFolderIds.has(folder.id)} onToggle={() => toggleFolderSelection(folder.id)} label={`Select ${folder.name}`} className="absolute right-3 top-3 z-10" />}
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary transition-transform group-hover:scale-105">
                <Folder className="text-muted-foreground" style={{ width: 22, height: 22 }} />
              </div>
              {editingFolderId === folder.id ? (
                <div className="flex items-center gap-1.5" onClick={event => event.stopPropagation()}>
                  <input ref={folderNameInputRef} value={folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') cancelFolderForm(); }} aria-label={`Rename ${folder.name}`} className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-2 py-1.5 text-[13px] font-semibold text-foreground outline-none focus:border-primary/50" autoFocus />
                  <button onClick={saveFolder} disabled={!folderName.trim()} className="h-7 w-7 shrink-0 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] disabled:opacity-40" aria-label="Save rename"><Save className="mx-auto h-3.5 w-3.5" /></button>
                  <button onClick={cancelFolderForm} className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Cancel rename"><X className="mx-auto h-3.5 w-3.5" /></button>
                </div>
              ) : <h3 className="mb-1 truncate font-semibold text-[13px] text-foreground">{folder.name}</h3>}
              <p className="text-[10px] text-muted-foreground">{totalNotes(folder)} note{totalNotes(folder) !== 1 ? 's' : ''}</p>
              {/* Hover actions */}
              <div className={`absolute right-2.5 top-2.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${selectMode || editingFolderId === folder.id ? 'pointer-events-none hidden' : ''}`}>
                <button onClick={e => { e.stopPropagation(); editFolder(folder); }}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-border bg-secondary hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
                  <Edit3 className="h-3 w-3" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-all">
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
