# Privacy Policy — MiniGames Arcade

_Last updated: 2026-05-25_

MiniGames Arcade ("the Games", "we", "us") is a collection of seven free browser
games maintained by Philippos Ktistakis. This policy explains what data the
Games collect — and what they don't.

## TL;DR

- We don't collect anything. There's no server.
- Everything that needs to be saved (your high score, settings, unlocked skins)
  is stored **on your own device** in your browser's `localStorage`.
- No ads. No analytics. No tracking. No third-party scripts.
- The Games never ask for your email, your name, your contacts, your camera,
  your microphone, your location, or your photos.

## What is stored locally

Each game writes to your browser's `localStorage` under a key like
`bounce-ball:v1:*` or `the-rising:v1:*`. The data is small (typically under
50 KB per game) and includes only:

- Your settings (sound volume, color-blind mode, haptics, etc.).
- Your progress (which levels you've cleared, stars earned, characters
  unlocked, coins).
- Your local leaderboard entries (a 3-letter name you choose plus your scores).
- A toggle for whether you've completed the "first-run" tutorial.

You can wipe all of it at any time from each game's **Settings → Reset
Progress** button, or by clearing browser storage for the site.

## What is *not* stored or transmitted

- Your name, email, phone, address, IP address, or any other identifier.
- Your gameplay session, taps, screen recordings, or screenshots.
- Any analytics or telemetry of any kind.
- Crash reports.
- Cookies.

## Children

The Games are suitable for all ages. We do not knowingly collect any personal
information from children — because we do not collect any personal information
from anyone. This policy is intended to satisfy COPPA, GDPR-K, and similar
child-privacy regimes by design (zero-collection).

## Service Worker / offline cache

Each game registers a service worker that caches its own static files
(HTML, CSS, JS, SVG) so the game works offline after the first load. The
service worker only caches files served from the same origin as the game.
It does not phone home.

## Third-party services

None. The Games include no third-party scripts, no SDKs, no ad networks,
no analytics, no CDN-loaded code, and no remote fonts. Everything ships
self-contained from the same origin as the page.

## Future native apps (iOS, Android)

If/when the Games ship as native iOS or Android apps via Capacitor, the same
zero-collection rule applies. The native shells will:

- Not request push notifications.
- Not request location, contacts, camera, microphone, photos, or any other
  sensitive permission.
- Persist save data only in the app's local sandbox.
- Not include any third-party SDK.

If that ever changes, this policy will be updated **before** the change ships.

## Contact

Questions or concerns: open an issue at
<https://github.com/philipposk/MiniGames/issues>.
