import { describe, expect, it } from 'vitest';
import { columnOf, createDrawEngine, drawNext } from './draw';

describe('columnOf', () => {
  it('maps ball numbers to the correct column', () => {
    expect(columnOf(1)).toBe('B');
    expect(columnOf(15)).toBe('B');
    expect(columnOf(16)).toBe('I');
    expect(columnOf(30)).toBe('I');
    expect(columnOf(31)).toBe('N');
    expect(columnOf(45)).toBe('N');
    expect(columnOf(46)).toBe('G');
    expect(columnOf(60)).toBe('G');
    expect(columnOf(61)).toBe('O');
    expect(columnOf(75)).toBe('O');
  });

  it('throws for out-of-range numbers', () => {
    expect(() => columnOf(0)).toThrow();
    expect(() => columnOf(76)).toThrow();
  });
});

describe('drawNext', () => {
  it('never repeats a ball across a full game', () => {
    const state = createDrawEngine();
    const seen = new Set<number>();
    let n = drawNext(state);
    while (n !== null) {
      expect(seen.has(n)).toBe(false);
      seen.add(n);
      n = drawNext(state);
    }
    expect(seen.size).toBe(75);
    expect(state.called.length).toBe(75);
    expect(state.remaining.length).toBe(0);
  });

  it('returns null once all 75 balls are drawn', () => {
    const state = createDrawEngine();
    for (let i = 0; i < 75; i++) drawNext(state);
    expect(drawNext(state)).toBeNull();
  });

  it('restricts smart-draw to the allowed columns only', () => {
    const state = createDrawEngine();
    for (let i = 0; i < 30; i++) {
      const n = drawNext(state, { allowedColumns: ['B', 'O'] });
      expect(n).not.toBeNull();
      expect(['B', 'O']).toContain(columnOf(n!));
    }
    // B and O together have 30 balls; the 31st restricted draw must be null.
    expect(drawNext(state, { allowedColumns: ['B', 'O'] })).toBeNull();
    // other columns remain untouched
    expect(state.remaining.length).toBe(45);
  });

  it('uses the injected random source deterministically', () => {
    const state = createDrawEngine();
    // always pick the first item in the pool
    const n = drawNext(state, { random: () => 0 });
    expect(n).toBe(1);
    const n2 = drawNext(state, { random: () => 0 });
    expect(n2).toBe(2);
  });

  it('draws every ball in a column-restricted game without repeats', () => {
    const state = createDrawEngine();
    const seen = new Set<number>();
    let n = drawNext(state, { allowedColumns: ['N'] });
    while (n !== null) {
      expect(seen.has(n)).toBe(false);
      seen.add(n);
      n = drawNext(state, { allowedColumns: ['N'] });
    }
    expect(seen.size).toBe(15);
  });
});
