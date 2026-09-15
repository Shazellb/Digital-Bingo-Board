import { Column, COLUMNS } from './draw';

/** 5x5 grid, index = row * 5 + col. col 0..4 maps to B,I,N,G,O. Index 12 (row2,col2) is the free centre. */
export const GRID_SIZE = 5;
export const FREE_INDEX = 12;

export interface Pattern {
  id: string;
  name: string;
  /** length-25 mask of required cells. The free centre is implicitly satisfied. */
  cells: boolean[];
  builtIn: boolean;
}

export function indexOf(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

export function gridColumnOf(index: number): Column {
  return COLUMNS[index % GRID_SIZE];
}

function maskFromIndexes(indexes: number[]): boolean[] {
  const cells = new Array<boolean>(25).fill(false);
  for (const i of indexes) cells[i] = true;
  return cells;
}

function rowIndexes(row: number): number[] {
  return Array.from({ length: GRID_SIZE }, (_, c) => indexOf(row, c));
}

function colIndexes(col: number): number[] {
  return Array.from({ length: GRID_SIZE }, (_, r) => indexOf(r, col));
}

const DIAGONAL_DOWN = [0, 6, 12, 18, 24];
const DIAGONAL_UP = [4, 8, 12, 16, 20];

function buildBuiltIns(): Pattern[] {
  const patterns: Pattern[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    patterns.push({
      id: `row-${r}`,
      name: `Line - Row ${r + 1}`,
      cells: maskFromIndexes(rowIndexes(r)),
      builtIn: true,
    });
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    patterns.push({
      id: `col-${c}`,
      name: `Line - Column ${COLUMNS[c]}`,
      cells: maskFromIndexes(colIndexes(c)),
      builtIn: true,
    });
  }
  patterns.push({
    id: 'diag-down',
    name: 'Line - Diagonal (↘)',
    cells: maskFromIndexes(DIAGONAL_DOWN),
    builtIn: true,
  });
  patterns.push({
    id: 'diag-up',
    name: 'Line - Diagonal (↗)',
    cells: maskFromIndexes(DIAGONAL_UP),
    builtIn: true,
  });

  patterns.push({
    id: 'four-corners',
    name: 'Four Corners',
    cells: maskFromIndexes([0, 4, 20, 24]),
    builtIn: true,
  });

  patterns.push({
    id: 'x',
    name: 'X',
    cells: maskFromIndexes([...new Set([...DIAGONAL_DOWN, ...DIAGONAL_UP])]),
    builtIn: true,
  });

  patterns.push({
    id: 'blackout',
    name: 'Blackout / Coverall',
    cells: maskFromIndexes(Array.from({ length: 25 }, (_, i) => i)),
    builtIn: true,
  });

  patterns.push({
    id: 'postage-stamp',
    name: 'Postage Stamp',
    cells: maskFromIndexes([indexOf(0, 3), indexOf(0, 4), indexOf(1, 3), indexOf(1, 4)]),
    builtIn: true,
  });

  patterns.push({
    id: 'small-diamond',
    name: 'Small Diamond',
    cells: maskFromIndexes([indexOf(1, 2), indexOf(2, 1), indexOf(2, 2), indexOf(2, 3), indexOf(3, 2)]),
    builtIn: true,
  });

  patterns.push({
    id: 'letter-t',
    name: 'Letter T',
    cells: maskFromIndexes([...rowIndexes(0), ...colIndexes(2)]),
    builtIn: true,
  });

  patterns.push({
    id: 'letter-l',
    name: 'Letter L',
    cells: maskFromIndexes([...colIndexes(0), ...rowIndexes(4)]),
    builtIn: true,
  });

  patterns.push({
    id: 'outside-frame',
    name: 'Outside Frame',
    cells: maskFromIndexes(
      Array.from({ length: 25 }, (_, i) => i).filter((i) => {
        const r = Math.floor(i / GRID_SIZE);
        const c = i % GRID_SIZE;
        return r === 0 || r === GRID_SIZE - 1 || c === 0 || c === GRID_SIZE - 1;
      })
    ),
    builtIn: true,
  });

  patterns.push({
    id: 'plus',
    name: 'Plus',
    cells: maskFromIndexes([...rowIndexes(2), ...colIndexes(2)]),
    builtIn: true,
  });

  return patterns;
}

export const BUILT_IN_PATTERNS: Pattern[] = buildBuiltIns();

/** Which bingo columns a pattern's required cells touch (ignoring the free centre). */
export function patternColumns(pattern: Pattern): Column[] {
  const cols = new Set<Column>();
  pattern.cells.forEach((required, i) => {
    if (required && i !== FREE_INDEX) cols.add(gridColumnOf(i));
  });
  return [...cols];
}

/** A markedGrid is a length-25 boolean array: true where that card cell has been called (free centre is always true). */
export function isPatternSatisfied(pattern: Pattern, markedGrid: boolean[]): boolean {
  for (let i = 0; i < pattern.cells.length; i++) {
    if (pattern.cells[i] && i !== FREE_INDEX && !markedGrid[i]) return false;
  }
  return true;
}

export function markedGridFromCalled(calledNumbers: Set<number>, cardNumbers: (number | null)[]): boolean[] {
  return cardNumbers.map((n, i) => i === FREE_INDEX || (n !== null && calledNumbers.has(n)));
}

let customIdCounter = 0;
export function createCustomPattern(name: string, cells: boolean[]): Pattern {
  customIdCounter += 1;
  return {
    id: `custom-${Date.now()}-${customIdCounter}`,
    name,
    cells: [...cells],
    builtIn: false,
  };
}
