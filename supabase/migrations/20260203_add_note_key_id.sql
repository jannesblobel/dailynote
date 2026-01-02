-- Add key_id to notes for multi-key support

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS key_id TEXT;

UPDATE notes
SET key_id = 'legacy'
WHERE key_id IS NULL;

ALTER TABLE notes
  ALTER COLUMN key_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS notes_user_key_id_idx
ON notes(user_id, key_id);
