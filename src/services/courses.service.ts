import { supabase } from '@/integrations/supabase/client';

export interface Subject {
  name: string;
  color: string;
}

export async function fetchEnrolledSubjects(userId: string): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('name, color')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function enrollSubject(
  userId: string,
  payload: {
    name: string;
    color: string;
    icon: string;
    description: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, ...payload });
  if (error) throw error;
}
