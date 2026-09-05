import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import { isTempEmail } from '@/lib/temp-email-domains';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, signInWithGoogle, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = t('auth.validation.emailRequired');
    else if (!EMAIL_REGEX.test(email)) errs.email = t('auth.validation.emailInvalid');
    else if (isTempEmail(email)) errs.email = t('auth.validation.emailTemp');
    if (!password) errs.password = t('auth.validation.passwordRequired');
    else if (password.length < 6) errs.password = t('auth.validation.passwordMin');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      const isUnconfirmed = error.message.toLowerCase().includes('email not confirmed');
      toast({
        title: isUnconfirmed ? 'Email not confirmed' : t('common.error'),
        description: isUnconfirmed
          ? 'Please check your inbox and confirm your email before signing in.'
          : error.message,
        variant: 'destructive'
      });
    } else {
      navigate('/dashboard');
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      toast({ title: t('common.error'), description: t('auth.validation.emailInvalid'), variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail);
    setForgotLoading(false);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setForgotSent(true);
      toast({ title: t('auth.resetSent'), description: t('auth.resetSentDesc') });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-bg px-4 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-card overflow-hidden">
          <AnimatePresence mode="wait">
            {showForgot ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('auth.backToLogin')}
                </button>

                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold mb-2">{t('auth.resetPassword')}</h1>
                  <p className="text-muted-foreground text-sm">Enter your email and we'll send you a reset link.</p>
                </div>

                {forgotSent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      <Mail className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-foreground font-medium">{t('auth.resetSent')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('auth.resetSentDesc')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgotEmail">{t('auth.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="forgotEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="pl-10 h-12"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 glow-purple" disabled={forgotLoading}>
                      {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.sendResetLink')}
                    </Button>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-8">
                  <Link to="/" className="inline-flex items-center gap-2 mb-6">
                    <img src="/NoteZ%20logo2.png?v=20260831" alt="NoteZ" className="brand-logo h-10 w-10 object-contain shrink-0" />
                    <span className="text-2xl font-bold">NoteZ</span>
                  </Link>
                  <h1 className="text-2xl font-bold mb-2">{t('auth.welcomeBack')}</h1>
                  <p className="text-muted-foreground">{t('auth.signInContinue')}</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-6 h-12"
                  onClick={handleGoogleLogin}
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t('auth.continueGoogle')}
                </Button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">{t('auth.or')}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })); }}
                        className={`pl-10 h-12 ${errors.email ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.email && <p className="text-destructive text-xs font-medium">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t('auth.password')}</Label>
                      <button
                        type="button"
                        onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
                        className={`pl-10 h-12 ${errors.password ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.password && <p className="text-destructive text-xs font-medium">{errors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full h-12 glow-purple" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.signIn')}
                  </Button>
                </form>

                <p className="text-center text-muted-foreground mt-6">
                  {t('auth.noAccount')}{' '}
                  <Link to="/signup" className="text-primary hover:underline">
                    {t('auth.signUpLink')}
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
