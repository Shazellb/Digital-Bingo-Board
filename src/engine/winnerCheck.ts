import { COLUMN_RANGES, columnOf } from './draw';
import { FREE_INDEX, gridColumnOf, isPatternSatisfied, markedGridFromCalled, Pattern } from './patterns';

export interface CardEntryResult {
  valid: boolean;
  errors: string[];
}

/**
 * Quick check: the operator has visually verified the claim against the board.
 * We only sanity-check that enough balls have been called for the pattern to be possible at all.
 */
export function quickCheck(pattern: Pattern, calledCount: number): CardEntryResult {
  const requiredCount = pattern.cells.filter((c) => c).length - (pattern.cells[FREE_INDEX] ? 1 : 0);
  if (calledCount < requiredCount) {
    return { valid: false, errors: [`Only ${calledCount} balls called; pattern needs at least ${requiredCount}.`] };
  }
  return { valid: true, errors: [] };
}

/**
 * Card-entry check: operator keys in the player's card numbers for the pattern's required cells.
 * cardNumbers is a length-25 array aligned to the pattern grid; entries for cells the pattern
 * doesn't require are ignored.
 */
export function checkCardEntry(
  pattern: Pattern,
  cardNumbers: (number | null)[],
  calledNumbers: Set<number>
): CardEntryResult {
  const errors: string[] = [];

  for (let i = 0; i < pattern.cells.length; i++) {
    if (!pattern.cells[i] || i === FREE_INDEX) continue;
    const n = cardNumbers[i];
    if (n === null || n === undefined) {
      errors.push(`Cell ${i} is required by the pattern but has no number entered.`);
      continue;
    }
    const expectedColumn = gridColumnOf(i);
    const [lo, hi] = COLUMN_RANGES[expectedColumn];
    if (n < lo || n > hi || columnOf(n) !== expectedColumn) {
      errors.push(`${n} is not a valid ${expectedColumn} number (expected ${lo}-${hi}).`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const marked = markedGridFromCalled(calledNumbers, cardNumbers);
  const satisfied = isPatternSatisfied(pattern, marked);
  if (!satisfied) {
    errors.push('Not all of the card numbers required by the pattern have been called yet.');
  }
  return { valid: satisfied, errors };
}
