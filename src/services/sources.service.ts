import { supabase } from '@/integrations/supabase/client';

export type SourceKind = 'pdf' | 'docx' | 'txt' | 'url' | 'youtube' | 'text';
export type SourceStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface Source {
  id: string;
  title: string;
  kind: SourceKind;
  file_path: string | null;
  source_url: string | null;
  summary: string | null;
  status: SourceStatus;
  error: string | null;
  created_at: string;
}

export async function fetchSources(): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Source[];
}

export async function uploadSourceFile(userId: string, file: File): Promise<Source> {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const { error: upErr } = await supabase.storage
    .from('uploads')
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const kind = detectKindFromName(file.name);
  const { data, error } = await supabase
    .from('sources')
    .insert({ user_id: userId, title: file.name, kind, file_path: path, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as Source;
}

export async function createUrlSource(userId: string, url: string): Promise<Source> {
  const kind = /youtube\.com|youtu\.be/.test(url) ? 'youtube' : 'url';
  const { data, error } = await supabase
    .from('sources')
    .insert({ user_id: userId, title: url.slice(0, 80), kind, source_url: url, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as Source;
}

export async function createPastedSource(
  userId: string,
  title: string,
  content: string,
): Promise<Source> {
  const { data, error } = await supabase
    .from('sources')
    .insert({
      user_id: userId,
      title: title || `Note ${new Date().toLocaleDateString()}`,
      kind: 'text',
      extracted_text: content,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Source;
}

export async function deleteSource(source: Source): Promise<void> {
  if (source.file_path) {
    await supabase.storage.from('uploads').remove([source.file_path]);
  }
  const { error } = await supabase.from('sources').delete().eq('id', source.id);
  if (error) throw error;
}

export async function triggerProcessSource(sourceId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-source', { body: { sourceId } });
  if (error) throw error;
}

export async function generateFromSource(
  sourceId: string,
  mode: 'notes' | 'flashcards' | 'quiz',
  count = 10,
): Promise<{ count?: number }> {
  const { data, error } = await supabase.functions.invoke('generate-from-source', {
    body: { sourceId, mode, count: mode === 'notes' ? 1 : count },
  });
  if (error) throw error;
  return data ?? {};
}

export function subscribeToSourceChanges(userId: string, onChange: () => void) {
  const channel = supabase
    .channel('sources-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sources', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

function detectKindFromName(name: string): SourceKind {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx') || n.endsWith('.doc')) return 'docx';
  return 'txt';
}
