# MiniGames Arcade

Seven free, mobile-first, offline-ready browser games. No ads, no tracking,
no sign-up. Each game saves to your device. Every game is a Progressive Web
App and can be wrapped as a native iOS/Android app.

Live (when GitHub Pages is enabled): <https://philipposk.github.io/MiniGames/>

## The games

| Game | Type | Highlights |
|---|---|---|
| [Bounce Ball](bounce-ball/) | Brick breaker | 30 hand-tuned levels, power-ups, combos, paddle &amp; ball skins, daily challenge |
| [Color Clash](color-clash/) | Reflex / timing | 4 modes (Classic / Speed / Zen / Daily), 30 unlockable color packs, palette &amp; shape shop |
| [Stick Runner](stick-runner/) | Endless runner | 4 biomes (Forest / Desert / City / Space), 8 unlockable characters, hat &amp; trail shop |
| [The Rising](the-rising/) | Puzzle platformer | Vertical world-map frontcard, hero walks node-to-node, 20 hand-tuned levels, 5 hero skins |
| [Helix Drop](helix-drop/) | 1-thumb arcade | Rotate the spinning helix to drop the ball, 30 levels + endless + daily, 5 ball skins, ghost power |
| [Crossy Hop](crossy-road/) | Tap-to-hop | 5 lane types (grass / road / water / rail / ice), 8 characters, classic / daily / zen modes |
| [Piano Tap](piano-tap/) | 4-lane rhythm | 6 procedural original tunes, latency calibration, classic / arcade / rush / daily modes |

## Universal feature layer

Every game ships with:

- Hash routing — `#menu`, `#level/<n>`, `#settings`, `#leaderboard`,
  `#achievements`, `#shop`, `#daily`, `#how-to`, `#credits`. Browser back works.
- Versioned `localStorage` namespace (`<game>:v1:*`), wrapped in `try/catch`.
- Settings: SFX volume, music volume, haptics, colorblind mode,
  reduced-motion, language stub, **Reset progress** button.
- Local top-10 leaderboards per mode + daily slot (seeded by `YYYY-MM-DD`).
- 3-letter arcade-style name entry on a new best.
- ≥10 achievements per game with on-screen toast + coin bonus on unlock.
- Coin economy + cosmetic shop (skins / palettes / hats / etc.).
- PWA install — `manifest.webmanifest`, versioned `service-worker.js`
  (cache-first app shell), SVG icon, `apple-touch-icon` meta.
- Accessibility — real `<button>` elements, ARIA labels, `:focus-visible`
  outlines, keyboard navigation, `prefers-reduced-motion` respected.
- HiDPI canvas, audio unlocked on first user gesture.
- WebAudio ambient music pad on every game (musicVol slider in settings).

## Run it locally

No build step. Just serve the folder:

```bash
git clone https://github.com/philipposk/MiniGames.git
cd MiniGames
python3 -m http.server 8080
open http://localhost:8080/
```

Or open any game's `index.html` directly via `file://` — the service worker
silently skips registration off `http(s)://` so file-protocol still works.

## Deploy to GitHub Pages

Already wired via `.github/workflows/static.yml`. Push to `main` and the
page updates. The repo's root `index.html` is the arcade hub.

## Native iOS &amp; Android

The repo doubles as a [Capacitor](https://capacitorjs.com) web project — same
files wrap into a native iOS app (Xcode) and a native Android app (Android
Studio). Full instructions: [`NATIVE.md`](NATIVE.md).

```bash
npm install
npm run cap:init
npm run cap:add:ios
npm run cap:add:android
npm run cap:sync
npm run cap:open:ios       # opens Xcode
npm run cap:open:android   # opens Android Studio
```

## Privacy &amp; terms

- [`PRIVACY.md`](PRIVACY.md) — zero-collection. No analytics, no ads, no
  third-party scripts. Everything stays on your device.
- [`TERMS.md`](TERMS.md) — MIT source license, no warranty.

## Repo layout

```
.
├── index.html                  # arcade hub
├── manifest.webmanifest        # hub PWA manifest
├── service-worker.js           # hub PWA SW
├── icon.svg                    # hub icon
├── capacitor.config.json       # iOS / Android wrap config
├── package.json                # capacitor scripts
├── PRIVACY.md                  # privacy policy
├── TERMS.md                    # terms of use
├── NATIVE.md                   # iOS / Android build guide
├── LICENSE                     # MIT
│
├── bounce-ball/                # game folder — self-contained
├── color-clash/
├── crossy-road/
├── helix-drop/
├── piano-tap/
├── stick-runner/
├── the-rising/
│
├── color-clash-dev/            # scratch / dev variants — not deployed
├── the-rising-dev/             # scratch / dev variants — not deployed
└── .github/workflows/          # CI for GitHub Pages
```

## License

[MIT](LICENSE) © 2026 Philippos Ktistakis. Free to fork, modify, and
redistribute under MIT terms. Game art and music are procedural / CSS /
SVG — no bundled third-party assets.
