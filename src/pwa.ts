/// <reference types="vite-plugin-pwa/client" />

import { registerSW } from 'virtual:pwa-register';
import { createReloadGuard } from './reloadGuard';
import { BUILD_INFO } from './version';

const UPDATE_INTERVAL_MS = 60_000;
const RELOAD_GUARD_KEY = 'bingo:last-update-reload';
const UPDATE_CAPABILITY_CACHE = 'bingo-update-capability';
const UPDATE_RELOAD_MESSAGE = 'bingo:update-reload';

interface PwaUpdateOptions {
  canReload?: () => boolean;
}

function showUpdateToast(): void {
  if (document.querySelector('.update-toast')) return;
  const toast = document.createElement('div');
  toast.className = 'update-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = 'Updating to the latest version...';
  document.body.append(toast);
}

export function setupPwaUpdates({ canReload = () => true }: PwaUpdateOptions = {}): void {
  if (!('serviceWorker' in navigator)) return;

  let hadController = Boolean(navigator.serviceWorker.controller);
  const guardValue = `${BUILD_INFO.commit}:${location.pathname}`;
  const guardedReload = createReloadGuard({
    canReload,
    beforeReload: showUpdateToast,
    reload: () => {
      sessionStorage.setItem(RELOAD_GUARD_KEY, guardValue);
      location.reload();
    },
    schedule: (callback, delayMs) => { window.setTimeout(callback, delayMs); },
  });
  const requestReload = (): void => {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== guardValue) guardedReload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) requestReload();
    hadController = true;
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if ((event.data as { type?: unknown } | null)?.type === UPDATE_RELOAD_MESSAGE) requestReload();
  });
  let registration: ServiceWorkerRegistration | undefined;
  const checkForUpdate = (): void => {
    if (navigator.onLine) void registration?.update();
  };

  const register = (): void => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registered) {
        registration = registered;
        checkForUpdate();
        window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
      },
      onRegisterError(error) {
        console.error('[bingo] service worker registration failed', error);
      },
    });
  };

  if ('caches' in window) {
    void caches.open(UPDATE_CAPABILITY_CACHE)
      .then((cache) => cache.put(location.href, new Response(BUILD_INFO.commit)))
      .then(register, register);
  } else {
    register();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', checkForUpdate);
}
