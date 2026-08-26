import { supabase } from '@/integrations/supabase/client';
import { checkAndDeductCredits, refundCredits } from '@/lib/credits';

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

export async function generateExamWithGemini(
  payload: GenerateExamPayload,
): Promise<GenerateExamResult> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = payload.userId || authData?.user?.id;

  // 1. Credit Check & Reservation
  const creditCheck = await checkAndDeductCredits(
    userId,
    'generate_exam',
    25,
    `Practice Exam: ${payload.subject} (${payload.questionCount} Qs)`,
    { subject: payload.subject, difficulty: payload.difficulty, count: payload.questionCount },
  );

  if (!creditCheck.success) {
    const err: any = new Error(
      `You need 25 credits to generate an exam, but you currently have ${creditCheck.balanceAfter ?? 0} credits.`,
    );
    err.error = creditCheck.code || 'INSUFFICIENT_CREDITS';
    err.field = 'generate_exam';
    err.action = 'generate_exam';
    err.limit = 25;
    err.required = 25;
    err.balance = creditCheck.balanceAfter;
    err.resetDate = creditCheck.resetDate;
    throw err;
  }

  // 2. Invoke Secure Backend Supabase Edge Function
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
      return {
        questions: data.questions.map((q: any) => ({
          question: q.question || 'Question',
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['True', 'False'],
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          explanation: q.explanation || 'Refer to course materials.',
          wrongExplanations: q.wrongExplanations || {},
          betterApproach: q.betterApproach || 'Review key definitions and formulas.',
        })),
      };
    }

    throw new Error('The exam service did not return questions for this topic.');
  } catch (err: any) {
    console.error('Exam service error:', err);
    // Automatic safe refund on failure
    await refundCredits(userId, 25, 'generate_exam', err?.message || 'Exam generation failed');
    throw new Error(err?.message || 'Unable to generate exam at this time. Please try again.');
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

export async function deleteExamResult(id: string): Promise<void> {
  const { error } = await supabase.from('exam_results').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete exam result:', error);
    throw error;
  }
}
