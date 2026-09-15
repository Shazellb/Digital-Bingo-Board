# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- `docs/SPEC.md` is the product acceptance contract; keep the app and tests aligned with it.
- Use `npm test` and `npm run build` before shipping. GitHub Pages deployment and the required `/Digital-Bingo-Board/` base path are defined in `.github/workflows/pages.yml` and `vite.config.ts`.
- Controller room codes belong in the URL fragment (`controller.html#CODE`), not the query string, so the multi-page PWA service worker resolves the correct cached document.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
