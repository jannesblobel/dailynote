import { Modal } from '../Modal';
import { AppMode } from '../../hooks/useAppMode';

interface VaultErrorModalProps {
  isOpen: boolean;
  error: string | null;
  mode: AppMode;
  onSignOut: () => Promise<void>;
}

export function VaultErrorModal({
  isOpen,
  error,
  mode,
  onSignOut
}: VaultErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} variant="overlay">
      <div className="vault-unlock">
        <div className="vault-unlock__card">
          <h2 className="vault-unlock__title">Unlock Error</h2>
          <p className="vault-unlock__error">{error}</p>
          <p className="vault-unlock__helper">
            Please try again.
          </p>
          {mode === AppMode.Cloud && (
            <button
              className="button button--primary vault-unlock__button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
