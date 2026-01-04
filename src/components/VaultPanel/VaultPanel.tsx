import type { ReactNode } from "react";
import styles from "./VaultPanel.module.css";

interface VaultPanelProps {
  title?: ReactNode;
  helper?: ReactNode;
  children: ReactNode;
}

export function VaultPanel({ title, helper, children }: VaultPanelProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {title && <h2 className={styles.title}>{title}</h2>}
        {helper && <p className={styles.helper}>{helper}</p>}
        {children}
      </div>
    </div>
  );
}
