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

  it('recovers safely from malformed nested state', () => {
    storage.setItem('bingo:appstate', JSON.stringify({
      settings: { intervalMs: 'fast', voiceEnabled: 'yes' },
      session: {},
      drawEngine: {},
      customPatterns: [{ id: 'bad', cells: [] }],
      activePatternId: 'missing',
      gameStatus: 'won',
      winner: {},
    }));
    const loaded = loadAppState(storage);
    expect(loaded.settings.intervalMs).toBe(5000);
    expect(loaded.settings.voiceEnabled).toBe(true);
    expect(loaded.session.wonPatternIds).toEqual([]);
    expect(loaded.drawEngine.called).toEqual([]);
    expect(loaded.drawEngine.remaining).toHaveLength(75);
    expect(loaded.customPatterns).toEqual([]);
    expect(loaded.gameStatus).toBe('idle');
  });

  it('rejects a persisted draw pool with duplicate or missing balls', () => {
    const state = createDefaultAppState();
    state.drawEngine = { called: [1, 1], remaining: [2, 3] };
    saveAppState(state, storage);
    const loaded = loadAppState(storage);
    expect(loaded.drawEngine.called).toEqual([]);
    expect(loaded.drawEngine.remaining).toHaveLength(75);
  });
});
