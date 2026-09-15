import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReloadGuard } from './reloadGuard';

afterEach(() => vi.useRealTimers());

describe('createReloadGuard', () => {
  it('defers an update reload until a draw spin is idle', () => {
    vi.useFakeTimers();
    let spinning = true;
    const beforeReload = vi.fn();
    const reload = vi.fn();
    const requestReload = createReloadGuard({
      canReload: () => !spinning,
      beforeReload,
      reload,
      schedule: (callback, delayMs) => { window.setTimeout(callback, delayMs); },
    });

    requestReload();
    requestReload();
    vi.advanceTimersByTime(1_000);

    expect(beforeReload).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    spinning = false;
    vi.advanceTimersByTime(100);
    expect(beforeReload).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();

    spinning = true;
    vi.advanceTimersByTime(700);
    expect(reload).not.toHaveBeenCalled();

    spinning = false;
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(700);
    expect(reload).toHaveBeenCalledOnce();
  });
});
