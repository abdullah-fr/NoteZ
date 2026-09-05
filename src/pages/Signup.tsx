import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { TurnstileCaptcha } from '@/components/auth/TurnstileCaptcha';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import { isTempEmail } from '@/lib/temp-email-domains';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSafeInternalPath } from '@/lib/navigation';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

interface SignupConfirmationProps {
  email: string;
  loading: boolean;
  resendLoading: boolean;
  onVerify: (code: string) => Promise<void>;
  onResend: (captchaToken: string) => Promise<boolean>;
  onChangeEmail: () => void;
}

function SignupConfirmation({
  email,
  loading,
  resendLoading,
  onVerify,
  onResend,
  onChangeEmail,
}: SignupConfirmationProps) {
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendCaptchaToken, setResendCaptchaToken] = useState('');
  const [resendCaptchaPending, setResendCaptchaPending] = useState(false);
  const [showResendCaptcha, setShowResendCaptcha] = useState(false);
  const resendCaptchaRef = useRef<TurnstileInstance | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onVerify(code);
  };

  const submitResend = async (captchaToken: string) => {
    setResendCaptchaPending(false);
    const didResend = await onResend(captchaToken);
    setResendCaptchaToken('');
    resendCaptchaRef.current?.reset();
    setShowResendCaptcha(false);
    if (didResend) setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleResendCaptchaToken = (token: string) => {
    setResendCaptchaToken(token);

    if (!token) {
      setResendCaptchaPending(false);
      return;
    }

    if (resendCaptchaPending) {
      void submitResend(token);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading || resendCaptchaPending) return;
    if (!resendCaptchaToken) {
      setShowResendCaptcha(true);
      setResendCaptchaPending(true);
      return;
    }

    await submitResend(resendCaptchaToken);
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('auth.confirmYourEmail')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('auth.confirmYourEmailDesc', { email })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-confirmation-code">{t('auth.verificationCode')}</Label>
          <Input
            id="signup-confirmation-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
            className="h-14 text-center font-mono text-2xl tracking-[0.35em]"
            aria-describedby="signup-confirmation-code-help"
            required
          />
          <p id="signup-confirmation-code-help" className="text-xs text-muted-foreground text-center">
            {t('auth.verificationCodeHint')}
          </p>
        </div>

        <Button type="submit" className="w-full h-12 glow-purple" disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.confirmEmailButton')}
        </Button>
      </form>

      {showResendCaptcha && (
        <TurnstileCaptcha
          captchaRef={resendCaptchaRef}
          onToken={handleResendCaptchaToken}
        />
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <span>{t('auth.didntGetCode')} </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0 || resendCaptchaPending}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline disabled:opacity-50"
          aria-live="polite"
        >
          {resendLoading
            ? t('auth.resendingCode')
            : resendCooldown > 0
              ? t('auth.resendCodeIn', { seconds: resendCooldown })
              : t('auth.resendCode')}
        </button>
      </div>

      <button
        type="button"
        onClick={onChangeEmail}
        className="mt-4 flex w-full items-center justify-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
      >
        {t('auth.useDifferentEmail')}
      </button>
    </>
  );
}

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [signupCaptchaToken, setSignupCaptchaToken] = useState('');
  const [signupCaptchaPending, setSignupCaptchaPending] = useState(false);
  const [showSignupCaptcha, setShowSignupCaptcha] = useState(false);
  const signupCaptchaRef = useRef<TurnstileInstance | null>(null);
  const { signUp, verifySignupCode, resendConfirmation, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const nextPath = getSafeInternalPath(searchParams.get('next'));

  useEffect(() => {
    if (user) navigate(nextPath ?? '/dashboard', { replace: true });
  }, [nextPath, user, navigate]);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!fullName.trim()) errs.name = t('auth.validation.nameRequired');
    else if (fullName.trim().length < 2) errs.name = t('auth.validation.nameMin');
    if (!email.trim()) errs.email = t('auth.validation.emailRequired');
    else if (!EMAIL_REGEX.test(email)) errs.email = t('auth.validation.emailInvalid');
    else if (isTempEmail(email)) errs.email = t('auth.validation.emailTemp');
    if (!password) errs.password = t('auth.validation.passwordRequired');
    else if (password.length < 8) errs.password = t('auth.validation.passwordMin');
    else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) errs.password = t('auth.validation.passwordStrength');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!signupCaptchaToken) {
      setShowSignupCaptcha(true);
      setSignupCaptchaPending(true);
      return;
    }

    await submitSignup(signupCaptchaToken);
  };

  const submitSignup = async (captchaToken: string) => {
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error, session } = await signUp(normalizedEmail, password, fullName, captchaToken, nextPath ?? '/dashboard');
    setSignupCaptchaToken('');
    signupCaptchaRef.current?.reset();
    setSignupCaptchaPending(false);
    setShowSignupCaptcha(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } else if (session) {
      toast({
        title: t('auth.accountCreated'),
        description: t('auth.checkoutRedirect'),
      });
      navigate(nextPath ?? '/dashboard', { replace: true });
    } else {
      toast({
        title: t('auth.checkEmail'),
        description: t('auth.confirmEmail', { email: normalizedEmail }),
      });
      setConfirmationEmail(normalizedEmail);
    }

    setLoading(false);
  };

  const handleSignupCaptchaToken = (token: string) => {
    setSignupCaptchaToken(token);

    if (!token) {
      setSignupCaptchaPending(false);
      return;
    }

    if (signupCaptchaPending) {
      void submitSignup(token);
    }
  };

  const handleVerifyCode = async (code: string) => {
    if (!confirmationEmail) return;

    if (!/^\d{6,8}$/.test(code)) {
      toast({
        title: t('common.error'),
        description: t('auth.verificationCodeInvalid'),
        variant: 'destructive',
      });
      return;
    }

    setConfirmationLoading(true);
    const { error } = await verifySignupCode(confirmationEmail, code);
    setConfirmationLoading(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: t('auth.emailConfirmed'), description: t('auth.emailConfirmedDesc') });
    navigate(nextPath ?? '/dashboard', { replace: true });
  };

  const handleResendCode = async (captchaToken: string): Promise<boolean> => {
    if (!confirmationEmail) return false;

    if (!captchaToken) {
      toast({ title: t('common.error'), description: t('auth.captchaRequired'), variant: 'destructive' });
      return false;
    }

    setResendLoading(true);
    const { error } = await resendConfirmation(confirmationEmail, captchaToken, nextPath ?? '/dashboard');
    setResendLoading(false);

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: t('auth.codeResent'), description: t('auth.codeResentDesc') });
    return true;
  };

  const handleGoogleSignup = async () => {
    const { error } = await signInWithGoogle(nextPath ?? '/dashboard');
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
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
          {confirmationEmail ? (
            <SignupConfirmation
              email={confirmationEmail}
              loading={confirmationLoading}
              resendLoading={resendLoading}
              onVerify={handleVerifyCode}
              onResend={handleResendCode}
              onChangeEmail={() => setConfirmationEmail(null)}
            />
          ) : (
            <>
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/NoteZ%20logo2.png?v=20260831" alt="NoteZ" className="brand-logo h-10 w-10 object-contain shrink-0" />
              <span className="text-2xl font-bold">NoteZ</span>
            </Link>
            <h1 className="text-2xl font-bold mb-2">{t('auth.createAccount')}</h1>
            <p className="text-muted-foreground">{t('auth.startJourney')}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full mb-6 h-12"
            onClick={handleGoogleSignup}
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
              <Label htmlFor="fullName">{t('auth.fullName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your name here"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: undefined })); }}
                  className={`pl-10 h-12 ${errors.name ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {errors.name && <p className="text-destructive text-xs font-medium">{errors.name}</p>}
            </div>

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
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
                  className={`pl-10 pr-10 h-12 ${errors.password ? 'border-destructive' : ''}`}
                  minLength={8}
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

            {showSignupCaptcha && (
              <TurnstileCaptcha
                captchaRef={signupCaptchaRef}
                onToken={handleSignupCaptchaToken}
              />
            )}

            <Button type="submit" className="w-full h-12 glow-purple" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.signUp')}
            </Button>
          </form>

          <p className="text-center text-muted-foreground mt-6">
            {t('auth.haveAccount')}{' '}
            <Link
              to={nextPath ? '/login?next=' + encodeURIComponent(nextPath) : '/login'}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
            >
              {t('auth.signInLink')}
            </Link>
          </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
