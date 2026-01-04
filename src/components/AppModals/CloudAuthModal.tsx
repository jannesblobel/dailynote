import { Modal } from "../Modal";
import { Button } from "../Button";
import { AuthForm } from "../AuthForm";
import { VaultPanel } from "../VaultPanel";
import { AuthState } from "../../types";
import styles from "../VaultPanel/VaultPanel.module.css";

interface CloudAuthModalProps {
  isOpen: boolean;
  isSigningIn: boolean;
  authState: AuthState;
  confirmationEmail: string | null;
  isBusy: boolean;
  error: string | null;
  localPassword: string | null;
  onDismiss: () => void;
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
  onDismiss,
  onBackToSignIn,
  onSignIn,
  onSignUp,
}: CloudAuthModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss}>
      {isSigningIn ? (
        <VaultPanel>
          <div className={styles.loading}>Signing in...</div>
        </VaultPanel>
      ) : authState === AuthState.AwaitingConfirmation ? (
        <VaultPanel
          title="Check your email"
          helper={
            <>
              We sent a confirmation link to{" "}
              <strong>{confirmationEmail}</strong>. Click the link to activate
              your account.
            </>
          }
        >
          <Button
            className={styles.actionButton}
            variant="primary"
            onClick={onBackToSignIn}
          >
            Back to sign in
          </Button>
        </VaultPanel>
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
