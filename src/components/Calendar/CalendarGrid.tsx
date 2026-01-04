import { MonthGrid } from "./MonthGrid";
import styles from "./Calendar.module.css";

interface CalendarGridProps {
  year: number;
  hasNote: (date: string) => boolean;
  onDayClick?: (date: string) => void;
  now?: Date;
}

export function CalendarGrid({
  year,
  hasNote,
  onDayClick,
  now,
}: CalendarGridProps) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className={styles.grid}>
      {months.map((month) => (
        <MonthGrid
          key={month}
          year={year}
          month={month}
          hasNote={hasNote}
          onDayClick={onDayClick}
          now={now}
        />
      ))}
    </div>
  );
}
