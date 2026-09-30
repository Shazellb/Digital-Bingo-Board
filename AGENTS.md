# Digital Bingo Board agent guide

This file is the single source of truth for agents in this repo (`CLAUDE.md` only imports it). Keep it concise; point to files instead of copying detail.

## Project overview and where state lives

Static multi-page PWA (Vite, TypeScript, PeerJS) for running live bingo: `display.html` (TV) and `controller.html` (operator) pair peer to peer, `index.html` is the landing page. `docs/SPEC.md` is the product acceptance contract; keep the app and tests aligned with it.

- Game state: the Display owns it in `src/state/appState.ts` (localStorage `bingo:appstate`), with draw history in `src/engine/history.ts` (`bingo:history`). Pure game logic lives in `src/engine/`.
- Pairing: `src/peer/` (`peerHost.ts` on Display, `peerClient.ts` on Controller, `protocol.ts` message shapes, `pairingLock.ts` secret that the first valid Controller claims). The Controller keeps its secret and last room in localStorage (`bingo:last-room`, key from `controllerSecretStorageKey`); the Display keeps its room code in sessionStorage (`bingo:display-room`).
- PWA and updates: service worker built by `vite-plugin-pwa` in `vite.config.ts`, registered by `src/pwa.ts`, with `public/sw-update-bridge.js` and `src/reloadGuard.ts` guarding update reloads (`bingo:last-update-reload` in sessionStorage). Win confetti dedupe is `src/confettiTracker.ts` (sessionStorage).

## Sharp edges

- The required base path is `/Digital-Bingo-Board/` (`vite.config.ts`); GitHub Pages deployment is `.github/workflows/pages.yml`.
- Controller room codes belong in the URL fragment (`controller.html#CODE`), not the query string, so the multi-page PWA service worker resolves the correct cached document.
- `display.ts`'s `render()` replaces `#app`'s entire `innerHTML` on almost every state change. Any DOM that must survive across renders (e.g. the confetti canvas in `src/confetti.ts`) is created once and appended outside `#app` (see `confettiCanvas` in `display.ts`), not inside the templated markup.
- Treat localStorage, sessionStorage, PeerJS payloads, URL fragments, service-worker messages, and CSV cells as untrusted input. Runtime-validate the full nested shape before use. Every pairing or connection change needs tests for stale connections, replaced connections, duplicate events, and reload during transition.
- `Input/` and `Output/` folders are never tracked in git (they are in `.gitignore`); never commit their contents.

## Build, test, verify

Node 24 or newer (`package.json` engines). Scripts from `package.json`:

- `npm ci` installs dependencies.
- `npm test` runs the vitest suite once (`npm run test:watch` for watch mode).
- `npm run build` runs `tsc -b` then `vite build` into `dist/`.
- `npm run dev` starts Vite; `npm run preview` serves the built `dist/`.

Run `npm test` and `npm run build` before shipping; CI runs the same two steps on every PR. Verify a deployed build at `https://shazellb.github.io/Digital-Bingo-Board/`: each page shows a build label `Build <commit> · <date>` (`src/version.ts`), which must match the merged commit's first 7 characters once the Pages workflow on `main` finishes.

## Handoff

At session start read: this file, `docs/SPEC.md`, the Lessons section below, `git log --oneline -10`, and open PRs (`gh-axi`).

At session end update: Lessons for any recurring error (see below), and any fact in this file that your change made false or newly important. Prune rather than append.

## Lessons

Append one dated line per recurring error: `YYYY-MM-DD: what went wrong. Fix: what to do instead.` Check this list before starting similar work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
