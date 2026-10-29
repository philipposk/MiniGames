/* Stick Runner: one-thumb endless runner.
 * Tap = jump (tap again in the air = double jump, hold = a bit higher).
 * Swipe down = slide (in the air it slams down first).
 * World units: the view is 600 units tall; width follows the screen.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.MGI18n ? MGI18n.t(s) : s; };
  var cv = $('c'), cx = cv.getContext('2d');
  var BEST_KEY = 'stick-runner:v2:best', MUTE_KEY = 'stick-runner:v2:mute';
  var VH = 600, GROUND = 430;
  var W = 400, scale = 1, dpr = 1;

  // keep ?lang when going back to the hall
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

  // ---------- sound ----------
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

  // ---------- state ----------
  var S, best = +localStorage.getItem(BEST_KEY) || 0;
  var mode = 'menu'; // menu | run | pause | dead
  function fresh() {
    S = {
      t: 0, dist: 0, speed: 340, coins: 0,
      p: { y: GROUND, vy: 0, air: false, jumps: 0, hold: 0, slide: 0, phase: 0, flip: 0, slam: false, dead: false, rot: 0, dx: 0 },
      obs: [], coinsList: [], parts: [], nextAt: 520, shake: 0, flash: 0, scroll: 0,
    };
  }
  fresh();
  if (best > 0) { $('bestLine').hidden = false; $('best').textContent = best; }

  // ---------- spawning ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawn() {
    var sp = S.speed, x = S.scroll + W + 60;
    var gapMin = sp * 0.62 + 170; // time to react + land, grows with speed
    var level = Math.min(1, S.dist / 1800);
    var r = Math.random(), kind;
    if (S.dist < 60) kind = 'block';
    else if (r < 0.45) kind = 'block';
    else if (r < 0.72) kind = 'bar';
    else if (r < 0.86 + 0) kind = level > 0.25 ? 'double' : 'block';
    else kind = 'tall';
    if (kind === 'block') {
      var h = rnd(34, 50 + 14 * level), w = rnd(26, 40);
      S.obs.push({ k: 'block', x: x, w: w, h: h });
      coinArc(x + w / 2, GROUND - h - 70);
    } else if (kind === 'tall') {
      var th = rnd(70, 86);
      S.obs.push({ k: 'block', x: x, w: 30, h: th });
      coinArc(x + 15, GROUND - th - 60);
    } else if (kind === 'double') {
      var h2 = rnd(34, 46), gap = sp * 0.36 + 70;
      S.obs.push({ k: 'block', x: x, w: 28, h: h2 });
      S.obs.push({ k: 'block', x: x + gap, w: 28, h: h2 });
      gapMin += gap;
    } else {
      // overhead bar: bottom edge 46 above ground; slide height is 34
      var len = rnd(70, 140 + 80 * level);
      S.obs.push({ k: 'bar', x: x, w: len, y0: GROUND - 300, y1: GROUND - 46 });
      for (var i = 0; i < 4; i++) S.coinsList.push({ x: x + 10 + i * (len / 4), y: GROUND - 18, got: false });
    }
    if (Math.random() < 0.35) for (var j = 0; j < 5; j++) S.coinsList.push({ x: x + gapMin * 0.55 + j * 34, y: GROUND - 30, got: false });
    S.nextAt = x + gapMin + rnd(0, 220 * (1.1 - level));
  }
  function coinArc(cxw, top) {
    for (var i = -2; i <= 2; i++) S.coinsList.push({ x: cxw + i * 30, y: top + Math.abs(i) * Math.abs(i) * 9, got: false });
  }

  // ---------- input ----------
  var held = false, startY = 0, startT = 0, swiped = false;
  function jump() {
    var p = S.p;
    if (mode !== 'run' || p.dead) return;
    if (!p.air) { p.vy = -760; p.air = true; p.jumps = 1; p.hold = 0.22; p.slide = 0; beep(520, 0.12, 'square', 0.05, 820); dust(6); }
    else if (p.jumps < 2) { p.vy = -660; p.jumps = 2; p.flip = 1; p.hold = 0.12; beep(700, 0.12, 'square', 0.05, 1100); }
  }
  function slide() {
    var p = S.p;
    if (mode !== 'run' || p.dead) return;
    if (p.air) { p.slam = true; p.vy = Math.max(p.vy, 900); p.hold = 0; }
    else { p.slide = 0.62; beep(240, 0.14, 'triangle', 0.06, 140); dust(5); }
  }
  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'run') return;
    held = true; swiped = false; startY = e.clientY; startT = performance.now();
    jumpPending = true; jumpTimer = setTimeout(fireJump, 70);
  });
  var jumpPending = false, jumpTimer = 0;
  function fireJump() { if (jumpPending) { jumpPending = false; jump(); } }
  cv.addEventListener('pointermove', function (e) {
    if (!held || swiped) return;
    if (e.clientY - startY > 28) { swiped = true; if (jumpPending) { jumpPending = false; clearTimeout(jumpTimer); } slide(); }
  });
  function up() { held = false; if (jumpPending) { clearTimeout(jumpTimer); fireJump(); } }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); if (mode === 'menu' || mode === 'dead') start(); else { held = true; jump(); } }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); slide(); }
    else if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'run') pause(); else if (mode === 'pause') resume(); }
  });
  window.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') held = false; });

  // ---------- screens ----------
  function show(id) { ['start', 'paused', 'over'].forEach(function (s) { $(s).hidden = s !== id; }); }
  var hintTimer = 0;
  function start() {
    fresh(); mode = 'run'; show(null);
    $('hud').hidden = false; $('coins').textContent = '0'; $('dist').textContent = '0';
    var seen = localStorage.getItem('stick-runner:v2:hint');
    $('hint').hidden = false; $('hint').classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { $('hint').classList.add('fade'); }, seen ? 2200 : 5000);
    localStorage.setItem('stick-runner:v2:hint', '1');
    last = performance.now();
  }
  function pause() { if (mode !== 'run') return; mode = 'pause'; show('paused'); }
  function resume() { mode = 'run'; show(null); last = performance.now(); }
  function die() {
    var p = S.p; p.dead = true; p.vy = -520; p.dx = -120; S.shake = 14; S.flash = 1;
    beep(180, 0.4, 'sawtooth', 0.07, 60); buzz(60);
    for (var i = 0; i < 22; i++) S.parts.push(part(S.scroll + px(), p.y - 40, rnd(-260, 260), rnd(-420, -60), '#ffffff', rnd(0.4, 0.9)));
    setTimeout(function () {
      mode = 'dead';
      var d = Math.floor(S.dist), nb = d > best;
      if (nb) { best = d; localStorage.setItem(BEST_KEY, String(best)); }
      $('oDist').textContent = d + ' m'; $('oCoins').textContent = S.coins; $('oBest').textContent = best + ' m';
      $('newBest').hidden = !nb; $('hud').hidden = true; $('hint').hidden = true;
      $('best').textContent = best; $('bestLine').hidden = best <= 0;
      show('over');
    }, 750);
  }
  $('playBtn').onclick = start; $('againBtn').onclick = start;
  $('pauseBtn').onclick = function (e) { e.stopPropagation(); pause(); };
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = function () { mode = 'menu'; fresh(); $('hud').hidden = true; $('hint').hidden = true; show('start'); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // ---------- update ----------
  function px() { return Math.min(W * 0.24, 140); }
  function part(x, y, vx, vy, c, life) { return { x: x, y: y, vx: vx, vy: vy, c: c, life: life, max: life }; }
  function dust(n) { for (var i = 0; i < n; i++) S.parts.push(part(S.scroll + px() - 6, GROUND - 2, rnd(-160, -40), rnd(-120, -20), 'rgba(255,255,255,.7)', rnd(0.25, 0.5))); }

  function step(dt) {
    var p = S.p;
    S.t += dt;
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var q = S.parts[i]; q.life -= dt; q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) S.parts.splice(i, 1);
    }
    S.shake = Math.max(0, S.shake - 40 * dt); S.flash = Math.max(0, S.flash - 3 * dt);
    if (p.dead) {
      p.vy += 2000 * dt; p.y += p.vy * dt; p.rot += 9 * dt; S.scroll += p.dx * dt * 0.2;
      if (p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; p.dx *= 0.5; }
      return;
    }
    S.speed = Math.min(780, 340 + S.t * 7.5);
    var mv = S.speed * dt;
    S.scroll += mv; S.dist += mv / 40;
    p.phase += dt * S.speed / 34;

    // vertical
    var g = 2300;
    if (held && p.hold > 0 && p.vy < 0) { g = 1100; p.hold -= dt; }
    if (p.slam) g = 5200;
    if (p.air) {
      p.vy += g * dt; p.y += p.vy * dt;
      if (p.flip > 0) p.flip = Math.max(0, p.flip - dt * 2.4);
      if (p.y >= GROUND) {
        p.y = GROUND; p.vy = 0; p.air = false; p.jumps = 0; p.flip = 0; dust(7);
        if (p.slam) { p.slam = false; p.slide = 0.55; }
      }
    }
    if (p.slide > 0) {
      p.slide -= dt;
      // stay low while still under a bar
      var hx0 = S.scroll + px();
      for (var b = 0; b < S.obs.length; b++) { var ob = S.obs[b]; if (ob.k === 'bar' && hx0 + 14 > ob.x && hx0 - 14 < ob.x + ob.w) { p.slide = Math.max(p.slide, 0.12); break; } }
    }

    if (S.scroll + W + 60 > S.nextAt) spawn();

    // hitbox
    var hx = S.scroll + px(), sliding = p.slide > 0 && !p.air;
    var top = sliding ? p.y - 34 : p.y - 84, bot = p.y - 2, l = hx - 11, r = hx + 11;
    for (var k = S.obs.length - 1; k >= 0; k--) {
      var o = S.obs[k];
      if (o.x + o.w < S.scroll - 80) { S.obs.splice(k, 1); continue; }
      var ox0 = o.x + 3, ox1 = o.x + o.w - 3, oy0, oy1;
      if (o.k === 'block') { oy0 = GROUND - o.h + 3; oy1 = GROUND; } else { oy0 = o.y0; oy1 = o.y1; }
      if (r > ox0 && l < ox1 && bot > oy0 && top < oy1) { die(); return; }
    }
    for (var c = S.coinsList.length - 1; c >= 0; c--) {
      var co = S.coinsList[c];
      if (co.x < S.scroll - 80) { S.coinsList.splice(c, 1); continue; }
      if (!co.got && Math.abs(co.x - hx) < 22 && co.y > top - 14 && co.y < bot + 10) {
        co.got = true; S.coins++; $('coins').textContent = S.coins;
        beep(990 + (S.coins % 5) * 80, 0.08, 'sine', 0.05);
        for (var z = 0; z < 6; z++) S.parts.push(part(co.x, co.y, rnd(-120, 120), rnd(-220, -40), '#ffd447', 0.4));
        S.coinsList.splice(c, 1);
      }
    }
    $('dist').textContent = Math.floor(S.dist);
  }

  // ---------- draw ----------
  var SKIES = [ // dawn, day, dusk, night
    ['#ffb58a', '#ffd9b0', '#e98a6b', '#b8607a'],
    ['#4ea8ff', '#bfe6ff', '#69b86b', '#3d8f52'],
    ['#ff7a59', '#ffc07a', '#7a5a8f', '#4b3a66'],
    ['#14193a', '#2e3a6e', '#232a52', '#161b38'],
  ];
  function lerpC(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * t), g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t), bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
  }
  function palette() {
    var d = (S.dist / 500) % 4, i = Math.floor(d), f = d - i, f2 = f < 0.8 ? 0 : (f - 0.8) / 0.2;
    var a = SKIES[i], b = SKIES[(i + 1) % 4];
    return a.map(function (c, k) { return lerpC(c, b[k], f2); });
  }
  function hills(off, amp, base, col, freq) {
    cx.fillStyle = col; cx.beginPath(); cx.moveTo(0, VH);
    for (var x = 0; x <= W + 20; x += 20) {
      var wx = x + off;
      cx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(wx * freq) * Math.cos(wx * freq * 0.37 + 1.3)));
    }
    cx.lineTo(W + 20, VH); cx.closePath(); cx.fill();
  }
  function stick(x, y, p) {
    cx.save(); cx.translate(x, y);
    cx.strokeStyle = '#fff'; cx.fillStyle = '#fff'; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.lineWidth = 6;
    var sliding = p.slide > 0 && !p.air;
    if (p.dead) cx.rotate(p.rot);
    if (p.flip > 0) { cx.translate(0, -48); cx.rotate((1 - p.flip) * Math.PI * 2); cx.translate(0, 48); }
    var s = Math.sin(p.phase), c2 = Math.cos(p.phase);
    // scarf
    cx.strokeStyle = '#ff4d6d'; cx.lineWidth = 5;
    cx.beginPath();
    var nx = sliding ? 14 : 2, ny = sliding ? -26 : -66;
    cx.moveTo(nx, ny);
    for (var i = 1; i <= 4; i++) cx.lineTo(nx - i * 9, ny + Math.sin(S.t * 18 + i) * 3 + i * 1.5);
    cx.stroke();
    cx.strokeStyle = '#fff'; cx.lineWidth = 6;
    if (sliding) {
      cx.beginPath(); cx.arc(22, -24, 10, 0, 7); cx.fill();
      cx.beginPath(); cx.moveTo(14, -20); cx.lineTo(-14, -8); cx.lineTo(-34, -4); cx.moveTo(-14, -8); cx.lineTo(-30, -2);
      cx.moveTo(6, -16); cx.lineTo(16, -4); cx.stroke();
    } else if (p.air) {
      cx.beginPath(); cx.arc(2, -74, 11, 0, 7); cx.fill();
      cx.beginPath(); cx.moveTo(0, -62); cx.lineTo(-2, -34);
      cx.moveTo(-2, -34); cx.lineTo(12, -24); cx.lineTo(4, -10);
      cx.moveTo(-2, -34); cx.lineTo(-14, -22); cx.lineTo(-20, -30);
      cx.moveTo(0, -56); cx.lineTo(16, -66); cx.moveTo(0, -56); cx.lineTo(-16, -66);
      cx.stroke();
    } else {
      var bob = Math.abs(c2) * 3;
      cx.beginPath(); cx.arc(4, -76 + bob, 11, 0, 7); cx.fill();
      cx.beginPath(); cx.moveTo(2, -64 + bob); cx.lineTo(-1, -36 + bob);
      // legs
      cx.moveTo(-1, -36 + bob); cx.lineTo(-1 + s * 13, -18); cx.lineTo(-1 + s * 18 - 4, 0);
      cx.moveTo(-1, -36 + bob); cx.lineTo(-1 - s * 13, -18); cx.lineTo(-1 - s * 18 - 4, 0);
      // arms
      cx.moveTo(1, -56 + bob); cx.lineTo(1 - s * 14, -44 + bob); cx.lineTo(1 - s * 10 + 6, -36 + bob);
      cx.moveTo(1, -56 + bob); cx.lineTo(1 + s * 14, -44 + bob); cx.lineTo(1 + s * 10 + 6, -36 + bob);
      cx.stroke();
    }
    cx.restore();
  }
  function draw() {
    var pal = palette();
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    if (S.shake) cx.translate(rnd(-S.shake, S.shake) * 0.4, rnd(-S.shake, S.shake) * 0.4);
    var g = cx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    cx.fillStyle = g; cx.fillRect(-20, -20, W + 40, VH + 40);
    // sun / moon
    cx.fillStyle = 'rgba(255,255,255,.75)'; cx.beginPath(); cx.arc(W * 0.78, 120, 34, 0, 7); cx.fill();
    hills(S.scroll * 0.15, 110, GROUND - 30, 'rgba(255,255,255,.18)', 0.006);
    hills(S.scroll * 0.35 + 500, 70, GROUND - 6, pal[2], 0.011);
    // ground
    cx.fillStyle = pal[3]; cx.fillRect(-20, GROUND, W + 40, VH - GROUND + 20);
    cx.fillStyle = 'rgba(255,255,255,.85)'; cx.fillRect(-20, GROUND, W + 40, 4);
    cx.fillStyle = 'rgba(0,0,0,.12)';
    var off = S.scroll % 60;
    for (var x = -off; x < W + 60; x += 60) cx.fillRect(x, GROUND + 22, 28, 5);
    // obstacles
    for (var i = 0; i < S.obs.length; i++) {
      var o = S.obs[i], ox = o.x - S.scroll;
      if (ox > W + 40 || ox + o.w < -40) continue;
      if (o.k === 'block') {
        cx.fillStyle = '#1f2433'; roundRect(ox, GROUND - o.h, o.w, o.h + 2, 6); cx.fill();
        cx.fillStyle = '#ffcf33'; cx.fillRect(ox + 4, GROUND - o.h + 6, o.w - 8, 5);
      } else {
        cx.fillStyle = 'rgba(31,36,51,.9)'; cx.fillRect(ox + 4, o.y0, 6, o.y1 - o.y0); cx.fillRect(ox + o.w - 10, o.y0, 6, o.y1 - o.y0);
        cx.fillStyle = '#1f2433'; roundRect(ox, o.y1 - 22, o.w, 22, 6); cx.fill();
        cx.fillStyle = '#ff4d6d';
        for (var sx = ox + 6; sx < ox + o.w - 10; sx += 22) cx.fillRect(sx, o.y1 - 15, 11, 8);
      }
    }
    // coins
    for (var c = 0; c < S.coinsList.length; c++) {
      var co = S.coinsList[c], cxp = co.x - S.scroll;
      if (cxp < -20 || cxp > W + 20) continue;
      var wob = Math.abs(Math.cos(S.t * 5 + co.x * 0.05));
      cx.fillStyle = '#ffc928'; cx.beginPath(); cx.ellipse(cxp, co.y, 9 * (0.35 + 0.65 * wob), 9, 0, 0, 7); cx.fill();
      cx.fillStyle = '#fff4b0'; cx.beginPath(); cx.ellipse(cxp - 2 * wob, co.y - 2, 3 * wob, 3, 0, 0, 7); cx.fill();
    }
    // player
    var p = S.p;
    cx.fillStyle = 'rgba(0,0,0,.18)';
    var sh = Math.max(0.3, 1 - (GROUND - p.y) / 260);
    cx.beginPath(); cx.ellipse(px(), GROUND + 3, 18 * sh, 4 * sh, 0, 0, 7); cx.fill();
    stick(px(), p.y, p);
    // particles
    for (var k = 0; k < S.parts.length; k++) {
      var q = S.parts[k]; cx.globalAlpha = Math.max(0, q.life / q.max); cx.fillStyle = q.c;
      cx.fillRect(q.x - S.scroll - 2.5, q.y - 2.5, 5, 5);
    }
    cx.globalAlpha = 1;
    if (S.flash) { cx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.5) + ')'; cx.fillRect(-20, -20, W + 40, VH + 40); }
  }
  function roundRect(x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }

  // ---------- loop ----------
  var last = performance.now(), acc = 0, FIXED = 1 / 120;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'run' || (mode === 'menu' && false)) {
      acc += dt;
      while (acc >= FIXED) { step(FIXED); acc -= FIXED; if (mode !== 'run') break; }
    } else if (mode === 'menu') {
      // attract mode: scenery drifts
      S.scroll += 60 * dt; S.p.phase += dt * 4; S.t += dt;
    } else if (S.p.dead) { step(dt); }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__sr = { ahead: function () { var hx = S.scroll + px(); return S.obs.filter(function (o) { return o.x + o.w > hx - 12; }).map(function (o) { return { k: o.k, d: o.x - hx, w: o.w, h: o.h }; }); }, speed: function () { return S.speed; }, state: function () { return { mode: mode, dist: S.dist, coins: S.coins, obs: S.obs.length, y: S.p.y, slide: S.p.slide, air: S.p.air }; }, jump: jump, slide: slide, start: start };
})();
