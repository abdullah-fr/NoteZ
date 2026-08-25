/**
 * Centralized Credits, Plans & Usage Configuration for NoteZ
 *
 * Single Source of Truth for:
 * - Plan definitions, prices, monthly allowances, and benefits
 * - Credit costs per metered action
 * - Metadata and human-friendly labels for credit transactions
 * - Error codes and deduction / refund utilities
 */

import { supabase } from '@/integrations/supabase/client';

export type PlanTier = 'free' | 'pro_student' | 'pro_scholar' | 'team';

export type MeteredAction =
  | 'ai_chat'
  | 'ai_audio_transcription'
  | 'generate_exam'
  | 'generate_flashcards'
  | 'editor_ai_assist'
  | 'activities_breakdown'
  | 'source_processing'
  | 'coach_advice';

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyCredits: number;
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
    monthlyCredits: 500,
    features: [
      '500 monthly AI credits (refilled every month)',
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
    monthlyCredits: 5000,
    highlighted: true,
    badge: 'Most Popular',
    features: [
      '5,000 monthly AI credits (10× Free allowance)',
      'Unlimited subjects, folders & categories',
      'Priority AI response generation',
      'Unlimited exam generations & mock simulations',
      'Advanced study analytics & coach insights',
      'Priority voice audio transcription',
    ],
  },
  pro_scholar: {
    id: 'pro_scholar',
    name: 'Pro Scholar',
    tagline: 'For researchers, grad students & heavy power users.',
    monthlyPrice: 18,
    yearlyPrice: 14,
    monthlyCredits: 15000,
    features: [
      '15,000 monthly AI credits (30× Free allowance)',
      'Everything in Pro Student',
      'Multi-source document synthesis & batch AI',
      'Citation export (BibTeX, APA, MLA, Chicago)',
      'Long-context research conversations',
      'Early access to new experimental AI models',
    ],
  },
  team: {
    id: 'team',
    name: 'Team / Campus',
    tagline: 'For study groups, research labs & classrooms.',
    monthlyPrice: 35,
    yearlyPrice: 28,
    monthlyCredits: 50000,
    features: [
      '50,000 shared monthly AI credits',
      'Collaborative decks & shared class hubs',
      'Admin usage analytics & seat management',
      'Dedicated support & campus integrations',
    ],
  },
};

/** Exact credit cost per individual action */
export const CREDIT_COSTS: Record<MeteredAction, number> = {
  ai_chat: 5,
  ai_audio_transcription: 10,
  generate_exam: 25,
  generate_flashcards: 20,
  editor_ai_assist: 5,
  activities_breakdown: 20,
  source_processing: 25,
  coach_advice: 5,
};

export interface ActionMeta {
  label: string;
  shortDesc: string;
  category: 'AI Assistant' | 'Practice' | 'Editor' | 'Organization' | 'Analytics';
  unit: string;
}

export const ACTION_METADATA: Record<MeteredAction, ActionMeta> = {
  ai_chat: {
    label: 'AI Chat Message',
    shortDesc: 'Ask NoteZ AI study assistant or research question',
    category: 'AI Assistant',
    unit: '5 credits / message',
  },
  ai_audio_transcription: {
    label: 'Audio Voice Transcribe',
    shortDesc: 'Convert spoken question to text via Gemini',
    category: 'AI Assistant',
    unit: '10 credits / voice note',
  },
  generate_exam: {
    label: 'Generate Practice Exam',
    shortDesc: 'Adaptive multiple-choice exam with step-by-step solutions',
    category: 'Practice',
    unit: '25 credits / exam suite',
  },
  generate_flashcards: {
    label: 'Generate Flashcards',
    shortDesc: 'Smart spaced-repetition Q&A flashcards from notes',
    category: 'Practice',
    unit: '20 credits / card deck',
  },
  editor_ai_assist: {
    label: 'Editor AI Assist',
    shortDesc: 'Improve, rephrase, explain or summarize highlighted text',
    category: 'Editor',
    unit: '5 credits / action',
  },
  activities_breakdown: {
    label: 'Syllabus Breakdown',
    shortDesc: 'Parse course syllabus into structured semester tasks',
    category: 'Organization',
    unit: '20 credits / document',
  },
  source_processing: {
    label: 'Document Source Process',
    shortDesc: 'Extract and summarize PDF, DOCX, or URL study materials',
    category: 'Organization',
    unit: '25 credits / document',
  },
  coach_advice: {
    label: 'Study Coach Guidance',
    shortDesc: 'AI mentor recommendations & learning curve analysis',
    category: 'Analytics',
    unit: '5 credits / analysis',
  },
};

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
  monthlyAllowance: number;
  usedThisPeriod: number;
  tier: PlanTier;
  periodStart: string;
  periodEnd: string;
  transactions: CreditTransaction[];
}

const LOCAL_STORAGE_CREDITS_KEY = 'notez_local_credits_v1';

function getLocalCredits(): UserCreditsSummary {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CREDITS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const initial: UserCreditsSummary = {
    balance: 500,
    monthlyAllowance: 500,
    usedThisPeriod: 0,
    tier: 'free',
    periodStart: now.toISOString(),
    periodEnd: nextMonth.toISOString(),
    transactions: [
      {
        id: 'local-init',
        user_id: 'guest',
        amount: 500,
        action: 'initial_grant',
        description: 'Welcome to NoteZ (Free Tier Allowance)',
        status: 'success',
        balance_after: 500,
        created_at: now.toISOString(),
      },
    ],
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_CREDITS_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveLocalCredits(summary: UserCreditsSummary) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CREDITS_KEY, JSON.stringify(summary));
  } catch {}
}

/**
 * Fetch credit summary for user (with robust local fallback for guests/offline)
 */
export async function fetchUserCreditsSummary(userId?: string | null): Promise<UserCreditsSummary> {
  if (!userId) {
    return getLocalCredits();
  }

  try {
    const { data, error } = await supabase.rpc('get_user_credits_summary', {
      p_user_id: userId,
    });

    if (error || !data) {
      console.warn('[credits] RPC get_user_credits_summary unavailable, using fallback:', error?.message);
      return getLocalCredits();
    }

    return {
      balance: data.balance ?? 500,
      monthlyAllowance: data.monthly_allowance ?? 500,
      usedThisPeriod: data.used_this_period ?? 0,
      tier: (data.tier as PlanTier) ?? 'free',
      periodStart: data.period_start ?? new Date().toISOString(),
      periodEnd: data.period_end ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactions: (data.transactions ?? []) as CreditTransaction[],
    };
  } catch (err) {
    console.warn('[credits] Failed to fetch credits summary:', err);
    return getLocalCredits();
  }
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
 * Check and deduct credits for an action atomically.
 */
export async function checkAndDeductCredits(
  userId: string | null | undefined,
  action: MeteredAction,
  customAmount?: number,
  description?: string,
  metadata?: Record<string, any>,
): Promise<DeductionResult> {
  const cost = customAmount ?? CREDIT_COSTS[action] ?? 5;
  const desc = description || ACTION_METADATA[action]?.label || action;

  if (!userId) {
    // Local fallback for guest
    const local = getLocalCredits();
    if (local.balance < cost) {
      return {
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
        resetDate: local.periodEnd,
        tier: local.tier,
      };
    }
    local.balance -= cost;
    local.usedThisPeriod += cost;
    local.transactions.unshift({
      id: `local-${Date.now()}`,
      user_id: 'guest',
      amount: -cost,
      action,
      description: desc,
      status: 'success',
      balance_after: local.balance,
      created_at: new Date().toISOString(),
    });
    saveLocalCredits(local);
    return {
      success: true,
      balanceAfter: local.balance,
      deducted: cost,
      resetDate: local.periodEnd,
    };
  }

  try {
    const { data, error } = await supabase.rpc('check_and_deduct_credits', {
      p_user_id: userId,
      p_amount: cost,
      p_action: action,
      p_description: desc,
      p_metadata: metadata ?? {},
    });

    if (error) {
      console.warn('[credits] check_and_deduct_credits RPC failed, falling back:', error.message);
      return { success: true, balanceAfter: 500, deducted: cost };
    }

    const res = data as any;
    if (res?.success) {
      return {
        success: true,
        balanceAfter: res.balance_after,
        deducted: res.deducted,
        resetDate: res.reset_date,
      };
    }

    return {
      success: false,
      code: (res?.code as CreditErrorCode) || 'INSUFFICIENT_CREDITS',
      required: res?.required || cost,
      resetDate: res?.reset_date,
      tier: res?.tier,
    };
  } catch (err) {
    console.warn('[credits] checkAndDeductCredits exception:', err);
    return { success: true, balanceAfter: 500, deducted: cost };
  }
}

/**
 * Refund credits if an operation fails after deduction.
 */
export async function refundCredits(
  userId: string | null | undefined,
  amount: number,
  action: MeteredAction,
  reason = 'API request failed',
  metadata?: Record<string, any>,
): Promise<void> {
  if (amount <= 0) return;

  if (!userId) {
    const local = getLocalCredits();
    local.balance += amount;
    local.usedThisPeriod = Math.max(0, local.usedThisPeriod - amount);
    local.transactions.unshift({
      id: `local-refund-${Date.now()}`,
      user_id: 'guest',
      amount,
      action: 'refund',
      description: `Refund: ${reason}`,
      status: 'refunded',
      balance_after: local.balance,
      created_at: new Date().toISOString(),
    });
    saveLocalCredits(local);
    return;
  }

  try {
    await supabase.rpc('refund_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_action: action,
      p_reason: reason,
      p_metadata: metadata ?? {},
    });
  } catch (err) {
    console.warn('[credits] Failed to refund credits:', err);
  }
}
