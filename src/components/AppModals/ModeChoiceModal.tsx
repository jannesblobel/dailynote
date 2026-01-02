import { Modal } from '../Modal';

interface ModeChoiceModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ModeChoiceModal({
  isOpen,
  onConfirm,
  onDismiss
}: ModeChoiceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} variant="overlay">
      <div className="vault-unlock">
        <div className="vault-unlock__card">
          <h2 className="vault-unlock__title">Sync your notes?</h2>
          <p className="vault-unlock__helper">
            Create an account to back up and sync across devices.
          </p>
          <div className="vault-unlock__choices">
            <button
              className="button button--primary vault-unlock__button"
              onClick={onConfirm}
            >
              Sign in to sync
            </button>
            <button
              className="button button--ghost vault-unlock__button"
              onClick={onDismiss}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
