import type { PlanTier } from '@/lib/credits';

export const PAID_PLAN_CONFIG = {
  pro_monthly: { tier: 'pro_student', interval: 'monthly' },
  pro_yearly: { tier: 'pro_student', interval: 'yearly' },
  max_monthly: { tier: 'pro_scholar', interval: 'monthly' },
  max_yearly: { tier: 'pro_scholar', interval: 'yearly' },
} as const;

export type PaidPlan = keyof typeof PAID_PLAN_CONFIG;

export const ANNUAL_TOTALS: Record<'pro_student' | 'pro_scholar', number> = {
  pro_student: 72,
  pro_scholar: 180,
};

export function isPaidPlan(value: string | null): value is PaidPlan {
  return value !== null && Object.prototype.hasOwnProperty.call(PAID_PLAN_CONFIG, value);
}

export function getPaidPlan(tier: PlanTier, yearly: boolean): PaidPlan | null {
  if (tier === 'pro_student') return yearly ? 'pro_yearly' : 'pro_monthly';
  if (tier === 'pro_scholar') return yearly ? 'max_yearly' : 'max_monthly';
  return null;
}

