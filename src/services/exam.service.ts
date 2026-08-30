import { supabase } from '@/integrations/supabase/client';
import { reportCreditFunctionError, syncCreditsAfterRequest } from '@/lib/credits';
import { EXAM_TOPIC_BLOCK_MESSAGE } from '@/lib/exam-safety';

export interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  wrongExplanations: Record<string, string>;
  betterApproach: string;
}

export interface GenerateExamPayload {
  subject: string;
  difficulty: string;
  questionCount: number;
  mode?: string;
  sourceText?: string;
  userId?: string;
}

export interface GenerateExamResult {
  questions: ExamQuestion[];
}

export interface ExamHistoryEntry {
  id: string;
  subject: string;
  score: number;
  total_questions: number;
  difficulty: string;
  created_at: string;
  questions: unknown;
}

export async function fetchExamHistory(
  userId: string,
  limit = 12,
): Promise<ExamHistoryEntry[]> {
  const safeLimit = Math.min(Math.max(Math.round(limit), 1), 30);
  const { data, error } = await supabase
    .from('exam_results')
    .select('id, subject, score, total_questions, difficulty, created_at, questions')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data ?? []) as unknown as ExamHistoryEntry[];
}

async function readExamFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return null;

  try {
    const payload = await context.clone().json() as { code?: unknown; error?: unknown };
    if (payload.code === 'TOPIC_NOT_ALLOWED') return EXAM_TOPIC_BLOCK_MESSAGE;
    return typeof payload.error === 'string' ? payload.error : null;
  } catch {
    return null;
  }
}

export async function generateExamWithGemini(
  payload: GenerateExamPayload,
): Promise<GenerateExamResult> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = payload.userId || authData?.user?.id;

  // The Edge Function performs the single authoritative deduction.
  try {
    const { data, error } = await supabase.functions.invoke('generate-exam', {
      body: {
        subject: payload.subject,
        difficulty: payload.difficulty,
        questionCount: payload.questionCount,
        mode: payload.mode || 'practice',
        sourceText: payload.sourceText,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate exam.');
    }

    if (Array.isArray(data?.questions) && data.questions.length > 0) {
      await syncCreditsAfterRequest(userId);
      return {
        questions: data.questions.map((rawQuestion: unknown) => {
          const q = rawQuestion && typeof rawQuestion === 'object'
            ? rawQuestion as Record<string, unknown>
            : {};
          const options = Array.isArray(q.options)
            ? q.options.filter((option): option is string => typeof option === 'string')
            : [];
          return {
            question: typeof q.question === 'string' && q.question ? q.question : 'Question',
            options: options.length >= 2 ? options : ['True', 'False'],
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: typeof q.explanation === 'string' && q.explanation ? q.explanation : 'Refer to course materials.',
            wrongExplanations: q.wrongExplanations && typeof q.wrongExplanations === 'object'
              ? q.wrongExplanations as Record<string, string>
              : {},
            betterApproach: typeof q.betterApproach === 'string' && q.betterApproach
              ? q.betterApproach
              : 'Review key definitions and formulas.',
          };
        }),
      };
    }

    throw new Error('The exam service did not return questions for this topic.');
  } catch (err: unknown) {
    console.error('Exam service error:', err);
    await reportCreditFunctionError(err);
    await syncCreditsAfterRequest(userId);
    const serverMessage = await readExamFunctionError(err);
    const errorMessage = err instanceof Error ? err.message : null;
    throw new Error(serverMessage || errorMessage || 'Unable to generate exam at this time. Please try again.');
  }
}

export async function saveExamResult(
  userId: string,
  payload: {
    subject: string;
    score: number;
    totalQuestions: number;
    difficulty: string;
    questions: ExamQuestion[];
  },
): Promise<void> {
  const { error } = await supabase.from('exam_results').insert({
    user_id: userId,
    subject: payload.subject,
    score: payload.score,
    total_questions: payload.totalQuestions,
    difficulty: payload.difficulty,
    questions: JSON.stringify(payload.questions),
  });
  if (error) console.error('Failed to save exam result:', error);
}

export async function deleteExamResult(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('exam_results')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    console.error('Failed to delete exam result:', error);
    throw error;
  }
}
