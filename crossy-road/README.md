# Crossy Hop

A tap-to-hop infinite hopper built with vanilla HTML, CSS, and JavaScript. No build step, no dependencies, no binary assets. All art is drawn live on a canvas; all sound is synthesised with the Web Audio API.

Inspired by the classic "tap forward, dodge cars" genre — without copying any of its art or names.

## Play

Open `index.html` directly in a browser, or serve the folder:

```bash
cd crossy-road
python3 -m http.server 8000
# then visit http://localhost:8000
```

The game is mobile-first portrait and scales to desktop. Designed to be served from a GitHub Pages subpath — all paths in the project are relative.

## Controls

- **Tap** the screen to hop forward.
- **Swipe** any direction to move that way.
- Keyboard: **arrow keys**, **WASD**, **space** to hop, **P** or **Esc** to pause.
- On-screen D-pad buttons are also available.

## Modes

- **Classic** — endless. Beat your high score.
- **Daily Challenge** — same map for every player, every day. Cross 50 tiles as fast as you can.
- **Zen** — no cars, no trains. Just grass and rivers. Relaxing.

## Characters

Eight unlockable characters, paid for with coins picked up during runs. The default chick is free; the rest cost 100–500 coins.

## Lane types

- **Grass** — safe, may contain trees that block tiles.
- **Road** — cars and trucks. Don't get squashed.
- **Water** — must stand on a floating log. Open water = drown.
- **Railway** — fast trains. Watch for the 1.5-second warning flash.
- **Ice** — slippery. A single hop slides you until you hit something.

## Features

- HiDPI canvas with faux-isometric cube rendering.
- Procedural lane generation with a difficulty curve.
- Particles, camera shake, screen flash.
- WebAudio SFX (hop, splash, train, coin, death, unlock) and an optional ambient lo-fi music loop.
- Persistent settings, unlocks, coins, best score, and leaderboards in `localStorage` (namespaced `crossy-hop:v1:*`).
- 3-letter name entry on new high scores.
- Top-10 leaderboards for classic, daily, and zen.
- Accessibility: real `<button>` elements with ARIA labels, keyboard support, colorblind aids (patterns + yellow warnings instead of red), reduced-motion mode (no shake or confetti), haptic feedback toggle.
- Pause via button, `P`, `Esc`, or tab-hide.
- Hash-based routing (`#/play`, `#/characters`, ...).
- PWA shell: `manifest.webmanifest` + cache-first service worker (`crossy-hop-v1`).

## Files

- `index.html` — menu, overlays, canvas
- `game.js` — game loop, world, hopper, audio, save manager, UI, router
- `styles.css` — theme, layout, responsive
- `manifest.webmanifest` — PWA manifest
- `service-worker.js` — offline cache
- `icons/icon.svg` — app icon

## Notes

- No external network calls, no analytics, no trackers.
- Storage is wrapped in `try/catch` so private-mode browsers won't crash.
- `node --check` clean on `game.js` and `service-worker.js`.
