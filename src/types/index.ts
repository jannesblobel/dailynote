export interface Note {
  date: string; // "DD-MM-YYYY"
  content: string;
  updatedAt: string; // ISO timestamp
}

export interface SyncedNote extends Note {
  id?: string;
  revision: number;
  serverUpdatedAt?: string;
  deleted?: boolean;
}

export type ViewType = 'note' | 'calendar';

export interface UrlState {
  view: ViewType;
  date: string | null;
  year: number;
}

export type DayCellState = 'empty' | 'past' | 'today' | 'future';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
