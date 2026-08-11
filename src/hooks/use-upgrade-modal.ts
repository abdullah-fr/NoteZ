import { useState, useCallback, useRef } from 'react';
import type { LimitField } from '@/components/dashboard/UpgradeModal';

interface UpgradeModalState {
  open: boolean;
  field: LimitField;
  limit: number;
}

/**
 * Hook that manages UpgradeModal state with per-session rate-limiting so the
 * modal fires at most once per limit-type per session, not once per API call.
 *
 * Usage:
 *   const { upgradeModal, handleLimitError, closeUpgradeModal } = useUpgradeModal();
 *
 *   // In your API call catch block:
 *   if (err?.error === 'USAGE_LIMIT_REACHED') handleLimitError(err.field, err.limit);
 *
 *   // In JSX:
 *   <UpgradeModal {...upgradeModal} onClose={closeUpgradeModal} />
 */
export function useUpgradeModal() {
  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalState>({
    open: false,
    field: 'ai_chat_messages_count',
    limit: 20,
  });

  // Track which fields have already shown a modal this session so we never
  // fire repeatedly for the same limit in one sitting.
  const shownThisSession = useRef<Set<LimitField>>(new Set());

  const handleLimitError = useCallback((field: LimitField, limit: number) => {
    if (shownThisSession.current.has(field)) return;
    shownThisSession.current.add(field);
    setUpgradeModal({ open: true, field, limit });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal(prev => ({ ...prev, open: false }));
  }, []);

  return { upgradeModal, handleLimitError, closeUpgradeModal };
}

/**
 * Parses a Supabase edge-function error response and returns structured
 * limit data if it's a USAGE_LIMIT_REACHED error, or null otherwise.
 */
export function parseLimitError(
  err: unknown,
): { field: LimitField; limit: number } | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  if (e.error !== 'USAGE_LIMIT_REACHED') return null;
  if (typeof e.field !== 'string' || typeof e.limit !== 'number') return null;
  return { field: e.field as LimitField, limit: e.limit };
}
