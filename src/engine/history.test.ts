import { beforeEach, describe, expect, it } from 'vitest';
import { addHistoryEntry, clearHistory, filterBySession, loadHistory, toCsv } from './history';

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

describe('history persistence', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeMemoryStorage();
  });

  it('starts empty', () => {
    expect(loadHistory(storage)).toEqual([]);
  });

  it('persists an added entry across loads', () => {
    addHistoryEntry(
      {
        sessionId: 's1',
        sessionLabel: 'Tonight',
        patternId: 'four-corners',
        patternName: 'Four Corners',
        winningBall: 42,
        ballsCalledCount: 18,
        timestamp: 1000,
      },
      storage
    );
    const loaded = loadHistory(storage);
    expect(loaded.length).toBe(1);
    expect(loaded[0].patternName).toBe('Four Corners');
    expect(loaded[0].id).toBeTruthy();
  });

  it('clears history', () => {
    addHistoryEntry(
      {
        sessionId: 's1',
        sessionLabel: 'Tonight',
        patternId: 'x',
        patternName: 'X',
        winningBall: 1,
        ballsCalledCount: 1,
        timestamp: 1000,
      },
      storage
    );
    clearHistory(storage);
    expect(loadHistory(storage)).toEqual([]);
  });

  it('filters by session', () => {
    addHistoryEntry(
      { sessionId: 's1', sessionLabel: 'A', patternId: 'x', patternName: 'X', winningBall: 1, ballsCalledCount: 1, timestamp: 1 },
      storage
    );
    addHistoryEntry(
      { sessionId: 's2', sessionLabel: 'B', patternId: 'x', patternName: 'X', winningBall: 2, ballsCalledCount: 2, timestamp: 2 },
      storage
    );
    const all = loadHistory(storage);
    expect(filterBySession(all, 's1').length).toBe(1);
    expect(filterBySession(all, null).length).toBe(2);
  });

  it('exports to CSV with a header row and escapes commas', () => {
    addHistoryEntry(
      {
        sessionId: 's1',
        sessionLabel: 'Tonight, Hall A',
        patternId: 'x',
        patternName: 'X',
        winningBall: 7,
        ballsCalledCount: 9,
        timestamp: 0,
        note: 'great game',
      },
      storage
    );
    const csv = toCsv(loadHistory(storage));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('timestamp');
    expect(lines[1]).toContain('"Tonight, Hall A"');
    expect(lines[1]).toContain('great game');
  });

  it.each(['=1+1', '+1+1', '-2+3', '@SUM(A1)', '  =1+1'])('neutralizes formula-like CSV fields: %s', (note) => {
    addHistoryEntry(
      { sessionId: 's1', sessionLabel: 'Tonight', patternId: 'x', patternName: 'X', winningBall: 7, ballsCalledCount: 9, timestamp: 0, note },
      storage
    );
    const dataRow = toCsv(loadHistory(storage)).split('\n')[1];
    expect(dataRow).toContain(`'${note}`);
  });

  it('quotes fields containing carriage returns', () => {
    addHistoryEntry(
      { sessionId: 's1', sessionLabel: 'Tonight', patternId: 'x', patternName: 'X', winningBall: 7, ballsCalledCount: 9, timestamp: 0, note: 'line one\rline two' },
      storage
    );
    expect(toCsv(loadHistory(storage))).toContain('"line one\rline two"');
  });
});
