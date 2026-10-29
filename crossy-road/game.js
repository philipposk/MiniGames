/* Crossy Hop: hop across roads, rivers and rails.
 * Tap = hop forward. Swipe left / right / down = hop that way. Arrow keys or WASD on a keyboard.
 * Ride the logs on the river; water is deadly. Do not dawdle: the screen keeps moving.
 * World units: the view is 600 units tall. The playfield is 9 columns wide.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.MGI18n ? MGI18n.t(s) : s; };
  var cv = $('c'), cx = cv.getContext('2d');
  var BEST_KEY = 'crossy-hop:v2:best', MUTE_KEY = 'crossy-hop:v2:mute';
  var VH = 600, W = 400, scale = 1, dpr = 1, COLS = 9, TS = 40, OX = 0, HOP = 0.13;

  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) { $('back1').href = '../?lang=' + q; $('back2').href = '../?lang=' + q; }
  } catch (e) {}

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    scale = (h * dpr) / VH; W = (w * dpr) / scale;
    TS = Math.min(W / COLS, 46); OX = (W - COLS * TS) / 2;
  }
  window.addEventListener('resize', resize); resize();

  var ac = null, muted = localStorage.getItem(MUTE_KEY) === '1';
  function beep(f, d, type, vol, slide) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
    } catch (e) {}
  }
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
  function muteLabel() { $('muteBtn').textContent = T(muted ? 'Sound off' : 'Sound on'); }
  $('muteBtn').onclick = function () { muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); muteLabel(); };
  muteLabel();

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var CAR_COLS = ['#ff5a5f', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];
  var best = +localStorage.getItem(BEST_KEY) || 0, S, mode = 'menu';

  // ---------- lanes (x in tiles, 0..COLS across the playfield; things wrap over a wider band) ----------
  var BAND_L = -4, BAND_R = COLS + 4, BAND = BAND_R - BAND_L;
  function makeLane(row) {
    var prev = S.lanes[row - 1], d = Math.min(1, row / 120), L;
    var hardRun = 0; for (var k = row - 1; k >= 0 && k > row - 5; k--) { if (S.lanes[k].kind !== 'grass') hardRun++; else break; }
    var kind;
    if (row < 4) kind = 'grass';
    else if (hardRun >= 2 + Math.floor(d * 3)) kind = 'grass';
    else {
      var r = Math.random();
      kind = r < 0.30 - d * 0.1 ? 'grass' : r < 0.66 ? 'road' : r < 0.9 ? 'river' : 'rail';
      if (kind === 'rail' && prev && prev.kind === 'rail') kind = 'road';
    }
    L = { kind: kind, row: row, items: [], trees: {}, coin: -1 };
    if (kind === 'grass') {
      var n = row < 4 ? (row === 0 ? 0 : 2) : Math.floor(rnd(1, 4));
      var keep = {}, pg = prev && prev.kind === 'grass' ? prev : null;
      // keep at least two cells open that were also open on the grass row below
      var opens = []; for (var c = 0; c < COLS; c++) if (!pg || !pg.trees[c]) opens.push(c);
      keep[pick(opens)] = 1; keep[pick(opens)] = 1; keep[4] = row < 4 ? 1 : keep[4];
      for (var i = 0; i < n; i++) { var tc = Math.floor(rnd(0, COLS)); if (!keep[tc]) L.trees[tc] = 1; }
      // trees outside the playfield for looks
      L.edge = [Math.random() < 0.6, Math.random() < 0.6];
      if (row > 3 && Math.random() < 0.18) { var cc = Math.floor(rnd(0, COLS)); if (!L.trees[cc]) L.coin = cc; }
    } else if (kind === 'road') {
      L.dir = Math.random() < 0.5 ? 1 : -1; L.speed = rnd(1.3, 2.2) + d * 2.2;
      var truck = Math.random() < 0.35, len = truck ? 2.4 : 1.3, gap = rnd(2.8, 4.2) + L.speed * 0.25;
      var col = pick(CAR_COLS);
      for (var x = BAND_L + rnd(0, gap); x < BAND_R; x += len + gap * rnd(0.85, 1.3)) L.items.push({ x: x, len: len, c: col, truck: truck });
    } else if (kind === 'river') {
      L.dir = prev && prev.kind === 'river' ? -prev.dir : (Math.random() < 0.5 ? 1 : -1);
      L.speed = rnd(0.8, 1.3) + d * 0.9;
      var llen = rnd(2.4, 3.6) - d * 0.6;
      for (var lx = BAND_L + rnd(0, 1.5); lx < BAND_R; lx += llen + rnd(1.0, 1.9 + d * 0.5)) L.items.push({ x: lx, len: llen });
    } else {
      L.dir = Math.random() < 0.5 ? 1 : -1; L.speed = 22; L.next = rnd(2.5, 5); L.train = null; L.warn = 0;
    }
    return L;
  }
  function ensureLanes(upto) { while (S.lanes.length <= upto) S.lanes.push(makeLane(S.lanes.length)); }

  function fresh() {
    S = { t: 0, lanes: [], p: { col: 4, row: 0, x: 4, fx: 4, fr: 0, hop: 0, dir: 0, face: 0, dead: false, deathKind: '', squash: 0 },
      camRow: -3, maxRow: 0, coins: 0, queue: [], parts: [], shake: 0, flash: 0, idle: 0 };
    ensureLanes(30);
  }
  fresh();
  if (best > 0) { $('bestLine').hidden = false; $('best').textContent = best; }

  // ---------- input ----------
  function hop(dc, dr) {
    if (mode !== 'run' || S.p.dead) return;
    var p = S.p;
    if (p.hop > 0) { if (S.queue.length < 1) S.queue.push([dc, dr]); return; }
    var nc = Math.round(p.x) + dc, nr = p.row + dr;
    if (dr === 0 && dc === 0) return;
    if (nc < 0 || nc >= COLS || nr < 0) { bump(); return; }
    ensureLanes(nr + 30);
    var L = S.lanes[nr];
    if (L.kind === 'grass' && L.trees[nc]) { bump(); return; }
    p.fx = p.x; p.fr = p.row; p.col = nc; p.row = nr; p.hop = HOP; p.face = dc ? dc : p.face; p.dir = dr;
    // on a log the hop keeps the ride's fractional x; on land it snaps to the grid
    p.toX = L.kind === 'river' ? p.x + dc : nc;
    S.idle = 0;
    beep(dr > 0 ? 640 : 520, 0.06, 'square', 0.035, dr > 0 ? 880 : 600);
  }
  function bump() { S.p.squash = 1; beep(160, 0.06, 'triangle', 0.04); }
  var sx = 0, sy0 = 0, st = 0, down = false;
  cv.addEventListener('pointerdown', function (e) { if (mode !== 'run') return; down = true; sx = e.clientX; sy0 = e.clientY; st = performance.now(); e.preventDefault(); });
  cv.addEventListener('pointerup', function (e) {
    if (!down) return; down = false;
    var dx = e.clientX - sx, dy = e.clientY - sy0, ad = Math.max(Math.abs(dx), Math.abs(dy));
    if (ad < 24) { hop(0, 1); return; }
    if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 1 : -1, 0);
    else hop(0, dy < 0 ? 1 : -1);
  });
  cv.addEventListener('pointercancel', function () { down = false; });
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if ((k === ' ' || k === 'Enter') && (mode === 'menu' || mode === 'dead')) { e.preventDefault(); start(); return; }
    if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'run') pause(); else if (mode === 'pause') resume(); return; }
    var m = { ArrowUp: [0, 1], w: [0, 1], W: [0, 1], ' ': [0, 1], ArrowDown: [0, -1], s: [0, -1], S: [0, -1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] }[k];
    if (m) { e.preventDefault(); if (!e.repeat) hop(m[0], m[1]); }
  });

  // ---------- screens ----------
  function show(id) { ['start', 'paused', 'over'].forEach(function (s) { $(s).hidden = s !== id; }); }
  var hintTimer = 0;
  function start() {
    fresh(); mode = 'run'; show(null); $('hud').hidden = false; $('score').textContent = '0'; $('coins').textContent = '0';
    $('hint').hidden = false; $('hint').classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { $('hint').classList.add('fade'); }, localStorage.getItem('crossy-hop:v2:hint') ? 2200 : 5000);
    localStorage.setItem('crossy-hop:v2:hint', '1');
    last = performance.now();
  }
  function pause() { if (mode !== 'run') return; mode = 'pause'; show('paused'); }
  function resume() { mode = 'run'; show(null); last = performance.now(); }
  var WHY = { car: 'Hit by a car', train: 'Hit by a train', water: 'Fell in the river', off: 'Carried off by a log', slow: 'Too slow! Keep moving' };
  function die(kind) {
    var p = S.p; if (p.dead) return;
    p.dead = true; p.deathKind = kind; S.shake = kind === 'train' ? 16 : 10; S.flash = 1;
    if (kind === 'water') { beep(300, 0.35, 'sine', 0.07, 80); for (var i = 0; i < 16; i++) S.parts.push(part(p.x, p.row, rnd(-2, 2), rnd(1, 4), '#bfe9ff', rnd(0.3, 0.7))); }
    else { beep(170, 0.4, 'sawtooth', 0.07, 50); for (var j = 0; j < 18; j++) S.parts.push(part(p.x, p.row, rnd(-4, 4), rnd(-1, 4), '#ffffff', rnd(0.4, 0.8))); }
    buzz(60);
    setTimeout(function () {
      mode = 'dead';
      var sc = S.maxRow, nb = sc > best;
      if (nb) { best = sc; localStorage.setItem(BEST_KEY, String(best)); }
      $('overWhy').textContent = T(WHY[kind] || '');
      $('oScore').textContent = sc; $('oCoins').textContent = S.coins; $('oBest').textContent = best;
      $('newBest').hidden = !nb; $('hud').hidden = true; $('hint').hidden = true;
      $('best').textContent = best; $('bestLine').hidden = best <= 0;
      show('over');
    }, 800);
  }
  $('playBtn').onclick = start; $('againBtn').onclick = start;
  $('pauseBtn').onclick = function (e) { e.stopPropagation(); pause(); };
  $('pauseBtn').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = function () { mode = 'menu'; fresh(); $('hud').hidden = true; $('hint').hidden = true; show('start'); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // ---------- update ----------
  function part(x, r, vx, vr, c, life) { return { x: x, r: r, z: 0.3, vx: vx, vz: vr, c: c, life: life, max: life }; }
  function step(dt) {
    S.t += dt;
    for (var i = S.parts.length - 1; i >= 0; i--) { var q = S.parts[i]; q.life -= dt; q.vz -= 12 * dt; q.x += q.vx * dt; q.z += q.vz * dt; if (q.life <= 0) S.parts.splice(i, 1); }
    S.shake = Math.max(0, S.shake - 40 * dt); S.flash = Math.max(0, S.flash - 3 * dt);
    var p = S.p; p.squash = Math.max(0, p.squash - dt * 6);
    // move lanes near the view
    var lo = Math.max(0, Math.floor(S.camRow) - 2), hi = Math.min(S.lanes.length - 1, Math.floor(S.camRow) + 20);
    for (var r = lo; r <= hi; r++) {
      var L = S.lanes[r];
      if (L.kind === 'road' || L.kind === 'river') {
        for (var k = 0; k < L.items.length; k++) {
          var it = L.items[k]; it.x += L.dir * L.speed * dt;
          if (L.dir > 0 && it.x > BAND_R) it.x -= BAND + it.len; else if (L.dir < 0 && it.x + it.len < BAND_L) it.x += BAND + it.len;
        }
      } else if (L.kind === 'rail') {
        if (L.train) { L.train.x += L.dir * L.speed * dt; if ((L.dir > 0 && L.train.x > BAND_R + 2) || (L.dir < 0 && L.train.x + L.train.len < BAND_L - 2)) { L.train = null; L.next = rnd(3, 6); } }
        else { L.next -= dt; L.warn = L.next < 1.3 ? 1 : 0; if (L.next <= 0) { L.warn = 0; L.train = { len: 12, x: L.dir > 0 ? BAND_L - 12 : BAND_R } ; if (r - S.camRow < 16 && r >= S.camRow) beep(220, 0.3, 'sawtooth', 0.03, 180); } }
      }
    }
    if (p.dead) return;
    // hop
    if (p.hop > 0) {
      p.hop = Math.max(0, p.hop - dt);
      var f = 1 - p.hop / HOP;
      p.x = p.fx + (p.toX - p.fx) * f;
      if (p.hop === 0) {
        p.x = p.toX;
        if (p.row > S.maxRow) { S.maxRow = p.row; $('score').textContent = S.maxRow; }
        var LL = S.lanes[p.row];
        if (LL.kind === 'grass' && LL.coin === Math.round(p.x)) { LL.coin = -1; S.coins++; $('coins').textContent = S.coins; beep(1040, 0.08, 'sine', 0.05); }
        if (LL.kind !== 'river') p.x = Math.round(p.x);
        if (S.queue.length) { var nx = S.queue.shift(); hop(nx[0], nx[1]); }
      }
    }
    var L2 = S.lanes[p.row], landed = p.hop === 0;
    // river: ride or sink
    if (L2.kind === 'river' && landed) {
      var on = null;
      for (var j = 0; j < L2.items.length; j++) { var lg = L2.items[j]; if (p.x + 0.5 > lg.x + 0.15 && p.x + 0.5 < lg.x + lg.len - 0.15) { on = lg; break; } }
      if (!on) { die('water'); return; }
      p.x += L2.dir * L2.speed * dt;
      if (p.x < -0.45 || p.x > COLS - 0.55) { die('off'); return; }
    }
    // cars and trains
    var px0 = p.x + 0.18, px1 = p.x + 0.82;
    if (L2.kind === 'road' && p.hop < HOP * 0.5) {
      for (var c = 0; c < L2.items.length; c++) { var car = L2.items[c]; if (px1 > car.x + 0.06 && px0 < car.x + car.len - 0.06) { die('car'); return; } }
    }
    if (L2.kind === 'rail' && L2.train && p.hop < HOP * 0.5 && px1 > L2.train.x && px0 < L2.train.x + L2.train.len) { die('train'); return; }
    // the screen creeps forward; stay ahead of it
    var pace = S.maxRow < 3 ? 0 : Math.min(0.42 + S.maxRow * 0.004, 1.0);
    S.camRow += pace * dt;
    // and catches up when the player runs ahead
    var target = p.row - 4;
    if (target > S.camRow) S.camRow += (target - S.camRow) * Math.min(1, dt * 3);
    if (p.row < S.camRow - 1.2) { die('slow'); return; }
    ensureLanes(Math.floor(S.camRow) + 30);
  }

  // ---------- draw ----------
  function rowY(r) { return VH - 60 - (r - S.camRow) * TS; }
  function X(x) { return OX + x * TS; }
  function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  function tree(x, y, big) {
    cx.fillStyle = 'rgba(0,0,0,.15)'; cx.beginPath(); cx.ellipse(x + TS / 2, y - TS * 0.12, TS * 0.36, TS * 0.12, 0, 0, 7); cx.fill();
    cx.fillStyle = '#7a4a24'; cx.fillRect(x + TS * 0.43, y - TS * 0.42, TS * 0.14, TS * 0.3);
    cx.fillStyle = big ? '#2f9e44' : '#37b24d'; rr(x + TS * 0.14, y - TS * 1.08, TS * 0.72, TS * 0.7, TS * 0.18); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.15)'; rr(x + TS * 0.22, y - TS * 1.0, TS * 0.3, TS * 0.22, TS * 0.08); cx.fill();
  }
  function chicken(x, y, z, face, squash, dead, kind) {
    var w = TS * 0.62, h = TS * 0.62;
    cx.fillStyle = 'rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x, y - TS * 0.12, TS * 0.3 * (1 - z * 0.3), TS * 0.1, 0, 0, 7); cx.fill();
    if (dead && kind !== 'water') { cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(x, y - TS * 0.2, TS * 0.42, TS * 0.14, 0, 0, 7); cx.fill(); cx.fillStyle = '#ff6b6b'; cx.fillRect(x - 3, y - TS * 0.26, 6, 4); return; }
    if (dead) return;
    var sq = squash * 0.18, hy = y - TS * 0.2 - z * TS * 0.55;
    cx.save(); cx.translate(x, hy); cx.scale(1 + sq, 1 - sq);
    cx.fillStyle = '#ffffff'; rr(-w / 2, -h, w, h, TS * 0.12); cx.fill();
    cx.fillStyle = '#e9ecef'; cx.fillRect(-w / 2, -h * 0.25, w, h * 0.25);
    cx.fillStyle = '#ff4d4f'; rr(-w * 0.16, -h - TS * 0.13, w * 0.32, TS * 0.15, 3); cx.fill();
    var fx = face * w * 0.16;
    cx.fillStyle = '#1b1b1b'; cx.fillRect(-w * 0.22 + fx, -h * 0.72, 3.2, 3.2); cx.fillRect(w * 0.16 + fx, -h * 0.72, 3.2, 3.2);
    cx.fillStyle = '#ff9f1c'; cx.beginPath(); cx.moveTo(-w * 0.1 + fx, -h * 0.55); cx.lineTo(w * 0.1 + fx, -h * 0.55); cx.lineTo(fx, -h * 0.38); cx.closePath(); cx.fill();
    cx.restore();
  }
  function draw() {
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    if (S.shake) cx.translate(rnd(-S.shake, S.shake) * 0.4, rnd(-S.shake, S.shake) * 0.4);
    cx.fillStyle = '#7ccf6b'; cx.fillRect(-20, -20, W + 40, VH + 40);
    var lo = Math.max(0, Math.floor(S.camRow) - 2), hi = Math.min(S.lanes.length - 1, Math.floor(S.camRow + VH / TS) + 1);
    var p = S.p;
    // ground
    for (var r = lo; r <= hi; r++) {
      var L = S.lanes[r], y = rowY(r);
      if (L.kind === 'grass') { cx.fillStyle = r % 2 ? '#86d873' : '#7ccf6b'; cx.fillRect(-20, y - TS, W + 40, TS); }
      else if (L.kind === 'road') {
        cx.fillStyle = '#4b5563'; cx.fillRect(-20, y - TS, W + 40, TS);
        var nx = S.lanes[r + 1];
        if (nx && nx.kind === 'road') { cx.fillStyle = 'rgba(255,255,255,.55)'; for (var dx = OX - 3 * TS; dx < W + TS; dx += TS) cx.fillRect(dx + TS * 0.2, y - TS - 1.5, TS * 0.5, 3); }
      } else if (L.kind === 'river') {
        cx.fillStyle = '#4dabf7'; cx.fillRect(-20, y - TS, W + 40, TS);
        cx.fillStyle = 'rgba(255,255,255,.25)';
        for (var wx = ((S.t * 20 * L.dir) % 30) - 30; wx < W + 30; wx += 30) cx.fillRect(wx, y - TS * 0.55 + Math.sin(wx + r) * 3, 10, 2);
      } else {
        cx.fillStyle = '#a8a29e'; cx.fillRect(-20, y - TS, W + 40, TS);
        cx.fillStyle = '#6b4f3a'; for (var sxx = OX - 4 * TS; sxx < W + TS; sxx += TS * 0.5) cx.fillRect(sxx, y - TS * 0.85, TS * 0.18, TS * 0.7);
        cx.fillStyle = '#d4d4d8'; cx.fillRect(-20, y - TS * 0.74, W + 40, 3); cx.fillRect(-20, y - TS * 0.3, W + 40, 3);
        // signal
        var on = L.warn && Math.floor(S.t * 6) % 2 === 0;
        cx.fillStyle = '#333'; cx.fillRect(OX - TS * 0.35, y - TS * 1.25, 4, TS * 1.05);
        cx.fillStyle = on ? '#ff3b30' : '#5a1d1d'; cx.beginPath(); cx.arc(OX - TS * 0.33, y - TS * 1.25, TS * 0.14, 0, 7); cx.fill();
      }
    }
    // dim outside the playfield
    cx.fillStyle = 'rgba(0,0,0,.18)'; cx.fillRect(-20, -20, OX + 20, VH + 40); cx.fillRect(OX + COLS * TS, -20, W, VH + 40);
    // things, back rows first
    for (var r2 = hi; r2 >= lo; r2--) {
      var L2 = S.lanes[r2], y2 = rowY(r2);
      if (L2.kind === 'river') for (var i = 0; i < L2.items.length; i++) {
        var lg = L2.items[i]; cx.fillStyle = '#8d5a2b'; rr(X(lg.x), y2 - TS * 0.85, lg.len * TS, TS * 0.7, TS * 0.2); cx.fill();
        cx.fillStyle = '#a8703c'; cx.fillRect(X(lg.x) + 6, y2 - TS * 0.7, lg.len * TS - 12, 3);
      }
      if (L2.kind === 'grass') {
        for (var c = 0; c < COLS; c++) if (L2.trees[c]) tree(X(c), y2, (c + r2) % 3 === 0);
        if (L2.edge && L2.edge[0]) tree(X(-1.3), y2, true);
        if (L2.edge && L2.edge[1]) tree(X(COLS + 0.3), y2, true);
        if (L2.coin >= 0) { var b = Math.sin(S.t * 4 + r2) * 3; cx.fillStyle = '#ffc928'; cx.beginPath(); cx.ellipse(X(L2.coin) + TS / 2, y2 - TS * 0.55 + b, TS * 0.2 * Math.abs(Math.cos(S.t * 3)) + 2, TS * 0.2, 0, 0, 7); cx.fill(); }
      }
      if (r2 === p.row) {
        var f = p.hop > 0 ? 1 - p.hop / HOP : 1, z = p.hop > 0 ? Math.sin(f * Math.PI) : 0;
        var yy = rowY(p.fr) + (rowY(p.row) - rowY(p.fr)) * f;
        chicken(X(p.x) + TS / 2, yy, z, p.face, p.squash, p.dead, p.deathKind);
      }
      if (L2.kind === 'road') for (var k = 0; k < L2.items.length; k++) {
        var car = L2.items[k], cxp = X(car.x), w = car.len * TS;
        cx.fillStyle = 'rgba(0,0,0,.2)'; rr(cxp + 2, y2 - TS * 0.2, w - 4, TS * 0.16, 4); cx.fill();
        cx.fillStyle = car.c; rr(cxp, y2 - TS * 0.82, w, TS * 0.64, TS * 0.14); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.75)';
        var fw = L2.dir > 0 ? cxp + w - TS * 0.42 : cxp + TS * 0.12;
        rr(fw, y2 - TS * 0.74, TS * 0.3, TS * 0.3, 4); cx.fill();
        if (car.truck) { cx.fillStyle = 'rgba(0,0,0,.12)'; cx.fillRect(L2.dir > 0 ? cxp + 4 : cxp + TS * 0.5, y2 - TS * 0.78, w - TS * 0.6, TS * 0.56); }
        cx.fillStyle = '#ffe066'; cx.fillRect(L2.dir > 0 ? cxp + w - 4 : cxp, y2 - TS * 0.4, 4, 5);
      }
      if (L2.kind === 'rail' && L2.train) {
        var tx = X(L2.train.x), tw = L2.train.len * TS;
        cx.fillStyle = '#c92a2a'; rr(tx, y2 - TS * 0.92, tw, TS * 0.8, 6); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.7)'; for (var wi = tx + TS * 0.4; wi < tx + tw - TS * 0.5; wi += TS * 0.9) cx.fillRect(wi, y2 - TS * 0.8, TS * 0.45, TS * 0.25);
      }
    }
    for (var m = 0; m < S.parts.length; m++) { var q = S.parts[m]; cx.globalAlpha = Math.max(0, q.life / q.max); cx.fillStyle = q.c; cx.fillRect(X(q.x) + TS / 2 - 3, rowY(q.r) - TS * 0.4 - q.z * TS * 0.3, 6, 6); }
    cx.globalAlpha = 1;
    // the creeping edge
    var dangerY = rowY(S.camRow - 1.2);
    if (dangerY < VH) { cx.fillStyle = 'rgba(255,60,60,.18)'; cx.fillRect(-20, dangerY, W + 40, VH - dangerY + 20); }
    if (S.flash) { cx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.45) + ')'; cx.fillRect(-20, -20, W + 40, VH + 40); }
  }

  var last = performance.now(), acc = 0, FIXED = 1 / 120;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'run' || mode === 'dead') { acc += dt; while (acc >= FIXED) { step(FIXED); acc -= FIXED; } }
    else if (mode === 'menu') { S.t += dt; step(0); }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__ch = {
    state: function () { return { mode: mode, dead: S.p.dead, why: S.p.deathKind, row: S.p.row, x: S.p.x, hop: S.p.hop, max: S.maxRow, cam: S.camRow, coins: S.coins }; },
    lane: function (r) { var L = S.lanes[r]; if (!L) return null; return { kind: L.kind, dir: L.dir, speed: L.speed, items: L.items, trees: L.trees, train: L.train, warn: L.warn, next: L.next }; },
    hop: hop, start: start, HOP: HOP, COLS: COLS,
  };
})();
