/**
 * useFolderStorage — cloud-backed storage for NoteZ folders & trash.
 *
 * Strategy:
 *  - Primary storage: Supabase (notez_folders / notez_trash tables), scoped by user_id.
 *  - Secondary/cache: localStorage (same keys as before, so the rest of the app
 *    that listens to window events still works unchanged).
 *  - On mount: load from Supabase; if the DB row is empty but localStorage has
 *    data, migrate it up automatically (one-time migration for existing users).
 *  - On every write: update React state + localStorage immediately (optimistic),
 *    then upsert to Supabase in the background.
 *  - If the user is not signed in, falls back to pure localStorage (guest mode).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── shared types (re-exported so FolderView / TrashView can import from here) ──
export type CategoryType = 'unit' | 'assignment' | 'project' | 'custom';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  notes: Note[];
}

export interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt?: Date;
  categories: Category[];
  archived?: boolean;
}

export interface TrashItem {
  id: string;
  type?: 'folder' | 'note';
  noteId?: string;
  title?: string;
  content?: string;
  folderName?: string;
  folderId?: string;
  color?: string;
  item?: FolderItem;
  folderData?: FolderItem;
  deletedAt: string;
}

// ── internal serialised types (dates as strings in JSON) ──────────────────────
type StoredNote = Omit<Note, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
type StoredCategory = Omit<Category, 'notes'> & { notes: StoredNote[] };
type StoredFolder = Omit<FolderItem, 'createdAt' | 'updatedAt' | 'categories'> & {
  createdAt: string;
  updatedAt?: string;
  categories: StoredCategory[];
};

// ── helpers ───────────────────────────────────────────────────────────────────

function deserializeFolders(stored: StoredFolder[]): FolderItem[] {
  return stored.map(f => ({
    ...f,
    createdAt: new Date(f.createdAt),
    updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(f.createdAt),
    categories: (f.categories ?? []).map(c => ({
      ...c,
      notes: (c.notes ?? []).map(n => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      })),
    })),
  }));
}

function parseFoldersFromRaw(raw: string | null): FolderItem[] {
  if (!raw) return [];
  try {
    return deserializeFolders(JSON.parse(raw) as StoredFolder[]);
  } catch {
    return [];
  }
}

function parseTrashFromRaw(raw: string | null): TrashItem[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TrashItem[];
  } catch {
    return [];
  }
}

// ── Supabase upsert helpers ───────────────────────────────────────────────────

async function upsertFoldersToSupabase(userId: string, folders: FolderItem[]): Promise<void> {
  await supabase
    .from('notez_folders')
    .upsert({ user_id: userId, data: JSON.parse(JSON.stringify(folders)) as object[] }, { onConflict: 'user_id' });
}

async function upsertTrashToSupabase(userId: string, items: TrashItem[]): Promise<void> {
  await supabase
    .from('notez_trash')
    .upsert({ user_id: userId, data: JSON.parse(JSON.stringify(items)) as object[] }, { onConflict: 'user_id' });
}

// Trash can be written by both FolderView and its nested TrashView. Serialize
// those writes so an older request cannot finish after a newer empty/delete
// operation and put stale items back in the cloud row.
const trashWriteQueues = new Map<string, Promise<void>>();

function queueTrashWrite(userId: string, items: TrashItem[]): void {
  const previous = trashWriteQueues.get(userId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => upsertTrashToSupabase(userId, items));
  trashWriteQueues.set(userId, next);
  void next.catch(() => undefined).finally(() => {
    if (trashWriteQueues.get(userId) === next) trashWriteQueues.delete(userId);
  });
}

async function fetchFoldersFromSupabase(userId: string): Promise<FolderItem[] | null> {
  const { data, error } = await supabase
    .from('notez_folders')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return deserializeFolders((data.data as unknown as StoredFolder[]) ?? []);
  } catch {
    return null;
  }
}

async function fetchTrashFromSupabase(userId: string): Promise<TrashItem[] | null> {
  const { data, error } = await supabase
    .from('notez_trash')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return (data.data as unknown as TrashItem[]) ?? [];
  } catch {
    return null;
  }
}

// ── hook ──────────────────────────────────────────────────────────────────────

interface UseFolderStorageReturn {
  folders: FolderItem[];
  trashItems: TrashItem[];
  loading: boolean;
  /** Replace the entire folders array and persist it. */
  setFolders: (updater: FolderItem[] | ((prev: FolderItem[]) => FolderItem[])) => void;
  /** Replace the entire trash array and persist it. */
  setTrashItems: (updater: TrashItem[] | ((prev: TrashItem[]) => TrashItem[])) => void;
}

export function useFolderStorage(userId: string | null | undefined): UseFolderStorageReturn {
  const [folders, setFoldersState] = useState<FolderItem[]>(() =>
    parseFoldersFromRaw(localStorage.getItem('notez_folders'))
  );
  const [trashItems, setTrashState] = useState<TrashItem[]>(() =>
    parseTrashFromRaw(localStorage.getItem('notez_trash'))
  );
  const [loading, setLoading] = useState<boolean>(true);

  // Ref to track the latest userId without triggering re-renders inside callbacks
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // ── Initial load from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      // No user — use whatever is in localStorage (guest mode)
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [cloudFolders, cloudTrash] = await Promise.all([
          fetchFoldersFromSupabase(userId!),
          fetchTrashFromSupabase(userId!),
        ]);

        if (cancelled) return;

        if (cloudFolders !== null) {
          // Cloud has data — use it as the source of truth
          setFoldersState(cloudFolders);
          localStorage.setItem('notez_folders', JSON.stringify(cloudFolders));
          window.dispatchEvent(new Event('notez:folders-updated'));
        } else {
          // No cloud row yet — check if there's local data to migrate
          const localRaw = localStorage.getItem('notez_folders');
          const localFolders = parseFoldersFromRaw(localRaw);
          if (localFolders.length > 0) {
            // Migrate existing localStorage data to Supabase
            void upsertFoldersToSupabase(userId!, localFolders);
          }
          setFoldersState(localFolders);
        }

        if (cloudTrash !== null) {
          setTrashState(cloudTrash);
          localStorage.setItem('notez_trash', JSON.stringify(cloudTrash));
          window.dispatchEvent(new Event('notez:trash-updated'));
        } else {
          const localTrash = parseTrashFromRaw(localStorage.getItem('notez_trash'));
          if (localTrash.length > 0) {
            queueTrashWrite(userId!, localTrash);
          }
          setTrashState(localTrash);
        }
      } catch {
        // Network error — silently fall back to localStorage
        setFoldersState(parseFoldersFromRaw(localStorage.getItem('notez_folders')));
        setTrashState(parseTrashFromRaw(localStorage.getItem('notez_trash')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Listen for cross-component and cross-tab updates ────────────────────────
  useEffect(() => {
    const reloadFolders = () => {
      setFoldersState(parseFoldersFromRaw(localStorage.getItem('notez_folders')));
    };
    const reloadTrash = () => {
      setTrashState(parseTrashFromRaw(localStorage.getItem('notez_trash')));
    };
    window.addEventListener('notez:folders-updated', reloadFolders);
    window.addEventListener('notez:trash-updated', reloadTrash);
    window.addEventListener('storage', reloadFolders);
    window.addEventListener('storage', reloadTrash);
    return () => {
      window.removeEventListener('notez:folders-updated', reloadFolders);
      window.removeEventListener('notez:trash-updated', reloadTrash);
      window.removeEventListener('storage', reloadFolders);
      window.removeEventListener('storage', reloadTrash);
    };
  }, []);

  // ── setFolders — optimistic local + async cloud ─────────────────────────────
  const setFolders = useCallback(
    (updater: FolderItem[] | ((prev: FolderItem[]) => FolderItem[])) => {
      setFoldersState(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // 1. Write to localStorage immediately (keeps the rest of the app in sync)
        try {
          localStorage.setItem('notez_folders', JSON.stringify(next));
          window.dispatchEvent(new Event('notez:folders-updated'));
        } catch { /* quota exceeded — ignore */ }

        // 2. Persist to Supabase in the background
        const uid = userIdRef.current;
        if (uid) void upsertFoldersToSupabase(uid, next);

        return next;
      });
    },
    []
  );

  // ── setTrashItems — optimistic local + async cloud ──────────────────────────
  const setTrashItems = useCallback(
    (updater: TrashItem[] | ((prev: TrashItem[]) => TrashItem[])) => {
      setTrashState(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem('notez_trash', JSON.stringify(next));
          window.dispatchEvent(new Event('notez:trash-updated'));
        } catch { /* quota exceeded — ignore */ }

        const uid = userIdRef.current;
        if (uid) queueTrashWrite(uid, next);

        return next;
      });
    },
    []
  );

  return { folders, trashItems, loading, setFolders, setTrashItems };
}
