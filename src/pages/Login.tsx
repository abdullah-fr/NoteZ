import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { TurnstileCaptcha } from '@/components/auth/TurnstileCaptcha';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import { isTempEmail } from '@/lib/temp-email-domains';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState('');
  const [forgotCaptchaPending, setForgotCaptchaPending] = useState(false);
  const [loginCaptchaPending, setLoginCaptchaPending] = useState(false);
  const [showLoginCaptcha, setShowLoginCaptcha] = useState(false);
  const loginCaptchaRef = useRef<TurnstileInstance | null>(null);
  const forgotCaptchaRef = useRef<TurnstileInstance | null>(null);
  const { signIn, signInWithGoogle, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (searchParams.get('confirmed') !== '1') return;

    toast({ title: t('auth.emailConfirmed'), description: t('auth.emailConfirmedDesc') });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('confirmed');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

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
    if (!loginCaptchaToken) {
      setShowLoginCaptcha(true);
      setLoginCaptchaPending(true);
      return;
    }

    await submitLogin(loginCaptchaToken);
  };

  const submitLogin = async (captchaToken: string) => {
    setLoading(true);

    const { error } = await signIn(email, password, captchaToken);

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

    setLoginCaptchaToken('');
    loginCaptchaRef.current?.reset();
    setLoginCaptchaPending(false);
    setShowLoginCaptcha(false);
    setLoading(false);
  };

  const handleLoginCaptchaToken = (token: string) => {
    setLoginCaptchaToken(token);

    if (!token) {
      setLoginCaptchaPending(false);
      return;
    }

    if (loginCaptchaPending) {
      void submitLogin(token);
    }
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

  const submitForgotPassword = async (captchaToken: string) => {
    setForgotCaptchaPending(false);
    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail, captchaToken);
    setForgotCaptchaToken('');
    forgotCaptchaRef.current?.reset();
    setForgotLoading(false);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setForgotSent(true);
      toast({ title: t('auth.resetSent'), description: t('auth.resetSentDesc') });
    }
  };

  const handleForgotCaptchaToken = (token: string) => {
    setForgotCaptchaToken(token);

    if (!token) {
      setForgotCaptchaPending(false);
      setForgotLoading(false);
      return;
    }

    if (forgotCaptchaPending) {
      void submitForgotPassword(token);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      toast({ title: t('common.error'), description: t('auth.validation.emailInvalid'), variant: 'destructive' });
      return;
    }

    if (!forgotCaptchaToken) {
      const captcha = forgotCaptchaRef.current;
      if (!captcha) {
        toast({ title: t('common.error'), description: t('auth.captchaUnavailable'), variant: 'destructive' });
        return;
      }

      setForgotCaptchaPending(true);
      setForgotLoading(true);
      captcha.execute();
      return;
    }

    await submitForgotPassword(forgotCaptchaToken);
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
                  onClick={() => {
                    setShowForgot(false);
                    setForgotSent(false);
                    setForgotCaptchaToken('');
                    setForgotCaptchaPending(false);
                    setForgotLoading(false);
                    forgotCaptchaRef.current?.reset();
                    setShowLoginCaptcha(false);
                    setLoginCaptchaToken('');
                    setLoginCaptchaPending(false);
                    loginCaptchaRef.current?.reset();
                  }}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline mb-4 transition-colors"
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
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      <Mail className="h-6 w-6 text-blue-400" />
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
                    <TurnstileCaptcha
                      captchaRef={forgotCaptchaRef}
                      onToken={handleForgotCaptchaToken}
                      invisible
                    />
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
                  <GoogleIcon className="h-5 w-5 mr-2" />
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
                        onClick={() => {
                          setShowForgot(true);
                          setForgotEmail(email);
                          setForgotCaptchaToken('');
                          setForgotCaptchaPending(false);
                          setForgotLoading(false);
                          forgotCaptchaRef.current?.reset();
                          setShowLoginCaptcha(false);
                          setLoginCaptchaToken('');
                          setLoginCaptchaPending(false);
                          loginCaptchaRef.current?.reset();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
                          className={`pl-10 pr-10 h-12 ${errors.password ? 'border-destructive' : ''}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-destructive text-xs font-medium">{errors.password}</p>}
                  </div>

                  {showLoginCaptcha && (
                    <TurnstileCaptcha
                      captchaRef={loginCaptchaRef}
                      onToken={handleLoginCaptchaToken}
                    />
                  )}

                  <Button type="submit" className="w-full h-12 glow-purple" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.signIn')}
                  </Button>
                </form>

                <p className="text-center text-muted-foreground mt-6">
                  {t('auth.noAccount')}{' '}
                  <Link to="/signup" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">
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
