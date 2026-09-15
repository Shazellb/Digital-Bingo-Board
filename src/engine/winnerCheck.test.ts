import { describe, expect, it } from 'vitest';
import { BUILT_IN_PATTERNS } from './patterns';
import { checkCardEntry, quickCheck } from './winnerCheck';

function findPattern(id: string) {
  const p = BUILT_IN_PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
}

describe('quickCheck', () => {
  it('rejects a claim when too few balls have been called', () => {
    const corners = findPattern('four-corners');
    const result = quickCheck(corners, 2);
    expect(result.valid).toBe(false);
  });

  it('accepts once enough balls have been called', () => {
    const corners = findPattern('four-corners');
    const result = quickCheck(corners, 4);
    expect(result.valid).toBe(true);
  });
});

describe('checkCardEntry', () => {
  it('validates a correct four-corners claim', () => {
    const corners = findPattern('four-corners');
    const card = new Array(25).fill(null);
    card[0] = 3; // B
    card[4] = 65; // O
    card[20] = 10; // B
    card[24] = 70; // O
    const called = new Set([3, 65, 10, 70]);
    const result = checkCardEntry(corners, card, called);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects when a required number was not called', () => {
    const corners = findPattern('four-corners');
    const card = new Array(25).fill(null);
    card[0] = 3;
    card[4] = 65;
    card[20] = 10;
    card[24] = 70;
    const called = new Set([3, 65, 10]); // 70 missing
    const result = checkCardEntry(corners, card, called);
    expect(result.valid).toBe(false);
  });

  it('rejects a number that is outside its column range', () => {
    const corners = findPattern('four-corners');
    const card = new Array(25).fill(null);
    card[0] = 99; // invalid for B column
    card[4] = 65;
    card[20] = 10;
    card[24] = 70;
    const called = new Set([99, 65, 10, 70]);
    const result = checkCardEntry(corners, card, called);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing entry for a required cell', () => {
    const corners = findPattern('four-corners');
    const card = new Array(25).fill(null);
    card[0] = 3;
    // missing 4, 20, 24
    const called = new Set([3]);
    const result = checkCardEntry(corners, card, called);
    expect(result.valid).toBe(false);
  });

  it('treats the free centre as satisfied without an entry', () => {
    const plus = findPattern('plus');
    const card = new Array(25).fill(null);
    // row 2 (indexes 10-14) and col 2 (indexes 2,7,12,17,22); 12 is free
    const requiredIdx = [10, 11, 13, 14, 2, 7, 17, 22];
    const numbers: Record<number, number> = { 10: 5, 11: 20, 13: 50, 14: 70, 2: 31, 7: 32, 17: 33, 22: 34 };
    for (const idx of requiredIdx) card[idx] = numbers[idx];
    const called = new Set(Object.values(numbers));
    const result = checkCardEntry(plus, card, called);
    expect(result.valid).toBe(true);
  });
});
