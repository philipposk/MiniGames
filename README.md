# MiniGames Arcade

A small collection of simple games you can play right in your web browser — on your phone or computer. They're free, there are no ads, nothing to sign up for, and they even work without an internet connection. Each game saves your progress on your own device, so nothing about you is collected or sent anywhere.

It's made for anyone who wants a quick, no-fuss bit of fun: a few minutes of breaking bricks, dodging traffic, or tapping along to a tune.

## What it does
- Lets you play several quick games from one home page
- Works on phones, tablets, and computers, and keeps working with no signal
- Saves your scores, coins, and unlocked items on your own device
- Has local high-score lists and daily challenges
- Lets you earn coins and spend them on cosmetic extras (skins, colors, hats)
- Can be installed like a real app on your home screen

The games include a brick-breaker, a color-timing game, an endless runner, a climbing puzzle, a ball-drop game, a tap-to-hop crossing game, and a piano rhythm game.

## Status
Working website that you can also add to your phone like an app. The same files can be packaged into proper iOS and Android apps.

---
### For developers
Pure HTML/CSS/JavaScript, no build step. Each game lives in its own self-contained folder and is a Progressive Web App (offline-capable via a versioned service worker + `manifest.webmanifest`). The root `index.html` is the arcade hub. Shared feature layer across games: hash routing, versioned `localStorage` namespaces, per-mode local leaderboards, achievements with coin economy/cosmetic shop, accessibility (real buttons, ARIA, focus-visible, reduced-motion), HiDPI canvas, WebAudio. Zero data collection (see `PRIVACY.md`). Run locally:

```bash
python3 -m http.server 8080
open http://localhost:8080/
```

Deploys to GitHub Pages via `.github/workflows/static.yml` on push to `main`. Also wraps to native iOS/Android via Capacitor — see `NATIVE.md`. License: MIT.
