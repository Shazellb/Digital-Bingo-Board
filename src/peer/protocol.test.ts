import { describe, expect, it } from 'vitest';
import { pack, Packable, unpack } from 'peerjs-js-binarypack';
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
    expect(isPeerMessage({ type: 'applause', ts: Date.now() })).toBe(true);
    expect(isPeerMessage({ type: 'spin', targetBall: 42, durationMs: 1500 })).toBe(true);
    expect(isPeerMessage({ type: 'spin-cancel' })).toBe(true);
    expect(isPeerMessage({ type: 'release-pairing', controllerSecret: 'controller-secret-123' })).toBe(true);
    expect(isPeerMessage(validSync())).toBe(true);
  });

  it('rejects malformed data received from a peer', () => {
    expect(isPeerMessage(null)).toBe(false);
    expect(isPeerMessage({ type: 'applause', ts: 'now' })).toBe(false);
    expect(isPeerMessage({ type: 'spin', targetBall: 76, durationMs: 1500 })).toBe(false);
    expect(isPeerMessage({ ...validSync(), called: [0, 76] })).toBe(false);
    expect(isPeerMessage({ ...validSync(), activePattern: { cells: [] } })).toBe(false);
  });

  it('accepts a no-note winner after PeerJS BinaryPack round-trip', async () => {
    const message = {
      ...validSync(),
      gameStatus: 'won',
      winner: {
        patternId: 'row-0',
        patternName: 'Row',
        winningBall: 20,
        ballsCalledCount: 2,
        timestamp: 1_700_000_000_000,
        note: undefined,
        overridden: undefined,
      },
    };

    const packed = await pack(message as unknown as Packable);
    expect(packed).toBeInstanceOf(ArrayBuffer);
    const roundTripped = unpack(packed as ArrayBuffer);

    expect(roundTripped).toMatchObject({ winner: { note: null, overridden: null } });
    expect(isPeerMessage(roundTripped)).toBe(true);
  });
});
