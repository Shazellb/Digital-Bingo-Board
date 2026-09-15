interface ReloadGuardOptions {
  canReload(): boolean;
  beforeReload(): void;
  reload(): void;
  schedule(callback: () => void, delayMs: number): void;
}

/** Coalesces update requests and waits until the page remains safe to reload. */
export function createReloadGuard({ canReload, beforeReload, reload, schedule }: ReloadGuardOptions): () => void {
  let requested = false;
  let scheduled = false;
  let preparing = false;

  const scheduleAttempt = (delayMs: number): void => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      attemptReload();
    }, delayMs);
  };

  const attemptReload = (): void => {
    if (!requested) return;
    if (!canReload()) {
      preparing = false;
      scheduleAttempt(100);
      return;
    }
    if (!preparing) {
      preparing = true;
      beforeReload();
      scheduleAttempt(700);
      return;
    }
    requested = false;
    preparing = false;
    reload();
  };

  return () => {
    if (requested) return;
    requested = true;
    attemptReload();
  };
}
