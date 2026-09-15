export interface HistoryEntry {
  id: string;
  sessionId: string;
  sessionLabel: string;
  patternId: string;
  patternName: string;
  winningBall: number;
  ballsCalledCount: number;
  timestamp: number;
  note?: string;
  overridden?: boolean;
}

const STORAGE_KEY = 'bingo:history';

export function loadHistory(storage: Storage = localStorage): HistoryEntry[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[], storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id'>,
  storage: Storage = localStorage
): HistoryEntry[] {
  const entries = loadHistory(storage);
  const withId: HistoryEntry = { ...entry, id: `hist-${Date.now()}-${entries.length}` };
  const next = [...entries, withId];
  saveHistory(next, storage);
  return next;
}

export function clearHistory(storage: Storage = localStorage): void {
  saveHistory([], storage);
}

export function filterBySession(entries: HistoryEntry[], sessionId: string | null): HistoryEntry[] {
  if (!sessionId) return entries;
  return entries.filter((e) => e.sessionId === sessionId);
}

const CSV_HEADERS = [
  'timestamp',
  'session',
  'pattern',
  'winningBall',
  'ballsCalled',
  'overridden',
  'note',
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(entries: HistoryEntry[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const e of entries) {
    lines.push(
      [
        new Date(e.timestamp).toISOString(),
        e.sessionLabel,
        e.patternName,
        String(e.winningBall),
        String(e.ballsCalledCount),
        e.overridden ? 'yes' : 'no',
        e.note ?? '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}
