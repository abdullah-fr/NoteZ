import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, FileText, Folder, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface TrashItem {
  id: string;
  type?: 'folder' | 'note';
  noteId?: string;
  title?: string;
  content?: string;
  folderName?: string;
  folderId?: string;
  item?: any;
  deletedAt: string; // ISO string
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getTrashItems(): TrashItem[] {
  try {
    return JSON.parse(localStorage.getItem('notez_trash') || '[]');
  } catch {
    return [];
  }
}

function setTrashItems(items: TrashItem[]) {
  localStorage.setItem('notez_trash', JSON.stringify(items));
  window.dispatchEvent(new Event('notez:trash-updated'));
}

function daysRemaining(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, Math.ceil((SEVEN_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
}

export default function TrashView({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrashItem[]>([]);

  // Load and auto-purge expired items on mount
  useEffect(() => {
    const raw = getTrashItems();
    const now = Date.now();
    const valid = raw.filter(item => now - new Date(item.deletedAt).getTime() < SEVEN_DAYS_MS);
    if (valid.length !== raw.length) {
      setTrashItems(valid);
    }
    setItems(valid);
  }, []);

  function restoreItem(trashEntry: TrashItem) {
    try {
      const foldersRaw = localStorage.getItem('notez_folders');
      let folders = foldersRaw ? JSON.parse(foldersRaw) : [];

      const folderData = trashEntry.item || trashEntry.folderData;
      if (trashEntry.type === 'folder' && folderData) {
        // Restore folder
        const existingIdx = folders.findIndex((f: any) => f.id === folderData.id);
        if (existingIdx !== -1) {
          folders[existingIdx] = folderData;
        } else {
          folders.unshift(folderData);
        }
        localStorage.setItem('notez_folders', JSON.stringify(folders));
        window.dispatchEvent(new Event('notez:folders-updated'));
      } else {
        // Restore note
        const targetFolderId = trashEntry.folderId;
        let folder = folders.find((f: any) => f.id === targetFolderId);

        if (!folder && folders.length > 0) {
          folder = folders[0];
        } else if (!folder) {
          folder = {
            id: targetFolderId || crypto.randomUUID(),
            name: trashEntry.folderName || 'Restored Notes',
            color: '#3b82f6',
            categories: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          folders.unshift(folder);
        }

        if (!folder.categories || folder.categories.length === 0) {
          folder.categories = [{ id: `${folder.id}-notes`, name: 'Notes', type: 'custom', notes: [] }];
        }
        const targetCat = folder.categories[0];
        if (!targetCat.notes) targetCat.notes = [];

        const existingNoteIdx = targetCat.notes.findIndex((n: any) => n.id === (trashEntry.noteId || trashEntry.id));
        const noteToRestore = {
          id: trashEntry.noteId || trashEntry.id,
          title: trashEntry.title || 'Untitled Note',
          content: trashEntry.content || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (existingNoteIdx !== -1) {
          targetCat.notes[existingNoteIdx] = noteToRestore;
        } else {
          targetCat.notes.unshift(noteToRestore);
        }

        localStorage.setItem('notez_folders', JSON.stringify(folders));
        window.dispatchEvent(new Event('notez:folders-updated'));
      }
    } catch (err) {
      console.error('Failed to restore trash item:', err);
    }

    // Remove from trash
    const updated = items.filter(i => i.id !== trashEntry.id);
    setItems(updated);
    setTrashItems(updated);
  }

  function permanentDelete(id: string) {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    setTrashItems(updated);
  }

  function emptyTrash() {
    if (!window.confirm(t('tools.trash.emptyTrashConfirm'))) return;
    setItems([]);
    setTrashItems([]);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header matching Image 2 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="h-8 w-8 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Back to Folders"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="font-serif text-2xl tracking-tight leading-none text-foreground">{t('tools.trash.title')}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              Deleted items are automatically removed after 7 days
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={emptyTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('tools.trash.emptyTrash')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border bg-secondary p-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">{t('tools.trash.empty')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('tools.trash.emptyDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((item, i) => {
                const days = daysRemaining(item.deletedAt);
                const isFolder = item.type === 'folder' || Boolean(item.folderData) || Boolean(item.color) || (Boolean(item.item) && !item.noteId && !item.content);
                const displayName = isFolder ? (item.item?.name || item.folderData?.name || item.folderName || 'Folder') : (item.title || 'Untitled Note');

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 group"
                  >
                    {isFolder ? (
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isFolder ? 'Folder' : t('tools.trash.fromFolder', { folder: item.folderName || 'Folder' })} · {t('tools.trash.daysLeft', { days })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreItem(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
                      >
                        <RotateCcw className="h-3 w-3 text-emerald-500" />
                        {t('tools.trash.restore')}
                      </button>
                      <button
                        onClick={() => permanentDelete(item.id)}
                        className="flex items-center justify-center h-7 w-7 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                        title={t('tools.trash.deletePermanently')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {days <= 3 && (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-amber-500 font-mono">
                        <AlertTriangle className="h-3 w-3" />
                        {days}d
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
