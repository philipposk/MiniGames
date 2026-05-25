/* =============================================================================
   HELIX DROP — game.js
   Pure vanilla JS, no build, no deps.
   Architecture:
     - SaveManager: localStorage wrapper, namespaced.
     - AudioBus:    WebAudio osc/envelope SFX + ambient pad.
     - Leaderboard: persistent top-10 for endless + daily.
     - Particles:   simple particle system.
     - Ball/Disc/Helix: game entities.
     - Game:        state machine, RAF loop, input.
     - UI:          DOM screens, hash routing.
   ============================================================================= */
'use strict';

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------
const SAVE_NS = 'helix-drop:v1:';
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const SKINS = [
  { id: 'classic', name: 'Classic', cost: 0,  draw: drawSkinClassic },
  { id: 'neon',    name: 'Neon',    cost: 30, draw: drawSkinNeon },
  { id: 'fire',    name: 'Fire',    cost: 60, draw: drawSkinFire },
  { id: 'eyeball', name: 'Eyeball', cost: 80, draw: drawSkinEyeball },
  { id: 'smiley',  name: 'Smiley',  cost: 100, draw: drawSkinSmiley }
];

const GHOST_POWER_COST = 50;
const SKIP_COST = 5;

// Hand-tuned curve: 30 levels.
const LEVELS = (function buildLevels() {
  const arr = [];
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const discs       = Math.round(12 + t * 18);                // 12 → 30
    const killPct     = +(0.15 + t * 0.40).toFixed(3);          // 0.15 → 0.55
    const gapWidth    = +(90 - t * 55).toFixed(1) * DEG;        // 90° → 35°
    const rotateDrift = +(t * 25).toFixed(2);                   // 0 → 25 deg/s
    const targetTime  = Math.round(discs * 1.6 + 5);            // generous
    arr.push({ discs, killPct, gapWidth, rotateDriftDeg: rotateDrift, targetTimeSec: targetTime });
  }
  return arr;
})();

const ACHIEVEMENTS = [
  { id: 'first_clear',     name: 'First Clear',         check: (s) => s.levelsCleared >= 1 },
  { id: 'ten_clear',       name: 'Ten Down',            check: (s) => s.levelsCleared >= 10 },
  { id: 'all_clear',       name: 'Tower Master',        check: (s) => s.levelsCleared >= 30 },
  { id: 'first_star',      name: 'Stargazer',           check: (s) => Object.values(s.stars||{}).some(v => v >= 1) },
  { id: 'pack_3_star',     name: 'Pack Perfectionist',  check: (s) => {
      // any contiguous 10 with 3 stars
      for (let base = 1; base <= 21; base++) {
        let ok = true;
        for (let i = 0; i < 10; i++) if ((s.stars||{})[base + i] !== 3) { ok = false; break; }
        if (ok) return true;
      }
      return false;
    } },
  { id: 'discs_100',       name: '100 Discs',           check: (s) => (s.totalDiscs||0) >= 100 },
  { id: 'discs_1000',      name: '1000 Discs',          check: (s) => (s.totalDiscs||0) >= 1000 },
  { id: 'no_bounce_20',    name: 'Smooth Operator',     check: (s) => (s.bestComboNoBounce||0) >= 20 },
  { id: 'first_coin',      name: 'Pocket Change',       check: (s) => (s.coinsEarnedTotal||0) >= 1 },
  { id: 'coin_hoarder',    name: 'Coin Hoarder',        check: (s) => (s.coinsEarnedTotal||0) >= 500 },
  { id: 'endless_50',      name: 'Deep Diver',          check: (s) => (s.bestEndlessDepth||0) >= 50 },
  { id: 'daily_played',    name: 'Daily Drop',          check: (s) => (s.dailyPlayed||0) >= 1 }
];

// ----------------------------------------------------------------------------
// SAVE MANAGER
// ----------------------------------------------------------------------------
const SaveManager = {
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(SAVE_NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  _set(key, val) {
    try { localStorage.setItem(SAVE_NS + key, JSON.stringify(val)); }
    catch (e) { /* quota or unavailable; ignore */ }
  },
  loadSettings() {
    return Object.assign({
      sfxVol: 0.8, musicVol: 0.4, haptics: true,
      colorblind: false, reducedMotion: false,
      music: false
    }, this._get('settings', {}));
  },
  saveSettings(s) { this._set('settings', s); },
  loadUnlocks() {
    return Object.assign({
      levelsCleared: 0, stars: {}, skins: ['classic'],
      equippedSkin: 'classic', ghostPowerOwned: false,
      totalDiscs: 0, bestComboNoBounce: 0,
      coinsEarnedTotal: 0, bestEndlessDepth: 0, dailyPlayed: 0,
      achievements: []
    }, this._get('unlocks', {}));
  },
  saveUnlocks(u) { this._set('unlocks', u); },
  loadCoins() { return this._get('coins', 0); },
  saveCoins(c) { this._set('coins', c); },
  loadLeaderboard() {
    return Object.assign({ endless: [], daily: {} }, this._get('leaderboard', {}));
  },
  saveLeaderboard(lb) { this._set('leaderboard', lb); },
  loadBestEndless() { return Object.assign({ score: 0, depth: 0 }, this._get('bestEndless', {})); },
  saveBestEndless(b) { this._set('bestEndless', b); },
  loadName() { return this._get('name', 'AAA'); },
  saveName(n) { this._set('name', n); },
  wipe() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_NS)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }
};

// ----------------------------------------------------------------------------
// AUDIO BUS
// ----------------------------------------------------------------------------
class AudioBus {
  constructor() {
    this.ctx = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicNodes = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.4;
    this.musicOn = false;
    this.unlocked = false;
  }
  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.ctx.destination);
    } catch (e) { /* audio unavailable */ }
  }
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusicVol(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = this.musicOn ? v : 0; }
  setMusicOn(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) {
      this.startMusic();
      if (this.musicGain) this.musicGain.gain.value = this.musicVol;
    } else {
      if (this.musicGain) this.musicGain.gain.value = 0;
      this.stopMusic();
    }
  }
  startMusic() {
    if (!this.ctx || this.musicNodes) return;
    const now = this.ctx.now ? this.ctx.now() : this.ctx.currentTime;
    const nodes = [];
    // two detuned oscillators forming a low pad
    [110, 110 * 1.498, 110 * 0.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = i === 0 ? -7 : (i === 1 ? 4 : 0);
      const g = this.ctx.createGain();
      g.gain.value = i === 2 ? 0.06 : 0.04;
      // gentle LFO on gain for movement
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.07;
      lfoG.gain.value = 0.02;
      lfo.connect(lfoG).connect(g.gain);
      osc.connect(g).connect(this.musicGain);
      osc.start(now);
      lfo.start(now);
      nodes.push(osc, lfo);
    });
    this.musicNodes = nodes;
  }
  stopMusic() {
    if (!this.musicNodes) return;
    const now = this.ctx.currentTime;
    this.musicNodes.forEach((n) => { try { n.stop(now + 0.05); } catch (e) {} });
    this.musicNodes = null;
  }
  _env(osc, gain, peak, attack, release, t0) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    osc.start(t0);
    osc.stop(t0 + attack + release + 0.02);
  }
  bounce() {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.1);
    osc.connect(g).connect(this.sfxGain);
    this._env(osc, g, 0.3, 0.005, 0.12, t0);
  }
  pass(comboLevel) {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    const base = 520 + Math.min(comboLevel, 8) * 60;
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.12);
    osc.connect(g).connect(this.sfxGain);
    this._env(osc, g, 0.2, 0.004, 0.14, t0);
  }
  kill() {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    // noise burst
    const bufSize = this.ctx.sampleRate * 0.4;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.4 * this.sfxVol / Math.max(this.sfxVol, 0.001);
    src.connect(g).connect(this.sfxGain);
    src.start(t0); src.stop(t0 + 0.4);
    // descending tone
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.35);
    osc.connect(og).connect(this.sfxGain);
    this._env(osc, og, 0.4, 0.005, 0.35, t0);
  }
  clear() {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    [0, 0.08, 0.16, 0.24].forEach((dt, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = [523, 659, 784, 1047][i];
      osc.connect(g).connect(this.sfxGain);
      this._env(osc, g, 0.3, 0.005, 0.22, t0 + dt);
    });
  }
  coin() {
    if (!this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08);
    osc.connect(g).connect(this.sfxGain);
    this._env(osc, g, 0.2, 0.003, 0.1, t0);
  }
}

// ----------------------------------------------------------------------------
// PARTICLE SYSTEM
// ----------------------------------------------------------------------------
class ParticleSystem {
  constructor() { this.parts = []; }
  burst(x, y, color, count = 14, speed = 220) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4,
        age: 0, color,
        size: 2 + Math.random() * 3
      });
    }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt; // gravity
    }
  }
  draw(ctx) {
    for (const p of this.parts) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.parts.length = 0; }
}

// ----------------------------------------------------------------------------
// FLOATING TEXT (combo callouts)
// ----------------------------------------------------------------------------
class FloatingTexts {
  constructor() { this.list = []; }
  add(text, x, y, color = '#4ff0c5') {
    this.list.push({ text, x, y, color, age: 0, life: 0.8 });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.age += dt;
      t.y -= 60 * dt;
      if (t.age >= t.life) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.list) {
      const a = 1 - t.age / t.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}

// ----------------------------------------------------------------------------
// DISC (one ring in the helix)
// ----------------------------------------------------------------------------
class Disc {
  /**
   * @param {number} y        world-y position (down is +)
   * @param {Array}  segments array of {start, end, type:'safe'|'kill'|'gap'} in radians
   */
  constructor(y, segments) {
    this.y = y;
    this.segments = segments;
    this.passed = false;
  }

  /** Given absolute world-rotation theta and ball angle phi, returns the segment under the ball */
  segmentAt(theta, phi) {
    // Disc itself doesn't rotate; the helix rotation is global. The ball's effective
    // angle relative to the disc is (phi - theta).
    let rel = (phi - theta) % TAU;
    if (rel < 0) rel += TAU;
    for (const seg of this.segments) {
      if (angleInArc(rel, seg.start, seg.end)) return seg;
    }
    return null;
  }
}

function angleInArc(a, start, end) {
  // start/end in [0, TAU), arc goes start -> end clockwise (increasing).
  // arc may wrap past TAU.
  let s = start, e = end;
  if (e >= s) return a >= s && a <= e;
  return a >= s || a <= e;
}

// ----------------------------------------------------------------------------
// HELIX  (the column of discs + global rotation)
// ----------------------------------------------------------------------------
class Helix {
  constructor() {
    this.discs = [];
    this.rotation = 0;        // current angle (rad)
    this.angVel = 0;          // rad/s — from input fling
    this.driftDeg = 0;        // auto-drift in deg/s (for level difficulty)
    this.discSpacing = 110;   // world units between discs
  }

  setDriftDeg(d) { this.driftDeg = d; }

  /** Build a fixed level helix (count discs) using a tuned profile. */
  buildLevel(spec) {
    this.discs = [];
    for (let i = 0; i < spec.discs; i++) {
      const segs = this._makeSegments(spec.killPct, spec.gapWidth, /*deterministic*/ false, i, 0);
      // y starts below ball; ball is at y=0; first disc just below.
      const y = (i + 1) * this.discSpacing;
      this.discs.push(new Disc(y, segs));
    }
  }

  /** Endless mode: generate seedless and extend as needed. */
  buildEndlessSeed(seed = 0) {
    this.discs = [];
    this._endlessSeed = seed;
    this._endlessIndex = 0;
    this.extendEndless(20);
  }

  extendEndless(n) {
    for (let i = 0; i < n; i++) {
      const idx = this._endlessIndex++;
      // depth-driven difficulty, soft cap.
      const depthT = Math.min(idx / 200, 1);
      const killPct = 0.15 + depthT * 0.50;
      const gapWidth = (90 - depthT * 55) * DEG;
      const segs = this._makeSegments(killPct, gapWidth, true, idx, this._endlessSeed);
      const y = (idx + 1) * this.discSpacing;
      this.discs.push(new Disc(y, segs));
    }
  }

  /** Daily mode: deterministic by date seed. */
  buildDaily(dateStr) {
    this.discs = [];
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) seed = ((seed << 5) - seed + dateStr.charCodeAt(i)) | 0;
    this._endlessSeed = seed;
    this._endlessIndex = 0;
    // Daily is finite but long (60 discs); after that they just pop game over by reaching end == win.
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      const killPct = 0.18 + t * 0.45;
      const gapWidth = (85 - t * 50) * DEG;
      const segs = this._makeSegments(killPct, gapWidth, true, i, seed);
      const y = (i + 1) * this.discSpacing;
      this.discs.push(new Disc(y, segs));
    }
  }

  /** Build segments around a ring: at least one gap, fill with alternating safe/kill arcs. */
  _makeSegments(killPct, gapWidth, deterministic, idx, seed) {
    const rng = deterministic ? mulberry32(hash32(seed, idx)) : Math.random;
    // 1 to 2 gaps
    const gapCount = (rng() < 0.3) ? 2 : 1;
    const segs = [];
    let cursor = rng() * TAU;
    let remaining = TAU;
    // place gaps
    const gaps = [];
    for (let i = 0; i < gapCount; i++) {
      gaps.push(cursor % TAU);
      cursor = (cursor + (TAU / gapCount)) % TAU;
    }
    gaps.sort((a, b) => a - b);
    // sectors between gaps get carved into segments
    // build a flat list of (gap, then sectorOfArcs)
    for (let g = 0; g < gaps.length; g++) {
      const start = gaps[g];
      const end = (start + gapWidth) % TAU;
      segs.push({ start, end, type: 'gap' });
    }
    // Now the remaining arc (TAU - gapCount * gapWidth) is divided into pieces.
    const sectorCount = 6 + Math.floor(rng() * 4); // 6..9 sectors total around the ring
    const sectorSpan = (TAU - gapCount * gapWidth) / sectorCount;
    // walk between gaps and slice sectors
    let walked = (gaps[0] + gapWidth) % TAU;
    let placed = 0;
    let gapIdx = 0;
    while (placed < sectorCount) {
      const nextGap = gaps[(gapIdx + 1) % gaps.length];
      const distToNextGap = ((nextGap - walked) + TAU) % TAU;
      // how many sectors fit before next gap
      let pieces;
      if (gapCount === 1) {
        pieces = sectorCount - placed;
      } else {
        pieces = Math.max(1, Math.round(distToNextGap / sectorSpan));
        pieces = Math.min(pieces, sectorCount - placed);
      }
      for (let i = 0; i < pieces; i++) {
        const s = (walked + i * sectorSpan) % TAU;
        const e = (s + sectorSpan) % TAU;
        const type = rng() < killPct ? 'kill' : 'safe';
        segs.push({ start: s, end: e, type });
        placed++;
      }
      walked = (gaps[(gapIdx + 1) % gaps.length] + gapWidth) % TAU;
      gapIdx = (gapIdx + 1) % gaps.length;
      if (gapCount === 1 && placed >= sectorCount) break;
    }
    return segs;
  }

  update(dt, inputDirection /* -1|0|+1 */, inputActive) {
    // user input acceleration
    if (inputDirection !== 0) {
      this.angVel += inputDirection * 12 * dt; // strong input torque
    }
    // drift (auto rotation difficulty)
    if (this.driftDeg) {
      this.angVel += this.driftDeg * DEG * dt * 0.5;
    }
    // friction decay
    const damp = inputActive ? 0.92 : 0.96;
    this.angVel *= Math.pow(damp, dt * 60);
    // clamp
    const max = 10;
    if (this.angVel > max) this.angVel = max;
    if (this.angVel < -max) this.angVel = -max;
    this.rotation += this.angVel * dt;
    // wrap
    this.rotation = ((this.rotation % TAU) + TAU) % TAU;
  }
}

// ----------------------------------------------------------------------------
// BALL
// ----------------------------------------------------------------------------
class Ball {
  constructor() {
    this.y = 0;          // world y
    this.vy = 0;         // vertical velocity (+ down)
    this.angle = 0;      // fixed angle in helix space (where ball sits on rim)
    this.radius = 18;
    this.bouncing = true;
    this.lastSegmentType = null;
  }
  reset(angle) {
    this.y = 0;
    this.vy = 0;
    this.angle = angle;
    this.bouncing = true;
    this.lastSegmentType = null;
  }
}

// ----------------------------------------------------------------------------
// LEADERBOARD wrapper
// ----------------------------------------------------------------------------
class Leaderboard {
  constructor() { this.data = SaveManager.loadLeaderboard(); }
  save() { SaveManager.saveLeaderboard(this.data); }
  addEndless(entry) {
    this.data.endless = (this.data.endless || []).concat(entry)
      .sort((a, b) => b.score - a.score).slice(0, 10);
    this.save();
  }
  addDaily(dateStr, entry) {
    if (!this.data.daily) this.data.daily = {};
    const arr = (this.data.daily[dateStr] || []).concat(entry)
      .sort((a, b) => b.score - a.score).slice(0, 10);
    this.data.daily[dateStr] = arr;
    this.save();
  }
  endlessTop() { return (this.data.endless || []).slice(); }
  dailyTop(dateStr) { return ((this.data.daily || {})[dateStr] || []).slice(); }
}

// ----------------------------------------------------------------------------
// UTIL
// ----------------------------------------------------------------------------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash32(seed, idx) {
  let h = (seed | 0) ^ ((idx + 1) * 0x9E3779B9);
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ----------------------------------------------------------------------------
// SKIN DRAWERS (also used in shop preview)
// ----------------------------------------------------------------------------
function drawSkinClassic(ctx, cx, cy, r) {
  const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#4ff0c5');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.stroke();
}
function drawSkinNeon(ctx, cx, cy, r) {
  ctx.save();
  ctx.shadowColor = '#ff5cf2';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff5cf2';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff8ff';
  ctx.beginPath(); ctx.arc(cx, cy, r*0.55, 0, TAU); ctx.fill();
}
function drawSkinFire(ctx, cx, cy, r) {
  const grad = ctx.createRadialGradient(cx, cy + r*0.3, r*0.2, cx, cy, r);
  grad.addColorStop(0, '#fff7c0');
  grad.addColorStop(0.5, '#ffb547');
  grad.addColorStop(1, '#ff3b5e');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
}
function drawSkinEyeball(ctx, cx, cy, r) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1145';
  ctx.beginPath(); ctx.arc(cx, cy, r*0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, r*0.28, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - r*0.15, cy - r*0.15, r*0.12, 0, TAU); ctx.fill();
}
function drawSkinSmiley(ctx, cx, cy, r) {
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1145';
  ctx.beginPath(); ctx.arc(cx - r*0.35, cy - r*0.15, r*0.12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r*0.35, cy - r*0.15, r*0.12, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1a1145'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + r*0.05, r*0.45, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

// ----------------------------------------------------------------------------
// GAME
// ----------------------------------------------------------------------------
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.W = 0; this.H = 0;

    this.audio = new AudioBus();
    this.particles = new ParticleSystem();
    this.floats = new FloatingTexts();
    this.helix = new Helix();
    this.ball = new Ball();
    this.leaderboard = new Leaderboard();

    this.state = 'menu';          // menu | play | paused | gameover | levelclear
    this.mode = 'levels';         // levels | endless | daily | quick
    this.levelIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.coinsRun = 0;
    this.discsPassed = 0;
    this.timeElapsed = 0;
    this.bestComboThisRun = 0;
    this.ghostUsedThisRun = false;
    this.shakeAmp = 0;
    this.slowmoT = 0;

    this.settings = SaveManager.loadSettings();
    this.unlocks = SaveManager.loadUnlocks();
    this.coins = SaveManager.loadCoins();
    this.bestEndless = SaveManager.loadBestEndless();
    this.playerName = SaveManager.loadName();

    this.audio.setSfxVol(this.settings.sfxVol);
    this.audio.setMusicVol(this.settings.musicVol);

    // input state
    this.input = {
      pointerActive: false,
      lastX: 0,
      lastT: 0,
      flingV: 0,
      keyLeft: false,
      keyRight: false,
      btnLeft: false,
      btnRight: false
    };

    this._lastFrameT = 0;
    this._bound = false;

    this._dailyEntrySubmitted = false;
  }

  // -------------------- BOOT --------------------
  boot() {
    this._bindResize();
    this._bindInput();
    this._bindHashRouting();
    this._bindUI();
    this._buildLevelGrid();
    this._buildShop();
    this._buildSettings();
    this._refreshLeaderboardUI('endless');
    this._refreshCoinDisplays();
    this._refreshHash();
    requestAnimationFrame((t) => this._loop(t));
    // service worker registration (relative path)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }

  // -------------------- RESIZE / DPR --------------------
  _bindResize() {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.W = w; this.H = h;
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
  }

  // -------------------- INPUT --------------------
  _bindInput() {
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: true });

    // Pointer drag rotates helix
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'play') return;
      this.input.pointerActive = true;
      this.input.lastX = e.clientX;
      this.input.lastT = performance.now();
      this.input.flingV = 0;
      this.helix.angVel = 0;
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.input.pointerActive || this.state !== 'play') return;
      const dx = e.clientX - this.input.lastX;
      const now = performance.now();
      const dt = Math.max(1, now - this.input.lastT) / 1000;
      // map pixels -> radians: full screen width = TAU
      const radDelta = (dx / this.W) * TAU;
      this.helix.rotation += radDelta;
      this.input.flingV = radDelta / dt;
      this.input.lastX = e.clientX;
      this.input.lastT = now;
    });
    const endDrag = (e) => {
      if (!this.input.pointerActive) return;
      this.input.pointerActive = false;
      // hand off momentum
      this.helix.angVel = clamp(this.input.flingV, -8, 8);
      try { c.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', endDrag);
    c.addEventListener('pointerleave', endDrag);

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.input.keyLeft = true;
      if (k === 'arrowright' || k === 'd') this.input.keyRight = true;
      if (k === 'p' || k === 'escape') {
        if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.input.keyLeft = false;
      if (k === 'arrowright' || k === 'd') this.input.keyRight = false;
    });

    // visibility -> pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.pause();
    });

    // touch hud buttons
    const bindHold = (el, prop) => {
      if (!el) return;
      const down = (e) => { e.preventDefault(); this.input[prop] = true; };
      const up = (e) => { e.preventDefault(); this.input[prop] = false; };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    bindHold(document.getElementById('btn-rot-left'), 'btnLeft');
    bindHold(document.getElementById('btn-rot-right'), 'btnRight');
  }

  // -------------------- UI BINDING --------------------
  _bindUI() {
    document.body.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      this._handleAction(action, el);
    });
    document.getElementById('btn-pause').addEventListener('click', () => {
      if (this.state === 'play') this.pause();
    });
    // Tabs in leaderboard
    document.querySelectorAll('#screen-leaderboard .tab').forEach((t) => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#screen-leaderboard .tab').forEach((x) => x.classList.remove('is-active'));
        t.classList.add('is-active');
        this._refreshLeaderboardUI(t.dataset.tab);
      });
    });
  }

  _handleAction(action, el) {
    switch (action) {
      case 'quick-play': this.startQuickPlay(); break;
      case 'go-levels': location.hash = '#levels'; break;
      case 'go-endless': this.startEndless(); break;
      case 'go-daily': this.startDaily(); break;
      case 'go-leaderboard': location.hash = '#leaderboard'; break;
      case 'go-shop': location.hash = '#shop'; break;
      case 'go-settings': location.hash = '#settings'; break;
      case 'go-howto': location.hash = '#howto'; break;
      case 'go-credits': location.hash = '#credits'; break;
      case 'back-menu': location.hash = '#menu'; break;
      case 'resume': this.resume(); break;
      case 'restart': this.restart(); break;
      case 'quit': this.quitToMenu(); break;
      case 'next-level': this.nextLevel(); break;
      case 'submit-score': this._submitScoreFromOverlay(); break;
      case 'wipe-save': this._confirmWipe(); break;
      case 'play-level': {
        const idx = parseInt(el.dataset.level, 10);
        this.startLevel(idx);
        break;
      }
      case 'skip-level': {
        const idx = parseInt(el.dataset.level, 10);
        this._trySkipLevel(idx);
        break;
      }
      case 'buy-skin': {
        const id = el.dataset.skin;
        this._buyOrEquipSkin(id);
        break;
      }
      case 'buy-ghost': this._buyGhost(); break;
    }
  }

  // -------------------- HASH ROUTING --------------------
  _bindHashRouting() {
    window.addEventListener('hashchange', () => this._refreshHash());
  }
  _refreshHash() {
    const hash = (location.hash || '#menu').replace('#', '');
    const screens = ['menu', 'levels', 'leaderboard', 'shop', 'settings', 'howto', 'credits'];
    if (!screens.includes(hash)) {
      // unknown / play hashes -> menu
      this._showScreen('menu');
      return;
    }
    if (this.state === 'play' || this.state === 'paused') {
      // bail out of game silently
      this.quitToMenu(true);
    }
    this._showScreen(hash);
    if (hash === 'leaderboard') this._refreshLeaderboardUI('endless');
    if (hash === 'shop') this._buildShop();
    if (hash === 'levels') this._buildLevelGrid();
    if (hash === 'settings') this._buildSettings();
    this._refreshCoinDisplays();
  }
  _showScreen(name) {
    const all = document.querySelectorAll('.screen');
    all.forEach((s) => { s.hidden = s.dataset.screen !== name; });
    document.getElementById('hud').hidden = true;
    document.getElementById('overlay-pause').hidden = true;
    document.getElementById('overlay-gameover').hidden = true;
    document.getElementById('overlay-levelclear').hidden = true;
  }

  // -------------------- LEVEL GRID --------------------
  _buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const idx = i + 1;
      const cleared = this.unlocks.levelsCleared >= idx;
      const unlocked = idx <= this.unlocks.levelsCleared + 1;
      const stars = this.unlocks.stars[idx] || 0;
      const tile = document.createElement('button');
      tile.className = 'level-tile' + (cleared ? ' cleared' : '') + (unlocked ? '' : ' locked');
      tile.type = 'button';
      tile.setAttribute('role', 'listitem');
      tile.dataset.level = String(i);
      tile.dataset.action = 'play-level';
      tile.disabled = !unlocked;
      tile.innerHTML = `<span>${idx}</span><span class="stars-row" aria-label="${stars} stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;

      // optional skip-cost mini button for the very next locked level
      if (!unlocked && idx === this.unlocks.levelsCleared + 2) {
        tile.disabled = false;
        tile.className = 'level-tile';
        tile.dataset.action = 'skip-level';
        tile.innerHTML += `<span class="skip-cost">${SKIP_COST}★</span>`;
      }
      grid.appendChild(tile);
    }
  }

  _trySkipLevel(idx) {
    if (this.coins < SKIP_COST) {
      this._toast(`Need ${SKIP_COST} coins`);
      return;
    }
    this.coins -= SKIP_COST;
    if (this.unlocks.levelsCleared < idx) this.unlocks.levelsCleared = idx;
    SaveManager.saveCoins(this.coins);
    SaveManager.saveUnlocks(this.unlocks);
    this._buildLevelGrid();
    this._refreshCoinDisplays();
    this._toast('Level unlocked!');
  }

  // -------------------- SHOP --------------------
  _buildShop() {
    const skinGrid = document.getElementById('skin-grid');
    skinGrid.innerHTML = '';
    SKINS.forEach((skin) => {
      const owned = this.unlocks.skins.includes(skin.id);
      const equipped = this.unlocks.equippedSkin === skin.id;
      const tile = document.createElement('button');
      tile.className = 'skin-tile' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');
      tile.type = 'button';
      tile.dataset.action = 'buy-skin';
      tile.dataset.skin = skin.id;
      tile.innerHTML = `
        <canvas width="56" height="56"></canvas>
        <span class="skin-name">${skin.name}</span>
        ${equipped ? '<span class="skin-status">EQUIPPED</span>'
          : (owned ? '<span class="skin-status">TAP TO EQUIP</span>'
                   : `<span class="skin-cost">★ ${skin.cost}</span>`)}
      `;
      skinGrid.appendChild(tile);
      const c = tile.querySelector('canvas');
      const cx = c.getContext('2d');
      skin.draw(cx, 28, 28, 22);
    });

    const powerGrid = document.getElementById('power-grid');
    powerGrid.innerHTML = '';
    const owned = this.unlocks.ghostPowerOwned;
    const tile = document.createElement('button');
    tile.className = 'skin-tile' + (owned ? ' equipped' : '');
    tile.type = 'button';
    tile.dataset.action = 'buy-ghost';
    tile.innerHTML = `
      <canvas width="56" height="56"></canvas>
      <span class="skin-name">Ghost</span>
      ${owned ? '<span class="skin-status">OWNED — 1 use per run</span>'
              : `<span class="skin-cost">★ ${GHOST_POWER_COST}</span>`}
    `;
    powerGrid.appendChild(tile);
    const pcx = tile.querySelector('canvas').getContext('2d');
    pcx.globalAlpha = 0.4;
    drawSkinClassic(pcx, 28, 28, 22);
    pcx.globalAlpha = 1;
    pcx.strokeStyle = '#4ff0c5'; pcx.lineWidth = 2; pcx.setLineDash([3,3]);
    pcx.beginPath(); pcx.arc(28, 28, 24, 0, TAU); pcx.stroke();
  }

  _buyOrEquipSkin(id) {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin) return;
    if (!this.unlocks.skins.includes(id)) {
      if (this.coins < skin.cost) { this._toast(`Need ${skin.cost} coins`); return; }
      this.coins -= skin.cost;
      this.unlocks.skins.push(id);
      SaveManager.saveCoins(this.coins);
      this._toast('Unlocked!');
    }
    this.unlocks.equippedSkin = id;
    SaveManager.saveUnlocks(this.unlocks);
    this._buildShop();
    this._refreshCoinDisplays();
  }

  _buyGhost() {
    if (this.unlocks.ghostPowerOwned) { this._toast('Already owned'); return; }
    if (this.coins < GHOST_POWER_COST) { this._toast(`Need ${GHOST_POWER_COST} coins`); return; }
    this.coins -= GHOST_POWER_COST;
    this.unlocks.ghostPowerOwned = true;
    SaveManager.saveCoins(this.coins);
    SaveManager.saveUnlocks(this.unlocks);
    this._buildShop();
    this._refreshCoinDisplays();
    this._toast('Ghost power acquired');
  }

  // -------------------- SETTINGS --------------------
  _buildSettings() {
    const sfx = document.getElementById('set-sfx');
    const mus = document.getElementById('set-music');
    const hap = document.getElementById('set-haptics');
    const cb  = document.getElementById('set-colorblind');
    const rm  = document.getElementById('set-reducedmotion');
    sfx.value = Math.round(this.settings.sfxVol * 100);
    mus.value = Math.round(this.settings.musicVol * 100);
    hap.checked = !!this.settings.haptics;
    cb.checked  = !!this.settings.colorblind;
    rm.checked  = !!this.settings.reducedMotion;
    sfx.oninput = () => { this.settings.sfxVol = +sfx.value / 100; this.audio.setSfxVol(this.settings.sfxVol); SaveManager.saveSettings(this.settings); };
    mus.oninput = () => {
      this.settings.musicVol = +mus.value / 100;
      const on = this.settings.musicVol > 0.01;
      this.settings.music = on;
      this.audio.setMusicVol(this.settings.musicVol);
      this.audio.setMusicOn(on);
      SaveManager.saveSettings(this.settings);
    };
    hap.onchange = () => { this.settings.haptics = hap.checked; SaveManager.saveSettings(this.settings); };
    cb.onchange  = () => { this.settings.colorblind = cb.checked; SaveManager.saveSettings(this.settings); };
    rm.onchange  = () => { this.settings.reducedMotion = rm.checked; SaveManager.saveSettings(this.settings); };

    // name entry
    const ne = document.getElementById('name-entry-settings');
    this._buildNameEntry(ne, this.playerName, (newName) => {
      this.playerName = newName;
      SaveManager.saveName(newName);
    });
  }

  _confirmWipe() {
    if (confirm('Wipe ALL save data? This cannot be undone.')) {
      SaveManager.wipe();
      this.settings = SaveManager.loadSettings();
      this.unlocks  = SaveManager.loadUnlocks();
      this.coins    = SaveManager.loadCoins();
      this.bestEndless = SaveManager.loadBestEndless();
      this.playerName = SaveManager.loadName();
      this.leaderboard = new Leaderboard();
      this._buildSettings();
      this._buildLevelGrid();
      this._buildShop();
      this._refreshCoinDisplays();
      this._toast('Save wiped');
    }
  }

  _buildNameEntry(container, currentName, onChange) {
    container.innerHTML = '';
    const letters = (currentName + 'AAA').slice(0, 3).toUpperCase().split('');
    letters.forEach((ch, i) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 1;
      inp.className = 'name-letter';
      inp.value = ch;
      inp.setAttribute('aria-label', `Name letter ${i+1}`);
      inp.addEventListener('input', () => {
        let v = inp.value.toUpperCase().replace(/[^A-Z]/g, '');
        inp.value = v.slice(0, 1) || ' ';
        const all = container.querySelectorAll('input');
        const name = Array.from(all).map((x) => (x.value || 'A')).join('');
        onChange(name);
        if (v && i < 2) all[i + 1].focus();
      });
      inp.addEventListener('focus', () => inp.select());
      container.appendChild(inp);
    });
  }

  // -------------------- LEADERBOARD UI --------------------
  _refreshLeaderboardUI(tab) {
    const root = document.getElementById('leaderboard-content');
    root.innerHTML = '';
    let entries;
    let showDepth = true;
    if (tab === 'endless') {
      entries = this.leaderboard.endlessTop();
    } else {
      entries = this.leaderboard.dailyTop(todayString());
      showDepth = false;
    }
    if (entries.length === 0) {
      root.innerHTML = `<div class="lb-empty">No scores yet. Be the first!</div>`;
      return;
    }
    entries.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row';
      row.innerHTML = `
        <span class="lb-rank">${i+1}</span>
        <span class="lb-name">${escapeHtml(e.name || '???')}</span>
        <span class="lb-score">${e.score}</span>
        <span class="lb-depth">${showDepth ? 'd ' + (e.depth || 0) : (e.date || '')}</span>
      `;
      root.appendChild(row);
    });
  }

  _refreshCoinDisplays() {
    const el1 = document.getElementById('coin-count-menu');
    const el2 = document.getElementById('coin-count-shop');
    if (el1) el1.textContent = this.coins;
    if (el2) el2.textContent = this.coins;
  }

  // -------------------- GAME FLOW --------------------
  startQuickPlay() {
    const next = Math.min(this.unlocks.levelsCleared, LEVELS.length - 1);
    this.startLevel(next);
  }

  startLevel(idx) {
    this.mode = 'levels';
    this.levelIndex = clamp(idx, 0, LEVELS.length - 1);
    const spec = LEVELS[this.levelIndex];
    this.helix.buildLevel(spec);
    this.helix.setDriftDeg(spec.rotateDriftDeg);
    this._beginRun();
  }

  startEndless() {
    this.mode = 'endless';
    this.helix.buildEndlessSeed(Date.now() & 0xffffffff);
    this.helix.setDriftDeg(8);
    this._beginRun();
  }

  startDaily() {
    this.mode = 'daily';
    this._dailyEntrySubmitted = false;
    this.helix.buildDaily(todayString());
    this.helix.setDriftDeg(6);
    this.unlocks.dailyPlayed = (this.unlocks.dailyPlayed || 0) + 1;
    SaveManager.saveUnlocks(this.unlocks);
    this._beginRun();
  }

  _beginRun() {
    this.score = 0;
    this.combo = 0;
    this.coinsRun = 0;
    this.discsPassed = 0;
    this.timeElapsed = 0;
    this.bestComboThisRun = 0;
    this.ghostUsedThisRun = false;
    this.shakeAmp = 0;
    this.slowmoT = 0;
    this.helix.rotation = 0;
    this.helix.angVel = 0;
    this.ball.reset(Math.PI * 0.5);   // ball sits 'in front' of camera
    this.particles.clear();
    this.floats.clear();
    this.state = 'play';
    this._showHud(true);
    this._showAllScreens(false);
    this._updateHud();
    // unlock music if user enabled it
    if (this.settings.music) this.audio.setMusicOn(true);
  }

  _showHud(on) {
    document.getElementById('hud').hidden = !on;
    // mode label
    const lbl = document.getElementById('hud-mode-label');
    const val = document.getElementById('hud-mode');
    if (this.mode === 'levels') { lbl.textContent = 'LV'; val.textContent = String(this.levelIndex + 1); }
    else if (this.mode === 'endless') { lbl.textContent = 'BEST'; val.textContent = String(this.bestEndless.depth || 0); }
    else if (this.mode === 'daily')   { lbl.textContent = 'DAILY'; val.textContent = todayString().slice(5); }
  }
  _showAllScreens(on) {
    document.querySelectorAll('.screen').forEach((s) => s.hidden = !on);
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    document.getElementById('overlay-pause').hidden = false;
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'play';
    document.getElementById('overlay-pause').hidden = true;
    this._lastFrameT = 0; // reset delta
  }
  restart() {
    if (this.mode === 'levels')      this.startLevel(this.levelIndex);
    else if (this.mode === 'endless') this.startEndless();
    else if (this.mode === 'daily')   this.startDaily();
  }
  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
    else this.quitToMenu();
  }
  quitToMenu(skipHash) {
    this.state = 'menu';
    this._showHud(false);
    document.getElementById('overlay-pause').hidden = true;
    document.getElementById('overlay-gameover').hidden = true;
    document.getElementById('overlay-levelclear').hidden = true;
    if (!skipHash) location.hash = '#menu';
    this._refreshCoinDisplays();
  }

  // -------------------- MAIN LOOP --------------------
  _loop(t) {
    requestAnimationFrame((tt) => this._loop(tt));
    if (!this._lastFrameT) this._lastFrameT = t;
    let dt = (t - this._lastFrameT) / 1000;
    this._lastFrameT = t;
    if (dt > 0.05) dt = 0.05; // cap for tab-switch
    if (this.slowmoT > 0) {
      const f = clamp(1 - this.slowmoT * 2, 0.25, 1);
      this.slowmoT -= dt;
      dt *= f;
    }
    if (this.state === 'play') this._update(dt);
    this._render(dt);
  }

  _update(dt) {
    this.timeElapsed += dt;
    // Input direction
    let dir = 0;
    if (this.input.keyLeft || this.input.btnLeft) dir -= 1;
    if (this.input.keyRight || this.input.btnRight) dir += 1;
    this.helix.update(dt, dir, this.input.pointerActive);

    // Ball physics: vertical gravity, falls between discs.
    const g = 1800;
    this.ball.vy += g * dt;
    this.ball.y += this.ball.vy * dt;

    // Find target disc (the next un-passed one)
    let target = null;
    for (const d of this.helix.discs) {
      if (!d.passed) { target = d; break; }
    }
    if (!target) {
      // reached the end => level/daily clear
      this._levelClear();
      return;
    }
    // If ball reaches disc plane
    if (this.ball.y + this.ball.radius >= target.y) {
      const seg = target.segmentAt(this.helix.rotation, this.ball.angle);
      if (!seg) {
        // No segment found means we ended up in a gap (between defined sectors).
        this._passThrough(target);
      } else if (seg.type === 'gap') {
        this._passThrough(target);
      } else if (seg.type === 'kill') {
        // ghost power can save us once
        if (this.unlocks.ghostPowerOwned && !this.ghostUsedThisRun) {
          this.ghostUsedThisRun = true;
          this.floats.add('GHOST!', this.W * 0.5, this.H * 0.5 - 40, '#ff5cf2');
          this._passThrough(target);
        } else {
          this._gameOver(target);
          return;
        }
      } else {
        // safe: bounce
        this._bounce(target);
      }
    }

    // procedurally extend endless
    if (this.mode === 'endless') {
      if (this.helix.discs.length - this.discsPassed < 12) {
        this.helix.extendEndless(10);
      }
    }

    this.particles.update(dt);
    this.floats.update(dt);
    if (this.shakeAmp > 0) this.shakeAmp = Math.max(0, this.shakeAmp - dt * 30);
  }

  _passThrough(disc) {
    disc.passed = true;
    this.discsPassed++;
    this.combo++;
    if (this.combo > this.bestComboThisRun) this.bestComboThisRun = this.combo;
    const mult = 1 + Math.floor(this.combo / 3);
    const gained = 1 * mult;
    this.score += gained;
    // coins: 1 per 3 discs, +1 bonus on combo milestones
    if (this.discsPassed % 3 === 0) { this.coinsRun++; this.audio.coin(); }
    if (this.combo > 0 && this.combo % 10 === 0) { this.coinsRun += 2; this.audio.coin(); }
    this.audio.pass(this.combo);
    if (this.combo >= 3) {
      this.floats.add(`x${mult} COMBO!`, this.W * 0.5, this.H * 0.5, '#ff5cf2');
    }
    if (!this.settings.reducedMotion) {
      this.particles.burst(this.W * 0.5, this.H * 0.5, '#4ff0c5', 18);
    }
    // ball continues falling: keep vy
    this._updateHud();
  }

  _bounce(disc) {
    this.combo = 0;
    this.ball.y = disc.y - this.ball.radius;
    // bounce strength loosely proportional to fall speed, but with a cap
    const bv = Math.min(900, Math.max(450, this.ball.vy * 0.7));
    this.ball.vy = -bv;
    this.audio.bounce();
    if (this.settings.haptics && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
    this._updateHud();
  }

  _gameOver(disc) {
    this.audio.kill();
    if (this.settings.haptics && navigator.vibrate) {
      try { navigator.vibrate([20, 40, 20]); } catch (e) {}
    }
    if (!this.settings.reducedMotion) {
      this.shakeAmp = 18;
      this.particles.burst(this.W * 0.5, this.H * 0.5, '#ff3b5e', 30, 320);
    }
    this.state = 'gameover';
    // tally
    this.coins += this.coinsRun;
    this.unlocks.totalDiscs = (this.unlocks.totalDiscs || 0) + this.discsPassed;
    this.unlocks.bestComboNoBounce = Math.max(this.unlocks.bestComboNoBounce || 0, this.bestComboThisRun);
    this.unlocks.coinsEarnedTotal = (this.unlocks.coinsEarnedTotal || 0) + this.coinsRun;
    SaveManager.saveCoins(this.coins);
    SaveManager.saveUnlocks(this.unlocks);
    this._refreshCoinDisplays();

    // best endless
    let newBest = false;
    if (this.mode === 'endless') {
      if (this.score > (this.bestEndless.score || 0)) {
        this.bestEndless = { score: this.score, depth: this.discsPassed };
        SaveManager.saveBestEndless(this.bestEndless);
        newBest = true;
      }
      this.unlocks.bestEndlessDepth = Math.max(this.unlocks.bestEndlessDepth || 0, this.discsPassed);
      SaveManager.saveUnlocks(this.unlocks);
    }

    this._checkAchievements();

    // populate overlay
    document.getElementById('result-score').textContent = String(this.score);
    document.getElementById('result-depth').textContent = String(this.discsPassed);
    document.getElementById('result-coins').textContent = '+' + this.coinsRun;
    document.getElementById('result-newbest').hidden = !newBest;

    // name-entry only for endless / daily on a non-zero score
    const showName = (this.mode === 'endless' || this.mode === 'daily') && this.score > 0;
    const entryWrap = document.getElementById('result-name-entry');
    entryWrap.hidden = !showName;
    if (showName) {
      this._buildNameEntry(document.getElementById('name-entry-gameover'), this.playerName, (n) => {
        this.playerName = n;
        SaveManager.saveName(n);
      });
    }
    document.getElementById('overlay-gameover').hidden = false;
  }

  _submitScoreFromOverlay() {
    if (this.mode === 'endless') {
      this.leaderboard.addEndless({
        name: this.playerName, score: this.score, depth: this.discsPassed, date: todayString()
      });
    } else if (this.mode === 'daily') {
      if (!this._dailyEntrySubmitted) {
        this.leaderboard.addDaily(todayString(), {
          name: this.playerName, score: this.score, date: todayString()
        });
        this._dailyEntrySubmitted = true;
      }
    }
    document.getElementById('result-name-entry').hidden = true;
    this._toast('Score submitted!');
  }

  _levelClear() {
    this.state = 'levelclear';
    if (!this.settings.reducedMotion) this.slowmoT = 0.6;
    this.audio.clear();

    // Award
    this.coins += this.coinsRun;
    this.unlocks.totalDiscs = (this.unlocks.totalDiscs || 0) + this.discsPassed;
    this.unlocks.bestComboNoBounce = Math.max(this.unlocks.bestComboNoBounce || 0, this.bestComboThisRun);
    this.unlocks.coinsEarnedTotal = (this.unlocks.coinsEarnedTotal || 0) + this.coinsRun;

    let stars = 1;
    if (this.mode === 'levels') {
      const spec = LEVELS[this.levelIndex];
      // 2 stars: no bounce. 3 stars: under target time.
      if (this.bestComboThisRun === spec.discs) stars = Math.max(stars, 2);
      if (this.timeElapsed <= spec.targetTimeSec) stars = Math.max(stars, 3);
      const lvlKey = this.levelIndex + 1;
      const prev = this.unlocks.stars[lvlKey] || 0;
      if (stars > prev) this.unlocks.stars[lvlKey] = stars;
      if (this.unlocks.levelsCleared < this.levelIndex + 1) {
        this.unlocks.levelsCleared = this.levelIndex + 1;
      }
    }
    SaveManager.saveUnlocks(this.unlocks);
    SaveManager.saveCoins(this.coins);
    this._refreshCoinDisplays();
    this._checkAchievements();

    document.getElementById('result-clear-score').textContent = String(this.score);
    document.getElementById('result-clear-time').textContent = this.timeElapsed.toFixed(1) + 's';
    document.getElementById('result-clear-coins').textContent = '+' + this.coinsRun;
    const starsEl = document.getElementById('result-stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i >= stars) s.className = 'empty';
      starsEl.appendChild(s);
    }
    document.getElementById('overlay-levelclear').hidden = false;
  }

  _checkAchievements() {
    const stat = Object.assign({}, this.unlocks);
    ACHIEVEMENTS.forEach((a) => {
      if (this.unlocks.achievements.includes(a.id)) return;
      if (a.check(stat)) {
        this.unlocks.achievements.push(a.id);
        this._popAchievement(a.name);
      }
    });
    SaveManager.saveUnlocks(this.unlocks);
  }

  _popAchievement(name) {
    const el = document.getElementById('overlay-achievement');
    document.getElementById('ach-name').textContent = name;
    el.hidden = false;
    // restart animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => { el.hidden = true; }, 3100);
  }

  _toast(msg) {
    const el = document.getElementById('overlay-toast');
    el.textContent = msg;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.hidden = true; }, 2200);
  }

  _updateHud() {
    document.getElementById('hud-score').textContent = String(this.score);
    document.getElementById('hud-depth').textContent = String(this.discsPassed);
    const wrap = document.getElementById('hud-combo-wrap');
    if (this.combo >= 2) {
      wrap.hidden = false;
      document.getElementById('hud-combo').textContent = 'x' + this.combo;
    } else {
      wrap.hidden = true;
    }
  }

  // -------------------- RENDER --------------------
  _render(dt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // shake
    let shakeX = 0, shakeY = 0;
    if (this.shakeAmp > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeAmp;
      shakeY = (Math.random() - 0.5) * this.shakeAmp;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background pulse on play; just leave CSS gradient otherwise.
    // Camera: ball sits centered vertically. World-y -> screen-y.
    const ballScreenY = H * 0.32;
    const ballScreenX = W * 0.5;
    const camY = this.ball.y - ballScreenY;

    if (this.state === 'play' || this.state === 'paused' || this.state === 'gameover' || this.state === 'levelclear') {
      this._renderHelix(ctx, W, H, ballScreenX, camY);
      this._renderBall(ctx, ballScreenX, ballScreenY);
    } else {
      // menu background ambient: render a slowly drifting decorative helix
      this._renderMenuBackdrop(ctx, W, H, dt);
    }

    this.particles.draw(ctx);
    this.floats.draw(ctx);

    ctx.restore();
  }

  _renderHelix(ctx, W, H, cx, camY) {
    const ringRadiusX = Math.min(W * 0.38, 230);
    const ringRadiusY = ringRadiusX * 0.28;
    // ring thickness
    const thickness = Math.max(14, ringRadiusY * 0.6);
    // visible window
    for (const disc of this.helix.discs) {
      const sy = disc.y - camY;
      if (sy < -50 || sy > H + 100) continue;
      this._renderDisc(ctx, disc, cx, sy, ringRadiusX, ringRadiusY, thickness);
    }
  }

  _renderDisc(ctx, disc, cx, cy, rx, ry, thickness) {
    // depth perspective: shrink rings further down slightly
    const depth = 1; // could vary with distance
    // draw shadow ellipse
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.55, rx * 0.95, ry * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Draw each segment as a ring slice. Approach: stroke an elliptical arc
    // using parametric sampling.
    for (const seg of disc.segments) {
      this._drawArcSegment(ctx, cx, cy, rx, ry, thickness, disc, seg);
    }
    // outline (gives the ring shape definition)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }

  _drawArcSegment(ctx, cx, cy, rx, ry, thickness, disc, seg) {
    if (seg.type === 'gap') return; // nothing to draw
    let col;
    if (seg.type === 'safe') {
      col = this.settings.colorblind ? '#5fb3ff' : '#4ade80';
    } else { // kill
      col = '#ff3b5e';
    }
    // Translate the segment angles by the helix global rotation
    const a0 = seg.start + this.helix.rotation;
    const a1 = seg.end + this.helix.rotation;
    // Sample arc
    const steps = 24;
    let span = a1 - a0;
    if (span <= 0) span += TAU;
    // Outer path
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (span * i / steps);
      const x = cx + Math.cos(a) * (rx + thickness * 0.5);
      const y = cy + Math.sin(a) * (ry + thickness * 0.5);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + (span * i / steps);
      const x = cx + Math.cos(a) * (rx - thickness * 0.5);
      const y = cy + Math.sin(a) * (ry - thickness * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    // Colorblind: stripe pattern on kill segments + skull dot
    if (seg.type === 'kill' && this.settings.colorblind) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      for (let i = -50; i < 50; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 8 - 50, cy - thickness);
        ctx.lineTo(cx + i * 8 + 50, cy + thickness);
        ctx.stroke();
      }
      ctx.restore();
      // small marker at segment midpoint
      const mid = a0 + span * 0.5;
      const mx = cx + Math.cos(mid) * rx;
      const my = cy + Math.sin(mid) * ry;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', mx, my);
    }

    // subtle highlight along the top edge of the arc
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (span * i / steps);
      const x = cx + Math.cos(a) * (rx + thickness * 0.5);
      const y = cy + Math.sin(a) * (ry + thickness * 0.5);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _renderBall(ctx, x, y) {
    const skinId = this.unlocks.equippedSkin || 'classic';
    const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
    // soft shadow under ball
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + this.ball.radius * 1.2, this.ball.radius * 0.9, this.ball.radius * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    skin.draw(ctx, x, y, this.ball.radius);
    // ghost indicator
    if (this.unlocks.ghostPowerOwned && !this.ghostUsedThisRun) {
      ctx.save();
      ctx.strokeStyle = '#ff5cf2';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, this.ball.radius + 5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderMenuBackdrop(ctx, W, H, dt) {
    // gentle drifting rings for ambience
    if (!this._menuRings) {
      this._menuRings = [];
      for (let i = 0; i < 6; i++) {
        this._menuRings.push({
          y: (i / 6) * H * 1.2 + 60,
          rot: Math.random() * TAU,
          drift: 0.2 + Math.random() * 0.3
        });
      }
    }
    const cx = W * 0.5;
    const rx = Math.min(W * 0.42, 240);
    const ry = rx * 0.25;
    for (const r of this._menuRings) {
      r.rot += dt * r.drift;
      ctx.save();
      ctx.strokeStyle = 'rgba(79, 240, 197, 0.18)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(cx, r.y, rx, ry, 0, 0, TAU);
      ctx.stroke();
      // a gap
      ctx.strokeStyle = 'rgba(7, 8, 28, 1)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(cx, r.y, rx, ry, 0, r.rot, r.rot + 1.2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ----------------------------------------------------------------------------
// BOOT
// ----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.boot();
  // expose for debug
  window.__game = game;
});
