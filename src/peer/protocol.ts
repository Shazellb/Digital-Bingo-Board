import { Pattern } from '../engine/patterns';
import { GameStatus, WinnerRecord } from '../state/appState';
import { AudioTarget } from '../state/appState';

/** PeerJS BinaryPack serializes present `undefined` properties as `null`. */
export interface WinnerPayload extends Omit<WinnerRecord, 'note' | 'overridden'> {
  note?: string | null;
  overridden?: boolean | null;
}

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
  winner: WinnerPayload | null;
  voiceEnabled: boolean;
  audioTarget: AudioTarget;
}

export interface ApplausePayload {
  type: 'applause';
  ts: number;
}

export interface HelloPayload {
  type: 'hello';
}

export interface SpinPayload {
  type: 'spin';
  targetBall: number;
  durationMs: number;
}

export interface SpinCancelPayload {
  type: 'spin-cancel';
}

export interface ReleasePairingPayload {
  type: 'release-pairing';
  controllerSecret: string;
}

export interface PairingReleasedPayload {
  type: 'pairing-released';
}

export interface PairingRejectedPayload {
  type: 'pairing-rejected';
}

export type PeerMessage = SyncPayload | ApplausePayload | HelloPayload | SpinPayload | SpinCancelPayload | ReleasePairingPayload | PairingReleasedPayload | PairingRejectedPayload;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWinner(value: unknown): value is WinnerPayload {
  if (!isRecord(value)) return false;
  return typeof value.patternId === 'string'
    && typeof value.patternName === 'string'
    && Number.isInteger(value.winningBall)
    && Number.isInteger(value.ballsCalledCount)
    && typeof value.timestamp === 'number'
    && (value.note == null || typeof value.note === 'string')
    && (value.overridden == null || typeof value.overridden === 'boolean');
}

/** Runtime guard for data arriving across the untyped WebRTC boundary. */
export function isPeerMessage(value: unknown): value is PeerMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'hello' || value.type === 'spin-cancel' || value.type === 'pairing-released' || value.type === 'pairing-rejected') return true;
  if (value.type === 'applause') return typeof value.ts === 'number' && Number.isFinite(value.ts);
  if (value.type === 'spin') return typeof value.targetBall === 'number'
    && Number.isInteger(value.targetBall)
    && value.targetBall >= 1
    && value.targetBall <= 75
    && typeof value.durationMs === 'number'
    && Number.isFinite(value.durationMs)
    && value.durationMs >= 0
    && value.durationMs <= 2000;
  if (value.type === 'release-pairing') return typeof value.controllerSecret === 'string' && value.controllerSecret.length >= 16;
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
