import { Modal } from "../Modal";
import { Button } from "../Button";
import { VaultPanel } from "../VaultPanel";
import styles from "../VaultPanel/VaultPanel.module.css";

interface ModeChoiceModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ModeChoiceModal({
  isOpen,
  onConfirm,
  onDismiss,
}: ModeChoiceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss}>
      <VaultPanel
        title="Sync your notes?"
        helper="Create an account to back up and sync across devices."
      >
        <div className={styles.choices}>
          <Button
            className={styles.actionButton}
            variant="primary"
            onClick={onConfirm}
          >
            Sign in to sync
          </Button>
          <Button
            className={styles.actionButton}
            variant="ghost"
            onClick={onDismiss}
          >
            Not now
          </Button>
        </div>
      </VaultPanel>
    </Modal>
  );
}
