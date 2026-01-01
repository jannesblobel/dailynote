import type { SyncStatus } from '../../types';

interface SyncIndicatorProps {
  status: SyncStatus;
}

export function SyncIndicator({ status }: SyncIndicatorProps) {
  const getLabel = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Sync error';
      default:
        return '';
    }
  };

  const label = getLabel();
  if (!label) return null;

  return (
    <span className={`sync-indicator sync-indicator--${status}`}>
      {status === 'syncing' && <span className="sync-indicator__spinner" />}
      {label}
    </span>
  );
}
