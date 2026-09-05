import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

interface TurnstileCaptchaProps {
  captchaRef?: RefObject<TurnstileInstance | null>;
  onToken: (token: string) => void;
  invisible?: boolean;
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export function TurnstileCaptcha({ captchaRef, onToken, invisible = false }: TurnstileCaptchaProps) {
  const { t } = useTranslation();

  if (!siteKey) {
    return (
      <p className="text-center text-xs text-destructive" role="alert">
        {t('auth.captchaUnavailable')}
      </p>
    );
  }

  return (
    <div className={invisible ? 'absolute h-px w-px overflow-hidden opacity-0 pointer-events-none' : 'flex justify-center overflow-x-auto py-1'}>
      <Turnstile
        ref={captchaRef}
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
        options={{
          appearance: invisible ? 'execute' : 'always',
          execution: invisible ? 'execute' : 'render',
          size: invisible ? 'invisible' : 'normal',
          theme: 'auto',
          refreshExpired: 'auto',
        }}
      />
    </div>
  );
}
