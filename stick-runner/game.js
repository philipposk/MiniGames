// Stick Runner — game.js
// Vanilla JS, no deps. GH-Pages compatible. Relative paths only.

(function () {
  'use strict';

  // ---------- Storage helpers ----------
  const NS = 'stick-runner:v1:';
  const K = {
    high: NS + 'highScore',
    bestDist: NS + 'bestDist',
    unlocks: NS + 'unlocks',
    selectedChar: NS + 'selectedChar',
    selectedBiome: NS + 'selectedBiome',
    settings: NS + 'settings',
    leaderboard: NS + 'leaderboard',
    achievements: NS + 'achievements',
    coins: NS + 'coins',
    selected: NS + 'selected',
    dailyStreak: NS + 'dailyStreak',
    lastDaily: NS + 'lastDaily',
  };

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* quota or unavailable */ }
  }

  // ---------- Definitions ----------
  const BIOMES = [
    { id: 'forest', name: 'FOREST',    unlock: 0,    sky: ['#1e3a2a', '#2e6041', '#1a3d29'], ground: '#264d33', accent: '#7fdfa5' },
    { id: 'desert', name: 'DESERT',    unlock: 500,  sky: ['#4a2a15', '#c97f3a', '#f3c47a'], ground: '#a36a32', accent: '#ffd97a' },
    { id: 'city',   name: 'NEON CITY', unlock: 2000, sky: ['#1a0033', '#3a005a', '#5a0080'], ground: '#1a0a26', accent: '#ff45c4' },
    { id: 'space',  name: 'SPACE',     unlock: 5000, sky: ['#000010', '#020024', '#000018'], ground: '#0a0a1c', accent: '#9ad0ff' },
  ];

  const CHARS = [
    { id: 'classic',    name: 'CLASSIC',   unlock: 0,     color: '#ffffff', accent: null },
    { id: 'ninja',      name: 'NINJA',     unlock: 100,   color: '#1a1a1a', accent: '#e63946' },
    { id: 'robot',      name: 'ROBOT',     unlock: 250,   color: '#c0c0d0', accent: '#4cc9f0' },
    { id: 'alien',      name: 'ALIEN',     unlock: 500,   color: '#7fff7f', accent: '#000000' },
    { id: 'zombie',     name: 'ZOMBIE',    unlock: 1000,  color: '#8aa67f', accent: '#3a4a30' },
    { id: 'knight',     name: 'KNIGHT',    unlock: 2000,  color: '#b0b0c0', accent: '#ffd700' },
    { id: 'pirate',     name: 'PIRATE',    unlock: 5000,  color: '#f0d0a0', accent: '#8b0000' },
    { id: 'astronaut',  name: 'ASTRO',     unlock: 20000, color: '#f8f8ff', accent: '#ff8800' },
  ];

  // Hats (shop)
  const HATS = [
    { id: 'none',       name: 'NONE',       price: 0,   color: null },
    { id: 'cap',        name: 'CAP',        price: 100, color: '#e63946' },
    { id: 'tophat',     name: 'TOP HAT',    price: 200, color: '#101020' },
    { id: 'crown',      name: 'CROWN',      price: 400, color: '#ffd700' },
    { id: 'beanie',     name: 'BEANIE',     price: 150, color: '#4cc9f0' },
    { id: 'wizard',     name: 'WIZARD',     price: 350, color: '#7b3ff2' },
    { id: 'cowboy',     name: 'COWBOY',     price: 250, color: '#a05a2c' },
    { id: 'halo',       name: 'HALO',       price: 600, color: '#ffe680' },
    { id: 'horns',      name: 'HORNS',      price: 800, color: '#8b0000' },
  ];

  const TRAILS = [
    { id: 'none',   name: 'NONE',   price: 0,   color: null },
    { id: 'fire',   name: 'FIRE',   price: 200, color: '#ff5722' },
    { id: 'ice',    name: 'ICE',    price: 300, color: '#4cc9f0' },
    { id: 'neon',   name: 'NEON',   price: 500, color: '#ff45c4' },
    { id: 'gold',   name: 'GOLD',   price: 800, color: '#ffd700' },
  ];

  // Achievements (>=10)
  const ACHIEVEMENTS = [
    { id: 'first_steps',     name: 'First Steps',       desc: 'Reach 100m' },
    { id: 'marathon',        name: 'Marathon',          desc: 'Reach 1000m' },
    { id: 'ultramarathon',   name: 'Ultramarathon',     desc: 'Reach 10000m' },
    { id: 'double_jumper',   name: 'Double-Jumper',     desc: '5 air double-jumps in one run' },
    { id: 'untouched',       name: 'Untouched',         desc: 'Finish a run with 0 close calls' },
    { id: 'biome_explorer',  name: 'Biome Explorer',    desc: 'Unlock all biomes' },
    { id: 'skin_collector',  name: 'Skin Collector',    desc: 'Unlock 3 characters' },
    { id: 'master_runner',   name: 'Master Runner',     desc: 'Unlock all characters' },
    { id: 'speed_demon',     name: 'Speed Demon',       desc: 'Reach max speed in a run' },
    { id: 'daily_streak_7',  name: 'Daily Streak 7',    desc: 'Play daily challenge 7 days in a row' },
  ];

  const MAX_SPEED = 50;
  const OBSTACLE_SPEED_INITIAL = 3;
  const OBSTACLE_SPAWN_RATE = 2000;
  const PLAYER_HEIGHT = 90;

  // ---------- Persisted state ----------
  const state = {
    coins: lsGet(K.coins, 0),
    bestDist: lsGet(K.bestDist, 0),
    highScore: lsGet(K.high, 0),
    unlocks: lsGet(K.unlocks, {
      biomes: ['forest'],
      characters: ['classic'],
      hats: ['none'],
      trails: ['none'],
    }),
    selected: lsGet(K.selected, { hat: 'none', trail: 'none' }),
    selectedChar:  lsGet(K.selectedChar, 'classic'),
    selectedBiome: lsGet(K.selectedBiome, 'forest'),
    settings: lsGet(K.settings, {
      sfxVol: 0.6,
      musicVol: 0.3,
      haptics: true,
      colorblind: false,
      reducedMotion: false,
      control: 'tap',  // 'tap' | 'button'
      language: 'en',
    }),
    leaderboard: lsGet(K.leaderboard, {}),  // { overall: [...], forest: [...], desert: [...], city: [...], space: [...], daily: [...] }
    achievements: lsGet(K.achievements, {}),
    dailyStreak: lsGet(K.dailyStreak, 0),
    lastDaily: lsGet(K.lastDaily, null),
  };

  // Initialize missing leaderboard arrays
  ['overall', 'forest', 'desert', 'city', 'space', 'daily'].forEach(k => {
    if (!Array.isArray(state.leaderboard[k])) state.leaderboard[k] = [];
  });

  function persistAll() {
    lsSet(K.coins, state.coins);
    lsSet(K.bestDist, state.bestDist);
    lsSet(K.high, state.highScore);
    lsSet(K.unlocks, state.unlocks);
    lsSet(K.selected, state.selected);
    lsSet(K.selectedChar, state.selectedChar);
    lsSet(K.selectedBiome, state.selectedBiome);
    lsSet(K.settings, state.settings);
    lsSet(K.leaderboard, state.leaderboard);
    lsSet(K.achievements, state.achievements);
    lsSet(K.dailyStreak, state.dailyStreak);
    lsSet(K.lastDaily, state.lastDaily);
  }

  // Apply settings-driven body classes
  function applySettingsToBody() {
    document.body.classList.toggle('reduced-motion', !!state.settings.reducedMotion);
    document.body.classList.toggle('colorblind', !!state.settings.colorblind);
    document.body.classList.toggle('control-button', state.settings.control === 'button');
  }

  // ---------- Toast ----------
  function toast(msg, ms = 2400) {
    const layer = document.getElementById('toastLayer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    layer.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ---------- Audio (WebAudio) ----------
  let audioCtx = null;
  let musicPad = null;

  /* AmbientPad - WebAudio ambient-pad music engine.
   * Final gain capped ~0.15 so it stays unobtrusive ambience. */
  class AmbientPad {
    constructor(ctx, masterDestination) {
      this.ctx = ctx;
      this.dest = masterDestination;
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.out.connect(this.dest);
      this.nodes = [];
      this.playing = false;
      this._vol = 0.0;
    }
    setVolume(v) {
      this._vol = Math.max(0, Math.min(1, v));
      if (!this.ctx) return;
      const target = this._vol * 0.15;
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.linearRampToValueAtTime(target, now + 0.4);
      if (target > 0 && !this.playing) this.start();
      if (target === 0 && this.playing) this.stop();
    }
    start() {
      if (this.playing || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = this._chord || [98.00, 123.47, 146.83, 185.00];
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 1.2;
      filter.connect(this.out);
      freqs.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = (i - freqs.length / 2) * 6;
        const g = this.ctx.createGain();
        g.gain.value = (i === 0 ? 0.35 : 0.18) / freqs.length;
        o.connect(g).connect(filter);
        o.start(now);
        this.nodes.push(o, g);
      });
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 280;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start(now);
      this.nodes.push(lfo, lfoGain, filter);
      this.playing = true;
    }
    stop() {
      if (!this.playing || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.linearRampToValueAtTime(0, now + 0.5);
      const nodes = this.nodes;
      this.nodes = [];
      this.playing = false;
      setTimeout(() => {
        for (const n of nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) {} }
      }, 700);
    }
    setChord(freqs) { this._chord = freqs; }
    resumeIfNeeded() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  }

  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
    if (audioCtx && !musicPad) {
      try {
        musicPad = new AmbientPad(audioCtx, audioCtx.destination);
        musicPad.setChord([98.00, 123.47, 146.83, 185.00]);
        applyMusicVolume();
      } catch (e) {}
    }
  }
  function applyMusicVolume() {
    if (musicPad) musicPad.setVolume(state.settings.musicVol || 0);
  }
  function playTone(freq, dur, type = 'sine', vol = 0.3) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    const sfx = state.settings.sfxVol;
    if (sfx <= 0) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq;
      o.type = type;
      g.gain.setValueAtTime(vol * sfx, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* noop */ }
  }
  const playFootstep   = () => { playTone(80, 0.05, 'sawtooth', 0.15); setTimeout(() => playTone(120, 0.03, 'sawtooth', 0.1), 10); };
  const playMetalCling = () => { playTone(800, 0.1, 'square', 0.4); playTone(1200, 0.15, 'sine', 0.3); playTone(600, 0.2, 'triangle', 0.2); };
  const playExhale     = () => { const f = 60 + Math.random()*40; playTone(f, 0.3, 'sawtooth', 0.25); setTimeout(() => playTone(f*0.7, 0.2, 'sawtooth', 0.15), 100); };
  const playScream     = () => { playTone(400, 0.1, 'sawtooth', 0.5); setTimeout(() => playTone(800, 0.15, 'sawtooth', 0.6), 50); setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.3), 200); setTimeout(() => playTone(1200, 0.1, 'square', 0.4), 100); };
  const playGulp       = () => { playTone(80, 0.15, 'sawtooth', 0.4); setTimeout(() => playTone(96, 0.1, 'sawtooth', 0.3), 50); setTimeout(() => playTone(56, 0.1, 'sawtooth', 0.2), 150); };
  const playCoin       = () => { playTone(1000, 0.08, 'square', 0.25); setTimeout(() => playTone(1400, 0.08, 'square', 0.2), 60); };

  function haptic(ms = 30) {
    if (!state.settings.haptics) return;
    if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {}
  }

  // ---------- Achievements helpers ----------
  function unlockAchievement(id) {
    if (state.achievements[id]) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    state.achievements[id] = { unlockedAt: Date.now() };
    lsSet(K.achievements, state.achievements);
    toast('Achievement: ' + def.name);
    haptic(50);
  }

  // ---------- Character/biome unlocks driven by distance ----------
  function checkProgressionUnlocks() {
    const best = state.bestDist;
    let changed = false;
    CHARS.forEach(c => {
      if (best >= c.unlock && !state.unlocks.characters.includes(c.id)) {
        state.unlocks.characters.push(c.id);
        changed = true;
        toast('Character unlocked: ' + c.name);
      }
    });
    BIOMES.forEach(b => {
      if (best >= b.unlock && !state.unlocks.biomes.includes(b.id)) {
        state.unlocks.biomes.push(b.id);
        changed = true;
        toast('Biome unlocked: ' + b.name);
      }
    });
    if (changed) lsSet(K.unlocks, state.unlocks);

    // Achievement checks tied to distance
    if (best >= 100)   unlockAchievement('first_steps');
    if (best >= 1000)  unlockAchievement('marathon');
    if (best >= 10000) unlockAchievement('ultramarathon');

    // Set-based achievements
    if (state.unlocks.biomes.length >= BIOMES.length) unlockAchievement('biome_explorer');
    if (state.unlocks.characters.length >= 3) unlockAchievement('skin_collector');
    if (state.unlocks.characters.length >= CHARS.length) unlockAchievement('master_runner');
  }

  // ---------- Stick figure draw (parameterized by character) ----------
  function drawCharacterTo(ctx2, charDef, hatId, x, y, opts) {
    opts = opts || {};
    const isJumping = opts.isJumping;
    const isSliding = opts.isSliding;
    const flipRotation = opts.flipRotation || 0;
    const isFlipping = opts.isFlipping;
    const isBackFlipping = opts.isBackFlipping;
    const animationFrame = opts.animationFrame || 0;
    const blink = opts.blink || 0;

    const headSize = 20;
    const bodyHeight = 40;
    const legLength = 30;
    const armLength = 15;

    ctx2.strokeStyle = charDef.color;
    ctx2.fillStyle = charDef.color;
    ctx2.lineWidth = 3;
    ctx2.lineCap = 'round';
    ctx2.lineJoin = 'round';

    ctx2.save();
    const centerX = x + headSize/2;
    const centerY = y + headSize/2 + bodyHeight/2;
    if (isFlipping || isBackFlipping) {
      ctx2.translate(centerX, centerY);
      ctx2.rotate((flipRotation * Math.PI) / 180);
      ctx2.translate(-centerX, -centerY);
    }

    let headY, headBounce;
    if (isSliding)      { headY = y + 25; headBounce = 0; }
    else if (isFlipping || isBackFlipping) { headY = y; headBounce = 0; }
    else                { headY = y; headBounce = isJumping ? 0 : Math.sin(animationFrame * 0.3) * 2; }

    // Head circle
    ctx2.beginPath();
    ctx2.arc(x + headSize/2, headY + headBounce, headSize/2, 0, Math.PI * 2);
    ctx2.stroke();

    // Eyes (small dots) — blink occasionally
    if (!isFlipping && !isBackFlipping && blink < 0.9) {
      ctx2.fillStyle = charDef.color;
      const ex = x + headSize/2;
      const ey = headY + headBounce - 2;
      ctx2.beginPath();
      ctx2.arc(ex - 4, ey, 1.2, 0, Math.PI * 2);
      ctx2.arc(ex + 4, ey, 1.2, 0, Math.PI * 2);
      ctx2.fill();
    }

    // Character accent: extra hint on head (e.g. ninja headband)
    if (charDef.accent) {
      ctx2.strokeStyle = charDef.accent;
      ctx2.lineWidth = 2;
      if (charDef.id === 'ninja') {
        ctx2.beginPath();
        ctx2.moveTo(x, headY + headBounce + 2);
        ctx2.lineTo(x + headSize, headY + headBounce + 2);
        ctx2.stroke();
      } else if (charDef.id === 'robot') {
        ctx2.strokeRect(x + 2, headY + headBounce - 8, headSize - 4, 6);
      } else if (charDef.id === 'alien') {
        ctx2.beginPath();
        ctx2.arc(x + headSize/2, headY + headBounce - headSize/2 - 4, 2, 0, Math.PI * 2);
        ctx2.stroke();
      } else if (charDef.id === 'zombie') {
        ctx2.beginPath();
        ctx2.moveTo(x + 4, headY + headBounce + 4);
        ctx2.lineTo(x + 8, headY + headBounce + 6);
        ctx2.stroke();
      } else if (charDef.id === 'knight') {
        ctx2.beginPath();
        ctx2.moveTo(x + headSize/2, headY + headBounce - headSize/2 - 5);
        ctx2.lineTo(x + headSize/2, headY + headBounce - headSize/2 + 2);
        ctx2.stroke();
      } else if (charDef.id === 'pirate') {
        ctx2.beginPath();
        ctx2.moveTo(x - 2, headY + headBounce - 2);
        ctx2.lineTo(x + 8, headY + headBounce - 2);
        ctx2.stroke();
      } else if (charDef.id === 'astronaut') {
        ctx2.strokeStyle = charDef.accent;
        ctx2.beginPath();
        ctx2.arc(x + headSize/2, headY + headBounce, headSize/2 + 3, 0, Math.PI * 2);
        ctx2.stroke();
      }
    }

    // Hat (overlay)
    drawHat(ctx2, hatId, x, headY + headBounce, headSize);

    ctx2.strokeStyle = charDef.color;
    ctx2.lineWidth = 3;

    // Body
    const bodyLean = isSliding ? 0 : (isJumping && !isFlipping && !isBackFlipping ? 0 : ((isFlipping || isBackFlipping) ? 0 : Math.sin(animationFrame * 0.3) * 3));
    const bodyX = x + headSize/2 + bodyLean;
    let bodyStartY = isSliding ? (headY + headSize/2) : (y + headSize/2);

    if (isFlipping || isBackFlipping) {
      const tuckAmount = Math.abs(Math.sin((flipRotation * Math.PI) / 180)) * 15;
      bodyStartY += tuckAmount;
      ctx2.beginPath();
      ctx2.moveTo(bodyX, bodyStartY);
      ctx2.lineTo(bodyX, bodyStartY + bodyHeight - tuckAmount);
      ctx2.stroke();
    } else if (isSliding) {
      ctx2.beginPath();
      ctx2.moveTo(bodyX, bodyStartY);
      ctx2.lineTo(bodyX + bodyHeight, bodyStartY);
      ctx2.stroke();
    } else {
      ctx2.beginPath();
      ctx2.moveTo(bodyX, bodyStartY);
      ctx2.lineTo(bodyX, bodyStartY + bodyHeight);
      ctx2.stroke();
    }

    // Arms
    let leftArmAngle, rightArmAngle;
    if (isFlipping || isBackFlipping) {
      const tuckPhase = (Math.abs(flipRotation) * Math.PI) / 180;
      leftArmAngle = Math.PI/2 + Math.sin(tuckPhase) * 0.5;
      rightArmAngle = Math.PI/2 - Math.sin(tuckPhase) * 0.5;
    } else if (isSliding) {
      leftArmAngle = Math.PI/4; rightArmAngle = Math.PI/4;
    } else if (isJumping) {
      leftArmAngle = Math.PI/3; rightArmAngle = Math.PI/3;
    } else {
      const swing = animationFrame * 0.4;
      leftArmAngle = Math.sin(swing) * (Math.PI/3) + Math.PI/6;
      rightArmAngle = -Math.sin(swing) * (Math.PI/3) + Math.PI/6;
    }
    const armY = isSliding ? bodyStartY : (y + headSize/2 + 10);
    ctx2.beginPath();
    ctx2.moveTo(bodyX, armY);
    ctx2.lineTo(bodyX - Math.cos(leftArmAngle)*armLength, armY + Math.sin(leftArmAngle)*armLength);
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(bodyX, armY);
    ctx2.lineTo(bodyX + Math.cos(rightArmAngle)*armLength, armY + Math.sin(rightArmAngle)*armLength);
    ctx2.stroke();

    // Legs
    let leftLegAngle, rightLegAngle;
    let legStartY = isSliding ? bodyStartY : (y + headSize/2 + bodyHeight);
    if (isFlipping || isBackFlipping) {
      const tp = (Math.abs(flipRotation) * Math.PI) / 180;
      legStartY = bodyStartY + bodyHeight;
      leftLegAngle = Math.PI*0.8 + Math.sin(tp)*0.3;
      rightLegAngle = Math.PI*0.8 - Math.sin(tp)*0.3;
    } else if (isSliding) {
      leftLegAngle = Math.PI*0.7; rightLegAngle = Math.PI*0.7;
    } else if (isJumping) {
      leftLegAngle = Math.PI/6; rightLegAngle = -Math.PI/6;
    } else {
      const run = animationFrame * 0.4;
      leftLegAngle = Math.sin(run)*(Math.PI/4) + Math.PI/12;
      rightLegAngle = -Math.sin(run)*(Math.PI/4) - Math.PI/12;
    }
    ctx2.beginPath();
    ctx2.moveTo(bodyX, legStartY);
    ctx2.lineTo(bodyX - Math.cos(leftLegAngle)*legLength, legStartY + Math.sin(leftLegAngle)*legLength);
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(bodyX, legStartY);
    ctx2.lineTo(bodyX + Math.cos(rightLegAngle)*legLength, legStartY + Math.sin(rightLegAngle)*legLength);
    ctx2.stroke();

    ctx2.restore();
  }

  // ---------- Hat drawing ----------
  function drawHat(ctx2, hatId, x, headY, headSize) {
    const hat = HATS.find(h => h.id === hatId);
    if (!hat || !hat.color) return;
    ctx2.fillStyle = hat.color;
    ctx2.strokeStyle = hat.color;
    ctx2.lineWidth = 2;
    const cx = x + headSize/2;
    const topY = headY - headSize/2;
    switch (hat.id) {
      case 'cap':
        ctx2.fillRect(cx - 10, topY - 4, 20, 6);
        ctx2.fillRect(cx - 14, topY + 2, 18, 3); // brim
        break;
      case 'tophat':
        ctx2.fillRect(cx - 8, topY - 14, 16, 14);
        ctx2.fillRect(cx - 12, topY - 2, 24, 3);
        break;
      case 'crown':
        ctx2.beginPath();
        ctx2.moveTo(cx - 10, topY);
        ctx2.lineTo(cx - 8, topY - 8);
        ctx2.lineTo(cx - 4, topY - 2);
        ctx2.lineTo(cx, topY - 10);
        ctx2.lineTo(cx + 4, topY - 2);
        ctx2.lineTo(cx + 8, topY - 8);
        ctx2.lineTo(cx + 10, topY);
        ctx2.closePath();
        ctx2.fill();
        break;
      case 'beanie':
        ctx2.beginPath();
        ctx2.arc(cx, topY, 10, Math.PI, 0);
        ctx2.fill();
        ctx2.fillRect(cx - 1, topY - 14, 2, 4);
        break;
      case 'wizard':
        ctx2.beginPath();
        ctx2.moveTo(cx - 10, topY + 2);
        ctx2.lineTo(cx + 10, topY + 2);
        ctx2.lineTo(cx, topY - 16);
        ctx2.closePath();
        ctx2.fill();
        break;
      case 'cowboy':
        ctx2.fillRect(cx - 7, topY - 7, 14, 8);
        ctx2.fillRect(cx - 14, topY + 1, 28, 3);
        break;
      case 'halo':
        ctx2.strokeStyle = hat.color;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.ellipse(cx, topY - 3, 11, 3, 0, 0, Math.PI*2);
        ctx2.stroke();
        break;
      case 'horns':
        ctx2.beginPath();
        ctx2.moveTo(cx - 8, topY);
        ctx2.quadraticCurveTo(cx - 10, topY - 10, cx - 4, topY - 6);
        ctx2.closePath();
        ctx2.fill();
        ctx2.beginPath();
        ctx2.moveTo(cx + 8, topY);
        ctx2.quadraticCurveTo(cx + 10, topY - 10, cx + 4, topY - 6);
        ctx2.closePath();
        ctx2.fill();
        break;
    }
  }

  // ---------- Front-card render: small character previews ----------
  function renderCharSlots() {
    const grid = document.getElementById('characterRoster');
    if (!grid) return;
    grid.innerHTML = '';
    CHARS.forEach(c => {
      const unlocked = state.unlocks.characters.includes(c.id);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot' + (state.selectedChar === c.id ? ' selected' : '') + (unlocked ? '' : ' locked');
      slot.setAttribute('aria-label', c.name + (unlocked ? ' (selected)' : ' locked'));
      slot.setAttribute('aria-pressed', state.selectedChar === c.id ? 'true' : 'false');
      slot.disabled = !unlocked;

      const canv = document.createElement('canvas');
      canv.width = 56; canv.height = 70;
      slot.appendChild(canv);
      const cctx = canv.getContext('2d');
      // Draw idle character preview, scaled
      cctx.save();
      cctx.translate(8, 0);
      drawCharacterTo(cctx, c, state.selected.hat, 10, 0, { animationFrame: 0, blink: 0 });
      cctx.restore();

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = c.name;
      slot.appendChild(label);

      const req = document.createElement('div');
      req.className = 'req';
      req.textContent = unlocked ? '✓' : (c.unlock + 'm');
      slot.appendChild(req);

      slot.addEventListener('click', () => {
        if (!unlocked) { toast('Locked: reach ' + c.unlock + 'm'); return; }
        state.selectedChar = c.id;
        lsSet(K.selectedChar, c.id);
        renderCharSlots();
      });
      grid.appendChild(slot);
    });
  }

  // ---------- Front-card render: biome strip ----------
  function renderBiomeStrip() {
    const strip = document.getElementById('biomeStrip');
    if (!strip) return;
    strip.innerHTML = '';
    BIOMES.forEach(b => {
      const unlocked = state.unlocks.biomes.includes(b.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'biome-card' + (state.selectedBiome === b.id ? ' selected' : '') + (unlocked ? '' : ' locked');
      card.setAttribute('aria-label', b.name + (unlocked ? ' selected' : ' locked at ' + b.unlock + ' meters'));
      card.setAttribute('aria-pressed', state.selectedBiome === b.id ? 'true' : 'false');
      card.disabled = !unlocked;

      const prev = document.createElement('div');
      prev.className = 'preview';
      prev.style.background = `linear-gradient(to bottom, ${b.sky[0]}, ${b.sky[1]}, ${b.sky[2]})`;
      card.appendChild(prev);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = b.name;
      card.appendChild(name);

      const req = document.createElement('div');
      req.className = 'req';
      req.textContent = unlocked ? '✓ Unlocked' : ('Unlock at ' + b.unlock + 'm');
      card.appendChild(req);

      card.addEventListener('click', () => {
        if (!unlocked) { toast('Locked: reach ' + b.unlock + 'm'); return; }
        state.selectedBiome = b.id;
        lsSet(K.selectedBiome, b.id);
        renderBiomeStrip();
      });
      strip.appendChild(card);
    });
  }

  function renderTopBar() {
    const c = document.getElementById('coinsHud');
    const d = document.getElementById('distHud');
    if (c) c.textContent = 'Coins: ' + state.coins;
    if (d) d.textContent = 'Best: ' + Math.floor(state.bestDist) + 'm';
  }

  // ---------- Router ----------
  const ROUTES = ['menu', 'play', 'settings', 'leaderboard', 'achievements', 'shop', 'characters', 'daily', 'how-to', 'credits'];

  function parseHash() {
    const h = (location.hash || '#menu').replace(/^#/, '');
    const parts = h.split('/');
    return { route: parts[0] || 'menu', arg: parts[1] || null };
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
    // Move focus into screen for a11y
    setTimeout(() => {
      if (!el) return;
      const focusable = el.querySelector('button, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus({ preventScroll: true });
    }, 0);
  }

  function navigate(hash) {
    if (location.hash !== hash) location.hash = hash;
    else routeChanged();
  }

  function routeChanged() {
    const { route, arg } = parseHash();
    // Stop running game when leaving 'play'
    if (route !== 'play' && Game.isRunning()) {
      Game.abort();
    }
    if (route === 'menu') {
      renderTopBar();
      renderBiomeStrip();
      renderCharSlots();
      showScreen('menuScreen');
    } else if (route === 'play') {
      const biomeId = arg || state.selectedBiome;
      const charId = state.selectedChar;
      showScreen('gameScreen');
      Game.start({ biomeId, charId, daily: false });
    } else if (route === 'daily') {
      showScreen('gameScreen');
      Game.start({ biomeId: dailyBiomeId(), charId: state.selectedChar, daily: true });
    } else if (route === 'settings')      { renderSettings(); showScreen('settingsScreen'); }
    else if (route === 'leaderboard')     { renderLeaderboard(); showScreen('leaderboardScreen'); }
    else if (route === 'achievements')    { renderAchievements(); showScreen('achievementsScreen'); }
    else if (route === 'shop')            { renderShop(); showScreen('shopScreen'); }
    else if (route === 'characters')      { renderCharSlots(); showScreen('menuScreen'); /* roster lives on menu */ }
    else if (route === 'how-to')          { showScreen('howToScreen'); }
    else if (route === 'credits')         { showScreen('creditsScreen'); }
    else { location.hash = '#menu'; }
  }

  // ---------- Daily seed ----------
  function dailySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth()+1) * 100 + d.getUTCDate();
  }
  function dailyBiomeId() {
    const seed = dailySeed();
    return BIOMES[seed % BIOMES.length].id;
  }
  function todayKey() {
    const d = new Date();
    return d.getUTCFullYear() + '-' + (d.getUTCMonth()+1) + '-' + d.getUTCDate();
  }
  function bumpDailyStreak() {
    const today = todayKey();
    if (state.lastDaily === today) return;
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const yKey = y.getUTCFullYear() + '-' + (y.getUTCMonth()+1) + '-' + y.getUTCDate();
    if (state.lastDaily === yKey) state.dailyStreak += 1;
    else state.dailyStreak = 1;
    state.lastDaily = today;
    lsSet(K.dailyStreak, state.dailyStreak);
    lsSet(K.lastDaily, state.lastDaily);
    if (state.dailyStreak >= 7) unlockAchievement('daily_streak_7');
  }

  // ---------- Settings UI ----------
  function renderSettings() {
    const root = document.getElementById('settingsScreen');
    if (!root) return;
    const s = state.settings;
    root.innerHTML = `
      <h1>SETTINGS</h1>
      <div class="form-row"><label for="sfxVol">SFX volume</label>
        <input type="range" id="sfxVol" min="0" max="1" step="0.05" value="${s.sfxVol}"></div>
      <div class="form-row"><label for="musicVol">Music volume</label>
        <input type="range" id="musicVol" min="0" max="1" step="0.05" value="${s.musicVol}"></div>
      <div class="form-row"><label for="haptics">Haptics</label>
        <input type="checkbox" id="haptics" ${s.haptics ? 'checked' : ''}></div>
      <div class="form-row"><label for="colorblind">Colorblind mode (striped obstacles)</label>
        <input type="checkbox" id="colorblind" ${s.colorblind ? 'checked' : ''}></div>
      <div class="form-row"><label for="reducedMotion">Reduced motion</label>
        <input type="checkbox" id="reducedMotion" ${s.reducedMotion ? 'checked' : ''}></div>
      <div class="form-row"><label>Control style</label>
        <div>
          <label><input type="radio" name="ctrl" value="tap" ${s.control==='tap'?'checked':''}> Tap anywhere</label>
          &nbsp;
          <label><input type="radio" name="ctrl" value="button" ${s.control==='button'?'checked':''}> Button</label>
        </div></div>
      <div class="form-row"><label for="language">Language</label>
        <select id="language"><option value="en" ${s.language==='en'?'selected':''}>English</option></select></div>
      <div class="cta-row">
        <button class="button ghost" id="settingsBack">BACK</button>
        <button class="button danger" id="resetProgress">RESET PROGRESS</button>
      </div>
    `;
    root.querySelector('#sfxVol').addEventListener('input', e => { s.sfxVol = parseFloat(e.target.value); lsSet(K.settings, s); });
    root.querySelector('#musicVol').addEventListener('input', e => { s.musicVol = parseFloat(e.target.value); lsSet(K.settings, s); applyMusicVolume(); });
    root.querySelector('#haptics').addEventListener('change', e => { s.haptics = e.target.checked; lsSet(K.settings, s); });
    root.querySelector('#colorblind').addEventListener('change', e => { s.colorblind = e.target.checked; lsSet(K.settings, s); applySettingsToBody(); });
    root.querySelector('#reducedMotion').addEventListener('change', e => { s.reducedMotion = e.target.checked; lsSet(K.settings, s); applySettingsToBody(); });
    root.querySelectorAll('input[name=ctrl]').forEach(r => r.addEventListener('change', e => { s.control = e.target.value; lsSet(K.settings, s); applySettingsToBody(); }));
    root.querySelector('#language').addEventListener('change', e => { s.language = e.target.value; lsSet(K.settings, s); });
    root.querySelector('#settingsBack').addEventListener('click', () => navigate('#menu'));
    root.querySelector('#resetProgress').addEventListener('click', () => {
      if (confirm('Reset ALL progress (records, unlocks, coins, achievements)? This cannot be undone.')) {
        Object.values(K).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        location.reload();
      }
    });
  }

  // ---------- Leaderboard UI ----------
  let lbTab = 'overall';
  function renderLeaderboard() {
    const root = document.getElementById('leaderboardScreen');
    if (!root) return;
    const tabs = ['overall', 'forest', 'desert', 'city', 'space', 'daily'];
    root.innerHTML = `
      <h1>LEADERBOARD</h1>
      <div class="tabs" role="tablist">
        ${tabs.map(t => `<button class="tab ${t===lbTab?'active':''}" data-tab="${t}" role="tab" aria-selected="${t===lbTab}">${t.toUpperCase()}</button>`).join('')}
      </div>
      <div class="list" id="lbList" role="region" aria-label="Leaderboard entries"></div>
      <div class="cta-row"><button class="button ghost" id="lbBack">BACK</button></div>
    `;
    root.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
      lbTab = btn.dataset.tab;
      renderLeaderboard();
    }));
    root.querySelector('#lbBack').addEventListener('click', () => navigate('#menu'));
    const list = root.querySelector('#lbList');
    const entries = (state.leaderboard[lbTab] || []).slice(0, 10);
    if (!entries.length) {
      list.innerHTML = '<div class="row"><span>(no entries yet)</span></div>';
    } else {
      list.innerHTML = entries.map((e, i) =>
        `<div class="row"><span>${(i+1).toString().padStart(2,'0')}. ${escapeHtml(e.name)}</span><span>${Math.floor(e.dist)}m</span></div>`
      ).join('');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function maybeAddToLeaderboard(boardKey, dist) {
    const board = state.leaderboard[boardKey] || [];
    const tenth = board.length >= 10 ? board[board.length-1].dist : -1;
    if (board.length < 10 || dist > tenth) {
      const name = (prompt('NEW BEST! Enter 3-letter name', 'AAA') || 'AAA')
        .replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'A');
      board.push({ name, dist, date: Date.now() });
      board.sort((a, b) => b.dist - a.dist);
      state.leaderboard[boardKey] = board.slice(0, 10);
      lsSet(K.leaderboard, state.leaderboard);
    }
  }

  // ---------- Achievements UI ----------
  function renderAchievements() {
    const root = document.getElementById('achievementsScreen');
    if (!root) return;
    root.innerHTML = `
      <h1>ACHIEVEMENTS</h1>
      <div class="list" role="region" aria-label="Achievements list">
        ${ACHIEVEMENTS.map(a => {
          const u = !!state.achievements[a.id];
          return `<div class="achievement ${u?'':'locked'}">
            <div>${u?'🏆':'🔒'}</div>
            <div><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="cta-row"><button class="button ghost" id="achBack">BACK</button></div>
    `;
    root.querySelector('#achBack').addEventListener('click', () => navigate('#menu'));
  }

  // ---------- Shop UI ----------
  function renderShop() {
    const root = document.getElementById('shopScreen');
    if (!root) return;
    function gridFor(items, group, ownedKey, selectedKey) {
      return items.map(it => {
        const owned = state.unlocks[ownedKey].includes(it.id);
        const selected = state.selected[selectedKey] === it.id;
        return `<div class="shop-item ${owned?'owned':''} ${selected?'selected':''}" data-group="${group}" data-id="${it.id}">
          <canvas width="60" height="50"></canvas>
          <div>${it.name}</div>
          <div style="font-size:0.8rem;color:var(--muted)">${owned ? (selected?'EQUIPPED':'Tap to equip') : it.price + '¢'}</div>
        </div>`;
      }).join('');
    }
    root.innerHTML = `
      <h1>SHOP</h1>
      <div style="margin-bottom:8px">Coins: <strong>${state.coins}</strong></div>
      <h2>HATS</h2>
      <div class="shop-grid" id="hatsGrid">${gridFor(HATS, 'hat', 'hats', 'hat')}</div>
      <h2 style="margin-top:14px">TRAILS</h2>
      <div class="shop-grid" id="trailsGrid">${gridFor(TRAILS, 'trail', 'trails', 'trail')}</div>
      <div class="cta-row"><button class="button ghost" id="shopBack">BACK</button></div>
    `;
    // Draw hat previews
    root.querySelectorAll('#hatsGrid .shop-item').forEach(el => {
      const id = el.dataset.id;
      const cv = el.querySelector('canvas');
      const cx = cv.getContext('2d');
      // Mini head with hat
      cx.strokeStyle = '#fff'; cx.fillStyle = '#fff';
      cx.beginPath(); cx.arc(30, 30, 10, 0, Math.PI*2); cx.stroke();
      drawHat(cx, id, 20, 30, 20);
    });
    // Draw trail previews
    root.querySelectorAll('#trailsGrid .shop-item').forEach(el => {
      const id = el.dataset.id;
      const cv = el.querySelector('canvas');
      const cx = cv.getContext('2d');
      const t = TRAILS.find(x => x.id === id);
      if (t && t.color) {
        for (let i = 0; i < 5; i++) {
          cx.fillStyle = t.color + Math.floor(255 - i*40).toString(16).padStart(2,'0');
          cx.beginPath(); cx.arc(15 + i*9, 25 + Math.sin(i*0.7)*4, 4 - i*0.6, 0, Math.PI*2); cx.fill();
        }
      } else {
        cx.strokeStyle = '#888';
        cx.fillStyle = '#888';
        cx.font = '12px sans-serif'; cx.textAlign = 'center';
        cx.fillText('(none)', 30, 30);
      }
    });

    function handleClick(group) {
      return (e) => {
        const item = e.target.closest('.shop-item');
        if (!item) return;
        const id = item.dataset.id;
        const items = group === 'hat' ? HATS : TRAILS;
        const ownedKey = group === 'hat' ? 'hats' : 'trails';
        const def = items.find(x => x.id === id);
        if (!def) return;
        const owned = state.unlocks[ownedKey].includes(id);
        if (!owned) {
          if (state.coins < def.price) { toast('Not enough coins'); return; }
          state.coins -= def.price;
          state.unlocks[ownedKey].push(id);
          lsSet(K.coins, state.coins);
          lsSet(K.unlocks, state.unlocks);
          toast('Purchased: ' + def.name);
        }
        state.selected[group] = id;
        lsSet(K.selected, state.selected);
        renderShop();
      };
    }
    root.querySelector('#hatsGrid').addEventListener('click', handleClick('hat'));
    root.querySelector('#trailsGrid').addEventListener('click', handleClick('trail'));
    root.querySelector('#shopBack').addEventListener('click', () => navigate('#menu'));
  }

  // ============================================================
  // ================= GAME (ported from web-version.html) =======
  // ============================================================
  const Game = (function () {
    let canvas, ctx;
    let GROUND_Y, PLAYER_X;
    let gameState = 'idle';
    let score = 0;
    let distance = 0;
    let runCoins = 0;
    let playerY;
    let isJumping = false, isSliding = false;
    let jumpVelocity = 0, slideTimer = 0;
    let obstacles = [];
    let gameSpeed = OBSTACLE_SPEED_INITIAL;
    let lastObstacleSpawn = 0;
    let gameLoop = null, scoreInterval = null;
    let lastFrameTime = 0;
    let animationFrame = 0;
    let touchStartY = 0;
    let isBoosting = false;
    let bloodParticles = [], dustParticles = [];
    let trailParticles = [];
    let headParticle = null;
    let lastFootstepTime = 0, lastExhaleTime = 0;
    let gameOverPending = false, isPaused = false;
    let canDoubleJump = false;
    let isFlipping = false, isBackFlipping = false;
    let flipRotation = 0, flipDirection = 1;
    let canDoubleSlide = false;
    let cameraShake = 0, cameraOffsetX = 0, cameraOffsetY = 0;
    let isRebounding = false, reboundVelocityX = 0, reboundVelocityY = 0;
    let bgOffset = 0;
    let blinkPhase = 0;
    let activeBiome = BIOMES[0];
    let activeChar  = CHARS[0];
    let dailyMode = false;
    let runAirDoubleJumps = 0;
    let runCloseCalls = 0;
    let hitMaxSpeed = false;

    function isRunning() { return gameState === 'playing' || gameState === 'gameover'; }

    function abort() {
      gameState = 'idle';
      if (gameLoop) { cancelAnimationFrame(gameLoop); gameLoop = null; }
      if (scoreInterval) { clearInterval(scoreInterval); scoreInterval = null; }
      isPaused = false;
    }

    function ensureCanvas() {
      canvas = document.getElementById('gameCanvas');
      if (!canvas) return false;
      ctx = canvas.getContext('2d');
      resizeCanvas();
      return true;
    }

    function resizeCanvas() {
      if (!canvas) return;
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Use CSS pixels for game math
      const prev = GROUND_Y;
      GROUND_Y = cssH * 0.75;
      PLAYER_X = cssW * 0.2;
      if (gameState === 'playing' && typeof playerY === 'number' && prev) {
        playerY += (GROUND_Y - prev);
      }
    }

    function cssWidth()  { return canvas.clientWidth  || window.innerWidth; }
    function cssHeight() { return canvas.clientHeight || window.innerHeight; }

    function start(opts) {
      if (!ensureCanvas()) return;
      activeBiome = BIOMES.find(b => b.id === opts.biomeId) || BIOMES[0];
      activeChar  = CHARS.find(c => c.id === opts.charId) || CHARS[0];
      dailyMode = !!opts.daily;

      gameState = 'playing';
      score = 0;
      distance = 0;
      runCoins = 0;
      runAirDoubleJumps = 0;
      runCloseCalls = 0;
      hitMaxSpeed = false;
      playerY = GROUND_Y - 80;
      isJumping = false; isSliding = false; isBoosting = false;
      jumpVelocity = 0; slideTimer = 0;
      obstacles = []; bloodParticles = []; dustParticles = []; trailParticles = [];
      headParticle = null;
      gameSpeed = OBSTACLE_SPEED_INITIAL;
      lastObstacleSpawn = Date.now();
      lastFrameTime = Date.now();
      lastFootstepTime = Date.now();
      lastExhaleTime = Date.now();
      canDoubleJump = false; canDoubleSlide = false;
      isFlipping = false; isBackFlipping = false;
      flipRotation = 0; flipDirection = 1;
      cameraShake = 0; cameraOffsetX = 0; cameraOffsetY = 0;
      isRebounding = false; reboundVelocityX = 0; reboundVelocityY = 0;
      gameOverPending = false; isPaused = false;
      bgOffset = 0; blinkPhase = 0;

      updateHud();
      // Hide game-over UI if visible
      const goEl = document.getElementById('gameOverScreen');
      if (goEl) goEl.classList.remove('visible');

      if (gameLoop) cancelAnimationFrame(gameLoop);
      if (scoreInterval) clearInterval(scoreInterval);
      scoreInterval = setInterval(tickScore, 100);
      gameLoop = requestAnimationFrame(updateGame);
    }

    function tickScore() {
      if (isPaused || gameState !== 'playing') return;
      score++;
      const scoreText = document.getElementById('scoreText');
      const speedText = document.getElementById('speedText');
      if (score % 10 === 0) {
        gameSpeed = Math.min(gameSpeed + 0.3, MAX_SPEED);
        if (gameSpeed >= MAX_SPEED) hitMaxSpeed = true;
        if (speedText) speedText.textContent = 'Speed: ' + gameSpeed.toFixed(1) + 'x';
      }
      if (scoreText) scoreText.textContent = 'Score: ' + score;
    }

    function updateHud() {
      const scoreText = document.getElementById('scoreText');
      const speedText = document.getElementById('speedText');
      const coinHud = document.getElementById('coinHud');
      const boost = document.getElementById('boostIndicator');
      if (scoreText) scoreText.textContent = 'Score: ' + score;
      if (speedText) speedText.textContent = 'Speed: ' + gameSpeed.toFixed(1) + 'x';
      if (coinHud) coinHud.textContent = 'Coins: +' + runCoins;
      if (boost) boost.classList.toggle('active', !!isBoosting);
    }

    function pauseToggle() {
      if (gameState !== 'playing') return;
      isPaused = !isPaused;
      if (!isPaused) {
        lastFrameTime = Date.now();
        if (audioCtx && audioCtx.state === 'suspended') {
          try { audioCtx.resume(); } catch (e) {}
        }
      } else {
        if (audioCtx && audioCtx.state === 'running') {
          try { audioCtx.suspend(); } catch (e) {}
        }
      }
    }

    function jump() {
      if (gameState !== 'playing' || isSliding || isPaused) return;
      if (!isJumping) {
        isJumping = true;
        jumpVelocity = -22;
        canDoubleJump = true;
        isFlipping = false; flipRotation = 0;
        playTone(440, 0.08, 'square', 0.18);
        haptic(15);
      } else if (canDoubleJump && isJumping) {
        canDoubleJump = false;
        jumpVelocity = -20;
        isFlipping = true; isBackFlipping = false;
        flipDirection = 1; flipRotation = 0;
        runAirDoubleJumps++;
        if (runAirDoubleJumps >= 5) unlockAchievement('double_jumper');
        playTone(660, 0.1, 'square', 0.2);
        haptic(20);
      }
    }

    function jumpRelease() {
      if (isJumping && jumpVelocity < -8) jumpVelocity = -8;
    }

    function backflip() {
      if (gameState !== 'playing' || isSliding) return;
      if (!isJumping) {
        isJumping = true; jumpVelocity = -22;
        isBackFlipping = true; isFlipping = false;
        flipDirection = -1; flipRotation = 0;
        canDoubleJump = true;
      } else if (canDoubleJump && isJumping) {
        canDoubleJump = false; jumpVelocity = -20;
        isBackFlipping = true; isFlipping = false;
        flipDirection = -1; flipRotation = 0;
        runAirDoubleJumps++;
        if (runAirDoubleJumps >= 5) unlockAchievement('double_jumper');
      }
    }

    function slide() {
      if (gameState !== 'playing' || isJumping) return;
      if (!isSliding) { isSliding = true; slideTimer = 0; canDoubleSlide = true; }
      else if (canDoubleSlide && isSliding) { canDoubleSlide = false; slideTimer = 0; }
    }
    function stopSlide() {
      if (isSliding) { isSliding = false; slideTimer = 0; canDoubleSlide = false; }
    }

    function createBloodSplash(y, x, vx, vy) {
      vx = vx || 0; vy = vy || 0;
      for (let i = 0; i < 15; i++) {
        bloodParticles.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 8 + vx,
          vy: (Math.random() - 0.5) * 8 + vy,
          life: 30, size: Math.random() * 4 + 2,
        });
      }
    }
    function createDecapitation(y, x) {
      for (let i = 0; i < 25; i++) {
        bloodParticles.push({
          x, y,
          vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
          life: 40, size: Math.random() * 5 + 3,
        });
      }
      headParticle = { x, y, vx: 5 + Math.random()*5, vy: -8 - Math.random()*5, rotation: 0, rotationSpeed: (Math.random()-0.5)*0.3, life: 60, size: 20 };
    }
    function updateBloodParticles() {
      bloodParticles = bloodParticles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--; return p.life > 0;
      });
      bloodParticles.forEach(p => {
        const a = p.life / 40;
        ctx.fillStyle = `rgba(200,0,0,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(150,0,0,${a*0.5})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size*0.5, 0, Math.PI*2); ctx.fill();
      });
      if (headParticle) {
        const h = headParticle;
        h.x += h.vx; h.y += h.vy; h.vy += 0.5; h.rotation += h.rotationSpeed; h.life--;
        if (h.life > 0) {
          const a = h.life / 60;
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(h.rotation);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, h.size/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `rgba(0,0,0,${a})`;
          ctx.beginPath(); ctx.arc(-5, -3, 2, 0, Math.PI*2); ctx.arc(5, -3, 2, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        } else { headParticle = null; }
      }
    }

    function spawnDust(x, y) {
      for (let i = 0; i < 8; i++) {
        dustParticles.push({
          x: x + (Math.random()-0.5)*10, y,
          vx: (Math.random()-0.5)*3 - 1, vy: -Math.random()*2 - 0.5,
          life: 24, size: Math.random()*3 + 1.5,
        });
      }
    }
    function updateDust() {
      dustParticles = dustParticles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.96; p.life--; return p.life > 0;
      });
      dustParticles.forEach(p => {
        const a = p.life / 24;
        ctx.fillStyle = `rgba(200,200,210,${a*0.6})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      });
    }

    function spawnTrail() {
      const t = TRAILS.find(x => x.id === state.selected.trail);
      if (!t || !t.color) return;
      trailParticles.push({ x: PLAYER_X + 10, y: playerY + 40, life: 18, color: t.color, size: 4 + Math.random()*2 });
    }
    function updateTrail() {
      trailParticles = trailParticles.filter(p => { p.life--; p.x -= 1.5; return p.life > 0; });
      trailParticles.forEach(p => {
        const a = p.life / 18;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // Background per biome
    function drawBiomeSky() {
      const sky = activeBiome.sky;
      const g = ctx.createLinearGradient(0, 0, 0, cssHeight());
      g.addColorStop(0, sky[0]);
      g.addColorStop(0.5, sky[1]);
      g.addColorStop(1, sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssWidth(), cssHeight());
    }

    function drawParallax(speed) {
      if (state.settings.reducedMotion) return;
      bgOffset = (bgOffset + speed * 0.3) % cssWidth();
      const w = cssWidth();
      // Layer 1 silhouettes
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 6; i++) {
        const baseX = (i * 220 - bgOffset * 0.3) % (w + 220);
        const x = baseX < -220 ? baseX + w + 220 : baseX;
        const h = 80 + (i % 3) * 25;
        if (activeBiome.id === 'forest') {
          // Tree silhouettes
          ctx.beginPath();
          ctx.moveTo(x, GROUND_Y);
          ctx.lineTo(x + 110, GROUND_Y - h);
          ctx.lineTo(x + 220, GROUND_Y);
          ctx.closePath();
          ctx.fill();
        } else if (activeBiome.id === 'desert') {
          // Dune
          ctx.beginPath();
          ctx.arc(x + 110, GROUND_Y, 110, Math.PI, 0);
          ctx.fill();
        } else if (activeBiome.id === 'city') {
          // Building rectangles
          ctx.fillRect(x + 20, GROUND_Y - h, 30, h);
          ctx.fillRect(x + 70, GROUND_Y - h*0.7, 40, h*0.7);
          ctx.fillRect(x + 140, GROUND_Y - h*1.1, 50, h*1.1);
        } else {
          // Space distant nebula
          ctx.fillRect(x, GROUND_Y - h, 220, h);
        }
      }
      // Stars / details
      if (activeBiome.id === 'space') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 60; i++) {
          const sx = ((i * 137 - bgOffset * 0.1) % w + w) % w;
          const sy = (i * 53) % (GROUND_Y - 40);
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      } else if (activeBiome.id === 'city') {
        // Animated billboard
        const t = Date.now() / 300;
        ctx.fillStyle = `hsla(${(t*30)%360}, 90%, 60%, 0.4)`;
        ctx.fillRect((w*0.3 - bgOffset*0.5 + w) % w, GROUND_Y - 180, 80, 50);
      } else if (activeBiome.id === 'desert') {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let i = 0; i < 15; i++) {
          const sx = ((i*97 - bgOffset*0.2) % w + w) % w;
          const sy = (i*40) % (GROUND_Y - 60);
          ctx.fillRect(sx, sy, 1, 1);
        }
      } else {
        // Stars (forest mild)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 20; i++) {
          const sx = ((i*137 - bgOffset*0.15) % w + w) % w;
          const sy = (i*53) % (GROUND_Y - 40);
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }
    }

    function drawGround() {
      ctx.strokeStyle = activeBiome.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(cssWidth(), GROUND_Y);
      ctx.stroke();
    }

    // Obstacle palette per biome
    function obstacleColors(type) {
      const cb = state.settings.colorblind;
      if (type === 'ceiling') {
        switch (activeBiome.id) {
          case 'forest': return { fill: 'rgba(120, 220, 130, 0.22)', stroke: 'rgba(120, 220, 130, 0.55)' };
          case 'desert': return { fill: 'rgba(255, 180, 80, 0.22)', stroke: 'rgba(255, 180, 80, 0.55)' };
          case 'city':   return { fill: 'rgba(255, 80, 200, 0.22)', stroke: 'rgba(255, 80, 200, 0.6)' };
          case 'space':  return { fill: 'rgba(140, 200, 255, 0.22)', stroke: 'rgba(140, 200, 255, 0.6)' };
        }
      }
      // ground
      if (cb) return { fill: 'rgba(220,220,255,0.18)', stroke: 'rgba(255,255,255,0.7)' };
      switch (activeBiome.id) {
        case 'forest': return { fill: 'rgba(80, 200, 100, 0.22)', stroke: 'rgba(80, 200, 100, 0.55)' };
        case 'desert': return { fill: 'rgba(255, 150, 60, 0.22)', stroke: 'rgba(255, 150, 60, 0.55)' };
        case 'city':   return { fill: 'rgba(180, 100, 255, 0.22)', stroke: 'rgba(180, 100, 255, 0.55)' };
        case 'space':  return { fill: 'rgba(200, 200, 230, 0.22)', stroke: 'rgba(200, 200, 230, 0.55)' };
      }
      return { fill: 'rgba(220,220,255,0.2)', stroke: 'rgba(220,220,255,0.4)' };
    }

    function drawObstacle(obs) {
      const { x, type, height, bottom } = obs;
      const col = obstacleColors(type);
      ctx.fillStyle = col.fill;
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = 2;

      const centerX = x + 10;
      const baseWidth = 60;
      const leftBase = centerX - baseWidth/2;
      const rightBase = centerX + baseWidth/2;

      if (type === 'ceiling' && bottom !== undefined) {
        const slideHeadY = GROUND_Y - 80 + 25;
        const maxBottom = slideHeadY - 10;
        const tipY = Math.min(bottom, maxBottom);
        const baseY = 0;
        ctx.beginPath();
        ctx.moveTo(leftBase, baseY);
        ctx.lineTo(centerX, tipY);
        ctx.lineTo(rightBase, baseY);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        const tipY = GROUND_Y - height;
        const baseY = GROUND_Y;
        ctx.beginPath();
        ctx.moveTo(leftBase, baseY);
        ctx.lineTo(centerX, tipY);
        ctx.lineTo(rightBase, baseY);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Colorblind stripes
        if (state.settings.colorblind) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(leftBase, baseY); ctx.lineTo(centerX, tipY); ctx.lineTo(rightBase, baseY); ctx.closePath();
          ctx.clip();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          for (let yy = tipY; yy < baseY; yy += 6) {
            ctx.beginPath(); ctx.moveTo(leftBase, yy); ctx.lineTo(rightBase, yy); ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    function updateGame() {
      if (gameState !== 'playing') return;
      if (isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, cssWidth(), cssHeight());
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', cssWidth()/2, cssHeight()/2);
        ctx.font = '16px Arial';
        ctx.fillText('Press P to resume — Esc to menu', cssWidth()/2, cssHeight()/2 + 36);
        lastFrameTime = Date.now();
        gameLoop = requestAnimationFrame(updateGame);
        return;
      }

      const now = Date.now();
      lastFrameTime = now;

      // Animation/footsteps/exhales
      if (!isJumping && !isSliding) {
        animationFrame += gameSpeed * 0.5;
        const fsInt = Math.max(200, 400 - (gameSpeed - OBSTACLE_SPEED_INITIAL) * 20);
        if (now - lastFootstepTime > fsInt) { playFootstep(); lastFootstepTime = now; }
      }
      blinkPhase = (blinkPhase + 0.02) % 1;

      if (gameState === 'playing' && score > 20 && Math.random() < 0.001 && now - lastExhaleTime > 3000) {
        playExhale(); lastExhaleTime = now;
      }

      // Player physics
      if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity += 0.9;
        if (isFlipping || isBackFlipping) {
          flipRotation += 15 * flipDirection;
          if (isFlipping && flipRotation >= 360) { flipRotation = 360; isFlipping = false; }
          else if (isBackFlipping && flipRotation <= -360) { flipRotation = -360; isBackFlipping = false; }
        }
        if (playerY >= GROUND_Y - 80) {
          const landImpact = jumpVelocity;
          playerY = GROUND_Y - 80;
          isJumping = false; jumpVelocity = 0;
          isFlipping = false; isBackFlipping = false;
          flipRotation = 0; flipDirection = 1;
          canDoubleJump = false; canDoubleSlide = false;
          if (landImpact > 3) {
            spawnDust(PLAYER_X + 10, GROUND_Y);
            playTone(120, 0.05, 'sawtooth', 0.12);
          }
        }
      } else if (isSliding) {
        slideTimer++;
        playerY = GROUND_Y - 80;
        const maxSlide = canDoubleSlide ? 30 : 45;
        if (slideTimer > maxSlide) stopSlide();
      } else {
        playerY = GROUND_Y - 80;
      }

      // Spawn obstacles
      const spawnRate = Math.max(800, OBSTACLE_SPAWN_RATE - (gameSpeed - OBSTACLE_SPEED_INITIAL) * 40);
      if (now - lastObstacleSpawn > spawnRate) {
        const t = Math.random();
        if (t < 0.7) {
          const slideHeadY = GROUND_Y - 80 + 25;
          let obstacleBottomY;
          const variety = Math.random();
          if (variety < 0.4) obstacleBottomY = slideHeadY - 10 - Math.random()*10;
          else if (variety < 0.8) obstacleBottomY = slideHeadY - 20 - Math.random()*10;
          else obstacleBottomY = slideHeadY - 30 - Math.random()*15;
          obstacles.push({ x: cssWidth(), height: obstacleBottomY, type: 'ceiling', bottom: obstacleBottomY });
        } else {
          const h = Math.random() * 100 + 30;
          obstacles.push({ x: cssWidth(), height: h, type: 'ground' });
        }
        lastObstacleSpawn = now;
      }

      const currentSpeed = isBoosting ? gameSpeed * 1.5 : gameSpeed;

      // Boost indicator
      const boostIndicator = document.getElementById('boostIndicator');
      if (boostIndicator) {
        const isActive = boostIndicator.classList.contains('active');
        if (isBoosting && !isActive) boostIndicator.classList.add('active');
        else if (!isBoosting && isActive) boostIndicator.classList.remove('active');
      }

      // Move obstacles
      obstacles = obstacles.map(o => ({ ...o, x: o.x - currentSpeed })).filter(o => o.x > -50);

      // Track distance (meters): roughly currentSpeed pixels per frame
      distance += currentSpeed * 0.08; // tunable

      // Coins per 10m
      if (Math.floor(distance / 10) > Math.floor((distance - currentSpeed * 0.08) / 10)) {
        runCoins += 1;
        updateHud();
      }

      // Collisions + close-call detection
      const playerWidth = 25;
      const playerRight = PLAYER_X + playerWidth;
      const playerLeft = PLAYER_X;
      const actualHeadY = isSliding ? (playerY + 25) : playerY;
      const playerBottom = playerY + 80;
      const playerTop = actualHeadY - 10;

      obstacles.forEach(obs => {
        const obsLeft = obs.x;
        const obsRight = obs.x + 20;

        if (obs.type === 'ceiling' && obs.bottom !== undefined) {
          const slideHeadY = GROUND_Y - 80 + 25;
          const maxBottom = slideHeadY - 10;
          const obsBottomY = Math.min(obs.bottom, maxBottom);
          const playerHeadTop = isSliding ? playerY + 15 : playerY - 10;
          if (PLAYER_X + 25 > obs.x - 20 && PLAYER_X < obs.x + 20 && playerHeadTop < obsBottomY) {
            if (!isSliding && !gameOverPending) {
              gameOverPending = true;
              playMetalCling(); playGulp();
              createDecapitation(playerHeadTop + 10, PLAYER_X + 10);
              cameraShake = 20; isRebounding = true;
              reboundVelocityX = -gameSpeed * 2; reboundVelocityY = 5;
              for (let i = 0; i < 15; i++) {
                createBloodSplash(playerHeadTop + 10, PLAYER_X + 10, Math.random()*10 - 5, Math.random()*5 + 5);
              }
              haptic(80);
              setTimeout(() => gameOver(), 800);
              return;
            } else if (isSliding && !obs._countedSafe) {
              // Successful slide-under = close call (passed safely while at risk)
              obs._countedSafe = true;
              runCloseCalls++;
              runCoins += 1;
              playCoin();
              updateHud();
            }
          }
        } else if (obs.type === 'ground' || !obs.type) {
          const obsTop = GROUND_Y - obs.height;
          const obsBottom = GROUND_Y;
          if (!gameOverPending && playerRight > obsLeft && playerLeft < obsRight && playerBottom > obsTop && playerTop < obsBottom) {
            gameOverPending = true;
            playMetalCling(); playScream();
            createBloodSplash(playerY, PLAYER_X + 10);
            if (!isJumping) { playerY -= 15; jumpVelocity = -8; isJumping = true; }
            else jumpVelocity = -8;
            haptic(80);
            setTimeout(() => gameOver(), 250);
            return;
          }
          // Close call if player jumped over and passed obstacle while in air
          if (!obs._countedAir && isJumping && obsRight < PLAYER_X) {
            obs._countedAir = true;
            // Only count as close call if obstacle was tall (>50)
            if (obs.height > 50) {
              runCloseCalls++;
              runCoins += 1;
              playCoin();
              updateHud();
            }
          }
        }
      });

      // Camera FX
      if (cameraShake > 0) { cameraShake *= 0.9; if (cameraShake < 0.1) cameraShake = 0; }
      if (isRebounding) {
        cameraOffsetX += reboundVelocityX; cameraOffsetY += reboundVelocityY;
        reboundVelocityX *= 0.9; reboundVelocityY *= 0.9;
        if (Math.abs(cameraOffsetX) < 1 && Math.abs(cameraOffsetY) < 1) {
          cameraOffsetX = 0; cameraOffsetY = 0; isRebounding = false;
        }
      }

      // Render
      ctx.clearRect(0, 0, cssWidth(), cssHeight());
      drawBiomeSky();

      ctx.save();
      if (cameraShake > 0 && !state.settings.reducedMotion) {
        ctx.translate((Math.random()-0.5)*cameraShake*10, (Math.random()-0.5)*cameraShake*10);
      }
      if (isRebounding) ctx.translate(cameraOffsetX, cameraOffsetY);

      drawParallax(currentSpeed);
      drawGround();
      obstacles.forEach(drawObstacle);

      // Spawn + draw trail
      if (!isJumping && !isSliding && Math.random() < 0.4) spawnTrail();
      updateTrail();

      // Character
      drawCharacterTo(ctx, activeChar, state.selected.hat, PLAYER_X, playerY, {
        isJumping, isSliding,
        isFlipping, isBackFlipping,
        flipRotation, animationFrame,
        blink: blinkPhase,
      });

      updateDust();
      updateBloodParticles();

      ctx.restore();

      gameLoop = requestAnimationFrame(updateGame);
    }

    function gameOver() {
      if (gameState === 'gameover') return;
      gameState = 'gameover';
      if (gameLoop) cancelAnimationFrame(gameLoop);
      gameLoop = null;
      if (scoreInterval) clearInterval(scoreInterval);
      scoreInterval = null;

      const finalDist = Math.floor(distance);
      const isNewBest = score > state.highScore;
      if (isNewBest) { state.highScore = score; lsSet(K.high, state.highScore); }
      if (finalDist > state.bestDist) { state.bestDist = finalDist; lsSet(K.bestDist, state.bestDist); }
      state.coins += runCoins;
      lsSet(K.coins, state.coins);

      // Achievements
      if (runCloseCalls === 0 && finalDist > 100) unlockAchievement('untouched');
      if (hitMaxSpeed) unlockAchievement('speed_demon');
      checkProgressionUnlocks();

      if (dailyMode) bumpDailyStreak();

      // Show game-over panel
      const go = document.getElementById('gameOverScreen');
      go.querySelector('#finalScore').textContent = score;
      go.querySelector('#finalDist').textContent = finalDist;
      go.querySelector('#finalCoins').textContent = '+' + runCoins;
      go.querySelector('#finalHighScore').textContent = state.highScore;
      go.querySelector('#newBestBadge').style.display = isNewBest ? 'block' : 'none';
      go.classList.add('visible');

      // Leaderboard offer (overall + biome + daily if appl)
      const boards = ['overall', activeBiome.id];
      if (dailyMode) boards.push('daily');
      boards.forEach(b => maybeAddToLeaderboard(b, finalDist));
    }

    // Input handlers
    function bindInput() {
      const root = document.getElementById('gameScreen');
      if (!root) return;

      // Tap-anywhere control
      root.addEventListener('click', (e) => {
        if (state.settings.control === 'tap' && gameState === 'playing') jump();
      });
      root.addEventListener('touchstart', (e) => {
        if (gameState !== 'playing') return;
        e.preventDefault();
        touchStartY = e.touches[0].clientY;
        if (!audioCtx) { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
      }, { passive: false });
      root.addEventListener('touchend', (e) => {
        if (gameState !== 'playing') return;
        e.preventDefault();
        if (state.settings.control !== 'tap') return;
        const endY = e.changedTouches[0].clientY;
        const dy = endY - touchStartY;
        if (dy > 30) slide();
        else { jump(); setTimeout(jumpRelease, 90); }
        touchStartY = 0;
      }, { passive: false });
      // Button-style
      const jumpBtn = document.getElementById('jumpBtn');
      if (jumpBtn) {
        jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); jump(); }, { passive: false });
        jumpBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); jumpRelease(); }, { passive: false });
        jumpBtn.addEventListener('click', e => { e.stopPropagation(); jump(); setTimeout(jumpRelease, 100); });
      }
    }

    function keydown(e) {
      if (parseHash().route !== 'play' && parseHash().route !== 'daily') return;
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); jump();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); slide();
      } else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault(); if (gameState === 'playing') isBoosting = true;
      } else if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault(); if (gameState === 'playing') backflip();
      } else if (e.key === 'p' || e.key === 'P') {
        pauseToggle();
      } else if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'playing' || gameState === 'gameover') {
          abort();
          start({ biomeId: activeBiome.id, charId: activeChar.id, daily: dailyMode });
        }
      } else if (e.key === 'Escape') {
        if (isPaused) {
          // navigate back to menu
          abort();
          navigate('#menu');
        } else if (gameState === 'playing') {
          pauseToggle();
        } else if (gameState === 'gameover') {
          navigate('#menu');
        }
      } else if (e.key === 'm' || e.key === 'M') {
        // Mute = set sfx to 0 (toggle)
        if (state.settings.sfxVol > 0) { state.settings._lastSfx = state.settings.sfxVol; state.settings.sfxVol = 0; }
        else { state.settings.sfxVol = state.settings._lastSfx || 0.6; }
        lsSet(K.settings, state.settings);
        toast('SFX ' + (state.settings.sfxVol > 0 ? 'on' : 'muted'));
      }
    }
    function keyup(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); jumpRelease();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); stopSlide();
      } else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault(); isBoosting = false;
      }
    }

    function init() {
      ensureCanvas();
      window.addEventListener('resize', () => { resizeCanvas(); });
      document.addEventListener('keydown', keydown);
      document.addEventListener('keyup', keyup);
      // First-touch audio unlock anywhere
      const unlock = () => {
        if (!audioCtx) initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        applyMusicVolume();
      };
      document.addEventListener('click', unlock, { once: true });
      document.addEventListener('touchstart', unlock, { once: true, passive: true });
      // Auto-pause on tab hide so ambient music stops with the gameplay
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (gameState === 'playing' && !isPaused) pauseToggle();
          else if (audioCtx && audioCtx.state === 'running') {
            try { audioCtx.suspend(); } catch (e) {}
          }
        } else {
          if (audioCtx && audioCtx.state === 'suspended' && !isPaused) {
            try { audioCtx.resume(); } catch (e) {}
          }
        }
      });
      bindInput();
    }

    return { init, start, abort, isRunning, pauseToggle };
  })();

  // ---------- Menu keyboard navigation ----------
  function menuKeyboard(e) {
    const route = parseHash().route;
    if (route !== 'menu') return;
    const isArrow = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code);
    if (!isArrow) return;
    const focusables = Array.from(document.querySelectorAll('#menuScreen .biome-card, #menuScreen .slot, #menuScreen .button, #menuScreen .icon-btn, #menuScreen .small-btn')).filter(b => !b.disabled);
    if (!focusables.length) return;
    const cur = document.activeElement;
    let idx = focusables.indexOf(cur);
    if (idx < 0) idx = 0;
    else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') idx = (idx + 1) % focusables.length;
    else idx = (idx - 1 + focusables.length) % focusables.length;
    e.preventDefault();
    focusables[idx].focus();
  }

  // ---------- Boot ----------
  function boot() {
    applySettingsToBody();
    Game.init();

    // Top bar buttons
    bindMenuButtons();
    bindHowTo();
    bindGameOverButtons();

    document.addEventListener('keydown', menuKeyboard);

    // First-time best is current best from old key (one-time migration)
    try {
      const legacy = localStorage.getItem('stickRunnerHighScore');
      if (legacy && !lsGet(K.high)) {
        state.highScore = parseInt(legacy, 10) || 0;
        lsSet(K.high, state.highScore);
      }
    } catch (e) { /* noop */ }

    checkProgressionUnlocks();

    window.addEventListener('hashchange', routeChanged);
    if (!location.hash) location.hash = '#menu';
    else routeChanged();
  }

  function bindMenuButtons() {
    const $ = id => document.getElementById(id);
    if ($('btnPlay'))         $('btnPlay').addEventListener('click', () => navigate('#play/' + state.selectedBiome));
    if ($('btnDaily'))        $('btnDaily').addEventListener('click', () => navigate('#daily'));
    if ($('btnSettings'))     $('btnSettings').addEventListener('click', () => navigate('#settings'));
    if ($('btnLeaderboard'))  $('btnLeaderboard').addEventListener('click', () => navigate('#leaderboard'));
    if ($('btnHowTo'))        $('btnHowTo').addEventListener('click', () => navigate('#how-to'));
    if ($('btnAch'))          $('btnAch').addEventListener('click', () => navigate('#achievements'));
    if ($('btnShop'))         $('btnShop').addEventListener('click', () => navigate('#shop'));
    if ($('btnCredits'))      $('btnCredits').addEventListener('click', () => navigate('#credits'));
  }

  function bindHowTo() {
    const back = document.getElementById('howToBack');
    if (back) back.addEventListener('click', () => navigate('#menu'));
    const creditsBack = document.getElementById('creditsBack');
    if (creditsBack) creditsBack.addEventListener('click', () => navigate('#menu'));
  }

  function bindGameOverButtons() {
    const $ = id => document.getElementById(id);
    if ($('btnReplay')) $('btnReplay').addEventListener('click', () => {
      const r = parseHash();
      const wasDaily = r.route === 'daily';
      Game.abort();
      navigate(wasDaily ? '#daily' : '#play/' + state.selectedBiome);
    });
    if ($('btnGoMenu')) $('btnGoMenu').addEventListener('click', () => navigate('#menu'));
  }

  // ---------- PWA service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
