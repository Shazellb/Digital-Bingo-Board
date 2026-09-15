import QRCode from 'qrcode';
import { enableAudio, playAudienceCheer, speakCall } from './audio';
import { ConfettiController } from './confetti';
import { ConfettiFireTracker, createSessionConfettiStorage } from './confettiTracker';
import { DisplaySpinCoordinator } from './displaySpin';
import { COLUMNS } from './engine/draw';
import { generateRoomCode } from './engine/roomCode';
import { createPeerHost, HostStatus } from './peer/peerHost';
import { SyncPayload } from './peer/protocol';
import { setupPwaUpdates } from './pwa';
import { injectBuildLabels } from './version';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const root = document.querySelector<HTMLDivElement>('#app')!;
if (!root) throw new Error('Missing app root');

const confettiCanvas = document.createElement('canvas');
confettiCanvas.className = 'confetti-canvas';
confettiCanvas.setAttribute('aria-hidden', 'true');
document.body.appendChild(confettiCanvas);
const confetti = new ConfettiController(confettiCanvas);
const confettiTracker = new ConfettiFireTracker(createSessionConfettiStorage());

const roomCode = sessionStorage.getItem('bingo:display-room') ?? generateRoomCode();
sessionStorage.setItem('bingo:display-room', roomCode);
let boundSecret = sessionStorage.getItem('bingo:display-controller-secret');
const host = createPeerHost(roomCode, {
  boundSecret,
  onBindingChange(secret) {
    boundSecret = secret;
    if (secret) sessionStorage.setItem('bingo:display-controller-secret', secret);
    else sessionStorage.removeItem('bingo:display-controller-secret');
    render();
  },
});
let hostStatus: HostStatus = 'starting';
let payload: SyncPayload | null = null;
let qrDataUrl = '';
let wakeLock: { release(): Promise<void> } | null = null;
let soundReady = false;
let spinningLabel: string | null = null;
let lastSyncSequence = -1;
const displaySpinner = new DisplaySpinCoordinator({
  onTick(label) {
    spinningLabel = label;
    const readout = document.querySelector<HTMLElement>('.display-current-value');
    if (readout) readout.textContent = label;
  },
  onLand(_ball, displayedLabel) {
    spinningLabel = displayedLabel;
    render();
  },
});

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

const controllerUrl = new URL('./controller.html', location.href);
controllerUrl.hash = roomCode;

QRCode.toDataURL(controllerUrl.toString(), { width: 240, margin: 1, color: { dark: '#07101fff', light: '#ffffffff' } })
  .then((url) => { qrDataUrl = url; render(); })
  .catch((error) => console.error('[bingo] QR generation failed', error));

function patternGrid(sync: SyncPayload): string {
  return `<div class="pattern-grid">${sync.activePattern.cells.map((on, index) => `<span class="pattern-cell ${on ? 'on' : ''} ${index === 12 ? 'free' : ''}">${index === 12 ? 'FREE' : on ? '●' : ''}</span>`).join('')}</div>`;
}

function statusText(): string {
  if (hostStatus === 'error') return 'PAIRING ERROR — REFRESH DISPLAY';
  if (hostStatus !== 'connected') return 'WAITING FOR CONTROLLER';
  if (!payload) return 'CONNECTED — SYNCING';
  if (payload.gameStatus === 'won') return 'GAME OVER';
  if (payload.autoPaused) return 'PAUSED';
  if (payload.autoDrawing) return 'AUTO DRAWING';
  if (payload.gameStatus === 'playing') return 'IN PROGRESS';
  return 'CONNECTED — READY';
}

function render(): void {
  const sync = payload;
  const called = new Set(sync?.called ?? []);
  const current = sync?.called.at(-1);
  const recent = (sync?.called ?? []).slice(-4, -1).reverse();
  const displayRows = COLUMNS.map((column, columnIndex) => {
    const start = columnIndex * 15 + 1;
    return `<div class="display-row"><div class="display-letter">${column}</div>${Array.from({ length: 15 }, (_, index) => {
      const n = start + index;
      return `<div class="display-ball ${called.has(n) ? 'called' : ''}">${n}</div>`;
    }).join('')}</div>`;
  }).join('');

  const emptyPattern: SyncPayload = {
    type: 'sync', seq: 0, venueName: '', sessionLabel: 'Tonight', called: [],
    activePattern: { id: 'none', name: 'Waiting for game', cells: new Array<boolean>(25).fill(false), builtIn: true },
    smartDrawEnabled: false, autoDrawing: false, autoPaused: false, gameStatus: 'idle', winner: null,
    voiceEnabled: true, audioTarget: 'display',
  };
  const shown = sync ?? emptyPattern;
  const qr = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR code to open Controller">` : '';
  const pairingDetails = boundSecret ? '' : `<div class="room-copy"><small>Pair with room</small><div class="room-code">${roomCode}</div></div>${qr}`;

  root.innerHTML = `<main class="display-shell">
    <header class="display-head">
      <div class="display-brand"><h1>Digital Bingo Board</h1><p>${esc(shown.venueName || 'Ready for bingo')}</p></div>
      <div class="room-block">
        <button id="fullscreen" class="btn fullscreen-btn">⛶ Full screen</button>
        ${pairingDetails}
      </div>
    </header>
    <div class="display-main">
      <section class="display-board" aria-label="75-ball bingo board">${displayRows}</section>
      <aside class="display-side">
        <section class="display-panel display-current">
          <span class="display-panel-label">Current call</span>
          <div class="display-current-value ${displaySpinner.active ? 'spinning' : ''}" aria-live="polite">${spinningLabel ?? (current ? `${COLUMNS[Math.floor((current - 1) / 15)]}-${current}` : '—')}</div>
          <div class="display-count">${displaySpinner.active ? 'DRAWING…' : `${called.size} BALL${called.size === 1 ? '' : 'S'} CALLED`}</div>
        </section>
        <section class="display-panel">
          <span class="display-panel-label">Previous calls</span>
          <div class="recent-calls">${recent.length ? recent.map((n) => `<span class="recent-ball">${COLUMNS[Math.floor((n - 1) / 15)]}-${n}</span>`).join('') : '<span class="recent-ball">—</span>'}</div>
        </section>
        <section class="display-panel">
          <div class="display-pattern"><div><span class="display-panel-label">Winning pattern</span><div class="display-pattern-name">${esc(shown.activePattern.name)}</div><p class="subtle">Session: ${esc(shown.sessionLabel)}${shown.smartDrawEnabled ? ' · Smart draw' : ''}</p></div>${patternGrid(shown)}</div>
          <div class="display-status"><strong>${statusText()}</strong><span class="connection-pill ${hostStatus === 'connected' ? 'connected' : hostStatus === 'error' ? 'error' : ''}">${hostStatus === 'connected' ? 'Controller connected' : 'Pairing'}</span></div>
        </section>
      </aside>
    </div>
    ${hostStatus !== 'connected' ? `<div class="display-overlay"><div class="display-overlay-card"><h2>${hostStatus === 'error' ? 'Pairing error' : boundSecret ? 'Reconnecting controller' : 'Waiting for controller'}</h2>${boundSecret ? '<p>This board is locked to its paired Controller.</p>' : `<p>On the Controller, enter room <strong class="room-code">${roomCode}</strong></p>${qrDataUrl ? `<img class="qr" style="width:15vh;height:15vh;margin-top:2vh" src="${qrDataUrl}" alt="QR code to open Controller">` : ''}<p>Scan the code or open the Controller link.</p>`}${hostStatus === 'error' ? '<p>Refresh this Display to create a new room.</p>' : ''}</div></div>` : ''}
    ${hostStatus === 'connected' && !soundReady ? '<div class="display-overlay sound-overlay"><div class="display-overlay-card"><h2>Enable TV sound</h2><p>Tap or click once so voice calls and applause can play through this Display.</p><button id="enable-sound" class="btn btn-primary sound-enable-btn">Enable sound</button></div></div>' : ''}
    ${sync?.gameStatus === 'won' ? `<div class="display-overlay winner-overlay-bg"></div><div class="winner-overlay-content"><h2>BINGO!</h2><p>${esc(sync.winner?.patternName ?? sync.activePattern.name)} · Winning ball ${sync.winner ? `${COLUMNS[Math.floor((sync.winner.winningBall - 1) / 15)]}-${sync.winner.winningBall}` : ''}</p></div>` : ''}
    <small class="build-label display-build-label" data-build-label></small>
  </main>`;

  injectBuildLabels(root);

  document.querySelector('#fullscreen')?.addEventListener('click', async () => {
    try {
      soundReady = await enableAudio();
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      await requestWakeLock();
    } catch (error) {
      console.error('[bingo] full screen request failed', error);
    }
  });
  document.querySelector('#enable-sound')?.addEventListener('click', async () => {
    soundReady = await enableAudio();
    render();
  });
}

async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    const nav = navigator as Navigator & { wakeLock: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    wakeLock = await nav.wakeLock.request('screen');
  } catch (error) {
    console.info('[bingo] screen wake lock unavailable', error);
  }
}

host.onStatusChange((status) => {
  hostStatus = status;
  if (status !== 'connected') {
    displaySpinner.cancel();
    spinningLabel = null;
    lastSyncSequence = -1;
  }
  if (status === 'error') sessionStorage.removeItem('bingo:display-room');
  render();
  if (status === 'connected') void requestWakeLock();
});

host.onMessage((message) => {
  if (message.type === 'applause') {
    playAudienceCheer();
    return;
  }
  if (message.type === 'spin') {
    displaySpinner.receiveSpin(message.targetBall, message.durationMs, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    render();
    return;
  }
  if (message.type === 'spin-cancel') {
    displaySpinner.cancel();
    spinningLabel = null;
    render();
    return;
  }
  if (message.type === 'release-pairing') {
    sessionStorage.removeItem('bingo:display-room');
    sessionStorage.removeItem('bingo:display-controller-secret');
    setTimeout(() => location.reload(), 150);
    return;
  }
  if (message.type !== 'sync') return;
  if (message.seq <= lastSyncSequence) return;
  lastSyncSequence = message.seq;
  const priorCurrent = payload?.called.at(-1);
  const nextCurrent = message.called.at(-1);
  const isNewCall = payload !== null && message.called.length > payload.called.length;
  const shouldSpeak = payload !== null && nextCurrent !== undefined && nextCurrent !== priorCurrent && message.called.length >= payload.called.length;
  const shouldApplaud = payload?.gameStatus !== 'won' && message.gameStatus === 'won';
  const wasWon = payload?.gameStatus === 'won';
  const shouldFireConfetti = confettiTracker.observe(message.gameStatus, message.winner);
  payload = message;
  displaySpinner.receiveSync(priorCurrent, nextCurrent, isNewCall, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  render();
  if (shouldSpeak && message.voiceEnabled && (message.audioTarget === 'display' || message.audioTarget === 'both')) speakCall(nextCurrent!);
  if (shouldApplaud) playAudienceCheer();
  if (shouldFireConfetti) confetti.fire(prefersReducedMotion());
  else if (wasWon && message.gameStatus !== 'won') confetti.clear();
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && hostStatus === 'connected') void requestWakeLock(); });
window.addEventListener('beforeunload', () => { void wakeLock?.release(); host.destroy(); confetti.destroy(); });

render();
setupPwaUpdates();
