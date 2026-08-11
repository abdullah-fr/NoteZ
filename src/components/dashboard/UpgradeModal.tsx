import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

/* ─── types ─── */
export type LimitField =
  | 'ai_chat_messages_count'
  | 'exam_generations_count'
  | 'source_uploads_count';

interface UpgradeModalProps {
  open: boolean;
  field: LimitField;
  limit: number;
  onClose: () => void;
}

/* ─── copy per limit type ─── */
const COPY: Record<LimitField, { headline: string; detail: (limit: number) => string; tier: string; price: string }> = {
  ai_chat_messages_count: {
    headline: "You've used today's free AI messages",
    detail:   (n) => `Free accounts get ${n} AI chat messages per day. Pro Student gives you unlimited tutoring for $8/mo.`,
    tier:     'Pro Student',
    price:    '$8/mo',
  },
  exam_generations_count: {
    headline: "You've used this week's free exam generations",
    detail:   (n) => `Free accounts can generate ${n} AI exams per week. Pro Student removes this limit.`,
    tier:     'Pro Student',
    price:    '$8/mo',
  },
  source_uploads_count: {
    headline: "You've used this month's free document upload",
    detail:   (n) => `Free accounts get ${n} document upload per month. Pro Scholar unlocks unlimited uploads.`,
    tier:     'Pro Scholar',
    price:    '$18/mo',
  },
};

export default function UpgradeModal({ open, field, limit, onClose }: UpgradeModalProps) {
  const copy = COPY[field];
  const closeRef = useRef<HTMLButtonElement>(null);

  /* Focus the close button when the modal opens for keyboard accessibility */
  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus(), 50);
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                       w-[calc(100vw-2rem)] max-w-md
                       rounded-2xl border border-border bg-card p-6 shadow-[0_24px_64px_hsl(var(--foreground)/0.6)]
                       overflow-y-auto max-h-[90dvh]"
          >
            {/* Top-left accent line — matches CardDisplay */}
            <span aria-hidden className="absolute left-0 top-0 h-px w-20 bg-foreground/40 rounded-tl-2xl" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-secondary/40 shrink-0">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2
                  id="upgrade-modal-title"
                  className="font-serif text-lg tracking-tight text-foreground leading-snug"
                >
                  {copy.headline}
                </h2>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60
                           bg-secondary/40 text-muted-foreground hover:text-foreground
                           hover:bg-secondary transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {copy.detail(limit)}
            </p>

            {/* Tier highlight */}
            <div className="flex items-center gap-3 rounded-sm border border-border/70 bg-secondary/30 px-4 py-3 mb-5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  Unlock with
                </p>
                <p className="text-sm font-medium text-foreground mt-0.5">{copy.tier}</p>
              </div>
              <p className="font-serif text-2xl tracking-tight text-foreground shrink-0">
                {copy.price}
              </p>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <Link
                to={`/pricing`}
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2
                           h-10 rounded-sm border border-foreground/80 bg-foreground
                           text-background text-[13px] font-medium
                           hover:bg-foreground/90 transition-colors"
              >
                View plans
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={onClose}
                className="flex-1 h-10 rounded-sm border border-border/60 bg-transparent
                           text-muted-foreground text-[13px]
                           hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>

            {/* No pressure note */}
            <p className="text-center text-[10px] text-muted-foreground/60 mt-3 font-mono">
              Free tier resets on its normal schedule. Everything else keeps working.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
