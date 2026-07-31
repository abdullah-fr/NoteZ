-- Sources table
CREATE TABLE public.sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  file_path TEXT,
  source_url TEXT,
  extracted_text TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sources" ON public.sources
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON public.sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.sources
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.sources
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sources_user_created ON public.sources(user_id, created_at DESC);

-- Private uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users access only their own folder (uploads/<user_id>/...)
CREATE POLICY "Users can view own uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);