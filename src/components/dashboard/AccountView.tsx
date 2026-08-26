import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useCredits } from '@/contexts/CreditsContext';
import {
  PLANS,
  CREDIT_COSTS,
  ACTION_METADATA,
  METERED_ACTIONS,
  getPerFeatureUsage,
  type MeteredAction,
} from '@/lib/credits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  User, Lock, LogOut, Trash2,
  Save, Eye, EyeOff, Shield, Globe, Check,
  Zap, Clock, Sparkles, RefreshCw, Sun, Moon,
  ShieldCheck, ArrowUpRight, Edit3, X,
  MessageSquare, GraduationCap, Layers, FileText, ListChecks,
} from 'lucide-react';

type Tab = 'profile' | 'credits' | 'security' | 'preferences';

const ACTION_ICONS: Record<MeteredAction, any> = {
  ai_chat: MessageSquare,
  generate_exam: GraduationCap,
  generate_flashcards: Layers,
  editor_ai_assist: FileText,
  activities_breakdown: ListChecks,
};

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', region: 'Global' },
  { code: 'es', label: 'Español', flag: '🇪🇸', region: 'Spain / LatAm' },
];

export default function AccountView() {
  const { user, signOut } = useAuth();
  const {
    balance,
    allowance,
    usedThisPeriod,
    tier,
    periodEnd,
    transactions,
    refreshCredits,
    loading: creditsLoading,
  } = useCredits();
  const { i18n } = useTranslation();
  const { theme: activeTheme, setTheme, saving: themeSaving } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const currentPlan = PLANS[tier] || PLANS.free;
  const isFree = tier === 'free';
  const resetDateStr = new Date(periodEnd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const effectiveAllowance = allowance || currentPlan.creditAllowance || 150;
  const usagePercentage = Math.min(100, Math.round((usedThisPeriod / Math.max(1, effectiveAllowance)) * 100));

  const perFeatureUsage = getPerFeatureUsage(transactions);

  /* ── display name editing ── */
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  /* ── password ── */
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  /* ── delete account ── */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function saveName() {
    if (!displayName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
    setSavingName(false);
    if (error) {
      toast({ title: 'Error updating name', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Name updated successfully' });
      setIsEditingName(false);
    }
  }

  async function savePassword() {
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password updated successfully' });
      setNewPw('');
      setConfirmPw('');
    }
  }

  async function deleteAccount() {
    if (deleteEmailInput.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      toast({ title: 'Email does not match', description: 'Please enter your exact email to confirm deletion.', variant: 'destructive' });
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { userId: user?.id },
      });
      if (error) throw error;
      toast({ title: 'Account deleted', description: 'Your account and data have been removed.' });
      await signOut();
    } catch (err: any) {
      toast({ title: 'Could not delete account', description: err.message || 'Please contact support.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'credits', label: 'Credits & Usage', icon: Zap },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Header */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Account Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal profile, AI credits, security credentials, and preferences.
        </p>
      </div>

      {/* Modern Clean Tab Navigation Bar */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-border/40 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Area */}
      <div className="pt-2">
        {/* ══════════════════════════════════════════════════════════════
            TAB 1: PROFILE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-8 max-w-3xl"
          >
            {/* Identity Card Area */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar Initial Box */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-secondary border border-border flex items-center justify-center text-xl sm:text-2xl font-bold font-mono text-foreground shrink-0 shadow-xs">
                {displayName ? displayName[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
              </div>

              {/* Identity Info */}
              <div className="space-y-1.5 flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={saveName}
                      disabled={savingName}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                      {displayName || 'No display name'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="px-2.5 py-1 rounded-md border border-border/80 bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                )}

                <p className="text-sm text-muted-foreground font-mono">
                  {user?.email}
                </p>

                {/* Status Badges */}
                <div className="flex items-center gap-2 pt-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/70 border border-border text-xs font-medium text-foreground">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {currentPlan.name} Plan
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/70 border border-border text-xs font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Information List */}
            <div className="border-t border-border/40 pt-6 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Account Details
              </h3>

              <div className="divide-y divide-border/40">
                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-medium text-foreground">{displayName || 'Not set'}</span>
                </div>

                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-mono text-foreground">{user?.email}</span>
                </div>

                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Current Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{currentPlan.name}</span>
                    <Link
                      to="/pricing"
                      className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      {tier === 'free' ? 'Upgrade' : 'Change Plan'}
                    </Link>
                  </div>
                </div>

                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="text-foreground">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Active User'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: CREDITS & USAGE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'credits' && (
          <motion.div
            key="credits"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-8"
          >
            {/* Top Balance Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-border/40 pb-8">
              {/* Available Credits */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Available Balance
                  </span>
                  <button
                    type="button"
                    onClick={() => refreshCredits()}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${creditsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-mono font-bold text-foreground">
                    {balance.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Refills on {resetDateStr}
                </p>
              </div>

              {/* Current Plan */}
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Subscription Plan
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {currentPlan.name}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {effectiveAllowance.toLocaleString()} credits / {isFree ? 'week' : 'month'}
                </p>
              </div>

              {/* Plan Actions */}
              <div className="flex flex-col justify-end gap-2">
                <Link
                  to="/pricing"
                  className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-all shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
                <Link
                  to="/pricing"
                  className="text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Credit Cost Reference Guide
                </Link>
              </div>
            </div>

            {/* Cycle Usage Meter */}
            <div className="space-y-3 border-b border-border/40 pb-8">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {isFree ? 'Weekly' : 'Monthly'} Cycle Usage Progress
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {usedThisPeriod.toLocaleString()} / {effectiveAllowance.toLocaleString()} credits used ({usagePercentage}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{balance.toLocaleString()} credits remaining</span>
                <span>Refills every {isFree ? '7 days' : '30 days'}</span>
              </div>
            </div>

            {/* Distinct Per-Feature Usage Breakdown */}
            <div className="space-y-4 border-b border-border/40 pb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Usage by Feature Section
                </h3>
                <span className="text-xs font-mono text-muted-foreground">
                  Current {isFree ? 'week' : 'billing cycle'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {METERED_ACTIONS.map((actionKey) => {
                  const meta = ACTION_METADATA[actionKey];
                  const cost = CREDIT_COSTS[actionKey];
                  const Icon = ACTION_ICONS[actionKey] || Sparkles;
                  const stats = perFeatureUsage[actionKey] || { credits: 0, count: 0 };
                  const featurePercent = usedThisPeriod > 0
                    ? Math.min(100, Math.round((stats.credits / usedThisPeriod) * 100))
                    : 0;

                  return (
                    <div
                      key={actionKey}
                      className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{meta.label}</p>
                            <p className="text-[10.5px] text-muted-foreground font-mono">{cost} credits / action</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-foreground">
                            {stats.credits} credits
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {stats.count} {stats.count === 1 ? 'use' : 'uses'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary/80 rounded-full transition-all duration-500"
                            style={{ width: `${featurePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Usage History Ledger */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Recent Credit Activity
                </h3>
                <span className="text-xs font-mono text-muted-foreground">
                  Last {transactions.length} operations
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No credit transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-border/40 border-t border-b border-border/40">
                  {transactions.map((tx) => {
                    const isDeduction = tx.amount < 0;
                    const dateFormatted = new Date(tx.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-4">
                          <p className="font-medium text-foreground truncate">
                            {tx.description || tx.action}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {dateFormatted}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isDeduction
                                ? 'text-foreground'
                                : tx.status === 'refunded'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground block font-mono">
                            {tx.balance_after} left
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 3: SECURITY
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-10 max-w-2xl"
          >
            {/* Password Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Change Password
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update your password to keep your study notes and account secure.
                </p>
              </div>

              <div className="space-y-3 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm New Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={savePassword}
                  disabled={savingPw || !newPw || !confirmPw}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{savingPw ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </div>

            {/* Session Management */}
            <div className="border-t border-border/40 pt-8 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Active Sessions
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign out of your active workspace session on this device.
                </p>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="px-4 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs text-foreground font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="border-t border-destructive/20 pt-8 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Danger Zone: Delete Account
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Permanently remove your profile, study notes, flashcards, exams, and credit history. This action cannot be reversed.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3 max-w-md">
                  <p className="text-xs text-foreground font-medium">
                    Type your email (<span className="font-mono font-bold text-destructive">{user?.email}</span>) to confirm:
                  </p>

                  <input
                    type="email"
                    value={deleteEmailInput}
                    onChange={(e) => setDeleteEmailInput(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-background border border-destructive/40 rounded-lg px-3.5 py-2 text-xs text-foreground outline-none focus:border-destructive"
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deleting || deleteEmailInput.trim().toLowerCase() !== user?.email?.toLowerCase()}
                      className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {deleting ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteEmailInput('');
                      }}
                      className="px-3 py-2 rounded-lg hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 4: PREFERENCES
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-8 max-w-2xl"
          >
            {/* Theme Selector */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Appearance Theme
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your interface theme for reading and studying.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md">
                {/* Light */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    activeTheme === 'light'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Sun className={`h-5 w-5 ${activeTheme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                    {activeTheme === 'light' && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Light</p>
                    <p className="text-xs text-muted-foreground">Crisp clean light mode</p>
                  </div>
                </button>

                {/* Dark */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    activeTheme === 'dark'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Moon className={`h-5 w-5 ${activeTheme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                    {activeTheme === 'dark' && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Dark</p>
                    <p className="text-xs text-muted-foreground">Focused dark mode</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Language Selector */}
            <div className="border-t border-border/40 pt-8 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Language
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your preferred language for study prompts and system interface.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                {LANGUAGES.map((lang) => {
                  const isCurrent = i18n.language.startsWith(lang.code);

                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => i18n.changeLanguage(lang.code)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-secondary/30 hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{lang.flag}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{lang.label}</p>
                          <p className="text-[10px] text-muted-foreground">{lang.region}</p>
                        </div>
                      </div>
                      {isCurrent && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
