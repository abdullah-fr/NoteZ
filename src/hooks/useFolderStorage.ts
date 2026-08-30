/**
 * useFolderStorage — cloud-backed storage for NoteZ folders & trash.
 *
 * Strategy:
 *  - Primary storage: Supabase (notez_folders / notez_trash tables), scoped by user_id.
 *  - Secondary/cache: user-scoped localStorage, keyed by the authenticated ID.
 *  - On mount: load the current user's Supabase row, with that same user's
 *    local cache as an offline fallback.
 *  - On every write: update React state + the current user's cache immediately,
 *    then upsert to Supabase in the background.
 *  - Signed-out state is always empty; there is no guest fallback for account
 *    data and no safe way to migrate ambiguous legacy keys.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  dispatchUserStorageEvent,
  getUserStorageKey,
  isUserStorageEventFor,
  readUserStorage,
  writeUserStorage,
} from '@/lib/user-storage';

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

function parseFolders(value: unknown): FolderItem[] {
  try {
    return Array.isArray(value) ? deserializeFolders(value as StoredFolder[]) : [];
  } catch {
    return [];
  }
}

function parseTrash(value: unknown): TrashItem[] {
  try {
    return Array.isArray(value) ? value as TrashItem[] : [];
  } catch {
    return [];
  }
}

function readScopedFolders(userId: string | null | undefined): FolderItem[] {
  return parseFolders(readUserStorage<StoredFolder[]>(userId, 'folders', []));
}

function readScopedTrash(userId: string | null | undefined): TrashItem[] {
  return parseTrash(readUserStorage<TrashItem[]>(userId, 'trash', []));
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
  const [folders, setFoldersState] = useState<FolderItem[]>([]);
  const [trashItems, setTrashState] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));

  // Refs keep async loads and optimistic writes tied to the account that started
  // them, even if Supabase emits an auth change while a request is in flight.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const loadRequestRef = useRef(0);

  // ── Load the current user's data ────────────────────────────────────────────
  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    setFoldersState([]);
    setTrashState([]);

    if (!userId) {
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

        if (cancelled || requestId !== loadRequestRef.current || userIdRef.current !== userId) return;

        if (cloudFolders !== null) {
          setFoldersState(cloudFolders);
          writeUserStorage(userId, 'folders', cloudFolders);
          dispatchUserStorageEvent('notez:folders-updated', userId);
        } else {
          // A cache can only ever belong to this exact user ID. Never import
          // an unscoped/legacy value into a newly authenticated account.
          setFoldersState(readScopedFolders(userId));
        }

        if (cloudTrash !== null) {
          setTrashState(cloudTrash);
          writeUserStorage(userId, 'trash', cloudTrash);
          dispatchUserStorageEvent('notez:trash-updated', userId);
        } else {
          setTrashState(readScopedTrash(userId));
        }
      } catch {
        // Network error — only fall back to this user's cache.
        if (!cancelled && requestId === loadRequestRef.current && userIdRef.current === userId) {
          setFoldersState(readScopedFolders(userId));
          setTrashState(readScopedTrash(userId));
        }
      } finally {
        if (!cancelled && requestId === loadRequestRef.current) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Listen for this user's cross-component and cross-tab updates ────────────
  useEffect(() => {
    if (!userId) return;
    const folderKey = getUserStorageKey(userId, 'folders');
    const trashKey = getUserStorageKey(userId, 'trash');

    const reloadFolders = (event?: Event) => {
      if (event?.type === 'storage' && (event as StorageEvent).key !== folderKey) return;
      if (event?.type !== 'storage' && event && !isUserStorageEventFor(event, userId)) return;
      setFoldersState(readScopedFolders(userId));
    };
    const reloadTrash = (event?: Event) => {
      if (event?.type === 'storage' && (event as StorageEvent).key !== trashKey) return;
      if (event?.type !== 'storage' && event && !isUserStorageEventFor(event, userId)) return;
      setTrashState(readScopedTrash(userId));
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
  }, [userId]);

  // ── setFolders — optimistic local + async cloud ─────────────────────────────
  const setFolders = useCallback(
    (updater: FolderItem[] | ((prev: FolderItem[]) => FolderItem[])) => {
      setFoldersState(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const uid = userIdRef.current;
        if (!uid) return prev;

        writeUserStorage(uid, 'folders', next);
        dispatchUserStorageEvent('notez:folders-updated', uid);
        void upsertFoldersToSupabase(uid, next);

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
        const uid = userIdRef.current;
        if (!uid) return prev;

        writeUserStorage(uid, 'trash', next);
        dispatchUserStorageEvent('notez:trash-updated', uid);
        queueTrashWrite(uid, next);

        return next;
      });
    },
    []
  );

  return { folders, trashItems, loading, setFolders, setTrashItems };
}
