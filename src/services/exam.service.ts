import { supabase } from '@/integrations/supabase/client';

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
  sourceText?: string; // Prompt 15: optional folder note content
}

export interface GenerateExamResult {
  questions: ExamQuestion[];
}

export async function generateExam(
  payload: GenerateExamPayload,
): Promise<GenerateExamResult> {
  const { data, error } = await supabase.functions.invoke('generate-exam', {
    body: payload,
  });
  if (error) throw error;
  // Surface structured errors (including USAGE_LIMIT_REACHED) as-is so
  // callers can inspect error.error, error.field, error.limit.
  if (data?.error) throw data;
  if (!data?.questions?.length) throw new Error('No questions generated');
  return data as GenerateExamResult;
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
