import { supabase } from '@/integrations/supabase/client';

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

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, mode, source_id, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function fetchSourceById(sourceId: string): Promise<AttachedSource | null> {
  const { data } = await supabase
    .from('sources')
    .select('id, title, status, error')
    .eq('id', sourceId)
    .maybeSingle();
  return data as AttachedSource | null;
}

export async function createConversation(
  userId: string,
  mode: string,
  title: string,
  sourceId?: string | null,
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, mode, title, source_id: sourceId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function updateConversation(
  conversationId: string,
  patch: { mode?: string; source_id?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .update(patch)
    .eq('id', conversationId);
  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId);
  if (error) throw error;
}

export async function uploadChatFile(
  userId: string,
  file: File,
): Promise<{ path: string }> {
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
  const { data, error } = await supabase
    .from('sources')
    .insert({ user_id: userId, title, kind, file_path: filePath, status: 'pending' })
    .select('id, title, status, error')
    .single();
  if (error) throw error;
  return data as AttachedSource;
}

export async function invokeProcessSource(sourceId: string): Promise<void> {
  await supabase.functions.invoke('process-source', { body: { sourceId } });
}

export async function getStreamingToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function subscribeToSourceUpdates(
  sourceId: string,
  onUpdate: (patch: { status: string; error: string | null }) => void,
) {
  const channel = supabase
    .channel(`chat-source-${sourceId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sources', filter: `id=eq.${sourceId}` },
      (payload: any) => {
        onUpdate({ status: payload.new.status, error: payload.new.error });
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
