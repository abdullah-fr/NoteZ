/**
 * Storage helpers for data that belongs to one authenticated account.
 *
 * Never use a bare localStorage key for user-owned data.  Authentication
 * tokens are intentionally managed separately by the Supabase client.
 */
const USER_STORAGE_PREFIX = 'notez:user:';

export function getUserStorageKey(userId: string, key: string): string {
  return `${USER_STORAGE_PREFIX}${userId}:${key}`;
}

export function readUserStorage<T>(userId: string | null | undefined, key: string, fallback: T): T {
  if (!userId) return fallback;

  try {
    const raw = localStorage.getItem(getUserStorageKey(userId, key));
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeUserStorage(
  userId: string | null | undefined,
  key: string,
  value: unknown,
): void {
  if (!userId) return;

  try {
    localStorage.setItem(getUserStorageKey(userId, key), JSON.stringify(value));
  } catch {
    // Storage is a cache only; the authenticated database remains authoritative.
  }
}

export function removeUserStorage(userId: string | null | undefined, key: string): void {
  if (!userId) return;

  try {
    localStorage.removeItem(getUserStorageKey(userId, key));
  } catch {
    // Ignore unavailable storage.
  }
}

/**
 * Keys used by older builds before account scoping was introduced.  They are
 * deliberately removed instead of migrated because their owner cannot be
 * determined safely.
 */
const LEGACY_USER_DATA_KEYS = [
  'notez_folders',
  'notez_trash',
  'notez_calendar_events',
  'notez_ft_routines',
  'notez_ft_sessions',
  'notez_ft_daily_goal',
  'notez_ft_autostart',
  'notez_feedback',
] as const;

export function clearLegacyUserStorage(): void {
  try {
    LEGACY_USER_DATA_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore unavailable storage.
  }
}

export function dispatchUserStorageEvent(name: string, userId: string): void {
  window.dispatchEvent(new CustomEvent(name, { detail: { userId } }));
}

export function isUserStorageEventFor(event: Event, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const detail = (event as CustomEvent<{ userId?: unknown }>).detail;
  return detail?.userId === userId;
}
