import { createDrawEngine, DrawEngineState } from '../engine/draw';
import { BUILT_IN_PATTERNS, Pattern } from '../engine/patterns';
import { createSession, SessionState } from '../engine/session';

export type AudioTarget = 'display' | 'controller' | 'both';

export interface Settings {
  intervalMs: number;
  voiceEnabled: boolean;
  drawSoundEnabled: boolean;
  audioTarget: AudioTarget;
  venueName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  intervalMs: 5000,
  voiceEnabled: true,
  drawSoundEnabled: true,
  audioTarget: 'display',
  venueName: '',
};

export interface WinnerRecord {
  patternId: string;
  patternName: string;
  winningBall: number;
  ballsCalledCount: number;
  timestamp: number;
  note?: string;
  overridden?: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'won';

export interface AppState {
  settings: Settings;
  session: SessionState;
  drawEngine: DrawEngineState;
  activePatternId: string;
  customPatterns: Pattern[];
  smartDrawEnabled: boolean;
  gameStatus: GameStatus;
  winner: WinnerRecord | null;
}

const STORAGE_KEY = 'bingo:appstate';

export function createDefaultAppState(): AppState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    session: createSession('Tonight'),
    drawEngine: createDrawEngine(),
    activePatternId: BUILT_IN_PATTERNS[0].id,
    customPatterns: [],
    smartDrawEnabled: false,
    gameStatus: 'idle',
    winner: null,
  };
}

export function allPatterns(state: Pick<AppState, 'customPatterns'>): Pattern[] {
  return [...BUILT_IN_PATTERNS, ...state.customPatterns];
}

export function findPattern(state: Pick<AppState, 'customPatterns'>, id: string): Pattern | undefined {
  return allPatterns(state).find((p) => p.id === id);
}

export function saveAppState(state: AppState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadAppState(storage: Storage = localStorage): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultAppState();
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const fallback = createDefaultAppState();
    return {
      settings: { ...fallback.settings, ...parsed.settings },
      session: parsed.session ?? fallback.session,
      drawEngine: parsed.drawEngine ?? fallback.drawEngine,
      activePatternId: parsed.activePatternId ?? fallback.activePatternId,
      customPatterns: parsed.customPatterns ?? fallback.customPatterns,
      smartDrawEnabled: parsed.smartDrawEnabled ?? fallback.smartDrawEnabled,
      gameStatus: parsed.gameStatus ?? fallback.gameStatus,
      winner: parsed.winner ?? fallback.winner,
    };
  } catch {
    return createDefaultAppState();
  }
}

export function clearAppState(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
