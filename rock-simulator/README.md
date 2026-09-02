# Rock Simulator

**You are a rock. Do nothing, brilliantly.**

An idle / incremental game about erosion, moss, and deep time. Part of the
[MiniGames arcade](../). Vanilla JS, no build step, no dependencies, works
fully offline as a PWA.

Play: https://minigames.6x7.gr/rock-simulator/

## The loop

| Thing | What it does |
| --- | --- |
| **Grit** | Main currency. Tap the rock for it, or buy erosion and let it accrue. |
| **Moss** | Grows *only while you are not tapping*, ramping up to 3× after five quiet minutes. Buys permanent multipliers. |
| **Cracks** | Appear on your surface at random. Tap one within 8s for a motherlode, a ×7 tap frenzy, or ×3 erosion. |
| **Eras** | Pebble → Stone → Rock → Boulder → Monolith → Meteorite → Mountain → Planetoid → Continent. Each doubles your multiplier and regenerates your silhouette. |
| **Sediment** | Prestige currency. "Erode" wipes the run and grants sediment worth a permanent +2% each. |

Offline progress: 8 hours of grit (at 50% efficiency) and 12 hours of moss are
banked while the tab is closed.

## Why it is different from the other games here

Everything else in the arcade is a reflex game. This one rewards *not* playing —
moss only grows while you leave it alone — so it works as the thing you keep in
a background tab. It is the only game in the arcade with offline progression and
a prestige layer.

## Files

```
index.html            screens + overlays
styles.css            stone/moss palette, light + dark
game.js               economy, procedural rock renderer, save/offline, UI
service-worker.js     offline app shell
manifest.webmanifest  PWA install
icons/icon.svg        app icon
```

Shared arcade modules (`../shared/`) supply theme, identity, share cards and the
opt-in global leaderboard — same as every other game here.

## Save data

Everything lives in `localStorage` under `rock-simulator:v1:*`. No network calls
unless you opt into the global leaderboard. **Settings → Stats → Wipe Save**
resets it.

## Local dev

```bash
python3 -m http.server 8000
# then open http://localhost:8000/rock-simulator/
```

Service workers and modules need a real HTTP origin, so `file://` will not work.
