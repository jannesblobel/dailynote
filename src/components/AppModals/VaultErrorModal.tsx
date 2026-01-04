import { Modal } from "../Modal";
import { Button } from "../Button";
import { VaultPanel } from "../VaultPanel";
import { AppMode } from "../../hooks/useAppMode";
import styles from "../VaultPanel/VaultPanel.module.css";

interface VaultErrorModalProps {
  isOpen: boolean;
  error: string | null;
  mode: AppMode;
  onSignOut: () => Promise<void>;
  onDismiss: () => void;
}

export function VaultErrorModal({
  isOpen,
  error,
  mode,
  onSignOut,
  onDismiss,
}: VaultErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} variant="overlay">
      <VaultPanel title="Unlock Error">
        {error && <p className={styles.error}>{error}</p>}
        <p className={styles.helper}>Please try again.</p>
        {mode === AppMode.Cloud && (
          <Button
            className={styles.actionButton}
            variant="primary"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        )}
      </VaultPanel>
    </Modal>
  );
}
