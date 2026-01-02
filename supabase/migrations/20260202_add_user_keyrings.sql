-- Support multiple wrapped keys per user

CREATE TABLE IF NOT EXISTS public.user_keyrings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL,
  wrapped_dek TEXT NOT NULL,
  dek_iv TEXT NOT NULL,
  kdf_salt TEXT NOT NULL,
  kdf_iterations INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, key_id)
);

-- Enable RLS
ALTER TABLE public.user_keyrings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_keyrings
DROP POLICY IF EXISTS "user_keyrings_select_own" ON public.user_keyrings;
CREATE POLICY "user_keyrings_select_own"
  ON public.user_keyrings
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_keyrings_insert_own" ON public.user_keyrings;
CREATE POLICY "user_keyrings_insert_own"
  ON public.user_keyrings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_keyrings_update_own" ON public.user_keyrings;
CREATE POLICY "user_keyrings_update_own"
  ON public.user_keyrings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.set_user_keyrings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_keyrings_set_updated_at ON public.user_keyrings;
CREATE TRIGGER user_keyrings_set_updated_at
BEFORE UPDATE ON public.user_keyrings
FOR EACH ROW EXECUTE FUNCTION public.set_user_keyrings_updated_at();

CREATE INDEX IF NOT EXISTS user_keyrings_user_primary_idx
ON public.user_keyrings(user_id, is_primary);
