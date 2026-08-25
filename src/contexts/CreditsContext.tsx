import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import {
  type PlanTier,
  type MeteredAction,
  type CreditTransaction,
  type UserCreditsSummary,
  type CreditErrorCode,
  CREDIT_COSTS,
  ACTION_METADATA,
  fetchUserCreditsSummary,
  checkAndDeductCredits,
  refundCredits,
} from '@/lib/credits';
import { toast } from 'sonner';

export interface LimitModalState {
  open: boolean;
  type: CreditErrorCode;
  action?: MeteredAction;
  required?: number;
  balance?: number;
  resetDate?: string;
  tier?: PlanTier;
  message?: string;
}

interface CreditsContextType {
  balance: number;
  monthlyAllowance: number;
  usedThisPeriod: number;
  tier: PlanTier;
  periodStart: string;
  periodEnd: string;
  transactions: CreditTransaction[];
  loading: boolean;
  refreshCredits: () => Promise<void>;
  deductAndExecute: <T>(
    action: MeteredAction,
    executeFn: () => Promise<T>,
    options?: {
      customCost?: number;
      description?: string;
      metadata?: Record<string, any>;
    },
  ) => Promise<T>;
  limitModal: LimitModalState;
  openLimitModal: (state: Partial<LimitModalState>) => void;
  closeLimitModal: () => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<UserCreditsSummary>({
    balance: 500,
    monthlyAllowance: 500,
    usedThisPeriod: 0,
    tier: 'free',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    transactions: [],
  });
  const [loading, setLoading] = useState(true);

  const [limitModal, setLimitModal] = useState<LimitModalState>({
    open: false,
    type: 'INSUFFICIENT_CREDITS',
    balance: 500,
    required: 25,
  });

  const refreshCredits = useCallback(async () => {
    try {
      const data = await fetchUserCreditsSummary(user?.id);
      setSummary(data);
    } catch (err) {
      console.warn('[CreditsProvider] Failed to refresh credits:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const openLimitModal = useCallback((state: Partial<LimitModalState>) => {
    setLimitModal(prev => ({
      ...prev,
      ...state,
      open: true,
      balance: state.balance ?? summary.balance,
      resetDate: state.resetDate ?? summary.periodEnd,
      tier: state.tier ?? summary.tier,
      type: state.type || 'INSUFFICIENT_CREDITS',
    }));
  }, [summary]);

  const closeLimitModal = useCallback(() => {
    setLimitModal(prev => ({ ...prev, open: false }));
  }, []);

  /**
   * Safely deducts credits, executes the AI operation, and automatically refunds
   * credits if the operation fails or throws an exception.
   */
  const deductAndExecute = useCallback(
    async <T,>(
      action: MeteredAction,
      executeFn: () => Promise<T>,
      options?: {
        customCost?: number;
        description?: string;
        metadata?: Record<string, any>;
      },
    ): Promise<T> => {
      const cost = options?.customCost ?? CREDIT_COSTS[action] ?? 5;
      const desc = options?.description || ACTION_METADATA[action]?.label || action;

      // 1. Client pre-check
      if (summary.balance < cost) {
        openLimitModal({
          type: 'INSUFFICIENT_CREDITS',
          action,
          required: cost,
          balance: summary.balance,
          resetDate: summary.periodEnd,
          tier: summary.tier,
        });
        throw new Error(`INSUFFICIENT_CREDITS: Required ${cost}, available ${summary.balance}`);
      }

      // 2. Server-side reservation / deduction
      const deductRes = await checkAndDeductCredits(
        user?.id,
        action,
        cost,
        desc,
        options?.metadata,
      );

      if (!deductRes.success) {
        openLimitModal({
          type: deductRes.code || 'INSUFFICIENT_CREDITS',
          action,
          required: deductRes.required || cost,
          balance: summary.balance,
          resetDate: deductRes.resetDate || summary.periodEnd,
          tier: deductRes.tier || summary.tier,
        });
        throw new Error(`CREDIT_LIMIT_REACHED: ${deductRes.code || 'INSUFFICIENT_CREDITS'}`);
      }

      // Update local balance state immediately
      if (typeof deductRes.balanceAfter === 'number') {
        setSummary(prev => ({
          ...prev,
          balance: deductRes.balanceAfter!,
          usedThisPeriod: prev.usedThisPeriod + cost,
        }));
      }

      // 3. Execute the actual API function
      try {
        const result = await executeFn();
        // Background refresh to sync ledger
        refreshCredits();
        return result;
      } catch (err: any) {
        console.error(`[credits] Operation failed for ${action}, triggering auto-refund:`, err);

        // 4. Automatic safe refund on failure
        await refundCredits(
          user?.id,
          cost,
          action,
          err?.message || 'Operation failed',
          options?.metadata,
        );

        // Re-sync credit balance after refund
        await refreshCredits();

        // Check if the failure was a rate-limit vs service error
        const isRateLimit = err?.message?.includes('RATE_LIMITED') || err?.status === 429;
        if (isRateLimit) {
          openLimitModal({
            type: 'RATE_LIMITED',
            action,
            message: 'Too many rapid requests. Please wait a few seconds and try again.',
          });
        }

        throw err;
      }
    },
    [user?.id, summary, openLimitModal, refreshCredits],
  );

  return (
    <CreditsContext.Provider
      value={{
        balance: summary.balance,
        monthlyAllowance: summary.monthlyAllowance,
        usedThisPeriod: summary.usedThisPeriod,
        tier: summary.tier,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        transactions: summary.transactions,
        loading,
        refreshCredits,
        deductAndExecute,
        limitModal,
        openLimitModal,
        closeLimitModal,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
