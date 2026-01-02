import { Modal } from '../Modal';
import { AuthForm } from '../AuthForm';
import { AuthState } from '../../types';

interface CloudAuthModalProps {
  isOpen: boolean;
  isSigningIn: boolean;
  authState: AuthState;
  confirmationEmail: string | null;
  isBusy: boolean;
  error: string | null;
  localPassword: string | null;
  onBackToSignIn: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export function CloudAuthModal({
  isOpen,
  isSigningIn,
  authState,
  confirmationEmail,
  isBusy,
  error,
  localPassword,
  onBackToSignIn,
  onSignIn,
  onSignUp
}: CloudAuthModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} variant="overlay">
      {isSigningIn ? (
        <div className="vault-unlock">
          <div className="vault-unlock__card">
            <div className="note-loading">Signing in...</div>
          </div>
        </div>
      ) : authState === AuthState.AwaitingConfirmation ? (
        <div className="vault-unlock">
          <div className="vault-unlock__card">
            <h2 className="vault-unlock__title">Check your email</h2>
            <p className="vault-unlock__helper">
              We sent a confirmation link to <strong>{confirmationEmail}</strong>.
              Click the link to activate your account.
            </p>
            <button
              className="button button--primary vault-unlock__button"
              onClick={onBackToSignIn}
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <AuthForm
          isBusy={isBusy}
          error={error}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          defaultPassword={localPassword}
        />
      )}
    </Modal>
  );
}
