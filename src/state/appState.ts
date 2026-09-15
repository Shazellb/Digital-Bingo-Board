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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSettings(value: unknown, fallback: Settings): Settings {
  if (!isRecord(value)) return { ...fallback };
  const intervals = [1000, 2000, 3000, 5000, 10000];
  const audioTargets: AudioTarget[] = ['display', 'controller', 'both'];
  return {
    intervalMs: typeof value.intervalMs === 'number' && intervals.includes(value.intervalMs) ? value.intervalMs : fallback.intervalMs,
    voiceEnabled: typeof value.voiceEnabled === 'boolean' ? value.voiceEnabled : fallback.voiceEnabled,
    drawSoundEnabled: typeof value.drawSoundEnabled === 'boolean' ? value.drawSoundEnabled : fallback.drawSoundEnabled,
    audioTarget: typeof value.audioTarget === 'string' && audioTargets.includes(value.audioTarget as AudioTarget) ? value.audioTarget as AudioTarget : fallback.audioTarget,
    venueName: typeof value.venueName === 'string' ? value.venueName : fallback.venueName,
  };
}

function normalizeSession(value: unknown, fallback: SessionState): SessionState {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.label !== 'string'
    || typeof value.startedAt !== 'number'
    || !Array.isArray(value.wonPatternIds)
    || !value.wonPatternIds.every((id) => typeof id === 'string')) return fallback;
  return {
    id: value.id,
    label: value.label,
    startedAt: value.startedAt,
    wonPatternIds: [...new Set(value.wonPatternIds)],
  };
}

function isBallList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((ball) => Number.isInteger(ball) && ball >= 1 && ball <= 75);
}

function normalizeDrawEngine(value: unknown, fallback: DrawEngineState): DrawEngineState {
  if (!isRecord(value) || !isBallList(value.called) || !isBallList(value.remaining)) return fallback;
  const combined = [...value.called, ...value.remaining];
  if (combined.length !== 75 || new Set(combined).size !== 75) return fallback;
  return { called: [...value.called], remaining: [...value.remaining] };
}

function isCustomPattern(value: unknown): value is Pattern {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && value.builtIn === false
    && Array.isArray(value.cells)
    && value.cells.length === 25
    && value.cells.every((cell) => typeof cell === 'boolean')
    && value.cells.some((selected, index) => selected && index !== 12);
}

function normalizeWinner(value: unknown): WinnerRecord | null {
  if (!isRecord(value)
    || typeof value.patternId !== 'string'
    || typeof value.patternName !== 'string'
    || !Number.isInteger(value.winningBall)
    || (value.winningBall as number) < 1
    || (value.winningBall as number) > 75
    || !Number.isInteger(value.ballsCalledCount)
    || (value.ballsCalledCount as number) < 1
    || (value.ballsCalledCount as number) > 75
    || typeof value.timestamp !== 'number'
    || !Number.isFinite(value.timestamp)
    || (value.note !== undefined && typeof value.note !== 'string')
    || (value.overridden !== undefined && typeof value.overridden !== 'boolean')) return null;
  return {
    patternId: value.patternId,
    patternName: value.patternName,
    winningBall: value.winningBall as number,
    ballsCalledCount: value.ballsCalledCount as number,
    timestamp: value.timestamp,
    note: value.note as string | undefined,
    overridden: value.overridden as boolean | undefined,
  };
}

export function loadAppState(storage: Storage = localStorage): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultAppState();
  try {
    const parsed: unknown = JSON.parse(raw);
    const fallback = createDefaultAppState();
    if (!isRecord(parsed)) return fallback;
    const customPatterns = Array.isArray(parsed.customPatterns) ? parsed.customPatterns.filter(isCustomPattern).map((pattern) => ({ ...pattern, cells: [...pattern.cells] })) : [];
    const validPatternIds = new Set([...BUILT_IN_PATTERNS, ...customPatterns].map((pattern) => pattern.id));
    const drawEngine = normalizeDrawEngine(parsed.drawEngine, fallback.drawEngine);
    const winner = normalizeWinner(parsed.winner);
    let gameStatus: GameStatus = ['idle', 'playing', 'won'].includes(String(parsed.gameStatus)) ? parsed.gameStatus as GameStatus : fallback.gameStatus;
    if (gameStatus === 'won' && !winner) gameStatus = drawEngine.called.length > 0 ? 'playing' : 'idle';
    return {
      settings: normalizeSettings(parsed.settings, fallback.settings),
      session: normalizeSession(parsed.session, fallback.session),
      drawEngine,
      activePatternId: typeof parsed.activePatternId === 'string' && validPatternIds.has(parsed.activePatternId) ? parsed.activePatternId : fallback.activePatternId,
      customPatterns,
      smartDrawEnabled: typeof parsed.smartDrawEnabled === 'boolean' ? parsed.smartDrawEnabled : fallback.smartDrawEnabled,
      gameStatus,
      winner,
    };
  } catch {
    return createDefaultAppState();
  }
}

export function clearAppState(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
