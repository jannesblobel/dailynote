import { SupabaseClient } from '@supabase/supabase-js';

export interface UserKeys {
  wrappedDek: string;
  dekIv: string;
  kdfSalt: string;
  kdfIterations: number;
  version: number;
}

interface UserKeysRow {
  user_id: string;
  wrapped_dek: string;
  dek_iv: string;
  kdf_salt: string;
  kdf_iterations: number;
  version: number;
}

export async function fetchUserKeys(
  supabase: SupabaseClient,
  userId: string
): Promise<UserKeys | null> {
  const { data, error } = await supabase
    .from('user_keys')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw error;
  }

  const row = data as UserKeysRow;
  return {
    wrappedDek: row.wrapped_dek,
    dekIv: row.dek_iv,
    kdfSalt: row.kdf_salt,
    kdfIterations: row.kdf_iterations,
    version: row.version
  };
}

export async function saveUserKeys(
  supabase: SupabaseClient,
  userId: string,
  keys: UserKeys
): Promise<void> {
  const { error } = await supabase.from('user_keys').upsert({
    user_id: userId,
    wrapped_dek: keys.wrappedDek,
    dek_iv: keys.dekIv,
    kdf_salt: keys.kdfSalt,
    kdf_iterations: keys.kdfIterations,
    version: keys.version
  });

  if (error) {
    throw error;
  }
}
