import { useState } from "react";
import { Button } from "../Button";
import { VaultPanel } from "../VaultPanel";
import styles from "../VaultPanel/VaultPanel.module.css";

interface VaultUnlockProps {
  mode: "setup" | "unlock";
  isBusy: boolean;
  error: string | null;
  onUnlock: (password: string) => void;
  onSwitchToCloud?: () => void;
}

export function VaultUnlock({
  mode,
  isBusy,
  error,
  onUnlock,
  onSwitchToCloud,
}: VaultUnlockProps) {
  const [password, setPassword] = useState("");

  const title =
    mode === "setup" ? "Set your vault password" : "Unlock your notes";
  const helperText =
    mode === "setup"
      ? "This password encrypts your notes. Keep it somewhere safe."
      : "Enter your password to decrypt your notes.";

  return (
    <VaultPanel title={title} helper={helperText}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onUnlock(password);
        }}
      >
        <label className={styles.label} htmlFor="vault-password">
          Password
        </label>
        <input
          id="vault-password"
          className={styles.input}
          type="password"
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isBusy}
          required
        />
        {error && <div className={styles.error}>{error}</div>}
        <Button
          className={styles.actionButton}
          variant="primary"
          type="submit"
          disabled={isBusy}
        >
          {isBusy ? "Working…" : mode === "setup" ? "Create vault" : "Unlock"}
        </Button>
      </form>
      <p className={styles.note}>
        This browser remembers your unlock without storing the password.
      </p>
      {onSwitchToCloud && (
        <p className={styles.note}>
          Want to sync across devices?{" "}
          <button
            type="button"
            className={styles.toggle}
            onClick={onSwitchToCloud}
            disabled={isBusy}
          >
            Sign in to sync
          </button>
        </p>
      )}
    </VaultPanel>
  );
}
