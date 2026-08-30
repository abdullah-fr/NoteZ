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
  CREDIT_LIMIT_EVENT,
  CREDITS_UPDATED_EVENT,
  fetchUserCreditsSummary,
  PLANS,
} from '@/lib/credits';
import { reportClientWarning } from '@/lib/client-logging';

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
  allowance: number;
  usedThisPeriod: number;
  tier: PlanTier;
  resetDays: number;
  periodStart: string;
  periodEnd: string;
  transactions: CreditTransaction[];
  loading: boolean;
  refreshCredits: () => Promise<void>;
  limitModal: LimitModalState;
  openLimitModal: (state: Partial<LimitModalState>) => void;
  closeLimitModal: () => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const freePlan = PLANS.free;
  const [summary, setSummary] = useState<UserCreditsSummary>({
    balance: freePlan.creditAllowance,
    allowance: freePlan.creditAllowance,
    usedThisPeriod: 0,
    tier: 'free',
    resetDays: freePlan.resetDays,
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + freePlan.resetDays * 24 * 60 * 60 * 1000).toISOString(),
    transactions: [],
  });
  const [loading, setLoading] = useState(true);

  const [limitModal, setLimitModal] = useState<LimitModalState>({
    open: false,
    type: 'MONTHLY_LIMIT_REACHED',
    balance: freePlan.creditAllowance,
    required: 1,
  });

  const refreshCredits = useCallback(async () => {
    // Don't fetch until we actually have a userId — prevents creating a fresh
    // summary with undefined userId and overwriting real cloud data.
    if (!user?.id) return;
    try {
      const data = await fetchUserCreditsSummary(user.id);
      setSummary(data);
    } catch {
      reportClientWarning('credits-provider');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      refreshCredits();
    } else {
      // Auth still loading — keep loading state true until user resolves
      setLoading(true);
    }
  }, [refreshCredits, user?.id]);

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

  useEffect(() => {
    const handleCreditLimit = (event: Event) => {
      const details = (event as CustomEvent<Partial<LimitModalState>>).detail;
      const eventType = (details as Partial<LimitModalState> & { code?: CreditErrorCode })?.code;
      openLimitModal({
        ...details,
        type: details?.type || eventType || 'MONTHLY_LIMIT_REACHED',
        required: details?.required || 1,
      });
      void refreshCredits();
    };

    window.addEventListener(CREDIT_LIMIT_EVENT, handleCreditLimit);
    return () => window.removeEventListener(CREDIT_LIMIT_EVENT, handleCreditLimit);
  }, [openLimitModal, refreshCredits]);

  useEffect(() => {
    const handleCreditsUpdated = () => { void refreshCredits(); };
    window.addEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, handleCreditsUpdated);
  }, [refreshCredits]);

  return (
    <CreditsContext.Provider
      value={{
        balance: summary.balance,
        allowance: summary.allowance,
        usedThisPeriod: summary.usedThisPeriod,
        tier: summary.tier,
        resetDays: summary.resetDays,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        transactions: summary.transactions,
        loading,
        refreshCredits,
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
