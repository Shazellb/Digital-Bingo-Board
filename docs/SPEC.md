# Digital Bingo Board - v1 spec

Captain's goal: a working application by the morning of 2026-09-15 that lets one operator run an entire bingo game for a large group.
It replaces a hardware bingo switchboard: the operator controls the game on a phone or iPad, and a TV (connected over HDMI to any browser device) shows the live board.

## Decisions already made by the captain (do not re-ask)

- Platform: web app, installable PWA. Must work in iPad/iPhone Safari and desktop Chrome/Edge.
- Two views of one game:
  - **Controller** - the operator's switchboard on phone/iPad (touch-first, portrait and landscape).
  - **Display** - the TV board, full-screen, readable from the back of a hall.
- Pairing: room-code sync using PeerJS (WebRTC) over PeerJS's free public broker. No account, no backend of our own. Display shows a short room code and QR code until the first Controller pairs, then hides them and locks to that Controller's persistent secret. The paired Controller auto-reconnects; an explicit Controller action releases the lock and creates a fresh room. The Controller is the source of truth; Display re-syncs full state on (re)connect.
- Hosting: free static hosting on GitHub Pages from this public repo, so there is a live URL by morning.
- Voice: browser built-in text-to-speech (Web Speech API). Calls sound like "N ... 37". Default audio plays on the Display device (the TV speakers); provide a setting to play on the Controller instead or both.
- Branding: "Digital Bingo Board" in the brand area of the Display, plus an operator-editable venue/event name shown alongside it.
- Auto-draw interval choices: 1, 2, 3, 5, 10 seconds; default 5.
- Repository: github.com/Shazellb/Digital-Bingo-Board, public, delivery `direct-PR`.

## Display (TV) layout

Model it on the reference hardware board:

- A 75-ball board: rows B (1-15), I (16-30), N (31-45), G (46-60), O (61-75), letter at the start of each row. Called numbers lit bright; uncalled dim.
- A very large "current call" panel (e.g. `N-37`).
- Random draws cycle through ball labels and decelerate to the selected ball before the board, history, count, sound, and voice update. Reduced-motion users get a minimal transition.
- The previous few calls (e.g. last 3: `N-40`, `N-45`, `B-14`).
- The count of balls called.
- The current winning pattern shown on a 5x5 B-I-N-G-O mini grid (free centre marked), with the pattern name.
- Brand area: "Digital Bingo Board" + venue name.
- Dark, high-contrast, large type, sized to 16:9 at 720p/1080p/4K with no scrolling. Full-screen button; keep the screen awake (Wake Lock API where supported).
- Visible, obvious states: waiting for controller / connected / paused / game over "BINGO!" celebration.

## Controller (operator switchboard)

- Pair with a Display by room code; show connection status clearly and auto-reconnect.
- **Manual draw**: a big "Draw" button picks the next random number; repeated presses are ignored while its result is spinning.
- **Manual call**: tap any number on a 75-button grid to call it (for operators pulling physical balls); tap again to un-call a mistake with confirmation.
- **Continuous auto draw**: start, pause, resume; the interval picker (1/2/3/5/10 s, default 5).
- **Smart auto draw**: when a pattern is selected, draw only from letters/columns that can still contribute to that pattern (e.g. a pattern that uses only the B and O columns only draws B and O numbers). For patterns using every column this is the normal draw.
- Random numbers must use `crypto.getRandomValues` with no repeats within a game.
- Sound: voice call on/off, draw sound on/off (numbers are still announced when draw sound is off), an "Applause" button that plays on the Display, and a test-voice button.
- **Winning patterns**: pick from built-ins and change quickly between games. Built-ins at minimum: any single line (row / column / diagonal), four corners, X, blackout / coverall, postage stamp, small diamond, letter T, letter L, outside frame, plus.
- **Custom pattern editor**: tap cells on a 5x5 grid to create, name, save, edit, and delete patterns.
- **Winner check**: operator checks a claimed bingo. The app shows whether the called numbers can satisfy the active pattern, and lets the operator key in the player's card numbers for the pattern's cells to verify the claim against called numbers. Offer the quick version (confirm and record) and the card-entry version.
- **New game / end game**: end a game by recording a winner (pattern, winning ball, balls called, timestamp, optional note), then start a fresh game.
- **Sessions ("tonight")**: a session groups the games of one event. Patterns already won in the current session are blocked with a clear warning and an explicit operator override. Starting a new session clears the block but not the history.
- **History log**: a persistent log of every game, kept on the Controller device (localStorage/IndexedDB): session, pattern, winning ball, balls called, time. Filterable by session, exportable as CSV, clearable with confirmation.
- Settings persist on the device: interval, voice/sound, audio device, venue name.
- Survives a Controller refresh mid-game without losing the game (persist game state locally).

## Quality bar

- Stack is the builder's choice; a small, well-tested TypeScript + Vite app is a sensible default. No paid services.
- Unit tests for the draw engine (no repeats, smart-draw column restriction), pattern matching, winner check, repeat-pattern blocking, and history persistence.
- A README covering: what it is, the live URL, how to set up a game on a TV (open the Display URL on the TV-connected device, go full screen, pair from the phone), and local development.
- Verify the real flow end to end in two browser windows (Display + Controller) before calling it done, including pairing, auto draw, pause/resume, pattern change, a won game, and repeat blocking.
- Deploy to GitHub Pages and confirm the live URL loads both views.
