/**
 * Editor AI Assist Service
 * Invokes the Supabase Edge Function. The server charges one AI request.
 */

import { supabase } from '@/integrations/supabase/client';
import { reportCreditFunctionError, syncCreditsAfterRequest } from '@/lib/credits';
import { reportClientError } from '@/lib/client-logging';

export async function editorAiAssist(action: string, selectedText: string, userId?: string): Promise<string> {
  if (!selectedText.trim()) return selectedText;

  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = userId || authData?.user?.id;

  try {
    const { data, error } = await supabase.functions.invoke('editor-ai', {
      body: {
        action,
        text: selectedText,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Editor assist failed');

    if (data?.result && typeof data.result === 'string') {
      await syncCreditsAfterRequest(effectiveUserId);
      return data.result.trim();
    }

    return selectedText;
  } catch (err: unknown) {
    reportClientError('editor-ai-service');
    await reportCreditFunctionError(err);
    await syncCreditsAfterRequest(effectiveUserId);
    return selectedText;
  }
}
