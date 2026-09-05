import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearLegacyUserStorage, clearOtherUsersStorage, clearUserStorage } from '@/lib/user-storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: (scope?: 'global' | 'local') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(null);

  const applySession = (nextSession: Session | null) => {
    const previousUserId = activeUserIdRef.current;
    const nextUserId = nextSession?.user?.id ?? null;

    // Clear the previous account's browser cache before the next identity is
    // allowed to render. This also covers account switches that happen in a
    // second tab or after an expired session is replaced.
    if (previousUserId && previousUserId !== nextUserId) {
      clearUserStorage(previousUserId);
    }
    // Also remove namespaces left by accounts that are no longer represented
    // by the current auth session (for example, a deleted account or a
    // previous tab that expired before this provider mounted).
    clearOtherUsersStorage(nextUserId);

    activeUserIdRef.current = nextUserId;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    return { error: error as Error | null };
  };

  const signOut = async (scope: 'global' | 'local' = 'global') => {
    const currentUserId = activeUserIdRef.current ?? user?.id ?? null;

    // Clear the in-memory identity before awaiting the network request. This
    // forces user-scoped providers/routes to unmount immediately, so the
    // previous account's private data cannot remain visible during sign-out.
    setSession(null);
    setUser(null);
    activeUserIdRef.current = null;
    clearUserStorage(currentUserId);
    clearLegacyUserStorage();

    try {
      const { error } = await supabase.auth.signOut({ scope });
      // If global logout fails because the account was already deleted or the
      // network is unavailable, still remove the local session. A failed
      // remote logout must never leave the old account visible on this device.
      if (error && scope !== 'local') {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      if (scope !== 'local') {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Local state and account-scoped caches were already cleared above.
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
