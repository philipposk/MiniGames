/* =============================================================================
   ROCK SIMULATOR — game.js
   Pure vanilla JS, no build, no deps.
   Architecture (mirrors the rest of the MiniGames arcade):
     - SaveManager : namespaced localStorage wrapper
     - AudioBus    : WebAudio osc/envelope SFX + wind ambience
     - Economy     : grit / moss / sediment, upgrades, eras, prestige
     - RockView    : seeded procedural rock + weather + particles on canvas
     - Game        : fixed-step accumulator loop, offline catch-up, events
     - UI          : DOM screens, hash routing, achievement toasts
   ============================================================================= */
'use strict';

const SAVE_NS   = 'rock-simulator:v1:';
const GAME_ID   = 'rock-simulator';
const THEME_KEY = 'rock-simulator:v1:theme';
const TAU = Math.PI * 2;

const OFFLINE_GRIT_CAP_S = 8 * 3600;   // 8h of erosion banked
const OFFLINE_MOSS_CAP_S = 12 * 3600;  // 12h of moss banked
const OFFLINE_EFFICIENCY = 0.5;        // rocks are slow when unobserved
const IDLE_AFTER_S = 5;                // moss only grows after this much quiet
const IDLE_RAMP_S  = 300;              // ...and peaks at 3x after 5 quiet minutes
const PRESTIGE_MIN = 1e6;

// -----------------------------------------------------------------------------
// CONTENT
// -----------------------------------------------------------------------------
const ERAS = [
  { name: 'Pebble',    req: 0,      mult: 1,   quip: 'Small. Underfoot. Full of potential.' },
  { name: 'Stone',     req: 1e3,    mult: 2,   quip: 'Skippable across water. A real career milestone.' },
  { name: 'Rock',      req: 2.5e4,  mult: 4,   quip: 'You now qualify for the name of this game.' },
  { name: 'Boulder',   req: 5e5,    mult: 8,   quip: 'Hikers photograph you. You do not acknowledge them.' },
  { name: 'Monolith',  req: 1e7,    mult: 16,  quip: 'Somebody has started leaving offerings.' },
  { name: 'Meteorite', req: 2.5e8,  mult: 32,  quip: 'Technically you have been to space. Do mention it.' },
  { name: 'Mountain',  req: 5e9,    mult: 64,  quip: 'You have weather now. Your own weather.' },
  { name: 'Planetoid', req: 1e11,   mult: 128, quip: 'Astronomers argue about whether you count.' },
  { name: 'Continent', req: 2e12,   mult: 256, quip: 'Things live on you. They have opinions about you.' }
];

// rate = grit per second, per unit owned (before all multipliers)
const UPGRADES = [
  { id: 'dew',      glyph: '💧', name: 'Morning Dew',     rate: 0.1,     cost: 15,    unlock: 0,     desc: 'Water finds a hairline crack. Physics does the rest.' },
  { id: 'lichen',   glyph: '🍂', name: 'Lichen Crust',    rate: 1,       cost: 120,   unlock: 60,    desc: 'Secretes acid. Very politely dissolves you.' },
  { id: 'rain',     glyph: '🌧️', name: 'Steady Rain',     rate: 8,       cost: 1.1e3, unlock: 600,   desc: 'A million small taps. You know how that feels.' },
  { id: 'frost',    glyph: '❄️', name: 'Frost Wedge',     rate: 47,      cost: 1.2e4, unlock: 6e3,   desc: 'Water freezes in your seams and pries them open.' },
  { id: 'river',    glyph: '🌊', name: 'River Bend',      rate: 260,     cost: 1.3e5, unlock: 6e4,   desc: 'Patient, relentless, and always winning.' },
  { id: 'wind',     glyph: '🌬️', name: 'Sand Scour',      rate: 1.4e3,   cost: 1.4e6, unlock: 7e5,   desc: 'A desert sandblasts you into an interesting shape.' },
  { id: 'glacier',  glyph: '🧊', name: 'Glacier',         rate: 7.8e3,   cost: 2e7,   unlock: 1e7,   desc: 'Moves an inch a year. Wins anyway.' },
  { id: 'tectonic', glyph: '🏔️', name: 'Tectonic Grind',  rate: 4.4e4,   cost: 3.3e8, unlock: 1.5e8, desc: 'Two plates argue. You are the argument.' },
  { id: 'volcano',  glyph: '🌋', name: 'Volcanic Vent',   rate: 2.6e5,   cost: 5.1e9, unlock: 2e9,   desc: 'New rock is made. Old rock is you.' },
  { id: 'cosmic',   glyph: '☄️', name: 'Cosmic Dust',     rate: 1.6e6,   cost: 7.5e10,unlock: 3e10,  desc: 'Micrometeorites, sanding you down since forever.' }
];
const COST_GROWTH = 1.15;

// Moss shop. `max` levels, cost grows by `growth`.
const MOSS_UPGRADES = [
  { id: 'cushion', glyph: '🌿', name: 'Moss Cushion',   cost: 5,   growth: 2.0, max: 10, effect: 'tap',  amount: 0.35, desc: '+35% grit per tap, per level.' },
  { id: 'roots',   glyph: '🌱', name: 'Deep Roots',     cost: 15,  growth: 2.1, max: 10, effect: 'gps',  amount: 0.30, desc: '+30% passive erosion, per level.' },
  { id: 'patina',  glyph: '🪨', name: 'Patina',         cost: 40,  growth: 2.4, max: 8,  effect: 'moss', amount: 0.50, desc: '+50% moss growth rate, per level.' },
  { id: 'symbio',  glyph: '🍄', name: 'Symbiosis',      cost: 120, growth: 2.6, max: 6,  effect: 'all',  amount: 0.25, desc: '+25% to everything, per level.' },
  { id: 'spores',  glyph: '💨', name: 'Spore Cloud',    cost: 300, growth: 3.0, max: 5,  effect: 'crack',amount: 0.20, desc: 'Cracks appear 20% more often, per level.' },
  { id: 'ancient', glyph: '🌳', name: 'Ancient Growth', cost: 900, growth: 4.0, max: 4,  effect: 'all',  amount: 1.00, desc: 'Doubles everything, per level. Yes, really.' }
];

const ACHIEVEMENTS = [
  { id: 'first_tap',   icon: '👆', name: 'First Contact',   check: s => s.stats.taps >= 1 },
  { id: 'tap_1000',    icon: '🖐️', name: 'Thousand Taps',   check: s => s.stats.taps >= 1000 },
  { id: 'tap_10000',   icon: '🤲', name: 'Ten Thousand',    check: s => s.stats.taps >= 10000 },
  { id: 'first_buy',   icon: '💧', name: 'Weathering',      check: s => totalUpgrades(s) >= 1 },
  { id: 'ten_buy',     icon: '🌧️', name: 'Getting Wet',     check: s => totalUpgrades(s) >= 25 },
  { id: 'hundred_buy', icon: '🌊', name: 'Fully Eroded',    check: s => totalUpgrades(s) >= 100 },
  { id: 'all_kinds',   icon: '🗺️', name: 'One Of Each',     check: s => UPGRADES.every(u => (s.upgrades[u.id] || 0) > 0) },
  { id: 'moss_first',  icon: '🌱', name: 'Something Grew',  check: s => s.stats.mossEarned >= 1 },
  { id: 'moss_100',    icon: '🌿', name: 'Gathering Moss',  check: s => s.stats.mossEarned >= 100 },
  { id: 'idle_10',     icon: '😴', name: 'Ten Quiet Minutes', check: s => s.stats.bestIdleS >= 600 },
  { id: 'era_rock',    icon: '🪨', name: 'Actually A Rock', check: s => s.stats.bestEra >= 2 },
  { id: 'era_mono',    icon: '🗿', name: 'Monolithic',      check: s => s.stats.bestEra >= 4 },
  { id: 'era_mount',   icon: '🏔️', name: 'Tall Order',      check: s => s.stats.bestEra >= 6 },
  { id: 'era_cont',    icon: '🌍', name: 'Continental',     check: s => s.stats.bestEra >= 8 },
  { id: 'crack_1',     icon: '⚡', name: 'Crack Shot',      check: s => s.stats.cracks >= 1 },
  { id: 'crack_50',    icon: '💥', name: 'Fault Line',      check: s => s.stats.cracks >= 50 },
  { id: 'prestige_1',  icon: '⏳', name: 'Dust To Dust',    check: s => s.stats.prestiges >= 1 },
  { id: 'prestige_10', icon: '🔁', name: 'Deep Time',       check: s => s.stats.prestiges >= 10 },
  { id: 'sediment_1k', icon: '⛰️', name: 'Sedimentary',     check: s => s.sediment >= 1000 },
  { id: 'offline_max', icon: '🌙', name: 'Full Eight Hours',check: s => s.stats.maxOfflineS >= OFFLINE_GRIT_CAP_S }
];

const OFFLINE_QUIPS = [
  'You did not move. Perfect execution.',
  'The rock did rock things. Efficiently.',
  'Somewhere, water kept dripping.',
  'A beetle walked across you. It has been dealt with.',
  'Nothing happened. Slowly. And that was the point.',
  'Geology continued in your absence.'
];

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return (n < 10 && n % 1 !== 0) ? n.toFixed(1) : String(Math.floor(n));
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) return n.toExponential(2);
  const scaled = n / Math.pow(1000, tier);
  return (scaled < 10 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : scaled.toFixed(0)) + SUFFIX[tier];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600);
  const m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (d) return d + 'd ' + h + 'h';
  if (h) return h + 'h ' + m + 'm';
  if (m) return m + 'm ' + s + 's';
  return s + 's';
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function totalUpgrades(s) { let t = 0; for (const k in s.upgrades) t += s.upgrades[k]; return t; }
// Deterministic PRNG so a save always regrows the same rock.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

// -----------------------------------------------------------------------------
// SAVE
// -----------------------------------------------------------------------------
const SaveManager = {
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(SAVE_NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  _set(key, val) {
    try { localStorage.setItem(SAVE_NS + key, JSON.stringify(val)); } catch (e) {}
  },
  loadSettings() {
    return Object.assign({
      sfxVol: 0.8, musicVol: 0.35, haptics: true,
      colorblind: false, reducedMotion: false, floaters: true
    }, this._get('settings', {}));
  },
  saveSettings(s) { this._set('settings', s); },
  loadState() { return this._get('state', null); },
  saveState(s) { this._set('state', s); },
  loadBoard() { return this._get('board', { lifetime: [], sediment: [] }); },
  saveBoard(b) { this._set('board', b); },
  wipe() {
    try {
      Object.keys(localStorage)
        .filter(k => k.indexOf(SAVE_NS) === 0 && k !== THEME_KEY)
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
};

function freshState() {
  return {
    seed: Math.floor(Math.random() * 1e9),
    grit: 0,
    lifetimeGrit: 0,       // this run — drives eras
    moss: 0,
    sediment: 0,
    upgrades: {},
    mossUps: {},
    era: 0,
    unlockedAch: {},
    savedAt: Date.now(),
    stats: {
      taps: 0, tapGrit: 0, idleGrit: 0, mossEarned: 0,
      allTimeGrit: 0, prestiges: 0, cracks: 0,
      bestEra: 0, bestIdleS: 0, maxOfflineS: 0,
      startedAt: Date.now(), playtimeS: 0
    }
  };
}

// -----------------------------------------------------------------------------
// AUDIO — synthesised, no assets
// -----------------------------------------------------------------------------
const AudioBus = {
  ctx: null, master: null, windGain: null, started: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },
  noiseBuffer(dur) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  },
  // Short filtered noise burst = a chunk of stone coming off.
  thud(pitch, vol) {
    if (!this.ctx || Game.settings.sfxVol <= 0) return;
    const t = this.ctx.currentTime;
    const v = (vol == null ? 1 : vol) * Game.settings.sfxVol * 0.5;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.16);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (pitch || 320) * (0.9 + Math.random() * 0.25);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.17);
  },
  tone(freq, dur, vol, type) {
    if (!this.ctx || Game.settings.sfxVol <= 0) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((vol || 0.3) * Game.settings.sfxVol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.25));
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + (dur || 0.25) + 0.02);
  },
  chime(base) {
    [1, 1.5, 2].forEach((m, i) => setTimeout(() => this.tone(base * m, 0.4, 0.16, 'triangle'), i * 70));
  },
  startWind() {
    if (!this.ctx || this.started) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer(4);
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.value = Game.settings.musicVol * 0.06;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.07; lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      this.windGain = g; this.started = true;
    } catch (e) {}
  },
  setWind(v) { if (this.windGain) this.windGain.gain.value = v * 0.06; }
};

function haptic(kind) {
  if (!Game.settings.haptics) return;
  if (window.MGNative && MGNative.Haptics) {
    if (kind === 'heavy') MGNative.Haptics.heavy();
    else if (kind === 'medium') MGNative.Haptics.medium();
    else MGNative.Haptics.light();
  } else if (navigator.vibrate) {
    navigator.vibrate(kind === 'heavy' ? 26 : kind === 'medium' ? 14 : 7);
  }
}

// -----------------------------------------------------------------------------
// ECONOMY
// -----------------------------------------------------------------------------
const Economy = {
  upgradeCost(id, ownedOverride) {
    const def = UPGRADES.find(u => u.id === id);
    const owned = ownedOverride == null ? (Game.state.upgrades[id] || 0) : ownedOverride;
    return Math.ceil(def.cost * Math.pow(COST_GROWTH, owned));
  },
  mossCost(id) {
    const def = MOSS_UPGRADES.find(u => u.id === id);
    const lvl = Game.state.mossUps[id] || 0;
    return Math.ceil(def.cost * Math.pow(def.growth, lvl));
  },
  mossBonus(effect) {
    // Returns a multiplier from every moss upgrade touching `effect` (plus 'all').
    let mult = 1;
    for (const def of MOSS_UPGRADES) {
      const lvl = Game.state.mossUps[def.id] || 0;
      if (!lvl) continue;
      if (def.effect === effect || def.effect === 'all') mult *= Math.pow(1 + def.amount, lvl);
    }
    return mult;
  },
  crackBonus() {
    let mult = 1;
    for (const def of MOSS_UPGRADES) {
      if (def.effect !== 'crack') continue;
      const lvl = Game.state.mossUps[def.id] || 0;
      if (lvl) mult *= Math.pow(1 + def.amount, lvl);
    }
    return mult;
  },
  eraMult() { return ERAS[Game.state.era].mult; },
  sedimentMult() { return 1 + Game.state.sediment * 0.02; },
  baseGps() {
    let raw = 0;
    for (const u of UPGRADES) raw += (Game.state.upgrades[u.id] || 0) * u.rate;
    return raw;
  },
  gps() {
    return this.baseGps() * this.eraMult() * this.sedimentMult() *
           this.mossBonus('gps') * Game.eventGpsMult;
  },
  tapValue() {
    const base = 1 + this.baseGps() * 0.05; // taps stay meaningful deep into a run
    return base * this.eraMult() * this.sedimentMult() *
           this.mossBonus('tap') * Game.frenzyMult;
  },
  mossRate() { // moss per second at full idle ramp
    return (0.5 / 60) * this.mossBonus('moss') * (1 + Game.state.era * 0.35);
  },
  prestigeGain() {
    const lg = Game.state.lifetimeGrit;
    if (lg < PRESTIGE_MIN) return 0;
    return Math.floor(10 * Math.sqrt(lg / PRESTIGE_MIN));
  }
};

// -----------------------------------------------------------------------------
// ROCK VIEW — procedural rock, weather, particles
// -----------------------------------------------------------------------------
const RockView = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
  shape: null, craters: null, mossSpots: null,
  particles: [], floaters: [], weather: [],
  squash: 0, shake: 0, t: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  // Rebuild the silhouette. Same seed + era => same rock, every session.
  build(seed, era) {
    const rnd = mulberry32(seed + era * 7919);
    const pts = 13 + (era % 4);
    this.shape = [];
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU;
      const r = 0.78 + rnd() * 0.34 - (Math.sin(a) > 0 ? 0 : 0.04);
      this.shape.push({ a, r });
    }
    this.craters = [];
    const nc = 3 + Math.floor(rnd() * 4) + Math.min(4, era);
    for (let i = 0; i < nc; i++) {
      const a = rnd() * TAU, d = rnd() * 0.6;
      this.craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, r: 0.05 + rnd() * 0.09, rot: rnd() * TAU });
    }
    this.mossSpots = [];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, d = 0.35 + rnd() * 0.5;
      this.mossSpots.push({ x: Math.cos(a) * d, y: Math.abs(Math.sin(a)) * d * 0.7, r: 0.10 + rnd() * 0.14 });
    }
  },
  // The bottom sheet (portrait) or side sheet (wide) eats part of the viewport,
  // so the rock is centred in whatever is actually left over.
  isWide() { return this.w >= 720; },
  freeArea() {
    if (this.isWide()) return { x: 0, y: 0, w: Math.max(240, this.w - 400), h: this.h };
    const sheetH = Math.min(this.h * 0.56, 560);
    return { x: 0, y: 0, w: this.w, h: Math.max(220, this.h - sheetH) };
  },
  center() {
    const a = this.freeArea();
    return { x: a.x + a.w / 2, y: a.y + a.h * (this.isWide() ? 0.5 : 0.56) };
  },
  radius() {
    const a = this.freeArea();
    const base = Math.min(a.w, a.h) * 0.30;
    const grown = base * (1 + Math.min(Game.state.era, 8) * 0.055);
    return Math.min(grown, Math.min(a.w, a.h) * 0.42);
  },
  hit(x, y) {
    const c = this.center(), r = this.radius() * 1.12;
    const dx = x - c.x, dy = (y - c.y) / 0.88;
    return dx * dx + dy * dy <= r * r;
  },
  punch(x, y, big) {
    this.squash = big ? 1 : 0.55;
    if (!Game.settings.reducedMotion) this.shake = big ? 7 : 2.6;
    const n = Game.settings.reducedMotion ? 3 : (big ? 22 : 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * (big ? 260 : 140);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.6, age: 0,
        size: 1.5 + Math.random() * (big ? 4 : 2.5),
        rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 8
      });
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  },
  floater(x, y, text, color) {
    if (!Game.settings.floaters) return;
    this.floaters.push({ x, y, text, color: color || null, age: 0, life: 1.0, dx: (Math.random() - 0.5) * 26 });
    if (this.floaters.length > 40) this.floaters.shift();
  },
  update(dt) {
    this.t += dt;
    this.squash = Math.max(0, this.squash - dt * 4.2);
    this.shake = Math.max(0, this.shake - dt * 22);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      p.vy += 620 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      if (f.age >= f.life) { this.floaters.splice(i, 1); continue; }
      f.y -= 52 * dt; f.x += f.dx * dt;
    }
    this.updateWeather(dt);
  },
  weatherKind() {
    const u = Game.state.upgrades;
    if ((u.cosmic || 0) > 0) return 'cosmic';
    if ((u.volcano || 0) > 0) return 'ember';
    if ((u.glacier || 0) > 0 || (u.frost || 0) > 0) return 'snow';
    if ((u.wind || 0) > 0) return 'sand';
    if ((u.rain || 0) > 0 || (u.dew || 0) > 0) return 'rain';
    return 'none';
  },
  updateWeather(dt) {
    const kind = this.weatherKind();
    if (kind === 'none' || Game.settings.reducedMotion) { this.weather.length = 0; return; }
    const target = kind === 'rain' ? 70 : kind === 'snow' ? 55 : kind === 'sand' ? 90 : 40;
    while (this.weather.length < target) {
      this.weather.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: Math.random() });
    }
    while (this.weather.length > target) this.weather.pop();
    const vy = kind === 'rain' ? 900 : kind === 'snow' ? 70 : kind === 'sand' ? 120 : 40;
    const vx = kind === 'sand' ? 420 : kind === 'snow' ? 26 : kind === 'cosmic' ? -60 : 60;
    for (const d of this.weather) {
      d.y += (vy * (0.5 + d.s)) * dt;
      d.x += (vx * (0.5 + d.s)) * dt;
      if (d.y > this.h + 12) { d.y = -12; d.x = Math.random() * this.w; }
      if (d.x > this.w + 12) d.x = -12;
      if (d.x < -12) d.x = this.w + 12;
    }
  },
  cssVar(name, fb) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  },
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const light = document.documentElement.getAttribute('data-theme') === 'light' ||
      (!document.documentElement.getAttribute('data-theme') &&
        window.matchMedia && !matchMedia('(prefers-color-scheme: dark)').matches);

    this.drawStrata(ctx, light);
    this.drawWeather(ctx, light);

    ctx.save();
    if (this.shake > 0.02) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawRock(ctx, light);
    ctx.restore();

    this.drawCrack(ctx);
    this.drawParticles(ctx, light);
    this.drawFloaters(ctx, light);
  },
  drawStrata(ctx, light) {
    const a = this.freeArea();
    const groundY = Math.min(this.h * 0.66, a.y + a.h * 0.86);
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const y = groundY + i * ((this.h - groundY) / bands);
      const hgt = (this.h - groundY) / bands + 1;
      const a = light ? 0.05 + i * 0.018 : 0.035 + i * 0.016;
      ctx.fillStyle = light ? `rgba(90,72,44,${a})` : `rgba(217,199,163,${a})`;
      ctx.fillRect(0, y, this.w, hgt);
    }
    ctx.globalAlpha = 1;
  },
  drawWeather(ctx, light) {
    const kind = this.weatherKind();
    if (kind === 'none' || !this.weather.length) return;
    ctx.save();
    for (const d of this.weather) {
      const s = 0.4 + d.s;
      if (kind === 'rain') {
        ctx.strokeStyle = light ? 'rgba(60,90,130,0.35)' : 'rgba(170,200,255,0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 11 * s); ctx.stroke();
      } else if (kind === 'snow') {
        ctx.fillStyle = light ? 'rgba(120,140,170,0.42)' : 'rgba(230,240,255,0.45)';
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.4 * s, 0, TAU); ctx.fill();
      } else if (kind === 'sand') {
        ctx.fillStyle = light ? 'rgba(150,120,70,0.32)' : 'rgba(217,199,163,0.28)';
        ctx.fillRect(d.x, d.y, 3 + 3 * s, 1);
      } else if (kind === 'ember') {
        ctx.fillStyle = `rgba(230,110,50,${0.25 + d.s * 0.4})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.6 * s, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(200,220,255,${0.2 + d.s * 0.35})`;
        ctx.fillRect(d.x, d.y, 1.5, 1.5);
      }
    }
    ctx.restore();
  },
  rockPath(ctx, cx, cy, r, sq) {
    ctx.beginPath();
    for (let i = 0; i < this.shape.length; i++) {
      const p = this.shape[i];
      const x = cx + Math.cos(p.a) * r * p.r * (1 + sq * 0.10);
      const y = cy + Math.sin(p.a) * r * p.r * 0.88 * (1 - sq * 0.14);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  },
  drawRock(ctx, light) {
    if (!this.shape) this.build(Game.state.seed, Game.state.era);
    const c = this.center();
    const r = this.radius();
    const sq = this.squash;
    const breathe = Game.settings.reducedMotion ? 0 : Math.sin(this.t * 0.8) * 0.006;
    const rr = r * (1 + breathe);

    // contact shadow
    ctx.save();
    ctx.globalAlpha = light ? 0.12 : 0.26;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + rr * 0.90, rr * 0.72, rr * 0.10, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // body
    const grad = ctx.createLinearGradient(c.x - rr, c.y - rr, c.x + rr * 0.6, c.y + rr);
    if (light) { grad.addColorStop(0, '#d9cdb6'); grad.addColorStop(0.55, '#a2947c'); grad.addColorStop(1, '#6d6355'); }
    else { grad.addColorStop(0, '#b9ab93'); grad.addColorStop(0.55, '#7d7161'); grad.addColorStop(1, '#463f37'); }
    ctx.fillStyle = grad;
    this.rockPath(ctx, c.x, c.y, rr, sq);
    ctx.fill();

    ctx.save();
    this.rockPath(ctx, c.x, c.y, rr, sq);
    ctx.clip();

    // craters
    for (const cr of this.craters) {
      const x = c.x + cr.x * rr, y = c.y + cr.y * rr, cRad = cr.r * rr;
      const g = ctx.createRadialGradient(x - cRad * 0.3, y - cRad * 0.3, cRad * 0.15, x, y, cRad);
      g.addColorStop(0, 'rgba(0,0,0,0.30)');
      g.addColorStop(1, 'rgba(0,0,0,0.02)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, cRad, cRad * 0.75, cr.rot, 0, TAU); ctx.fill();
    }

    // moss coverage scales with current moss, capped so the rock stays visible
    const cover = clamp(Math.log10(1 + Game.state.moss) / 3.2, 0, 1);
    if (cover > 0.01) {
      const mossCol = Game.settings.colorblind ? '#4fa3d9' : (light ? '#5f9c33' : '#6fb83a');
      ctx.fillStyle = mossCol;
      const n = Math.ceil(cover * this.mossSpots.length);
      ctx.globalAlpha = 0.22 + cover * 0.28;
      for (let i = 0; i < n; i++) {
        const m = this.mossSpots[i];
        const mx = c.x + m.x * rr, my = c.y + m.y * rr;
        const mr = m.r * rr * 0.55 * (0.6 + cover * 0.6);
        // A patch is a few overlapping lobes, so it reads as moss and not as a blob.
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + i;
          ctx.beginPath();
          ctx.ellipse(mx + Math.cos(a) * mr * 0.5, my + Math.sin(a) * mr * 0.35,
                      mr * 0.75, mr * 0.5, a * 0.3, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // top highlight
    const hi = ctx.createLinearGradient(c.x, c.y - rr, c.x, c.y);
    hi.addColorStop(0, 'rgba(255,255,255,0.22)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(c.x - rr, c.y - rr, rr * 2, rr);
    ctx.restore();

    // outline
    ctx.strokeStyle = light ? 'rgba(60,48,32,0.45)' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2.5;
    this.rockPath(ctx, c.x, c.y, rr, sq);
    ctx.stroke();

    // frenzy aura
    if (Game.frenzyMult > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(224,166,60,' + (0.35 + Math.sin(this.t * 9) * 0.2) + ')';
      ctx.lineWidth = 5;
      this.rockPath(ctx, c.x, c.y, rr * 1.06, sq);
      ctx.stroke();
      ctx.restore();
    }
  },
  drawCrack(ctx) {
    const ev = Game.crack;
    if (!ev) return;
    const pulse = 0.6 + Math.sin(this.t * 8) * 0.4;
    ctx.save();
    ctx.translate(ev.x, ev.y);
    ctx.strokeStyle = 'rgba(224,166,60,' + (0.6 + pulse * 0.4) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -14); ctx.lineTo(-4, -2); ctx.lineTo(-11, 4); ctx.lineTo(3, 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 26 + pulse * 7, 0, TAU);
    ctx.strokeStyle = 'rgba(224,166,60,' + (0.30 * pulse) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },
  drawParticles(ctx, light) {
    for (const p of this.particles) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = clamp(k, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = light ? '#6d6355' : '#a2947c';
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  drawFloaters(ctx, light) {
    const accent = light ? '#5a4a2c' : '#e7dcc4';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 16px ' + this.cssVar('--font', 'system-ui, sans-serif');
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(1 - f.age / f.life, 0, 1);
      ctx.fillStyle = f.color || accent;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
};

// -----------------------------------------------------------------------------
// GAME
// -----------------------------------------------------------------------------
const Game = {
  state: null,
  settings: null,
  board: null,
  screen: 'menu',
  screenStack: [],
  lastTapAt: 0,
  idleFor: 0,
  frenzyMult: 1, frenzyLeft: 0,
  eventGpsMult: 1, eventGpsLeft: 0,
  crack: null, crackTimer: 25, crackLife: 0,
  saveTimer: 0, uiTimer: 0,
  rafLast: 0,

  init() {
    this.settings = SaveManager.loadSettings();
    this.board = SaveManager.loadBoard();
    const loaded = SaveManager.loadState();
    this.state = loaded ? this.migrate(loaded) : freshState();

    if (window.MGTheme) MGTheme.init(THEME_KEY);
    document.documentElement.setAttribute('data-reduced', this.settings.reducedMotion ? '1' : '0');

    RockView.init($('#game-canvas'));
    RockView.build(this.state.seed, this.state.era);

    UI.bind();
    UI.buildLists();
    UI.syncSettings();

    const offline = loaded ? this.applyOffline(loaded.savedAt) : null;
    UI.refreshAll();

    if (offline && (offline.grit > 0 || offline.moss > 0)) UI.showOffline(offline);

    this.rafLast = performance.now();
    requestAnimationFrame(t => this.frame(t));

    window.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      else { this.rafLast = performance.now(); }
    });
    window.addEventListener('pagehide', () => this.save());
    if (window.MGNative && MGNative.App) {
      MGNative.App.onPause(() => this.save());
      MGNative.App.onBackButton(() => UI.back());
    }
    this.registerSW();
  },

  migrate(s) {
    const base = freshState();
    const out = Object.assign(base, s);
    out.stats = Object.assign(base.stats, s.stats || {});
    out.upgrades = s.upgrades || {};
    out.mossUps = s.mossUps || {};
    out.unlockedAch = s.unlockedAch || {};
    out.era = clamp(out.era | 0, 0, ERAS.length - 1);
    return out;
  },

  // ---- offline catch-up -----------------------------------------------------
  applyOffline(savedAt) {
    const elapsed = (Date.now() - (savedAt || Date.now())) / 1000;
    if (!isFinite(elapsed) || elapsed < 60) return null;
    const gSec = Math.min(elapsed, OFFLINE_GRIT_CAP_S);
    const mSec = Math.min(elapsed, OFFLINE_MOSS_CAP_S);
    const grit = Economy.gps() * gSec * OFFLINE_EFFICIENCY;
    const moss = Economy.mossRate() * mSec * 3; // offline is always fully idle
    this.state.grit += grit;
    this.state.lifetimeGrit += grit;
    this.state.stats.allTimeGrit += grit;
    this.state.stats.idleGrit += grit;
    this.state.moss += moss;
    this.state.stats.mossEarned += moss;
    this.state.stats.maxOfflineS = Math.max(this.state.stats.maxOfflineS, Math.min(elapsed, OFFLINE_GRIT_CAP_S));
    this.checkEra(true);
    this.checkAchievements();
    return { grit, moss, elapsed };
  },

  // ---- main loop ------------------------------------------------------------
  frame(now) {
    let dt = (now - this.rafLast) / 1000;
    this.rafLast = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25); // tab-switch guard; offline handles the rest
    this.tick(dt);
    if (this.screen === 'game') { RockView.update(dt); RockView.draw(); }
    requestAnimationFrame(t => this.frame(t));
  },

  tick(dt) {
    const s = this.state;
    s.stats.playtimeS += dt;

    // timed buffs
    if (this.frenzyLeft > 0) {
      this.frenzyLeft -= dt;
      if (this.frenzyLeft <= 0) { this.frenzyLeft = 0; this.frenzyMult = 1; UI.hideEvent(); }
    }
    if (this.eventGpsLeft > 0) {
      this.eventGpsLeft -= dt;
      if (this.eventGpsLeft <= 0) { this.eventGpsLeft = 0; this.eventGpsMult = 1; UI.hideEvent(); }
    }

    // passive grit
    const gain = Economy.gps() * dt;
    if (gain > 0) {
      s.grit += gain; s.lifetimeGrit += gain;
      s.stats.allTimeGrit += gain; s.stats.idleGrit += gain;
    }

    // moss: only while genuinely left alone, ramping up the longer you wait
    this.idleFor += dt;
    if (this.idleFor > IDLE_AFTER_S) {
      const ramp = 1 + 2 * clamp((this.idleFor - IDLE_AFTER_S) / IDLE_RAMP_S, 0, 1);
      const m = Economy.mossRate() * ramp * dt;
      s.moss += m; s.stats.mossEarned += m;
      s.stats.bestIdleS = Math.max(s.stats.bestIdleS, this.idleFor);
    }

    this.tickCrack(dt);
    this.checkEra(false);

    this.saveTimer += dt;
    if (this.saveTimer >= 5) { this.saveTimer = 0; this.save(); }
    this.uiTimer += dt;
    if (this.uiTimer >= 0.2) { this.uiTimer = 0; UI.refreshLive(); }
  },

  // ---- cracks (the only twitch element) -------------------------------------
  tickCrack(dt) {
    if (this.screen !== 'game') return;
    if (this.crack) {
      this.crackLife -= dt;
      if (this.crackLife <= 0) { this.crack = null; this.scheduleCrack(); }
      return;
    }
    this.crackTimer -= dt * Economy.crackBonus();
    if (this.crackTimer <= 0) this.spawnCrack();
  },
  scheduleCrack() { this.crackTimer = 45 + Math.random() * 75; },
  spawnCrack() {
    const c = RockView.center(), r = RockView.radius() * 0.62;
    const a = Math.random() * TAU, d = Math.random() * r;
    this.crack = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.85 };
    this.crackLife = 8;
    AudioBus.tone(180, 0.5, 0.14, 'sawtooth');
    UI.showEvent('A crack opens. Tap it.');
  },
  popCrack() {
    this.crack = null;
    this.state.stats.cracks++;
    this.scheduleCrack();
    haptic('heavy');
    AudioBus.chime(440);
    const roll = Math.random();
    if (roll < 0.45) {
      const amount = Math.max(50, Economy.gps() * 90);
      this.state.grit += amount;
      this.state.lifetimeGrit += amount;
      this.state.stats.allTimeGrit += amount;
      RockView.floater(RockView.center().x, RockView.center().y - 20, '+' + fmt(amount), '#e0a63c');
      UI.showEvent('MOTHERLODE — ' + fmt(amount) + ' grit', 3.5);
    } else if (roll < 0.8) {
      this.frenzyMult = 7; this.frenzyLeft = 15;
      UI.showEvent('FRENZY — ×7 per tap for 15s', 15);
    } else {
      this.eventGpsMult = 3; this.eventGpsLeft = 30;
      UI.showEvent('LANDSLIDE — ×3 erosion for 30s', 30);
    }
    RockView.punch(RockView.center().x, RockView.center().y, true);
    this.checkAchievements();
    UI.refreshAll();
  },

  // ---- interaction ----------------------------------------------------------
  tapAt(x, y) {
    AudioBus.resume();
    AudioBus.startWind();
    if (this.crack) {
      const dx = x - this.crack.x, dy = y - this.crack.y;
      if (dx * dx + dy * dy < 44 * 44) { this.popCrack(); return; }
    }
    if (!RockView.hit(x, y)) return;

    const v = Economy.tapValue();
    this.state.grit += v;
    this.state.lifetimeGrit += v;
    this.state.stats.allTimeGrit += v;
    this.state.stats.tapGrit += v;
    this.state.stats.taps++;
    this.idleFor = 0;

    RockView.punch(x, y, false);
    RockView.floater(x, y - 18, '+' + fmt(v), this.frenzyMult > 1 ? '#e0a63c' : null);
    AudioBus.thud(260 + Math.random() * 160, this.frenzyMult > 1 ? 0.9 : 0.6);
    haptic('light');

    UI.hintSeen();
    this.checkEra(false);
    this.checkAchievements();
    UI.refreshLive();
  },

  buyUpgrade(id, qty) {
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return;
    let bought = 0, spent = 0;
    const owned0 = this.state.upgrades[id] || 0;
    for (let i = 0; i < (qty || 1); i++) {
      const cost = Economy.upgradeCost(id, owned0 + bought);
      if (this.state.grit < spent + cost) break;
      spent += cost; bought++;
    }
    if (!bought) { UI.toast('Not enough grit'); return; }
    this.state.grit -= spent;
    this.state.upgrades[id] = owned0 + bought;
    AudioBus.tone(330, 0.18, 0.2, 'triangle');
    haptic('medium');
    this.idleFor = 0;
    this.checkAchievements();
    UI.refreshAll();
  },

  buyMoss(id) {
    const def = MOSS_UPGRADES.find(u => u.id === id);
    if (!def) return;
    const lvl = this.state.mossUps[id] || 0;
    if (lvl >= def.max) { UI.toast('Already maxed'); return; }
    const cost = Economy.mossCost(id);
    if (this.state.moss < cost) { UI.toast('Not enough moss'); return; }
    this.state.moss -= cost;
    this.state.mossUps[id] = lvl + 1;
    AudioBus.chime(392);
    haptic('medium');
    this.checkAchievements();
    UI.refreshAll();
  },

  checkEra(silent) {
    let target = this.state.era;
    for (let i = ERAS.length - 1; i >= 0; i--) {
      if (this.state.lifetimeGrit >= ERAS[i].req) { target = i; break; }
    }
    if (target <= this.state.era) return;
    this.state.era = target;
    this.state.stats.bestEra = Math.max(this.state.stats.bestEra, target);
    RockView.build(this.state.seed, target);
    this.submitScores();
    this.checkAchievements();
    if (!silent) {
      AudioBus.chime(523);
      haptic('heavy');
      UI.showEra(target);
    }
    UI.refreshAll();
  },

  doPrestige() {
    const gain = Economy.prestigeGain();
    if (gain <= 0) return;
    const keepSeed = this.state.seed;
    const stats = this.state.stats;
    stats.prestiges++;
    const sediment = this.state.sediment + gain;
    const ach = this.state.unlockedAch;
    const fresh = freshState();
    fresh.seed = keepSeed + stats.prestiges;
    fresh.sediment = sediment;
    fresh.stats = stats;
    fresh.unlockedAch = ach;
    this.state = fresh;
    this.frenzyMult = 1; this.frenzyLeft = 0;
    this.eventGpsMult = 1; this.eventGpsLeft = 0;
    this.crack = null; this.scheduleCrack();
    RockView.build(fresh.seed, 0);
    AudioBus.chime(330);
    haptic('heavy');
    this.submitScores();
    this.checkAchievements();
    this.save();
    UI.refreshAll();
    UI.toast('Crumbled. +' + fmt(gain) + ' sediment');
  },

  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.state.unlockedAch[a.id]) continue;
      let ok = false;
      try { ok = a.check(this.state); } catch (e) { ok = false; }
      if (ok) {
        this.state.unlockedAch[a.id] = Date.now();
        UI.showAchievement(a);
      }
    }
  },

  // ---- scores ---------------------------------------------------------------
  submitScores() {
    const name = (window.MGIdentity && MGIdentity.name()) || 'Anonymous';
    const lifetime = Math.floor(Math.min(this.state.stats.allTimeGrit, 1e9));
    this.recordLocal('lifetime', name, lifetime, ERAS[this.state.stats.bestEra].name);
    this.recordLocal('sediment', name, Math.floor(Math.min(this.state.sediment, 1e9)), this.state.stats.prestiges + ' erosions');
    if (window.MGRemote && MGRemote.enabled()) {
      MGRemote.submit(GAME_ID, 'lifetime', { score: lifetime, name, detail: ERAS[this.state.stats.bestEra].name });
      MGRemote.submit(GAME_ID, 'sediment', { score: Math.floor(Math.min(this.state.sediment, 1e9)), name, detail: this.state.stats.prestiges + ' erosions' });
    }
  },
  recordLocal(mode, name, score, detail) {
    const list = this.board[mode] || (this.board[mode] = []);
    const uuid = (window.MGIdentity && MGIdentity.uuid()) || 'local';
    const mine = list.find(e => e.uuid === uuid);
    if (mine) { if (score > mine.score) { mine.score = score; mine.detail = detail; mine.name = name; } }
    else list.push({ uuid, name, score, detail });
    list.sort((a, b) => b.score - a.score);
    this.board[mode] = list.slice(0, 10);
    SaveManager.saveBoard(this.board);
  },

  save() {
    this.state.savedAt = Date.now();
    SaveManager.saveState(this.state);
  },

  registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
};

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------
const UI = {
  els: {},
  lbMode: 'lifetime',
  hintDone: false,
  eventTimer: null,
  achTimer: null,
  toastTimer: null,

  bind() {
    const canvas = $('#game-canvas');
    const tap = (ev) => {
      if (Game.screen !== 'game') return;
      const rect = canvas.getBoundingClientRect();
      const t = ev.changedTouches ? ev.changedTouches[0] : ev;
      Game.tapAt(t.clientX - rect.left, t.clientY - rect.top);
    };
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) { this.action(btn.getAttribute('data-action'), btn); return; }
      const tab = e.target.closest('.tabbar .tab');
      if (tab) { this.selectTab(tab.getAttribute('data-tab')); return; }
      const lb = e.target.closest('[data-lb]');
      if (lb) { this.lbMode = lb.getAttribute('data-lb'); this.renderLeaderboard(); return; }
      const th = e.target.closest('[data-theme-pref]');
      if (th && window.MGTheme) {
        MGTheme.set(th.getAttribute('data-theme-pref'), THEME_KEY);
        this.syncThemeButtons();
      }
    });

    // Space / Enter also taps the rock — keyboard players are rocks too.
    document.addEventListener('keydown', (e) => {
      if (Game.screen !== 'game') return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target && e.target.closest('button, input, a')) return;
        e.preventDefault();
        const c = RockView.center();
        Game.tapAt(c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 30);
      }
      if (e.key === 'Escape') this.back();
    });

    const grip = $('#sheet-grip');
    grip.addEventListener('click', () => $('#sheet').classList.toggle('is-collapsed'));
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#sheet').classList.toggle('is-collapsed'); }
    });

    // settings inputs
    const bindRange = (id, key, after) => {
      const el = $(id);
      el.addEventListener('input', () => {
        Game.settings[key] = el.value / 100;
        SaveManager.saveSettings(Game.settings);
        if (after) after();
      });
    };
    bindRange('#set-sfx', 'sfxVol', () => AudioBus.tone(440, 0.1, 0.2));
    bindRange('#set-music', 'musicVol', () => AudioBus.setWind(Game.settings.musicVol));
    const bindToggle = (id, key, after) => {
      const el = $(id);
      el.addEventListener('change', () => {
        Game.settings[key] = el.checked;
        SaveManager.saveSettings(Game.settings);
        if (after) after();
      });
    };
    bindToggle('#set-haptics', 'haptics');
    bindToggle('#set-colorblind', 'colorblind');
    bindToggle('#set-reducedmotion', 'reducedMotion', () => {
      document.documentElement.setAttribute('data-reduced', Game.settings.reducedMotion ? '1' : '0');
    });
    bindToggle('#set-floaters', 'floaters');

    // name entry
    const wrap = $('#name-entry-settings');
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 24; input.placeholder = 'Anonymous';
    input.value = (window.MGIdentity && MGIdentity.name()) || '';
    input.addEventListener('change', () => {
      if (window.MGIdentity) input.value = MGIdentity.setName(input.value);
    });
    wrap.appendChild(input);

    window.addEventListener('hashchange', () => this.fromHash());
    this.fromHash();
  },

  action(name, el) {
    switch (name) {
      case 'play': this.go('game'); AudioBus.resume(); AudioBus.startWind(); break;
      case 'back-menu': Game.save(); this.go('menu'); break;
      case 'back': this.back(); break;
      case 'go-leaderboard': this.go('leaderboard'); this.renderLeaderboard(); break;
      case 'go-settings': this.go('settings'); break;
      case 'go-howto': this.go('howto'); break;
      case 'go-credits': this.go('credits'); break;
      case 'buy': Game.buyUpgrade(el.getAttribute('data-id'), 1); break;
      case 'buy-moss': Game.buyMoss(el.getAttribute('data-id')); break;
      case 'prestige': this.openPrestige(); break;
      case 'prestige-confirm': $('#overlay-prestige').hidden = true; Game.doPrestige(); break;
      case 'prestige-cancel': $('#overlay-prestige').hidden = true; break;
      case 'close-offline': $('#overlay-offline').hidden = true; break;
      case 'close-era': $('#overlay-era').hidden = true; break;
      case 'share-score': this.share(); break;
      case 'wipe': this.wipe(); break;
    }
  },

  // ---- routing --------------------------------------------------------------
  go(screen) {
    if (Game.screen !== screen) this.screenStack.push(Game.screen);
    this.show(screen);
    location.hash = screen === 'menu' ? '' : '#' + screen;
  },
  back() {
    const prev = this.screenStack.pop() || 'menu';
    this.show(prev);
    location.hash = prev === 'menu' ? '' : '#' + prev;
  },
  show(screen) {
    Game.screen = screen;
    $$('.screen').forEach(s => { s.hidden = s.getAttribute('data-screen') !== screen; });
    if (screen === 'game') { RockView.resize(); this.refreshAll(); }
    else if (RockView.ctx) RockView.ctx.clearRect(0, 0, RockView.w, RockView.h);
    if (screen === 'menu') this.refreshMenu();
  },
  fromHash() {
    const h = (location.hash || '').replace('#', '');
    const valid = ['game', 'leaderboard', 'settings', 'howto', 'credits'];
    this.show(valid.indexOf(h) >= 0 ? h : 'menu');
  },
  get screenStack() { return Game.screenStack; },
  set screenStack(v) { Game.screenStack = v; },

  // ---- list building --------------------------------------------------------
  buildLists() {
    const up = $('#upgrade-list');
    up.innerHTML = '';
    for (const u of UPGRADES) {
      const b = document.createElement('button');
      b.className = 'item';
      b.type = 'button';
      b.setAttribute('data-action', 'buy');
      b.setAttribute('data-id', u.id);
      b.innerHTML =
        '<span class="glyph">' + u.glyph + '</span>' +
        '<span><span class="name"></span><span class="sub"></span></span>' +
        '<span class="buy"><span class="cost"></span><span class="owned"></span></span>';
      up.appendChild(b);
    }
    const mo = $('#moss-list');
    mo.innerHTML = '';
    for (const m of MOSS_UPGRADES) {
      const b = document.createElement('button');
      b.className = 'item';
      b.type = 'button';
      b.setAttribute('data-action', 'buy-moss');
      b.setAttribute('data-id', m.id);
      b.innerHTML =
        '<span class="glyph">' + m.glyph + '</span>' +
        '<span><span class="name"></span><span class="sub"></span></span>' +
        '<span class="buy"><span class="cost"></span><span class="owned"></span></span>';
      mo.appendChild(b);
    }
    const eras = $('#era-list');
    eras.innerHTML = '';
    ERAS.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'era-row';
      row.setAttribute('data-era', String(i));
      row.innerHTML =
        '<span class="glyph">' + (i === 0 ? '•' : i < 3 ? '▫' : i < 6 ? '◆' : '⬢') + '</span>' +
        '<span><span class="era-name">' + e.name + '</span><span class="era-req">' +
        (i === 0 ? 'starting form' : fmt(e.req) + ' lifetime grit') + '</span></span>' +
        '<span class="era-x">×' + e.mult + '</span>';
      eras.appendChild(row);
    });
    const ach = $('#ach-list');
    ach.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const d = document.createElement('div');
      d.className = 'ach';
      d.setAttribute('data-ach', a.id);
      d.innerHTML = '<span class="a-icon">' + a.icon + '</span><span class="a-name">' + a.name + '</span>';
      ach.appendChild(d);
    }
  },

  selectTab(tab) {
    $$('.tabbar .tab').forEach(t => {
      const on = t.getAttribute('data-tab') === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + tab));
    $('#sheet').classList.remove('is-collapsed');
    this.refreshAll();
  },

  // ---- refresh --------------------------------------------------------------
  refreshLive() {
    if (Game.screen !== 'game') return;
    const s = Game.state;
    $('#hud-grit').textContent = fmt(s.grit);
    $('#hud-gps').textContent = fmt(Economy.gps());
    $('#hud-moss').textContent = fmt(s.moss);
    $('#hud-era').textContent = ERAS[s.era].name;
    const mult = Economy.eraMult() * Economy.sedimentMult() * Economy.mossBonus('gps');
    $('#hud-mult').textContent = '×' + fmt(mult);
    this.refreshAffordability();
  },
  refreshAffordability() {
    const listOn = $('#panel-erosion').classList.contains('is-active');
    if (listOn) {
      for (const u of UPGRADES) {
        const el = $('.item[data-id="' + u.id + '"][data-action="buy"]');
        if (!el || el.hidden) continue;
        const cost = Economy.upgradeCost(u.id);
        const can = Game.state.grit >= cost;
        el.disabled = !can;
        el.classList.toggle('affordable', can);
      }
    }
    if ($('#panel-moss').classList.contains('is-active')) {
      for (const m of MOSS_UPGRADES) {
        const el = $('.item[data-id="' + m.id + '"][data-action="buy-moss"]');
        if (!el) continue;
        const lvl = Game.state.mossUps[m.id] || 0;
        const maxed = lvl >= m.max;
        const can = !maxed && Game.state.moss >= Economy.mossCost(m.id);
        el.disabled = !can;
        el.classList.toggle('affordable', can);
        el.classList.toggle('maxed', maxed);
      }
    }
  },
  refreshAll() {
    if (Game.screen === 'menu') { this.refreshMenu(); return; }
    if (Game.screen !== 'game') return;
    const s = Game.state;

    for (const u of UPGRADES) {
      const el = $('.item[data-id="' + u.id + '"][data-action="buy"]');
      if (!el) continue;
      const owned = s.upgrades[u.id] || 0;
      const revealed = owned > 0 || s.lifetimeGrit >= u.unlock;
      el.hidden = !revealed;
      if (!revealed) continue;
      const cost = Economy.upgradeCost(u.id);
      const each = u.rate * Economy.eraMult() * Economy.sedimentMult() * Economy.mossBonus('gps');
      el.querySelector('.name').textContent = u.name;
      el.querySelector('.sub').textContent = fmt(each) + '/s each · ' + u.desc;
      el.querySelector('.cost').textContent = fmt(cost);
      el.querySelector('.owned').textContent = owned ? owned + ' owned · ' + fmt(owned * each) + '/s' : 'none yet';
    }

    for (const m of MOSS_UPGRADES) {
      const el = $('.item[data-id="' + m.id + '"][data-action="buy-moss"]');
      if (!el) continue;
      const lvl = s.mossUps[m.id] || 0;
      const maxed = lvl >= m.max;
      el.querySelector('.name').textContent = m.name;
      el.querySelector('.sub').textContent = m.desc;
      el.querySelector('.cost').textContent = maxed ? 'MAX' : fmt(Economy.mossCost(m.id)) + ' moss';
      el.querySelector('.owned').textContent = 'lvl ' + lvl + '/' + m.max;
    }

    $$('.era-row').forEach(row => {
      const i = +row.getAttribute('data-era');
      row.classList.toggle('is-current', i === s.era);
      row.classList.toggle('is-locked', i > s.era);
    });

    const gain = Economy.prestigeGain();
    $('#prestige-have').textContent = fmt(s.sediment);
    $('#prestige-gain').textContent = fmt(gain);
    $('#prestige-bonus').textContent = '×' + (1 + (s.sediment + gain) * 0.02).toFixed(2);
    const pb = $('#btn-prestige');
    pb.disabled = gain <= 0;
    pb.textContent = gain > 0 ? 'ERODE FOR ' + fmt(gain) : 'NEED ' + fmt(PRESTIGE_MIN) + ' LIFETIME GRIT';
    $('#prestige-desc').textContent = gain > 0
      ? 'Crumble everything back to gravel. Sediment is permanent: +2% to everything, forever, per point.'
      : 'You are not worn down enough yet. Keep eroding.';

    this.renderStats();
    for (const a of ACHIEVEMENTS) {
      const el = $('.ach[data-ach="' + a.id + '"]');
      if (el) el.classList.toggle('unlocked', !!s.unlockedAch[a.id]);
    }
    this.refreshLive();
  },
  renderStats() {
    const s = Game.state, st = s.stats;
    const rows = [
      ['Grit right now', fmt(s.grit)],
      ['Lifetime grit (this run)', fmt(s.lifetimeGrit)],
      ['Grit ever, all runs', fmt(st.allTimeGrit)],
      ['Per second', fmt(Economy.gps())],
      ['Per tap', fmt(Economy.tapValue())],
      ['Taps', fmt(st.taps)],
      ['Grit from taps', fmt(st.tapGrit)],
      ['Grit from erosion', fmt(st.idleGrit)],
      ['Moss ever grown', fmt(st.mossEarned)],
      ['Longest quiet spell', fmtTime(st.bestIdleS)],
      ['Cracks caught', fmt(st.cracks)],
      ['Sediment', fmt(s.sediment) + '  (×' + Economy.sedimentMult().toFixed(2) + ')'],
      ['Erosions (prestiges)', fmt(st.prestiges)],
      ['Highest era', ERAS[st.bestEra].name],
      ['Time being a rock', fmtTime(st.playtimeS)]
    ];
    const wrap = $('#stat-list');
    wrap.innerHTML = rows.map(r =>
      '<div class="item"><span class="name">' + r[0] + '</span><span class="cost">' + r[1] + '</span></div>'
    ).join('');
  },
  refreshMenu() {
    const s = Game.state;
    $('#menu-era-line').textContent = ERAS[s.era].name + ' · ' + fmt(s.grit) + ' grit' +
      (s.sediment > 0 ? ' · ' + fmt(s.sediment) + ' sediment' : '');
  },

  hintSeen() {
    if (this.hintDone) return;
    this.hintDone = true;
    const h = $('#tap-hint');
    if (h) h.hidden = true;
  },

  // ---- transient UI ---------------------------------------------------------
  showEvent(text, seconds) {
    const el = $('#event-banner');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.eventTimer);
    this.eventTimer = setTimeout(() => { el.hidden = true; }, (seconds || 8) * 1000);
  },
  hideEvent() { $('#event-banner').hidden = true; },
  showAchievement(a) {
    const el = $('#overlay-achievement');
    $('#ach-name').textContent = a.name;
    el.hidden = false;
    AudioBus.chime(587);
    clearTimeout(this.achTimer);
    this.achTimer = setTimeout(() => { el.hidden = true; }, 2600);
  },
  toast(msg) {
    const el = $('#overlay-toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, 1600);
  },
  showOffline(o) {
    $('#offline-time').textContent = 'You were gone ' + fmtTime(o.elapsed);
    $('#offline-grit').textContent = '+' + fmt(o.grit);
    $('#offline-moss').textContent = '+' + fmt(o.moss);
    $('#offline-quip').textContent = pick(OFFLINE_QUIPS);
    $('#overlay-offline').hidden = false;
  },
  showEra(i) {
    $('#era-big').textContent = ERAS[i].name;
    $('#era-quip').textContent = ERAS[i].quip;
    $('#era-mult').textContent = '×' + ERAS[i].mult;
    $('#overlay-era').hidden = false;
  },
  openPrestige() {
    const gain = Economy.prestigeGain();
    if (gain <= 0) { this.toast('Not eroded enough yet'); return; }
    $('#confirm-gain').textContent = fmt(gain);
    $('#confirm-bonus').textContent = '×' + (1 + (Game.state.sediment + gain) * 0.02).toFixed(2);
    $('#overlay-prestige').hidden = false;
  },
  wipe() {
    if (!window.confirm('Wipe your rock and every bit of progress? This cannot be undone.')) return;
    SaveManager.wipe();
    Game.state = freshState();
    Game.board = { lifetime: [], sediment: [] };
    RockView.build(Game.state.seed, 0);
    this.refreshAll();
    this.toast('Back to gravel');
  },

  // ---- leaderboard ----------------------------------------------------------
  async renderLeaderboard() {
    $$('[data-lb]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-lb') === this.lbMode));
    const wrap = $('#leaderboard-content');
    const local = (Game.board[this.lbMode] || []).slice();
    const uuid = (window.MGIdentity && MGIdentity.uuid()) || 'local';
    let rows = local.map(e => ({ name: e.name || 'Anonymous', score: e.score, detail: e.detail, mine: e.uuid === uuid }));
    let source = 'Local scores only.';

    if (window.MGRemote && MGRemote.enabled()) {
      wrap.innerHTML = '<p class="lb-empty">Loading global scores…</p>';
      try {
        const remote = await MGRemote.top(GAME_ID, this.lbMode, { limit: 10 });
        if (remote && remote.length) {
          rows = remote.map(e => ({
            name: e.display_name || 'Anonymous', score: e.score, detail: e.detail, mine: e.player_id === uuid
          }));
          source = 'Global top 10.';
        }
      } catch (e) { /* fall through to local */ }
    }

    if (!rows.length) {
      wrap.innerHTML = '<p class="lb-empty">No scores yet.<br>Go be a rock for a while.</p>';
      return;
    }
    wrap.innerHTML = rows.map((r, i) =>
      '<div class="lb-row' + (r.mine ? ' is-you' : '') + '">' +
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-name">' + escapeHtml(r.name) + (r.detail ? ' <span style="opacity:.55;font-size:11px">' + escapeHtml(r.detail) + '</span>' : '') + '</span>' +
        '<span class="lb-score">' + fmt(r.score) + '</span>' +
      '</div>'
    ).join('') + '<p class="lb-empty">' + source + '</p>';
  },

  share() {
    if (!window.MGShare) { this.toast('Sharing unavailable'); return; }
    MGShare.share({
      gameTitle: 'Rock Simulator',
      subtitle: ERAS[Game.state.era].name + ' · ' + fmt(Game.state.sediment) + ' sediment',
      score: fmt(Game.state.stats.allTimeGrit),
      name: (window.MGIdentity && MGIdentity.name()) || 'Anonymous',
      detail: fmt(Economy.gps()) + ' grit/sec while doing nothing',
      bg1: '#0d0b09', bg2: '#3a2f22', accent: '#d9c7a3',
      url: 'https://minigames.6x7.gr/rock-simulator/'
    }).catch(() => {});
  },

  syncSettings() {
    $('#set-sfx').value = Math.round(Game.settings.sfxVol * 100);
    $('#set-music').value = Math.round(Game.settings.musicVol * 100);
    $('#set-haptics').checked = !!Game.settings.haptics;
    $('#set-colorblind').checked = !!Game.settings.colorblind;
    $('#set-reducedmotion').checked = !!Game.settings.reducedMotion;
    $('#set-floaters').checked = !!Game.settings.floaters;
    this.syncThemeButtons();
  },
  syncThemeButtons() {
    if (!window.MGTheme) return;
    const cur = MGTheme.get(THEME_KEY);
    $$('[data-theme-pref]').forEach(b => {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-pref') === cur ? 'true' : 'false');
    });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => Game.init());
