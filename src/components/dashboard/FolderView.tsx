import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, Plus, Trash, Trash2, Edit3, Save, X,
  FileText, Search, ChevronRight, ArrowLeft,
  LayoutGrid, List, Network,
  ArrowDownAZ, Check, ChevronDown,
  Upload, Download, Loader2, Copy, Archive, ArchiveRestore,
  HardDrive, Square, PanelLeftClose, PanelLeftOpen, LogOut, Settings,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import FolderGraphView from './FolderGraphView';
import NoteEditor from './NoteEditor';
import TrashView from './TrashView';
import { htmlToPlainText } from './note-utils';
import { useAuth } from '@/lib/auth';
import { editorAiAssist } from '@/services';
import { createConversation, getStreamingToken } from '@/services/chat.service';
import { fetchSources, triggerProcessSource, uploadSourceFile } from '@/services/sources.service';
import { useFolderStorage } from '@/hooks/useFolderStorage';

// Configure pdfjs worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/* ─── types ─── */
// Note, Category, FolderItem, CategoryType are imported from useFolderStorage
import type { Note, Category, FolderItem, CategoryType } from '@/hooks/useFolderStorage';
type FolderListMode = 'grid' | 'list' | 'graph';
type FolderSort = 'newest' | 'modified' | 'oldest' | 'name' | 'notes';
type NoteSort = 'updated' | 'created' | 'title';

/* ─── constants ─── */
const FOLDER_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
];

function uid() { return crypto.randomUUID(); }

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

function formatFolderDate(dateInput: Date | number | string): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs >= 0 && diffMs < 60 * 1000) {
    return 'Just now';
  }

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'Today';

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';

  return format(date, 'MMM d, yyyy');
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
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary/80 text-transparent hover:border-primary/60 hover:bg-secondary'} ${className}`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTE FORM — Clean Single Sticky Header Bar matching Image 2 & 4
══════════════════════════════════════════════════════════════ */
function NoteForm({
  editingId, title, setTitle, content, setContent, onSave, onCancel, onHelpWrite, onDelete, onUploadDocument,
  notesSidebarOpen, onToggleNotesSidebar
}: {
  editingId: string | null;
  title: string; setTitle: (v: string) => void;
  content: string; setContent: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  onHelpWrite?: (action: string, text: string) => Promise<string>;
  onDelete?: () => void;
  onUploadDocument?: (file: File) => Promise<string>;
  notesSidebarOpen?: boolean;
  onToggleNotesSidebar?: () => void;
}) {
  const [actionError, setActionError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = htmlToPlainText(content).trim() ? htmlToPlainText(content).trim().split(/\s+/).length : 0;
  const charCount = htmlToPlainText(content).length;

  const handleSaveInternal = () => {
    if (!title.trim()) {
      setTitle('Untitled Note');
    }
    onSave();
    setSaveSuccessMsg(editingId ? 'Updated successfully ✓' : 'Saved successfully ✓');
    window.setTimeout(() => setSaveSuccessMsg(''), 2500);
  };

  async function handleUpload(file: File) {
    const isAllowed = /\.(txt|doc|docx)$/i.test(file.name);
    if (!isAllowed) {
      setActionError('Only TXT and DOC files are allowed.');
      return;
    }
    setUploading(true);
    setActionError('');
    try {
      let importedHtml = '';
      if (/\.(docx|doc)$/i.test(file.name)) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          importedHtml = result.value || textToHtml(result.messages.map(m => m.message).join('\n'));
        } catch {
          const text = await file.text();
          importedHtml = textToHtml(text);
        }
      } else {
        const text = await file.text();
        importedHtml = textToHtml(text);
      }

      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
      setContent(importedHtml);
      setEditorRevision(value => value + 1);
    } catch (error) {
      console.error('File upload error:', error);
      setActionError('Error uploading document.');
    } finally {
      setUploading(false);
    }
  }

  function downloadWordDocument() {
    const htmlDocument = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || 'NoteZ Note')}</title></head><body style="font-family: sans-serif; color: #111; line-height: 1.6;">${content || '<p></p>'}</body></html>`;
    const blob = new Blob([htmlDocument], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.trim() || 'NoteZ Note'}.doc`;
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
      setActionError('Copy was blocked by browser.');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col min-h-0 bg-background">
      {/* Single Sticky Header Bar matching Image 2 & 4: [ Editor Sidebar Toggle ]   Note Title */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 backdrop-blur-md px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-lg">
          {!notesSidebarOpen && onToggleNotesSidebar && (
            <button
              type="button"
              onClick={onToggleNotesSidebar}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors shrink-0"
              title="Open notes sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title…"
            className="flex-1 bg-secondary/60 border border-border/80 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors min-w-[140px]"
          />
        </div>

        <div className="flex items-center gap-2">
          {saveSuccessMsg && (
            <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg animate-in fade-in">
              {saveSuccessMsg}
            </span>
          )}

          <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground px-2 py-1 rounded bg-secondary/60 border border-border/50">
            {wordCount} words · {charCount} chars
          </span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary/60 text-[11px] text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
            title="Upload Document (.txt, .doc, .docx)"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">Upload</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.doc,.docx,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void handleUpload(file); e.currentTarget.value = ''; }} />

          {(() => {
            const hasContent = htmlToPlainText(content).trim().length > 0;
            return (
              <>
                <button
                  type="button"
                  onClick={downloadWordDocument}
                  disabled={!hasContent}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary/60 text-[11px] text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Download Word Document"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => void copyNote()}
                  disabled={!hasContent}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary/60 text-[11px] text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copyMessage || 'Copy'}</span>
                </button>
              </>
            );
          })()}

          {editingId && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-destructive/30 bg-destructive/10 text-[11px] text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={handleSaveInternal}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{editingId ? 'Update' : 'Save'}</span>
          </button>

          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-destructive/10 text-destructive border-b border-destructive/20 text-xs px-4 py-1.5 font-mono shrink-0">
          {actionError}
        </div>
      )}

      {/* Lexical Rich Editor */}
      <NoteEditor
        key={`${editingId ?? 'new'}-${editorRevision}`}
        initialHtml={content}
        onChange={setContent}
        autoFocus={!editingId}
        onAiTransform={onHelpWrite}
        onSave={handleSaveInternal}
        onClearAll={() => { setTitle(''); setContent(''); }}
      />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN FOLDER VIEW COMPONENT
══════════════════════════════════════════════════════════════ */
export default function FolderView({
  initialFolderId,
  initialScope = 'active',
  onFolderOpen,
  onFolderList,
  sidebarOpen = true,
  onToggleSidebar,
}: {
  initialFolderId?: string;
  initialScope?: 'active' | 'archived';
  onFolderOpen?: () => void;
  onFolderList?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}) {
  const { user, signOut } = useAuth();
  const { folders, setFolders, setTrashItems, loading: foldersLoading } = useFolderStorage(user?.id);
  const [view, setView] = useState<'folders' | 'notes' | 'trash'>('folders');
  const [folderScope, setFolderScope] = useState<'active' | 'archived'>(initialScope);
  const [activeFolder,   setActiveFolder]   = useState<FolderItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeNote,     setActiveNote]     = useState<Note | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [notesSidebarOpen, setNotesSidebarOpen] = useState(true);

  /* ── folder list display mode: grid | list | graph ── */
  const [listMode, setListMode] = useState<FolderListMode>('list');

  /* ── Dynamic trash state ── */
  const [hasTrashItems, setHasTrashItems] = useState<boolean>(false);

  useEffect(() => {
    const checkTrash = () => {
      try {
        setHasTrashItems(JSON.parse(localStorage.getItem('notez_trash') || '[]').length > 0);
      } catch {
        setHasTrashItems(false);
      }
    };
    checkTrash();
    window.addEventListener('notez:trash-updated', checkTrash);
    window.addEventListener('notez:folders-updated', checkTrash);
    return () => {
      window.removeEventListener('notez:trash-updated', checkTrash);
      window.removeEventListener('notez:folders-updated', checkTrash);
    };
  }, []);

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

  /* ── palette: "New Folder" ── */
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
    setShowFolderForm(false);
  }
  function deleteFolder(id: string) {
    const targetFolder = folders.find(f => f.id === id);
    if (targetFolder) {
      setTrashItems(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'folder' as const,
        folderId: targetFolder.id,
        folderName: targetFolder.name,
        color: targetFolder.color,
        item: targetFolder,
        folderData: targetFolder,
        deletedAt: new Date().toISOString(),
      }]);
    }
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolder?.id === id) { setActiveFolder(null); setView('folders'); }
  }
  function cancelFolderForm() { setShowFolderForm(false); setFolderName(''); setFolderColor(FOLDER_COLORS[0]); setEditingFolderId(null); }
  function openFolder(f: FolderItem) {
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
    if (!window.confirm(`Delete ${count} selected folder${count === 1 ? '' : 's'}?`)) return;
    const targets = folders.filter(f => selectedFolderIds.has(f.id));
    if (targets.length > 0) {
      setTrashItems(prev => [
        ...prev,
        ...targets.map(t => ({
          id: crypto.randomUUID(),
          type: 'folder' as const,
          folderId: t.id,
          folderName: t.name,
          color: t.color,
          item: t,
          folderData: t,
          deletedAt: new Date().toISOString(),
        })),
      ]);
    }
    setFolders(previous => previous.filter(folder => !selectedFolderIds.has(folder.id)));
    setSelectedFolderIds(new Set());
    setSelectMode(false);
  }

  /* ── note actions ── */
  function saveNote() {
    if (!activeFolder || !activeCategory) return;
    const saveTitle = noteTitle.trim() || 'Untitled Note';
    const now = new Date();
    const targetNoteId = editingNoteId || activeNote?.id || uid();
    const noteExists = activeCategory.notes.some(n => n.id === targetNoteId);

    let updatedNotes: Note[];
    if (noteExists) {
      updatedNotes = activeCategory.notes.map(n =>
        n.id === targetNoteId ? { ...n, title: saveTitle, content: noteContent, updatedAt: now } : n
      );
    } else {
      updatedNotes = [
        { id: targetNoteId, title: saveTitle, content: noteContent, createdAt: now, updatedAt: now },
        ...activeCategory.notes,
      ];
    }

    setEditingNoteId(targetNoteId);
    const updatedNoteObj = {
      id: targetNoteId,
      title: saveTitle,
      content: noteContent,
      createdAt: activeNote?.createdAt || now,
      updatedAt: now,
    };
    setActiveNote(updatedNoteObj);
    syncCategory({ ...activeCategory, notes: updatedNotes });
  }

  function editNote(n: Note) {
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setEditingNoteId(n.id);
    setActiveNote(n);
    setView('notes');
    setShowNoteForm(true);
    onFolderOpen?.();
  }
  function deleteNote(id: string) {
    if (!activeCategory) return;
    // Move to trash instead of permanent deletion
    const note = activeCategory.notes.find(n => n.id === id);
    if (note && activeFolder) {
      setTrashItems(prev => [...prev, {
        id: crypto.randomUUID(),
        noteId: note.id,
        title: note.title,
        content: note.content,
        folderName: activeFolder.name,
        folderId: activeFolder.id,
        deletedAt: new Date().toISOString(),
      }]);
    }
    syncCategory({ ...activeCategory, notes: activeCategory.notes.filter(n => n.id !== id) });
    if (activeNote?.id === id) { setActiveNote(null); setView('notes'); }
  }
  function startNewNote() {
    if (showNoteForm && (noteTitle.trim() || noteContent.trim())) {
      saveNote();
    }
    let targetFolder = activeFolder || folders[0];
    if (!targetFolder) {
      targetFolder = {
        id: crypto.randomUUID(),
        name: 'General Notes',
        color: FOLDER_COLORS[0],
        categories: [{ id: uid(), name: 'Notes', type: 'custom', notes: [] }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setFolders(prev => [targetFolder!, ...prev]);
    }
    const targetCategory = notesCategory(targetFolder);
    setActiveFolder(targetFolder);
    setActiveCategory(targetCategory);
    setActiveNote(null);
    setNoteTitle('');
    setNoteContent('');
    setEditingNoteId(null);
    setShowNoteForm(true);
    setView('notes');
    onFolderOpen?.();
  }
  function cancelNoteForm() { setShowNoteForm(false); setNoteTitle(''); setNoteContent(''); setEditingNoteId(null); }

  async function uploadDocument(file: File): Promise<string> {
    if (!user) throw new Error('Please sign in to upload a document.');
    try {
      const source = await uploadSourceFile(user.id, file);
      await triggerProcessSource(source.id);
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const sources = await fetchSources();
        const current = sources.find(item => item.id === source.id);
        if (current?.status === 'ready') return current.extracted_text ?? current.summary ?? '';
        if (current?.status === 'failed') break;
        await new Promise(resolve => window.setTimeout(resolve, 800));
      }
    } catch {
      /* Fallback to local reading */
    }
    return await file.text();
  }

  async function helpWrite(action: string, selectedText: string): Promise<string> {
    try {
      const transformed = await editorAiAssist(action, selectedText);
      if (transformed && transformed !== selectedText) return transformed;
    } catch {
      /* Fallback */
    }

    if (action === 'improve') {
      return selectedText.charAt(0).toUpperCase() + selectedText.slice(1);
    } else if (action === 'summarize') {
      return `• ${selectedText.split('. ').join('\n• ')}`;
    } else if (action === 'explain') {
      return `[Explanation]: ${selectedText}`;
    } else if (action === 'flashcard') {
      return `Q: What is ${selectedText.slice(0, 30)}?\nA: ${selectedText}`;
    }
    return selectedText;
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

  /* ─────────────────── ARCHIVED VIEW ────────────────── */
  if (folderScope === 'archived') {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-border bg-card/60 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFolderScope('active')}
              className="h-8 w-8 rounded-lg border border-border bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors shrink-0"
              title="Back to Folders"
            >
              <ArrowLeft className="h-4 w-4 text-primary" />
            </button>

            {!sidebarOpen && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                title="Open sidebar"
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-secondary/80 hover:bg-secondary text-foreground transition-colors shrink-0"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="font-serif text-lg leading-none tracking-tight">Archived Folders</h1>
              <p className="mt-1 text-[11px] text-muted-foreground">{visibleFolders.length} folder{visibleFolders.length === 1 ? '' : 's'} archived</p>
            </div>
          </div>

          <div className="relative w-52 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search archived…"
              className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">
          {visibleFolders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
              <Archive className="mx-auto mb-3 h-9 w-9 text-emerald-600 dark:text-emerald-400 opacity-80" />
              <p className="text-[13px] font-medium text-foreground">Nothing archived</p>
              <p className="text-xs text-muted-foreground mt-1">Archived folders will stay here safely until you restore them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFolders.map(folder => (
                <div key={folder.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 hover:bg-secondary/70 transition-colors">
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground" title={folder.name}>{folder.name}</span>
                  <span className="shrink-0 text-[11px] font-mono text-muted-foreground">{totalNotes(folder)} note{totalNotes(folder) === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    onClick={() => restoreFolder(folder.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Unarchive
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFolder(folder.id)}
                    className="inline-flex shrink-0 items-center justify-center h-7 w-7 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────── NOTES WORKSPACE VIEW ────────────────── */
  if (view === 'notes') {
    const currentFolder = activeFolder || folders[0];
    const currentCategory = activeCategory || (currentFolder ? notesCategory(currentFolder) : null);

    if (currentFolder && currentCategory) {
      return (
        <div className="flex h-full w-full overflow-hidden">
          {/* Collapsible Notes Sidebar */}
          {notesSidebarOpen && (
            <>
              {/* Dark Backdrop for Mobile */}
              <div
                onClick={() => setNotesSidebarOpen(false)}
                className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
              />
              <aside className="fixed inset-y-0 left-0 z-50 md:relative md:z-0 flex w-64 md:w-44 shrink-0 flex-col border-r border-border bg-card text-card-foreground h-full transition-all shadow-2xl md:shadow-none">
              <div className="space-y-2 border-b border-border p-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  {/* Single Clean Back Button (No Double Arrow) */}
                  <button onClick={returnToFolderList} title="Back to Folders" className="flex min-w-0 items-center gap-1 text-[11px] text-foreground hover:text-primary transition-colors font-semibold truncate">
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">Folders</span>
                  </button>
                  <button
                    onClick={() => setNotesSidebarOpen(false)}
                    title="Collapse Notes Panel"
                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button onClick={startNewNote} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> New Note
                </button>
              </div>
              <div className="border-b border-border p-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={noteSearch} onChange={event => setNoteSearch(event.target.value)} placeholder="Search notes…" className="w-full rounded-lg border border-border bg-secondary/60 py-1.5 pl-7 pr-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                <div className="flex items-center justify-between px-1.5 pb-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Notes ({visibleNotes.length})</p>
                  <div ref={noteSortMenuRef} className="relative">
                    <button type="button" onClick={() => setNoteSortOpen(open => !open)} aria-label="Sort notes" aria-haspopup="menu" aria-expanded={noteSortOpen} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowDownAZ className="h-3.5 w-3.5" /></button>
                    {noteSortOpen && <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-xl border border-border bg-card p-1.5 shadow-lg">
                      {([['updated', 'Recently updated'], ['created', 'Recently created'], ['title', 'Title A–Z']] as [NoteSort, string][]).map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={noteSort === value} onClick={() => { setNoteSort(value); setNoteSortOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary">{label}{noteSort === value && <Check className="h-3.5 w-3.5 text-primary" />}</button>)}
                    </div>}
                  </div>
                </div>
                {visibleNotes.length === 0 ? (
                  <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">No matching notes.</p>
                ) : visibleNotes.map(note => (
                  <div key={note.id} className={`group mb-1 flex items-center gap-1 rounded-lg transition-colors ${activeNote?.id === note.id ? 'bg-primary/10 border border-primary/40 text-foreground font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                    <button onClick={() => editNote(note)} title={note.title} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[12px]">{note.title || 'Untitled note'}</button>
                    <button onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`} className="mr-1 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>

              {/* Bottom Account Footer on Notes Sidebar with Settings Button */}
              <div className="border-t border-border p-2 flex items-center gap-1.5 shrink-0">
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-sm bg-secondary border border-border flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold font-mono text-foreground">
                      {(user?.user_metadata?.full_name || user?.email || "?")
                        .split(/[\s@]/).filter(Boolean).map((s: string) => s[0].toUpperCase()).slice(0, 2).join("")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono truncate text-foreground">
                    {user?.user_metadata?.full_name || user?.email}
                  </span>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("notez:open-settings"))}
                  title="Account Settings"
                  className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {signOut && (
                  <button onClick={signOut} title="Sign out" className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </aside>
          </>
          )}

          {/* Right Editor Area */}
          <section className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col bg-background">
            {!notesSidebarOpen && !showNoteForm && (
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/60 backdrop-blur-md px-4 py-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotesSidebarOpen(true)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors shrink-0"
                    title="Open notes sidebar"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                  <button onClick={returnToFolderList} title="Back to Folders" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Folders</span>
                  </button>
                </div>
                <button
                  onClick={startNewNote}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-colors shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> New Note
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {showNoteForm ? (
                <NoteForm
                  editingId={editingNoteId}
                  title={noteTitle}
                  setTitle={setNoteTitle}
                  content={noteContent}
                  setContent={setNoteContent}
                  onSave={saveNote}
                  onCancel={cancelNoteForm}
                  onHelpWrite={helpWrite}
                  onUploadDocument={uploadDocument}
                  onDelete={editingNoteId ? () => { deleteNote(editingNoteId); cancelNoteForm(); } : undefined}
                  notesSidebarOpen={notesSidebarOpen}
                  onToggleNotesSidebar={() => setNotesSidebarOpen(open => !open)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-background p-8 text-center">
                  <div>
                    <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                    <p className="mb-1 text-sm font-semibold text-foreground">Select a note to start writing</p>
                    <p className="mb-4 text-xs text-muted-foreground">Or create a new note inside {currentFolder.name}.</p>
                    <button onClick={startNewNote} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 shadow-sm transition-opacity">
                      <Plus className="h-3.5 w-3.5" /> Create New Note
                    </button>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      );
    }
  }

  /* ─────────────────── FOLDERS LIBRARY VIEW (Default) ─────────── */
  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Sticky Header with Left Search Bar & Inline Toggle */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/60 backdrop-blur-md px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {folderScope === 'archived' && (
            <button
              onClick={() => setFolderScope('active')}
              className="h-8 w-8 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Back to Folders"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {!sidebarOpen && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title="Open main sidebar"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-secondary hover:bg-secondary text-foreground transition-colors shrink-0"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-baseline gap-2">
            <h1 className="font-serif text-lg leading-none tracking-tight">
              {folderScope === 'archived' ? 'Archived Folders' : 'Folders'}
            </h1>
            <span className="text-[11px] font-mono text-muted-foreground">{filteredFolders.length}</span>
          </div>

          {/* Search Bar on Left side right next to Folders title */}
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={folderScope === 'archived' ? 'Search archived…' : 'Search folders…'}
              className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen(open => !open)}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 text-xs text-foreground hover:bg-secondary/80 transition-colors"
            >
              <ArrowDownAZ className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{sortBy === 'newest' ? 'Newest' : sortBy === 'modified' ? 'Recently modified' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'name' ? 'Name A–Z' : 'Most notes'}</span>
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[150px] rounded-xl border border-border bg-card p-1.5 shadow-lg">
                {([
                  ['newest', 'Newest'],
                  ['modified', 'Recently modified'],
                  ['oldest', 'Oldest'],
                  ['name', 'Name A–Z'],
                  ['notes', 'Most notes'],
                ] as [FolderSort, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setSortBy(value); setSortOpen(false); }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-secondary transition-colors"
                  >
                    {label}
                    {sortBy === value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-secondary">
            {([['list', List], ['grid', LayoutGrid], ['graph', Network]] as [FolderListMode, LucideIcon][])
              .filter(([mode]) => !(selectMode && mode === 'graph'))
              .map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setListMode(mode)}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${listMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {selectMode ? (
            <>
              <button onClick={toggleSelectAll} className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background">
                <Check className="h-3.5 w-3.5" /> {allVisibleSelected ? 'Clear' : 'All'}
              </button>
              <button onClick={archiveSelected} disabled={selectedFolderIds.size === 0} className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                <Archive className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Archive
              </button>
              <button onClick={deleteSelected} disabled={selectedFolderIds.size === 0} className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
              </button>
              <button onClick={() => { setSelectMode(false); setSelectedFolderIds(new Set()); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setSelectMode(true);
                if (listMode === 'graph') setListMode('grid');
                setSelectedFolderIds(new Set());
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
            >
              <Square className="h-3.5 w-3.5" /> Select
            </button>
          )}

          {!selectMode && (
            <>
              <button
                onClick={() => setFolderScope(s => s === 'archived' ? 'active' : 'archived')}
                title="Archived Folders"
                className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-border text-xs font-medium transition-colors ${
                  folderScope === 'archived'
                    ? 'bg-secondary text-foreground border-border font-semibold'
                    : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Archive className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Archived</span>
              </button>

              <button
                onClick={() => setView(v => v === 'trash' ? 'folders' : 'trash')}
                title={hasTrashItems ? "Trash (Items inside)" : "Trash (Empty)"}
                className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-border text-xs font-medium transition-colors ${
                  view === 'trash'
                    ? 'bg-secondary text-foreground border-border font-semibold'
                    : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {hasTrashItems ? (
                  <Trash2 className="h-3.5 w-3.5 text-foreground shrink-0" />
                ) : (
                  <Trash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="hidden sm:inline">Trash</span>
              </button>

              <button
                onClick={() => { cancelFolderForm(); setShowFolderForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> New Folder
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content View */}
      {view === 'trash' ? (
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full flex-1">
          <TrashView onBack={() => setView('folders')} />
        </div>
      ) : (
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full flex-1">

        {/* Inline Folder Form */}
        <AnimatePresence initial={false}>
          {showFolderForm && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-md"
            >
              <Folder className="h-4 w-4 shrink-0 text-primary" />
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
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button onClick={saveFolder} disabled={!folderName.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 shadow-sm">
                <Save className="h-3.5 w-3.5" /> {editingFolderId ? 'Save' : 'Create'}
              </button>
              <button onClick={cancelFolderForm} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State Container — hidden immediately when showFolderForm is true */}
        {filteredFolders.length === 0 ? (
          !showFolderForm && (
            <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
              {foldersLoading ? (
                <Loader2 className="h-8 w-8 mx-auto text-muted-foreground/60 animate-spin" />
              ) : (
                <>
              <Folder className="h-10 w-10 mx-auto text-muted-foreground/60" />
              {search ? (
                <p className="text-xs text-muted-foreground">No folders match your search.</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Start with a study folder</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">Folders keep your notes organized by subject. Create your first folder to begin.</p>
                  <button
                    onClick={() => { cancelFolderForm(); setShowFolderForm(true); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-sm transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Your First Folder
                  </button>
                </>
              )}
                </>
              )}
            </div>
          )
        ) : listMode === 'graph' ? (
          <FolderGraphView
            folders={filteredFolders}
            onSelectFolder={folderId => {
              const folder = folders.find(f => f.id === folderId);
              if (folder) openFolder(folder);
            }}
            onSelectSection={(folderId) => {
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
        ) : listMode === 'list' ? (
          <div className="space-y-1.5">
            <div className="mb-1 hidden grid-cols-[minmax(220px,1.8fr)_80px_140px_140px_90px_72px] items-center gap-3 px-4 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground lg:grid">
              <span>Folder</span><span>Notes</span><span>Created</span><span>Modified</span><span>Size</span><span />
            </div>
            {filteredFolders.map((folder, i) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card/70 px-3.5 py-3 transition-all hover:border-primary/40 hover:bg-card lg:grid-cols-[minmax(220px,1.8fr)_80px_140px_140px_90px_72px] lg:px-4 cursor-pointer"
                onClick={() => openFolder(folder)}
              >
                {editingFolderId === folder.id ? (
                  <div className="col-span-full flex min-w-0 items-center gap-2" onClick={event => event.stopPropagation()}>
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <input ref={folderNameInputRef} value={folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') cancelFolderForm(); }} aria-label={`Rename ${folder.name}`} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary/50" autoFocus />
                    <button onClick={saveFolder} disabled={!folderName.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save</button>
                    <button onClick={cancelFolderForm} className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Cancel rename"><X className="mx-auto h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-2.5">
                      {selectMode && <FolderCheckbox checked={selectedFolderIds.has(folder.id)} onToggle={() => toggleFolderSelection(folder.id)} label={`Select ${folder.name}`} />}
                      <Folder className="h-4 w-4 shrink-0 text-primary" />
                      <p className="truncate text-xs font-semibold text-foreground" title={folder.name}>{folder.name}</p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{totalNotes(folder)} notes</span>
                    <span className="hidden text-[11px] text-muted-foreground lg:block">{formatFolderDate(folder.createdAt)}</span>
                    <span className="hidden text-[11px] text-muted-foreground lg:block">{formatFolderDate(folderModifiedAt(folder))}</span>
                    <span className="hidden items-center gap-1 text-[11px] font-mono text-muted-foreground lg:flex"><HardDrive className="h-3 w-3" />{formatBytes(folderSizeBytes(folder))}</span>
                    <div className="flex items-center justify-end gap-1">
                      <div className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${selectMode ? 'pointer-events-none hidden' : ''}`}>
                        <button onClick={e => { e.stopPropagation(); editFolder(folder); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="h-3 w-3" /></button>
                        <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredFolders.map((folder, i) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="group relative rounded-xl border border-border bg-card/70 p-4 hover:border-primary/40 hover:bg-card cursor-pointer transition-all space-y-3"
                onClick={() => openFolder(folder)}
              >
                {selectMode && <FolderCheckbox checked={selectedFolderIds.has(folder.id)} onToggle={() => toggleFolderSelection(folder.id)} label={`Select ${folder.name}`} className="absolute right-3 top-3 z-10" />}
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <Folder className="h-4 w-4" />
                  </div>
                  <div className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${selectMode || editingFolderId === folder.id ? 'pointer-events-none hidden' : ''}`}>
                    <button onClick={e => { e.stopPropagation(); editFolder(folder); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit3 className="h-3 w-3" /></button>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>

                {editingFolderId === folder.id ? (
                  <div className="flex items-center gap-1.5" onClick={event => event.stopPropagation()}>
                    <input ref={folderNameInputRef} value={folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') cancelFolderForm(); }} aria-label={`Rename ${folder.name}`} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-primary/50" autoFocus />
                    <button onClick={saveFolder} disabled={!folderName.trim()} className="h-6 px-2 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">Save</button>
                    <button onClick={cancelFolderForm} className="h-6 w-6 rounded text-muted-foreground hover:bg-background"><X className="mx-auto h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div>
                    <h3 className="truncate font-bold text-xs text-foreground mb-0.5">{folder.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground">{totalNotes(folder)} note{totalNotes(folder) !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
