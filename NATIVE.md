# Native iOS &amp; Android — Capacitor wrap

This repo doubles as a Capacitor web project. The same files that serve the
PWA on GitHub Pages can be wrapped into a native iOS app (Xcode) and a native
Android app (Android Studio).

## Prereqs

- macOS for iOS builds + Xcode 15+
- Android Studio Hedgehog+ for Android builds
- Node.js 18+
- An Apple Developer account ($99/yr) and a Google Play Developer account
  ($25 one-time) for store submission

## First-time setup (once per machine)

```bash
cd "/path/to/MiniGames"
npm install
npm run cap:init       # prints the one-liner; copy/paste if not already initted
npm run cap:add:ios
npm run cap:add:android
```

## Day-to-day

Make web changes in this repo, then sync the native shells:

```bash
npm run cap:sync
npm run cap:open:ios     # opens Xcode
npm run cap:open:android # opens Android Studio
```

In Xcode / Android Studio, hit Run to install on a device or simulator.

## Store assets you'll need to create separately

iOS:

- App icon set (Capacitor scaffolds default; replace `ios/App/App/Assets.xcassets/AppIcon.appiconset/`)
- Launch screen storyboard (Capacitor scaffolds default)
- 6.7" + 6.5" + 5.5" iPhone screenshots (3 each minimum)
- 12.9" iPad screenshots if you submit for iPad
- App Store description, keywords, support URL, marketing URL, privacy URL
  (point to `PRIVACY.md` rendered on GitHub)

Android:

- 512×512 PNG icon
- 1024×500 feature graphic
- Phone screenshots (16:9 or 9:16, min 2)
- Short description (80 chars) + full description (4000 chars)
- Privacy policy URL (point to `PRIVACY.md` rendered on GitHub)

## What ships in the wrap

The Capacitor `webDir` is the repo root, so the wrap includes:

- The hub `index.html` (lands you on the 7-game grid)
- All 7 game folders
- All service workers and manifests
- `PRIVACY.md`, `TERMS.md`, `LICENSE`

If you'd rather ship a single game per app (e.g. submit each game as its own
listing), change `webDir` in `capacitor.config.json` to that game's folder
(e.g. `"webDir": "bounce-ball"`) and run a separate `cap add` in a fork.

## Permissions

None of the Games request any sensitive permission. The Info.plist / Android
manifest should not contain microphone, camera, location, contacts, photos,
or push entries. If Capacitor's default scaffolds add any, remove them before
submitting.

## Privacy &amp; data-safety form

Both stores will ask you a privacy questionnaire. Answer:

- Data collected: **None**
- Data shared with third parties: **None**
- Data used for tracking: **No**
- Encryption in transit: **N/A (no network)** (or "Standard HTTPS" if you
  load remote anything later)

That matches the policy in `PRIVACY.md`. Don't enable analytics SDKs without
updating both first.
