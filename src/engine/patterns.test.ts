import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PATTERNS,
  createCustomPattern,
  FREE_INDEX,
  isPatternSatisfied,
  markedGridFromCalled,
  patternColumns,
} from './patterns';

function findPattern(id: string) {
  const p = BUILT_IN_PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`missing built-in pattern ${id}`);
  return p;
}

describe('built-in pattern catalog', () => {
  it('includes all patterns required by the spec', () => {
    const required = [
      'row-0',
      'col-0',
      'diag-down',
      'diag-up',
      'four-corners',
      'x',
      'blackout',
      'postage-stamp',
      'small-diamond',
      'letter-t',
      'letter-l',
      'outside-frame',
      'plus',
    ];
    for (const id of required) {
      expect(BUILT_IN_PATTERNS.some((p) => p.id === id)).toBe(true);
    }
  });

  it('blackout requires all 25 cells', () => {
    const blackout = findPattern('blackout');
    expect(blackout.cells.filter(Boolean).length).toBe(25);
  });

  it('four corners only touches the B and O columns', () => {
    const corners = findPattern('four-corners');
    expect(patternColumns(corners).sort()).toEqual(['B', 'O']);
  });

  it('a full line touches only its own column', () => {
    const colB = findPattern('col-0');
    expect(patternColumns(colB)).toEqual(['B']);
  });

  it('a row touches every column', () => {
    const row = findPattern('row-0');
    expect(patternColumns(row).sort()).toEqual(['B', 'G', 'I', 'N', 'O']);
  });
});

describe('isPatternSatisfied', () => {
  it('treats the free centre as always marked', () => {
    const diamond = findPattern('small-diamond');
    const marked = new Array(25).fill(false);
    marked[7] = true; // (1,2)
    marked[11] = true; // (2,1)
    marked[13] = true; // (2,3)
    marked[17] = true; // (3,2)
    // index 12 (free) intentionally left false
    expect(isPatternSatisfied(diamond, marked)).toBe(true);
  });

  it('fails when a required cell is missing', () => {
    const corners = findPattern('four-corners');
    const marked = new Array(25).fill(false);
    marked[0] = true;
    marked[4] = true;
    marked[20] = true;
    // missing index 24
    expect(isPatternSatisfied(corners, marked)).toBe(false);
  });
});

describe('markedGridFromCalled', () => {
  it('marks free centre regardless of called numbers', () => {
    const called = new Set<number>();
    const card = new Array(25).fill(null);
    const marked = markedGridFromCalled(called, card);
    expect(marked[FREE_INDEX]).toBe(true);
  });

  it('marks a cell only if its number was called', () => {
    const called = new Set<number>([7, 20]);
    const card = new Array(25).fill(null);
    card[0] = 7;
    card[1] = 8;
    const marked = markedGridFromCalled(called, card);
    expect(marked[0]).toBe(true);
    expect(marked[1]).toBe(false);
  });
});

describe('createCustomPattern', () => {
  it('creates a non-built-in pattern with a unique id', () => {
    const cells = new Array(25).fill(false);
    cells[0] = true;
    const p1 = createCustomPattern('My Pattern', cells);
    const p2 = createCustomPattern('My Pattern 2', cells);
    expect(p1.builtIn).toBe(false);
    expect(p1.id).not.toBe(p2.id);
    expect(p1.name).toBe('My Pattern');
  });

  it('rejects a pattern whose only selected cell is FREE', () => {
    const cells = new Array<boolean>(25).fill(false);
    cells[FREE_INDEX] = true;
    expect(() => createCustomPattern('Free only', cells)).toThrow(/non-FREE/);
  });
});
