/// <reference types="vite-plugin-pwa/client" />

import { registerSW } from 'virtual:pwa-register';
import { BUILD_INFO } from './version';

const UPDATE_INTERVAL_MS = 60_000;
const RELOAD_GUARD_KEY = 'bingo:last-update-reload';
const UPDATE_CAPABILITY_CACHE = 'bingo-update-capability';

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

  let reloadRequested = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  const reloadWhenSafe = (): void => {
    if (!reloadRequested) return;
    if (!canReload()) {
      window.setTimeout(reloadWhenSafe, 100);
      return;
    }
    const guardValue = `${BUILD_INFO.commit}:${location.pathname}`;
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === guardValue) return;
    showUpdateToast();
    window.setTimeout(() => {
      if (canReload()) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, guardValue);
        location.reload();
      }
      else window.setTimeout(reloadWhenSafe, 100);
    }, 700);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) {
      reloadRequested = true;
      reloadWhenSafe();
    }
    hadController = true;
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
