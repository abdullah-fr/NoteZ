import LimitModal from '@/components/credits/LimitModal';
import type { MeteredAction } from '@/lib/credits';

export type LimitField =
  | 'ai_chat_messages_count'
  | 'exam_generations_count'
  | 'ai_chat'
  | 'generate_exam'
  | 'generate_flashcards'
  | 'editor_ai_assist'
  | 'activities_breakdown';

interface UpgradeModalProps {
  open: boolean;
  field: LimitField;
  limit: number;
  onClose: () => void;
  required?: number;
  balance?: number;
  resetDate?: string;
}

const FIELD_ACTION_MAP: Record<string, MeteredAction> = {
  ai_chat_messages_count: 'ai_chat',
  exam_generations_count: 'generate_exam',
  ai_chat: 'ai_chat',
  generate_exam: 'generate_exam',
  generate_flashcards: 'generate_flashcards',
  editor_ai_assist: 'editor_ai_assist',
  activities_breakdown: 'activities_breakdown',
};

export default function UpgradeModal({
  open,
  field,
  limit,
  onClose,
  required,
  balance,
  resetDate,
}: UpgradeModalProps) {
  const action = FIELD_ACTION_MAP[field] || 'generate_exam';

  return (
    <LimitModal
      overrideState={{
        open,
        type: 'INSUFFICIENT_CREDITS',
        action,
        required: required ?? limit ?? 25,
        balance: balance ?? 0,
        resetDate,
      }}
      onCloseOverride={onClose}
    />
  );
}
