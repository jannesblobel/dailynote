import { useState } from 'react';

interface VaultUnlockProps {
  mode: 'setup' | 'unlock';
  isBusy: boolean;
  error: string | null;
  onUnlock: (password: string) => void;
  onSwitchToCloud?: () => void;
}

export function VaultUnlock({ mode, isBusy, error, onUnlock, onSwitchToCloud }: VaultUnlockProps) {
  const [password, setPassword] = useState('');

  const title = mode === 'setup' ? 'Set your vault password' : 'Unlock your notes';
  const helperText = mode === 'setup'
    ? 'This password encrypts your notes. Keep it somewhere safe.'
    : 'Enter your password to decrypt your notes.';

  return (
    <div className="vault-unlock">
      <div className="vault-unlock__card">
        <h2 className="vault-unlock__title">{title}</h2>
        <p className="vault-unlock__helper">{helperText}</p>

        <form
          className="vault-unlock__form"
          onSubmit={(event) => {
            event.preventDefault();
            onUnlock(password);
          }}
        >
          <label className="vault-unlock__label" htmlFor="vault-password">
            Password
          </label>
          <input
            id="vault-password"
            className="vault-unlock__input"
            type="password"
            autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isBusy}
            required
          />
          {error && <div className="vault-unlock__error">{error}</div>}
          <button className="button button--primary vault-unlock__button" type="submit" disabled={isBusy}>
            {isBusy ? 'Working…' : mode === 'setup' ? 'Create vault' : 'Unlock'}
          </button>
        </form>
        <p className="vault-unlock__note">
          This browser remembers your unlock without storing the password.
        </p>
        {onSwitchToCloud && (
          <p className="vault-unlock__note">
            Want to sync across devices?{' '}
            <button
              type="button"
              className="auth-form__toggle"
              onClick={onSwitchToCloud}
              disabled={isBusy}
            >
              Sign in to sync
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
