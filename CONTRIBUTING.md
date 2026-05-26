# Contributing to MiniGames Arcade

Thanks for considering a contribution. This repo is small and intentionally
keeps a tight tech footprint: vanilla JS, vanilla CSS, no build step, no
third-party scripts at runtime.

## Quick start

```bash
git clone https://github.com/philipposk/MiniGames.git
cd MiniGames
python3 -m http.server 8080
open http://localhost:8080/
```

That's the dev environment. No `npm install` required to play.

If you want to wrap the project into a native iOS/Android app (Capacitor),
see [`NATIVE.md`](NATIVE.md). The root `package.json` only lists the
Capacitor CLI as a dev dependency.

## Repo layout

```
.                          # hub (index.html, icon.svg, manifest, SW)
├── bounce-ball/           # one folder per game, self-contained
├── color-clash/
├── crossy-road/
├── helix-drop/
├── piano-tap/
├── stick-runner/
├── the-rising/
└── shared/                # cross-game JS modules (theme, identity, share)
```

Every game has the same surface:

- `index.html` — entry point with hash routing
- `game.js` (sometimes `app.js`) — game loop + screens
- `styles.css` — game-specific CSS
- `manifest.webmanifest` + `service-worker.js` — PWA bits
- `icons/icon.svg` — game icon

## Conventions

- **Vanilla only.** No React, no Vue, no Svelte, no bundlers. If you find
  yourself reaching for one, file an issue first to discuss.
- **No external CDNs at runtime.** Fonts are the only exception (Google Fonts
  on the hub). Don't add jQuery, Lodash, animation libraries, etc.
- **No tracking.** No analytics, no Sentry, no Datadog, no Plausible (yet).
  See [`PRIVACY.md`](PRIVACY.md) — zero-collection is a feature, not an
  oversight.
- **Mobile-first.** Test on a phone first. Minimum tap target is 44×44 px.
  Audio must unlock on the first user gesture.
- **localStorage namespace** is `<game>:v1:<key>` for game-local data,
  `minigames:v1:<key>` for cross-game data (identity, theme). Bump the
  version number if you change the schema in a breaking way.
- **Accessibility**: real `<button>` elements, ARIA labels on icon-only
  buttons, focus visible, `prefers-reduced-motion` respected.

## How to add a game

1. Copy the smallest existing game (`bounce-ball` or `helix-drop`) as a
   starting template.
2. Pick a folder name (kebab-case).
3. Wire it into the hub by adding a card in `/index.html` (with a 16:10
   SVG thumbnail in `/icons/<game>.svg`).
4. Reuse `shared/theme.js`, `shared/identity.js`, `shared/share.js`.
5. Add a `manifest.webmanifest` + `service-worker.js` + `icons/icon.svg`.
6. Update `README.md`'s game table.

## How to file an issue

- Bug? Include browser + OS + a reproducible step list.
- Feature? Skim the existing list under `Issues` first; check that it
  doesn't violate the principles above (no analytics, no auth-locked
  features, no native-store-only features).
- Design idea? Drop a PNG/Figma link in the issue.

## Pull request rules

- One game per PR (unless the change is genuinely cross-cutting like a
  bug in `shared/`).
- Run `node --check <file>` on every modified JS before opening the PR.
- For visual changes, attach a before/after screenshot.
- Don't add Claude (or any AI) as a co-author on commits.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

By contributing you agree that your contribution is licensed under the same
MIT license as the rest of the repo (see [`LICENSE`](LICENSE)).
