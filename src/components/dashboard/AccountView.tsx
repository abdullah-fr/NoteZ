import { useState, type ComponentType, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTheme, THEMES, type ThemeId } from '@/hooks/use-theme';
import {
  User, Mail, Lock, LogOut, Trash2,
  Save, Eye, EyeOff, Shield, AlertTriangle, Palette,
} from 'lucide-react';

export default function AccountView() {
  const { user, signOut } = useAuth();
  const { theme: activeTheme, setTheme, saving: themeSaving } = useTheme();

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
    else toast({ title: 'Name updated' });
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
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <h2 className="font-serif text-xl sm:text-2xl tracking-tight flex items-center gap-2.5 mb-1">
          <User className="h-5 w-5 text-foreground shrink-0" />
          Account Settings
        </h2>
        <p className="text-[12px] text-muted-foreground">Manage your profile, password and account.</p>
      </div>

      {/* Avatar + identity */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-secondary overflow-hidden"
      >
        <div className="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center shrink-0">
          <span className="text-[20px] font-bold font-mono text-foreground">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[15px] text-foreground truncate">{displayName || 'No display name'}</p>
          <p className="text-[12px] text-muted-foreground font-mono truncate">{user?.email}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </motion.div>

      {/* Display name */}
      <Section title="Profile" icon={User}>
        <label className="block text-[11px] text-muted-foreground mb-1.5">Display name</label>
        <div className="flex gap-2">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()} placeholder="Your name" className={inputCls}
          />
          <ActionButton onClick={saveName} loading={savingName} icon={Save}>Save</ActionButton>
        </div>
      </Section>

      {/* Email (read-only) */}
      <Section title="Email" icon={Mail}>
        <label className="block text-[11px] text-muted-foreground mb-1.5">Email address</label>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-secondary text-[13px] text-muted-foreground">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate font-mono">{user?.email}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Email changes require re-authentication. Contact support if needed.</p>
      </Section>

      {/* Password */}
      <Section title="Password" icon={Lock}>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5">New password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
                className={inputCls + ' pr-9'}
              />
              <button onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5">Confirm password</label>
            <input type={showPw ? 'text' : 'password'} value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" className={inputCls}
            />
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-[11px] text-destructive">Passwords do not match</p>
          )}
          <ActionButton onClick={savePassword} loading={savingPw} icon={Shield}
            disabled={!newPw || !confirmPw || newPw !== confirmPw}
          >Update Password</ActionButton>
        </div>
      </Section>

      {/* Preferences — Themes */}
      <Section title="Preferences" icon={Palette}>
        <p className="text-[11px] text-muted-foreground mb-3">
          Choose a theme. Your preference follows you across devices.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {THEMES.map(t => {
            const active = activeTheme === t.id;
            return (
              <button key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                disabled={themeSaving}
                className={`flex flex-col gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer
                  ${active
                    ? 'border-[hsl(var(--foreground))] bg-secondary'
                    : 'border-border bg-secondary hover:border-border'}
                  disabled:opacity-40`}
              >
                <div className="flex gap-1 h-5 rounded-md overflow-hidden">
                  {t.swatches.map((c, i) => (
                    <div key={i} className="flex-1 rounded" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-medium text-foreground">{t.label}</p>
                    {active && <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-foreground">Active</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Sign out */}
      <Section title="Session" icon={LogOut}>
        <p className="text-[12px] text-muted-foreground mb-3">Sign out of your account on this device.</p>
        <button onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary text-[13px] text-foreground hover:bg-secondary transition-colors"
        ><LogOut className="h-4 w-4" /> Sign out</button>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone" icon={AlertTriangle} danger>
        <p className="text-[12px] text-muted-foreground mb-3">
          Permanently delete your account and all study data. Type your email address to confirm; this cannot be undone.
        </p>
        <div className="space-y-2.5">
          <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={user?.email ?? 'your@email.com'}
            className={inputCls + ' border-destructive/20 focus:border-destructive/40'}
          />
          <button onClick={deleteAccount} disabled={deleteConfirm !== user?.email || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-[13px] hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </Section>
    </div>
  );
}

/* ── sub-components ── */
const inputCls = 'w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors';

function Section({ title, icon: Icon, danger, children }: {
  title: string; icon: ComponentType<{ className?: string }>; danger?: boolean; children: ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border bg-secondary ${danger ? 'border-destructive/20' : 'border-border'}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${danger ? 'text-destructive' : 'text-foreground'}`} />
        <h3 className={`text-[12px] font-semibold uppercase tracking-wider font-mono ${danger ? 'text-destructive' : 'text-foreground'}`}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function ActionButton({ onClick, loading, icon: Icon, disabled, children }: {
  onClick: () => void; loading: boolean; icon: ComponentType<{ className?: string }>; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[12px] font-semibold hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-[hsl(var(--accent-foreground))/40] border-t-[hsl(var(--accent-foreground))] rounded-full animate-spin" />
        : <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
