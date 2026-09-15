import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawSpinner, spinDurationForInterval } from './spin';

afterEach(() => vi.useRealTimers());

describe('DrawSpinner', () => {
  it('keeps every spin shorter than its auto-draw interval', () => {
    for (const interval of [1000, 2000, 3000, 5000, 10000]) {
      expect(spinDurationForInterval(interval)).toBeLessThan(interval);
    }
  });

  it('lands on the ball selected before the presentation spin', () => {
    vi.useFakeTimers();
    const spinner = new DrawSpinner();
    const selected = vi.fn(() => 42);
    const landed: number[] = [];

    expect(spinner.begin(selected, { durationMs: 500, random: () => 0, onTick: () => {}, onLand: (ball) => landed.push(ball) })).toBe(true);
    vi.advanceTimersByTime(600);

    expect(selected).toHaveBeenCalledTimes(1);
    expect(landed).toEqual([42]);
  });

  it('blocks a second draw while the first ball is spinning', () => {
    vi.useFakeTimers();
    const spinner = new DrawSpinner();
    const selected = vi.fn(() => 7);
    const options = { durationMs: 500, onTick: () => {}, onLand: () => {} };

    expect(spinner.begin(selected, options)).toBe(true);
    expect(spinner.begin(selected, options)).toBe(false);
    expect(selected).toHaveBeenCalledTimes(1);
  });
});
