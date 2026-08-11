-- FSRS spaced-repetition columns on the existing flashcards table
ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS due_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stability       FLOAT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty      FLOAT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_count    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state          INTEGER     NOT NULL DEFAULT 0;  -- 0=New 1=Learning 2=Review 3=Relearning

-- Index for efficient due-card queries
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due
  ON flashcards (user_id, due_at);

-- Seed default cards for brand-new users (idempotent — only inserts if user has no cards)
-- This is handled client-side in the service; migration just ensures schema is ready.
