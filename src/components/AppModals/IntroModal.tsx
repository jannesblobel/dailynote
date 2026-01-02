import { Modal } from '../Modal';

interface IntroModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onStartWriting: () => void;
  onSetupSync: () => void;
}

export function IntroModal({
  isOpen,
  onDismiss,
  onStartWriting,
  onSetupSync
}: IntroModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} variant="overlay">
      <div className="vault-unlock">
        <div className="vault-unlock__card">
          <h2 className="vault-unlock__title">Welcome to DailyNote</h2>
          <p className="vault-unlock__helper">
            A calm place for one note per day. No account required to start.
          </p>
          <ul className="intro-list">
            <li>Your notes are encrypted on this device before storage.</li>
            <li>Sync is optional and keeps encrypted backups in the cloud.</li>
          </ul>
          <div className="vault-unlock__choices">
            <button
              className="button button--primary vault-unlock__button"
              onClick={onStartWriting}
            >
              Start writing
            </button>
            <button
              className="button button--ghost vault-unlock__button"
              onClick={() => {
                onDismiss();
                onSetupSync();
              }}
            >
              Set up sync
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
