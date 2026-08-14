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
  mode?: string;
  sourceText?: string;
}

export interface GenerateExamResult {
  questions: ExamQuestion[];
}

const GEMINI_EXAM_API_KEY =
  import.meta.env.VITE_GEMINI_EXAM_API_KEY ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  '';

export async function generateExamWithGemini(
  payload: GenerateExamPayload,
): Promise<GenerateExamResult> {
  const models = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
  ];

  const prompt = payload.sourceText
    ? `You are an expert exam creator generating an exam for a student.

CRITICAL INSTRUCTION: You MUST generate the exam questions ONLY from the study material provided below.
Do not invent unrelated topics.
Do not rely on generic knowledge when the answer is not supported by the provided material.
Prioritize concepts, facts, definitions, examples, relationships, and details explicitly present in the provided study notes.

Study Material:
"""
${payload.sourceText.slice(0, 16000)}
"""

Exam Configuration:
Subject/Topic: ${payload.subject}
Difficulty: ${payload.difficulty}
Number of Questions: ${payload.questionCount}
Exam Mode: ${payload.mode || 'practice'}

Return ONLY a valid JSON array of ${payload.questionCount} questions matching this exact structure with no markdown or wrappers:
[
  {
    "question": "Question text directly based on provided study material",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why the correct answer is right according to the study material.",
    "wrongExplanations": {
      "0": "Explanation for option A",
      "1": "Explanation for option B",
      "2": "Explanation for option C",
      "3": "Explanation for option D"
    },
    "betterApproach": "Key insight or strategy for this question"
  }
]`
    : `You are an expert exam creator. Generate a high quality multiple-choice exam on "${payload.subject}".
Difficulty level: ${payload.difficulty}.
Number of questions: ${payload.questionCount}.
Exam Mode: ${payload.mode || 'practice'}.

Return ONLY a valid JSON array of ${payload.questionCount} questions matching this structure:
[
  {
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why the correct answer is right.",
    "wrongExplanations": {
      "0": "Explanation for option A",
      "1": "Explanation for option B",
      "2": "Explanation for option C",
      "3": "Explanation for option D"
    },
    "betterApproach": "Key insight or strategy for this question"
  }
]`;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_EXAM_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      const questions = JSON.parse(cleanJson);

      if (Array.isArray(questions) && questions.length > 0) {
        return {
          questions: questions.map((q: any) => ({
            question: q.question || 'Question',
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['True', 'False'],
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || 'Refer to course materials.',
            wrongExplanations: q.wrongExplanations || {},
            betterApproach: q.betterApproach || 'Review key definitions and formulas.',
          })),
        };
      }
    } catch (err) {
      console.warn(`Gemini model ${model} error:`, err);
    }
  }

  // Fallback to Supabase function
  return await generateExam(payload);
}

export async function generateExam(
  payload: GenerateExamPayload,
): Promise<GenerateExamResult> {
  const { data, error } = await supabase.functions.invoke('generate-exam', {
    body: payload,
  });
  if (error) throw error;
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
