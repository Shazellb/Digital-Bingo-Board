import Peer, { DataConnection } from 'peerjs';
import { roomCodeToPeerId } from '../engine/roomCode';
import { isPeerMessage, PeerMessage } from './protocol';

export type ClientStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface PeerClient {
  readonly status: ClientStatus;
  send(msg: PeerMessage): void;
  destroy(): void;
  onStatusChange(cb: (status: ClientStatus) => void): void;
  onMessage(cb: (message: PeerMessage) => void): void;
}

const RECONNECT_DELAY_MS = 2000;

/** Controller side: connects out to the Display's peer id and auto-reconnects if the link drops. */
export function createPeerClient(roomCode: string): PeerClient {
  const targetId = roomCodeToPeerId(roomCode);
  const peer = new Peer();
  let conn: DataConnection | null = null;
  let currentStatus: ClientStatus = 'connecting';
  let destroyed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const statusListeners: Array<(s: ClientStatus) => void> = [];
  const messageListeners: Array<(message: PeerMessage) => void> = [];

  function setStatus(s: ClientStatus) {
    currentStatus = s;
    statusListeners.forEach((cb) => cb(s));
  }

  function scheduleReconnect() {
    if (destroyed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectOut();
    }, RECONNECT_DELAY_MS);
  }

  function connectOut() {
    if (destroyed) return;
    setStatus('connecting');
    const c = peer.connect(targetId, { reliable: true });
    conn = c;
    c.on('open', () => setStatus('connected'));
    c.on('data', (data) => {
      if (isPeerMessage(data)) messageListeners.forEach((cb) => cb(data));
    });
    c.on('close', () => {
      setStatus('disconnected');
      scheduleReconnect();
    });
    c.on('error', (err) => {
      console.error('[bingo] peer client connection error', err);
      setStatus('error');
      scheduleReconnect();
    });
  }

  peer.on('open', () => connectOut());
  peer.on('error', (err) => {
    console.error('[bingo] peer client error', err);
    setStatus('error');
    scheduleReconnect();
  });
  peer.on('disconnected', () => {
    if (!destroyed) peer.reconnect();
  });

  return {
    get status() {
      return currentStatus;
    },
    send(msg) {
      if (conn && conn.open) conn.send(msg);
    },
    destroy() {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      conn?.close();
      peer.destroy();
    },
    onStatusChange(cb) {
      statusListeners.push(cb);
    },
    onMessage(cb) {
      messageListeners.push(cb);
    },
  };
}
