/**
 * Storage helpers for data that belongs to one authenticated account.
 *
 * Never use a bare localStorage key for user-owned data.  Authentication
 * tokens are intentionally managed separately by the Supabase client.
 */
const USER_STORAGE_PREFIX = 'notez:user:';
const CREDITS_STORAGE_PREFIX = 'notez_credits_v3_';

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
 * Remove every browser cache owned by one account.
 *
 * Keep global presentation preferences (theme and language) intact, but do
 * not leave account data behind after sign-out or account deletion. The
 * credits cache has its own historical key format, so it is cleared here as
 * well as the newer notez:user:<id>: namespace.
 */
export function clearUserStorage(userId: string | null | undefined): void {
  if (!userId || typeof window === 'undefined') return;

  const userPrefix = getUserStorageKey(userId, '');
  const creditsKey = `${CREDITS_STORAGE_PREFIX}${userId}`;
  const isOwnedKey = (key: string | null): boolean =>
    Boolean(key && (key === creditsKey || key.startsWith(userPrefix)));

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (isOwnedKey(key) && key) storage.removeItem(key);
      }
    } catch {
      // Ignore unavailable storage; Supabase remains the source of truth.
    }
  }
}

/**
 * Remove account-scoped browser caches that do not belong to the active user.
 *
 * A browser can contain keys left by an account that was deleted, or by a
 * session that expired before the auth provider observed the identity change.
 * Keeping only the current user's namespace prevents those stale keys from
 * surviving a fresh sign-in while preserving the active account's cache.
 */
export function clearOtherUsersStorage(keepUserId: string | null | undefined): void {
  if (typeof window === 'undefined') return;

  const keepUserPrefix = keepUserId ? getUserStorageKey(keepUserId, '') : null;
  const keepCreditsKey = keepUserId ? `${CREDITS_STORAGE_PREFIX}${keepUserId}` : null;
  const isOtherUserKey = (key: string | null): boolean => Boolean(
    key &&
    (key.startsWith(USER_STORAGE_PREFIX) || key.startsWith(CREDITS_STORAGE_PREFIX)) &&
    key !== keepCreditsKey &&
    (!keepUserPrefix || !key.startsWith(keepUserPrefix)),
  );

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (isOtherUserKey(key) && key) storage.removeItem(key);
      }
    } catch {
      // Ignore unavailable storage; Supabase remains the source of truth.
    }
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
