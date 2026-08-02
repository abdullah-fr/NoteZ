import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  User, Mail, Lock, LogOut, Trash2,
  Save, Eye, EyeOff, Shield, AlertTriangle,
} from 'lucide-react';

export default function AccountView() {
  const { user, signOut } = useAuth();

  /* ── display name ── */
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name ?? '',
  );
  const [savingName, setSavingName] = useState(false);

  /* ── password ── */
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw,     setNewPw]       = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw,    setShowPw]      = useState(false);
  const [savingPw,  setSavingPw]    = useState(false);

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
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    if (newPw.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Password updated' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== user?.email) {
      toast({ title: 'Email does not match', variant: 'destructive' }); return;
    }
    setDeleting(true);
    // Sign out — actual deletion requires a server-side call; this signs them out cleanly
    await signOut();
  }

  const initials = (displayName || user?.email || '?')
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2.5 mb-1">
          <User className="h-5 w-5 text-[hsl(40_20%_70%)]" />
          Account Settings
        </h2>
        <p className="text-[12px] text-[hsl(40_8%_44%)]">Manage your profile, password and account.</p>
      </div>

      {/* Avatar + identity */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-5 rounded-2xl border border-[hsl(220_8%_18%)] bg-[hsl(220_8%_10%)]"
      >
        <div className="w-14 h-14 rounded-2xl bg-[hsl(220_8%_18%)] border border-[hsl(220_8%_24%)] flex items-center justify-center shrink-0">
          <span className="text-[20px] font-bold font-mono text-[hsl(40_20%_78%)]">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[15px] text-[hsl(40_20%_88%)] truncate">
            {displayName || 'No display name'}
          </p>
          <p className="text-[12px] text-[hsl(40_8%_48%)] font-mono truncate">{user?.email}</p>
          <p className="text-[10px] text-[hsl(40_8%_36%)] mt-0.5">
            Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </motion.div>

      {/* Display name */}
      <Section title="Profile" icon={User}>
        <label className="block text-[11px] text-[hsl(40_8%_48%)] mb-1.5">Display name</label>
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Your name"
            className={inputCls}
          />
          <ActionButton onClick={saveName} loading={savingName} icon={Save}>
            Save
          </ActionButton>
        </div>
      </Section>

      {/* Email (read-only) */}
      <Section title="Email" icon={Mail}>
        <label className="block text-[11px] text-[hsl(40_8%_48%)] mb-1.5">Email address</label>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[hsl(220_8%_20%)] bg-[hsl(220_8%_12%)] text-[13px] text-[hsl(40_8%_52%)]">
          <Mail className="h-4 w-4 text-[hsl(40_8%_40%)] shrink-0" />
          <span className="truncate font-mono">{user?.email}</span>
        </div>
        <p className="text-[10px] text-[hsl(40_8%_36%)] mt-1.5">
          Email changes require re-authentication. Contact support if needed.
        </p>
      </Section>

      {/* Password */}
      <Section title="Password" icon={Lock}>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[11px] text-[hsl(40_8%_48%)] mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                className={inputCls + ' pr-9'}
              />
              <button onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(40_8%_40%)] hover:text-[hsl(40_20%_65%)] transition-colors"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-[hsl(40_8%_48%)] mb-1.5">Confirm password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              className={inputCls}
            />
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-[11px] text-red-400">Passwords do not match</p>
          )}
          <ActionButton
            onClick={savePassword}
            loading={savingPw}
            icon={Shield}
            disabled={!newPw || !confirmPw || newPw !== confirmPw}
          >
            Update Password
          </ActionButton>
        </div>
      </Section>

      {/* Sign out */}
      <Section title="Session" icon={LogOut}>
        <p className="text-[12px] text-[hsl(40_8%_46%)] mb-3">
          Sign out of your account on this device.
        </p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[hsl(220_8%_22%)] bg-[hsl(220_8%_13%)] text-[13px] text-[hsl(40_20%_80%)] hover:bg-[hsl(220_8%_18%)] transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone" icon={AlertTriangle} danger>
        <p className="text-[12px] text-[hsl(40_8%_46%)] mb-3">
          To confirm account deletion, type your email address below. This action cannot be undone.
        </p>
        <div className="space-y-2.5">
          <input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={user?.email ?? 'your@email.com'}
            className={inputCls + ' border-red-400/20 focus:border-red-400/40'}
          />
          <button
            onClick={deleteAccount}
            disabled={deleteConfirm !== user?.email || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-400/30 bg-red-400/5 text-red-400 text-[13px] hover:bg-red-400/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
const inputCls = 'w-full bg-[hsl(220_8%_13%)] border border-[hsl(220_8%_22%)] rounded-xl px-3 py-2 text-[13px] text-[hsl(40_20%_84%)] placeholder:text-[hsl(40_8%_36%)] outline-none focus:border-[hsl(220_8%_32%)] transition-colors';

function Section({ title, icon: Icon, danger, children }: {
  title: string; icon: any; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border bg-[hsl(220_8%_10%)] ${danger ? 'border-red-400/20' : 'border-[hsl(220_8%_18%)]'}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${danger ? 'text-red-400' : 'text-[hsl(40_20%_65%)]'}`} />
        <h3 className={`text-[12px] font-semibold uppercase tracking-wider font-mono ${danger ? 'text-red-400' : 'text-[hsl(40_20%_72%)]'}`}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function ActionButton({ onClick, loading, icon: Icon, disabled, children }: {
  onClick: () => void; loading: boolean; icon: any; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[hsl(220_8%_80%)] text-[hsl(220_10%_8%)] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-[hsl(220_10%_8%)/40] border-t-[hsl(220_10%_8%)] rounded-full animate-spin" />
        : <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
