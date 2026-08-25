import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircleHeart, Star, Send, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type FeedbackCategory = 'bug' | 'feature' | 'general';

interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  rating: number;
  message: string;
  createdAt: string;
}

export default function FeedbackView() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!message.trim() || rating === 0) return;
    setSubmitting(true);

    try {
      const existing: FeedbackEntry[] = JSON.parse(localStorage.getItem('notez_feedback') || '[]');
      existing.push({
        id: crypto.randomUUID(),
        category,
        rating,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('notez_feedback', JSON.stringify(existing));
    } catch {
      // Silent fail
    }

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 400);
  }

  function resetForm() {
    setSubmitted(false);
    setCategory('general');
    setRating(0);
    setMessage('');
  }

  const categories: { value: FeedbackCategory; label: string; emoji: string }[] = [
    { value: 'bug', label: t('tools.feedback.bug') || 'Bug Report', emoji: '🐛' },
    { value: 'feature', label: t('tools.feedback.feature') || 'Feature Request', emoji: '✨' },
    { value: 'general', label: t('tools.feedback.general') || 'General', emoji: '💬' },
  ];

  return (
    <div className="max-w-md mx-auto py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary shrink-0">
          <MessageCircleHeart className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {t('tools.feedback.title') || 'Send Feedback'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('tools.feedback.desc') || 'Help us improve NoteZ with your feedback'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3 py-8 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-base text-foreground">
                {t('tools.feedback.thankYou') || 'Thank you for your feedback!'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                {t('tools.feedback.thankYouDesc') || 'Your message has been received.'}
              </p>
              <button
                onClick={resetForm}
                className="mt-2 px-4 py-2 rounded-xl border border-border bg-secondary text-xs text-foreground font-medium hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                {t('tools.feedback.sendAnother') || 'Send another message'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {t('tools.feedback.category') || 'CATEGORY'}
                </label>
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        category === cat.value
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-secondary/60 border border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {t('tools.feedback.rating') || 'RATING'}
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-border'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {t('tools.feedback.message') || 'YOUR MESSAGE'}
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('tools.feedback.messagePlaceholder') || 'Tell us what you think...'}
                  rows={4}
                  className="w-full bg-secondary/50 border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors resize-y leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!message.trim() || rating === 0 || submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{t('tools.feedback.submit') || 'Send Feedback'}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
