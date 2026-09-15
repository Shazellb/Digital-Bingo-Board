import Peer, { DataConnection } from 'peerjs';
import { roomCodeToPeerId } from '../engine/roomCode';
import { PairingLock } from './pairingLock';
import { isPeerMessage, PeerMessage } from './protocol';

export type HostStatus = 'starting' | 'waiting' | 'connected' | 'error';

export interface PeerHost {
  readonly roomCode: string;
  readonly status: HostStatus;
  destroy(): void;
  onMessage(cb: (msg: PeerMessage) => void): void;
  onStatusChange(cb: (status: HostStatus) => void): void;
}

export interface PeerHostOptions {
  boundSecret?: string | null;
  onBindingChange?(secret: string | null): void;
}

/** Display side: hosts a stable PeerJS id derived from the room code and waits for the Controller to connect. */
export function createPeerHost(roomCode: string, options: PeerHostOptions = {}): PeerHost {
  const peer = new Peer(roomCodeToPeerId(roomCode));
  const pairingLock = new PairingLock(options.boundSecret);
  let currentStatus: HostStatus = 'starting';
  let activeConn: DataConnection | null = null;
  const messageListeners: Array<(msg: PeerMessage) => void> = [];
  const statusListeners: Array<(s: HostStatus) => void> = [];

  function setStatus(s: HostStatus) {
    currentStatus = s;
    statusListeners.forEach((cb) => cb(s));
  }

  peer.on('open', () => setStatus('waiting'));
  peer.on('error', (err) => {
    console.error('[bingo] peer host error', err);
    setStatus('error');
  });
  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect();
  });

  peer.on('connection', (conn) => {
    const metadata = typeof conn.metadata === 'object' && conn.metadata !== null ? conn.metadata as Record<string, unknown> : {};
    const controllerSecret = metadata.controllerSecret;
    let authorized = false;

    conn.on('open', () => {
      const decision = pairingLock.authorize(controllerSecret);
      if (!decision.accepted) {
        conn.send({ type: 'pairing-rejected' } satisfies PeerMessage);
        setTimeout(() => conn.close(), 100);
        return;
      }
      authorized = true;
      if (decision.newlyBound) options.onBindingChange?.(pairingLock.secret);
      const previousConn = activeConn;
      activeConn = conn;
      previousConn?.close();
      setStatus('connected');
      conn.send({ type: 'hello' } satisfies PeerMessage);
    });
    conn.on('data', (data) => {
      if (!authorized || activeConn !== conn || !isPeerMessage(data)) return;
      if (data.type === 'release-pairing') {
        if (!pairingLock.release(data.controllerSecret)) return;
        options.onBindingChange?.(null);
        conn.send({ type: 'pairing-released' } satisfies PeerMessage);
      }
      messageListeners.forEach((cb) => cb(data));
    });
    conn.on('close', () => {
      if (activeConn === conn) {
        activeConn = null;
        setStatus('waiting');
      }
    });
    conn.on('error', (err) => {
      console.error('[bingo] peer host connection error', err);
    });
  });

  return {
    roomCode,
    get status() {
      return currentStatus;
    },
    destroy() {
      activeConn?.close();
      peer.destroy();
    },
    onMessage(cb) {
      messageListeners.push(cb);
    },
    onStatusChange(cb) {
      statusListeners.push(cb);
    },
  };
}
