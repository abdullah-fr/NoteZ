import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useCredits } from '@/contexts/CreditsContext';
import { PLANS } from '@/lib/credits';
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
} from 'lucide-react';

type Tab = 'profile' | 'credits' | 'security' | 'preferences';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', region: 'Global' },
  { code: 'es', label: 'Español', flag: '🇪🇸', region: 'Spain / LatAm' },
];

export default function AccountView() {
  const { user, signOut } = useAuth();
  const {
    balance,
    monthlyAllowance,
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
  const usagePercentage = Math.min(100, Math.round((usedThisPeriod / Math.max(1, monthlyAllowance)) * 100));

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
    if (deleteEmailInput !== user?.email) {
      toast({ title: 'Email does not match', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      toast({ title: 'Account deleted', description: 'Your account and study data have been permanently deleted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete your account. Please try again.';
      toast({ title: 'Account deletion failed', description: message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  const tabLabels: Record<Tab, string> = {
    profile: 'Profile',
    credits: 'Credits & Usage',
    security: 'Security',
    preferences: 'Preferences',
  };

  const initials = (displayName || user?.email || '?')
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 space-y-8">
      {/* ── Top Navigation & Header Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Account Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your personal profile, subscription credits, and security settings.
          </p>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex items-center gap-1 sm:gap-2 flex-wrap" aria-label="Account Settings Tabs">
          {(['profile', 'credits', 'security', 'preferences'] as Tab[]).map((t) => {
            const isActive = activeTab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer relative ${
                  isActive
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                {tabLabels[t]}
                {isActive && (
                  <motion.div
                    layoutId="activeAccountTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Active Tab Content ── */}
      <AnimatePresence mode="wait">
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
            {/* User Identity Header */}
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center shrink-0 shadow-xs">
                <span className="text-2xl font-bold font-mono text-foreground">{initials}</span>
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      placeholder="Enter full name"
                      className="flex-1 bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-base font-semibold text-foreground outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={saveName}
                      disabled={savingName}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
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

              <div className="divide-y divide-border/40 border-t border-b border-border/40">
                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-medium text-foreground">{displayName || 'Not specified'}</span>
                </div>

                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Primary Email</span>
                  <span className="font-mono text-foreground">{user?.email}</span>
                </div>

                <div className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Current Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{currentPlan.name}</span>
                    <Link
                      to="/pricing"
                      className="text-primary hover:underline text-xs font-bold"
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
                      : 'Unknown'}
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
                  {monthlyAllowance.toLocaleString()} credits / 30-day cycle
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

            {/* Monthly Cycle Usage Meter */}
            <div className="space-y-3 border-b border-border/40 pb-8">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Cycle Usage Progress
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {usedThisPeriod.toLocaleString()} / {monthlyAllowance.toLocaleString()} credits used ({usagePercentage}%)
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
                <span>Refills every 30 days</span>
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                {newPw && confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={savePassword}
                    disabled={!newPw || !confirmPw || newPw !== confirmPw || savingPw}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>{savingPw ? 'Updating…' : 'Update Password'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Active Session & Sign Out */}
            <div className="border-t border-border/40 pt-8 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Active Session
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign out of your NoteZ studio account on this device.
                </p>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs font-semibold text-foreground transition-colors flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Delete Account (Danger Zone) — Moved to Security as requested */}
            <div className="border-t border-border/40 pt-8 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Once you delete your account, it cannot be restored. All your study notes, exams, and flashcards will be permanently removed.
                  </p>
                </div>

                {!showDeleteConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-center shrink-0"
                  >
                    Delete Account
                  </button>
                )}
              </div>

              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3 max-w-lg mt-3"
                >
                  <p className="text-xs text-destructive font-medium">
                    Type your email (<span className="font-mono font-bold">{user?.email}</span>) to permanently confirm:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={deleteEmailInput}
                      onChange={(e) => setDeleteEmailInput(e.target.value)}
                      placeholder={user?.email}
                      className="flex-1 bg-background border border-destructive/30 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-destructive"
                    />
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deleteEmailInput !== user?.email || deleting}
                      className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {deleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteEmailInput('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
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
            className="space-y-8 max-w-xl"
          >
            {/* Theme Preference */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Theme Appearance
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose your interface theme. Your preference syncs across your devices.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Light Mode */}
                <button
                  type="button"
                  onClick={() => setTheme('warm-paper')}
                  disabled={themeSaving}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    activeTheme === 'warm-paper'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border bg-secondary/30 hover:border-border/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">Light</p>
                    <p className="text-[10.5px] text-muted-foreground">Warm Paper</p>
                  </div>
                  {activeTheme === 'warm-paper' && (
                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>

                {/* Dark Mode */}
                <button
                  type="button"
                  onClick={() => setTheme('midnight')}
                  disabled={themeSaving}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    activeTheme === 'midnight'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border bg-secondary/30 hover:border-border/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Moon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">Dark</p>
                    <p className="text-[10.5px] text-muted-foreground">Midnight</p>
                  </div>
                  {activeTheme === 'midnight' && (
                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Language Preference */}
            <div className="border-t border-border/40 pt-6 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Language & Region
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your preferred display language for NoteZ Studio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {LANGUAGES.map((lang) => {
                  const active = i18n.language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        toast({ title: `Language set to ${lang.label}` });
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border bg-secondary/30 hover:border-border/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{lang.flag}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{lang.label}</p>
                          <p className="text-[10px] text-muted-foreground">{lang.region}</p>
                        </div>
                      </div>
                      {active && (
                        <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
