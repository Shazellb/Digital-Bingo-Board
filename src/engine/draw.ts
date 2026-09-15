export type Column = 'B' | 'I' | 'N' | 'G' | 'O';

export const COLUMNS: Column[] = ['B', 'I', 'N', 'G', 'O'];

export const COLUMN_RANGES: Record<Column, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

export function columnOf(n: number): Column {
  for (const c of COLUMNS) {
    const [lo, hi] = COLUMN_RANGES[c];
    if (n >= lo && n <= hi) return c;
  }
  throw new Error(`invalid ball number ${n}`);
}

export interface DrawEngineState {
  called: number[];
  remaining: number[];
}

export function createDrawEngine(): DrawEngineState {
  const remaining: number[] = [];
  for (let n = 1; n <= 75; n++) remaining.push(n);
  return { called: [], remaining };
}

export type RandomSource = () => number;

function defaultRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x1_0000_0000;
}

export interface DrawOptions {
  allowedColumns?: Column[];
  random?: RandomSource;
}

/** Draws the next ball, removing it from the remaining pool so it can never repeat. */
export function drawNext(state: DrawEngineState, opts: DrawOptions = {}): number | null {
  const random = opts.random ?? defaultRandom;
  const pool = opts.allowedColumns
    ? state.remaining.filter((n) => opts.allowedColumns!.includes(columnOf(n)))
    : state.remaining;
  if (pool.length === 0) return null;

  const idx = Math.floor(random() * pool.length);
  const n = pool[Math.min(idx, pool.length - 1)];
  const ri = state.remaining.indexOf(n);
  state.remaining.splice(ri, 1);
  state.called.push(n);
  return n;
}

export function callsRemaining(state: DrawEngineState): number {
  return state.remaining.length;
}

export function cloneDrawEngine(state: DrawEngineState): DrawEngineState {
  return { called: [...state.called], remaining: [...state.remaining] };
}
