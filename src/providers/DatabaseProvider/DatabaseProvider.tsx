'use client';

import { createContext, type ReactNode, useEffect, useRef, useState } from 'react';
import { Container } from '@/atoms/Container/Container';
import { Spinner } from '@/atoms/Spinner/Spinner';
import { DB_INIT_TIMEOUT_MS } from '@/config/database';
import { db } from '@/database/franky/franky';
import { AppError } from '@/libs/error/error';
import { DatabaseErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { ErrorService } from '@/libs/error/error.types';
import { DatabaseErrorScreen } from '@/molecules/DatabaseErrorScreen/DatabaseErrorScreen';
import { type DatabaseContextType } from '@/providers/DatabaseProvider/DatabaseProvider.types';
import { useMigrationStore } from '@/stores/migration/migration.store';

export const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null,
  retry: async () => {},
});

/**
 * DatabaseProvider initializes the Dexie database and blocks rendering
 * until the database is ready. This prevents race conditions where
 * components try to query the database before it's initialized.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  // Guards against the 'close' event (manually deleteding indexedDB fires this event) that fires during recreateDatabase() → this.close().
  // Without this, the close handler would re-trigger initDatabase and cause an infinite loop.
  const isInitializingRef = useRef(false);
  const initGenerationRef = useRef(0);

  const initDatabase = async () => {
    const generation = ++initGenerationRef.current;
    isInitializingRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      setError(null);
      setIsReady(false);
      const initializePromise = db.initialize();
      initializePromise.catch(() => {
        // Prevent an unhandled rejection if initialization loses the timeout race.
      });
      const { wasDbReset } = await Promise.race([
        initializePromise,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              Err.database(DatabaseErrorCode.INIT_FAILED, 'Database initialization timed out', {
                service: ErrorService.Local,
                operation: 'initDatabase',
                context: { timeoutMs: DB_INIT_TIMEOUT_MS },
              }),
            );
          }, DB_INIT_TIMEOUT_MS);
        }),
      ]);
      if (generation !== initGenerationRef.current) return;
      if (wasDbReset) {
        useMigrationStore.getState().setWasDbReset(true);
      }
      setIsReady(true);
    } catch (err) {
      if (generation !== initGenerationRef.current) return;
      setIsReady(false);
      if (err instanceof AppError) {
        setError(err);
      } else {
        // If it's not our AppError, it's likely a critical error from Dexie or browser
        setError(
          Err.database(DatabaseErrorCode.INIT_FAILED, 'Unexpected error during database initialization', {
            service: ErrorService.Local,
            operation: 'initDatabase',
            cause: err,
          }),
        );
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (generation === initGenerationRef.current) {
        isInitializingRef.current = false;
      }
    }
  };

  useEffect(() => {
    initDatabase();

    // Re-initialize when the DB is unexpectedly closed (e.g. user deletes IndexedDB via devtools).
    // Skips expected closes during recreateDatabase() via the isInitializingRef guard.
    const handleUnexpectedClose = () => {
      if (isInitializingRef.current) return;
      setIsReady(false);
      initDatabase();
    };

    db.on('close', handleUnexpectedClose);

    return () => {
      db.on('close').unsubscribe(handleUnexpectedClose);
    };
  }, []);

  // Gate what renders on the database state:
  // - error: block the (broken) app and show a recovery screen wired to retry()
  // - not ready: block rendering until initialization completes to avoid query race conditions
  // - ready: render the app
  let content: ReactNode;
  if (error) {
    content = <DatabaseErrorScreen onRetry={initDatabase} />;
  } else if (!isReady) {
    content = (
      <Container overrideDefaults className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Spinner />
        <a
          href="?storageRetry=1"
          className="text-sm text-muted-foreground opacity-0 [animation:db-init-timeout-hint_0.2s_ease-out_8s_forwards]"
        >
          Storage is taking too long. Reload
        </a>
      </Container>
    );
  } else {
    content = children;
  }

  return (
    <DatabaseContext.Provider
      value={{
        isReady,
        error,
        retry: initDatabase,
      }}
    >
      {content}
    </DatabaseContext.Provider>
  );
}
