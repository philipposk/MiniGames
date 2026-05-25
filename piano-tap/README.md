# Piano Tap

Tile-tapping rhythm game. Vanilla JS, no build step, no dependencies, no CDNs.
All audio is synthesized at runtime via WebAudio. All visual art is canvas-drawn
or inline SVG. Original procedural melodies only - no copyrighted material.

## Play

Open `index.html` in a browser. For best results use a local server (Service
Worker registration requires http/https, not `file://`):

```
python3 -m http.server 8000
# then visit http://localhost:8000/piano-tap/
```

The site is fully relative-path so it deploys directly to GitHub Pages.

## Controls

- Touch / mouse: tap the dark tiles as they cross the hit line.
- Keyboard: `D F J K` for lanes 1 through 4.
- Pause: `P` or `Esc`, the pause button, or hiding the tab.

## Rules

- Tapping an empty lane = game over.
- Letting a dark tile pass the hit line = game over.
- Grading is by tap timing relative to the note's scheduled hit time:
  - Perfect: <=30 ms (+3, combo)
  - Great:   <=60 ms (+2, combo)
  - OK:      <=100 ms (+1, combo)
  - Late:    >100 ms but before next note (+0, breaks combo, still counts as a hit)

## Modes

- **Classic**: endless. Tempo ramps every 16 bars.
- **Arcade**: 30-second sprint.
- **Rush**: tempo ramps fast - survive as long as possible.
- **Daily Challenge**: seeded song + special modifier. Completing unlocks
  bonus song "Galaxy".

## Songs

Six original procedurally-generated 16-bar loops:

1. Lullaby (C major, 80 BPM)
2. Skies (A minor, 6/8, 110 BPM)
3. Race (pentatonic, 140 BPM)
4. Storm (minor, 130 BPM, beats 2 and 4 accent)
5. Dream (major 7th chords, 100 BPM)
6. Galaxy (bonus, pentatonic, 150 BPM)

Songs unlock progressively. Complete a song = unlock the next.

## Audio architecture

- Single `AudioContext`. Master gain feeds music bus and SFX bus.
- All notes scheduled with `AudioContext.currentTime` (audio clock), not
  `setTimeout`, for rhythm accuracy.
- Synth uses triangle oscillator + ADSR envelope for melody; sine for bass.
- Player hits play the corresponding note when crossing the hit line.
- Misses produce a soft filtered-noise "clunk".

## Latency calibration

Settings -> Calibrate plays 8 metronome beats; tap on each one. The median
offset is stored and applied to all hit-window comparisons. Manual slider
range: -100 ms to +100 ms.

## Persistence

All data lives under the `piano-tap:v1:*` localStorage namespace:

- `settings` - volumes, haptics, latency offset, colorblind, reduced-motion
- `unlocks.songsUnlocked` - which songs are playable
- `leaderboard[songId]` - top 10 per song
- `bestPerSong[songId]` - high score + accuracy per song

Settings -> Reset all data clears the namespace.

## Accessibility

- Real `<button>` elements with keyboard nav.
- Colorblind palette toggle.
- Reduced-motion toggle disables ripples, dampens particles.
- ARIA labels on icon buttons.

## Files

```
piano-tap/
  index.html
  game.js
  styles.css
  manifest.webmanifest
  service-worker.js
  icons/icon.svg
  README.md
```

## Caveats

- Mobile-browser audio latency can be substantial on iOS Safari. Use the
  Calibrate flow before serious play.
- Service Worker only registers on http/https origins. On `file://` the game
  still works but offline caching is skipped.
- AudioContext starts suspended on most browsers until the first user
  gesture - any menu interaction unlocks it.
