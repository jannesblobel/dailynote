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

export enum AuthState {
  Loading = 'loading',
  SignedOut = 'signed_out',
  SignedIn = 'signed_in',
  AwaitingConfirmation = 'awaiting_confirmation'
}

export enum ViewType {
  Note = 'note',
  Calendar = 'calendar'
}

export interface UrlState {
  view: ViewType;
  date: string | null;
  year: number;
}

export enum DayCellState {
  Empty = 'empty',
  Past = 'past',
  Today = 'today',
  Future = 'future'
}

export enum SyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Synced = 'synced',
  Offline = 'offline',
  Error = 'error'
}
