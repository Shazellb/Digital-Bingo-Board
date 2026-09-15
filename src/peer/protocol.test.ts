import { describe, expect, it } from 'vitest';
import { isPeerMessage, SyncPayload } from './protocol';

function validSync(): SyncPayload {
  return {
    type: 'sync',
    seq: 1,
    venueName: 'Hall',
    sessionLabel: 'Tonight',
    called: [1, 20],
    activePattern: { id: 'row-0', name: 'Row', cells: new Array<boolean>(25).fill(false), builtIn: true },
    smartDrawEnabled: false,
    autoDrawing: false,
    autoPaused: false,
    gameStatus: 'playing',
    winner: null,
    voiceEnabled: true,
    audioTarget: 'display',
  };
}

describe('isPeerMessage', () => {
  it('accepts valid protocol messages', () => {
    expect(isPeerMessage({ type: 'hello' })).toBe(true);
    expect(isPeerMessage({ type: 'clap', ts: Date.now() })).toBe(true);
    expect(isPeerMessage(validSync())).toBe(true);
  });

  it('rejects malformed data received from a peer', () => {
    expect(isPeerMessage(null)).toBe(false);
    expect(isPeerMessage({ type: 'clap', ts: 'now' })).toBe(false);
    expect(isPeerMessage({ ...validSync(), called: [0, 76] })).toBe(false);
    expect(isPeerMessage({ ...validSync(), activePattern: { cells: [] } })).toBe(false);
  });
});
