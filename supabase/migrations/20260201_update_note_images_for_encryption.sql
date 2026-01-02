-- Update note_images metadata to support encrypted blobs + thumbnails

ALTER TABLE note_images
  ADD COLUMN IF NOT EXISTS ciphertext_path TEXT,
  ADD COLUMN IF NOT EXISTS thumb_path TEXT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS nonce TEXT,
  ADD COLUMN IF NOT EXISTS thumb_nonce TEXT,
  ADD COLUMN IF NOT EXISTS key_id TEXT,
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE note_images
  ALTER COLUMN storage_path DROP NOT NULL;

-- Backfill ciphertext_path with existing storage_path when present
UPDATE note_images
SET ciphertext_path = storage_path
WHERE ciphertext_path IS NULL AND storage_path IS NOT NULL;

-- Trigger to automatically set server_updated_at
CREATE OR REPLACE FUNCTION public.set_note_images_server_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.server_updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_images_set_server_updated_at ON note_images;
CREATE TRIGGER note_images_set_server_updated_at
BEFORE INSERT OR UPDATE ON note_images
FOR EACH ROW EXECUTE FUNCTION public.set_note_images_server_updated_at();

CREATE INDEX IF NOT EXISTS note_images_user_server_updated_at_idx
ON note_images(user_id, server_updated_at);

-- Index for cursor-based note sync on server_updated_at
CREATE INDEX IF NOT EXISTS notes_user_server_updated_at_idx
ON notes(user_id, server_updated_at);

-- Allow updating note_images metadata
DROP POLICY IF EXISTS "Users can update own image metadata" ON note_images;
CREATE POLICY "Users can update own image metadata"
ON note_images FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow updating storage objects when using upsert
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'note-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'note-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
