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
