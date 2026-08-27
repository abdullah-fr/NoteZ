import { useState, useCallback, useRef } from 'react';
import type { LimitField } from '@/components/dashboard/UpgradeModal';

interface UpgradeModalState {
  open: boolean;
  field: LimitField;
  limit: number;
  balance?: number;
  required?: number;
  resetDate?: string;
}

/**
 * Hook that manages UpgradeModal state with per-session rate-limiting.
 */
export function useUpgradeModal() {
  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalState>({
    open: false,
    field: 'ai_chat_messages_count',
    limit: 20,
  });

  const shownThisSession = useRef<Set<string>>(new Set());

  const handleLimitError = useCallback((field: LimitField, limit: number, extra?: { balance?: number; required?: number; resetDate?: string }) => {
    if (shownThisSession.current.has(field)) return;
    shownThisSession.current.add(field);
    setUpgradeModal({
      open: true,
      field,
      limit,
      balance: extra?.balance,
      required: extra?.required,
      resetDate: extra?.resetDate,
    });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal(prev => ({ ...prev, open: false }));
  }, []);

  return { upgradeModal, handleLimitError, closeUpgradeModal };
}

/**
 * Parses a Supabase edge-function or RPC error response and returns structured
 * limit data for credit or usage errors.
 */
export function parseLimitError(
  err: unknown,
): { field: LimitField; limit: number; balance?: number; required?: number; resetDate?: string } | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, any>;

  // Check structured credit error
  if (e.error === 'INSUFFICIENT_CREDITS' || e.error === 'MONTHLY_LIMIT_REACHED' || e.code === 'INSUFFICIENT_CREDITS' || e.code === 'MONTHLY_LIMIT_REACHED' || e.error === 'USAGE_LIMIT_REACHED') {
    const field = (e.action || e.field || 'generate_exam') as LimitField;
    const required = Number(e.cost || e.required || e.limit || 1);
    const balance = typeof e.balance === 'number' ? e.balance : undefined;
    return {
      field,
      limit: required,
      required,
      balance,
      resetDate: e.resetDate || e.reset_date,
    };
  }

  return null;
}
