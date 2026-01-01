import { useState } from 'react';
import { Calendar } from './components/Calendar';
import { AppModals } from './components/AppModals';
import { useUrlState } from './hooks/useUrlState';
import { AuthState, useAuth } from './hooks/useAuth';
import { AppMode, useAppMode } from './hooks/useAppMode';
import { useActiveVault } from './hooks/useActiveVault';
import { useLocalMigration } from './hooks/useLocalMigration';
import { useNoteRepository } from './hooks/useNoteRepository';
import { AppModeProvider } from './contexts/AppModeProvider';
import { ActiveVaultProvider } from './contexts/ActiveVaultProvider';
import { NoteRepositoryProvider } from './contexts/NoteRepositoryProvider';
import { UrlStateProvider } from './contexts/UrlStateProvider';

import './styles/theme.css';
import './styles/reset.css';
import './styles/components.css';

function App() {
  const urlState = useUrlState();
  const { date, year, navigateToDate, navigateToYear } = urlState;
  const auth = useAuth();
  const appMode = useAppMode({ authState: auth.authState });
  const activeVault = useActiveVault({
    auth,
    mode: appMode.mode,
    setMode: appMode.setMode
  });
  const [hasMigratedLocal, setHasMigratedLocal] = useState(false);
  const notes = useNoteRepository({
    mode: appMode.mode,
    authUser: auth.user,
    vaultKey: activeVault.vaultKey,
    cloudCacheKey: activeVault.cachedCloudVaultKey,
    date,
    year
  });

  useLocalMigration({
    mode: appMode.mode,
    cloudRepo: notes.syncedRepo,
    cloudKey: activeVault.vaultKey,
    localKey: activeVault.localVault.vaultKey,
    hasMigrated: hasMigratedLocal,
    onMigrated: () => setHasMigratedLocal(true),
    triggerSync: notes.triggerSync
  });

  return (
    <UrlStateProvider value={urlState}>
      <AppModeProvider value={appMode}>
        <ActiveVaultProvider value={activeVault}>
          <NoteRepositoryProvider value={notes}>
            <>
              {/* Calendar is always rendered as background */}
              <Calendar
                year={year}
                hasNote={notes.hasNote}
                onDayClick={activeVault.isVaultUnlocked ? navigateToDate : undefined}
                onYearChange={navigateToYear}
                syncStatus={appMode.mode === AppMode.Cloud && activeVault.isVaultUnlocked ? notes.syncStatus : undefined}
                onSignIn={appMode.mode !== AppMode.Cloud && auth.authState !== AuthState.SignedIn ? appMode.switchToCloud : undefined}
                onSignOut={appMode.mode === AppMode.Cloud && auth.authState === AuthState.SignedIn ? activeVault.handleSignOut : undefined}
              />

              <AppModals />
            </>
          </NoteRepositoryProvider>
        </ActiveVaultProvider>
      </AppModeProvider>
    </UrlStateProvider>
  );
}

export default App;
