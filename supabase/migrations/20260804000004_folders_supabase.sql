-- Prompt 13: Migrate folders/notes off localStorage onto Supabase
-- Preserves existing notes table; adds folders and folder_sections.

CREATE TABLE IF NOT EXISTS folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folder_sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id  UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'unit' CHECK (type IN ('unit','assignment','project','custom')),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend notes with folder/section columns
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS folder_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section_id  UUID REFERENCES folder_sections(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE folders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their folders"         ON folders         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their folder sections" ON folder_sections FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folders_user         ON folders         (user_id);
CREATE INDEX IF NOT EXISTS idx_folder_sections_folder ON folder_sections (folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder         ON notes           (folder_id);

-- Track migration status on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS folders_migrated BOOLEAN NOT NULL DEFAULT false;
