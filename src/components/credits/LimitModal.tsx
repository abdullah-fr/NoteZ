import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  Zap,
  Sparkles,
  AlertTriangle,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCredits, type LimitModalState } from '@/contexts/CreditsContext';
import { PLANS } from '@/lib/credits';

interface LimitModalProps {
  overrideState?: LimitModalState;
  onCloseOverride?: () => void;
}

export default function LimitModal({ overrideState, onCloseOverride }: LimitModalProps) {
  const { limitModal: contextModal, closeLimitModal: contextClose } = useCredits();
  const modal = overrideState || contextModal;
  const onClose = onCloseOverride || contextClose;

  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modal.open) {
      setTimeout(() => closeRef.current?.focus(), 50);
    }
  }, [modal.open]);

  useEffect(() => {
    if (!modal.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal.open, onClose]);

  if (!modal.open) return null;

  const balance = modal.balance ?? 0;
  const resetDateFormatted = modal.resetDate
    ? new Date(modal.resetDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'in next cycle';

  // Modal configuration based on state type
  const getContent = () => {
    switch (modal.type) {
      case 'INSUFFICIENT_CREDITS':
        return {
          icon: Zap,
          iconBg: 'bg-accent/15 text-accent border-accent/30',
          headline: 'Monthly AI allowance reached',
          subtitle: `You have ${balance} AI requests remaining. Choose a paid plan or wait until ${resetDateFormatted} for your allowance to reset.`,
          detailBox: (
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Available now</span>
                <span className="font-mono font-bold text-accent">{balance} requests</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Allowance resets</span>
                <span className="font-mono text-foreground">{resetDateFormatted}</span>
              </div>
            </div>
          ),
          ctaText: 'View paid plans',
          ctaLink: '/pricing',
        };

      case 'MONTHLY_LIMIT_REACHED':
        return {
          icon: Clock,
          iconBg: 'bg-accent/15 text-accent border-accent/30',
          headline: 'Monthly AI allowance reached',
          subtitle: `You've used your monthly AI allowance. Choose a paid plan or wait until ${resetDateFormatted} when it resets.`,
          detailBox: (
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-semibold text-foreground">{PLANS[modal.tier || 'free']?.name || 'Free'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reset Date</span>
                <span className="font-mono text-foreground">{resetDateFormatted}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                Upgrade to <strong>Pro</strong> for a larger monthly AI allowance, or choose <strong>Max</strong> for the highest individual plan allowance.
              </p>
            </div>
          ),
          ctaText: 'View paid plans',
          ctaLink: '/pricing',
        };

      case 'PLAN_REQUIRED':
        return {
          icon: Sparkles,
          iconBg: 'bg-accent/15 text-accent border-accent/30',
          headline: 'Pro Plan Required',
          subtitle: `This premium feature is available on Pro plans. Upgrade to unlock complete access.`,
          detailBox: (
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3.5 space-y-1.5 text-xs">
              <p className="font-semibold text-foreground">What you get with Pro:</p>
              <ul className="text-[11px] text-muted-foreground space-y-1">
                <li>• More room for regular AI-assisted study</li>
                <li>• More room for practice exams & flashcard decks</li>
                <li>• Priority AI processing & coach analytics</li>
              </ul>
            </div>
          ),
          ctaText: 'Upgrade to Pro ($8/mo)',
          ctaLink: '/pricing',
        };

      case 'RATE_LIMITED':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-accent/15 text-accent border-accent/30',
          headline: 'Doing that a little too quickly',
          subtitle: modal.message || 'Please wait a few seconds before trying your request again.',
          detailBox: null,
          ctaText: 'Got it',
          ctaLink: null,
        };

      case 'SERVICE_UNAVAILABLE':
      default:
        return {
          icon: HelpCircle,
          iconBg: 'bg-secondary text-muted-foreground border-border',
          headline: 'Something went wrong',
          subtitle: "We couldn't complete this AI request. Your credits were not charged.",
          detailBox: (
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
              Your balance of <strong className="text-foreground">{balance} credits</strong> remains fully intact. You can retry the operation whenever you're ready.
            </div>
          ),
          ctaText: 'Close',
          ctaLink: null,
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          key="modal"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-50 w-full max-w-md rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto select-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${content.iconBg}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight">
                  {content.headline}
                </h3>
                <span className="text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider">
                  Credits &amp; Usage
                </span>
              </div>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-border/60 bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              aria-label="Close modal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Subtitle / Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {content.subtitle}
          </p>

          {/* Detail Box */}
          {content.detailBox}

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 pt-1">
            {content.ctaLink ? (
              <Link
                to={content.ctaLink}
                onClick={onClose}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
              >
                <span>{content.ctaText}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center hover:bg-primary/90 transition-all"
              >
                {content.ctaText}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-xl border border-border/70 bg-secondary/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
