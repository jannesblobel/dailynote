-- Create storage bucket for note images
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
-- Users can only access their own images (path format: {userId}/{imageId}.{ext})
CREATE POLICY IF NOT EXISTS "Users can view own images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create note_images metadata table
CREATE TABLE IF NOT EXISTS note_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('background', 'inline')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on note_images table
ALTER TABLE note_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for note_images table
CREATE POLICY IF NOT EXISTS "Users can view own image metadata"
ON note_images FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own image metadata"
ON note_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own image metadata"
ON note_images FOR DELETE
USING (auth.uid() = user_id);

-- Index for efficient lookups by note date
CREATE INDEX IF NOT EXISTS idx_note_images_user_date
ON note_images(user_id, note_date);

-- Index for efficient lookups by image ID
CREATE INDEX IF NOT EXISTS idx_note_images_id
ON note_images(id);
