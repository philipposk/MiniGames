/* Helix Drop: rotate the tower so the ball falls through the gaps.
 * Drag left/right (or arrow keys) to turn the tower. Red parts are deadly.
 * Fall through 3 floors without a bounce and the ball smashes the next one, red or not.
 * World units: the view is 600 units tall; width follows the screen.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.MGI18n ? MGI18n.t(s) : s; };
  var cv = $('c'), cx = cv.getContext('2d');
  var BEST_KEY = 'helix-drop:v2:best', LVL_KEY = 'helix-drop:v2:level', MUTE_KEY = 'helix-drop:v2:mute';
  var VH = 600, W = 400, scale = 1, dpr = 1, cssW = 400;
  var SP = 120, TAU = Math.PI * 2, FRONT = Math.PI / 2, BALL_R = 11, G = 2100, BOUNCE = 610;

  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) { $('back1').href = '../?lang=' + q; $('back2').href = '../?lang=' + q; }
  } catch (e) {}

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = window.innerWidth, h = window.innerHeight; cssW = w;
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
  function norm(a) { a %= TAU; return a < 0 ? a + TAU : a; }
  function inArc(a, s, len) { return norm(a - s) < len; }

  var HUES = [[168, 72], [265, 70], [24, 88], [200, 80], [330, 70], [96, 55]];
  var best = +localStorage.getItem(BEST_KEY) || 0;
  var level = Math.max(1, +localStorage.getItem(LVL_KEY) || 1);
  var S, mode = 'menu';

  function buildLevel(n) {
    var count = Math.min(14 + n * 2, 40), rings = [], prevGap = rnd(0, TAU);
    for (var i = 0; i < count; i++) {
      var gapLen = Math.max(0.62, 1.05 - n * 0.025) + rnd(-0.05, 0.08);
      // first floor: the gap sits a little to the side so the first move is obvious
      var gapStart = i === 0 ? norm(FRONT + 0.9) : norm(prevGap + rnd(1.1, TAU - 1.1));
      var reds = [];
      var wantRed = i < 2 ? 0 : Math.min(4, Math.floor(rnd(0, 1.2) + n * 0.35));
      var guard = norm(prevGap + 0.0);
      for (var k = 0, tries = 0; k < wantRed && tries < 40; tries++) {
        var len = rnd(0.42, 0.62 + n * 0.01), s = rnd(0, TAU);
        // keep red away from the gap and from where the ball drops in from the floor above
        if (norm(s - gapStart) < gapLen + 0.15 || norm(gapStart - (s + len)) < 0.15) continue;
        var mid = norm(prevGap + 0.0), lo = norm(s - 0.55);
        if (inArc(mid, lo, len + 1.1)) continue;
        var clash = false;
        for (var r = 0; r < reds.length; r++) if (inArc(s, reds[r][0] - 0.2, reds[r][1] + 0.4) || inArc(reds[r][0], s - 0.2, len + 0.4)) clash = true;
        if (clash) continue;
        reds.push([s, len]); k++;
      }
      rings.push({ y: (i + 1) * SP, gap: gapStart, gapLen: gapLen, reds: reds, gone: 0, broke: false });
      prevGap = gapStart + gapLen / 2;
    }
    rings.push({ y: (count + 1) * SP, finish: true, gap: 0, gapLen: 0, reds: [], gone: 0, broke: false });
    return rings;
  }

  function fresh(keepScore) {
    var hue = HUES[(level - 1) % HUES.length];
    S = {
      t: 0, rot: 0, rotV: 0, score: keepScore ? S.score : 0, rings: buildLevel(level), hue: hue,
      ball: { y: SP - 70, vy: 0, squash: 0, dead: false }, cam: 0, streak: 0, passed: 0,
      parts: [], splats: [], shake: 0, flash: 0, combo: 0, popups: [],
    };
    S.cam = S.ball.y - VH * 0.33;
  }
  fresh();

  // ---------- input ----------
  var dragging = false, lastX = 0, keyDir = 0;
  cv.addEventListener('pointerdown', function (e) { if (mode !== 'run') return; dragging = true; lastX = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) {
    if (!dragging || mode !== 'run') return;
    var dx = e.clientX - lastX; lastX = e.clientX;
    S.rot += (dx / Math.max(260, Math.min(cssW, 520))) * TAU * 0.75;
  });
  function up() { dragging = false; }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keyDir = 1; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keyDir = -1; e.preventDefault(); }
    else if ((k === ' ' || k === 'Enter') && !e.repeat) { if (mode === 'menu' || mode === 'dead') { e.preventDefault(); start(); } else if (mode === 'win') { e.preventDefault(); nextLevel(); } }
    else if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'run') pause(); else if (mode === 'pause') resume(); }
  });
  window.addEventListener('keyup', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].indexOf(e.key) >= 0) keyDir = 0;
  });

  // ---------- screens ----------
  function show(id) { ['start', 'paused', 'over', 'win'].forEach(function (s) { $(s).hidden = s !== id; }); }
  var hintTimer = 0;
  function hud() { $('score').textContent = S.score; $('lvl').textContent = level; $('bar').style.width = Math.round(100 * S.passed / (S.rings.length - 1)) + '%'; }
  function start() {
    fresh(false); mode = 'run'; show(null); $('hud').hidden = false; hud();
    $('hint').hidden = false; $('hint').classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { $('hint').classList.add('fade'); }, localStorage.getItem('helix-drop:v2:hint') ? 2200 : 5000);
    localStorage.setItem('helix-drop:v2:hint', '1');
    last = performance.now();
  }
  function nextLevel() { fresh(true); mode = 'run'; show(null); $('hud').hidden = false; hud(); last = performance.now(); }
  function pause() { if (mode !== 'run') return; mode = 'pause'; show('paused'); }
  function resume() { mode = 'run'; show(null); last = performance.now(); }
  function saveBest() {
    var nb = S.score > best;
    if (nb) { best = S.score; localStorage.setItem(BEST_KEY, String(best)); }
    $('best').textContent = best; $('bestLine').hidden = best <= 0; $('startLvl').textContent = level;
    return nb;
  }
  function die() {
    S.ball.dead = true; S.shake = 12; S.flash = 1; beep(160, 0.45, 'sawtooth', 0.07, 50); buzz(70);
    for (var i = 0; i < 26; i++) S.parts.push(part(W / 2, S.ball.y, rnd(-320, 320), rnd(-420, 40), '#ff4d6d', rnd(0.4, 0.9)));
    setTimeout(function () {
      mode = 'dead';
      var nb = saveBest();
      $('oScore').textContent = S.score; $('oLvl').textContent = level; $('oBest').textContent = best;
      $('newBest').hidden = !nb; $('hud').hidden = true; $('hint').hidden = true; show('over');
    }, 700);
  }
  function win() {
    mode = 'win'; beep(660, 0.15, 'triangle', 0.07, 990); setTimeout(function () { beep(990, 0.25, 'triangle', 0.07, 1320); }, 140);
    for (var i = 0; i < 40; i++) S.parts.push(part(W / 2 + rnd(-120, 120), S.ball.y - 20, rnd(-260, 260), rnd(-520, -120), 'hsl(' + ((i * 37) % 360) + ',90%,60%)', rnd(0.6, 1.2)));
    var done = level; level++; localStorage.setItem(LVL_KEY, String(level)); saveBest();
    $('wLvl').textContent = done; $('wScore').textContent = S.score; $('hud').hidden = true;
    setTimeout(function () { if (mode === 'win') show('win'); }, 650);
  }
  $('playBtn').onclick = start; $('againBtn').onclick = start; $('nextBtn').onclick = nextLevel;
  $('pauseBtn').onclick = function (e) { e.stopPropagation(); pause(); };
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = function () { mode = 'menu'; fresh(false); $('hud').hidden = true; $('hint').hidden = true; saveBest(); show('start'); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  saveBest();

  // ---------- update ----------
  function part(x, y, vx, vy, c, life) { return { x: x, y: y, vx: vx, vy: vy, c: c, life: life, max: life }; }
  function step(dt) {
    S.t += dt;
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var p = S.parts[i]; p.life -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) S.parts.splice(i, 1);
    }
    for (var u = S.popups.length - 1; u >= 0; u--) { S.popups[u].life -= dt; if (S.popups[u].life <= 0) S.popups.splice(u, 1); }
    for (var r = 0; r < S.rings.length; r++) if (S.rings[r].broke && S.rings[r].gone < 1) S.rings[r].gone = Math.min(1, S.rings[r].gone + dt * 2.5);
    S.shake = Math.max(0, S.shake - 40 * dt); S.flash = Math.max(0, S.flash - 3 * dt);
    var b = S.ball;
    b.squash = Math.max(0, b.squash - dt * 5);
    if (b.dead || mode !== 'run') return;
    if (keyDir) S.rot += keyDir * 3.4 * dt;
    var prev = b.y;
    b.vy = Math.min(b.vy + G * dt, 1400); b.y += b.vy * dt;
    for (var k = 0; k < S.rings.length; k++) {
      var R = S.rings[k];
      if (R.broke) continue;
      var surf = R.y - BALL_R;
      if (!(prev <= surf && b.y >= surf && b.vy > 0)) continue;
      if (R.finish) { b.y = surf; b.vy = -BOUNCE * 0.7; win(); return; }
      var a = norm(FRONT - S.rot);
      if (inArc(a, R.gap, R.gapLen)) {
        R.broke = true; S.streak++; S.passed++;
        S.score += S.streak; S.popups.push({ y: R.y, txt: '+' + S.streak, life: 0.7 });
        beep(420 + S.streak * 70, 0.09, 'triangle', 0.05); hud();
        continue;
      }
      if (S.streak >= 3) {
        R.broke = true; S.passed++; S.score += S.streak * 2; S.streak = 0; S.shake = 8;
        S.popups.push({ y: R.y, txt: T('Smash!'), life: 0.9 });
        for (var z = 0; z < 22; z++) S.parts.push(part(W / 2 + rnd(-90, 90), R.y, rnd(-300, 300), rnd(-360, -60), 'hsl(' + S.hue[0] + ',' + S.hue[1] + '%,60%)', rnd(0.4, 0.8)));
        beep(140, 0.25, 'square', 0.07, 60); buzz(25);
        b.y = surf; b.vy = -BOUNCE; b.squash = 1; hud();
        return;
      }
      var red = false;
      for (var j = 0; j < R.reds.length; j++) if (inArc(a, R.reds[j][0], R.reds[j][1])) red = true;
      b.y = surf;
      if (red) { die(); return; }
      b.vy = -BOUNCE; b.squash = 1; S.streak = 0;
      S.splats.push({ ring: k, a: a, life: 2.5 });
      if (S.splats.length > 14) S.splats.shift();
      beep(300, 0.07, 'sine', 0.05, 200);
      return;
    }
    // camera only goes down
    var want = b.y - VH * 0.33;
    if (want > S.cam) S.cam += (want - S.cam) * Math.min(1, dt * 12);
  }

  // ---------- draw ----------
  function ringGeom() { var rx = Math.min(W * 0.4, 165); return { rx: rx, ry: rx * 0.34, th: 20 }; }
  function drawArc(R, sy, g, fromA, toA, front, color, dark) {
    // draw the ring's band between local angles [fromA, toA] (in ring space) on one half (front/back)
    var steps = Math.max(2, Math.ceil((toA - fromA) / 0.06));
    cx.beginPath();
    var started = false;
    for (var i = 0; i <= steps; i++) {
      var la = fromA + (toA - fromA) * i / steps, wa = la + S.rot, sn = Math.sin(wa);
      if ((sn >= 0) !== front) { if (started) break; continue; }
      var x = W / 2 + Math.cos(wa) * g.rx, y = sy + sn * g.ry;
      if (!started) { cx.moveTo(x, y); started = true; } else cx.lineTo(x, y);
    }
    if (!started) return;
    cx.lineWidth = g.th; cx.lineCap = 'butt'; cx.lineJoin = 'round';
    cx.save(); cx.translate(0, 9); cx.strokeStyle = dark; cx.stroke(); cx.restore();
    cx.strokeStyle = color; cx.stroke();
  }
  function ringPieces(R) {
    // returns list of [from, len, red]
    if (R.finish) return [[0, TAU, false]];
    var out = [], s = R.gap + R.gapLen, total = TAU - R.gapLen, step = 0.04;
    var cur = null;
    for (var d = 0; d < total; d += step) {
      var a = s + d, red = false;
      for (var j = 0; j < R.reds.length; j++) if (inArc(a, R.reds[j][0], R.reds[j][1])) red = true;
      if (!cur || cur[2] !== red) { cur = [a, 0, red]; out.push(cur); }
      cur[1] = Math.min(step, total - d) + cur[1];
    }
    return out;
  }
  function drawRing(R, front) {
    var g = ringGeom(), sy = R.y - S.cam + (R.gone * 120);
    if (sy < -60 || sy > VH + 80) return;
    if (R.gone >= 1) return;
    cx.globalAlpha = 1 - R.gone;
    var base = R.finish ? 'hsl(45,95%,58%)' : 'hsl(' + S.hue[0] + ',' + S.hue[1] + '%,62%)';
    var dark = R.finish ? 'hsl(40,80%,40%)' : 'hsl(' + S.hue[0] + ',' + S.hue[1] + '%,38%)';
    var pcs = R.pieces || (R.pieces = ringPieces(R));
    for (var i = 0; i < pcs.length; i++) {
      var p = pcs[i];
      drawArc(R, sy, g, p[0], p[0] + p[1], front, p[2] ? '#ff3b5c' : base, p[2] ? '#a3122e' : dark);
    }
    cx.globalAlpha = 1;
  }
  function draw() {
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    if (S.shake) cx.translate(rnd(-S.shake, S.shake) * 0.4, rnd(-S.shake, S.shake) * 0.4);
    var h = S.hue[0], bg = cx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, 'hsl(' + h + ',45%,22%)'); bg.addColorStop(1, 'hsl(' + ((h + 40) % 360) + ',50%,12%)');
    cx.fillStyle = bg; cx.fillRect(-20, -20, W + 40, VH + 40);
    // soft stars
    cx.fillStyle = 'rgba(255,255,255,.12)';
    for (var s = 0; s < 30; s++) { var yy = ((s * 97 - S.cam * 0.2) % VH + VH) % VH; cx.fillRect((s * 53) % W, yy, 2, 2); }
    var vis = S.rings;
    for (var i = vis.length - 1; i >= 0; i--) drawRing(vis[i], false);
    // pole
    var pg = cx.createLinearGradient(W / 2 - 16, 0, W / 2 + 16, 0);
    pg.addColorStop(0, 'rgba(255,255,255,.55)'); pg.addColorStop(0.5, 'rgba(255,255,255,.9)'); pg.addColorStop(1, 'rgba(255,255,255,.45)');
    cx.fillStyle = pg; cx.fillRect(W / 2 - 15, -20, 30, VH + 40);
    for (var j = 0; j < vis.length; j++) drawRing(vis[j], true);
    // splats on the floor the ball bounced on
    var g = ringGeom();
    for (var k = 0; k < S.splats.length; k++) {
      var sp = S.splats[k], R = S.rings[sp.ring];
      if (R.broke) continue;
      var wa = sp.a + S.rot; if (Math.sin(wa) < 0.2) continue;
      cx.fillStyle = 'rgba(255,255,255,.35)'; cx.beginPath();
      cx.ellipse(W / 2 + Math.cos(wa) * g.rx, R.y - S.cam + Math.sin(wa) * g.ry, 12, 4, 0, 0, 7); cx.fill();
    }
    // ball
    var b = S.ball, by = b.y - S.cam;
    if (!b.dead) {
      var sq = b.squash, sx = 1 + sq * 0.25, syy = 1 - sq * 0.25;
      if (S.streak >= 3) { cx.fillStyle = 'rgba(255,140,40,.35)'; cx.beginPath(); cx.arc(W / 2, by - 6, BALL_R * 2, 0, 7); cx.fill(); }
      cx.fillStyle = S.streak >= 3 ? '#ff8a2a' : '#ffffff';
      cx.beginPath(); cx.ellipse(W / 2, by + sq * 3, BALL_R * sx, BALL_R * syy, 0, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(0,0,0,.12)'; cx.beginPath(); cx.arc(W / 2 + 3, by + 3, BALL_R * 0.6, 0, 7); cx.fill();
    }
    for (var u = 0; u < S.popups.length; u++) {
      var pu = S.popups[u]; cx.globalAlpha = Math.min(1, pu.life * 2); cx.fillStyle = '#fff';
      cx.font = '900 26px -apple-system, Segoe UI, Roboto, sans-serif'; cx.textAlign = 'center';
      cx.fillText(pu.txt, W / 2 + g.rx * 0.65, pu.y - S.cam - 30 - (0.7 - pu.life) * 40);
    }
    cx.globalAlpha = 1;
    for (var m = 0; m < S.parts.length; m++) {
      var q = S.parts[m]; cx.globalAlpha = Math.max(0, q.life / q.max); cx.fillStyle = q.c;
      cx.fillRect(q.x - 3, q.y - S.cam - 3, 6, 6);
    }
    cx.globalAlpha = 1;
    if (S.flash) { cx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.5) + ')'; cx.fillRect(-20, -20, W + 40, VH + 40); }
  }

  var last = performance.now(), acc = 0, FIXED = 1 / 120;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'run') { acc += dt; while (acc >= FIXED) { step(FIXED); acc -= FIXED; if (mode !== 'run') break; } }
    else if (mode === 'menu') { S.rot += dt * 0.5; }
    else if (mode === 'dead' || mode === 'win' || S.ball.dead) { step(dt); }
    if (mode === 'run' && S.ball.dead) step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__hd = {
    state: function () { return { mode: mode, level: level, score: S.score, passed: S.passed, rings: S.rings.length - 1, y: S.ball.y, vy: S.ball.vy, streak: S.streak }; },
    // the next unbroken floor below the ball, in ring-local angles
    next: function () { for (var i = 0; i < S.rings.length; i++) { var R = S.rings[i]; if (!R.broke && R.y >= S.ball.y) return { y: R.y, gap: R.gap, gapLen: R.gapLen, reds: R.reds, finish: !!R.finish, rot: S.rot, front: FRONT }; } return null; },
    setRot: function (r) { S.rot = r; }, start: start, next2: nextLevel,
  };
})();
