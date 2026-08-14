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

    // Save to localStorage
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
    }, 600);
  }

  function resetForm() {
    setSubmitted(false);
    setCategory('general');
    setRating(0);
    setMessage('');
  }

  const categories: { value: FeedbackCategory; label: string; emoji: string }[] = [
    { value: 'bug', label: t('tools.feedback.bug'), emoji: '🐛' },
    { value: 'feature', label: t('tools.feedback.feature'), emoji: '✨' },
    { value: 'general', label: t('tools.feedback.general'), emoji: '💬' },
  ];

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-pink-500/10 border border-pink-500/20">
          <MessageCircleHeart className="h-5 w-5 text-pink-500" />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight leading-none">{t('tools.feedback.title')}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('tools.feedback.desc')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary p-5">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Check className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-foreground">{t('tools.feedback.thankYou')}</h3>
                <p className="text-[13px] text-muted-foreground mt-1">{t('tools.feedback.thankYouDesc')}</p>
              </div>
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-border bg-background text-[13px] text-foreground font-medium hover:bg-secondary transition-colors"
              >
                {t('tools.feedback.sendAnother')}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Category */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t('tools.feedback.category')}</label>
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                        category === cat.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-background'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t('tools.feedback.rating')}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110"
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
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t('tools.feedback.message')}</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('tools.feedback.messagePlaceholder')}
                  rows={5}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors resize-y leading-relaxed"
                />
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={!message.trim() || rating === 0 || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('tools.feedback.submit')}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
