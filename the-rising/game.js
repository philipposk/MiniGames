/* The Rising: stack the blocks before the water catches you.
 * Tap (or Space) to drop the moving block. Whatever hangs over the edge falls off.
 * A perfect drop keeps the full width; three in a row make the block wider again.
 * The water rises the whole time, a bit faster as you climb.
 * World units: the view is 600 units tall; y grows upward from the raft.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.MGI18n ? MGI18n.t(s) : s; };
  var cv = $('c'), cx = cv.getContext('2d');
  var BEST_KEY = 'the-rising:v2:best', MUTE_KEY = 'the-rising:v2:mute';
  var VH = 600, W = 400, scale = 1, dpr = 1;
  var BH = 30, PERFECT = 6;
  function startW() { return Math.min(170, W * 0.56); }
  function lim() { return Math.min(260, W * 0.5); }

  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) { $('back1').href = '../?lang=' + q; $('back2').href = '../?lang=' + q; }
  } catch (e) {}

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    scale = (h * dpr) / VH; W = (w * dpr) / scale;
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
  var best = +localStorage.getItem(BEST_KEY) || 0, S, mode = 'menu';

  function fresh() {
    var cxw = W / 2;
    S = {
      t: 0, stack: [{ x: cxw, w: startW(), y: 0, hue: 200 }], cur: null, chips: [], parts: [], popups: [],
      water: -150, cam: 0, perfect: 0, score: 0, shake: 0, flash: 0, dead: false, sink: 0,
    };
    newBlock();
  }
  function top() { return S.stack[S.stack.length - 1]; }
  function newBlock() {
    var tp = top(), n = S.stack.length;
    var speed = lim() * Math.min(1.1 + n * 0.035, 2.8);
    var fromLeft = n % 2 === 1;
    S.cur = { w: tp.w, y: tp.y + BH, hue: (200 + n * 9) % 360, speed: speed, dir: fromLeft ? 1 : -1, x: fromLeft ? tp.x - lim() : tp.x + lim() };
  }
  fresh();
  if (best > 0) { $('bestLine').hidden = false; $('best').textContent = best; }

  // water speed in units per second; you climb 30 units per block
  function waterSpeed() { return Math.min(8 + S.score * 0.25, 22); }

  // ---------- input ----------
  function drop() {
    if (mode !== 'run' || S.dead) return;
    var tp = top(), c = S.cur, off = c.x - tp.x, aoff = Math.abs(off);
    if (aoff < PERFECT) {
      c.x = tp.x; S.perfect++;
      var grow = S.perfect >= 3 ? Math.min(startW() - c.w, 14) : 0;
      if (grow > 0) c.w += grow;
      S.popups = [{ x: c.x, y: c.y + BH, txt: S.perfect >= 3 ? T('Perfect!') + ' +' : T('Perfect!'), life: 0.8 }];
      beep(520 + Math.min(S.perfect, 8) * 60, 0.12, 'triangle', 0.06);
      for (var z = 0; z < 10; z++) S.parts.push(part(c.x + rnd(-c.w / 2, c.w / 2), c.y, rnd(-60, 60), rnd(40, 160), '#ffffff', 0.5));
    } else if (aoff >= c.w) {
      // missed completely
      S.chips.push({ x: c.x, w: c.w, y: c.y, hue: c.hue, vy: 0, vx: c.dir * 80, rot: 0 });
      S.cur = null; lose(); return;
    } else {
      S.perfect = 0;
      var nw = c.w - aoff, nx = tp.x + off / 2, chipW = aoff;
      var chipX = off > 0 ? nx + nw / 2 + chipW / 2 : nx - nw / 2 - chipW / 2;
      S.chips.push({ x: chipX, w: chipW, y: c.y, hue: c.hue, vy: 0, vx: (off > 0 ? 1 : -1) * 70, rot: 0 });
      c.x = nx; c.w = nw;
      beep(300, 0.08, 'square', 0.05, 220);
    }
    S.stack.push({ x: c.x, w: c.w, y: c.y, hue: c.hue });
    S.score = S.stack.length - 1; $('score').textContent = S.score;
    buzz(8); newBlock();
  }
  cv.addEventListener('pointerdown', function (e) { if (mode === 'run') { e.preventDefault(); drop(); } });
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key;
    if (k === ' ' || k === 'Enter' || k === 'ArrowDown') { e.preventDefault(); if (mode === 'menu' || mode === 'dead') start(); else drop(); }
    else if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'run') pause(); else if (mode === 'pause') resume(); }
  });

  // ---------- screens ----------
  function show(id) { ['start', 'paused', 'over'].forEach(function (s) { $(s).hidden = s !== id; }); }
  var hintTimer = 0;
  function start() {
    fresh(); mode = 'run'; show(null); $('hud').hidden = false; $('score').textContent = '0';
    $('hint').hidden = false; $('hint').classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { $('hint').classList.add('fade'); }, localStorage.getItem('the-rising:v2:hint') ? 2200 : 5000);
    localStorage.setItem('the-rising:v2:hint', '1');
    last = performance.now();
  }
  function pause() { if (mode !== 'run') return; mode = 'pause'; show('paused'); }
  function resume() { mode = 'run'; show(null); last = performance.now(); }
  function lose(drowned) {
    S.dead = true; S.shake = drowned ? 6 : 12; S.flash = drowned ? 0.6 : 1;
    beep(drowned ? 120 : 180, 0.5, 'sawtooth', 0.07, 50); buzz(70);
    setTimeout(function () {
      mode = 'dead';
      var nb = S.score > best;
      if (nb) { best = S.score; localStorage.setItem(BEST_KEY, String(best)); }
      $('overWhy').textContent = T(drowned ? 'The water caught you' : 'The block missed the tower');
      $('oScore').textContent = S.score; $('oBest').textContent = best;
      $('newBest').hidden = !nb; $('hud').hidden = true; $('hint').hidden = true;
      $('best').textContent = best; $('bestLine').hidden = best <= 0;
      show('over');
    }, 900);
  }
  $('playBtn').onclick = start; $('againBtn').onclick = start;
  $('pauseBtn').onclick = function (e) { e.stopPropagation(); pause(); };
  $('pauseBtn').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = function () { mode = 'menu'; fresh(); $('hud').hidden = true; $('hint').hidden = true; show('start'); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // ---------- update ----------
  function part(x, y, vx, vy, c, life) { return { x: x, y: y, vx: vx, vy: vy, c: c, life: life, max: life }; }
  function step(dt) {
    S.t += dt;
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var p = S.parts[i]; p.life -= dt; p.vy -= 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) S.parts.splice(i, 1);
    }
    for (var j = S.chips.length - 1; j >= 0; j--) {
      var ch = S.chips[j]; ch.vy -= 1400 * dt; ch.y += ch.vy * dt; ch.x += ch.vx * dt; ch.rot += ch.vx * 0.01 * dt;
      if (ch.y < S.cam - 120) S.chips.splice(j, 1);
    }
    for (var u = S.popups.length - 1; u >= 0; u--) { S.popups[u].life -= dt; if (S.popups[u].life <= 0) S.popups.splice(u, 1); }
    S.shake = Math.max(0, S.shake - 40 * dt); S.flash = Math.max(0, S.flash - 2.5 * dt);
    var tp = top();
    // camera keeps the top of the stack around 40% from the top
    var want = Math.max(0, tp.y + BH - VH * 0.6);
    S.cam += (want - S.cam) * Math.min(1, dt * 5);
    if (S.dead) { S.water += 40 * dt; return; }
    if (mode !== 'run') return;
    // water
    S.water += waterSpeed() * dt;
    // water never starts more than one screen below
    S.water = Math.max(S.water, tp.y - 260);
    if (S.water >= tp.y + BH * 0.5) { lose(true); return; }
    var c = S.cur;
    if (c) {
      c.x += c.dir * c.speed * dt;
      var L = lim();
      if (c.x > tp.x + L) { c.x = tp.x + L; c.dir = -1; }
      if (c.x < tp.x - L) { c.x = tp.x - L; c.dir = 1; }
    }
  }

  // ---------- draw ----------
  function sy(y) { return VH - 90 - (y - S.cam); }
  function block(x, y, w, hue, alpha) {
    var X = x - w / 2, Y = sy(y) - BH;
    cx.globalAlpha = alpha == null ? 1 : alpha;
    cx.fillStyle = 'hsl(' + hue + ',70%,58%)'; cx.fillRect(X, Y, w, BH);
    cx.fillStyle = 'hsl(' + hue + ',75%,70%)'; cx.fillRect(X, Y, w, 6);
    cx.fillStyle = 'hsl(' + hue + ',60%,42%)'; cx.fillRect(X, Y + BH - 5, w, 5);
    cx.globalAlpha = 1;
  }
  function person(x, y) {
    var Y = sy(y), bob = Math.sin(S.t * 6) * 1.5;
    cx.save(); cx.translate(x, Y);
    cx.strokeStyle = '#1b2440'; cx.fillStyle = '#1b2440'; cx.lineWidth = 4; cx.lineCap = 'round';
    cx.beginPath(); cx.arc(0, -36 + bob, 8, 0, 7); cx.fill();
    cx.beginPath(); cx.moveTo(0, -28 + bob); cx.lineTo(0, -12); cx.moveTo(0, -12); cx.lineTo(-6, 0); cx.moveTo(0, -12); cx.lineTo(6, 0);
    var wave = S.dead ? Math.sin(S.t * 20) * 6 : 0;
    cx.moveTo(0, -24 + bob); cx.lineTo(-10, -34 + wave); cx.moveTo(0, -24 + bob); cx.lineTo(10, -34 - wave); cx.stroke();
    cx.restore();
  }
  function draw() {
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    if (S.shake) cx.translate(rnd(-S.shake, S.shake) * 0.4, rnd(-S.shake, S.shake) * 0.4);
    var h = Math.min(1, S.cam / 3000);
    var g = cx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, 'hsl(' + (215 + h * 40) + ',55%,' + (60 - h * 40) + '%)');
    g.addColorStop(1, 'hsl(' + (200 + h * 30) + ',60%,' + (82 - h * 45) + '%)');
    cx.fillStyle = g; cx.fillRect(-20, -20, W + 40, VH + 40);
    // clouds / stars
    cx.fillStyle = h > 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.55)';
    for (var s = 0; s < 7; s++) {
      var cy = ((s * 173 + S.cam * 0.3) % (VH + 80)) - 40, cxp = ((s * 211 + S.t * 8 * (s % 2 ? 1 : -1)) % (W + 160) + W + 160) % (W + 160) - 80;
      if (h > 0.5) { cx.fillRect(cxp, cy, 2, 2); } else { cx.beginPath(); cx.ellipse(cxp, cy, 38, 12, 0, 0, 7); cx.fill(); }
    }
    // raft
    var b0 = S.stack[0];
    cx.fillStyle = '#8a5a2b'; cx.fillRect(b0.x - b0.w / 2 - 20, sy(0) - 6, b0.w + 40, 14);
    for (var i = 0; i < S.stack.length; i++) { var bl = S.stack[i]; if (sy(bl.y) < -40 || sy(bl.y) > VH + 60) continue; block(bl.x, bl.y, bl.w, bl.hue); }
    var tp = top();
    if (S.cur && !S.dead) {
      block(S.cur.x, S.cur.y, S.cur.w, S.cur.hue);
      // guide line under the moving block
      cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.setLineDash([4, 6]); cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(S.cur.x - S.cur.w / 2, sy(S.cur.y)); cx.lineTo(S.cur.x - S.cur.w / 2, sy(tp.y) - BH); cx.moveTo(S.cur.x + S.cur.w / 2, sy(S.cur.y)); cx.lineTo(S.cur.x + S.cur.w / 2, sy(tp.y) - BH); cx.stroke(); cx.setLineDash([]);
    }
    person(tp.x, tp.y + BH);
    for (var j = 0; j < S.chips.length; j++) { var ch = S.chips[j]; cx.save(); cx.translate(ch.x, sy(ch.y) - BH / 2); cx.rotate(ch.rot); cx.translate(-ch.x, -(sy(ch.y) - BH / 2)); block(ch.x, ch.y, ch.w, ch.hue, 0.9); cx.restore(); }
    // water
    var wy = sy(S.water);
    if (wy < VH + 20) {
      var wg = cx.createLinearGradient(0, wy, 0, VH);
      wg.addColorStop(0, 'rgba(40,140,230,.78)'); wg.addColorStop(1, 'rgba(10,50,120,.95)');
      cx.fillStyle = wg; cx.beginPath(); cx.moveTo(-20, VH + 20);
      for (var x = -20; x <= W + 20; x += 12) cx.lineTo(x, wy + Math.sin(x * 0.04 + S.t * 3) * 4 + Math.sin(x * 0.11 - S.t * 2) * 2);
      cx.lineTo(W + 20, VH + 20); cx.closePath(); cx.fill();
      cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 2; cx.beginPath();
      for (var x2 = -20; x2 <= W + 20; x2 += 12) { var yy = wy + Math.sin(x2 * 0.04 + S.t * 3) * 4 + Math.sin(x2 * 0.11 - S.t * 2) * 2; if (x2 === -20) cx.moveTo(x2, yy); else cx.lineTo(x2, yy); }
      cx.stroke();
    }
    // danger meter: how close the water is
    var gap = (tp.y + BH * 0.5) - S.water;
    if (mode === 'run' && !S.dead) $('meter').style.width = Math.max(0, Math.min(100, (1 - gap / 260) * 100)) + '%';
    for (var u = 0; u < S.popups.length; u++) {
      var pu = S.popups[u]; cx.globalAlpha = Math.min(1, pu.life * 2); cx.fillStyle = '#fff';
      cx.font = '900 22px -apple-system, Segoe UI, Roboto, sans-serif'; cx.textAlign = 'center';
      cx.fillText(pu.txt, pu.x, sy(pu.y) - 52 - (0.8 - pu.life) * 40);
    }
    cx.globalAlpha = 1;
    for (var m = 0; m < S.parts.length; m++) { var q = S.parts[m]; cx.globalAlpha = Math.max(0, q.life / q.max); cx.fillStyle = q.c; cx.fillRect(q.x - 2, sy(q.y) - 2, 4, 4); }
    cx.globalAlpha = 1;
    if (S.flash) { cx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.4) + ')'; cx.fillRect(-20, -20, W + 40, VH + 40); }
  }

  var last = performance.now(), acc = 0, FIXED = 1 / 120;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'run') { acc += dt; while (acc >= FIXED) { step(FIXED); acc -= FIXED; } }
    else if (mode === 'menu') { S.t += dt; if (S.cur) { S.cur.x += S.cur.dir * 120 * dt; var tp = top(); if (Math.abs(S.cur.x - tp.x) > lim()) S.cur.dir *= -1; } }
    else if (mode === 'dead') step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () { if (mode === 'menu') fresh(); });
  requestAnimationFrame(frame);

  window.__tr = {
    state: function () { var tp = top(); return { mode: mode, dead: S.dead, score: S.score, w: tp.w, topY: tp.y, water: S.water, cur: S.cur && { x: S.cur.x, dir: S.cur.dir, speed: S.cur.speed }, topX: tp.x }; },
    drop: drop, start: start,
  };
})();
