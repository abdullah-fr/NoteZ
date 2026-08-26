import { useState, type ComponentType, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useCredits } from '@/contexts/CreditsContext';
import { PLANS } from '@/lib/credits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTheme, type ThemeId } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  User, Mail, Lock, LogOut, Trash2,
  Save, Eye, EyeOff, Shield, AlertTriangle, Globe, Check,
  Zap, Clock, Sparkles, RefreshCw, Sun, Moon,
  ShieldCheck, ArrowUpRight,
} from 'lucide-react';

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

  const currentPlan = PLANS[tier] || PLANS.free;
  const resetDateStr = new Date(periodEnd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const usagePercentage = Math.min(100, Math.round((usedThisPeriod / Math.max(1, monthlyAllowance)) * 100));

  /* ── display name ── */
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? '');
  const [savingName, setSavingName]   = useState(false);

  /* ── password ── */
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [savingPw,  setSavingPw]  = useState(false);

  /* ── delete account ── */
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting,      setDeleting]      = useState(false);

  async function saveName() {
    if (!displayName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
    setSavingName(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Name updated successfully' });
  }

  async function savePassword() {
    if (newPw !== confirmPw) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    if (newPw.length < 8)   { toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Password updated' }); setNewPw(''); setConfirmPw(''); }
  }

  async function deleteAccount() {
    if (deleteConfirm !== user?.email) { toast({ title: 'Email does not match', variant: 'destructive' }); return; }
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      toast({ title: 'Account deleted', description: 'Your account and study data have been permanently deleted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete your account. Please try again.';
      toast({ title: 'Account deletion failed', description: message, variant: 'destructive' });
    } finally { setDeleting(false); }
  }

  const initials = (displayName || user?.email || '?')
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 px-2 sm:px-4">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <User className="h-6 w-6 text-primary shrink-0" />
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your profile, credits, subscription, preferences, and security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Pricing Plans</span>
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* ── Top Hero Identity Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-secondary border border-border/80 flex items-center justify-center shrink-0 shadow-xs">
            <span className="text-2xl font-bold font-mono text-foreground">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-foreground truncate">
                {displayName || 'No display name'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[10.5px] font-bold font-mono text-primary">
                {currentPlan.name} Plan
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
              {user?.email}
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-center shrink-0">
          <Link
            to="/pricing"
            className="flex-1 sm:flex-none h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-all shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}</span>
          </Link>
        </div>
      </motion.div>

      {/* ── Main Responsive 2-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══════════════════════════════════════════════════════════════
            LEFT COLUMN (Credits & Usage, Profile, Security) — 7 cols
        ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Credits & Usage Hub */}
          <Section title="Credits & Usage" icon={Zap}>
            <div className="space-y-4">
              {/* Top Balance & Plan Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Balance Card */}
                <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                      Available Credits
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshCredits()}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                      title="Refresh credit balance"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${creditsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono font-bold text-foreground">
                      {balance.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">credits</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground font-mono">
                    Allowance resets on {resetDateStr}
                  </p>
                </div>

                {/* Plan Card */}
                <div className="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                        Monthly Allowance
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-bold font-mono text-foreground">
                        {currentPlan.name}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-semibold mt-1">
                      {monthlyAllowance.toLocaleString()} credits / billing cycle
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      to="/pricing"
                      className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/90 transition-all shadow-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{tier === 'free' ? 'Upgrade' : 'Manage'}</span>
                    </Link>
                    <Link
                      to="/pricing"
                      className="px-3 h-8 rounded-lg border border-border/80 bg-secondary/70 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                    >
                      Rates
                    </Link>
                  </div>
                </div>
              </div>

              {/* Monthly Usage Progress Bar */}
              <div className="rounded-xl border border-border/70 bg-background/30 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Monthly Cycle Usage
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {usedThisPeriod.toLocaleString()} / {monthlyAllowance.toLocaleString()} ({usagePercentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10.5px] text-muted-foreground font-mono">
                  <span>Used: {usedThisPeriod.toLocaleString()} credits</span>
                  <span>Remaining: {balance.toLocaleString()} credits</span>
                </div>
              </div>

              {/* Usage History Ledger */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Recent Credit History
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    Last {transactions.length} operations
                  </span>
                </div>

                {transactions.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-background/20 p-4 text-center">
                    <p className="text-xs text-muted-foreground">No credit activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-background/30 divide-y divide-border/40 overflow-hidden max-h-52 overflow-y-auto">
                    {transactions.map(tx => {
                      const isDeduction = tx.amount < 0;
                      const dateFormatted = new Date(tx.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={tx.id}
                          className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-secondary/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-medium text-foreground truncate">
                              {tx.description || tx.action}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
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
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {tx.balance_after} left
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* 2. Profile Details */}
          <Section title="Profile Information" icon={User}>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Display name</label>
                <div className="flex gap-2">
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    placeholder="Your full name"
                    className={inputCls}
                  />
                  <ActionButton onClick={saveName} loading={savingName} icon={Save}>
                    Save
                  </ActionButton>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Email address</label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-[13px] text-muted-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-mono">{user?.email}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Email changes require re-authentication. Contact support if needed.
                </p>
              </div>
            </div>
          </Section>

          {/* 3. Security & Password */}
          <Section title="Security & Password" icon={Lock}>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={inputCls + ' pr-9'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Confirm new password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputCls}
                />
              </div>

              {newPw && confirmPw && newPw !== confirmPw && (
                <p className="text-[11px] text-destructive">Passwords do not match</p>
              )}

              <div className="pt-1">
                <ActionButton
                  onClick={savePassword}
                  loading={savingPw}
                  icon={Shield}
                  disabled={!newPw || !confirmPw || newPw !== confirmPw}
                >
                  Update Password
                </ActionButton>
              </div>
            </div>
          </Section>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT COLUMN (Theme, Language, Session, Danger Zone) — 5 cols
        ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Theme Appearance (Simplified Light / Dark) */}
          <Section title="Appearance" icon={Sun}>
            <p className="text-xs text-muted-foreground mb-3">
              Choose your interface theme. Your preference syncs across your devices.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Light Mode Card */}
              <button
                type="button"
                onClick={() => setTheme('warm-paper')}
                disabled={themeSaving}
                className={`flex flex-col items-center text-center p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTheme === 'warm-paper'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-border bg-secondary/50 hover:border-border/90 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center mb-2 text-foreground">
                  <Sun className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs font-bold text-foreground">Light</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Day study mode</p>
                {activeTheme === 'warm-paper' && (
                  <span className="mt-2 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Active
                  </span>
                )}
              </button>

              {/* Dark Mode Card */}
              <button
                type="button"
                onClick={() => setTheme('midnight')}
                disabled={themeSaving}
                className={`flex flex-col items-center text-center p-4 rounded-xl border transition-all cursor-pointer ${
                  activeTheme === 'midnight'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-border bg-secondary/50 hover:border-border/90 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center mb-2 text-foreground">
                  <Moon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">Dark</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Night study mode</p>
                {activeTheme === 'midnight' && (
                  <span className="mt-2 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Active
                  </span>
                )}
              </button>
            </div>
          </Section>

          {/* 2. Language & Region */}
          <Section title="Language & Region" icon={Globe}>
            <p className="text-xs text-muted-foreground mb-3">
              Select your preferred display language for NoteZ Studio.
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {LANGUAGES.map(lang => {
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
                        ? 'border-primary bg-primary/10 shadow-xs font-medium'
                        : 'border-border bg-secondary/50 hover:border-border/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">{lang.flag}</span>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{lang.label}</p>
                        <p className="text-[10px] text-muted-foreground">{lang.region}</p>
                      </div>
                    </div>
                    {active && (
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 3. Session Management */}
          <Section title="Session" icon={LogOut}>
            <p className="text-xs text-muted-foreground mb-3">
              Sign out of your active NoteZ session on this device.
            </p>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary/60 text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </Section>

          {/* 4. Danger Zone */}
          <Section title="Danger Zone" icon={AlertTriangle} danger>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Permanently delete your account and all study data. Type your email to confirm; this action cannot be undone.
            </p>
            <div className="space-y-3">
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={user?.email ?? 'your@email.com'}
                className={inputCls + ' border-destructive/30 focus:border-destructive'}
              />
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleteConfirm !== user?.email || deleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deleting ? 'Deleting account…' : 'Permanently Delete Account'}</span>
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */
const inputCls =
  'w-full bg-secondary/70 border border-border rounded-xl px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors';

function Section({
  title,
  icon: Icon,
  danger,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 sm:p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xs ${
        danger ? 'border-destructive/30' : 'border-border/80'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-4 border-b border-border/40 pb-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            danger ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-primary'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h3
          className={`text-[12px] font-bold uppercase tracking-wider font-mono ${
            danger ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function ActionButton({
  onClick,
  loading,
  icon: Icon,
  disabled,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-xs"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span>{children}</span>
    </button>
  );
}
