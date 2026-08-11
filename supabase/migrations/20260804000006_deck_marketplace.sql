-- Prompt 24: Public/Class Flashcard Deck Marketplace

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  subject      TEXT,
  description  TEXT,
  visibility   TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'class', 'public')),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  card_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add deck_id FK to flashcards (nullable — existing cards belong to no deck)
ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES flashcard_decks(id) ON DELETE SET NULL;

ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Owner full access to decks" ON flashcard_decks
  FOR ALL USING (auth.uid() = user_id);

-- Public decks are browsable by anyone
CREATE POLICY "Public decks are readable" ON flashcard_decks
  FOR SELECT USING (visibility = 'public');

-- Class decks visible to workspace members
CREATE POLICY "Class decks visible to members" ON flashcard_decks
  FOR SELECT USING (
    visibility = 'class'
    AND workspace_id IS NOT NULL
    AND is_workspace_member(auth.uid(), workspace_id)
  );

CREATE INDEX IF NOT EXISTS idx_decks_public   ON flashcard_decks (visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_decks_subject  ON flashcard_decks (subject);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards (deck_id);

-- Prompt 30: Storage quota tracking helper
-- Usage is computed on-demand via Storage list API (no separate counter table
-- needed at this scale — see sources.service.ts quota check).
