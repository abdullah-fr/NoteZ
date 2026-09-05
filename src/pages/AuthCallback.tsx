import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { getSafeInternalPath } from '@/lib/navigation';

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [handled, setHandled] = useState(false);
  const nextPath = getSafeInternalPath(new URLSearchParams(window.location.search).get('next'));

  useEffect(() => {
    if (loading || handled) return;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hasError = Boolean(hashParams.get('error') || hashParams.get('error_code'));

    setHandled(true);

    if (hasError) {
      toast({
        title: t('auth.confirmationFailed'),
        description: t('auth.confirmationFailedDesc'),
        variant: 'destructive',
      });
      const loginPath = nextPath
        ? '/login?next=' + encodeURIComponent(nextPath)
        : '/login';
      navigate(loginPath, { replace: true });
      return;
    }

    if (user) {
      navigate(nextPath ?? '/dashboard', { replace: true });
      return;
    }

    const confirmedPath = nextPath
      ? '/login?confirmed=1&next=' + encodeURIComponent(nextPath)
      : '/login?confirmed=1';
    navigate(confirmedPath, { replace: true });
  }, [handled, loading, navigate, nextPath, t, toast, user]);

  return (
    <div className="min-h-screen flex items-center justify-center animated-bg px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Confirming email" />
    </div>
  );
}
