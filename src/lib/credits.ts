/**
 * Credits, Plans & Usage — NoteZ
 *
 * The server-side user_credits ledger is authoritative. localStorage is only a
 * short-lived display cache; AI Edge Functions perform the actual deduction.
 */

import { supabase } from '@/integrations/supabase/client';

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
    creditAllowance: 50,
    resetDays: 30,
    features: [
      '50 AI-assisted actions each month',
      'AI Note taking, flashcards & exams',
      'Spaced repetition flashcards & FSRS algorithm',
      'Daily quiz & Pomodoro focus timer',
      '1 active subject & folder organization',
      'Streaks, XP tracking & basic progress',
    ],
  },
  pro_student: {
    id: 'pro_student',
    name: 'Pro',
    tagline: 'For students who want higher limits & maximum retention.',
    monthlyPrice: 8,
    yearlyPrice: 6,
    creditAllowance: 250,
    resetDays: 30,
    highlighted: true,
    badge: 'Most Popular',
    features: [
      '250 AI-assisted actions each month',
      'Unlimited subjects, folders & categories',
      'Priority AI response generation',
      'More room for exam generations & mock simulations',
      'Advanced study analytics & coach insights',
      'Voice-to-text input in AI Chat',
    ],
  },
  pro_scholar: {
    id: 'pro_scholar',
    name: 'Max',
    tagline: 'For researchers, grad students & heavy power users.',
    monthlyPrice: 18,
    yearlyPrice: 14,
    creditAllowance: 500,
    resetDays: 30,
    features: [
      '500 AI-assisted actions each month',
      'Everything in Pro',
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
      'Shared AI access for your campus',
      'Collaborative decks & shared class hubs',
      'Admin usage analytics & seat management',
      'Dedicated support & campus integrations',
    ],
  },
};

export function getPlanAllowance(tier: PlanTier): number {
  return PLANS[tier]?.creditAllowance ?? 50;
}

/** Every supported AI action consumes exactly one request from the monthly allowance. */
export const CREDIT_COSTS: Record<MeteredAction, number> = {
  ai_chat: 1,
  generate_exam: 1,
  generate_flashcards: 1,
  editor_ai_assist: 1,
  activities_breakdown: 1,
};

export interface ActionMeta {
  label: string;
  shortDesc: string;
  category: 'AI Assistant' | 'Practice' | 'Editor' | 'Organization';
  unit: string;
}

export const ACTION_METADATA: Record<MeteredAction, ActionMeta> = {
  ai_chat:      { label: 'NoteZ AI Chat',       shortDesc: 'Ask NoteZ AI study assistant or research question',       category: 'AI Assistant',  unit: 'AI request' },
  generate_exam:{ label: 'Exam Generation',      shortDesc: 'Adaptive practice exam with step-by-step solutions',      category: 'Practice',      unit: 'AI request' },
  generate_flashcards: { label: 'Flashcard Generation', shortDesc: 'Smart spaced-repetition Q&A flashcards from notes', category: 'Practice',   unit: 'AI request' },
  editor_ai_assist:    { label: 'AI Assist (Editor)',    shortDesc: 'Improve, rephrase, explain or summarize highlighted text', category: 'Editor', unit: 'AI request' },
  activities_breakdown:{ label: 'Syllabus Breakdown',   shortDesc: 'Parse course syllabus into structured study tasks',  category: 'Organization', unit: 'AI request' },
};

export const METERED_ACTIONS: MeteredAction[] = [
  'ai_chat', 'generate_exam', 'generate_flashcards', 'editor_ai_assist', 'activities_breakdown',
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

/* ── Internal helpers ──────────────────────────────────────────────── */

const LS_KEY = (userId: string) => `notez_credits_v3_${userId}`;

export function createFreshSummary(tier: PlanTier, userId: string): UserCreditsSummary {
  const plan = PLANS[tier];
  const now = new Date();
  const periodEnd = new Date(now.getTime() + plan.resetDays * 86400000);
  return {
    balance: plan.creditAllowance,
    allowance: plan.creditAllowance,
    usedThisPeriod: 0,
    tier,
    resetDays: plan.resetDays,
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    transactions: [{
      id: `init-${Date.now()}`,
      user_id: userId,
      amount: plan.creditAllowance,
      action: 'credit_refill',
      description: `Monthly AI allowance (${plan.name} plan)`,
      status: 'success',
      balance_after: plan.creditAllowance,
      created_at: now.toISOString(),
    }],
  };
}

/** Check and auto-reset if the period expired, returns updated summary. */
function maybeReset(summary: UserCreditsSummary, userId: string): UserCreditsSummary {
  if (new Date(summary.periodEnd) <= new Date()) {
    return createFreshSummary(summary.tier ?? 'free', userId);
  }
  return summary;
}

/** Read from localStorage cache. */
function readLocal(userId: string): UserCreditsSummary | null {
  try {
    const raw = localStorage.getItem(LS_KEY(userId));
    if (!raw) return null;
    return maybeReset(JSON.parse(raw) as UserCreditsSummary, userId);
  } catch { return null; }
}

/** Write to localStorage cache (keep last 50 transactions). */
function writeLocal(userId: string, summary: UserCreditsSummary): void {
  try {
    localStorage.setItem(LS_KEY(userId), JSON.stringify({
      ...summary,
      transactions: summary.transactions.slice(0, 50),
    }));
  } catch {}
}

/** Fetch the same server ledger used by the AI Edge Functions. */
async function readCloud(userId: string): Promise<UserCreditsSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_credits_summary', { p_user_id: userId });
    if (error || !data) return null;

    const raw = data as unknown as Record<string, unknown>;
    const tier = (raw.tier as PlanTier) in PLANS ? raw.tier as PlanTier : 'free';
    const periodStart = String(raw.period_start || new Date().toISOString());
    const periodEnd = String(raw.period_end || new Date(Date.now() + 30 * 86400000).toISOString());
    const transactions = Array.isArray(raw.transactions) ? raw.transactions as CreditTransaction[] : [];
    return {
      balance: Number(raw.balance ?? getPlanAllowance(tier)),
      allowance: Number(raw.allowance ?? getPlanAllowance(tier)),
      usedThisPeriod: Number(raw.used_this_period ?? 0),
      tier,
      resetDays: Math.max(1, Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000)),
      periodStart,
      periodEnd,
      transactions,
    };
  } catch { return null; }
}

/* ── Public API ────────────────────────────────────────────────────── */

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
 * Load credit summary for a signed-in user.
 * Supabase is always the source of truth — cloud data always wins. A local
 * cache is used only when the summary RPC is temporarily unavailable.
 */
export async function fetchUserCreditsSummary(userId: string): Promise<UserCreditsSummary> {
  // Cloud is unconditionally the source of truth
  const cloud = await readCloud(userId);

  if (cloud) {
    // Sync down to localStorage cache so next synchronous read is current
    writeLocal(userId, cloud);
    return cloud;
  }

  // The RPC normally creates a new row through ensure_user_credits(). Do not
  // write the old client-owned notez_user_credits table as a fallback: that
  // table is not the ledger used by the Edge Functions.
  const local = readLocal(userId) ?? createFreshSummary('free', userId);
  writeLocal(userId, local);
  return local;
}

export interface CreditLimitDetails {
  code: CreditErrorCode;
  action?: MeteredAction;
  balance?: number;
  required?: number;
  resetDate?: string;
  tier?: PlanTier;
  message?: string;
}

export class CreditLimitError extends Error {
  readonly details: CreditLimitDetails;

  constructor(details: CreditLimitDetails) {
    super(details.message || 'Monthly AI allowance reached.');
    this.name = 'CreditLimitError';
    this.details = details;
  }
}

export const CREDIT_LIMIT_EVENT = 'notez:credit-limit';
export const CREDITS_UPDATED_EVENT = 'notez:credits-updated';

/** Read a structured 402 response returned by supabase.functions.invoke(). */
export async function getCreditLimitDetails(error: unknown): Promise<CreditLimitDetails | null> {
  const candidate = error as { context?: unknown; error?: unknown; code?: unknown; action?: unknown } | null;
  let payload: Record<string, unknown> | null = null;

  if (candidate?.context instanceof Response) {
    try {
      payload = await candidate.context.clone().json() as Record<string, unknown>;
    } catch { /* not a JSON function response */ }
  }

  if (!payload && candidate && typeof candidate.error === 'object' && candidate.error !== null) {
    payload = candidate.error as Record<string, unknown>;
  }
  if (!payload && candidate && typeof candidate.code === 'string') {
    payload = candidate as unknown as Record<string, unknown>;
  }

  const code = String(payload?.error || payload?.code || candidate?.code || '');
  if (!['INSUFFICIENT_CREDITS', 'MONTHLY_LIMIT_REACHED'].includes(code)) return null;

  const action = String(payload?.action || candidate?.action || '') as MeteredAction;
  const tier = String(payload?.tier || '') as PlanTier;
  return {
    code: code as CreditErrorCode,
    action: action in ACTION_METADATA ? action : undefined,
    balance: typeof payload?.balance === 'number' ? payload.balance : undefined,
    required: typeof payload?.required === 'number' ? payload.required : 1,
    resetDate: typeof payload?.resetDate === 'string' ? payload.resetDate : typeof payload?.reset_date === 'string' ? payload.reset_date : undefined,
    tier: tier in PLANS ? tier : undefined,
    message: typeof payload?.message === 'string' ? payload.message : undefined,
  };
}

/** Open the global limit dialog without coupling feature services to React. */
export function notifyCreditLimit(details: CreditLimitDetails): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CREDIT_LIMIT_EVENT, { detail: details }));
  }
}

/** Refresh the display cache after an Edge Function has charged/refunded. */
export async function syncCreditsAfterRequest(userId?: string): Promise<void> {
  if (!userId) return;
  await fetchUserCreditsSummary(userId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDITS_UPDATED_EVENT));
  }
}

/** Convert a Supabase function limit response into the global dialog event. */
export async function reportCreditFunctionError(error: unknown): Promise<CreditLimitDetails | null> {
  const details = await getCreditLimitDetails(error);
  if (details) notifyCreditLimit(details);
  return details;
}

export function getPerFeatureUsage(
  transactions: CreditTransaction[],
): Record<MeteredAction, { credits: number; count: number }> {
  const result = Object.fromEntries(METERED_ACTIONS.map(a => [a, { credits: 0, count: 0 }])) as Record<MeteredAction, { credits: number; count: number }>;
  for (const tx of transactions) {
    if (tx.amount < 0 && tx.status === 'success' && tx.action in result) {
      result[tx.action as MeteredAction].credits += Math.abs(tx.amount);
      result[tx.action as MeteredAction].count += 1;
    }
  }
  return result;
}
