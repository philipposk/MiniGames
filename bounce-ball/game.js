/* Bounce Ball - Gameplay engine.
 *
 * Drives a single level. Hooks (onLevelComplete / onGameOver / onBrickDestroyed /
 * onPowerUpCollected / onComboChange / onScoreChange / onLifeChange) are wired by
 * the app shell (app.js) to feed the meta layer (coins, achievements, leaderboard).
 */

const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    LEVEL_COMPLETE: 'levelComplete'
};

/* AmbientPad - WebAudio ambient-pad music engine.
 * Final gain capped ~0.15 so it stays unobtrusive ambience.
 * Caller drives setVolume() from a 0..1 settings slider. */
class AmbientPad {
    constructor(audioCtx, masterDestination) {
        this.ctx = audioCtx;
        this.dest = masterDestination;
        this.out = audioCtx.createGain();
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
        const freqs = this._chord || [110, 130.81, 164.81, 196.0];
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

const BrickType = {
    NORMAL: 'normal',
    BOMB: 'bomb',
    UNBREAKABLE: 'unbreakable',
    MULTI_HIT: 'multiHit',
    MULTIBALL_DROP: 'multiballDrop',
    EXTRA_LIFE: 'extraLife'
};

const PowerUpType = {
    EXPAND: 'expand',
    SHRINK: 'shrink',
    MULTIBALL: 'multiball',
    SLOW: 'slow',
    LIFE: 'life',
    POINTS: 'points'
};

const GRID_TO_BRICK_TYPE = {
    1: BrickType.NORMAL,
    2: BrickType.MULTI_HIT,
    3: BrickType.UNBREAKABLE,
    4: BrickType.BOMB,
    5: BrickType.MULTIBALL_DROP,
    6: BrickType.EXTRA_LIFE
};

const config = {
    ball: {
        radius: 10,
        baseSpeed: 5,
        maxSpeed: 14,
        minVyRatio: 0.25
    },
    paddle: {
        width: 120,
        height: 16,
        radius: 8,
        minWidth: 70,
        maxWidth: 220
    },
    brick: {
        height: 28,
        spacing: 5
    }
};

class BounceBall {
    constructor(opts) {
        opts = opts || {};
        this.state = GameState.MENU;
        this.score = 0;
        this.lives = 3;
        this.startingLives = 3;
        this.lifeLostThisLevel = false;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        this.bombChain = 0;
        this.lastBombTime = 0;
        this.bombChainBest = 0;
        this.powerUpsCollected = 0;
        this.bricksDestroyedTotal = 0;

        this.elapsedSec = 0;
        this.frameTimerMs = 0;

        this.balls = [];
        this.paddle = {
            x: 0, y: 0,
            width: config.paddle.width,
            height: config.paddle.height,
            radius: config.paddle.radius,
            targetX: 0,
            widthMultiplier: 1,
            widthTimer: 0
        };

        this.bricks = [];
        this.explosions = [];
        this.particles = [];
        this.floatingTexts = [];
        this.collectibles = [];
        this.collectibleSpawnTimer = 0;
        this.fallingCollectibles = [];

        this.speedMultiplier = 1;
        this.speedTimer = 0;

        this.shakeTime = 0;
        this.shakeIntensity = 0;

        this.canvas = null;
        this.ctx = null;
        this.animationFrame = null;
        this.lastFrameTs = 0;

        this.mouseX = null;
        this.audioCtx = null;
        this.musicPad = null;

        this.keys = {};
        this.keyboardActive = false;

        // Settings (injected from app via setSettings).
        this.settings = {
            sfxVol: 0.8,
            musicVol: 0,
            haptics: true,
            colorblind: false,
            reducedMotion: false,
            controlStyle: 'auto',
            sensitivity: 1.0,
            paddleSkin: 'classic',
            ballSkin: 'classic'
        };

        // Hooks (set by app.js).
        this.onLevelComplete = opts.onLevelComplete || function () {};
        this.onGameOver = opts.onGameOver || function () {};
        this.onBrickDestroyed = opts.onBrickDestroyed || function () {};
        this.onPowerUpCollected = opts.onPowerUpCollected || function () {};
        this.onComboChange = opts.onComboChange || function () {};
        this.onScoreChange = opts.onScoreChange || function () {};
        this.onLifeChange = opts.onLifeChange || function () {};
        this.onBombChain = opts.onBombChain || function () {};
        this.onPaused = opts.onPaused || function () {};
        this.onResumed = opts.onResumed || function () {};
        this.onQuit = opts.onQuit || function () {};

        // Level config (set via loadLevel before startGame).
        this.levelConfig = null;
    }

    attach(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resizeCanvas();
        if (!this._resizeBound) {
            this._resizeBound = () => this.resizeCanvas();
            window.addEventListener('resize', this._resizeBound);
            window.addEventListener('orientationchange', this._resizeBound);
        }
        this.setupInputListeners();
    }

    setSettings(s) {
        this.settings = Object.assign(this.settings, s);
        this.applyMusicVolume();
    }

    applyMusicVolume() {
        if (this.musicPad) this.musicPad.setVolume(this.settings.musicVol || 0);
    }

    setupInputListeners() {
        if (this._inputBound) return;
        this._inputBound = true;
        const c = this.canvas;
        if (c) {
            c.addEventListener('mousemove', (e) => {
                const rect = c.getBoundingClientRect();
                this.mouseX = (e.clientX - rect.left) * this.settings.sensitivity +
                    (rect.width / 2) * (1 - this.settings.sensitivity);
                this.keyboardActive = false;
            });
            const handleTouch = (e) => {
                if (!e.touches || !e.touches[0]) return;
                e.preventDefault();
                const rect = c.getBoundingClientRect();
                this.mouseX = (e.touches[0].clientX - rect.left) * this.settings.sensitivity +
                    (rect.width / 2) * (1 - this.settings.sensitivity);
                this.keyboardActive = false;
                this.unlockAudio();
            };
            c.addEventListener('touchstart', handleTouch, { passive: false });
            c.addEventListener('touchmove', handleTouch, { passive: false });
            c.addEventListener('click', () => this.unlockAudio());
            c.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'p') {
                if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
                    e.preventDefault();
                    this.togglePause();
                }
            }
            if (e.key === 'Escape') {
                if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
                    e.preventDefault();
                    this.quitToMenu();
                }
            }
            if (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd') {
                this.keyboardActive = true;
            }
            this.keys[key] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === GameState.PLAYING) {
                    this.togglePause();
                } else if (this.audioCtx && this.audioCtx.state === 'running') {
                    try { this.audioCtx.suspend(); } catch (e) {}
                }
            } else {
                if (this.state !== GameState.PAUSED && this.audioCtx && this.audioCtx.state === 'suspended') {
                    try { this.audioCtx.resume(); } catch (e) {}
                }
            }
        });
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        let cssWidth, cssHeight;

        if (this.canvas.offsetWidth === 0 || this.canvas.offsetHeight === 0) {
            cssWidth = window.innerWidth;
            cssHeight = Math.max(300, window.innerHeight - 200);
        } else {
            const rect = this.canvas.getBoundingClientRect();
            cssWidth = rect.width;
            cssHeight = rect.height;
        }

        const oldW = this.canvas.width / (this.dpr || 1);
        const oldH = this.canvas.height / (this.dpr || 1);

        this.canvas.width = Math.floor(cssWidth * dpr);
        this.canvas.height = Math.floor(cssHeight * dpr);
        this.dpr = dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.viewW = cssWidth;
        this.viewH = cssHeight;

        if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
            if (oldW > 0 && oldH > 0) {
                const sx = cssWidth / oldW;
                const sy = cssHeight / oldH;
                for (const ball of this.balls) {
                    ball.x *= sx;
                    ball.y *= sy;
                }
                this.paddle.x *= sx;
                this.paddle.y = cssHeight - 50;
                for (const brick of this.bricks) {
                    brick.x *= sx;
                    brick.y *= sy;
                    brick.width *= sx;
                }
            } else {
                this.paddle.y = cssHeight - 50;
            }
        }
    }

    unlockAudio() {
        if (!this.audioCtx) {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (Ctx) this.audioCtx = new Ctx();
            } catch (e) {}
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (this.audioCtx && !this.musicPad) {
            try {
                this.musicPad = new AmbientPad(this.audioCtx, this.audioCtx.destination);
                this.musicPad.setChord([110.00, 138.59, 164.81, 207.65]);
                this.applyMusicVolume();
            } catch (e) {}
        }
    }

    playSound(freq, duration = 0.1, type = 'square', volume = 0.08) {
        const vol = this.settings.sfxVol;
        if (vol <= 0 || !this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume * vol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {}
    }

    haptic(ms) {
        if (!this.settings.haptics) return;
        if (navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (e) {}
        }
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            if (this.audioCtx && this.audioCtx.state === 'running') {
                try { this.audioCtx.suspend(); } catch (e) {}
            }
            this.onPaused();
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.lastFrameTs = performance.now();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                try { this.audioCtx.resume(); } catch (e) {}
            }
            this.onResumed();
            if (!this.animationFrame) this.gameLoop();
        }
    }

    quitToMenu() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.state = GameState.MENU;
        this.onQuit();
    }

    loadLevel(levelConfig) {
        this.levelConfig = levelConfig;
    }

    startGame() {
        if (!this.levelConfig) return;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.unlockAudio();
        this.state = GameState.PLAYING;
        this.score = 0;
        this.lives = 3;
        this.startingLives = 3;
        this.lifeLostThisLevel = false;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        this.bombChain = 0;
        this.bombChainBest = 0;
        this.lastBombTime = 0;
        this.powerUpsCollected = 0;
        this.bricksDestroyedTotal = 0;
        this.elapsedSec = 0;
        this.frameTimerMs = 0;

        this.paddle.widthMultiplier = 1;
        this.paddle.widthTimer = 0;
        this.speedMultiplier = 1;
        this.speedTimer = 0;

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.resetField();
            this.lastFrameTs = performance.now();
            this.gameLoop();
        });
    }

    getLevelSpeed() {
        return Math.min(this.levelConfig.ballSpeed || config.ball.baseSpeed, config.ball.maxSpeed);
    }

    resetField() {
        const speed = this.getLevelSpeed();
        this.balls = [];
        const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
        this.balls.push({
            x: this.viewW / 2,
            y: this.viewH - 100,
            vx: Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed,
            radius: config.ball.radius,
            color: this.getBallColor(0),
            trail: []
        });

        const baseW = this.levelConfig.paddleWidth || config.paddle.width;
        this.paddle.width = baseW * this.paddle.widthMultiplier;
        this.paddle.x = this.viewW / 2 - this.paddle.width / 2;
        this.paddle.y = this.viewH - 50;

        this.createBricks();
        this.explosions = [];
        this.particles = [];
        this.floatingTexts = [];
        this.collectibles = [];
        this.collectibleSpawnTimer = 0;
        this.fallingCollectibles = [];
    }

    getBallColor(index) {
        const skin = this.settings.ballSkin || 'classic';
        const palettes = {
            classic: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'],
            neon:    ['#39ff14', '#ff10f0', '#00f0ff', '#fff700', '#ff5500'],
            pastel:  ['#ffb3ba', '#bae1ff', '#baffc9', '#ffffba', '#ffdfba'],
            mono:    ['#ffffff', '#dddddd', '#bbbbbb', '#999999', '#777777'],
            gold:    ['#ffd700', '#ffcc00', '#ffaa00', '#ff9900', '#cc8800']
        };
        const arr = palettes[skin] || palettes.classic;
        if (this.settings.colorblind) {
            return ['#ffffff', '#000000', '#888888', '#cccccc', '#444444'][index % 5];
        }
        return arr[index % arr.length];
    }

    getPaddleColor() {
        const skin = this.settings.paddleSkin || 'classic';
        const map = {
            classic: '#ffffff',
            neon:    '#39ff14',
            pastel:  '#ffb3ba',
            mono:    '#cccccc',
            gold:    '#ffd700'
        };
        return map[skin] || '#ffffff';
    }

    createBricks() {
        this.bricks = [];
        const lvl = this.levelConfig;
        const cols = lvl.cols;
        const rows = lvl.rows;
        const spacing = config.brick.spacing;
        const availableWidth = Math.min(this.viewW - 20, 700);
        const brickWidth = Math.max(28, (availableWidth - (cols - 1) * spacing) / cols);
        const totalWidth = cols * brickWidth + (cols - 1) * spacing;
        const startX = (this.viewW - totalWidth) / 2;
        const startY = 30;

        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#00b894'];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = lvl.grid[r][c];
                if (!v) continue;
                const type = GRID_TO_BRICK_TYPE[v] || BrickType.NORMAL;
                const brick = {
                    x: startX + c * (brickWidth + spacing),
                    y: startY + r * (config.brick.height + spacing),
                    width: brickWidth,
                    height: config.brick.height,
                    hit: false,
                    type,
                    color: colors[r % colors.length],
                    hits: 1,
                    maxHits: 1,
                    crackSeeds: []
                };
                if (type === BrickType.MULTI_HIT) {
                    brick.hits = 2;
                    brick.maxHits = 2;
                }
                this.bricks.push(brick);
            }
        }
    }

    gameLoop() {
        if (this.state !== GameState.PLAYING) {
            this.animationFrame = null;
            return;
        }
        const now = performance.now();
        const dt = Math.min(64, now - this.lastFrameTs);
        this.lastFrameTs = now;
        this.frameTimerMs += dt;
        while (this.frameTimerMs >= 1000) {
            this.elapsedSec++;
            this.frameTimerMs -= 1000;
        }
        const dt60 = Math.min(dt * 60 / 1000, 3);
        this.update(dt60);
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update(dt60 = 1) {
        if (this.paddle.widthTimer > 0) {
            this.paddle.widthTimer -= dt60;
            if (this.paddle.widthTimer <= 0) {
                this.paddle.widthTimer = 0;
                this.paddle.widthMultiplier = 1;
                this.paddle.width = (this.levelConfig.paddleWidth || config.paddle.width);
            }
        }
        if (this.speedTimer > 0) {
            this.speedTimer -= dt60;
            if (this.speedTimer <= 0) { this.speedTimer = 0; this.speedMultiplier = 1; }
        }
        if (this.comboTimer > 0) {
            this.comboTimer -= dt60;
            if (this.comboTimer <= 0) {
                this.comboTimer = 0;
                this.combo = 0;
                this.onComboChange(0);
            }
        }
        if (this.shakeTime > 0) this.shakeTime -= dt60;

        if (this.mouseX !== null && !this.keyboardActive) {
            this.paddle.targetX = this.mouseX - this.paddle.width / 2;
            this.paddle.x += (this.paddle.targetX - this.paddle.x) * Math.min(0.3 * dt60, 1);
        }
        const keySpeed = 9 * this.settings.sensitivity * dt60;
        if (this.keys['arrowleft'] || this.keys['a']) {
            this.paddle.x -= keySpeed;
            this.keyboardActive = true;
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            this.paddle.x += keySpeed;
            this.keyboardActive = true;
        }
        this.paddle.x = Math.max(0, Math.min(this.viewW - this.paddle.width, this.paddle.x));

        this.explosions = this.explosions.filter(e => { e.life -= dt60; return e.life > 0; });

        for (const p of this.particles) {
            p.x += p.vx * dt60;
            p.y += p.vy * dt60;
            p.vy += 0.15 * dt60;
            p.life -= dt60;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        for (const t of this.floatingTexts) {
            t.y -= 1 * dt60;
            t.life -= dt60;
        }
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);

        // Random power-up spawner kept mild; brick-dropped ones are primary.
        this.collectibleSpawnTimer += dt60;
        if (this.collectibleSpawnTimer > 480) {
            if (Math.random() < 0.5) this.spawnCollectible();
            this.collectibleSpawnTimer = 0;
        }

        for (const c of this.collectibles) {
            c.y += c.vy * dt60;
            c.rotation += 0.1 * dt60;
            if (this.aabbCircleHit(c, this.paddle)) {
                this.applyPowerUp(c);
                c.collected = true;
            }
        }
        this.collectibles = this.collectibles.filter(c => !c.collected && c.y - c.radius < this.viewH + 50);

        for (const c of this.fallingCollectibles) {
            c.y += c.vy * dt60;
            c.vy = Math.min(c.vy + 0.3 * dt60, 12);
            c.rotation += 0.15 * dt60;
            if (this.aabbCircleHit(c, this.paddle)) {
                this.addScore(c.points);
                this.spawnFloatingText('+' + c.points, c.x, c.y, c.color);
                c.collected = true;
            }
        }
        this.fallingCollectibles = this.fallingCollectibles.filter(c => !c.collected && c.y - c.radius < this.viewH + 50);

        for (const ball of this.balls) this.updateBall(ball, dt60);

        const remaining = this.bricks.filter(b => !b.hit && b.type !== BrickType.UNBREAKABLE);
        if (remaining.length === 0) this.completeLevel();
    }

    aabbCircleHit(c, paddle) {
        return c.y + c.radius >= paddle.y &&
               c.y - c.radius <= paddle.y + paddle.height &&
               c.x + c.radius >= paddle.x &&
               c.x - c.radius <= paddle.x + paddle.width;
    }

    spawnCollectible() {
        const types = [
            { type: PowerUpType.EXPAND,    color: '#4ecdc4', symbol: 'W' },
            { type: PowerUpType.SHRINK,    color: '#ff6b6b', symbol: 'S' },
            { type: PowerUpType.MULTIBALL, color: '#f9ca24', symbol: 'M' },
            { type: PowerUpType.SLOW,      color: '#45b7d1', symbol: '~' },
            { type: PowerUpType.LIFE,      color: '#2ecc71', symbol: '+' },
            { type: PowerUpType.POINTS,    color: '#ffd700', symbol: '*' }
        ];
        const weights = [3, 1, 2, 2, 1, 3];
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let pick = 0;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) { pick = i; break; }
        }
        const t = types[pick];
        this.collectibles.push({
            x: Math.random() * (this.viewW - 60) + 30,
            y: -30,
            vy: 1.8,
            radius: 14,
            color: t.color,
            symbol: t.symbol,
            powerType: t.type,
            points: 50,
            rotation: 0,
            collected: false
        });
    }

    applyPowerUp(c) {
        const speed = this.getLevelSpeed() * this.speedMultiplier;
        this.powerUpsCollected++;
        this.onPowerUpCollected(c.powerType);
        switch (c.powerType) {
            case PowerUpType.EXPAND: {
                this.paddle.widthMultiplier = Math.min(1.6, this.paddle.widthMultiplier + 0.3);
                const baseW = this.levelConfig.paddleWidth || config.paddle.width;
                this.paddle.width = Math.min(config.paddle.maxWidth, baseW * this.paddle.widthMultiplier);
                this.paddle.widthTimer = 600;
                this.spawnFloatingText('WIDE PADDLE', this.paddle.x + this.paddle.width / 2, this.paddle.y - 20, '#4ecdc4');
                this.playSound(800, 0.15, 'sine', 0.1);
                break;
            }
            case PowerUpType.SHRINK: {
                this.paddle.widthMultiplier = Math.max(0.6, this.paddle.widthMultiplier - 0.2);
                const baseW = this.levelConfig.paddleWidth || config.paddle.width;
                this.paddle.width = Math.max(config.paddle.minWidth, baseW * this.paddle.widthMultiplier);
                this.paddle.widthTimer = 600;
                this.spawnFloatingText('SHRINK!', this.paddle.x + this.paddle.width / 2, this.paddle.y - 20, '#ff6b6b');
                this.playSound(220, 0.2, 'sawtooth', 0.1);
                break;
            }
            case PowerUpType.MULTIBALL:
                this.spawnMultiball(speed);
                this.spawnFloatingText('MULTIBALL!', this.viewW / 2, this.viewH / 2, '#f9ca24');
                this.playSound(900, 0.12, 'triangle', 0.12);
                break;
            case PowerUpType.SLOW:
                this.speedMultiplier = 0.7;
                this.speedTimer = 480;
                for (const ball of this.balls) {
                    const s = Math.hypot(ball.vx, ball.vy);
                    if (s > 0) {
                        const target = this.getLevelSpeed() * this.speedMultiplier;
                        ball.vx = ball.vx / s * target;
                        ball.vy = ball.vy / s * target;
                    }
                }
                this.spawnFloatingText('SLOW MOTION', this.viewW / 2, this.viewH / 2, '#45b7d1');
                this.playSound(400, 0.3, 'sine', 0.1);
                break;
            case PowerUpType.LIFE:
                this.lives++;
                this.spawnFloatingText('+1 LIFE', this.viewW / 2, this.viewH / 2, '#2ecc71');
                this.playSound(880, 0.2, 'sine', 0.12);
                this.onLifeChange(this.lives);
                break;
            case PowerUpType.POINTS:
                this.addScore(c.points);
                this.spawnFloatingText('+' + c.points, c.x, c.y, '#ffd700');
                this.playSound(1100, 0.1, 'sine', 0.1);
                break;
        }
    }

    spawnMultiball(speed) {
        if (this.balls.length === 0 || this.balls.length >= 8) return;
        const src = this.balls[0];
        for (let i = 0; i < 2; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2;
            this.balls.push({
                x: src.x,
                y: src.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: config.ball.radius,
                color: this.getBallColor(this.balls.length),
                trail: []
            });
        }
    }

    updateBall(ball, dt60 = 1) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 6) ball.trail.shift();

        const speed = Math.hypot(ball.vx, ball.vy);
        const maxStep = ball.radius;
        const steps = Math.max(1, Math.ceil(speed * dt60 / maxStep));
        const stepVx = ball.vx * dt60 / steps;
        const stepVy = ball.vy * dt60 / steps;

        for (let s = 0; s < steps; s++) {
            ball.x += stepVx;
            ball.y += stepVy;

            if (ball.x - ball.radius <= 0) {
                ball.x = ball.radius;
                ball.vx = Math.abs(ball.vx);
                this.playSound(220, 0.04, 'square', 0.05);
            } else if (ball.x + ball.radius >= this.viewW) {
                ball.x = this.viewW - ball.radius;
                ball.vx = -Math.abs(ball.vx);
                this.playSound(220, 0.04, 'square', 0.05);
            }
            if (ball.y - ball.radius <= 0) {
                ball.y = ball.radius;
                ball.vy = Math.abs(ball.vy);
                this.playSound(220, 0.04, 'square', 0.05);
            }

            if (this.paddleCollision(ball)) break;
            if (this.brickCollision(ball)) break;
        }

        if (ball.y - ball.radius > this.viewH) {
            const idx = this.balls.indexOf(ball);
            if (idx > -1) this.balls.splice(idx, 1);

            if (this.balls.length === 0) {
                this.lives--;
                this.lifeLostThisLevel = true;
                this.combo = 0;
                this.onComboChange(0);
                this.triggerShake(8, 18);
                this.playSound(120, 0.4, 'sawtooth', 0.12);
                this.haptic(50);
                this.onLifeChange(this.lives);

                if (this.lives <= 0) {
                    this.endGameOver();
                } else {
                    this.respawnBall();
                }
            }
        }
    }

    respawnBall() {
        const speed = this.getLevelSpeed() * this.speedMultiplier;
        const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
        this.balls.push({
            x: this.viewW / 2,
            y: this.viewH - 100,
            vx: Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed,
            radius: config.ball.radius,
            color: this.getBallColor(0),
            trail: []
        });
    }

    paddleCollision(ball) {
        if (!(ball.y + ball.radius >= this.paddle.y &&
              ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
              ball.x + ball.radius >= this.paddle.x &&
              ball.x - ball.radius <= this.paddle.x + this.paddle.width)) {
            return false;
        }
        if (ball.vy <= 0) return false;

        const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
        const clamped = Math.max(-1, Math.min(1, hitPos));
        const angle = clamped * (Math.PI / 3);

        const baseSpeed = this.getLevelSpeed() * this.speedMultiplier;
        const speed = Math.min(
            Math.max(baseSpeed, Math.hypot(ball.vx, ball.vy)),
            config.ball.maxSpeed
        );

        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;

        const minVy = speed * config.ball.minVyRatio;
        if (Math.abs(ball.vy) < minVy) ball.vy = -minVy;

        ball.y = this.paddle.y - ball.radius - 0.5;
        this.combo = 0;
        this.onComboChange(0);
        this.playSound(500, 0.05, 'square', 0.07);
        this.spawnParticles(ball.x, ball.y + ball.radius, 6, '#ffffff');
        return true;
    }

    brickCollision(ball) {
        for (const brick of this.bricks) {
            if (brick.hit) continue;
            if (!(ball.x + ball.radius >= brick.x &&
                  ball.x - ball.radius <= brick.x + brick.width &&
                  ball.y + ball.radius >= brick.y &&
                  ball.y - ball.radius <= brick.y + brick.height)) {
                continue;
            }

            const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
            const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
            const dx = ball.x - cx;
            const dy = ball.y - cy;
            const dist = Math.hypot(dx, dy) || 0.0001;

            let nx, ny;
            if (dx === 0 && dy === 0) {
                const overlapX = Math.min(ball.x - brick.x, brick.x + brick.width - ball.x);
                const overlapY = Math.min(ball.y - brick.y, brick.y + brick.height - ball.y);
                if (overlapX < overlapY) {
                    nx = ball.x < brick.x + brick.width / 2 ? -1 : 1;
                    ny = 0;
                } else {
                    nx = 0;
                    ny = ball.y < brick.y + brick.height / 2 ? -1 : 1;
                }
            } else {
                nx = dx / dist;
                ny = dy / dist;
            }

            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx -= 2 * dot * nx;
                ball.vy -= 2 * dot * ny;
            }
            const push = (ball.radius - dist) + 0.5;
            if (push > 0) {
                ball.x += nx * push;
                ball.y += ny * push;
            }

            this.hitBrick(brick, ball);
            return true;
        }
        return false;
    }

    hitBrick(brick, ball) {
        if (brick.type === BrickType.UNBREAKABLE) {
            this.playSound(180, 0.05, 'square', 0.06);
            return;
        }

        if (brick.type === BrickType.MULTI_HIT) {
            brick.hits--;
            brick.crackSeeds.push({ x: Math.random(), y: Math.random() });
            this.addScore(5);
            this.playSound(360, 0.04, 'square', 0.05);
            if (brick.hits > 0) return;

            brick.hit = true;
            this.addScore(15);
            this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, 10, brick.color);
            this.bricksDestroyedTotal++;
            this.onBrickDestroyed(brick);
            if (window.MGNative) MGNative.Haptics.light();
        } else {
            brick.hit = true;
            this.addScore(10);
            this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
            this.playSound(540, 0.05, 'square', 0.06);
            this.bricksDestroyedTotal++;
            this.onBrickDestroyed(brick);
            if (window.MGNative) MGNative.Haptics.light();
        }

        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.comboTimer = 90;
        this.onComboChange(this.combo);
        if (this.combo >= 3) {
            const bonus = this.combo * 2;
            this.addScore(bonus);
            this.spawnFloatingText('x' + this.combo + ' +' + bonus, brick.x + brick.width / 2, brick.y, '#f9ca24');
        }

        if (brick.type === BrickType.BOMB) this.explodeBrick(brick);
        if (brick.type === BrickType.MULTIBALL_DROP) {
            this.spawnMultiball(this.getLevelSpeed() * this.speedMultiplier);
            this.spawnFloatingText('MULTIBALL!', brick.x + brick.width / 2, brick.y, '#f9ca24');
        }
        if (brick.type === BrickType.EXTRA_LIFE) {
            this.lives++;
            this.spawnFloatingText('+1 LIFE', brick.x + brick.width / 2, brick.y, '#2ecc71');
            this.onLifeChange(this.lives);
        }
    }

    explodeBrick(brick) {
        const now = performance.now();
        if (now - this.lastBombTime < 1500) this.bombChain++;
        else this.bombChain = 1;
        this.lastBombTime = now;
        if (this.bombChain > this.bombChainBest) this.bombChainBest = this.bombChain;
        this.onBombChain(this.bombChain);

        this.explosions.push({
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height / 2,
            radius: 0,
            maxRadius: 70,
            life: 24,
            maxLife: 24
        });
        this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, 20, '#ffaa00');
        this.triggerShake(6, 12);
        this.playSound(160, 0.25, 'sawtooth', 0.1);
        this.haptic(20);

        for (const other of this.bricks) {
            if (other.hit || other === brick || other.type === BrickType.UNBREAKABLE) continue;
            const dx = other.x + other.width / 2 - brick.x - brick.width / 2;
            const dy = other.y + other.height / 2 - brick.y - brick.height / 2;
            if (Math.hypot(dx, dy) < 110) {
                if (other.type === BrickType.BOMB) {
                    // Chain detonation - process recursively.
                    other.hit = true;
                    this.bricksDestroyedTotal++;
                    this.addScore(10);
                    this.onBrickDestroyed(other);
                    this.explodeBrick(other);
                } else {
                    other.hit = true;
                    this.addScore(10);
                    this.spawnParticles(other.x + other.width / 2, other.y + other.height / 2, 6, other.color);
                    this.bricksDestroyedTotal++;
                    this.onBrickDestroyed(other);
                }
            }
        }
    }

    spawnParticles(x, y, count, color) {
        if (this.settings.reducedMotion) count = Math.min(count, 3);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 1 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 1,
                life: 20 + Math.random() * 15,
                color,
                size: 2 + Math.random() * 3
            });
        }
    }

    spawnFloatingText(text, x, y, color) {
        this.floatingTexts.push({ text, x, y, color, life: 50 });
    }

    triggerShake(intensity, duration) {
        if (this.settings.reducedMotion) return;
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }

    addScore(n) {
        this.score += n;
        this.onScoreChange(this.score);
    }

    completeLevel() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.state = GameState.LEVEL_COMPLETE;
        const bonus = 100 * this.levelConfig.index + this.lives * 50;
        this.score += bonus;
        this.onScoreChange(this.score);
        this.playSound(700, 0.15, 'triangle', 0.12);
        setTimeout(() => this.playSound(900, 0.2, 'triangle', 0.12), 100);

        const stars = this.computeStars();
        this.onLevelComplete({
            score: this.score,
            timeSec: this.elapsedSec,
            livesLeft: this.lives,
            lifeLost: this.lifeLostThisLevel,
            stars,
            bricks: this.bricksDestroyedTotal,
            maxCombo: this.maxCombo,
            powerUps: this.powerUpsCollected,
            bombChain: this.bombChainBest
        });
    }

    computeStars() {
        let stars = 1; // cleared
        if (this.elapsedSec <= this.levelConfig.targetTimeSec) stars = 2;
        if (!this.lifeLostThisLevel) stars = 3;
        return stars;
    }

    endGameOver() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.state = GameState.GAME_OVER;
        if (window.MGNative) MGNative.Haptics.heavy();
        this.onGameOver({
            score: this.score,
            timeSec: this.elapsedSec,
            level: this.levelConfig.index,
            bricks: this.bricksDestroyedTotal,
            maxCombo: this.maxCombo,
            powerUps: this.powerUpsCollected
        });
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();

        if (this.shakeTime > 0 && !this.settings.reducedMotion) {
            const mag = (this.shakeTime / 20) * this.shakeIntensity;
            ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        }

        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, this.viewW, this.viewH);

        for (const exp of this.explosions) {
            const t = exp.life / exp.maxLife;
            const alpha = t;
            const radius = exp.maxRadius * (1 - t);
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        for (const brick of this.bricks) {
            if (brick.hit) continue;
            this.drawBrick(brick);
        }

        const paddleColor = this.getPaddleColor();
        this.drawRoundedRect(this.paddle.x, this.paddle.y,
            this.paddle.width, this.paddle.height,
            this.paddle.radius, paddleColor);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(
            this.paddle.x + this.paddle.width / 2,
            this.paddle.y + 3,
            Math.max(2, this.paddle.width / 2 - 4), 3,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        for (const ball of this.balls) {
            for (let i = 0; i < ball.trail.length; i++) {
                const t = ball.trail[i];
                const a = (i + 1) / ball.trail.length * 0.3;
                ctx.fillStyle = ball.color;
                ctx.globalAlpha = a;
                ctx.beginPath();
                ctx.arc(t.x, t.y, ball.radius * (i + 1) / ball.trail.length, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.arc(ball.x - 3, ball.y - 3, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const c of this.collectibles) this.drawCollectible(c, 16);
        for (const c of this.fallingCollectibles) this.drawCollectible(c, 10);

        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life / 30);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        for (const t of this.floatingTexts) {
            ctx.globalAlpha = Math.max(0, t.life / 50);
            ctx.fillStyle = t.color;
            ctx.font = 'bold 18px -apple-system, Helvetica, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;

        if (this.combo >= 3 && this.comboTimer > 0) {
            ctx.fillStyle = `rgba(249, 202, 36, ${Math.min(1, this.comboTimer / 90)})`;
            ctx.font = 'bold 24px -apple-system, Helvetica, Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('COMBO x' + this.combo, this.viewW - 20, 30);
        }

        ctx.restore();
    }

    drawBrick(brick) {
        const ctx = this.ctx;
        const cb = this.settings.colorblind;
        if (brick.type === BrickType.BOMB) {
            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.8;
            ctx.fillStyle = cb ? '#000000' : `rgb(${Math.floor(220 * pulse)}, 30, 30)`;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = cb ? '#ffffff' : '#ffff00';
            ctx.fillRect(brick.x + 5, brick.y + 5, brick.width - 10, 3);
            ctx.fillRect(brick.x + 5, brick.y + brick.height - 8, brick.width - 10, 3);
            if (cb) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('B', brick.x + brick.width / 2, brick.y + brick.height / 2);
            }
        } else if (brick.type === BrickType.UNBREAKABLE) {
            ctx.fillStyle = '#555555';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = '#888888';
            ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
            ctx.fillStyle = '#aaaaaa';
            ctx.fillRect(brick.x + 4, brick.y + 4, brick.width - 8, 2);
            if (cb) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('M', brick.x + brick.width / 2, brick.y + brick.height / 2);
            }
        } else if (brick.type === BrickType.MULTIBALL_DROP) {
            const hue = (Date.now() / 20) % 360;
            ctx.fillStyle = cb ? '#ffffff' : `hsl(${hue}, 70%, 60%)`;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = cb ? '#000000' : '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('X', brick.x + brick.width / 2, brick.y + brick.height / 2);
        } else if (brick.type === BrickType.EXTRA_LIFE) {
            ctx.fillStyle = cb ? '#cccccc' : '#2ecc71';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = cb ? '#000000' : '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', brick.x + brick.width / 2, brick.y + brick.height / 2);
        } else if (brick.type === BrickType.MULTI_HIT) {
            const hp = brick.hits / brick.maxHits;
            ctx.fillStyle = cb ? this.adjustBrightness('#888888', 0.5 + hp * 0.5) : this.adjustBrightness(brick.color, 0.5 + hp * 0.5);
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            if (brick.crackSeeds.length > 0) {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1;
                for (const seed of brick.crackSeeds) {
                    ctx.beginPath();
                    ctx.moveTo(brick.x + seed.x * brick.width, brick.y);
                    ctx.lineTo(brick.x + seed.y * brick.width, brick.y + brick.height);
                    ctx.stroke();
                }
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brick.hits.toString(), brick.x + brick.width / 2, brick.y + brick.height / 2);
        } else {
            ctx.fillStyle = cb ? '#ffffff' : brick.color;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            if (cb) {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                // diagonal lines pattern
                for (let i = -brick.height; i < brick.width; i += 6) {
                    ctx.beginPath();
                    ctx.moveTo(brick.x + i, brick.y);
                    ctx.lineTo(brick.x + i + brick.height, brick.y + brick.height);
                    ctx.stroke();
                }
            }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);
    }

    drawCollectible(c, fontSize) {
        const ctx = this.ctx;
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + fontSize + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillText(c.symbol, 0, 0);
        ctx.restore();
    }

    drawRoundedRect(x, y, width, height, radius, color) {
        const r = Math.min(radius, width / 2, height / 2);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + width - r, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        this.ctx.lineTo(x + width, y + height - r);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        this.ctx.lineTo(x + r, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    adjustBrightness(color, factor) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgb(${Math.min(255, Math.floor(r * factor))}, ${Math.min(255, Math.floor(g * factor))}, ${Math.min(255, Math.floor(b * factor))})`;
    }
}

window.BounceBallGame = BounceBall;
window.BounceBallGameState = GameState;
