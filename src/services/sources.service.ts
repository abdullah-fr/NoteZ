import { supabase } from '@/integrations/supabase/client';
import { reportCreditFunctionError, syncCreditsAfterRequest } from '@/lib/credits';

export type SourceKind = 'pdf' | 'docx' | 'txt' | 'url' | 'youtube' | 'text' | 'audio' | 'video';
export type SourceStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface Source {
  id: string;
  title: string;
  kind: SourceKind;
  file_path: string | null;
  source_url: string | null;
  summary: string | null;
  extracted_text?: string | null;
  status: SourceStatus;
  error: string | null;
  created_at: string;
}

export async function fetchSources(userId: string): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Source[];
}

export async function uploadSourceFile(userId: string, file: File): Promise<Source> {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
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

export async function deleteSource(source: Source, userId: string): Promise<void> {
  // Resolve the path from an owner-scoped row before touching Storage. The
  // Source object is client supplied, so trusting its file_path could let a
  // caller attempt to remove another user's upload.
  const { data: ownedSource, error: lookupError } = await supabase
    .from('sources')
    .select('file_path')
    .eq('id', source.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!ownedSource) throw new Error('Source not found');

  const filePath = ownedSource.file_path as string | null;
  if (filePath && !filePath.startsWith(`${userId}/`)) {
    throw new Error('Source file ownership mismatch');
  }
  if (filePath) {
    await supabase.storage.from('uploads').remove([filePath]);
  }
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', source.id)
    .eq('user_id', userId);
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
  const { data: authData } = await supabase.auth.getUser();
  try {
    const { data, error } = await supabase.functions.invoke('generate-from-source', {
      body: { sourceId, mode, count: mode === 'notes' ? 1 : count },
    });
    if (error) throw error;
    await syncCreditsAfterRequest(authData.user?.id);
    return data ?? {};
  } catch (error) {
    await reportCreditFunctionError(error);
    await syncCreditsAfterRequest(authData.user?.id);
    throw error;
  }
}

export function subscribeToSourceChanges(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`sources-changes-${userId}`)
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
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(n)) return 'audio';
  if (/\.(mp4|mov|webm|mkv)$/.test(n)) return 'video';
  return 'txt';
}

/* ── Storage quota check (Prompt 30) ── */

/** Tier storage caps in bytes. Free tier disables uploads entirely. */
const STORAGE_CAPS: Record<string, number> = {
  free:        0,
  pro_student: 0,
  pro_scholar: 2 * 1024 * 1024 * 1024,  // 2 GB
  team:        2 * 1024 * 1024 * 1024,
};

/**
 * Returns the total bytes currently used in the user's upload folder.
 * Uses the Storage list API — no separate counter table needed.
 */
export async function getUserStorageBytes(userId: string): Promise<number> {
  let total = 0;
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage
      .from('uploads')
      .list(userId, { limit, offset });
    if (error || !data?.length) break;
    total += data.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);
    if (data.length < limit) break;
    offset += limit;
  }
  return total;
}

/**
 * Returns null if the upload is allowed, or an error string if it would
 * exceed the user's tier quota. Call this BEFORE starting any upload.
 */
export async function checkStorageQuota(
  userId: string,
  fileSizeBytes: number,
  tier = 'free',
): Promise<string | null> {
  const cap = STORAGE_CAPS[tier] ?? 0;
  if (cap === 0) return 'Document uploads are not available on your current plan.';
  const used = await getUserStorageBytes(userId);
  if (used + fileSizeBytes > cap) {
    const usedMb  = Math.round(used / 1024 / 1024);
    const capGb   = cap / 1024 / 1024 / 1024;
    return `Storage limit reached — you've used ${usedMb} MB of your ${capGb} GB. Delete old uploads or upgrade.`;
  }
  return null;
}
