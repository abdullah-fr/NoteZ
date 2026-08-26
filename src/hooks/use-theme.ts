import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeId = 'light' | 'dark' | 'warm-paper' | 'midnight';

export const THEMES = [
  { id: 'light', label: 'Light', description: 'Crisp clean light mode' },
  { id: 'dark', label: 'Dark', description: 'Focused dark mode' },
];

const STORAGE_KEY = 'notez_theme';

export function applyTheme(id: string) {
  const root = document.documentElement;
  const isDark = id === 'dark' || id === 'midnight';
  const themeAttribute = isDark ? 'midnight' : 'warm-paper';

  root.setAttribute('data-theme', themeAttribute);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/** Reads persisted theme */
async function resolveTheme(): Promise<ThemeId> {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local === 'dark' || local === 'midnight') return 'dark';
  if (local === 'light' || local === 'warm-paper') return 'light';

  try {
    const { data } = await supabase.auth.getUser();
    const meta = data?.user?.user_metadata?.theme;
    if (meta === 'dark' || meta === 'midnight') return 'dark';
    if (meta === 'light' || meta === 'warm-paper') return 'light';
  } catch {
    /* fall through */
  }

  return 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>('light');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    resolveTheme().then((t) => {
      const normalized = t === 'dark' || t === 'midnight' ? 'dark' : 'light';
      setThemeState(normalized);
      applyTheme(normalized);
    });
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    const normalized = id === 'dark' || id === 'midnight' ? 'dark' : 'light';
    setThemeState(normalized);
    applyTheme(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);

    // Persist to user_metadata if logged in
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { theme: normalized } });
    } catch {
      /* fail silently — localStorage still holds it */
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    theme,
    isDark: theme === 'dark' || theme === 'midnight',
    setTheme,
    saving,
  };
}
