import { beforeEach, describe, expect, it } from 'vitest';
import { drawNext } from '../engine/draw';
import { createDefaultAppState, loadAppState, saveAppState } from './appState';

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('app state persistence', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeMemoryStorage();
  });

  it('round-trips settings and mid-game draw state', () => {
    const state = createDefaultAppState();
    state.settings.venueName = 'Lakeside Hall';
    state.settings.intervalMs = 2000;
    drawNext(state.drawEngine);
    drawNext(state.drawEngine);

    saveAppState(state, storage);
    const loaded = loadAppState(storage);

    expect(loaded.settings.venueName).toBe('Lakeside Hall');
    expect(loaded.settings.intervalMs).toBe(2000);
    expect(loaded.drawEngine.called.length).toBe(2);
    expect(loaded.drawEngine.called).toEqual(state.drawEngine.called);
  });

  it('falls back to defaults when nothing is stored', () => {
    const loaded = loadAppState(storage);
    expect(loaded.gameStatus).toBe('idle');
    expect(loaded.drawEngine.called).toEqual([]);
  });
});
