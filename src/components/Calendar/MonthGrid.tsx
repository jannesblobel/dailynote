import { useMemo } from "react";
import { DayCell } from "./DayCell";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthName,
  getWeekdays,
  formatDate,
  getDayCellState,
} from "../../utils/date";
import { DayCellState } from "../../types";
import styles from "./MonthGrid.module.css";

interface MonthGridProps {
  year: number;
  month: number;
  hasNote: (date: string) => boolean;
  onDayClick?: (date: string) => void;
  now?: Date;
}

export function MonthGrid({
  year,
  month,
  hasNote,
  onDayClick,
  now,
}: MonthGridProps) {
  const weekdays = getWeekdays();
  const monthName = getMonthName(month);
  const resolvedNow = now ?? new Date();
  const isCurrentMonth =
    year === resolvedNow.getFullYear() && month === resolvedNow.getMonth();

  const days = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const cells: Array<{ day: number | null; date: Date | null }> = [];

    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, date: null });
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, date: new Date(year, month, day) });
    }

    return cells;
  }, [year, month]);

  return (
    <div
      className={styles.monthGrid}
      data-current-month={isCurrentMonth ? "true" : undefined}
    >
      <div className={styles.header}>{monthName}</div>
      <div className={styles.weekdays}>
        {weekdays.map((day) => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>
      <div className={styles.days}>
        {days.map((cell, index) => {
          if (cell.day === null || cell.date === null) {
            return (
              <DayCell
                key={index}
                day={null}
                state={DayCellState.Empty}
                hasNote={false}
              />
            );
          }

          const dateStr = formatDate(cell.date);
          const state = getDayCellState(cell.date, resolvedNow);

          return (
            <DayCell
              key={index}
              day={cell.day}
              date={cell.date}
              state={state}
              hasNote={hasNote(dateStr)}
              onClick={onDayClick ? () => onDayClick(dateStr) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
