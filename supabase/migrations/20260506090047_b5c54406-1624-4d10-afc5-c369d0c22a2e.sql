
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id UUID,
  subject TEXT,
  title TEXT NOT NULL,
  description TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "act_select" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "act_insert" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "act_update" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "act_delete" ON public.activities FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.activity_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aci_select" ON public.activity_checklist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aci_insert" ON public.activity_checklist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aci_update" ON public.activity_checklist_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aci_delete" ON public.activity_checklist_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_activities_user ON public.activities(user_id);
CREATE INDEX idx_aci_activity ON public.activity_checklist_items(activity_id);
