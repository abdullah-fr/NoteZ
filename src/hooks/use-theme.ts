import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeId = 'warm-paper' | 'midnight';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  /** Inline preview swatch colors [bg, fg, accent] */
  swatches: [string, string, string];
  proOnly: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'warm-paper',
    label: 'Light',
    description: 'Warm Paper — a soft cream desk for long study sessions.',
    swatches: ['hsl(38 30% 94%)', 'hsl(25 30% 18%)', 'hsl(32 55% 42%)'],
    proOnly: false,
  },
  {
    id: 'midnight',
    label: 'Dark',
    description: 'Midnight — quiet charcoal with warm cream type.',
    swatches: ['hsl(220 8% 7%)', 'hsl(40 20% 94%)', 'hsl(145 18% 38%)'],
    proOnly: false,
  },
];

const STORAGE_KEY = 'notez_theme';

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
}

/** Reads the persisted theme (user_metadata first, then localStorage fallback). */
async function resolveTheme(): Promise<ThemeId> {
  try {
    const { data } = await supabase.auth.getUser();
    const meta = data?.user?.user_metadata?.theme as ThemeId | undefined;
    if (meta && THEMES.find(t => t.id === meta)) return meta;
  } catch { /* fall through */ }
  const local = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (local && THEMES.find(t => t.id === local)) return local;
  return 'warm-paper';
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>('warm-paper');
  const [saving, setSaving]    = useState(false);

  useEffect(() => {
    resolveTheme().then(t => {
      setThemeState(t);
      applyTheme(t);
    });
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    // Apply immediately for instant feedback
    setThemeState(id);
    applyTheme(id);
    localStorage.setItem(STORAGE_KEY, id);

    // Persist to user_metadata so it follows the account across devices
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { theme: id } });
    } catch { /* fail silently — localStorage still holds it */ }
    finally { setSaving(false); }
  }, []);

  return { theme, setTheme, saving };
}
