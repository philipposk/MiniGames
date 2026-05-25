# Helix Drop

A mobile-first portrait HTML5 game. Vanilla JS, canvas-rendered, zero dependencies.

Spin the tower. Find the gap. Survive the drop.

## Run locally

Open `index.html` directly in any modern browser (file:// works), or serve the folder:

```bash
# Python 3
python3 -m http.server 8000
# then visit http://localhost:8000/
```

No build step. No npm install. Works offline once cached by the service worker.

## Deploy

Drop the folder into any static host (GitHub Pages, Netlify, Cloudflare Pages, plain S3).
All asset paths are relative — works fine when served from a subpath like
`https://<user>.github.io/MiniGames/helix-drop/`.

## Controls

- **Drag** anywhere on the playfield: rotate the tower (release to fling).
- **Mouse drag** on desktop: same.
- **A / D** or **← / →**: rotate left/right (hold for spin).
- **P** or **Esc**: pause / resume.
- Pause and on-screen rotation buttons are also tappable.

## Modes

- **Levels** — 30 hand-tuned stages. 3 stars per level: clear / no-bounce / under target time.
  Levels unlock sequentially. You can skip the next locked level for 5 coins.
- **Endless** — procedurally generated, infinite tower. Difficulty soft-caps after depth 200.
  Persists best score + best depth.
- **Daily Challenge** — same seed for everyone, per-date leaderboard.

## Progression

- Earn coins per disc passed and on combo milestones.
- Spend coins in the **Shop** on 5 ball skins and a **Ghost** power
  (lets you survive one kill segment per run, 50 coins).
- 12 achievements unlock automatically as you play.

## Accessibility

- All on-screen actions are real `<button>` elements (keyboard-navigable, ARIA labels).
- **Colorblind mode** in Settings: kill segments get a stripe pattern + marker.
- **Reduced motion** disables screen shake and particle bursts.
- Min 48px tap targets throughout.

## Save data

All state is in `localStorage` under the `helix-drop:v1:*` namespace.
Wipe via Settings → "Wipe Save Data".

## Files

- `index.html` — menu screens, HUD, overlays.
- `styles.css` — theme, layout.
- `game.js` — game loop, entities, audio, persistence.
- `manifest.webmanifest` — PWA install metadata.
- `service-worker.js` — offline app shell cache.
- `icons/icon.svg` — single maskable icon.
