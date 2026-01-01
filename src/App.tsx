import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Modal } from './components/Modal';
import { NoteEditor } from './components/NoteEditor';
import { VaultUnlock } from './components/VaultUnlock';
import { useUrlState } from './hooks/useUrlState';
import { useNotes } from './hooks/useNotes';
import { useVault } from './hooks/useVault';

import './styles/theme.css';
import './styles/reset.css';
import './styles/components.css';

function App() {
  const { view, date, year, navigateToDate, navigateToCalendar, navigateToYear } = useUrlState();
  const vault = useVault();
  const { content, setContent, hasNote, isDecrypting } = useNotes(date, vault.vaultKey);

  const isModalOpen = view === 'note' && date !== null;
  const [showModalContent, setShowModalContent] = useState(false);
  const modalTimerRef = useRef<number | null>(null);

  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleCloseModal = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      navigateToCalendar(year);
    }, 200);
  }, [navigateToCalendar, year]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (modalTimerRef.current !== null) {
      window.clearTimeout(modalTimerRef.current);
    }
    if (isModalOpen) {
      modalTimerRef.current = window.setTimeout(() => {
        setShowModalContent(true);
      }, 100);
    } else {
      setShowModalContent(false);
    }
    return () => {
      if (modalTimerRef.current !== null) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
    };
  }, [isModalOpen]);

  return (
    <>
      <Calendar
        year={year}
        hasNote={hasNote}
        onDayClick={navigateToDate}
        onYearChange={navigateToYear}
      />

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {date && showModalContent && (
          !vault.isReady ? (
            vault.showPrepare ? (
              <div className="note-loading">Preparing secure vault…</div>
            ) : null
          ) : vault.isLocked ? (
            <VaultUnlock
              mode={vault.hasVault ? 'unlock' : 'setup'}
              isBusy={vault.isBusy}
              error={vault.error}
              onUnlock={vault.unlock}
            />
          ) : (
            <NoteEditor
              date={date}
              content={isDecrypting ? '' : content}
              onChange={setContent}
              isClosing={isClosing}
              isDecrypting={isDecrypting}
            />
          )
        )}
      </Modal>
    </>
  );
}

export default App;
