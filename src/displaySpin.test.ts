import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisplaySpinCoordinator } from './displaySpin';

afterEach(() => vi.useRealTimers());

function coordinator(landed: number[]): DisplaySpinCoordinator {
  return new DisplaySpinCoordinator({
    onTick: () => {},
    onLand: (ball) => landed.push(ball),
  });
}

describe('DisplaySpinCoordinator', () => {
  it('keeps the full Display spin running when the final sync arrives early', () => {
    vi.useFakeTimers();
    const landed: number[] = [];
    const spin = coordinator(landed);

    spin.receiveSpin(52, 1_000, false);
    spin.receiveSync(41, 52, true, false);
    vi.advanceTimersByTime(999);
    expect(spin.active).toBe(true);
    expect(landed).toEqual([]);

    vi.advanceTimersByTime(10);
    expect(spin.active).toBe(false);
    expect(landed).toEqual([52]);
  });

  it('restarts an early fallback as the full spin when messages arrive out of order', () => {
    vi.useFakeTimers();
    const landed: number[] = [];
    const spin = coordinator(landed);

    spin.receiveSync(41, 52, true, false);
    spin.receiveSpin(52, 1_000, false);
    vi.advanceTimersByTime(500);
    expect(spin.active).toBe(true);
    expect(landed).toEqual([]);

    vi.advanceTimersByTime(510);
    expect(landed).toEqual([52]);
  });

  it('shows a short landing spin when the Display missed the spin message', () => {
    vi.useFakeTimers();
    const landed: number[] = [];
    const spin = coordinator(landed);

    spin.receiveSync(41, 52, true, false);
    expect(spin.active).toBe(true);
    vi.advanceTimersByTime(500);

    expect(spin.active).toBe(false);
    expect(landed).toEqual([52]);
  });

  it('does not animate when a correction removes the current ball', () => {
    vi.useFakeTimers();
    const spin = coordinator([]);

    spin.receiveSync(52, 41, false, false);

    expect(spin.active).toBe(false);
  });
});
