import { useCallback, useEffect, useState } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthState = 'loading' | 'signed_out' | 'signed_in' | 'awaiting_confirmation';

interface UseAuthReturn {
  session: Session | null;
  user: User | null;
  authState: AuthState;
  error: string | null;
  isBusy: boolean;
  confirmationEmail: string | null;
  signUp: (email: string, password: string) => Promise<{ success: boolean; password?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; password?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
  backToSignIn: () => void;
}

function formatAuthError(error: AuthError): string {
  if (error.message.includes('Invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (error.message.includes('User already registered')) {
    return 'An account with this email already exists.';
  }
  if (error.message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (error.message.includes('Invalid email')) {
    return 'Please enter a valid email address.';
  }
  return error.message;
}

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthState(session ? 'signed_in' : 'signed_out');
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthState(session ? 'signed_in' : 'signed_out');
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; password?: string }> => {
      setIsBusy(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) {
          setError(formatAuthError(error));
          return { success: false };
        }
        // Check if email confirmation is required
        if (data.user && !data.session) {
          // User created but not confirmed yet
          setConfirmationEmail(email);
          setAuthState('awaiting_confirmation');
          return { success: true };
        }
        // User is confirmed and signed in (e.g., if email confirmation is disabled)
        return { success: true, password };
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const signIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; password?: string }> => {
      setIsBusy(true);
      setError(null);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          setError(formatAuthError(error));
          return { success: false };
        }
        return { success: true, password };
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await supabase.auth.signOut();
    } finally {
      setIsBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const backToSignIn = useCallback(() => {
    setConfirmationEmail(null);
    setAuthState('signed_out');
  }, []);

  return {
    session,
    user: session?.user ?? null,
    authState,
    error,
    isBusy,
    confirmationEmail,
    signUp,
    signIn,
    signOut,
    clearError,
    backToSignIn
  };
}
