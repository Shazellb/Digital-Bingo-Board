import { GameStatus } from './state/appState';

export interface ConfettiStorage {
  get(): string | null;
  set(value: string): void;
  clear(): void;
}

/** In-memory storage for tests or environments without sessionStorage. */
export function createMemoryConfettiStorage(): ConfettiStorage {
  let value: string | null = null;
  return {
    get: () => value,
    set: (next) => { value = next; },
    clear: () => { value = null; },
  };
}

export function createSessionConfettiStorage(key = 'bingo:confetti-fired-winner'): ConfettiStorage {
  return {
    get: () => sessionStorage.getItem(key),
    set: (value) => sessionStorage.setItem(key, value),
    clear: () => sessionStorage.removeItem(key),
  };
}

/**
 * Decides when the Display should fire its winner confetti burst: once per confirmed
 * win, keyed by the winner's timestamp so a re-sync, reload, or reconnect that still
 * reports the same win never re-fires. A new game (status leaves 'won') resets it.
 */
export class ConfettiFireTracker {
  private firedKey: string | null;

  constructor(private readonly storage: ConfettiStorage) {
    this.firedKey = storage.get();
  }

  observe(gameStatus: GameStatus, winner: { timestamp: number } | null): boolean {
    if (gameStatus !== 'won' || !winner) {
      if (this.firedKey !== null) {
        this.firedKey = null;
        this.storage.clear();
      }
      return false;
    }

    const key = String(winner.timestamp);
    if (key === this.firedKey) return false;
    this.firedKey = key;
    this.storage.set(key);
    return true;
  }
}
