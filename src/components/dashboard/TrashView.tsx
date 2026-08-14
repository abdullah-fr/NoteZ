import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, FileText, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TrashItem {
  id: string;
  noteId: string;
  title: string;
  content: string;
  folderName: string;
  folderId: string;
  deletedAt: string; // ISO string
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getTrashItems(): TrashItem[] {
  try {
    return JSON.parse(localStorage.getItem('notez_trash') || '[]');
  } catch {
    return [];
  }
}

function setTrashItems(items: TrashItem[]) {
  localStorage.setItem('notez_trash', JSON.stringify(items));
}

function daysRemaining(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
}

export default function TrashView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrashItem[]>([]);

  // Load and auto-purge expired items on mount
  useEffect(() => {
    const raw = getTrashItems();
    const now = Date.now();
    const valid = raw.filter(item => now - new Date(item.deletedAt).getTime() < THIRTY_DAYS_MS);
    if (valid.length !== raw.length) {
      setTrashItems(valid);
    }
    setItems(valid);
  }, []);

  function restoreNote(item: TrashItem) {
    // Put note back into the folder in localStorage
    try {
      const foldersRaw = localStorage.getItem('notez_folders');
      if (foldersRaw) {
        const folders = JSON.parse(foldersRaw);
        const folder = folders.find((f: any) => f.id === item.folderId);
        if (folder) {
          // Add note back to the first category (or create one)
          if (!folder.categories || folder.categories.length === 0) {
            folder.categories = [{ id: `${folder.id}-notes`, name: 'Notes', type: 'custom', notes: [] }];
          }
          folder.categories[0].notes.unshift({
            id: item.noteId,
            title: item.title,
            content: item.content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          localStorage.setItem('notez_folders', JSON.stringify(folders));
          window.dispatchEvent(new Event('notez:folders-updated'));
        }
      }
    } catch {
      // Silent fail
    }

    // Remove from trash
    const updated = items.filter(i => i.id !== item.id);
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-destructive/10 border border-destructive/20">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-serif text-2xl tracking-tight leading-none">{t('tools.trash.title')}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('tools.trash.desc')}</p>
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
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 group"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{item.title || 'Untitled Note'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('tools.trash.fromFolder', { folder: item.folderName })} · {t('tools.trash.daysLeft', { days })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreNote(item)}
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
