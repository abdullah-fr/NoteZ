/**
 * Centralized Credits, Plans & Usage Configuration for NoteZ
 *
 * Single Source of Truth for:
 * - Plan definitions, prices, allowances, and benefits
 * - Credit costs per metered action
 * - Metadata and human-friendly labels for credit transactions
 * - Error codes and deduction / refund utilities
 *
 * Credits are stored in localStorage per user (keyed by user ID).
 * Free users get weekly resets; paid users get monthly resets.
 */

export type PlanTier = 'free' | 'pro_student' | 'pro_scholar' | 'team';

export type MeteredAction =
  | 'ai_chat'
  | 'generate_exam'
  | 'generate_flashcards'
  | 'editor_ai_assist'
  | 'activities_breakdown';

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  creditAllowance: number;
  resetDays: number;
  highlighted?: boolean;
  badge?: string;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Full access to all NoteZ tools for every student.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    creditAllowance: 150,
    resetDays: 7,
    features: [
      '150 weekly AI credits (refilled every week)',
      'AI Note taking, flashcards & exams',
      'Spaced repetition flashcards & FSRS algorithm',
      'Daily quiz & Pomodoro focus timer',
      '1 active subject & folder organization',
      'Streaks, XP tracking & basic progress',
    ],
  },
  pro_student: {
    id: 'pro_student',
    name: 'Pro Student',
    tagline: 'For students who want higher limits & maximum retention.',
    monthlyPrice: 8,
    yearlyPrice: 6,
    creditAllowance: 5000,
    resetDays: 30,
    highlighted: true,
    badge: 'Most Popular',
    features: [
      '5,000 monthly AI credits (33x Free allowance)',
      'Unlimited subjects, folders & categories',
      'Priority AI response generation',
      'Unlimited exam generations & mock simulations',
      'Advanced study analytics & coach insights',
      'Voice-to-text input in AI Chat',
    ],
  },
  pro_scholar: {
    id: 'pro_scholar',
    name: 'Pro Scholar',
    tagline: 'For researchers, grad students & heavy power users.',
    monthlyPrice: 18,
    yearlyPrice: 14,
    creditAllowance: 15000,
    resetDays: 30,
    features: [
      '15,000 monthly AI credits (100x Free allowance)',
      'Everything in Pro Student',
      'Multi-source document synthesis & batch AI',
      'Citation export (BibTeX, APA, MLA, Chicago)',
      'Long-context research conversations',
      'Early access to new experimental AI features',
    ],
  },
  team: {
    id: 'team',
    name: 'Team / Campus',
    tagline: 'For study groups, research labs & classrooms.',
    monthlyPrice: 35,
    yearlyPrice: 28,
    creditAllowance: 50000,
    resetDays: 30,
    features: [
      '50,000 shared monthly AI credits',
      'Collaborative decks & shared class hubs',
      'Admin usage analytics & seat management',
      'Dedicated support & campus integrations',
    ],
  },
};

/** Backward-compat: expose monthlyCredits as an alias */
export function getPlanAllowance(tier: PlanTier): number {
  return PLANS[tier]?.creditAllowance ?? 150;
}

/** Exact credit cost per individual action */
export const CREDIT_COSTS: Record<MeteredAction, number> = {
  ai_chat: 5,
  generate_exam: 25,
  generate_flashcards: 20,
  editor_ai_assist: 5,
  activities_breakdown: 20,
};

export interface ActionMeta {
  label: string;
  shortDesc: string;
  category: 'AI Assistant' | 'Practice' | 'Editor' | 'Organization';
  unit: string;
}

export const ACTION_METADATA: Record<MeteredAction, ActionMeta> = {
  ai_chat: {
    label: 'NoteZ AI Chat',
    shortDesc: 'Ask NoteZ AI study assistant or research question',
    category: 'AI Assistant',
    unit: '5 credits / message',
  },
  generate_exam: {
    label: 'Exam Generation',
    shortDesc: 'Adaptive practice exam with step-by-step solutions',
    category: 'Practice',
    unit: '25 credits / exam',
  },
  generate_flashcards: {
    label: 'Flashcard Generation',
    shortDesc: 'Smart spaced-repetition Q&A flashcards from notes',
    category: 'Practice',
    unit: '20 credits / deck',
  },
  editor_ai_assist: {
    label: 'AI Assist (Editor)',
    shortDesc: 'Improve, rephrase, explain or summarize highlighted text',
    category: 'Editor',
    unit: '5 credits / action',
  },
  activities_breakdown: {
    label: 'Syllabus Breakdown',
    shortDesc: 'Parse course syllabus into structured study tasks',
    category: 'Organization',
    unit: '20 credits / document',
  },
};

/** All metered actions as an ordered array for UI display */
export const METERED_ACTIONS: MeteredAction[] = [
  'ai_chat',
  'generate_exam',
  'generate_flashcards',
  'editor_ai_assist',
  'activities_breakdown',
];

export type CreditErrorCode =
  | 'INSUFFICIENT_CREDITS'
  | 'MONTHLY_LIMIT_REACHED'
  | 'FEATURE_LIMIT_REACHED'
  | 'PLAN_REQUIRED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE';

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  action: string;
  description: string;
  status: 'success' | 'refunded' | 'failed';
  balance_after: number;
  created_at: string;
}

export interface UserCreditsSummary {
  balance: number;
  allowance: number;
  usedThisPeriod: number;
  tier: PlanTier;
  resetDays: number;
  periodStart: string;
  periodEnd: string;
  transactions: CreditTransaction[];
}

/* ── localStorage Credit Store ─────────────────────────────────────── */

const CREDITS_KEY_PREFIX = 'notez_credits_v2';

function getStorageKey(userId?: string | null): string {
  return userId ? `${CREDITS_KEY_PREFIX}_${userId}` : `${CREDITS_KEY_PREFIX}_guest`;
}

function createFreshSummary(tier: PlanTier, userId?: string | null): UserCreditsSummary {
  const plan = PLANS[tier];
  const now = new Date();
  const periodEnd = new Date(now.getTime() + plan.resetDays * 24 * 60 * 60 * 1000);

  return {
    balance: plan.creditAllowance,
    allowance: plan.creditAllowance,
    usedThisPeriod: 0,
    tier,
    resetDays: plan.resetDays,
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    transactions: [
      {
        id: `init-${Date.now()}`,
        user_id: userId || 'guest',
        amount: plan.creditAllowance,
        action: 'credit_refill',
        description: `${tier === 'free' ? 'Weekly' : 'Monthly'} credit allowance (${plan.name} plan)`,
        status: 'success',
        balance_after: plan.creditAllowance,
        created_at: now.toISOString(),
      },
    ],
  };
}

function getLocalCredits(userId?: string | null): UserCreditsSummary {
  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: UserCreditsSummary = JSON.parse(raw);

      // Check if the period has expired and auto-reset
      if (new Date(parsed.periodEnd) <= new Date()) {
        const tier = parsed.tier || 'free';
        const fresh = createFreshSummary(tier, userId);
        localStorage.setItem(key, JSON.stringify(fresh));
        return fresh;
      }

      return parsed;
    }
  } catch {}

  // First time: create fresh credits
  const fresh = createFreshSummary('free', userId);
  try {
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

function saveLocalCredits(userId: string | null | undefined, summary: UserCreditsSummary) {
  const key = getStorageKey(userId);
  try {
    // Keep only the last 50 transactions to avoid localStorage bloat
    const trimmed = {
      ...summary,
      transactions: summary.transactions.slice(0, 50),
    };
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Fetch credit summary for a user. Always uses localStorage.
 * Auto-resets expired periods.
 */
export async function fetchUserCreditsSummary(userId?: string | null): Promise<UserCreditsSummary> {
  return getLocalCredits(userId);
}

export interface DeductionResult {
  success: boolean;
  code?: CreditErrorCode;
  balanceAfter?: number;
  deducted?: number;
  required?: number;
  resetDate?: string;
  tier?: PlanTier;
}

/**
 * Check and deduct credits for an action.
 * Uses localStorage for all users (server-side enforcement via Supabase RPC
 * can be added later without changing the interface).
 */
export async function checkAndDeductCredits(
  userId: string | null | undefined,
  action: MeteredAction,
  customAmount?: number,
  description?: string,
  _metadata?: Record<string, any>,
): Promise<DeductionResult> {
  const cost = customAmount ?? CREDIT_COSTS[action] ?? 5;
  const desc = description || ACTION_METADATA[action]?.label || action;

  const local = getLocalCredits(userId);

  if (local.balance < cost) {
    return {
      success: false,
      code: 'INSUFFICIENT_CREDITS',
      required: cost,
      balanceAfter: local.balance,
      resetDate: local.periodEnd,
      tier: local.tier,
    };
  }

  local.balance -= cost;
  local.usedThisPeriod += cost;
  local.transactions.unshift({
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId || 'guest',
    amount: -cost,
    action,
    description: desc,
    status: 'success',
    balance_after: local.balance,
    created_at: new Date().toISOString(),
  });
  saveLocalCredits(userId, local);

  return {
    success: true,
    balanceAfter: local.balance,
    deducted: cost,
    resetDate: local.periodEnd,
  };
}

/**
 * Refund credits if an operation fails after deduction.
 */
export async function refundCredits(
  userId: string | null | undefined,
  amount: number,
  action: MeteredAction,
  reason = 'Operation failed',
  _metadata?: Record<string, any>,
): Promise<void> {
  if (amount <= 0) return;

  const local = getLocalCredits(userId);
  local.balance += amount;
  local.usedThisPeriod = Math.max(0, local.usedThisPeriod - amount);
  local.transactions.unshift({
    id: `refund-${Date.now()}`,
    user_id: userId || 'guest',
    amount,
    action: 'refund',
    description: `Refund: ${reason}`,
    status: 'refunded',
    balance_after: local.balance,
    created_at: new Date().toISOString(),
  });
  saveLocalCredits(userId, local);
}

/**
 * Calculate per-feature usage from transactions.
 */
export function getPerFeatureUsage(
  transactions: CreditTransaction[],
): Record<MeteredAction, { credits: number; count: number }> {
  const result: Record<string, { credits: number; count: number }> = {};
  for (const action of METERED_ACTIONS) {
    result[action] = { credits: 0, count: 0 };
  }

  for (const tx of transactions) {
    if (tx.amount < 0 && tx.status === 'success' && tx.action in result) {
      result[tx.action].credits += Math.abs(tx.amount);
      result[tx.action].count += 1;
    }
  }

  return result as Record<MeteredAction, { credits: number; count: number }>;
}
