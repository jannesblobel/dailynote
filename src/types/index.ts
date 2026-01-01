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

export const AuthState = {
  Loading: 'loading',
  SignedOut: 'signed_out',
  SignedIn: 'signed_in',
  AwaitingConfirmation: 'awaiting_confirmation'
} as const;

export type AuthState = (typeof AuthState)[keyof typeof AuthState];

export const ViewType = {
  Note: 'note',
  Calendar: 'calendar'
} as const;

export type ViewType = (typeof ViewType)[keyof typeof ViewType];

export interface UrlState {
  view: ViewType;
  date: string | null;
  year: number;
}

export const DayCellState = {
  Empty: 'empty',
  Past: 'past',
  Today: 'today',
  Future: 'future'
} as const;

export type DayCellState = (typeof DayCellState)[keyof typeof DayCellState];

export const SyncStatus = {
  Idle: 'idle',
  Syncing: 'syncing',
  Synced: 'synced',
  Offline: 'offline',
  Error: 'error'
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];
