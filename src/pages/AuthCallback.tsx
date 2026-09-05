import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [handled, setHandled] = useState(false);

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
      navigate('/login', { replace: true });
      return;
    }

    if (user) {
      navigate('/dashboard', { replace: true });
      return;
    }

    navigate('/login?confirmed=1', { replace: true });
  }, [handled, loading, navigate, t, toast, user]);

  return (
    <div className="min-h-screen flex items-center justify-center animated-bg px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Confirming email" />
    </div>
  );
}
