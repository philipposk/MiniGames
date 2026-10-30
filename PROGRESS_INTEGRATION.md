# MiniGames progress integration

## Shared API

Load `shared/progress.js` in each game HTML before `game.js`:

```html
<script src="../shared/progress.js"></script>
```

Report one completed run:

```js
MGProgress.report('game-slug', score, { unit: 'pts' });
```

For time-based games:

```js
MGProgress.report('rock-simulator', seconds, { unit: 'sec', higherIsBetter: false });
```

## Per-game calls

- stick-runner: `MGProgress.report('stick-runner', Math.floor(S.dist), { unit: 'm' });`
- color-clash: `MGProgress.report('color-clash', this.score, { unit: 'pts' });`
- piano-tap: `MGProgress.report('piano-tap', score, { unit: 'pts' });`
- bounce-ball: `MGProgress.report('bounce-ball', score, { unit: 'pts' });`
- helix-drop: `MGProgress.report('helix-drop', score, { unit: 'pts' });`
- the-rising: `MGProgress.report('the-rising', score, { unit: 'pts' });`
- crossy-road: `MGProgress.report('crossy-road', distance, { unit: 'm' });`
- rock-simulator: `MGProgress.report('rock-simulator', seconds, { unit: 'sec', higherIsBetter: false });`

## Stick Runner example

In `die()`, after the existing best-distance save:

```js
MGProgress.report('stick-runner', Math.floor(S.dist), { unit: 'm' });
```

## Storage

All data remains local under `minigames:v1:progress`. The hub reads it automatically and updates its Best/Plays badges live.