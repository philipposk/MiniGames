/* Piano Tap - vanilla JS, no deps */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const NS = 'piano-tap:v1:';
const NUM_LANES = 4;
const HIT_LINE_FRAC = 0.82; // 82% down the canvas
const TILE_HEIGHT_FRAC = 0.18; // of canvas height
const LOOKAHEAD_MS = 100;
const SCHEDULER_INTERVAL_MS = 25;
const KEY_MAP = { 'd': 0, 'f': 1, 'j': 2, 'k': 3, 'D': 0, 'F': 1, 'J': 2, 'K': 3 };

// ============================================================
// SAVE MANAGER
// ============================================================
class SaveManager {
  constructor() {
    this.defaults = {
      settings: { sfxVol: 70, musicVol: 80, haptics: true,
                  latencyOffsetMs: 0, colorblind: false, reducedMotion: false,
                  difficulty: 'easy' },
      unlocks: { songsUnlocked: ['lullaby'] },
      leaderboard: {},
      bestPerSong: {},
      dailyDone: { date: '', completed: false }
    };
  }
  get(key) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (!raw) return JSON.parse(JSON.stringify(this.defaults[key]));
      const parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(this.defaults[key] || {})), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(this.defaults[key] || {}));
    }
  }
  set(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); }
    catch (e) { /* quota or disabled */ }
  }
  reset() {
    try {
      Object.keys(this.defaults).forEach(k => localStorage.removeItem(NS + k));
    } catch (e) {}
  }
}

// ============================================================
// SONGS - original procedural melodies
// Notes: { lane, beat, dur } where beat is in 16th-note steps (0-63 for 16 bars in 4/4)
// dur is in 16th-note steps
// Each song also has a frequency map (semitones from base) for audio
// ============================================================
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19],
  minor:      [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19],
  pentatonic: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26],
  major7:     [0, 4, 7, 11, 12, 14, 16, 19, 23, 24, 26, 28]
};
function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// Generate a 16-bar melody. Each "bar" has 16 sixteenths in 4/4 (or 12 in 6/8).
// We place tiles on a subset of beats. Lane = scale degree % 4. Pitch = scale degree.
function makeSong(id, name, scale, baseMidi, bpm, density, accentPattern, timeSig = 4) {
  const stepsPerBar = timeSig === 4 ? 16 : 12;
  const totalSteps = stepsPerBar * 16;
  const notes = [];
  // Deterministic pseudo-random seeded by song id
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed >>> 8) / 16777216;
  }
  const scaleNotes = SCALES[scale];
  let lastLane = -1;
  let lastDegree = Math.floor(scaleNotes.length / 2);
  for (let step = 0; step < totalSteps; step++) {
    const inBar = step % stepsPerBar;
    // Place note?
    const isAccent = accentPattern.includes(inBar % (timeSig === 4 ? 4 : 3));
    const onBeat = (inBar % (timeSig === 4 ? 4 : 3)) === 0;
    let chance = density;
    if (onBeat) chance += 0.35;
    if (isAccent) chance += 0.15;
    if (rnd() < chance) {
      // Pick scale degree: walk by -2..+2 from lastDegree
      let delta = Math.floor(rnd() * 5) - 2;
      lastDegree = Math.max(0, Math.min(scaleNotes.length - 1, lastDegree + delta));
      const midi = baseMidi + scaleNotes[lastDegree];
      // Pick lane: avoid same lane as last
      let lane;
      do { lane = Math.floor(rnd() * NUM_LANES); } while (lane === lastLane && rnd() < 0.6);
      lastLane = lane;
      notes.push({ lane, beat: step, dur: 1, midi });
    }
  }
  // Ensure at least 1 note per bar
  for (let bar = 0; bar < 16; bar++) {
    const startStep = bar * stepsPerBar;
    if (!notes.some(n => n.beat >= startStep && n.beat < startStep + stepsPerBar)) {
      const lane = Math.floor(rnd() * NUM_LANES);
      const midi = baseMidi + scaleNotes[Math.floor(scaleNotes.length / 2)];
      notes.push({ lane, beat: startStep, dur: 1, midi });
    }
  }
  notes.sort((a, b) => a.beat - b.beat);
  return { id, name, scale, baseMidi, bpm, notes, totalSteps, stepsPerBar, timeSig };
}

const SONGS = [
  makeSong('lullaby', 'Lullaby',    'major',      60, 80,  0.18, [0, 2], 4),
  makeSong('skies',   'Skies',      'minor',      57, 110, 0.30, [0, 2], 6),
  makeSong('race',    'Race',       'pentatonic', 60, 140, 0.45, [0, 2], 4),
  makeSong('storm',   'Storm',      'minor',      55, 130, 0.40, [1, 3], 4),
  makeSong('dream',   'Dream',      'major7',     62, 100, 0.32, [0, 2], 4),
  makeSong('bonus',   'Galaxy',     'pentatonic', 64, 150, 0.50, [0, 2], 4)
];
const SONG_BY_ID = {};
SONGS.forEach(s => SONG_BY_ID[s.id] = s);

// Difficulty profiles. Beginners found the default too fast, so a player can
// pick a curve. Easy = slower playback (speedMul<1), much longer tile travel
// (more reaction time), wider hit windows, gentler in-song tempo ramp. Hard =
// faster, tighter, ramps quicker. Default is 'easy' so first-timers can learn.
const DIFFICULTY = {
  easy:   { label: 'Easy',   speedMul: 0.80, travelMul: 1.55, windowMul: 1.40, rampMul: 0.5 },
  normal: { label: 'Normal', speedMul: 1.00, travelMul: 1.00, windowMul: 1.00, rampMul: 1.0 },
  hard:   { label: 'Hard',   speedMul: 1.18, travelMul: 0.82, windowMul: 0.85, rampMul: 1.4 },
};

// ============================================================
// AUDIO BUS + SYNTH
// ============================================================
class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ready = false;
  }
  async init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ready = true;
  }
  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }
  async suspend() {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  setMusicVol(v) { if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVol(v) { if (this.sfxGain) this.sfxGain.gain.value = v; }
}

class Synth {
  constructor(bus) { this.bus = bus; }
  // Schedule a melody note at a precise audio time
  playNote(midi, when, dur, type = 'triangle', gain = 0.3) {
    if (!this.bus.ready) return;
    const ctx = this.bus.ctx;
    const freq = midiToFreq(midi);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const attack = 0.005, decay = 0.08, sustain = 0.3, release = 0.15;
    const peak = gain;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + attack);
    env.gain.linearRampToValueAtTime(peak * sustain, when + attack + decay);
    env.gain.setValueAtTime(peak * sustain, when + dur);
    env.gain.linearRampToValueAtTime(0, when + dur + release);
    osc.connect(env);
    env.connect(this.bus.musicGain);
    osc.start(when);
    osc.stop(when + dur + release + 0.05);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch(_) {} };
  }
  playBass(midi, when, dur) {
    if (!this.bus.ready) return;
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(midi - 12);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.18, when + 0.01);
    env.gain.linearRampToValueAtTime(0, when + dur);
    osc.connect(env);
    env.connect(this.bus.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch(_) {} };
  }
  // SFX
  playMiss() {
    if (!this.bus.ready) return;
    const ctx = this.bus.ctx;
    const bufSize = ctx.sampleRate * 0.2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const env = ctx.createGain();
    env.gain.value = 0.5;
    src.connect(filter).connect(env).connect(this.bus.sfxGain);
    src.start();
    src.onended = () => { try { src.disconnect(); filter.disconnect(); env.disconnect(); } catch(_) {} };
  }
  playMetronome(when, accent = false) {
    if (!this.bus.ready) return;
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1500 : 1000;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.3, when + 0.002);
    env.gain.linearRampToValueAtTime(0, when + 0.05);
    osc.connect(env);
    env.connect(this.bus.sfxGain);
    osc.start(when);
    osc.stop(when + 0.06);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch(_) {} };
  }
}

// ============================================================
// SCROLL ENGINE - manages tile state + scheduling
// ============================================================
class ScrollEngine {
  constructor(song, audio, synth, opts) {
    this.song = song;
    this.audio = audio;
    this.synth = synth;
    this.opts = opts || {};
    this.bpm = song.bpm * (opts.speedMul || 1);
    this.baseBpm = this.bpm;          // never mutated — ramp is baked per-loop instead
    this.tempoRampPer16Bars = opts.tempoRamp || 0;
    this.startTime = 0;
    this.tiles = []; // active tiles
    this.nextNoteIdx = 0;
    this.loopCount = 0;
    this.scheduledAheadTime = 0;
    this.hitWindow = 0.12; // seconds; visual lead time
    // Travel time for tile from top -> hit-line (~1.2s at normal). Difficulty
    // scales it: Easy gives a longer fall = more reaction time for beginners.
    this.travelTime = 1.2 * (opts.travelMul || 1);
    this.windowMul = opts.windowMul || 1; // scales tap-accept + auto-miss windows
    this.allNotes = []; // expanded across all loops we know about
    this.scheduledBassBars = new Set();
    // Per-loop absolute start time + step duration. The timeline must be
    // tempo-STABLE: bumping bpm in place and multiplying a global step index
    // by the current secondsPerStep retroactively re-times the whole grid, so
    // at each loop boundary the next note jumps backward in time and is
    // auto-missed (unwinnable Rush/Fast-Ramp). Instead we lock each loop's
    // start + step duration once, so a faster tempo only affects future loops.
    this.loopStarts = [];
    this.loopStepDur = [];
  }
  get secondsPerBeat() { return 60 / this.bpm; }
  _stepDurForBpm(bpm) {
    const stepsPerBeat = this.song.timeSig === 4 ? 4 : 2;
    return (60 / bpm) / stepsPerBeat;
  }
  _ensureLoop(loopIdx) {
    if (this.loopStarts.length === 0) {
      this.loopStarts[0] = this.startTime;
      this.loopStepDur[0] = this._stepDurForBpm(this.baseBpm);
    }
    while (this.loopStarts.length <= loopIdx) {
      const i = this.loopStarts.length;
      this.loopStarts[i] = this.loopStarts[i - 1] + this.song.totalSteps * this.loopStepDur[i - 1];
      const bpm = this.baseBpm + this.tempoRampPer16Bars * i;
      this.loopStepDur[i] = this._stepDurForBpm(bpm);
    }
  }
  get secondsPerStep() {
    const stepsPerBeat = this.song.timeSig === 4 ? 4 : 2; // 16ths per quarter, or 8ths per dotted quarter
    return this.secondsPerBeat / stepsPerBeat;
  }
  start(currentTime) {
    // Lead-in must cover the full tile travel time, otherwise the first note
    // (beat 0) spawns already near the hit-line and is effectively un-hittable
    // (instant early-miss). Give one full travelTime + a small buffer so the
    // opening tile falls from the top like every other note.
    this.startTime = currentTime + this.travelTime + 0.4;
    this.nextNoteIdx = 0;
    this.loopCount = 0;
    this.tiles = [];
    this.loopStarts = [];
    this.loopStepDur = [];
  }
  // Get scheduled hit time for a note in absolute audio time.
  // Uses the step duration locked for that loop so a mid-song tempo bump
  // never moves notes already scheduled in earlier loops.
  noteHitTime(note, loopIdx) {
    this._ensureLoop(loopIdx);
    return this.loopStarts[loopIdx] + note.beat * this.loopStepDur[loopIdx];
  }
  // Spawn upcoming tiles (visually) so they appear at top of screen `travelTime` before hit
  update(currentTime) {
    const horizon = currentTime + this.travelTime + 0.5;
    // Spawn upcoming notes from current loop onwards
    while (true) {
      const note = this.song.notes[this.nextNoteIdx % this.song.notes.length];
      const loopIdx = Math.floor(this.nextNoteIdx / this.song.notes.length);
      const hitTime = this.noteHitTime(note, loopIdx);
      if (hitTime > horizon) break;
      this.tiles.push({
        lane: note.lane, hitTime, midi: note.midi,
        dur: note.dur, status: 'pending', spawnTime: currentTime,
        id: this.nextNoteIdx
      });
      // Bar accents
      this.maybeScheduleBass(note, loopIdx);
      this.nextNoteIdx++;
    }
    // Tempo ramp is baked into each loop's locked step duration (_ensureLoop),
    // so there is no in-place bpm mutation here — that retroactively re-timed
    // the whole grid and caused an unwinnable auto-miss at every loop boundary.
  }
  maybeScheduleBass(note, loopIdx) {
    // Schedule a simple bass on every downbeat once per bar
    const stepsPerBar = this.song.stepsPerBar;
    if (note.beat % stepsPerBar === 0) {
      const key = `${loopIdx}:${Math.floor(note.beat / stepsPerBar)}`;
      if (!this.scheduledBassBars.has(key)) {
        this.scheduledBassBars.add(key);
        const when = this.noteHitTime(note, loopIdx);
        this.synth.playBass(this.song.baseMidi, when, this.secondsPerBeat * (this.song.timeSig === 4 ? 2 : 1.5));
      }
    }
  }
  // Mark a tile as hit and play its note
  hitTile(tile, atTime) {
    tile.status = 'hit';
    tile.hitAtTime = atTime;
    this.synth.playNote(tile.midi, this.audio.now(), 0.25, 'triangle', 0.32);
  }
  // Find pending tile in lane closest to hit-line
  findTargetTile(lane, currentTime) {
    let best = null;
    let bestDelta = Infinity;
    for (const t of this.tiles) {
      if (t.status !== 'pending' || t.lane !== lane) continue;
      const delta = Math.abs(t.hitTime - currentTime);
      if (delta < bestDelta && delta < 0.25 * this.windowMul) {
        best = t; bestDelta = delta;
      }
    }
    return best;
  }
  // Find any pending tile in a lane currently between top and bottom
  findVisibleTile(lane) {
    for (const t of this.tiles) {
      if (t.status === 'pending' && t.lane === lane) return t;
    }
    return null;
  }
  cleanup(currentTime) {
    this.tiles = this.tiles.filter(t => {
      if (t.status === 'hit') return currentTime - t.hitAtTime < 0.4;
      if (t.status === 'missed') return currentTime - t.hitTime < 0.4;
      return t.hitTime > currentTime - 0.5;
    });
  }
}

// ============================================================
// LEADERBOARD
// ============================================================
class Leaderboard {
  constructor(save) { this.save = save; }
  submit(songId, entry) {
    const lb = this.save.get('leaderboard');
    if (!lb[songId]) lb[songId] = [];
    lb[songId].push(entry);
    lb[songId].sort((a, b) => b.score - a.score);
    lb[songId] = lb[songId].slice(0, 10);
    this.save.set('leaderboard', lb);
    // Update best per song
    const best = this.save.get('bestPerSong');
    const prev = best[songId];
    if (!prev || entry.score > prev.score) {
      best[songId] = { score: entry.score, accuracy: entry.accuracy };
      this.save.set('bestPerSong', best);
    }
    try {
      if (window.MGRemote && MGRemote.enabled()) {
        MGRemote.submit('piano-tap', songId, {
          name: entry.name, score: entry.score | 0,
          detail: (entry.accuracy != null ? entry.accuracy + '%' : ''),
          payload: { accuracy: entry.accuracy }
        }).catch(function(){});
      }
    } catch (e) {}
  }
  isHighScore(songId, score) {
    const lb = this.save.get('leaderboard')[songId] || [];
    if (lb.length < 10) return true;
    return score > lb[lb.length - 1].score;
  }
  list(songId) {
    return this.save.get('leaderboard')[songId] || [];
  }
}

// ============================================================
// PARTICLES
// ============================================================
class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, count, reduced) {
    const n = reduced ? Math.max(2, count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.3, age: 0, color,
        size: 2 + Math.random() * 3
      });
    }
  }
  ripple(x, y, color, reduced) {
    if (reduced) return;
    this.list.push({ type: 'ripple', x, y, color, age: 0, life: 0.4 });
  }
  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      if (p.type === 'ripple') continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
    }
    this.list = this.list.filter(p => p.age < p.life);
  }
  draw(ctx) {
    for (const p of this.list) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      if (p.type === 'ripple') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + t * 80, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// MAIN GAME
// ============================================================
class Game {
  constructor() {
    this.save = new SaveManager();
    this.lb = new Leaderboard(this.save);
    this.audio = new AudioBus();
    this.synth = new Synth(this.audio);
    this.particles = new Particles();
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.width = 0; this.height = 0;
    this.engine = null;
    this.mode = 'classic';
    this.songId = 'lullaby';
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0; // counted as 'OK or better'
    this.attempts = 0;
    this.accSum = 0; // for accuracy %
    this.startedAt = 0;
    this.modeOpts = {};
    this.activeKeys = new Set();
    this.activeTouches = new Map(); // pointerId -> lane
    this.flashLanes = [0, 0, 0, 0]; // ms remaining per lane
    this.flashColor = ['', '', '', ''];
    this.gameOverPending = false;
    this.calibrationOffsets = [];
    this.calibrating = false;
    this.calibrationBeats = 0;
    this.calibrationStart = 0;
    this.previewSource = null;
    this.lastFrameTime = 0;
    this.dailyMod = null;
    this.timeLeft = 0;
    this.rushBestTime = 0;
    this.currentLB = 'lullaby';
    this._initListeners();
    this._initRouting();
    this._initSettings();
    this._applySettingsToUI();
    this._applyTheme();
    this._renderSongList();
    this._renderLeaderboardTabs();
    this._setupDaily();
    this._registerSW();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => this._resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    requestAnimationFrame((t) => this._loop(t));
  }

  // -------------- Setup --------------
  _registerSW() {
    if ('serviceWorker' in navigator) {
      // Use relative path for GH Pages compatibility
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.width = w; this.height = h;
  }

  _initRouting() {
    const routes = ['', '/play', '/songs', '/modes', '/leaderboard', '/settings', '/howto', '/credits'];
    const handle = () => {
      const hash = location.hash.replace('#', '') || '/';
      ['menu','songs','modes','leaderboard','settings','howto','credits','nameEntry','pause','gameover']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
      document.getElementById('hud').classList.add('hidden');
      if (this.state === 'playing' || this.state === 'paused') {
        this.quit();
      }
      const map = {
        '/': 'menu', '/songs': 'songs', '/modes': 'modes',
        '/leaderboard': 'leaderboard', '/settings': 'settings',
        '/howto': 'howto', '/credits': 'credits'
      };
      if (hash === '/play') {
        this.startGame(this.mode, this.songId);
        return;
      }
      const id = map[hash] || 'menu';
      document.getElementById(id).classList.remove('hidden');
      if (id === 'leaderboard') this._renderLeaderboard();
      if (id === 'songs') this._renderSongList();
    };
    window.addEventListener('hashchange', handle);
    document.body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-route]');
      if (t) {
        location.hash = t.dataset.route;
        this._unlockAudio();
      }
    });
    handle();
  }

  _initListeners() {
    // Pause / resume buttons
    document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
    document.getElementById('resumeBtn').addEventListener('click', () => this.resume());
    document.getElementById('restartBtn').addEventListener('click', () => {
      document.getElementById('pause').classList.add('hidden');
      this.startGame(this.mode, this.songId);
    });
    document.getElementById('retryBtn').addEventListener('click', () => {
      document.getElementById('gameover').classList.add('hidden');
      this.startGame(this.mode, this.songId);
    });

    // Mode buttons
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode;
        location.hash = '#/songs';
      });
    });

    // Settings inputs
    ['musicVol', 'sfxVol'].forEach(k => {
      document.getElementById(k).addEventListener('input', (e) => {
        const s = this.save.get('settings');
        s[k] = +e.target.value;
        this.save.set('settings', s);
        this._applyAudioVols();
      });
    });
    ['haptics', 'colorblind', 'reducedMotion'].forEach(k => {
      document.getElementById(k).addEventListener('change', (e) => {
        const s = this.save.get('settings');
        s[k] = e.target.checked;
        this.save.set('settings', s);
        this._applyTheme();
      });
    });
    document.getElementById('latencyOffset').addEventListener('input', (e) => {
      const s = this.save.get('settings');
      s.latencyOffsetMs = +e.target.value;
      this.save.set('settings', s);
      document.getElementById('latencyVal').textContent = s.latencyOffsetMs;
    });
    document.getElementById('calibrateBtn').addEventListener('click', () => this._calibrate());

    // difficulty toggle
    const diffWrap = document.getElementById('difficultyToggle');
    if (diffWrap) {
      const dButtons = diffWrap.querySelectorAll('button[data-difficulty]');
      dButtons.forEach(b => {
        b.addEventListener('click', () => {
          const d = b.getAttribute('data-difficulty');
          const s = this.save.get('settings');
          s.difficulty = d;
          this.save.set('settings', s);
          dButtons.forEach(bb => bb.setAttribute('aria-pressed', bb.getAttribute('data-difficulty') === d ? 'true' : 'false'));
        });
      });
    }

    // theme toggle
    const THEME_KEY = 'piano-tap:v1:theme';
    const themeWrap = document.getElementById('themeToggle');
    if (themeWrap && window.MGTheme) {
      const buttons = themeWrap.querySelectorAll('button[data-theme-pref]');
      const cur = MGTheme.get(THEME_KEY);
      buttons.forEach(b => {
        b.setAttribute('aria-pressed', b.getAttribute('data-theme-pref') === cur ? 'true' : 'false');
        b.addEventListener('click', () => {
          const pref = b.getAttribute('data-theme-pref');
          MGTheme.set(pref, THEME_KEY);
          buttons.forEach(bb => bb.setAttribute('aria-pressed', bb.getAttribute('data-theme-pref') === pref ? 'true' : 'false'));
        });
      });
    }

    document.getElementById('resetData').addEventListener('click', () => {
      if (confirm('Reset all scores, unlocks and settings?')) {
        this.save.reset();
        this._applySettingsToUI();
        this._applyTheme();
        this._renderSongList();
        this._renderLeaderboardTabs();
        this.toast('Reset.');
      }
    });

    // Name entry
    document.getElementById('nameSubmit').addEventListener('click', () => this._submitName());
    document.getElementById('nameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submitName();
    });

    // Share button (game-over)
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn && window.MGShare) {
      shareBtn.addEventListener('click', () => this._sharePianoTapScore());
    }

    // Player section (shared identity) injection into settings
    this._injectMGPlayerSection();

    // Pointer input on canvas
    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (this.state !== 'playing') return;
      const lane = KEY_MAP[e.key];
      if (lane !== undefined && !this.activeKeys.has(e.key)) {
        this.activeKeys.add(e.key);
        this._tap(lane);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.activeKeys.delete(e.key);
    });
  }

  _initSettings() {
    const s = this.save.get('settings');
    this.save.set('settings', s); // ensure stored
  }

  _applySettingsToUI() {
    const s = this.save.get('settings');
    document.getElementById('musicVol').value = s.musicVol;
    document.getElementById('sfxVol').value = s.sfxVol;
    document.getElementById('haptics').checked = !!s.haptics;
    document.getElementById('colorblind').checked = !!s.colorblind;
    document.getElementById('reducedMotion').checked = !!s.reducedMotion;
    document.getElementById('latencyOffset').value = s.latencyOffsetMs || 0;
    document.getElementById('latencyVal').textContent = s.latencyOffsetMs || 0;
    const diffWrap = document.getElementById('difficultyToggle');
    if (diffWrap) {
      const cur = s.difficulty || 'easy';
      diffWrap.querySelectorAll('button[data-difficulty]').forEach(b =>
        b.setAttribute('aria-pressed', b.getAttribute('data-difficulty') === cur ? 'true' : 'false'));
    }
    this._applyAudioVols();
  }
  _applyAudioVols() {
    const s = this.save.get('settings');
    if (this.audio.ready) {
      this.audio.setMusicVol((s.musicVol || 0) / 100);
      this.audio.setSfxVol((s.sfxVol || 0) / 100);
    }
  }
  _applyTheme() {
    const s = this.save.get('settings');
    document.documentElement.classList.toggle('colorblind', !!s.colorblind);
  }

  async _unlockAudio() {
    if (!this.audio.ready) await this.audio.init();
    await this.audio.resume();
    this._applyAudioVols();
  }

  // -------------- Song list --------------
  _renderSongList() {
    const list = document.getElementById('songList');
    list.innerHTML = '';
    const unlocked = new Set(this.save.get('unlocks').songsUnlocked);
    const best = this.save.get('bestPerSong');
    SONGS.forEach((song, i) => {
      const row = document.createElement('button');
      row.className = 'song-row';
      const isLocked = !unlocked.has(song.id);
      if (isLocked) row.classList.add('locked');
      const b = best[song.id];
      row.innerHTML = `
        <div class="info">
          <div class="title">${song.name}</div>
          <div class="meta">${song.bpm} BPM &middot; ${song.scale}</div>
          ${b ? `<div class="best">Best: ${b.score} (${b.accuracy.toFixed(0)}%)</div>` : ''}
        </div>
      `;
      const playBtn = document.createElement('button');
      playBtn.className = 'preview-btn';
      playBtn.setAttribute('aria-label', 'Preview ' + song.name);
      playBtn.textContent = '▶';
      playBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await this._unlockAudio();
        this._previewSong(song);
      });
      row.appendChild(playBtn);
      if (isLocked) {
        const lockTag = document.createElement('div');
        lockTag.className = 'meta';
        lockTag.textContent = 'Locked';
        row.appendChild(lockTag);
        row.addEventListener('click', () => this.toast('Complete previous song to unlock.'));
      } else {
        row.addEventListener('click', () => {
          this.songId = song.id;
          location.hash = '#/play';
        });
      }
      list.appendChild(row);
    });
  }

  _previewSong(song) {
    if (!this.audio.ready) return;
    const start = this.audio.now() + 0.05;
    const spb = 60 / song.bpm;
    const sps = spb / (song.timeSig === 4 ? 4 : 2);
    // 2 bars
    const limit = song.stepsPerBar * 2;
    song.notes.filter(n => n.beat < limit).forEach(n => {
      this.synth.playNote(n.midi, start + n.beat * sps, 0.2);
    });
  }

  // -------------- Leaderboard render --------------
  _renderLeaderboardTabs() {
    const tabs = document.getElementById('lbTabs');
    tabs.innerHTML = '';
    SONGS.forEach(s => {
      const t = document.createElement('button');
      t.className = 'lb-tab' + (s.id === this.currentLB ? ' active' : '');
      t.textContent = s.name;
      t.addEventListener('click', () => {
        this.currentLB = s.id;
        this._renderLeaderboardTabs();
        this._renderLeaderboard();
      });
      tabs.appendChild(t);
    });
  }
  _renderLeaderboard() {
    const list = document.getElementById('lbList');
    list.innerHTML = '';
    // Inject scope toggle once
    const remoteOn = !!(window.MGRemote && MGRemote.enabled());
    const parent = list.parentNode;
    if (remoteOn && parent && !parent.querySelector('.lb-scope')) {
      const wrap = document.createElement('div');
      wrap.className = 'lb-scope';
      wrap.style.cssText = 'display:flex;gap:6px;justify-content:center;margin:6px 0;';
      wrap.innerHTML = '<button class="lb-tab active" data-scope="local">LOCAL</button><button class="lb-tab" data-scope="global">GLOBAL</button>';
      parent.insertBefore(wrap, list);
      const self = this;
      wrap.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          wrap.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          self._lbScope = b.getAttribute('data-scope');
          self._renderLeaderboard();
        });
      });
    }
    const scope = this._lbScope || 'local';
    const _esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

    if (scope === 'global' && remoteOn) {
      list.innerHTML = '<div class="lb-empty">Loading…</div>';
      MGRemote.top('piano-tap', this.currentLB, { limit: 10 }).then(rows => {
        list.innerHTML = '';
        if (!rows || !rows.length) { list.innerHTML = '<div class="lb-empty">No global scores yet.</div>'; return; }
        rows.forEach((e, i) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="rank">#${i + 1}</span>
            <span class="name">${_esc(e.display_name || '???')}</span>
            <span>${e.score}</span>
            <span class="acc">${_esc(e.detail || '')}</span>
          `;
          list.appendChild(li);
        });
      });
      return;
    }

    const entries = this.lb.list(this.currentLB);
    if (!entries.length) {
      list.innerHTML = '<div class="lb-empty">No scores yet. Be the first.</div>';
      return;
    }
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      const display = _esc(e.displayName || e.name || '???');
      li.innerHTML = `
        <span class="rank">#${i + 1}</span>
        <span class="name">${display}</span>
        <span>${e.score}</span>
        <span class="acc">${e.accuracy.toFixed(0)}%</span>
      `;
      list.appendChild(li);
    });
  }

  // -------------- Daily Challenge --------------
  _setupDaily() {
    const today = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) >>> 0;
    const mods = [
      { name: 'Double Speed', apply: (o) => o.speedMul = 2 },
      { name: 'Fast Ramp',    apply: (o) => o.tempoRamp = 8 },
      { name: 'Silent',       apply: (o) => o.silentTiles = true },
      { name: 'Flicker',      apply: (o) => o.flicker = true }
    ];
    const songIdx = seed % SONGS.length;
    const modIdx = (seed >> 8) % mods.length;
    this.dailyMod = {
      songId: SONGS[songIdx].id,
      mod: mods[modIdx],
      date: today
    };
    const banner = document.getElementById('dailyBanner');
    banner.classList.remove('hidden');
    banner.innerHTML = `<strong>Daily:</strong> ${SONGS[songIdx].name} &middot; <em>${mods[modIdx].name}</em>`;
  }

  // -------------- Game lifecycle --------------
  async startGame(mode, songId) {
    await this._unlockAudio();
    this.mode = mode;
    this.songId = songId;
    if (mode === 'daily') {
      this.songId = this.dailyMod.songId;
    }
    const song = SONG_BY_ID[this.songId];
    this.modeOpts = { speedMul: 1, tempoRamp: 0, silentTiles: false, flicker: false };
    if (mode === 'rush') this.modeOpts.tempoRamp = 10;
    if (mode === 'classic') this.modeOpts.tempoRamp = 2;
    if (mode === 'arcade') this.modeOpts.tempoRamp = 0;
    if (mode === 'daily') this.dailyMod.mod.apply(this.modeOpts);

    // Fold the chosen difficulty into the run: scale speed, tile travel time,
    // hit-window forgiveness and how fast the tempo ramps.
    const diff = DIFFICULTY[this.save.get('settings').difficulty || 'easy'] || DIFFICULTY.normal;
    this.modeOpts.speedMul = (this.modeOpts.speedMul || 1) * diff.speedMul;
    this.modeOpts.tempoRamp = (this.modeOpts.tempoRamp || 0) * diff.rampMul;
    this.modeOpts.travelMul = diff.travelMul;
    this.modeOpts.windowMul = diff.windowMul;

    this.engine = new ScrollEngine(song, this.audio, this.synth, this.modeOpts);
    this.engine.start(this.audio.now());
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = 0; this.attempts = 0; this.accSum = 0;
    this.startedAt = this.audio.now();
    this.gameOverPending = false;
    this.state = 'playing';
    if (mode === 'arcade') this.timeLeft = 30;
    else if (mode === 'rush') this.timeLeft = 0; // count up
    else this.timeLeft = -1; // hidden

    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const hud = document.getElementById('hud');
    hud.classList.remove('hidden');
    document.getElementById('timerDisplay').classList.toggle('hidden', this.timeLeft < 0);
    this._updateHud();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.suspend();
    document.getElementById('pause').classList.remove('hidden');
  }
  async resume() {
    if (this.state !== 'paused') return;
    await this.audio.resume();
    // shift engine startTime to account for paused interval - simplest is to track diff
    // For simplicity, we resume the audio clock seamlessly; startTime stays valid.
    this.state = 'playing';
    document.getElementById('pause').classList.add('hidden');
  }
  quit() {
    this.state = 'menu';
    this.audio.suspend();
    document.getElementById('hud').classList.add('hidden');
  }

  endGame(reason) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.suspend();
    const acc = this.attempts ? (this.accSum / this.attempts) : 0;
    document.getElementById('goTitle').textContent = reason || 'GAME OVER';
    document.getElementById('goScore').textContent = this.score;
    document.getElementById('goAcc').textContent = acc.toFixed(0) + '%';
    document.getElementById('goCombo').textContent = this.maxCombo;
    document.getElementById('hud').classList.add('hidden');
    // Unlock next song if completed adequately
    if (this.score > 30) this._maybeUnlockNext(this.songId);
    if (this.mode === 'daily' && this.score > 30) {
      const u = this.save.get('unlocks');
      if (!u.songsUnlocked.includes('bonus')) {
        u.songsUnlocked.push('bonus');
        this.save.set('unlocks', u);
        this.toast('Bonus song "Galaxy" unlocked!');
      }
    }
    if (this.mode === 'rush') {
      const cur = this.audio.now() - this.startedAt;
      if (cur > this.rushBestTime) this.rushBestTime = cur;
    }
    // Score submit
    if (this.lb.isHighScore(this.songId, this.score) && this.score > 0) {
      document.getElementById('nameEntryScore').textContent = this.score;
      document.getElementById('nameInput').value = '';
      document.getElementById('nameEntry').classList.remove('hidden');
      setTimeout(() => document.getElementById('nameInput').focus(), 100);
    } else {
      document.getElementById('gameover').classList.remove('hidden');
    }
  }
  _sharePianoTapScore() {
    if (!window.MGShare) return;
    const acc = this.attempts ? (this.accSum / this.attempts) : 0;
    const song = (window.SONG_BY_ID && SONG_BY_ID[this.songId]) ||
                 (typeof SONGS !== 'undefined' && SONGS.find(s => s.id === this.songId)) || null;
    const songName = song ? song.name : (this.songId || 'Song');
    const name = (window.MGIdentity && MGIdentity.name())
      || (this.save && this.save.get && (this.save.get('lastName') || '')).toString().toUpperCase()
      || 'Anonymous';
    MGShare.share({
      gameTitle: 'Piano Tap',
      subtitle: 'Game over',
      score: this.score || 0,
      name,
      detail: songName + ' • ' + Math.round(acc) + '% accuracy',
      url: 'https://philipposk.github.io/MiniGames/piano-tap/',
      accent: '#5cf2c4', bg1: '#0c0f1f', bg2: '#2a1a55'
    });
  }

  _injectMGPlayerSection() {
    if (!window.MGIdentity) return;
    try { MGIdentity.uuid(); } catch (e) {}
    const list = document.querySelector('#settings .settings-list');
    if (!list || document.getElementById('mg-player-section')) return;
    const fullId = MGIdentity.uuid();
    const wrap = document.createElement('div');
    wrap.id = 'mg-player-section';
    wrap.innerHTML =
      '<label class="setting-row" style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;"><span>Your name</span>' +
      '  <input type="text" id="mg-player-name" maxlength="24" placeholder="Anonymous" />' +
      '</label>' +
      '<label class="setting-row"><span>Suggest a name</span>' +
      '  <button type="button" class="btn" id="mg-player-suggest">SUGGEST</button>' +
      '</label>' +
      '<label class="setting-row"><span>Player ID</span>' +
      '  <span style="display:flex;gap:8px;align-items:center;">' +
      '    <span title="' + fullId + '" style="font-family:monospace;font-size:12px;opacity:0.7;">' + fullId.slice(0, 8) + '…</span>' +
      '    <button type="button" class="btn" id="mg-player-copy">COPY</button>' +
      '  </span>' +
      '</label>';
    list.appendChild(wrap);
    const ni = wrap.querySelector('#mg-player-name');
    ni.value = MGIdentity.name() || '';
    ni.addEventListener('input', () => MGIdentity.setName(ni.value));
    wrap.querySelector('#mg-player-suggest').addEventListener('click', () => {
      const s = MGIdentity.suggest();
      ni.value = s;
      MGIdentity.setName(s);
    });
    wrap.querySelector('#mg-player-copy').addEventListener('click', () => {
      try { if (navigator.clipboard) navigator.clipboard.writeText(fullId); } catch (e) {}
    });
  }

  _submitName() {
    const raw = (document.getElementById('nameInput').value || 'YOU').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'YOU';
    const acc = this.attempts ? (this.accSum / this.attempts) : 0;
    const entry = { name: raw, score: this.score, accuracy: acc, date: new Date().toISOString().slice(0, 10) };
    try {
      if (window.MGIdentity) {
        entry.playerId = MGIdentity.uuid();
        const dn = MGIdentity.name();
        if (dn) entry.displayName = dn;
      }
    } catch (e) {}
    this.lb.submit(this.songId, entry);
    document.getElementById('nameEntry').classList.add('hidden');
    document.getElementById('gameover').classList.remove('hidden');
  }
  _maybeUnlockNext(currentId) {
    const idx = SONGS.findIndex(s => s.id === currentId);
    if (idx < 0 || idx === SONGS.length - 1) return;
    if (SONGS[idx + 1].id === 'bonus') return;
    const u = this.save.get('unlocks');
    if (!u.songsUnlocked.includes(SONGS[idx + 1].id)) {
      u.songsUnlocked.push(SONGS[idx + 1].id);
      this.save.set('unlocks', u);
      this.toast('Unlocked: ' + SONGS[idx + 1].name);
    }
  }

  // -------------- Input --------------
  _onPointerDown(e) {
    this._unlockAudio();
    if (this.state !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lane = Math.floor(x / (this.width / NUM_LANES));
    if (lane < 0 || lane >= NUM_LANES) return;
    this.activeTouches.set(e.pointerId, lane);
    // Only count taps in bottom 40% of screen as gameplay taps;
    // but be lenient - any tap in lane bottom area counts.
    if (y > this.height * 0.35) {
      this._tap(lane);
    }
  }
  _onPointerUp(e) {
    this.activeTouches.delete(e.pointerId);
  }

  _tap(lane) {
    if (this.state !== 'playing') return;
    const s = this.save.get('settings');
    const offset = (s.latencyOffsetMs || 0) / 1000;
    const now = this.audio.now() - offset;
    const tile = this.engine.findTargetTile(lane, now);
    if (!tile) {
      // empty lane tap -> game over
      this.flashLanes[lane] = 0.25;
      this.flashColor[lane] = 'rgba(255,56,96,0.4)';
      this.synth.playMiss();
      if (s.haptics && navigator.vibrate) navigator.vibrate(50);
      this.endGame('TOO HASTY');
      return;
    }
    const delta = Math.abs(tile.hitTime - now) * 1000;
    const wm = (this.engine && this.engine.windowMul) || 1; // difficulty forgiveness
    let pts = 0;
    let label = '';
    if (delta <= 30 * wm) { pts = 3; label = 'PERFECT'; this.accSum += 100; if (window.MGNative) MGNative.Haptics.light(); }
    else if (delta <= 60 * wm) { pts = 2; label = 'GREAT'; this.accSum += 80; }
    else if (delta <= 100 * wm) { pts = 1; label = 'OK'; this.accSum += 60; }
    else { pts = 0; label = 'LATE'; this.accSum += 30; if (window.MGNative) MGNative.Haptics.heavy(); }
    this.attempts++;
    if (pts > 0) {
      this.combo++;
      this.score += pts * (1 + Math.floor(this.combo / 10));
      this.hits++;
    } else {
      this.combo = 0;
    }
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.engine.hitTile(tile, this.audio.now());
    // Visual feedback
    const laneW = this.width / NUM_LANES;
    const cx = lane * laneW + laneW / 2;
    const cy = this.height * HIT_LINE_FRAC;
    const color = pts === 3 ? 'rgba(0,255,136,1)' : pts >= 1 ? 'rgba(0,255,209,1)' : 'rgba(255,204,0,1)';
    this.particles.burst(cx, cy, color, 8, s.reducedMotion);
    this.particles.ripple(cx, cy, color, s.reducedMotion);
    this.flashLanes[lane] = 0.18;
    this.flashColor[lane] = pts >= 1 ? 'rgba(0,255,136,0.25)' : 'rgba(255,204,0,0.25)';
    if (s.haptics && navigator.vibrate && pts >= 1) navigator.vibrate(10);
    this._updateHud();
  }

  // -------------- Update / render --------------
  _loop(t) {
    requestAnimationFrame((tt) => this._loop(tt));
    const dt = this.lastFrameTime ? Math.min(0.1, (t - this.lastFrameTime) / 1000) : 0.016;
    this.lastFrameTime = t;
    this.particles.update(dt);
    for (let i = 0; i < NUM_LANES; i++) {
      this.flashLanes[i] = Math.max(0, this.flashLanes[i] - dt);
    }
    if (this.state === 'playing') {
      const now = this.audio.now();
      this.engine.update(now);
      // Check for misses
      const s = this.save.get('settings');
      const offset = (s.latencyOffsetMs || 0) / 1000;
      for (const tile of this.engine.tiles) {
        if (tile.status === 'pending' && now - offset > tile.hitTime + 0.26 * this.engine.windowMul) {
          tile.status = 'missed';
          this.synth.playMiss();
          if (s.haptics && navigator.vibrate) navigator.vibrate(80);
          if (window.MGNative) MGNative.Haptics.heavy();
          this.endGame('MISSED');
          break;
        }
      }
      this.engine.cleanup(now);
      // Arcade timer
      if (this.mode === 'arcade') {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endGame('TIME UP');
        }
      } else if (this.mode === 'rush') {
        this.timeLeft += dt;
      }
      this._updateHud();
    }
    if (this.calibrating) this._calibrationLoop(t);
    this._render();
  }

  _updateHud() {
    document.getElementById('comboDisplay').textContent = this.combo > 0 ? this.combo : '';
    document.getElementById('scoreDisplay').textContent = this.score;
    const acc = this.attempts ? (this.accSum / this.attempts) : 100;
    document.getElementById('accDisplay').textContent = acc.toFixed(0) + '%';
    const td = document.getElementById('timerDisplay');
    if (this.mode === 'arcade') td.textContent = this.timeLeft.toFixed(1) + 's';
    else if (this.mode === 'rush') td.textContent = this.timeLeft.toFixed(1) + 's';
    else td.textContent = '';
  }

  _render() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    // Background
    ctx.fillStyle = '#fafaff';
    ctx.fillRect(0, 0, w, h);
    // Lane dividers
    const laneW = w / NUM_LANES;
    ctx.strokeStyle = '#d0d0e0';
    ctx.lineWidth = 1;
    for (let i = 1; i < NUM_LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW, 0);
      ctx.lineTo(i * laneW, h);
      ctx.stroke();
    }
    // Lane flashes
    for (let i = 0; i < NUM_LANES; i++) {
      if (this.flashLanes[i] > 0) {
        ctx.fillStyle = this.flashColor[i];
        ctx.fillRect(i * laneW, h * 0.5, laneW, h * 0.5);
      }
    }
    // Hit line
    const hitY = h * HIT_LINE_FRAC;
    ctx.strokeStyle = '#00ffd1';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00ffd1';
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tiles
    if (this.state === 'playing' || this.state === 'paused') {
      const tileH = h * TILE_HEIGHT_FRAC;
      const travel = this.engine.travelTime;
      const now = this.audio.now();
      const s = this.save.get('settings');
      for (const tile of this.engine.tiles) {
        // Position: at hitTime -> tile bottom at hitY
        // tile lifetime from -travel..0 (before hit) -> y from -tileH .. hitY
        const dt = tile.hitTime - now;
        // bottom of tile y at hitY when dt=0; at hitY - h*1.0 when dt=travel
        const progress = 1 - dt / travel; // 0..1+
        const bottomY = hitY * progress;
        const topY = bottomY - tileH;
        if (bottomY < 0) continue;
        const x = tile.lane * laneW;
        // Flicker mod: hide last 100ms before hit-line
        if (this.modeOpts.flicker && dt < 0.1 && dt > 0) continue;
        if (tile.status === 'hit') {
          ctx.fillStyle = 'rgba(0,255,209,0.4)';
        } else if (tile.status === 'missed') {
          ctx.fillStyle = 'rgba(255,56,96,0.7)';
        } else {
          ctx.fillStyle = this.modeOpts.silentTiles ? '#222' : '#0a0a14';
        }
        ctx.fillRect(x + 4, topY, laneW - 8, tileH);
        if (tile.status === 'pending') {
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 4, topY, laneW - 8, tileH);
        }
      }
    }
    // Particles
    this.particles.draw(ctx);
    // Calibration UI
    if (this.calibrating) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap on the beat (' + this.calibrationBeats + '/8)', w / 2, h / 2);
    }
  }

  // -------------- Calibration --------------
  async _calibrate() {
    await this._unlockAudio();
    this.calibrationOffsets = [];
    this.calibrationBeats = 0;
    this.calibrationStart = this.audio.now() + 1;
    this.calibrating = true;
    const bpm = 100;
    const spb = 60 / bpm;
    for (let i = 0; i < 8; i++) {
      this.synth.playMetronome(this.calibrationStart + i * spb, i % 4 === 0);
    }
    document.getElementById('calibrateStatus').textContent = 'Tap to the beat (8 beats)...';
    const handler = (e) => {
      // Ignore taps on the calibrate button itself
      if (e.target && e.target.id === 'calibrateBtn') return;
      const now = this.audio.now();
      const spb = 60 / 100;
      const elapsed = now - this.calibrationStart;
      const beat = Math.round(elapsed / spb);
      if (beat >= 0 && beat < 8) {
        const expected = beat * spb;
        const offsetMs = (elapsed - expected) * 1000;
        if (Math.abs(offsetMs) < 250) {
          this.calibrationOffsets.push(offsetMs);
          this.calibrationBeats = this.calibrationOffsets.length;
        }
      }
      if (this.calibrationOffsets.length >= 8 || elapsed > 10) {
        window.removeEventListener('pointerdown', handler);
        this.calibrating = false;
        if (this.calibrationOffsets.length > 2) {
          const sorted = [...this.calibrationOffsets].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const clamped = Math.max(-100, Math.min(100, Math.round(median)));
          const s = this.save.get('settings');
          s.latencyOffsetMs = clamped;
          this.save.set('settings', s);
          this._applySettingsToUI();
          document.getElementById('calibrateStatus').textContent =
            'Calibrated. Offset = ' + clamped + 'ms';
        } else {
          document.getElementById('calibrateStatus').textContent = 'Not enough taps.';
        }
      }
    };
    window.addEventListener('pointerdown', handler);
  }
  _calibrationLoop() { /* visual handled in render */ }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2400);
  }
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  if (window.MGTheme) MGTheme.init('piano-tap:v1:theme');
  window.__game = new Game();
});
