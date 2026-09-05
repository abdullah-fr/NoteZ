import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageCircleHeart,
  Paperclip,
  Send,
  Star,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { readUserStorage, writeUserStorage } from '@/lib/user-storage';
import { supabase } from '@/integrations/supabase/client';

type FeedbackCategory = 'bug' | 'feature' | 'general';

interface FeedbackAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  rating: number;
  message: string;
  attachments: FeedbackAttachment[];
  createdAt: string;
}

interface PendingFeedbackImage {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_FEEDBACK_IMAGES = 3;
const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FEEDBACK_IMAGE_TYPES = new Set(['image/png', 'image/jpeg']);

function hasSupportedImageSignature(file: File): Promise<boolean> {
  return file.slice(0, 12).arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    const isPng = file.type === 'image/png'
      && bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
    const isJpeg = file.type === 'image/jpeg'
      && bytes.length >= 3
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[2] === 0xff;

    return isPng || isJpeg;
  });
}

function sanitiseFileName(fileName: string): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 80);

  return safeName || 'feedback-image';
}

export default function FeedbackView() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingFeedbackImage[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const pendingImagesRef = useRef<PendingFeedbackImage[]>([]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => () => {
    pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl));
  }, []);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []);
    input.value = '';

    if (selectedFiles.length === 0) return;

    const availableSlots = MAX_FEEDBACK_IMAGES - pendingImages.length;
    if (availableSlots <= 0) {
      setAttachmentError(t('tools.feedback.attachmentLimit') || 'You can attach up to 3 images.');
      return;
    }

    const acceptedImages: PendingFeedbackImage[] = [];
    let rejected = false;

    for (const file of selectedFiles.slice(0, availableSlots)) {
      if (
        file.size === 0
        || file.size > MAX_FEEDBACK_IMAGE_BYTES
        || !ALLOWED_FEEDBACK_IMAGE_TYPES.has(file.type)
        || !(await hasSupportedImageSignature(file))
      ) {
        rejected = true;
        continue;
      }

      acceptedImages.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (selectedFiles.length > availableSlots) rejected = true;
    setPendingImages(current => [...current, ...acceptedImages]);
    setAttachmentError(
      rejected
        ? t('tools.feedback.attachmentError') || 'Use PNG or JPG images up to 5 MB each (3 maximum).'
        : '',
    );
  }

  function removePendingImage(imageId: string) {
    setPendingImages(current => {
      const image = current.find(item => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter(item => item.id !== imageId);
    });
  }

  function clearPendingImages() {
    pendingImages.forEach(image => URL.revokeObjectURL(image.previewUrl));
    setPendingImages([]);
    setAttachmentError('');
  }

  async function uploadFeedbackImages(
    userId: string,
    images: PendingFeedbackImage[],
  ): Promise<FeedbackAttachment[]> {
    const uploaded: FeedbackAttachment[] = [];

    try {
      for (const image of images) {
        const path = `${userId}/feedback/${crypto.randomUUID()}-${sanitiseFileName(image.file.name)}`;
        const { error } = await supabase.storage.from('uploads').upload(path, image.file, {
          cacheControl: '3600',
          contentType: image.file.type,
          upsert: false,
        });

        if (error) throw new Error('Attachment upload failed');
        uploaded.push({
          path,
          name: image.file.name,
          type: image.file.type,
          size: image.file.size,
        });
      }
    } catch {
      if (uploaded.length > 0) {
        await supabase.storage.from('uploads').remove(uploaded.map(image => image.path));
      }
      throw new Error('Attachment upload failed');
    }

    return uploaded;
  }

  async function handleSubmit() {
    if (!user || !message.trim() || rating === 0) return;
    setSubmitting(true);
    setSubmitError('');

    let uploadedAttachments: FeedbackAttachment[] = [];

    try {
      uploadedAttachments = await uploadFeedbackImages(user.id, pendingImages);

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        category,
        rating,
        message: message.trim(),
        attachments: uploadedAttachments,
      });

      if (error) throw new Error('Feedback submission failed');

      const existing = readUserStorage<FeedbackEntry[]>(user.id, 'feedback', []);
      existing.push({
        id: crypto.randomUUID(),
        category,
        rating,
        message: message.trim(),
        attachments: uploadedAttachments,
        createdAt: new Date().toISOString(),
      });
      writeUserStorage(user.id, 'feedback', existing);

      clearPendingImages();
      setSubmitted(true);
    } catch {
      if (uploadedAttachments.length > 0) {
        await supabase.storage.from('uploads').remove(uploadedAttachments.map(image => image.path));
      }
      setSubmitError(t('tools.feedback.submitError') || 'We could not send your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setCategory('general');
    setRating(0);
    setMessage('');
    setSubmitError('');
    clearPendingImages();
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
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex min-h-14 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-xs font-medium leading-snug transition-all cursor-pointer sm:min-h-0 sm:whitespace-nowrap ${
                        category === cat.value
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-secondary/60 border border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none">{cat.emoji}</span>
                      <span className="min-w-0">{cat.label}</span>
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

              {/* Image attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    {t('tools.feedback.attachments') || 'ATTACHMENTS'}
                  </label>
                  <span className="text-[10px] text-muted-foreground/70">
                    {pendingImages.length}/{MAX_FEEDBACK_IMAGES}
                  </span>
                </div>
                <label
                  htmlFor="feedback-images"
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border/80 bg-secondary/50 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                  <ImageIcon className="h-4 w-4" />
                  <span>{t('tools.feedback.attachImages') || 'Attach images'}</span>
                </label>
                <input
                  id="feedback-images"
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  onChange={handleImageChange}
                  className="sr-only"
                  disabled={submitting || pendingImages.length >= MAX_FEEDBACK_IMAGES}
                />
                <p className="text-[10px] text-muted-foreground/70">
                  {t('tools.feedback.attachmentHint') || 'PNG or JPG · 5 MB each · 3 maximum'}
                </p>
                {attachmentError && (
                  <p role="alert" className="flex items-start gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{attachmentError}</span>
                  </p>
                )}
                {pendingImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {pendingImages.map(image => (
                      <div key={image.id} className="group relative overflow-hidden rounded-xl border border-border/80 bg-secondary/40">
                        <img
                          src={image.previewUrl}
                          alt={image.file.name}
                          className="aspect-square w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingImage(image.id)}
                          aria-label={`${t('tools.feedback.removeAttachment') || 'Remove image'} ${image.file.name}`}
                          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground opacity-100 shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {submitError && (
                <p role="alert" className="flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{submitError}</span>
                </p>
              )}

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
