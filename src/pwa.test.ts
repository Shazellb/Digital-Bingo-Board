import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPwaUpdates } from './pwa';
import { getRegisteredOptions, resetRegisteredOptions } from './test/virtualPwaRegister';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetRegisteredOptions();
  document.body.innerHTML = '';
  sessionStorage.clear();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('setupPwaUpdates', () => {
  it('routes the registerSW activation reload through the spin guard exactly once', () => {
    vi.useFakeTimers();
    const serviceWorker = new EventTarget() as EventTarget & { controller: object };
    serviceWorker.controller = {};
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    let spinning = true;
    const reloadPage = vi.fn();

    setupPwaUpdates({ canReload: () => !spinning, reloadPage });
    const options = getRegisteredOptions();
    expect(options?.onNeedReload).toBeTypeOf('function');
    if (!options?.onNeedReload) throw new Error('registerSW did not receive onNeedReload');
    const requestActivatedReload = options.onNeedReload;

    requestActivatedReload();
    vi.advanceTimersByTime(1_000);
    expect(reloadPage).not.toHaveBeenCalled();
    expect(document.querySelector('.update-toast')).toBeNull();

    spinning = false;
    vi.advanceTimersByTime(100);
    expect(document.querySelector('.update-toast')?.textContent).toContain('Updating');
    vi.advanceTimersByTime(700);
    expect(reloadPage).toHaveBeenCalledOnce();

    requestActivatedReload();
    vi.advanceTimersByTime(1_000);
    expect(reloadPage).toHaveBeenCalledOnce();
  });
});
