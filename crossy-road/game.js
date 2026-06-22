/* Crossy Hop — vanilla JS canvas game */
(function () {
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const NS = 'crossy-hop:v1:';
const TILE_W = 64;            // logical tile width
const TILE_H = 40;            // logical tile depth (faux-iso)
const TILES_X = 9;            // tiles across (visible)
const HALF_X = 4;             // center column index
const HOP_MS = 130;
const FALLBEHIND_MS = 2000;
const DAILY_LEN = 50;

const LANE_GRASS = 'grass';
const LANE_ROAD = 'road';
const LANE_WATER = 'water';
const LANE_RAIL = 'rail';
const LANE_ICE = 'ice';

const CHARACTERS = [
  { id: 'chick', name: 'Chick', cost: 0, palette: { body: '#ffe066', accent: '#ff9b3d', eye: '#222' } },
  { id: 'pup',   name: 'Pup',   cost: 100, palette: { body: '#c69060', accent: '#5a3a1e', eye: '#222' } },
  { id: 'frog',  name: 'Frog',  cost: 150, palette: { body: '#69d34a', accent: '#2a7d2a', eye: '#fff' } },
  { id: 'robot', name: 'Robot', cost: 250, palette: { body: '#b9c4d1', accent: '#4a566a', eye: '#4ec0ff' } },
  { id: 'ninja', name: 'Ninja', cost: 300, palette: { body: '#3a3f4f', accent: '#1b1f2a', eye: '#ff5a5f' } },
  { id: 'astro', name: 'Astro', cost: 400, palette: { body: '#f5f5fa', accent: '#5a6dff', eye: '#4ec0ff' } },
  { id: 'vamp',  name: 'Vamp',  cost: 350, palette: { body: '#9f6bd1', accent: '#4b1f6a', eye: '#ff5a5f' } },
  { id: 'panda', name: 'Panda', cost: 500, palette: { body: '#f0f0f0', accent: '#1a1a1a', eye: '#222' } },
];

// ============================================================
// SAFE STORAGE
// ============================================================
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); }
    catch (e) { /* quota / private mode */ }
  },
};

// ============================================================
// SAVE MANAGER
// ============================================================
const SaveManager = {
  settings: null,
  unlocks: null,
  coins: 0,
  bestScore: 0,
  selectedChar: 'chick',
  leaderboard: null,
  playerName: 'YOU',

  load() {
    this.settings = Object.assign({
      sfxVol: 70, musicVol: 40, musicOn: false,
      haptics: true, colorblind: false, reducedMotion: false,
    }, Store.get('settings', {}));
    this.unlocks = Object.assign({ characters: ['chick'] }, Store.get('unlocks', {}));
    this.coins = Store.get('coins', 0);
    this.bestScore = Store.get('bestScore', 0);
    this.selectedChar = Store.get('selectedChar', 'chick');
    this.leaderboard = Object.assign({ classic: [], daily: {}, zen: [] }, Store.get('leaderboard', {}));
    this.playerName = Store.get('playerName', 'YOU');
  },
  saveSettings() { Store.set('settings', this.settings); },
  saveUnlocks() { Store.set('unlocks', this.unlocks); },
  saveCoins() { Store.set('coins', this.coins); },
  saveBest() { Store.set('bestScore', this.bestScore); },
  saveSelected() { Store.set('selectedChar', this.selectedChar); },
  saveLeaderboard() { Store.set('leaderboard', this.leaderboard); },
  savePlayerName() { Store.set('playerName', this.playerName); },

  hasChar(id) { return this.unlocks.characters.indexOf(id) >= 0; },
  unlockChar(id) {
    if (!this.hasChar(id)) {
      this.unlocks.characters.push(id);
      this.saveUnlocks();
    }
  },
  addCoins(n) { this.coins = Math.max(0, this.coins + n); this.saveCoins(); },
  trySpend(n) {
    if (this.coins < n) return false;
    this.coins -= n; this.saveCoins(); return true;
  },
};

// ============================================================
// SEEDED RNG (mulberry32)
// ============================================================
function seedFromDate(d) {
  const s = d.getUTCFullYear() * 10000 + (d.getUTCMonth()+1) * 100 + d.getUTCDate();
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// AUDIO BUS
// ============================================================
const AudioBus = {
  ctx: null, master: null, sfx: null, music: null, musicNode: null, musicOn: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = SaveManager.settings.sfxVol / 100;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = SaveManager.settings.musicVol / 100;
      this.music.connect(this.master);
    } catch (e) { /* no audio */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setSfxVol(v) { if (this.sfx) this.sfx.gain.value = v / 100; },
  setMusicVol(v) { if (this.music) this.music.gain.value = v / 100; },

  beep(opts) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.value = opts.freq || 440;
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + (opts.dur || 0.1));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.dur || 0.1));
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + (opts.dur || 0.1) + 0.02);
  },
  noise(opts) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = opts.dur || 0.2;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.value = opts.cutoff || 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t); src.stop(t + dur + 0.02);
  },

  hop()       { this.beep({ type: 'square', freq: 600, freqEnd: 880, dur: 0.07, vol: 0.12 }); },
  coin()      { this.beep({ type: 'square', freq: 880, dur: 0.06, vol: 0.16 });
                setTimeout(() => this.beep({ type: 'square', freq: 1320, dur: 0.08, vol: 0.16 }), 60); },
  splash()    { this.noise({ filter: 'lowpass', cutoff: 600, dur: 0.35, vol: 0.3 }); },
  carHorn()   { this.beep({ type: 'sawtooth', freq: 220, dur: 0.25, vol: 0.15 }); },
  train()     { this.beep({ type: 'triangle', freq: 180, freqEnd: 120, dur: 0.5, vol: 0.2 }); },
  death()     { this.beep({ type: 'sawtooth', freq: 220, freqEnd: 60, dur: 0.5, vol: 0.2 });
                this.noise({ cutoff: 400, dur: 0.4, vol: 0.2 }); },
  unlock()    { this.beep({ type: 'square', freq: 660, dur: 0.1, vol: 0.15 });
                setTimeout(() => this.beep({ type: 'square', freq: 880, dur: 0.1, vol: 0.15 }), 100);
                setTimeout(() => this.beep({ type: 'square', freq: 1320, dur: 0.15, vol: 0.15 }), 220); },

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const t = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 110.4;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.2;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 200;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 4;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    const g = this.ctx.createGain(); g.gain.value = 0.04;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.music);
    o1.start(t); o2.start(t); lfo.start(t);
    this.musicNode = { o1: o1, o2: o2, lfo: lfo, g: g };
  },
  stopMusic() {
    if (!this.musicNode) { this.musicOn = false; return; }
    try {
      const t = this.ctx.currentTime;
      this.musicNode.g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
      this.musicNode.o1.stop(t + 0.35);
      this.musicNode.o2.stop(t + 0.35);
      this.musicNode.lfo.stop(t + 0.35);
    } catch (e) {}
    this.musicNode = null; this.musicOn = false;
  },
};

// ============================================================
// PARTICLE SYSTEM
// ============================================================
function ParticleSystem() {
  this.parts = [];
}
ParticleSystem.prototype.spawn = function (x, y, n, opts) {
  opts = opts || {};
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (opts.speed || 80) * (0.5 + Math.random() * 0.8);
    this.parts.push({
      x: x, y: y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (opts.up || 0),
      life: opts.life || 0.6,
      maxLife: opts.life || 0.6,
      color: opts.color || '#ffd23f',
      size: opts.size || 3,
      gravity: opts.gravity == null ? 200 : opts.gravity,
    });
  }
};
ParticleSystem.prototype.update = function (dt) {
  for (let i = this.parts.length - 1; i >= 0; i--) {
    const p = this.parts[i];
    p.life -= dt;
    if (p.life <= 0) { this.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.gravity * dt;
  }
};
ParticleSystem.prototype.render = function (ctx) {
  for (let i = 0; i < this.parts.length; i++) {
    const p = this.parts[i];
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
};
ParticleSystem.prototype.clear = function () { this.parts.length = 0; };

// ============================================================
// WORLD / LANES
// ============================================================
function Lane(type, row, opts) {
  opts = opts || {};
  this.type = type;
  this.row = row;          // tile-row index (0 = start, increases forward)
  this.entities = [];      // vehicles, floaters, coins, trees
  this.dir = opts.dir || (Math.random() < 0.5 ? -1 : 1);
  this.speed = opts.speed || 0;
  this.spawnTimer = 0;
  this.spawnEvery = opts.spawnEvery || 2;
  this.warning = 0;        // for train warning flash
  this.trainTimer = opts.trainTimer || 0;
  this.trainPending = false;
  this.iceObstacleCols = opts.iceObstacleCols || [];
  this.coin = opts.coin || null;
  this.tree = opts.tree || null;   // for grass
  this.lilyCols = opts.lilyCols || null; // for water if no logs
}

function World(opts) {
  opts = opts || {};
  this.mode = opts.mode || 'classic';   // classic | daily | zen
  this.rng = opts.rng || Math.random;
  this.lanes = [];
  this.tickets = 0;     // unique entity ids
  this.farthestRow = 0;
  this.spawnCursor = 0;
  this.bootRows();
}

World.prototype.nextId = function () { this.tickets++; return this.tickets; };

World.prototype.bootRows = function () {
  // first chunk: safe grass starting area
  for (let r = -3; r <= 8; r++) {
    this.lanes.push(this.makeLane(r, true));
  }
  this.spawnCursor = 9;
};

World.prototype.makeLane = function (row, forceGrass) {
  const r = this.rng;
  if (forceGrass || row < 4) return new Lane(LANE_GRASS, row, {});

  // pick lane type based on difficulty (row)
  const diff = Math.min(1, row / 80);
  let types;
  if (this.mode === 'zen') {
    types = [
      { t: LANE_GRASS, w: 5 },
      { t: LANE_WATER, w: 2 },
    ];
  } else {
    types = [
      { t: LANE_GRASS, w: 4 },
      { t: LANE_ROAD,  w: 3 + diff * 3 },
      { t: LANE_WATER, w: row >= 10 ? 2 + diff : 0 },
      { t: LANE_RAIL,  w: row >= 30 ? 1 + diff : 0 },
      { t: LANE_ICE,   w: row >= 50 ? 1 : 0 },
    ];
  }

  // avoid stacking too many fast lanes back-to-back: if last 2 lanes were road/rail, prefer grass
  const last = this.lanes[this.lanes.length - 1];
  const last2 = this.lanes[this.lanes.length - 2];
  if (last && last2 && (last.type === LANE_ROAD || last.type === LANE_RAIL) &&
      (last2.type === LANE_ROAD || last2.type === LANE_RAIL)) {
    return new Lane(LANE_GRASS, row, {});
  }

  let total = 0; for (let i = 0; i < types.length; i++) total += types[i].w;
  let pick = r() * total;
  let chosen = LANE_GRASS;
  for (let i = 0; i < types.length; i++) {
    pick -= types[i].w;
    if (pick <= 0) { chosen = types[i].t; break; }
  }

  return this.configureLane(chosen, row, diff);
};

World.prototype.configureLane = function (type, row, diff) {
  const r = this.rng;
  if (type === LANE_GRASS) {
    const lane = new Lane(LANE_GRASS, row, {});
    // sometimes spawn 1-3 trees (don't block all columns)
    if (r() < 0.55) {
      const count = 1 + Math.floor(r() * 3);
      const usedCols = {};
      for (let i = 0; i < count; i++) {
        const c = Math.floor(r() * TILES_X);
        usedCols[c] = true;
      }
      // ensure at least one open column
      let open = 0; for (let c = 0; c < TILES_X; c++) if (!usedCols[c]) open++;
      if (open === 0) delete usedCols[Math.floor(r() * TILES_X)];
      lane.tree = usedCols;
    }
    if (r() < 0.18) {
      lane.coin = { col: Math.floor(r() * TILES_X), taken: false };
    }
    return lane;
  }
  if (type === LANE_ROAD) {
    const speed = 60 + r() * 80 + diff * 60;
    const lane = new Lane(LANE_ROAD, row, {
      dir: r() < 0.5 ? -1 : 1,
      speed: speed,
      spawnEvery: 1.0 + r() * 2.5 - diff * 0.4,
    });
    return lane;
  }
  if (type === LANE_WATER) {
    const speed = 30 + r() * 60;
    const lane = new Lane(LANE_WATER, row, {
      dir: r() < 0.5 ? -1 : 1,
      speed: speed,
      spawnEvery: 1.8 + r() * 1.6,
    });
    // pre-seed some floaters
    for (let i = 0; i < 3; i++) {
      const len = 2 + Math.floor(r() * 2);
      lane.entities.push({
        id: this.nextId(),
        kind: 'log',
        x: r() * (TILES_X + 4) * TILE_W - 2 * TILE_W,
        len: len,
      });
    }
    return lane;
  }
  if (type === LANE_RAIL) {
    const lane = new Lane(LANE_RAIL, row, {
      dir: r() < 0.5 ? -1 : 1,
      speed: 320 + r() * 60,
      spawnEvery: 4 + r() * 3,
    });
    lane.trainTimer = 2 + r() * 3;
    return lane;
  }
  if (type === LANE_ICE) {
    const lane = new Lane(LANE_ICE, row, {});
    // a couple of obstacle blocks
    if (r() < 0.7) {
      const cols = {};
      cols[Math.floor(r() * TILES_X)] = true;
      lane.iceObstacleCols = cols;
    }
    return lane;
  }
  return new Lane(LANE_GRASS, row, {});
};

World.prototype.ensureLanesAhead = function (frontRow, hopperRow) {
  while (this.spawnCursor <= frontRow + 14) {
    this.lanes.push(this.makeLane(this.spawnCursor, false));
    this.spawnCursor++;
  }
  // trim far behind — never trim hopper's vicinity (±8 rows)
  const safeKeep = (hopperRow != null) ? hopperRow - 8 : frontRow - 14;
  const trimBefore = Math.min(frontRow - 14, safeKeep);
  while (this.lanes.length && this.lanes[0].row < trimBefore) {
    this.lanes.shift();
  }
};

World.prototype.getLane = function (row) {
  // lanes are sequential by row; linear scan is fine for small visible window
  for (let i = 0; i < this.lanes.length; i++) {
    if (this.lanes[i].row === row) return this.lanes[i];
  }
  return null;
};

World.prototype.update = function (dt) {
  for (let i = 0; i < this.lanes.length; i++) {
    const lane = this.lanes[i];

    if (lane.type === LANE_ROAD) {
      lane.spawnTimer -= dt;
      if (lane.spawnTimer <= 0) {
        lane.spawnTimer = lane.spawnEvery;
        const kind = this.rng() < 0.3 ? 'truck' : 'car';
        const len = kind === 'truck' ? 2 : 1;
        const startX = lane.dir > 0 ? -TILE_W * (len + 1) : (TILES_X + 1) * TILE_W;
        lane.entities.push({
          id: this.nextId(), kind: kind, x: startX, len: len,
          color: pickCarColor(this.rng),
        });
      }
      for (let j = lane.entities.length - 1; j >= 0; j--) {
        const e = lane.entities[j];
        e.x += lane.dir * lane.speed * dt;
        if (lane.dir > 0 && e.x > (TILES_X + 2) * TILE_W) lane.entities.splice(j, 1);
        else if (lane.dir < 0 && e.x < -TILE_W * (e.len + 2)) lane.entities.splice(j, 1);
      }
    } else if (lane.type === LANE_WATER) {
      lane.spawnTimer -= dt;
      if (lane.spawnTimer <= 0) {
        lane.spawnTimer = lane.spawnEvery;
        const len = 2 + Math.floor(this.rng() * 2);
        const startX = lane.dir > 0 ? -TILE_W * (len + 1) : (TILES_X + 1) * TILE_W;
        lane.entities.push({
          id: this.nextId(), kind: 'log', x: startX, len: len,
        });
      }
      for (let j = lane.entities.length - 1; j >= 0; j--) {
        const e = lane.entities[j];
        e.x += lane.dir * lane.speed * dt;
        if (lane.dir > 0 && e.x > (TILES_X + 2) * TILE_W) lane.entities.splice(j, 1);
        else if (lane.dir < 0 && e.x < -TILE_W * (e.len + 2)) lane.entities.splice(j, 1);
      }
    } else if (lane.type === LANE_RAIL) {
      lane.trainTimer -= dt;
      if (lane.trainTimer <= 0 && !lane.trainPending) {
        lane.trainPending = true;
        lane.warning = 1.5;
      }
      if (lane.warning > 0) {
        lane.warning -= dt;
        if (lane.warning <= 0 && lane.trainPending) {
          // spawn train
          const startX = lane.dir > 0 ? -TILE_W * 6 : (TILES_X + 1) * TILE_W;
          lane.entities.push({
            id: this.nextId(), kind: 'train', x: startX, len: 5,
          });
          lane.trainPending = false;
          lane.trainTimer = lane.spawnEvery + this.rng() * 2;
        }
      }
      for (let j = lane.entities.length - 1; j >= 0; j--) {
        const e = lane.entities[j];
        e.x += lane.dir * lane.speed * dt;
        if (lane.dir > 0 && e.x > (TILES_X + 2) * TILE_W) lane.entities.splice(j, 1);
        else if (lane.dir < 0 && e.x < -TILE_W * (e.len + 2)) lane.entities.splice(j, 1);
      }
    }
  }
};

function pickCarColor(rng) {
  const colors = ['#ff5a5f', '#4ec0ff', '#41c46b', '#ffd23f', '#b18cff', '#ff8a3c'];
  return colors[Math.floor(rng() * colors.length)];
}

// ============================================================
// HOPPER (character)
// ============================================================
function Hopper(charId) {
  this.col = HALF_X;
  this.row = 0;
  this.x = HALF_X * TILE_W;
  this.y = 0;
  this.targetX = this.x;
  this.targetY = this.y;
  this.hopT = 0;        // 0..1 progress
  this.hopping = false;
  this.dead = false;
  this.facing = 0;      // 0 forward, 1 right, 2 back, 3 left
  this.charId = charId || 'chick';
  this.onLog = null;
  this.iceVel = 0;      // for ice sliding direction (col delta queue)
  this.iceQueue = [];   // pending tile moves on ice
  this.lastRow = 0;
}

Hopper.prototype.startHop = function (dCol, dRow, facing) {
  if (this.hopping || this.dead) return;
  this.targetCol = this.col + dCol;
  this.targetRow = this.row + dRow;
  this.targetX = this.targetCol * TILE_W;
  this.targetY = this.targetRow * TILE_H;
  this.hopFromX = this.x;
  this.hopFromY = this.y;
  this.hopT = 0;
  this.hopping = true;
  this.facing = facing;
};

Hopper.prototype.update = function (dt) {
  if (this.hopping) {
    this.hopT += dt * 1000 / HOP_MS;
    if (this.hopT >= 1) {
      this.hopT = 1;
      this.hopping = false;
      this.col = this.targetCol;
      this.row = this.targetRow;
      this.x = this.targetX;
      this.y = this.targetY;
    } else {
      this.x = this.hopFromX + (this.targetX - this.hopFromX) * this.hopT;
      this.y = this.hopFromY + (this.targetY - this.hopFromY) * this.hopT;
    }
  }
};

// ============================================================
// CHARACTER RENDERING (cube)
// ============================================================
function drawCube(ctx, cx, cy, size, pal, t, facing) {
  // cx,cy = bottom-center anchor in screen space; size = cube width
  const s = size;
  const h = s * 1.1;
  // hop bounce
  const bob = Math.sin(t * Math.PI) * 0.15 * s;
  cy -= bob;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // body cube — drawn as three faces
  const top = pal.body;
  const right = shade(pal.body, -0.18);
  const front = shade(pal.body, -0.32);
  // front face
  ctx.fillStyle = front;
  ctx.fillRect(cx - s/2, cy - h, s, h);
  // right face (slanted)
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(cx + s/2, cy - h);
  ctx.lineTo(cx + s/2 + s*0.2, cy - h - s*0.15);
  ctx.lineTo(cx + s/2 + s*0.2, cy - s*0.15);
  ctx.lineTo(cx + s/2, cy);
  ctx.closePath();
  ctx.fill();
  // top face
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(cx - s/2, cy - h);
  ctx.lineTo(cx - s/2 + s*0.2, cy - h - s*0.15);
  ctx.lineTo(cx + s/2 + s*0.2, cy - h - s*0.15);
  ctx.lineTo(cx + s/2, cy - h);
  ctx.closePath();
  ctx.fill();
  // accent crown (top stripe)
  ctx.fillStyle = pal.accent;
  ctx.fillRect(cx - s*0.35, cy - h + s*0.08, s*0.7, s*0.1);
  // eyes (front face)
  ctx.fillStyle = pal.eye;
  const eyeY = cy - h * 0.55;
  ctx.fillRect(cx - s*0.22, eyeY, s*0.12, s*0.12);
  ctx.fillRect(cx + s*0.10, eyeY, s*0.12, s*0.12);
}

function drawCharacterFeatures(ctx, cx, cy, size, charId, t) {
  // little per-character flair
  const idleBob = Math.sin(t * 2) * 2;
  if (charId === 'chick') {
    // beak triangle
    ctx.fillStyle = '#ff9b3d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.55 + idleBob);
    ctx.lineTo(cx - size * 0.1, cy - size * 0.4 + idleBob);
    ctx.lineTo(cx + size * 0.1, cy - size * 0.4 + idleBob);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 'frog') {
    // bigger eye bumps on top
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - size*0.2, cy - size*1.18, size*0.13, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size*0.2, cy - size*1.18, size*0.13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - size*0.2, cy - size*1.18, size*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size*0.2, cy - size*1.18, size*0.06, 0, Math.PI*2); ctx.fill();
  } else if (charId === 'robot') {
    // antenna
    ctx.strokeStyle = '#4a566a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy - size*1.1); ctx.lineTo(cx, cy - size*1.35); ctx.stroke();
    ctx.fillStyle = '#ff5a5f';
    ctx.beginPath(); ctx.arc(cx, cy - size*1.4, size*0.07, 0, Math.PI*2); ctx.fill();
  } else if (charId === 'ninja') {
    // mask band
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(cx - size*0.5, cy - size*0.7, size, size*0.12);
  } else if (charId === 'astro') {
    // helmet visor
    ctx.fillStyle = 'rgba(78,192,255,0.35)';
    ctx.fillRect(cx - size*0.4, cy - size*0.85, size*0.8, size*0.35);
  } else if (charId === 'vamp') {
    // fangs
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - size*0.12, cy - size*0.3, size*0.05, size*0.1);
    ctx.fillRect(cx + size*0.07, cy - size*0.3, size*0.05, size*0.1);
  } else if (charId === 'panda') {
    // black ear circles
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(cx - size*0.4, cy - size*1.05, size*0.13, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size*0.4, cy - size*1.05, size*0.13, 0, Math.PI*2); ctx.fill();
  } else if (charId === 'pup') {
    // floppy ear
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath(); ctx.ellipse(cx - size*0.45, cy - size*0.85, size*0.12, size*0.2, -0.3, 0, Math.PI*2); ctx.fill();
  }
}

function shade(hex, amt) {
  // amt: -1..1
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  let r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
  return '#' + ((1<<24) | (r<<16) | (g<<8) | b).toString(16).slice(1);
}

// ============================================================
// GAME
// ============================================================
const Game = {
  canvas: null, ctx: null,
  dpr: 1, w: 0, h: 0,
  world: null, hopper: null, particles: null,
  cameraY: 0,                // world-space y offset
  state: 'menu',             // menu | playing | paused | dead
  mode: 'classic',
  score: 0, coinsRun: 0,
  bestScore: 0,
  daySeed: 0,
  fallbehindT: 0,
  lastTime: 0,
  rafId: 0,
  dailyTimeStart: 0,
  dailyComplete: false,
  shake: 0,
  flashTime: 0,
  inputBuffer: null,
  iceSliding: false,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.particles = new ParticleSystem();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.bindInput();
    this.startLoop();
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    // clientWidth/clientHeight are read-only — derive display size from the
    // canvas's rendered box (CSS sizes it to the viewport), falling back to
    // window dims. Assigning to clientWidth threw under 'use strict' and
    // aborted boot, freezing the menu so the game never started.
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.w = w; this.h = h;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  startLoop() {
    const self = this;
    function loop(t) {
      self.rafId = requestAnimationFrame(loop);
      const now = t || performance.now();
      let dt = (now - (self.lastTime || now)) / 1000;
      self.lastTime = now;
      if (dt > 0.05) dt = 0.05;
      self.update(dt);
      self.render();
    }
    this.rafId = requestAnimationFrame(loop);
  },

  startGame(mode) {
    // Cancel any pending ice auto-slide from a previous run so it can't inject
    // a phantom forward hop (or suppress sliding) into the fresh run.
    if (this._iceSlideT) { clearTimeout(this._iceSlideT); this._iceSlideT = null; }
    this.iceSliding = false;
    this.mode = mode || 'classic';
    let rng;
    if (this.mode === 'daily') {
      rng = mulberry32(seedFromDate(new Date()));
    } else {
      rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    }
    this.world = new World({ mode: this.mode, rng: rng });
    this.hopper = new Hopper(SaveManager.selectedChar);
    this.particles.clear();
    this.cameraY = 0;
    this.score = 0;
    this.coinsRun = 0;
    this.fallbehindT = 0;
    this.shake = 0;
    this.flashTime = 0;
    this.dailyTimeStart = performance.now();
    this.dailyComplete = false;
    this.state = 'playing';
    UI.showHud(true);
    UI.hideAll();
    AudioBus.resume();
    if (SaveManager.settings.musicOn) AudioBus.startMusic();
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    UI.showOverlay('overlay-pause');
  },
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    UI.hideAll();
    UI.showHud(true);
  },
  quitToMenu() {
    this.state = 'menu';
    AudioBus.stopMusic();
    UI.showHud(false);
    Router.go('#/');
  },

  die(reason) {
    if (this.state !== 'playing') return;
    if (this._iceSlideT) { clearTimeout(this._iceSlideT); this._iceSlideT = null; }
    this.iceSliding = false;
    this.state = 'dead';
    SaveManager.addCoins(this.coinsRun);
    AudioBus.death();
    haptic(80);
    if (window.MGNative) MGNative.Haptics.heavy();
    this.particles.spawn(this.hopper.x - this.cameraOffsetX(), this.worldToScreenY(this.hopper.y), 28, {
      color: '#bbb', speed: 140, gravity: 240, life: 0.7, size: 4,
    });
    if (!SaveManager.settings.reducedMotion) this.shake = 0.5;

    let isHighScore = false;
    if (this.mode === 'classic') {
      if (this.score > SaveManager.bestScore) {
        SaveManager.bestScore = this.score; SaveManager.saveBest();
        isHighScore = true;
      }
      addToLeaderboard('classic', { name: SaveManager.playerName, score: this.score, char: SaveManager.selectedChar, date: dateStr() });
    } else if (this.mode === 'zen') {
      addToLeaderboard('zen', { name: SaveManager.playerName, score: this.score, char: SaveManager.selectedChar, date: dateStr() });
    }
    UI.showDeath(reason, this.score, this.coinsRun, isHighScore);
  },

  completeDaily() {
    if (this.dailyComplete) return;
    this.dailyComplete = true;
    const t = (performance.now() - this.dailyTimeStart) / 1000;
    const today = dateStr();
    SaveManager.leaderboard.daily = SaveManager.leaderboard.daily || {};
    SaveManager.leaderboard.daily[today] = SaveManager.leaderboard.daily[today] || [];
    const dailyEntry = {
      name: SaveManager.playerName, time: t, char: SaveManager.selectedChar, date: today,
    };
    try {
      if (window.MGIdentity) {
        dailyEntry.playerId = MGIdentity.uuid();
        const dn = MGIdentity.name();
        if (dn) dailyEntry.displayName = dn;
      }
    } catch (e) {}
    SaveManager.leaderboard.daily[today].push(dailyEntry);
    SaveManager.leaderboard.daily[today].sort((a, b) => a.time - b.time);
    SaveManager.leaderboard.daily[today] = SaveManager.leaderboard.daily[today].slice(0, 10);
    SaveManager.saveLeaderboard();
    try {
      if (window.MGRemote && MGRemote.enabled()) {
        // Lower time = better. Use 1e9 - ms to make higher = better for sort.
        const ms = Math.max(0, Math.floor(t * 1000));
        MGRemote.submit('crossy-hop', 'daily-' + today, {
          name: dailyEntry.name, score: 1000000 - ms,
          detail: t.toFixed(2) + 's',
          payload: { time_ms: ms, date: today }
        }).catch(function(){});
      }
    } catch (e) {}
    SaveManager.addCoins(this.coinsRun);
    AudioBus.unlock();
    this.state = 'dead';
    UI.showDailyComplete(t, this.coinsRun);
  },

  // input handling -----------------
  bindInput() {
    const self = this;
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (self.state === 'playing') self.pause();
        else if (self.state === 'paused') self.resume();
        return;
      }
      if (self.state !== 'playing') return;
      let dCol = 0, dRow = 0, facing = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') { dRow = 1; facing = 0; }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { dRow = -1; facing = 2; }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { dCol = -1; facing = 3; }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { dCol = 1; facing = 1; }
      else return;
      e.preventDefault();
      self.tryMove(dCol, dRow, facing);
    });

    // pointer / touch
    let downX = 0, downY = 0, downT = 0, hasDown = false;
    this.canvas.addEventListener('pointerdown', function (e) {
      hasDown = true; downX = e.clientX; downY = e.clientY; downT = performance.now();
      try { self.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    this.canvas.addEventListener('pointerup', function (e) {
      if (!hasDown) return; hasDown = false;
      const dx = e.clientX - downX, dy = e.clientY - downY;
      const dist = Math.hypot(dx, dy);
      if (self.state !== 'playing') return;
      if (dist < 24) {
        // tap → hop forward
        self.tryMove(0, 1, 0);
      } else {
        if (Math.abs(dx) > Math.abs(dy)) {
          self.tryMove(dx > 0 ? 1 : -1, 0, dx > 0 ? 1 : 3);
        } else {
          self.tryMove(0, dy < 0 ? 1 : -1, dy < 0 ? 0 : 2);
        }
      }
    });

    // HUD buttons
    document.getElementById('dp-left').addEventListener('click', () => self.state === 'playing' && self.tryMove(-1, 0, 3));
    document.getElementById('dp-right').addEventListener('click', () => self.state === 'playing' && self.tryMove(1, 0, 1));
    document.getElementById('dp-fwd').addEventListener('click', () => self.state === 'playing' && self.tryMove(0, 1, 0));
    document.getElementById('dp-back').addEventListener('click', () => self.state === 'playing' && self.tryMove(0, -1, 2));
    document.getElementById('btn-pause').addEventListener('click', () => self.pause());
  },

  tryMove(dCol, dRow, facing) {
    if (this.state !== 'playing' || !this.hopper || this.hopper.dead || this.hopper.hopping) return;
    const newCol = this.hopper.col + dCol;
    const newRow = this.hopper.row + dRow;
    if (newCol < 0 || newCol >= TILES_X) return;
    if (newRow < 0) return; // can't go behind start (but allow once moved forward)
    // tree blocks on grass
    const destLane = this.world.getLane(newRow);
    if (destLane && destLane.type === LANE_GRASS && destLane.tree && destLane.tree[newCol]) return;
    if (destLane && destLane.type === LANE_ICE && destLane.iceObstacleCols && destLane.iceObstacleCols[newCol]) return;

    this.hopper.startHop(dCol, dRow, facing);
    AudioBus.hop();
    haptic(5);
    if (window.MGNative) MGNative.Haptics.select();
  },

  cameraOffsetX() {
    // camera horizontal anchor: keep grid centered on screen
    return (TILES_X * TILE_W) / 2 - this.w / 2;
  },
  worldToScreenY(worldY) {
    return this.h * 0.62 - (worldY - this.cameraY);
  },

  update(dt) {
    if (this.state !== 'playing') {
      this.particles.update(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      return;
    }
    this.world.update(dt);
    this.hopper.update(dt);
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    // camera lerp — slight forward bias
    const targetY = this.hopper.y + TILE_H * 2;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 4);

    // forward scroll over time (force forward pressure based on score)
    const pressure = 8 + Math.min(40, this.score * 0.4);
    this.cameraY += pressure * dt;

    // ensure lanes ahead — pass hopper.row so we never trim it
    this.world.ensureLanesAhead(Math.floor(this.cameraY / TILE_H) + 12, this.hopper.row);

    // landing / hazard checks after hop completes
    if (!this.hopper.hopping) {
      const lane = this.world.getLane(this.hopper.row);
      if (lane) {
        // log carry on water
        if (lane.type === LANE_WATER) {
          let onLog = null;
          for (let i = 0; i < lane.entities.length; i++) {
            const e = lane.entities[i];
            if (e.kind === 'log') {
              const lx = e.x, lr = e.x + e.len * TILE_W;
              // center-point check: hopper tile center must be within log
              const hopCx = this.hopper.x + TILE_W * 0.5;
              if (hopCx > lx && hopCx < lr) {
                onLog = e; break;
              }
            }
          }
          if (onLog) {
            this.hopper.x += lane.dir * lane.speed * dt;
            // keep col in sync so next hop starts from correct column
            this.hopper.col = Math.max(0, Math.min(TILES_X - 1, Math.round(this.hopper.x / TILE_W)));
            // if drifts off screen, die
            if (this.hopper.x < -TILE_W * 0.5 || this.hopper.x > TILES_X * TILE_W - TILE_W * 0.5) {
              return this.die('drowned');
            }
          } else {
            // splash
            AudioBus.splash();
            this.particles.spawn(
              this.hopper.x - this.cameraOffsetX(),
              this.worldToScreenY(this.hopper.y), 20,
              { color: '#4ec0ff', speed: 100, life: 0.5, gravity: 200, size: 3 }
            );
            return this.die('drowned');
          }
        }
        // car/train hit detection on road and rail
        if (lane.type === LANE_ROAD || lane.type === LANE_RAIL) {
          for (let i = 0; i < lane.entities.length; i++) {
            const e = lane.entities[i];
            // Match collision width to the rendered sprite. Cars/trucks are
            // drawn at 0.9 * len*TILE_W; using the full logical length left a
            // 6–13px sprite-free tail that caused unfair "cheap deaths" when
            // hopping in just behind a vehicle. Rail trains render full-width.
            const visW = (lane.type === LANE_RAIL) ? e.len * TILE_W : e.len * TILE_W * 0.9;
            const lx = e.x, rx = e.x + visW;
            const px = this.hopper.x + TILE_W * 0.5;
            if (px > lx && px < rx) {
              if (lane.type === LANE_RAIL) {
                this.particles.spawn(
                  this.hopper.x - this.cameraOffsetX(),
                  this.worldToScreenY(this.hopper.y), 30,
                  { color: '#ff5a5f', speed: 200, life: 0.6, size: 4 });
              }
              return this.die(lane.type === LANE_RAIL ? 'train' : 'squashed');
            }
          }
        }
        // coin pickup on grass
        if (lane.type === LANE_GRASS && lane.coin && !lane.coin.taken && lane.coin.col === this.hopper.col) {
          lane.coin.taken = true;
          this.coinsRun++;
          AudioBus.coin();
          this.particles.spawn(
            this.hopper.x - this.cameraOffsetX(),
            this.worldToScreenY(this.hopper.y), 12,
            { color: '#ffd23f', speed: 120, life: 0.5, size: 3, up: 80 });
        }
        // ice slide
        if (lane.type === LANE_ICE && !this.iceSliding && this.hopper.lastRow !== this.hopper.row) {
          // determine slide direction based on last facing? Simpler: if facing 0 (forward) on ice → keep sliding forward until obstacle/non-ice
          // We'll trigger one extra auto hop forward if path is clear
          const aheadLane = this.world.getLane(this.hopper.row + 1);
          if (aheadLane && (aheadLane.type === LANE_GRASS && !(aheadLane.tree && aheadLane.tree[this.hopper.col]) || aheadLane.type === LANE_ICE)) {
            this.iceSliding = true;
            this._iceSlideT = setTimeout(() => { this.iceSliding = false; this.tryMove(0, 1, 0); }, 120);
          }
        }
        this.hopper.lastRow = this.hopper.row;
      }

      // score
      if (this.hopper.row > this.score) {
        this.score = this.hopper.row;
      }

      // daily complete?
      if (this.mode === 'daily' && this.score >= DAILY_LEN) {
        this.completeDaily();
      }
    }

    // check fall-behind
    const screenY = this.worldToScreenY(this.hopper.y);
    if (screenY > this.h - 20) {
      this.fallbehindT += dt;
      if (this.fallbehindT >= FALLBEHIND_MS / 1000) {
        return this.die('left behind');
      }
    } else {
      this.fallbehindT = 0;
    }
    // off-side death (also handled in log/water)
    if (this.hopper.x < -TILE_W || this.hopper.x > TILES_X * TILE_W) {
      return this.die('off track');
    }

    UI.updateHud(this.score, this.coinsRun);
  },

  // ============================================================
  // RENDER
  // ============================================================
  render() {
    const ctx = this.ctx, w = this.w, h = this.h;
    // sky / ground gradient
    ctx.fillStyle = '#74c1ff';
    ctx.fillRect(0, 0, w, h * 0.4);
    ctx.fillStyle = '#a4dc7a';
    ctx.fillRect(0, h * 0.4, w, h * 0.6);

    if (this.state === 'menu') {
      // ambient title scene: just draw a few lanes
      this.renderTitleScene();
      return;
    }

    if (!this.world) return;

    // camera shake
    let shakeX = 0, shakeY = 0;
    if (this.shake > 0 && !SaveManager.settings.reducedMotion) {
      shakeX = (Math.random() - 0.5) * 12 * this.shake;
      shakeY = (Math.random() - 0.5) * 12 * this.shake;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const offX = this.cameraOffsetX();
    const lanesSorted = this.world.lanes.slice().sort((a, b) => a.row - b.row);

    // figure visible row range
    const minRow = Math.floor((this.cameraY - this.h) / TILE_H) - 1;
    const maxRow = Math.floor((this.cameraY + this.h) / TILE_H) + 1;

    // backgrounds (lane strips), iterate from far (high row) to near (low row)
    for (let i = lanesSorted.length - 1; i >= 0; i--) {
      const lane = lanesSorted[i];
      if (lane.row < minRow || lane.row > maxRow) continue;
      const y = this.worldToScreenY(lane.row * TILE_H);
      this.renderLaneBg(lane, y, offX);
    }

    // entities (sorted within each lane)
    for (let i = lanesSorted.length - 1; i >= 0; i--) {
      const lane = lanesSorted[i];
      if (lane.row < minRow || lane.row > maxRow) continue;
      const y = this.worldToScreenY(lane.row * TILE_H);
      this.renderLaneEntities(lane, y, offX);
    }

    // hopper
    if (this.hopper) {
      const hx = this.hopper.x - offX;
      const hy = this.worldToScreenY(this.hopper.y);
      const pal = (CHARACTERS.find(c => c.id === this.hopper.charId) || CHARACTERS[0]).palette;
      const tProg = this.hopper.hopping ? this.hopper.hopT : 0;
      drawCube(ctx, hx + TILE_W * 0.5, hy + TILE_H * 0.5, TILE_W * 0.55, pal, tProg, this.hopper.facing);
      drawCharacterFeatures(ctx, hx + TILE_W * 0.5, hy + TILE_H * 0.5, TILE_W * 0.55, this.hopper.charId, performance.now() / 1000);
    }

    // particles
    this.particles.render(ctx);

    ctx.restore();
  },

  renderTitleScene() {
    const ctx = this.ctx, w = this.w, h = this.h;
    const off = (TILES_X * TILE_W) / 2 - w / 2;
    // a couple of grass strips
    for (let r = -2; r <= 6; r++) {
      const y = h * 0.62 - r * TILE_H;
      const isRoad = r === 1 || r === 3;
      ctx.fillStyle = isRoad ? '#3f4554' : (r % 2 === 0 ? '#9ed572' : '#8fc762');
      ctx.fillRect(-off, y, TILES_X * TILE_W, TILE_H);
      if (isRoad) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let dx = 0; dx < TILES_X * TILE_W; dx += 24) {
          ctx.fillRect(-off + dx, y + TILE_H * 0.46, 12, 3);
        }
      }
    }
    // a chick on tile
    const pal = CHARACTERS[0].palette;
    drawCube(ctx, w/2, h * 0.62 + TILE_H * 0.5, TILE_W * 0.55, pal, 0, 0);
    drawCharacterFeatures(ctx, w/2, h * 0.62 + TILE_H * 0.5, TILE_W * 0.55, 'chick', performance.now() / 1000);
  },

  renderLaneBg(lane, y, offX) {
    const ctx = this.ctx;
    const x0 = -offX;
    const wpx = TILES_X * TILE_W;
    if (lane.type === LANE_GRASS) {
      ctx.fillStyle = (lane.row % 2 === 0) ? '#9ed572' : '#8fc762';
      ctx.fillRect(x0, y, wpx, TILE_H);
    } else if (lane.type === LANE_ROAD) {
      ctx.fillStyle = '#3f4554';
      ctx.fillRect(x0, y, wpx, TILE_H);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let dx = 0; dx < wpx; dx += 24) {
        ctx.fillRect(x0 + dx, y + TILE_H * 0.46, 12, 3);
      }
    } else if (lane.type === LANE_WATER) {
      ctx.fillStyle = '#3a8fc4';
      ctx.fillRect(x0, y, wpx, TILE_H);
      // pattern (for colorblind)
      if (SaveManager.settings.colorblind) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        const phase = (performance.now() / 200) % 16;
        for (let dx = -16 + phase; dx < wpx; dx += 16) {
          ctx.fillRect(x0 + dx, y + TILE_H * 0.5, 8, 2);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        const phase = (performance.now() / 300) % 24;
        for (let dx = -24 + phase; dx < wpx; dx += 24) {
          ctx.fillRect(x0 + dx, y + TILE_H * 0.55, 14, 2);
        }
      }
    } else if (lane.type === LANE_RAIL) {
      ctx.fillStyle = '#6b5a3a';
      ctx.fillRect(x0, y, wpx, TILE_H);
      // rails
      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(x0, y + TILE_H * 0.25, wpx, 3);
      ctx.fillRect(x0, y + TILE_H * 0.65, wpx, 3);
      // sleepers
      ctx.fillStyle = '#3d2f1a';
      for (let dx = 0; dx < wpx; dx += 18) {
        ctx.fillRect(x0 + dx, y + TILE_H * 0.2, 10, TILE_H * 0.6);
      }
      // warning flash
      if (lane.warning > 0) {
        const a = (Math.sin(performance.now() / 80) + 1) / 2;
        if (SaveManager.settings.colorblind) {
          ctx.fillStyle = 'rgba(255,210,63,' + (0.2 + a * 0.4) + ')';
        } else {
          ctx.fillStyle = 'rgba(255,90,95,' + (0.2 + a * 0.4) + ')';
        }
        ctx.fillRect(x0, y, wpx, TILE_H);
        // stripes for colorblind
        if (SaveManager.settings.colorblind) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          for (let dx = 0; dx < wpx; dx += 16) {
            ctx.fillRect(x0 + dx, y, 8, TILE_H);
          }
        }
      }
    } else if (lane.type === LANE_ICE) {
      ctx.fillStyle = (lane.row % 2 === 0) ? '#cfe8f5' : '#bfe1f2';
      ctx.fillRect(x0, y, wpx, TILE_H);
      // sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 5; i++) {
        const sx = ((lane.row * 73 + i * 41) % TILES_X) * TILE_W;
        ctx.fillRect(x0 + sx + TILE_W * 0.3, y + TILE_H * 0.3, 3, 3);
      }
    }
  },

  renderLaneEntities(lane, y, offX) {
    const ctx = this.ctx;
    const x0 = -offX;

    if (lane.type === LANE_GRASS) {
      // trees
      if (lane.tree) {
        for (let c = 0; c < TILES_X; c++) {
          if (!lane.tree[c]) continue;
          const tx = x0 + c * TILE_W + TILE_W * 0.5;
          ctx.fillStyle = '#5a3a1e';
          ctx.fillRect(tx - 4, y + TILE_H * 0.15, 8, TILE_H * 0.7);
          ctx.fillStyle = '#2a7d2a';
          ctx.beginPath(); ctx.arc(tx, y + TILE_H * 0.15, TILE_W * 0.32, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3aa53a';
          ctx.beginPath(); ctx.arc(tx - 4, y + TILE_H * 0.1, TILE_W * 0.16, 0, Math.PI * 2); ctx.fill();
        }
      }
      // coin
      if (lane.coin && !lane.coin.taken) {
        const cx = x0 + lane.coin.col * TILE_W + TILE_W * 0.5;
        const cy = y + TILE_H * 0.5;
        const bob = Math.sin(performance.now() / 200) * 3;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(cx, cy + bob, TILE_W * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb800';
        ctx.beginPath(); ctx.arc(cx, cy + bob, TILE_W * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 1, cy + bob - TILE_W * 0.08, 2, TILE_W * 0.16);
      }
    } else if (lane.type === LANE_ROAD) {
      for (let i = 0; i < lane.entities.length; i++) {
        const e = lane.entities[i];
        const ex = e.x - offX;
        const wpx = e.len * TILE_W * 0.9;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(ex + 4, y + TILE_H * 0.7, wpx, 4);
        ctx.fillStyle = e.color || '#ff5a5f';
        ctx.fillRect(ex, y + TILE_H * 0.2, wpx, TILE_H * 0.55);
        // top
        ctx.fillStyle = shade(e.color || '#ff5a5f', 0.15);
        ctx.fillRect(ex + 4, y + TILE_H * 0.12, wpx - 8, TILE_H * 0.18);
        // windows
        ctx.fillStyle = '#1b1f2a';
        if (e.kind === 'truck') {
          ctx.fillRect(ex + wpx * (lane.dir > 0 ? 0.78 : 0.05), y + TILE_H * 0.25, wpx * 0.17, TILE_H * 0.25);
        } else {
          ctx.fillRect(ex + wpx * (lane.dir > 0 ? 0.6 : 0.1), y + TILE_H * 0.25, wpx * 0.3, TILE_H * 0.25);
        }
        // wheels
        ctx.fillStyle = '#111';
        ctx.fillRect(ex + 4, y + TILE_H * 0.7, 8, 6);
        ctx.fillRect(ex + wpx - 12, y + TILE_H * 0.7, 8, 6);
      }
    } else if (lane.type === LANE_WATER) {
      for (let i = 0; i < lane.entities.length; i++) {
        const e = lane.entities[i];
        const ex = e.x - offX;
        const wpx = e.len * TILE_W;
        ctx.fillStyle = '#7a4a2a';
        ctx.fillRect(ex, y + TILE_H * 0.25, wpx, TILE_H * 0.5);
        ctx.fillStyle = '#a86a3a';
        ctx.fillRect(ex, y + TILE_H * 0.25, wpx, 4);
        ctx.strokeStyle = '#5c3818'; ctx.lineWidth = 1;
        for (let lx = ex + 6; lx < ex + wpx - 6; lx += 14) {
          ctx.beginPath(); ctx.moveTo(lx, y + TILE_H * 0.3); ctx.lineTo(lx, y + TILE_H * 0.7); ctx.stroke();
        }
      }
    } else if (lane.type === LANE_RAIL) {
      for (let i = 0; i < lane.entities.length; i++) {
        const e = lane.entities[i];
        const ex = e.x - offX;
        const wpx = e.len * TILE_W;
        ctx.fillStyle = '#222';
        ctx.fillRect(ex, y + TILE_H * 0.1, wpx, TILE_H * 0.75);
        ctx.fillStyle = '#444';
        ctx.fillRect(ex, y + TILE_H * 0.1, wpx, TILE_H * 0.2);
        // windows
        ctx.fillStyle = '#4ec0ff';
        for (let wx = ex + 16; wx < ex + wpx - 16; wx += 28) {
          ctx.fillRect(wx, y + TILE_H * 0.35, 18, TILE_H * 0.3);
        }
        // headlight side
        ctx.fillStyle = '#ffd23f';
        if (lane.dir > 0) ctx.fillRect(ex + wpx - 6, y + TILE_H * 0.4, 6, TILE_H * 0.2);
        else ctx.fillRect(ex, y + TILE_H * 0.4, 6, TILE_H * 0.2);
      }
    } else if (lane.type === LANE_ICE) {
      if (lane.iceObstacleCols) {
        for (const c in lane.iceObstacleCols) {
          if (!lane.iceObstacleCols.hasOwnProperty(c)) continue;
          const tx = x0 + parseInt(c, 10) * TILE_W + TILE_W * 0.5;
          ctx.fillStyle = '#e8f4fc';
          ctx.fillRect(tx - TILE_W * 0.3, y + TILE_H * 0.15, TILE_W * 0.6, TILE_H * 0.6);
          ctx.fillStyle = '#a8d4ec';
          ctx.fillRect(tx - TILE_W * 0.3, y + TILE_H * 0.65, TILE_W * 0.6, TILE_H * 0.1);
        }
      }
    }
  },
};

function addToLeaderboard(category, entry) {
  try {
    if (window.MGIdentity) {
      entry.playerId = MGIdentity.uuid();
      const dn = MGIdentity.name();
      if (dn) entry.displayName = dn;
    }
  } catch (e) {}
  SaveManager.leaderboard[category] = SaveManager.leaderboard[category] || [];
  SaveManager.leaderboard[category].push(entry);
  SaveManager.leaderboard[category].sort((a, b) => b.score - a.score);
  SaveManager.leaderboard[category] = SaveManager.leaderboard[category].slice(0, 10);
  SaveManager.saveLeaderboard();
  try {
    if (window.MGRemote && MGRemote.enabled()) {
      MGRemote.submit('crossy-hop', category, {
        name: entry.name, score: entry.score | 0,
        detail: (entry.char || '') + ' • ' + (entry.score | 0),
        payload: { char: entry.char || '' }
      }).catch(function(){});
    }
  } catch (e) {}
}

function dateStr() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
}

function haptic(ms) {
  if (!SaveManager.settings.haptics) return;
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ============================================================
// CHARACTER SHOP
// ============================================================
const CharacterShop = {
  render() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    for (let i = 0; i < CHARACTERS.length; i++) {
      const c = CHARACTERS[i];
      const owned = SaveManager.hasChar(c.id);
      const selected = SaveManager.selectedChar === c.id;
      const card = document.createElement('div');
      card.className = 'char-card' + (selected ? ' selected' : '') + (owned ? '' : ' locked');
      const canvas = document.createElement('canvas');
      canvas.width = 84; canvas.height = 84;
      const ctx2 = canvas.getContext('2d');
      ctx2.clearRect(0, 0, 84, 84);
      drawCube(ctx2, 42, 70, 32, c.palette, 0, 0);
      drawCharacterFeatures(ctx2, 42, 70, 32, c.id, performance.now() / 1000);
      card.appendChild(canvas);
      const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = c.name;
      const pr = document.createElement('div'); pr.className = 'price';
      if (owned) { pr.textContent = selected ? 'SELECTED' : 'TAP TO USE'; pr.classList.add('owned'); }
      else { pr.textContent = c.cost + 'c'; }
      card.appendChild(nm); card.appendChild(pr);
      card.addEventListener('click', () => {
        if (owned) {
          SaveManager.selectedChar = c.id; SaveManager.saveSelected();
          CharacterShop.render();
        } else {
          if (SaveManager.trySpend(c.cost)) {
            SaveManager.unlockChar(c.id);
            SaveManager.selectedChar = c.id; SaveManager.saveSelected();
            AudioBus.unlock();
            UI.toast('Unlocked ' + c.name + '!');
            CharacterShop.render();
            UI.updateMenuCoins();
          } else {
            UI.toast('Not enough coins');
          }
        }
      });
      grid.appendChild(card);
    }
    document.getElementById('char-coins').textContent = SaveManager.coins;
  }
};

// ============================================================
// UI / OVERLAY / ROUTER
// ============================================================
const UI = {
  hideAll() {
    const els = document.querySelectorAll('.overlay');
    for (let i = 0; i < els.length; i++) els[i].classList.add('hidden');
  },
  showOverlay(id) {
    this.hideAll();
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  },
  showHud(on) {
    const hud = document.getElementById('hud');
    if (on) hud.classList.remove('hidden'); else hud.classList.add('hidden');
  },
  updateHud(score, coins) {
    document.getElementById('hud-score').textContent = String(score);
    document.getElementById('hud-coins').textContent = coins + 'c';
    document.getElementById('hud-best').textContent = 'B' + SaveManager.bestScore;
  },
  updateMenuCoins() {
    document.getElementById('menu-coins').textContent = SaveManager.coins;
    document.getElementById('char-coins').textContent = SaveManager.coins;
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2000);
  },

  showDeath(reason, score, coins, isHighScore) {
    this.showOverlay('overlay-death');
    document.getElementById('death-title').textContent = reasonTitle(reason);
    document.getElementById('death-score').textContent = String(score);
    document.getElementById('death-sub').textContent = 'tiles · ' + coins + ' coins earned';
    const ne = document.getElementById('name-entry');
    if (isHighScore && Game.mode === 'classic') {
      ne.classList.remove('hidden');
      document.getElementById('hs-name').value = SaveManager.playerName;
    } else {
      ne.classList.add('hidden');
    }
  },

  showDailyComplete(t, coins) {
    this.showOverlay('overlay-death');
    document.getElementById('death-title').textContent = 'Daily Done!';
    document.getElementById('death-score').textContent = t.toFixed(2) + 's';
    document.getElementById('death-sub').textContent = '50 tiles · ' + coins + ' coins';
    document.getElementById('name-entry').classList.add('hidden');
  },

  refreshLeaderboard(tab) {
    const list = document.getElementById('lb-list');
    list.innerHTML = '';
    // Inject scope toggle once
    const remoteOn = !!(window.MGRemote && MGRemote.enabled());
    const parent = list.parentNode;
    if (remoteOn && parent && !parent.querySelector('.lb-scope')) {
      const wrap = document.createElement('div');
      wrap.className = 'lb-scope';
      wrap.style.cssText = 'display:flex;gap:6px;justify-content:center;margin:6px 0;';
      wrap.innerHTML = '<button class="tab active" data-scope="local">LOCAL</button><button class="tab" data-scope="global">GLOBAL</button>';
      parent.insertBefore(wrap, list);
      const self = this;
      wrap.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          wrap.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          self._lbScope = b.getAttribute('data-scope');
          self.refreshLeaderboard(self._lbTab || tab);
        });
      });
    }
    this._lbTab = tab;
    const scope = this._lbScope || 'local';

    if (scope === 'global' && remoteOn) {
      const mode = (tab === 'daily') ? ('daily-' + dateStr()) : tab;
      const li0 = document.createElement('li');
      li0.innerHTML = '<span class="muted" style="margin:auto">Loading…</span>';
      list.appendChild(li0);
      MGRemote.top('crossy-hop', mode, { limit: 10 }).then(rows => {
        list.innerHTML = '';
        if (!rows || !rows.length) {
          const li = document.createElement('li');
          li.innerHTML = '<span class="muted" style="margin:auto">No global scores</span>';
          list.appendChild(li);
          return;
        }
        rows.forEach((e, i) => {
          const li = document.createElement('li');
          const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = (i+1) + '.';
          const name = document.createElement('span'); name.className = 'name'; name.textContent = e.display_name || '???';
          const score = document.createElement('span'); score.className = 'score';
          if (tab === 'daily') {
            const ms = 1000000 - (e.score | 0);
            score.textContent = (ms / 1000).toFixed(2) + 's';
          } else score.textContent = (e.score | 0);
          li.appendChild(rank); li.appendChild(name); li.appendChild(score);
          list.appendChild(li);
        });
      });
      return;
    }

    let entries = [];
    if (tab === 'classic') entries = SaveManager.leaderboard.classic || [];
    else if (tab === 'zen') entries = SaveManager.leaderboard.zen || [];
    else if (tab === 'daily') {
      const today = dateStr();
      entries = (SaveManager.leaderboard.daily && SaveManager.leaderboard.daily[today]) || [];
    }
    if (entries.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="muted" style="margin:auto">No scores yet — go play!</span>';
      list.appendChild(li);
      return;
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = (i+1) + '.';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = (e.displayName || e.name || '???');
      const score = document.createElement('span'); score.className = 'score';
      if (tab === 'daily') score.textContent = (e.time != null ? e.time.toFixed(2) + 's' : '-');
      else score.textContent = (e.score != null ? e.score : '-');
      li.appendChild(rank); li.appendChild(name); li.appendChild(score);
      list.appendChild(li);
    }
  },
};

function reasonTitle(r) {
  if (r === 'squashed') return 'Squashed!';
  if (r === 'drowned') return 'Splash!';
  if (r === 'train') return 'Choo Choo!';
  if (r === 'left behind') return 'Too slow!';
  if (r === 'off track') return 'Off the path!';
  return 'Game Over';
}

// Router (hash-based)
const Router = {
  go(hash) {
    if (location.hash !== hash) location.hash = hash;
    else this.handle();
  },
  handle() {
    const h = location.hash || '#/';
    if (h === '#/' || h === '') {
      Game.state = 'menu';
      AudioBus.stopMusic();
      UI.showHud(false);
      UI.showOverlay('overlay-menu');
      UI.updateMenuCoins();
    } else if (h === '#/play') {
      Game.startGame('classic');
    } else if (h === '#/daily') {
      UI.showHud(false);
      UI.showOverlay('overlay-daily');
      document.getElementById('daily-date').textContent = 'Seed: ' + dateStr();
    } else if (h === '#/zen') {
      UI.showHud(false);
      UI.showOverlay('overlay-zen');
    } else if (h === '#/characters') {
      UI.showHud(false);
      UI.showOverlay('overlay-characters');
      CharacterShop.render();
    } else if (h === '#/leaderboard') {
      UI.showHud(false);
      UI.showOverlay('overlay-leaderboard');
      UI.refreshLeaderboard('classic');
    } else if (h === '#/settings') {
      UI.showHud(false);
      UI.showOverlay('overlay-settings');
      bindSettings();
    } else if (h === '#/howto') {
      UI.showHud(false);
      UI.showOverlay('overlay-howto');
    } else if (h === '#/credits') {
      UI.showHud(false);
      UI.showOverlay('overlay-credits');
    }
  },
};

function bindSettings() {
  const sfx = document.getElementById('sfx-vol');
  const mus = document.getElementById('music-vol');
  const musOn = document.getElementById('music-on');
  const hap = document.getElementById('haptics');
  const cb = document.getElementById('colorblind');
  const rm = document.getElementById('reduced-motion');
  const nm = document.getElementById('player-name');
  sfx.value = SaveManager.settings.sfxVol;
  mus.value = SaveManager.settings.musicVol;
  musOn.checked = !!SaveManager.settings.musicOn;
  hap.checked = !!SaveManager.settings.haptics;
  cb.checked = !!SaveManager.settings.colorblind;
  rm.checked = !!SaveManager.settings.reducedMotion;
  nm.value = SaveManager.playerName;

  sfx.oninput = () => { SaveManager.settings.sfxVol = +sfx.value; AudioBus.setSfxVol(+sfx.value); SaveManager.saveSettings(); };
  mus.oninput = () => { SaveManager.settings.musicVol = +mus.value; AudioBus.setMusicVol(+mus.value); SaveManager.saveSettings(); };
  musOn.onchange = () => {
    SaveManager.settings.musicOn = !!musOn.checked; SaveManager.saveSettings();
    if (SaveManager.settings.musicOn && Game.state === 'playing') AudioBus.startMusic();
    else AudioBus.stopMusic();
  };
  hap.onchange = () => { SaveManager.settings.haptics = !!hap.checked; SaveManager.saveSettings(); };
  cb.onchange = () => { SaveManager.settings.colorblind = !!cb.checked; SaveManager.saveSettings(); };
  rm.onchange = () => { SaveManager.settings.reducedMotion = !!rm.checked; SaveManager.saveSettings(); };
  nm.oninput = () => {
    const v = nm.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'YOU';
    SaveManager.playerName = v; nm.value = v; SaveManager.savePlayerName();
  };

  // Theme toggle
  const THEME_KEY = 'crossy-road:v1:theme';
  const wrap = document.getElementById('themeToggle');
  if (wrap && window.MGTheme) {
    const buttons = wrap.querySelectorAll('button[data-theme-pref]');
    const cur = MGTheme.get(THEME_KEY);
    buttons.forEach(b => {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-pref') === cur ? 'true' : 'false');
      b.onclick = () => {
        const pref = b.getAttribute('data-theme-pref');
        MGTheme.set(pref, THEME_KEY);
        buttons.forEach(bb => bb.setAttribute('aria-pressed', bb.getAttribute('data-theme-pref') === pref ? 'true' : 'false'));
      };
    });
  }
}

// ============================================================
// SHARED IDENTITY / SHARE INJECTION
// ============================================================
function injectPlayerSettings() {
  if (!window.MGIdentity) return;
  const card = document.querySelector('#overlay-settings .card');
  if (!card || document.getElementById('mg-player-section')) return;
  const fullId = MGIdentity.uuid();
  const wrap = document.createElement('div');
  wrap.id = 'mg-player-section';
  wrap.innerHTML =
    '<h3 style="margin-top:14px;">Player</h3>' +
    '<label class="row"><span>Your name</span>' +
    '  <input type="text" id="mg-player-name" maxlength="24" placeholder="Anonymous" />' +
    '</label>' +
    '<label class="row"><span>Suggest a name</span>' +
    '  <button class="big-btn small" id="mg-player-suggest" type="button">SUGGEST</button>' +
    '</label>' +
    '<label class="row"><span>Player ID</span>' +
    '  <span style="display:flex;gap:8px;align-items:center;">' +
    '    <span id="mg-player-id" title="' + fullId + '" style="font-family:monospace;font-size:12px;opacity:0.7;">' + fullId.slice(0, 8) + '…</span>' +
    '    <button class="big-btn small" id="mg-player-copy" type="button">COPY</button>' +
    '  </span>' +
    '</label>';
  card.appendChild(wrap);
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

function injectShareButton() {
  if (!window.MGShare) return;
  const death = document.querySelector('#overlay-death .small-card');
  if (!death || document.getElementById('btn-share')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-share';
  btn.className = 'big-btn';
  btn.type = 'button';
  btn.textContent = 'SHARE';
  btn.addEventListener('click', () => {
    const name = (window.MGIdentity && MGIdentity.name()) || (SaveManager.playerName || 'Anonymous');
    const modeLabel = (Game.mode || 'classic').toUpperCase();
    MGShare.share({
      gameTitle: 'Crossy Hop',
      subtitle: 'Game over',
      score: Game.score || 0,
      name,
      detail: modeLabel + ' • ' + (Game.score || 0) + 'm',
      url: 'https://philipposk.github.io/MiniGames/crossy-road/',
      accent: '#6cbe5a', bg1: '#1b2c48', bg2: '#324e7b'
    });
  });
  // Insert before the MENU button (last button) for clarity
  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn && menuBtn.parentNode === death) death.insertBefore(btn, menuBtn);
  else death.appendChild(btn);
}

// ============================================================
// BOOT
// ============================================================
function boot() {
  if (window.MGTheme) MGTheme.init('crossy-road:v1:theme');
  if (window.MGIdentity) { try { MGIdentity.uuid(); } catch (e) {} }
  SaveManager.load();
  Game.init();
  injectPlayerSettings();
  injectShareButton();
  // pause / death buttons
  document.getElementById('btn-resume').addEventListener('click', () => Game.resume());
  document.getElementById('btn-restart').addEventListener('click', () => Game.startGame(Game.mode));
  document.getElementById('btn-quit').addEventListener('click', () => Game.quitToMenu());
  document.getElementById('btn-again').addEventListener('click', () => Game.startGame(Game.mode));
  document.getElementById('btn-menu').addEventListener('click', () => Game.quitToMenu());
  document.getElementById('hs-save').addEventListener('click', () => {
    const inp = document.getElementById('hs-name');
    const v = (inp.value || 'YOU').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'YOU';
    SaveManager.playerName = v; SaveManager.savePlayerName();
    // update last classic entry's name
    const arr = SaveManager.leaderboard.classic || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].score === Game.score) { arr[i].name = v; break; }
    }
    SaveManager.saveLeaderboard();
    document.getElementById('name-entry').classList.add('hidden');
    UI.toast('Saved!');
  });
  document.getElementById('daily-start').addEventListener('click', () => Game.startGame('daily'));
  document.getElementById('zen-start').addEventListener('click', () => Game.startGame('zen'));

  // route buttons
  const navBtns = document.querySelectorAll('[data-route]');
  for (let i = 0; i < navBtns.length; i++) {
    const b = navBtns[i];
    b.addEventListener('click', () => Router.go(b.getAttribute('data-route')));
  }

  // leaderboard tabs
  const tabs = document.querySelectorAll('.tab');
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      for (let j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
      this.classList.add('active');
      UI.refreshLeaderboard(this.getAttribute('data-tab'));
    });
  }

  // init audio on first user gesture
  const firstGesture = () => {
    AudioBus.init();
    AudioBus.resume();
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  window.addEventListener('hashchange', () => Router.handle());
  Router.handle();
  UI.updateMenuCoins();

  // register service worker (only over http(s))
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('./service-worker.js').catch(function () {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
