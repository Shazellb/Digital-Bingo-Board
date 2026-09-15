import { describe, expect, it } from 'vitest';
import { ConfettiFireTracker, createMemoryConfettiStorage } from './confettiTracker';

describe('ConfettiFireTracker', () => {
  it('fires once when the game transitions into won', () => {
    const tracker = new ConfettiFireTracker(createMemoryConfettiStorage());

    expect(tracker.observe('playing', null)).toBe(false);
    expect(tracker.observe('won', { timestamp: 1000 })).toBe(true);
  });

  it('does not re-fire on a re-sync of the same win', () => {
    const tracker = new ConfettiFireTracker(createMemoryConfettiStorage());

    expect(tracker.observe('won', { timestamp: 1000 })).toBe(true);
    expect(tracker.observe('won', { timestamp: 1000 })).toBe(false);
    expect(tracker.observe('won', { timestamp: 1000 })).toBe(false);
  });

  it('does not re-fire when a Display reload reconstructs the tracker for the same win', () => {
    const storage = createMemoryConfettiStorage();
    const first = new ConfettiFireTracker(storage);
    expect(first.observe('won', { timestamp: 1000 })).toBe(true);

    // Simulate a reload: a fresh tracker instance reads the same persisted storage.
    const afterReload = new ConfettiFireTracker(storage);
    expect(afterReload.observe('won', { timestamp: 1000 })).toBe(false);
  });

  it('does not re-fire on a Controller reconnect that re-syncs an already-won game', () => {
    const tracker = new ConfettiFireTracker(createMemoryConfettiStorage());

    expect(tracker.observe('won', { timestamp: 1000 })).toBe(true);
    // Reconnect resends the full won state.
    expect(tracker.observe('won', { timestamp: 1000 })).toBe(false);
  });

  it('resets when a new game starts and fires again for the next win', () => {
    const tracker = new ConfettiFireTracker(createMemoryConfettiStorage());

    expect(tracker.observe('won', { timestamp: 1000 })).toBe(true);
    expect(tracker.observe('playing', null)).toBe(false);
    expect(tracker.observe('won', { timestamp: 2000 })).toBe(true);
  });

  it('does not fire when the game reports won without a winner record', () => {
    const tracker = new ConfettiFireTracker(createMemoryConfettiStorage());

    expect(tracker.observe('won', null)).toBe(false);
  });
});
