import { supabase } from '@/integrations/supabase/client';
import { getSafeClientErrorMessage, getSafeSourceErrorMessage } from '@/lib/client-logging';
import { validateUploadFile } from '@/services/upload-policy';

export interface Conversation {
  id: string;
  title: string;
  mode: string;
  source_id: string | null;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface AttachedSource {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string | null;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, mode, source_id, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function fetchMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function fetchSourceById(userId: string, sourceId: string): Promise<AttachedSource | null> {
  const { data } = await supabase
    .from('sources')
    .select('id, title, status, error')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data
    ? { ...data, error: data.error ? getSafeSourceErrorMessage(data.error) : null } as AttachedSource
    : null;
}

export async function createConversation(
  userId: string,
  mode: string | null,
  title: string,
  sourceId?: string | null,
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, mode: mode || 'researcher', title, source_id: sourceId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  patch: { mode?: string | null; source_id?: string | null },
): Promise<void> {
  const patchData: Record<string, any> = {};
  if (patch.mode) patchData.mode = patch.mode;
  if ('source_id' in patch) patchData.source_id = patch.source_id;

  const { error } = await supabase
    .from('chat_conversations')
    .update(patchData)
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadChatFile(
  userId: string,
  file: File,
): Promise<{ path: string }> {
  validateUploadFile(file);
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return { path };
}

export async function createSourceRecord(
  userId: string,
  title: string,
  kind: string,
  filePath: string,
): Promise<AttachedSource> {
  if (!filePath.startsWith(`${userId}/`)) {
    throw new Error('Source file ownership mismatch');
  }
  const { data, error } = await supabase
    .from('sources')
    .insert({ user_id: userId, title, kind, file_path: filePath, status: 'pending' })
    .select('id, title, status, error')
    .single();
  if (error) {
    await supabase.storage.from('uploads').remove([filePath]);
    throw error;
  }
  return data as AttachedSource;
}

export async function invokeProcessSource(sourceId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-source', { body: { sourceId } });
  if (error) throw new Error(getSafeClientErrorMessage(error, 'Unable to process this source. Please try again.'));
}

export function subscribeToSourceUpdates(
  sourceId: string,
  userId: string,
  onUpdate: (patch: { status: string; error: string | null }) => void,
) {
  const channel = supabase
    .channel(`chat-source-${userId}-${sourceId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sources', filter: `user_id=eq.${userId}` },
      (payload: any) => {
        if (payload.new?.id !== sourceId || payload.new?.user_id !== userId) return;
        onUpdate({
          status: payload.new.status,
          error: payload.new.error ? getSafeSourceErrorMessage(payload.new.error) : null,
        });
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
