import { SyncStatus } from '../../types';

interface SyncIndicatorProps {
  status: SyncStatus;
}

export function SyncIndicator({ status }: SyncIndicatorProps) {
  const getLabel = () => {
    switch (status) {
      case SyncStatus.Syncing:
        return 'Syncing...';
      case SyncStatus.Synced:
        return 'Synced';
      case SyncStatus.Offline:
        return 'Offline';
      case SyncStatus.Error:
        return 'Sync error';
      default:
        return '';
    }
  };

  const label = getLabel();
  if (!label) return null;

  return (
    <span className={`sync-indicator sync-indicator--${status}`}>
      {status === SyncStatus.Syncing && <span className="sync-indicator__spinner" />}
      {label}
    </span>
  );
}
