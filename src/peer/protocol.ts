import { Pattern } from '../engine/patterns';
import { GameStatus, WinnerRecord } from '../state/appState';
import { AudioTarget } from '../state/appState';

/** Full state snapshot the Controller pushes to the Display on every change and on (re)connect. */
export interface SyncPayload {
  type: 'sync';
  seq: number;
  venueName: string;
  sessionLabel: string;
  called: number[];
  activePattern: Pattern;
  smartDrawEnabled: boolean;
  autoDrawing: boolean;
  autoPaused: boolean;
  gameStatus: GameStatus;
  winner: WinnerRecord | null;
  voiceEnabled: boolean;
  audioTarget: AudioTarget;
}

export interface ClapPayload {
  type: 'clap';
  ts: number;
}

export interface HelloPayload {
  type: 'hello';
}

export type PeerMessage = SyncPayload | ClapPayload | HelloPayload;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWinner(value: unknown): value is WinnerRecord {
  if (!isRecord(value)) return false;
  return typeof value.patternId === 'string'
    && typeof value.patternName === 'string'
    && Number.isInteger(value.winningBall)
    && Number.isInteger(value.ballsCalledCount)
    && typeof value.timestamp === 'number'
    && (value.note === undefined || typeof value.note === 'string')
    && (value.overridden === undefined || typeof value.overridden === 'boolean');
}

/** Runtime guard for data arriving across the untyped WebRTC boundary. */
export function isPeerMessage(value: unknown): value is PeerMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'hello') return true;
  if (value.type === 'clap') return typeof value.ts === 'number' && Number.isFinite(value.ts);
  if (value.type !== 'sync' || !isRecord(value.activePattern)) return false;

  const pattern = value.activePattern;
  const winnerIsValid = value.winner === null || isWinner(value.winner);
  return Number.isInteger(value.seq)
    && typeof value.venueName === 'string'
    && typeof value.sessionLabel === 'string'
    && Array.isArray(value.called)
    && value.called.every((ball) => Number.isInteger(ball) && ball >= 1 && ball <= 75)
    && typeof pattern.id === 'string'
    && typeof pattern.name === 'string'
    && Array.isArray(pattern.cells)
    && pattern.cells.length === 25
    && pattern.cells.every((cell) => typeof cell === 'boolean')
    && typeof pattern.builtIn === 'boolean'
    && typeof value.smartDrawEnabled === 'boolean'
    && typeof value.autoDrawing === 'boolean'
    && typeof value.autoPaused === 'boolean'
    && ['idle', 'playing', 'won'].includes(String(value.gameStatus))
    && winnerIsValid
    && typeof value.voiceEnabled === 'boolean'
    && ['display', 'controller', 'both'].includes(String(value.audioTarget));
}
