import { Button } from "../Button";
import { SyncIndicator } from "../SyncIndicator";
import type { SyncStatus } from "../../types";
import type { PendingOpsSummary } from "../../domain/sync";
import styles from "./Calendar.module.css";

interface CalendarHeaderProps {
  year: number;
  commitHash: string;
  commitUrl: string;
  onYearChange: (year: number) => void;
  syncStatus?: SyncStatus;
  pendingOps?: PendingOpsSummary;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export function CalendarHeader({
  year,
  commitHash,
  commitUrl,
  onYearChange,
  syncStatus,
  pendingOps,
  onSignIn,
  onSignOut,
}: CalendarHeaderProps) {
  return (
    <div className={styles.header}>
      <a
        className={[styles.auth, styles.headerCommit].filter(Boolean).join(" ")}
        href={commitUrl}
        target="_blank"
        rel="noreferrer"
      >
        <span className={styles.footerIcon} aria-hidden="true" />
        {commitHash}
      </a>
      <div className={styles.headerSpacer} aria-hidden="true" />
      <div className={styles.headerActions}>
        {syncStatus && (
          <SyncIndicator status={syncStatus} pendingOps={pendingOps} />
        )}
        {onSignIn && (
          <button className={styles.auth} onClick={onSignIn}>
            Sign in to sync
          </button>
        )}
        {onSignOut && (
          <button className={styles.auth} onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>
      <div className={styles.yearControls}>
        <Button
          icon
          onClick={() => onYearChange(year - 1)}
          aria-label="Previous year"
        >
          ←
        </Button>
        <span className={styles.year}>{year}</span>
        <Button
          icon
          onClick={() => onYearChange(year + 1)}
          aria-label="Next year"
        >
          →
        </Button>
      </div>
    </div>
  );
}
