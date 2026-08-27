import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useCredits } from '@/contexts/CreditsContext';
import {
  PLANS,
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
  const resetDateStr = new Date(periodEnd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const effectiveAllowance = allowance || currentPlan.creditAllowance || 50;
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
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-5 space-y-4">
      {/* Top Header */}
      <div className="border-b border-border/40 pb-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Account Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your personal profile, AI credits, security credentials, and preferences.
          </p>
        </div>
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
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
      <div>
        {/* ══════════════════════════════════════════════════════════════
            TAB 1: PROFILE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-1"
          >
            {/* Identity Column (Left) */}
            <div className="md:col-span-5 p-5 rounded-2xl border border-border/70 bg-card/60 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center text-xl font-bold font-mono text-foreground shrink-0 shadow-xs">
                  {displayName ? displayName[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter name"
                        className="bg-secondary/70 border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none focus:border-primary flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={saveName}
                        disabled={savingName}
                        className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                      >
                        <Save className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-foreground truncate">
                        {displayName || 'No display name'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit name"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-[11px] font-medium text-foreground">
                  <Zap className="h-3 w-3 text-primary" />
                  {currentPlan.name} Plan
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-[11px] font-medium text-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Verified Account
                </span>
              </div>
            </div>

            {/* Account Details Table (Right) */}
            <div className="md:col-span-7 p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Account Details
              </h3>

              <div className="divide-y divide-border/40 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-medium text-foreground">{displayName || 'Not set'}</span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-mono text-foreground">{user?.email}</span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Current Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{currentPlan.name}</span>
                    <Link
                      to="/pricing"
                      className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                    >
                      {tier === 'free' ? 'Upgrade' : 'Change Plan'}
                    </Link>
                  </div>
                </div>

                <div className="py-2.5 flex items-center justify-between">
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
            TAB 2: CREDITS & USAGE (Desktop 2-Column Zero-Scroll Layout)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'credits' && (
          <motion.div
            key="credits"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1"
          >
            {/* Left Column: Balance Summary + Progress + 5 Feature Cards (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Balance & Plan Banner */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                      Available Balance
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshCredits()}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md hover:bg-secondary"
                      title="Refresh"
                    >
                      <RefreshCw className={`h-3 w-3 ${creditsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground">
                      {balance.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">/ {effectiveAllowance.toLocaleString()} credits</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {currentPlan.name} plan • Refills on {resetDateStr}
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                  <Link
                    to="/pricing"
                    className="h-8 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/90 transition-all shadow-xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View Plans
                  </Link>
                </div>
              </div>

              {/* Cycle Usage Progress Bar */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Monthly Usage
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {usedThisPeriod.toLocaleString()} used ({usagePercentage}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>

              {/* 5 Distinct Feature Cards Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Usage by Feature Section
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {METERED_ACTIONS.map((actionKey) => {
                    const meta = ACTION_METADATA[actionKey];
                    const Icon = ACTION_ICONS[actionKey] || Sparkles;
                    const stats = perFeatureUsage[actionKey] || { credits: 0, count: 0 };
                    const featurePercent = usedThisPeriod > 0
                      ? Math.min(100, Math.round((stats.count / usedThisPeriod) * 100))
                      : 0;

                    return (
                      <div
                        key={actionKey}
                        className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0">
                            <Icon className="h-3 w-3 text-primary" />
                          </div>
                          <p className="text-[11px] font-bold text-foreground truncate">{meta.label}</p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="font-mono font-bold text-foreground">{stats.count} {stats.count === 1 ? 'request' : 'requests'}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{stats.credits} {stats.credits === 1 ? 'credit' : 'credits'} used</span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
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
            </div>

            {/* Right Column: Recent Activity Ledger (5 Cols with self-contained scroll) */}
            <div className="lg:col-span-5 p-4 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Recent Activity
                </h3>
                <span className="text-[10.5px] font-mono text-muted-foreground">
                  {transactions.length} events
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No credit transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-border/40 max-h-[340px] overflow-y-auto pr-1">
                  {transactions.map((tx) => {
                    const isDeduction = tx.amount < 0;
                    const dateFormatted = new Date(tx.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={tx.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-foreground truncate text-[11px]">
                            {tx.description || tx.action}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {dateFormatted}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-bold text-[11px] ${
                              isDeduction
                                ? 'text-foreground'
                                : tx.status === 'refunded'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground block font-mono">
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
            TAB 3: SECURITY (Desktop 2-Column Zero-Scroll Layout)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start pt-1"
          >
            {/* Left Column: Change Password */}
            <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Change Password
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update your password to keep your study notes and account secure.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Confirm New Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={savePassword}
                  disabled={savingPw || !newPw || !confirmPw}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer mt-1"
                >
                  <Lock className="h-3 w-3" />
                  <span>{savingPw ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Sessions + Danger Zone */}
            <div className="space-y-4">
              {/* Active Sessions */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Active Session
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Sign out of your current study session on this device.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs text-foreground font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogOut className="h-3 w-3" />
                  Sign Out
                </button>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 space-y-2.5">
                <div>
                  <h3 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Danger Zone: Delete Account
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Permanently delete your profile, notes, exams, and credit history. This action cannot be reversed.
                  </p>
                </div>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-background/80 space-y-2">
                    <p className="text-[11px] text-foreground font-medium">
                      Type (<span className="font-mono font-bold text-destructive">{user?.email}</span>) to confirm:
                    </p>

                    <input
                      type="email"
                      value={deleteEmailInput}
                      onChange={(e) => setDeleteEmailInput(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full bg-background border border-destructive/40 rounded-md px-2.5 py-1 text-xs text-foreground outline-none focus:border-destructive"
                    />

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={deleteAccount}
                        disabled={deleting || deleteEmailInput.trim().toLowerCase() !== user?.email?.toLowerCase()}
                        className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-[11px] font-bold hover:bg-destructive/90 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {deleting ? 'Deleting...' : 'Permanently Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteEmailInput('');
                        }}
                        className="px-2.5 py-1 rounded-md hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 4: PREFERENCES (Desktop 2-Column Zero-Scroll Layout)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start pt-1"
          >
            {/* Appearance Theme (Left Column) */}
            <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Appearance Theme
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your interface theme for reading and studying.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Light */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    toast({ title: 'Theme set to Light' });
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    activeTheme === 'light' || activeTheme === 'warm-paper'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Sun className={`h-4 w-4 ${activeTheme === 'light' || activeTheme === 'warm-paper' ? 'text-primary' : 'text-muted-foreground'}`} />
                    {(activeTheme === 'light' || activeTheme === 'warm-paper') && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Light</p>
                    <p className="text-[10.5px] text-muted-foreground">Crisp clean light mode</p>
                  </div>
                </button>

                {/* Dark */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    toast({ title: 'Theme set to Dark' });
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    activeTheme === 'dark' || activeTheme === 'midnight'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Moon className={`h-4 w-4 ${activeTheme === 'dark' || activeTheme === 'midnight' ? 'text-primary' : 'text-muted-foreground'}`} />
                    {(activeTheme === 'dark' || activeTheme === 'midnight') && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Dark</p>
                    <p className="text-[10.5px] text-muted-foreground">Focused dark mode</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Language (Right Column) */}
            <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Language
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your preferred language for study prompts and interface.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {LANGUAGES.map((lang) => {
                  const isCurrent = (i18n.language || 'en').startsWith(lang.code);

                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        localStorage.setItem('notez_lang', lang.code);
                        toast({ title: `Language updated to ${lang.label}` });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-secondary/30 hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{lang.flag}</span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{lang.label}</p>
                          <p className="text-[10px] text-muted-foreground">{lang.region}</p>
                        </div>
                      </div>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
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
