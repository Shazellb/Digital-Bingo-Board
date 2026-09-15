import { playDrawSound, speakCall, speakTest } from './audio';
import { COLUMNS, columnOf, createDrawEngine, drawNext } from './engine/draw';
import { addHistoryEntry, clearHistory, filterBySession, loadHistory, toCsv } from './engine/history';
import { createCustomPattern, FREE_INDEX, Pattern, patternColumns } from './engine/patterns';
import { normalizeRoomCode } from './engine/roomCode';
import { createSession, isPatternBlocked, recordWin } from './engine/session';
import { checkCardEntry, quickCheck } from './engine/winnerCheck';
import { createPeerClient, PeerClient } from './peer/peerClient';
import { controllerSecretStorageKey, loadOrCreateControllerSecret } from './peer/pairingLock';
import { SyncPayload } from './peer/protocol';
import { setupPwaUpdates } from './pwa';
import { DrawSpinner, spinDurationForInterval } from './spin';
import { allPatterns, AppState, findPattern, loadAppState, saveAppState, WinnerRecord } from './state/appState';
import { injectBuildLabels } from './version';

const root = document.querySelector<HTMLDivElement>('#app')!;
if (!root) throw new Error('Missing app root');

let state: AppState = loadAppState();
let peer: PeerClient | null = null;
let connectionStatus = 'Not paired';
let roomCode = normalizeRoomCode(location.hash.slice(1) || new URLSearchParams(location.search).get('room') || localStorage.getItem('bingo:last-room') || '');
let controllerSecret: string | null = null;
let autoTimer: number | null = null;
let autoPaused = false;
let sequence = 0;
let activeTab = 'game';
let historySessionFilter: string | null = null;
let activeOverride = false;
let editorPatternId: string | null = null;
let editorCells = new Array<boolean>(25).fill(false);
let winnerMode: 'quick' | 'card' = 'quick';
let cardNumbers = new Array<number | null>(25).fill(null);
const drawSpinner = new DrawSpinner();
let pendingBall: number | null = null;
let spinningLabel: string | null = null;

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

function activePattern(): Pattern {
  return findPattern(state, state.activePatternId) ?? allPatterns(state)[0];
}

function persistAndSync(): void {
  saveAppState(state);
  sendSync();
}

function sendSync(): void {
  if (!peer || peer.status !== 'connected') return;
  const payload: SyncPayload = {
    type: 'sync',
    seq: ++sequence,
    venueName: state.settings.venueName,
    sessionLabel: state.session.label,
    called: pendingBall === null ? [...state.drawEngine.called] : state.drawEngine.called.slice(0, -1),
    activePattern: activePattern(),
    smartDrawEnabled: state.smartDrawEnabled,
    autoDrawing: autoTimer !== null,
    autoPaused,
    gameStatus: state.gameStatus,
    winner: state.winner,
    voiceEnabled: state.settings.voiceEnabled,
    audioTarget: state.settings.audioTarget,
  };
  peer.send(payload);
}

function connect(code: string): void {
  const normalized = normalizeRoomCode(code);
  if (normalized.length < 3) {
    alert('Enter the room code shown on the Display.');
    return;
  }
  peer?.destroy();
  roomCode = normalized;
  localStorage.setItem('bingo:last-room', roomCode);
  controllerSecret = loadOrCreateControllerSecret(roomCode);
  connectionStatus = 'Connecting';
  peer = createPeerClient(roomCode, controllerSecret);
  peer.onStatusChange((status) => {
    connectionStatus = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'rejected' ? 'Pairing rejected — Display is locked' : status === 'error' ? 'Connection error — retrying' : 'Disconnected — retrying';
    render();
    if (status === 'connected') sendSync();
  });
  peer.onMessage((message) => {
    if (message.type === 'hello') sendSync();
    if (message.type === 'pairing-released') finishUnpair();
  });
  render();
}

function stopAuto(paused: boolean): void {
  if (autoTimer !== null) window.clearInterval(autoTimer);
  autoTimer = null;
  autoPaused = paused;
  sendSync();
  render();
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function updateSpinningReadout(label: string): void {
  spinningLabel = label;
  const readout = document.querySelector<HTMLElement>('.current-value');
  if (readout) readout.textContent = label;
}

function cancelPendingSpin(): void {
  if (drawSpinner.active) peer?.send({ type: 'spin-cancel' });
  drawSpinner.cancel();
  pendingBall = null;
  spinningLabel = null;
}

function performDraw(): boolean {
  if (state.gameStatus === 'won' || drawSpinner.active) return false;
  const pattern = activePattern();
  const allowedColumns = state.smartDrawEnabled ? patternColumns(pattern) : undefined;
  const durationMs = reducedMotion() ? 0 : spinDurationForInterval(state.settings.intervalMs);
  let exhausted = false;
  const started = drawSpinner.begin(() => {
    const ball = drawNext(state.drawEngine, { allowedColumns });
    if (ball === null) exhausted = true;
    else pendingBall = ball;
    return ball;
  }, {
    durationMs,
    reducedMotion: durationMs === 0,
    onTick: updateSpinningReadout,
    onLand: (ball) => {
      pendingBall = null;
      spinningLabel = null;
      state.gameStatus = 'playing';
      if (state.settings.drawSoundEnabled) playDrawSound();
      if (state.settings.voiceEnabled && (state.settings.audioTarget === 'controller' || state.settings.audioTarget === 'both')) speakCall(ball);
      persistAndSync();
      render();
    },
  });
  if (exhausted) {
    stopAuto(false);
    alert(state.smartDrawEnabled ? 'No uncalled balls remain in this pattern’s columns.' : 'All 75 balls have been called.');
    return false;
  }
  if (!started) return false;
  if (durationMs > 0 && pendingBall !== null) peer?.send({ type: 'spin', targetBall: pendingBall, durationMs });
  render();
  return true;
}

function startAuto(): void {
  if (autoTimer !== null || state.gameStatus === 'won') return;
  autoPaused = false;
  if (!performDraw()) return;
  autoTimer = window.setInterval(performDraw, state.settings.intervalMs);
  sendSync();
  render();
}

function toggleManualCall(n: number): void {
  if (drawSpinner.active) return;
  const calledIndex = state.drawEngine.called.indexOf(n);
  if (calledIndex >= 0) {
    if (!confirm(`Un-call ${columnOf(n)}-${n}? This corrects a mistake and returns the ball to the pool.`)) return;
    state.drawEngine.called.splice(calledIndex, 1);
    state.drawEngine.remaining.push(n);
    state.drawEngine.remaining.sort((a, b) => a - b);
  } else {
    state.drawEngine.remaining = state.drawEngine.remaining.filter((ball) => ball !== n);
    state.drawEngine.called.push(n);
    state.gameStatus = 'playing';
    if (state.settings.drawSoundEnabled) playDrawSound();
    if (state.settings.voiceEnabled && (state.settings.audioTarget === 'controller' || state.settings.audioTarget === 'both')) speakCall(n);
  }
  persistAndSync();
  render();
}

function resetGame(): void {
  stopAuto(false);
  cancelPendingSpin();
  state.drawEngine = createDrawEngine();
  state.gameStatus = 'idle';
  state.winner = null;
  activeOverride = false;
  persistAndSync();
  render();
}

function selectPattern(id: string): void {
  const blocked = isPatternBlocked(state.session, id);
  if (id === state.activePatternId && (!blocked || activeOverride)) return;
  if (blocked) {
    const pattern = findPattern(state, id);
    if (!confirm(`${pattern?.name ?? 'This pattern'} already has a winner in ${state.session.label}. Override the repeat-pattern block?`)) {
      render();
      return;
    }
    activeOverride = true;
  } else {
    activeOverride = false;
  }
  state.activePatternId = id;
  persistAndSync();
  render();
}

function openWinnerDialog(): void {
  if (drawSpinner.active) return;
  if (state.drawEngine.called.length === 0) {
    alert('Call at least one ball before checking a winner.');
    return;
  }
  winnerMode = 'quick';
  cardNumbers = new Array<number | null>(25).fill(null);
  render();
  document.querySelector<HTMLDialogElement>('#winner-dialog')?.showModal();
  updateWinnerResult();
}

function winnerResult() {
  return winnerMode === 'quick'
    ? quickCheck(activePattern(), state.drawEngine.called.length)
    : checkCardEntry(activePattern(), cardNumbers, new Set(state.drawEngine.called));
}

function updateWinnerResult(): void {
  const box = document.querySelector<HTMLDivElement>('#winner-result');
  const record = document.querySelector<HTMLButtonElement>('#record-winner');
  if (!box || !record) return;
  const result = winnerResult();
  box.className = `result-box ${result.valid ? 'good' : 'bad'}`;
  box.textContent = result.valid ? '✓ This claim can satisfy the active pattern.' : result.errors.join(' ');
  record.disabled = !result.valid;
}

function recordWinner(): void {
  const result = winnerResult();
  if (!result.valid) {
    updateWinnerResult();
    return;
  }
  const pattern = activePattern();
  const wasBlocked = isPatternBlocked(state.session, pattern.id);
  if (wasBlocked && !activeOverride) {
    if (!confirm(`${pattern.name} has already been won this session. Record another winner using an explicit override?`)) return;
    activeOverride = true;
  }
  const note = (document.querySelector<HTMLInputElement>('#winner-note')?.value ?? '').trim();
  const winningBall = state.drawEngine.called.at(-1) ?? 0;
  const winner: WinnerRecord = {
    patternId: pattern.id,
    patternName: pattern.name,
    winningBall,
    ballsCalledCount: state.drawEngine.called.length,
    timestamp: Date.now(),
    ...(note ? { note } : {}),
    overridden: wasBlocked || activeOverride,
  };
  state.winner = winner;
  state.gameStatus = 'won';
  state.session = recordWin(state.session, pattern.id);
  addHistoryEntry({ ...winner, sessionId: state.session.id, sessionLabel: state.session.label });
  if (autoTimer !== null) window.clearInterval(autoTimer);
  autoTimer = null;
  autoPaused = false;
  persistAndSync();
  document.querySelector<HTMLDialogElement>('#winner-dialog')?.close();
  render();
}

function finishUnpair(): void {
  peer?.destroy();
  peer = null;
  if (roomCode) localStorage.removeItem(controllerSecretStorageKey(roomCode));
  localStorage.removeItem('bingo:last-room');
  history.replaceState(null, '', location.pathname);
  roomCode = '';
  controllerSecret = null;
  connectionStatus = 'Not paired';
  render();
}

function unpair(): void {
  if (!peer || !controllerSecret || !confirm('Unpair this Controller and let the Display create a fresh room code?')) return;
  peer.send({ type: 'release-pairing', controllerSecret });
}

function openPatternEditor(pattern?: Pattern): void {
  editorPatternId = pattern?.id ?? null;
  editorCells = pattern ? [...pattern.cells] : new Array<boolean>(25).fill(false);
  render();
  const dialog = document.querySelector<HTMLDialogElement>('#pattern-dialog');
  const name = document.querySelector<HTMLInputElement>('#pattern-name');
  if (name) name.value = pattern?.name ?? '';
  dialog?.showModal();
}

function saveCustomPattern(): void {
  const name = document.querySelector<HTMLInputElement>('#pattern-name')?.value.trim() ?? '';
  if (!name) {
    alert('Give the custom pattern a name.');
    return;
  }
  if (!editorCells.some((selected, index) => selected && index !== FREE_INDEX)) {
    alert('Select at least one non-FREE cell.');
    return;
  }
  if (editorPatternId) {
    state.customPatterns = state.customPatterns.map((pattern) => pattern.id === editorPatternId ? { ...pattern, name, cells: [...editorCells] } : pattern);
  } else {
    const pattern = createCustomPattern(name, editorCells);
    state.customPatterns.push(pattern);
    state.activePatternId = pattern.id;
  }
  persistAndSync();
  document.querySelector<HTMLDialogElement>('#pattern-dialog')?.close();
  render();
}

function deleteCustomPattern(id: string): void {
  const pattern = findPattern(state, id);
  if (!pattern || pattern.builtIn || !confirm(`Delete custom pattern “${pattern.name}”?`)) return;
  state.customPatterns = state.customPatterns.filter((item) => item.id !== id);
  if (state.activePatternId === id) state.activePatternId = allPatterns(state)[0].id;
  persistAndSync();
  render();
}

function patternGrid(pattern: Pattern, editable = false): string {
  return `<div class="pattern-grid">${pattern.cells.map((on, index) => {
    const free = index === FREE_INDEX;
    return `<button type="button" class="pattern-cell ${on ? 'on' : ''} ${free ? 'free' : ''}" ${editable ? `data-editor-cell="${index}"` : 'disabled'} aria-label="Pattern cell ${index + 1}">${free ? 'FREE' : on ? '●' : ''}</button>`;
  }).join('')}</div>`;
}

function ballButtons(): string {
  const called = new Set(pendingBall === null ? state.drawEngine.called : state.drawEngine.called.slice(0, -1));
  return COLUMNS.map((column, columnIndex) => {
    const start = columnIndex * 15 + 1;
    return `<div class="ball-letter">${column}</div>${Array.from({ length: 15 }, (_, index) => {
      const n = start + index;
      return `<button type="button" class="ball-btn ${called.has(n) ? 'called' : ''}" data-ball="${n}" aria-pressed="${called.has(n)}" aria-label="${called.has(n) ? 'Un-call' : 'Call'} ${column} ${n}" ${drawSpinner.active ? 'disabled' : ''}>${n}</button>`;
    }).join('')}`;
  }).join('');
}

function historyHtml(): string {
  const entries = filterBySession(loadHistory(), historySessionFilter).slice().reverse();
  if (entries.length === 0) return '<div class="empty">No recorded games in this view.</div>';
  return `<div class="history-list">${entries.map((entry) => `<div class="history-item"><strong>${esc(entry.patternName)}</strong><span>${columnOf(entry.winningBall)}-${entry.winningBall}</span><small>${esc(entry.sessionLabel)} · ${entry.ballsCalledCount} balls${entry.overridden ? ' · override' : ''}${entry.note ? ` · ${esc(entry.note)}` : ''}</small><time>${new Date(entry.timestamp).toLocaleString()}</time></div>`).join('')}</div>`;
}

function render(): void {
  const pattern = activePattern();
  const visibleCalled = pendingBall === null ? state.drawEngine.called : state.drawEngine.called.slice(0, -1);
  const calledCount = visibleCalled.length;
  const current = visibleCalled.at(-1);
  const patternBlocked = isPatternBlocked(state.session, pattern.id);
  const connectionClass = connectionStatus === 'Connected' ? 'connected' : connectionStatus.includes('error') ? 'error' : '';
  const patterns = allPatterns(state);
  const sessions = [...new Map(loadHistory().map((entry) => [entry.sessionId, entry.sessionLabel])).entries()];
  root.innerHTML = `
    <main class="controller-shell">
      <header class="controller-top">
        <div><p class="eyebrow">Operator switchboard</p><h1 class="controller-title">Digital Bingo Board</h1></div>
        <span class="connection-pill ${connectionClass}">${esc(connectionStatus)}</span>
      </header>
      <section class="pair-bar" aria-label="Display pairing">
        <label><span class="field-label">Display room code</span><input id="room-code" class="room-input" inputmode="text" maxlength="8" value="${esc(roomCode)}" placeholder="ABCD" autocomplete="off" ${connectionStatus === 'Connected' ? 'readonly' : ''}></label>
        ${connectionStatus === 'Connected' ? '<button id="unpair" class="btn btn-danger" type="button">Unpair / pair a new device</button>' : `<button id="pair-button" class="btn btn-primary" type="button">${peer ? 'Reconnect' : 'Pair display'}</button>`}
        <a class="btn btn-ghost" href="./display.html" target="_blank">Open Display</a>
      </section>

      <nav class="tabs" aria-label="Controller sections">
        ${[['game', 'Game'], ['patterns', 'Patterns'], ['settings', 'Settings'], ['history', 'History']].map(([id, label]) => `<button class="tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </nav>

      <section class="tab-page ${activeTab === 'game' ? 'active' : ''}" data-page="game">
        <div class="controller-grid">
          <div class="stack">
            <section class="panel">
              <div class="panel-head"><h2>Game controls</h2><span class="status-chip">${state.gameStatus === 'won' ? 'BINGO — Game over' : autoTimer !== null ? 'Auto drawing' : autoPaused ? 'Paused' : state.gameStatus === 'playing' ? 'In progress' : 'Ready'}</span></div>
              <div class="control-hero">
                <div class="current-card ${drawSpinner.active ? 'spinning' : ''}"><div><span class="current-value" aria-live="polite">${spinningLabel ?? (current ? `${columnOf(current)}-${current}` : '—')}</span><span class="current-meta">${drawSpinner.active ? 'Drawing…' : `${calledCount} ball${calledCount === 1 ? '' : 's'} called`}</span></div></div>
                <div class="draw-controls">
                  <button id="draw" class="draw-btn" ${state.gameStatus === 'won' || drawSpinner.active ? 'disabled' : ''}>${drawSpinner.active ? 'SPINNING…' : 'DRAW'}</button>
                  <div class="auto-row">
                    ${autoTimer !== null ? '<button id="pause-auto" class="btn btn-danger">Pause auto</button>' : `<button id="start-auto" class="btn btn-primary" ${state.gameStatus === 'won' ? 'disabled' : ''}>${autoPaused ? 'Resume auto' : 'Start auto'}</button>`}
                    <select id="interval" aria-label="Auto draw interval">${[1, 2, 3, 5, 10].map((seconds) => `<option value="${seconds * 1000}" ${state.settings.intervalMs === seconds * 1000 ? 'selected' : ''}>${seconds} sec</option>`).join('')}</select>
                  </div>
                  <label class="inline-check"><input id="smart-draw" type="checkbox" ${state.smartDrawEnabled ? 'checked' : ''}> Smart draw (${patternColumns(pattern).join(', ') || 'none'})</label>
                </div>
              </div>
              <div class="button-row" style="margin-top:12px">
                <button id="check-winner" class="btn btn-primary">Check winner</button>
                <button id="applause" class="btn">👏 Applause</button>
                ${state.gameStatus === 'won' ? '<button id="new-game" class="btn">Start new game</button>' : '<button id="end-no-winner" class="btn btn-ghost">Reset game</button>'}
              </div>
            </section>
            <section class="panel">
              <div class="panel-head"><h2>Manual call board</h2><span class="subtle">Tap a lit ball to un-call</span></div>
              <div class="ball-grid">${ballButtons()}</div>
            </section>
          </div>
          <div class="stack">
            <section class="panel">
              <div class="panel-head"><h2>Winning pattern</h2><button class="btn btn-small" data-tab-jump="patterns">Change</button></div>
              <div class="pattern-layout"><div><h3>${esc(pattern.name)}</h3><p class="subtle">Smart draw uses ${patternColumns(pattern).join(', ') || 'no'} columns.</p></div>${patternGrid(pattern)}</div>
              ${patternBlocked ? `<p class="warning">Already won this session.${activeOverride ? ' Repeat override enabled.' : ' Select again to explicitly override.'}</p>` : ''}
            </section>
            <section class="panel">
              <div class="panel-head"><h2>Session</h2><span class="subtle">${state.session.wonPatternIds.length} pattern${state.session.wonPatternIds.length === 1 ? '' : 's'} won</span></div>
              <strong>${esc(state.session.label)}</strong>
              <div class="button-row" style="margin-top:10px"><button id="new-session" class="btn btn-small">Start new session</button></div>
            </section>
          </div>
        </div>
      </section>

      <section class="tab-page ${activeTab === 'patterns' ? 'active' : ''}" data-page="patterns">
        <div class="panel">
          <div class="panel-head"><div><h2>Winning patterns</h2><span class="subtle">Won patterns are blocked for this session unless you override.</span></div><button id="new-pattern" class="btn btn-primary">New custom pattern</button></div>
          <div class="pattern-catalog">${patterns.map((item) => `<div class="history-item"><div><strong>${esc(item.name)}</strong><small style="display:block">${item.builtIn ? 'Built-in' : 'Custom'}${isPatternBlocked(state.session, item.id) ? ' · already won' : ''}</small></div><div class="button-row"><button class="btn btn-small ${item.id === pattern.id ? 'btn-primary' : ''}" data-select-pattern="${esc(item.id)}">${item.id === pattern.id ? 'Selected' : 'Select'}</button>${item.builtIn ? '' : `<button class="btn btn-small" data-edit-pattern="${esc(item.id)}">Edit</button><button class="btn btn-small btn-danger" data-delete-pattern="${esc(item.id)}">Delete</button>`}</div></div>`).join('')}</div>
        </div>
      </section>

      <section class="tab-page ${activeTab === 'settings' ? 'active' : ''}" data-page="settings">
        <div class="panel">
          <div class="panel-head"><h2>Settings</h2><span class="subtle">Saved automatically on this device</span></div>
          <div class="setting-grid">
            <label><span class="field-label">Venue / event name</span><input id="venue-name" value="${esc(state.settings.venueName)}" placeholder="Community Hall Bingo"></label>
            <label><span class="field-label">Voice plays on</span><select id="audio-target"><option value="display" ${state.settings.audioTarget === 'display' ? 'selected' : ''}>Display (default)</option><option value="controller" ${state.settings.audioTarget === 'controller' ? 'selected' : ''}>Controller</option><option value="both" ${state.settings.audioTarget === 'both' ? 'selected' : ''}>Both devices</option></select></label>
            <label class="inline-check"><input id="voice-enabled" type="checkbox" ${state.settings.voiceEnabled ? 'checked' : ''}> Voice announcements</label>
            <label class="inline-check"><input id="draw-sound" type="checkbox" ${state.settings.drawSoundEnabled ? 'checked' : ''}> Draw sound effect</label>
          </div>
          <div class="button-row" style="margin-top:14px"><button id="test-voice" class="btn">Test voice</button></div>
          <small class="build-label controller-build-label" data-build-label></small>
        </div>
      </section>

      <section class="tab-page ${activeTab === 'history' ? 'active' : ''}" data-page="history">
        <div class="panel">
          <div class="panel-head"><h2>Game history</h2><div class="button-row"><button id="export-history" class="btn btn-small">Export CSV</button><button id="clear-history" class="btn btn-small btn-danger">Clear</button></div></div>
          <label><span class="field-label">Filter by session</span><select id="history-filter"><option value="">All sessions</option>${sessions.map(([id, label]) => `<option value="${esc(id)}" ${historySessionFilter === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <div style="margin-top:12px">${historyHtml()}</div>
        </div>
      </section>
    </main>

    <dialog id="winner-dialog"><div class="dialog-inner">
      <h2>Check winner · ${esc(pattern.name)}</h2><p class="subtle">Choose a fast operator confirmation or enter the numbers from the claimed card.</p>
      <div class="mode-picker"><button class="btn ${winnerMode === 'quick' ? 'btn-primary' : ''}" data-winner-mode="quick">Quick confirmation</button><button class="btn ${winnerMode === 'card' ? 'btn-primary' : ''}" data-winner-mode="card">Card entry</button></div>
      <div id="card-entry-wrap" class="${winnerMode === 'card' ? '' : 'hidden'}"><p class="subtle">Enter numbers only in the lit pattern cells. The FREE centre needs no entry.</p><div class="card-entry-grid">${pattern.cells.map((required, index) => `<input type="number" name="card-${index}" min="1" max="75" data-card-index="${index}" class="${required && index !== FREE_INDEX ? '' : 'not-required'}" ${required && index !== FREE_INDEX ? '' : 'disabled'} value="${cardNumbers[index] ?? ''}" placeholder="${index === FREE_INDEX ? 'FREE' : ''}" aria-label="Card cell ${index + 1}">`).join('')}</div></div>
      <div id="winner-result" class="result-box"></div>
      <label style="display:block;margin-top:10px"><span class="field-label">Optional winner note</span><input id="winner-note" placeholder="Winner name or table"></label>
      <div class="dialog-actions"><button class="btn btn-ghost" data-close-dialog="winner-dialog">Cancel</button><button id="record-winner" class="btn btn-primary">Confirm & record BINGO</button></div>
    </div></dialog>

    <dialog id="pattern-dialog"><div class="dialog-inner">
      <h2>${editorPatternId ? 'Edit custom pattern' : 'New custom pattern'}</h2>
      <label><span class="field-label">Pattern name</span><input id="pattern-name" maxlength="60" placeholder="Lucky Horseshoe"></label>
      <p class="subtle">Tap cells to toggle them. The centre is always a free space.</p>
      ${patternGrid({ id: 'editor', name: '', cells: editorCells, builtIn: false }, true)}
      <div class="dialog-actions"><button class="btn btn-ghost" data-close-dialog="pattern-dialog">Cancel</button><button id="save-pattern" class="btn btn-primary">Save pattern</button></div>
    </div></dialog>`;
  injectBuildLabels(root);
  bindEvents();
}

function bindEvents(): void {
  document.querySelector('#pair-button')?.addEventListener('click', () => connect(document.querySelector<HTMLInputElement>('#room-code')?.value ?? ''));
  document.querySelector('#unpair')?.addEventListener('click', unpair);
  document.querySelector('#room-code')?.addEventListener('keydown', (event) => { if ((event as KeyboardEvent).key === 'Enter') document.querySelector<HTMLButtonElement>('#pair-button')?.click(); });
  document.querySelector('#draw')?.addEventListener('click', performDraw);
  document.querySelector('#start-auto')?.addEventListener('click', startAuto);
  document.querySelector('#pause-auto')?.addEventListener('click', () => stopAuto(true));
  document.querySelector('#check-winner')?.addEventListener('click', openWinnerDialog);
  document.querySelector('#applause')?.addEventListener('click', () => peer?.send({ type: 'applause', ts: Date.now() }));
  document.querySelector('#new-game')?.addEventListener('click', resetGame);
  document.querySelector('#end-no-winner')?.addEventListener('click', () => { if (state.drawEngine.called.length === 0 || confirm('Reset this game without recording a winner?')) resetGame(); });
  document.querySelector('#new-session')?.addEventListener('click', () => {
    const label = prompt('Name this new session:', 'Tonight')?.trim();
    if (!label) return;
    if (state.drawEngine.called.length > 0 && !confirm('Starting a new session also resets the current game. Continue?')) return;
    stopAuto(false);
    cancelPendingSpin();
    state.session = createSession(label);
    state.drawEngine = createDrawEngine();
    state.gameStatus = 'idle';
    state.winner = null;
    activeOverride = false;
    persistAndSync(); render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-ball]').forEach((button) => button.addEventListener('click', () => toggleManualCall(Number(button.dataset.ball))));
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => { activeTab = button.dataset.tab ?? 'game'; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-tab-jump]').forEach((button) => button.addEventListener('click', () => { activeTab = button.dataset.tabJump ?? 'game'; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-select-pattern]').forEach((button) => button.addEventListener('click', () => selectPattern(button.dataset.selectPattern!)));
  document.querySelectorAll<HTMLButtonElement>('[data-edit-pattern]').forEach((button) => button.addEventListener('click', () => openPatternEditor(findPattern(state, button.dataset.editPattern!))));
  document.querySelectorAll<HTMLButtonElement>('[data-delete-pattern]').forEach((button) => button.addEventListener('click', () => deleteCustomPattern(button.dataset.deletePattern!)));
  document.querySelector('#new-pattern')?.addEventListener('click', () => openPatternEditor());
  document.querySelector('#save-pattern')?.addEventListener('click', saveCustomPattern);
  document.querySelectorAll<HTMLButtonElement>('[data-editor-cell]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.editorCell);
    editorCells[index] = !editorCells[index];
    button.classList.toggle('on', editorCells[index]);
    button.textContent = index === FREE_INDEX ? 'FREE' : editorCells[index] ? '●' : '';
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => document.querySelector<HTMLDialogElement>(`#${button.dataset.closeDialog}`)?.close()));
  document.querySelectorAll<HTMLButtonElement>('[data-winner-mode]').forEach((button) => button.addEventListener('click', () => {
    winnerMode = button.dataset.winnerMode as 'quick' | 'card';
    document.querySelectorAll('[data-winner-mode]').forEach((item) => item.classList.toggle('btn-primary', (item as HTMLElement).dataset.winnerMode === winnerMode));
    document.querySelector('#card-entry-wrap')?.classList.toggle('hidden', winnerMode !== 'card');
    updateWinnerResult();
  }));
  document.querySelectorAll<HTMLInputElement>('[data-card-index]').forEach((input) => input.addEventListener('input', () => { cardNumbers[Number(input.dataset.cardIndex)] = input.value ? Number(input.value) : null; updateWinnerResult(); }));
  document.querySelector('#record-winner')?.addEventListener('click', recordWinner);
  document.querySelector<HTMLSelectElement>('#interval')?.addEventListener('change', (event) => {
    state.settings.intervalMs = Number((event.target as HTMLSelectElement).value);
    if (autoTimer !== null) { window.clearInterval(autoTimer); autoTimer = window.setInterval(performDraw, state.settings.intervalMs); }
    persistAndSync();
  });
  document.querySelector<HTMLInputElement>('#smart-draw')?.addEventListener('change', (event) => { state.smartDrawEnabled = (event.target as HTMLInputElement).checked; persistAndSync(); render(); });
  document.querySelector<HTMLInputElement>('#venue-name')?.addEventListener('change', (event) => { state.settings.venueName = (event.target as HTMLInputElement).value.trim(); persistAndSync(); });
  document.querySelector<HTMLSelectElement>('#audio-target')?.addEventListener('change', (event) => { state.settings.audioTarget = (event.target as HTMLSelectElement).value as AppState['settings']['audioTarget']; persistAndSync(); });
  document.querySelector<HTMLInputElement>('#voice-enabled')?.addEventListener('change', (event) => { state.settings.voiceEnabled = (event.target as HTMLInputElement).checked; persistAndSync(); });
  document.querySelector<HTMLInputElement>('#draw-sound')?.addEventListener('change', (event) => { state.settings.drawSoundEnabled = (event.target as HTMLInputElement).checked; persistAndSync(); });
  document.querySelector('#test-voice')?.addEventListener('click', speakTest);
  document.querySelector<HTMLSelectElement>('#history-filter')?.addEventListener('change', (event) => { historySessionFilter = (event.target as HTMLSelectElement).value || null; render(); });
  document.querySelector('#export-history')?.addEventListener('click', () => {
    const blob = new Blob([toCsv(filterBySession(loadHistory(), historySessionFilter))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `digital-bingo-history-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  });
  document.querySelector('#clear-history')?.addEventListener('click', () => { if (confirm('Permanently clear the entire game history on this device?')) { clearHistory(); render(); } });
}

render();
if (roomCode) connect(roomCode);
setupPwaUpdates({ canReload: () => !drawSpinner.active });

window.addEventListener('beforeunload', () => peer?.destroy());
