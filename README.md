# Digital Bingo Board

Digital Bingo Board is an installable, touch-friendly bingo switchboard. An operator runs the game from a phone or iPad while a TV-connected browser shows a high-contrast 75-ball board. The two devices pair directly through WebRTC using a short PeerJS room code; there are no accounts and no application backend.

## Live app

Open **[Digital Bingo Board](https://shazellb.github.io/Digital-Bingo-Board/)**.

- [TV Display](https://shazellb.github.io/Digital-Bingo-Board/display.html)
- [Controller](https://shazellb.github.io/Digital-Bingo-Board/controller.html)

## Set up a game on a TV

1. On the computer connected to the TV, open the **Display** link. Select **Full screen**. The Display also requests a screen wake lock when the browser supports it.
2. On the operator's phone or iPad, open the **Controller** link. Enter the four-character room code shown on the TV, or scan the TV's QR code.
3. Wait for both screens to say they are connected. The TV hides its room code as soon as the first Controller pairs and locks the room to that device. The paired Controller reconnects automatically after a refresh or network interruption; other devices are rejected.
4. When the TV asks, select **Enable sound** once. Browsers require this interaction before they allow later voice calls and winner applause through the TV speakers.
5. Select a winning pattern, then draw randomly, call physical balls manually, or start continuous auto draw.

Voice announcements default to the Display so they play through the TV speakers. The Settings tab can move voice to the Controller or play it on both devices; applause always plays on the Display. To hand the board to a different operator, use **Unpair / pair a new device** on the connected Controller and confirm. The Display releases the lock and shows a fresh room code. Closing and reopening the Display tab also starts a fresh room if the paired Controller is lost.

## Features

- Cryptographically random, no-repeat 75-ball draws with a presentation-only spinner, plus manual call and confirmed un-call
- 1, 2, 3, 5, or 10 second auto draw with pause/resume and pattern-aware smart draw
- Built-in line, corners, X, coverall, postage stamp, diamond, T, L, frame, and plus patterns
- Create, edit, and delete custom 5×5 patterns
- Quick winner confirmation and pattern-cell card-number verification
- Sessions that block repeat winning patterns unless the operator explicitly overrides
- Persistent game state, settings, custom patterns, and filterable game history
- CSV history export, voice calls, draw feedback, and TV-only crowd applause that also plays when a winner is recorded
- Installable PWA with offline-cached application assets

## Local development

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Vite prints the local URL. Open `/display.html` in one window and `/controller.html` in another. Pairing uses the public PeerJS broker, so both browsers need internet access even when the app is served locally.

Run the automated checks and production build with:

```sh
npm test
npm run build
npm run preview
```

The production build uses the GitHub Pages base path `/Digital-Bingo-Board/`. Pull requests run tests and build checks; pushes to `main` deploy `dist/` through GitHub Pages.

## Audio credits

Audience applause is synthesized at runtime with the Web Audio API. It contains no third-party recording or licensed audio asset.
