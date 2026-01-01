import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { NoteEditor } from './NoteEditor';
import { AuthForm } from './AuthForm';
import { VaultUnlock } from './VaultUnlock';
import { isContentEmpty } from '../utils/sanitize';
import { AppMode } from '../hooks/useAppMode';
import { AuthState, ViewType } from '../types';
import { useActiveVaultContext } from '../contexts/activeVaultContext';
import { useAppModeContext } from '../contexts/appModeContext';
import { useNoteRepositoryContext } from '../contexts/noteRepositoryContext';
import { useUrlStateContext } from '../contexts/urlStateContext';

export function AppModals() {
  const {
    mode,
    isModeChoiceOpen,
    pendingModeChoice,
    openModeChoice,
    closeModeChoice,
    requestModeChoice,
    switchToCloud
  } = useAppModeContext();
  const {
    auth,
    localVault,
    cloudVault,
    isVaultReady,
    isVaultLocked,
    isVaultUnlocked,
    vaultError,
    handleLocalUnlock,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    localPassword
  } = useActiveVaultContext();
  const {
    content,
    setContent,
    isDecrypting,
    noteDates
  } = useNoteRepositoryContext();
  const {
    view,
    date,
    year,
    navigateToCalendar
  } = useUrlStateContext();
  const isNoteModalOpen = view === ViewType.Note && date !== null && isVaultUnlocked;
  const [showModalContent, setShowModalContent] = useState(false);
  const modalTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleCloseModal = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    setShowModalContent(false);

    setIsClosing(true);
    const hasLocalNote = noteDates.size > 0 || !isContentEmpty(content);
    const shouldPromptModeChoice = mode === AppMode.Local && hasLocalNote;
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      navigateToCalendar(year);
      if (shouldPromptModeChoice) {
        requestModeChoice();
      }
    }, 200);
  }, [content, mode, navigateToCalendar, noteDates.size, requestModeChoice, year]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (modalTimerRef.current !== null) {
      window.clearTimeout(modalTimerRef.current);
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setShowModalContent(false);
    }, 0);
    if (isNoteModalOpen) {
      modalTimerRef.current = window.setTimeout(() => {
        setShowModalContent(true);
      }, 100);
    }
    return () => {
      if (modalTimerRef.current !== null) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [isNoteModalOpen]);

  useEffect(() => {
    if (!pendingModeChoice || isNoteModalOpen) return;
    openModeChoice();
  }, [pendingModeChoice, isNoteModalOpen, openModeChoice]);

  const showLocalVaultModal = mode === AppMode.Local && isVaultLocked && localVault.isReady && localVault.requiresPassword;
  const isSigningIn = auth.authState === AuthState.Loading ||
    (mode === AppMode.Cloud && auth.authState === AuthState.SignedIn && (!cloudVault.isReady || cloudVault.isBusy));
  const showCloudAuthModal = mode === AppMode.Cloud && (
    auth.authState === AuthState.SignedOut ||
    auth.authState === AuthState.AwaitingConfirmation ||
    isSigningIn
  );

  return (
    <>
      <Modal isOpen={isModeChoiceOpen} onClose={() => {}} variant="overlay">
        <div className="vault-unlock">
          <div className="vault-unlock__card">
            <h2 className="vault-unlock__title">Sync your notes?</h2>
            <p className="vault-unlock__helper">
              Create an account to back up and sync across devices.
            </p>
            <div className="vault-unlock__choices">
              <button
                className="button button--primary vault-unlock__button"
                onClick={switchToCloud}
              >
                Sign in to sync
              </button>
              <button
                className="button button--ghost vault-unlock__button"
                onClick={closeModeChoice}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showLocalVaultModal} onClose={() => {}} variant="overlay">
        <VaultUnlock
          mode={localVault.hasVault ? 'unlock' : 'setup'}
          isBusy={localVault.isBusy}
          error={localVault.error}
          onUnlock={handleLocalUnlock}
          onSwitchToCloud={switchToCloud}
        />
      </Modal>

      <Modal isOpen={showCloudAuthModal} onClose={() => {}} variant="overlay">
        {isSigningIn ? (
          <div className="vault-unlock">
            <div className="vault-unlock__card">
              <div className="note-loading">Signing in...</div>
            </div>
          </div>
        ) : auth.authState === AuthState.AwaitingConfirmation ? (
          <div className="vault-unlock">
            <div className="vault-unlock__card">
              <h2 className="vault-unlock__title">Check your email</h2>
              <p className="vault-unlock__helper">
                We sent a confirmation link to <strong>{auth.confirmationEmail}</strong>.
                Click the link to activate your account.
              </p>
              <button
                className="button button--primary vault-unlock__button"
                onClick={auth.backToSignIn}
              >
                Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <AuthForm
            isBusy={auth.isBusy}
            error={auth.error}
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            defaultPassword={localPassword}
          />
        )}
      </Modal>

      <Modal isOpen={!!vaultError && isVaultReady} onClose={() => {}} variant="overlay">
        <div className="vault-unlock">
          <div className="vault-unlock__card">
            <h2 className="vault-unlock__title">Unlock Error</h2>
            <p className="vault-unlock__error">{vaultError}</p>
            <p className="vault-unlock__helper">
              Please try again.
            </p>
            {mode === AppMode.Cloud && (
              <button
                className="button button--primary vault-unlock__button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isNoteModalOpen} onClose={handleCloseModal}>
        {date && showModalContent && (
          <NoteEditor
            date={date}
            content={isDecrypting ? '' : content}
            onChange={setContent}
            isClosing={isClosing}
            isDecrypting={isDecrypting}
          />
        )}
      </Modal>
    </>
  );
}
