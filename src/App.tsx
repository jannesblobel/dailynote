import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Modal } from './components/Modal';
import { NoteEditor } from './components/NoteEditor';
import { useUrlState } from './hooks/useUrlState';
import { useNotes } from './hooks/useNotes';

import './styles/theme.css';
import './styles/reset.css';
import './styles/components.css';

function App() {
  const { view, date, year, navigateToDate, navigateToCalendar, navigateToYear } = useUrlState();
  const { content, setContent, hasNote } = useNotes(date);

  const isModalOpen = view === 'note' && date !== null;

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
    }, 300);
  }, [navigateToCalendar, year]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <Calendar
        year={year}
        hasNote={hasNote}
        onDayClick={navigateToDate}
        onYearChange={navigateToYear}
      />

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {date && (
          <NoteEditor
            date={date}
            content={content}
            onChange={setContent}
            isClosing={isClosing}
          />
        )}
      </Modal>
    </>
  );
}

export default App;
