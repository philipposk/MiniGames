const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    LEVEL_COMPLETE: 'levelComplete'
};

const BrickType = {
    NORMAL: 'normal',
    BOMB: 'bomb',
    UNBREAKABLE: 'unbreakable',
    MOVING: 'moving',
    POWERUP: 'powerup',
    MULTI_HIT: 'multiHit'
};

const PowerUpType = {
    EXPAND: 'expand',
    SHRINK: 'shrink',
    MULTIBALL: 'multiball',
    SLOW: 'slow',
    LIFE: 'life',
    POINTS: 'points'
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
        width: 75,
        height: 28,
        rows: 5,
        cols: 6,
        spacing: 5
    }
};

class BounceBall {
    constructor() {
        this.state = GameState.MENU;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.highScore = this.loadHighScore();

        this.balls = [];
        this.paddle = {
            x: 0,
            y: 0,
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

        this.mouseX = null;
        this.soundEnabled = this.loadSoundPref();
        this.audioCtx = null;

        this.keys = {};
        this.boundHandlers = {};

        this.init();
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.screens = {
            menu: document.getElementById('menu'),
            game: document.getElementById('game'),
            gameOver: document.getElementById('gameOver')
        };

        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.menuBtn = document.getElementById('menuBtn');

        this.scoreDisplay = document.getElementById('score');
        this.livesDisplay = document.getElementById('lives');
        this.levelDisplay = document.getElementById('level');
        this.finalScoreDisplay = document.getElementById('finalScore');
        this.menuHighScoreDisplay = document.getElementById('menuHighScore');
        this.newRecordDisplay = document.getElementById('newRecord');

        this.injectOverlayUI();

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => this.resizeCanvas());

        this.setupEventListeners();
        this.updateHighScoreDisplay();
        this.updateSoundButton();
    }

    injectOverlayUI() {
        const gameScreen = this.screens.game;
        if (!gameScreen) return;

        if (!document.getElementById('pauseOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'pauseOverlay';
            overlay.className = 'pause-overlay hidden';
            overlay.innerHTML = '<div class="pause-content"><h2>PAUSED</h2><p>Press P or tap to resume</p></div>';
            gameScreen.appendChild(overlay);
            this.pauseOverlay = overlay;
        } else {
            this.pauseOverlay = document.getElementById('pauseOverlay');
        }

        if (!document.getElementById('soundToggle')) {
            const btn = document.createElement('button');
            btn.id = 'soundToggle';
            btn.className = 'sound-toggle';
            btn.setAttribute('aria-label', 'Toggle sound');
            gameScreen.appendChild(btn);
            this.soundToggleBtn = btn;
        } else {
            this.soundToggleBtn = document.getElementById('soundToggle');
        }

        if (!document.getElementById('pauseBtn')) {
            const btn = document.createElement('button');
            btn.id = 'pauseBtn';
            btn.className = 'pause-btn';
            btn.setAttribute('aria-label', 'Pause');
            btn.textContent = '‖';
            gameScreen.appendChild(btn);
            this.pauseBtn = btn;
        } else {
            this.pauseBtn = document.getElementById('pauseBtn');
        }
    }

    resizeCanvas() {
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
                }
            } else {
                this.paddle.y = cssHeight - 50;
            }
        }
    }

    setupEventListeners() {
        const click = (el, fn) => { if (el) el.addEventListener('click', fn); };
        click(this.startBtn, () => this.startGame());
        click(this.restartBtn, () => this.startGame());
        click(this.menuBtn, () => this.showMenu());
        click(this.soundToggleBtn, (e) => { e.stopPropagation(); this.toggleSound(); });
        click(this.pauseBtn, (e) => { e.stopPropagation(); this.togglePause(); });
        click(this.pauseOverlay, () => this.togglePause());

        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
            });

            const handleTouch = (e) => {
                if (!e.touches || !e.touches[0]) return;
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = e.touches[0].clientX - rect.left;
                this.unlockAudio();
            };
            this.canvas.addEventListener('touchstart', handleTouch, { passive: false });
            this.canvas.addEventListener('touchmove', handleTouch, { passive: false });

            this.canvas.addEventListener('click', () => this.unlockAudio());
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'p' || e.key === 'Escape') {
                if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
                    e.preventDefault();
                    this.togglePause();
                }
            }
            if (key === 'm') {
                e.preventDefault();
                this.toggleSound();
            }
            if (key === 'r' && this.state === GameState.GAME_OVER) {
                e.preventDefault();
                this.startGame();
            }
            if (key === ' ' && this.state === GameState.MENU) {
                e.preventDefault();
                this.startGame();
            }
            this.keys[key] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === GameState.PLAYING) {
                this.togglePause();
            }
        });
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
    }

    playSound(freq, duration = 0.1, type = 'square', volume = 0.08) {
        if (!this.soundEnabled || !this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {}
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        try { localStorage.setItem('bounceBallSound', this.soundEnabled ? '1' : '0'); } catch (e) {}
        this.updateSoundButton();
        if (this.soundEnabled) {
            this.unlockAudio();
            this.playSound(660, 0.08, 'sine', 0.1);
        }
    }

    updateSoundButton() {
        if (this.soundToggleBtn) {
            this.soundToggleBtn.textContent = this.soundEnabled ? '♪' : '♪̸';
            this.soundToggleBtn.classList.toggle('off', !this.soundEnabled);
        }
    }

    loadSoundPref() {
        try {
            const v = localStorage.getItem('bounceBallSound');
            return v === null ? true : v === '1';
        } catch (e) { return true; }
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
            if (!this.animationFrame) this.gameLoop();
        }
    }

    showMenu() {
        this.state = GameState.MENU;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.screens.menu.classList.add('active');
        this.screens.game.classList.remove('active');
        this.screens.gameOver.classList.remove('active');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        this.updateHighScoreDisplay();
    }

    startGame() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.unlockAudio();
        this.state = GameState.PLAYING;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.paddle.widthMultiplier = 1;
        this.paddle.widthTimer = 0;
        this.speedMultiplier = 1;
        this.speedTimer = 0;

        this.screens.menu.classList.remove('active');
        this.screens.gameOver.classList.remove('active');
        this.screens.game.classList.add('active');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.resetGame();
            this.gameLoop();
        });
    }

    getLevelSpeed() {
        const inc = 0.6;
        const calc = config.ball.baseSpeed + (this.level - 1) * inc;
        return Math.min(calc, config.ball.maxSpeed);
    }

    getBallCount() {
        if (this.level <= 3) return 1;
        if (this.level <= 7) return 2;
        if (this.level <= 12) return 3;
        if (this.level <= 18) return 4;
        return 5;
    }

    resetGame() {
        const ballCount = this.getBallCount();
        const speed = this.getLevelSpeed();

        this.balls = [];
        for (let i = 0; i < ballCount; i++) {
            const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
            this.balls.push({
                x: this.viewW / 2 + (i - ballCount / 2) * 30,
                y: this.viewH - 100 - i * 20,
                vx: Math.cos(angle) * speed,
                vy: -Math.sin(angle) * speed,
                radius: config.ball.radius,
                color: this.getBallColor(i),
                trail: []
            });
        }

        this.paddle.width = config.paddle.width * this.paddle.widthMultiplier;
        this.paddle.x = this.viewW / 2 - this.paddle.width / 2;
        this.paddle.y = this.viewH - 50;

        this.createBricks();
        this.explosions = [];
        this.particles = [];
        this.floatingTexts = [];
        this.collectibles = [];
        this.collectibleSpawnTimer = 0;
        this.fallingCollectibles = [];

        this.updateDisplay();
    }

    getBallColor(index) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
        return colors[index % colors.length];
    }

    createBricks() {
        this.bricks = [];
        const availableWidth = Math.min(this.viewW - 20, 700);
        const cols = config.brick.cols;
        const spacing = config.brick.spacing;
        const brickWidth = Math.max(40, (availableWidth - (cols - 1) * spacing) / cols);
        const totalWidth = cols * brickWidth + (cols - 1) * spacing;
        const startX = (this.viewW - totalWidth) / 2;
        const startY = 30;

        for (let row = 0; row < config.brick.rows; row++) {
            for (let col = 0; col < cols; col++) {
                const type = this.getBrickType(row, col);
                const brick = {
                    x: startX + col * (brickWidth + spacing),
                    y: startY + row * (config.brick.height + spacing),
                    width: brickWidth,
                    height: config.brick.height,
                    hit: false,
                    type,
                    color: this.getBrickColor(row),
                    vx: 0,
                    direction: Math.random() > 0.5 ? 1 : -1,
                    hits: 1,
                    maxHits: 1,
                    crackSeeds: []
                };

                if (type === BrickType.MOVING) {
                    brick.vx = 1.5 * brick.direction;
                }
                if (type === BrickType.MULTI_HIT) {
                    brick.hits = 2 + Math.floor(this.level / 5);
                    brick.maxHits = brick.hits;
                }

                this.bricks.push(brick);
            }
        }
    }

    getBrickType(row, col) {
        const r = Math.random();
        if (this.level <= 2) return BrickType.NORMAL;
        if (this.level <= 4) {
            if (r < 0.1) return BrickType.BOMB;
            return BrickType.NORMAL;
        }
        if (this.level === 5) {
            if (r < 0.05) return BrickType.UNBREAKABLE;
            if (r < 0.15) return BrickType.BOMB;
            return BrickType.NORMAL;
        }
        if (this.level <= 7) {
            if (r < 0.05) return BrickType.UNBREAKABLE;
            if (r < 0.15) return BrickType.BOMB;
            if (r < 0.30) return BrickType.MOVING;
            return BrickType.NORMAL;
        }
        if (this.level <= 10) {
            if (r < 0.08) return BrickType.UNBREAKABLE;
            if (r < 0.18) return BrickType.BOMB;
            if (r < 0.30) return BrickType.MOVING;
            if (r < 0.36) return BrickType.POWERUP;
            if (r < 0.52) return BrickType.MULTI_HIT;
            return BrickType.NORMAL;
        }
        if (r < 0.10) return BrickType.UNBREAKABLE;
        if (r < 0.20) return BrickType.BOMB;
        if (r < 0.32) return BrickType.MOVING;
        if (r < 0.38) return BrickType.POWERUP;
        if (r < 0.55) return BrickType.MULTI_HIT;
        return BrickType.NORMAL;
    }

    getBrickColor(row) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
        return colors[row % colors.length];
    }

    gameLoop() {
        if (this.state !== GameState.PLAYING) {
            this.animationFrame = null;
            return;
        }
        this.update();
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.paddle.widthTimer > 0) {
            this.paddle.widthTimer--;
            if (this.paddle.widthTimer === 0) {
                this.paddle.widthMultiplier = 1;
                this.paddle.width = config.paddle.width;
            }
        }
        if (this.speedTimer > 0) {
            this.speedTimer--;
            if (this.speedTimer === 0) {
                this.speedMultiplier = 1;
            }
        }
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) this.combo = 0;
        }
        if (this.shakeTime > 0) this.shakeTime--;

        if (this.mouseX !== null) {
            this.paddle.targetX = this.mouseX - this.paddle.width / 2;
            this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.3;
        }
        if (this.keys['arrowleft'] || this.keys['a']) {
            this.paddle.x -= 9;
            this.mouseX = null;
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            this.paddle.x += 9;
            this.mouseX = null;
        }
        this.paddle.x = Math.max(0, Math.min(this.viewW - this.paddle.width, this.paddle.x));

        for (const brick of this.bricks) {
            if (brick.hit || brick.type !== BrickType.MOVING) continue;
            brick.x += brick.vx;
            if (brick.x <= 0) {
                brick.x = 0;
                brick.vx = Math.abs(brick.vx);
            } else if (brick.x + brick.width >= this.viewW) {
                brick.x = this.viewW - brick.width;
                brick.vx = -Math.abs(brick.vx);
            }
        }

        this.explosions = this.explosions.filter(e => { e.life--; return e.life > 0; });

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        for (const t of this.floatingTexts) {
            t.y -= 1;
            t.life--;
        }
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);

        this.collectibleSpawnTimer++;
        const spawnInterval = Math.max(180, 400 - this.level * 8);
        if (this.collectibleSpawnTimer > spawnInterval) {
            this.spawnCollectible();
            this.collectibleSpawnTimer = 0;
        }

        for (const c of this.collectibles) {
            c.y += c.vy;
            c.rotation += 0.1;
            if (this.aabbCircleHit(c, this.paddle)) {
                this.applyPowerUp(c);
                c.collected = true;
            }
        }
        this.collectibles = this.collectibles.filter(c => !c.collected && c.y - c.radius < this.viewH + 50);

        for (const c of this.fallingCollectibles) {
            c.y += c.vy;
            c.vy = Math.min(c.vy + 0.3, 12);
            c.rotation += 0.15;
            if (this.aabbCircleHit(c, this.paddle)) {
                this.addScore(c.points);
                this.spawnFloatingText('+' + c.points, c.x, c.y, c.color);
                c.collected = true;
            }
        }
        this.fallingCollectibles = this.fallingCollectibles.filter(c => !c.collected && c.y - c.radius < this.viewH + 50);

        for (const ball of this.balls) {
            this.updateBall(ball);
        }

        const remaining = this.bricks.filter(b => !b.hit && b.type !== BrickType.UNBREAKABLE);
        if (remaining.length === 0) {
            this.levelComplete();
        }
    }

    aabbCircleHit(c, paddle) {
        return c.y + c.radius >= paddle.y &&
               c.y - c.radius <= paddle.y + paddle.height &&
               c.x + c.radius >= paddle.x &&
               c.x - c.radius <= paddle.x + paddle.width;
    }

    spawnCollectible() {
        const types = [
            { type: PowerUpType.EXPAND, color: '#4ecdc4', symbol: 'W' },
            { type: PowerUpType.SHRINK, color: '#ff6b6b', symbol: 'S' },
            { type: PowerUpType.MULTIBALL, color: '#f9ca24', symbol: 'M' },
            { type: PowerUpType.SLOW, color: '#45b7d1', symbol: '~' },
            { type: PowerUpType.LIFE, color: '#2ecc71', symbol: '+' },
            { type: PowerUpType.POINTS, color: '#ffd700', symbol: '★' }
        ];
        const weights = [3, 2, 2, 2, 1, 3];
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
            vy: 1.8 + this.level * 0.08,
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
        switch (c.powerType) {
            case PowerUpType.EXPAND:
                this.paddle.widthMultiplier = Math.min(1.6, this.paddle.widthMultiplier + 0.3);
                this.paddle.width = Math.min(config.paddle.maxWidth, config.paddle.width * this.paddle.widthMultiplier);
                this.paddle.widthTimer = 600;
                this.spawnFloatingText('WIDE PADDLE', this.paddle.x + this.paddle.width / 2, this.paddle.y - 20, '#4ecdc4');
                this.playSound(800, 0.15, 'sine', 0.1);
                break;
            case PowerUpType.SHRINK:
                this.paddle.widthMultiplier = Math.max(0.6, this.paddle.widthMultiplier - 0.2);
                this.paddle.width = Math.max(config.paddle.minWidth, config.paddle.width * this.paddle.widthMultiplier);
                this.paddle.widthTimer = 600;
                this.spawnFloatingText('SHRINK!', this.paddle.x + this.paddle.width / 2, this.paddle.y - 20, '#ff6b6b');
                this.playSound(220, 0.2, 'sawtooth', 0.1);
                break;
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
                this.updateDisplay();
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

    updateBall(ball) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 6) ball.trail.shift();

        const speed = Math.hypot(ball.vx, ball.vy);
        const maxStep = ball.radius;
        const steps = Math.max(1, Math.ceil(speed / maxStep));
        const stepVx = ball.vx / steps;
        const stepVy = ball.vy / steps;

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
                this.combo = 0;
                this.triggerShake(8, 18);
                this.playSound(120, 0.4, 'sawtooth', 0.12);
                this.updateDisplay();

                if (this.lives <= 0) {
                    this.gameOver();
                } else {
                    this.respawnBalls();
                }
            }
        }
    }

    respawnBalls() {
        const ballCount = this.getBallCount();
        const speed = this.getLevelSpeed() * this.speedMultiplier;
        for (let i = 0; i < ballCount; i++) {
            const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
            this.balls.push({
                x: this.viewW / 2 + (i - ballCount / 2) * 30,
                y: this.viewH - 100,
                vx: Math.cos(angle) * speed,
                vy: -Math.sin(angle) * speed,
                radius: config.ball.radius,
                color: this.getBallColor(i),
                trail: []
            });
        }
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
        const speed = Math.max(baseSpeed, Math.hypot(ball.vx, ball.vy));

        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;

        const minVy = speed * config.ball.minVyRatio;
        if (Math.abs(ball.vy) < minVy) ball.vy = -minVy;

        ball.y = this.paddle.y - ball.radius - 0.5;
        this.combo = 0;
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
            if (Math.random() < 0.4) this.dropFallingCollectible(brick);
        } else {
            brick.hit = true;
            this.addScore(10);
            this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
            this.playSound(540, 0.05, 'square', 0.06);
        }

        this.combo++;
        this.comboTimer = 90;
        if (this.combo >= 3) {
            const bonus = this.combo * 2;
            this.addScore(bonus);
            this.spawnFloatingText('x' + this.combo + ' +' + bonus, brick.x + brick.width / 2, brick.y, '#f9ca24');
        }

        if (brick.type === BrickType.BOMB) {
            this.explodeBrick(brick);
        }
        if (brick.type === BrickType.POWERUP) {
            this.addScore(50);
            this.spawnFloatingText('+50', brick.x + brick.width / 2, brick.y, '#ffd700');
            this.dropFallingCollectible(brick);
        }

        this.updateDisplay();
    }

    dropFallingCollectible(brick) {
        const types = [
            { color: '#ffd700', points: 20, symbol: '●' },
            { color: '#c0c0c0', points: 15, symbol: '○' },
            { color: '#cd7f32', points: 10, symbol: '●' }
        ];
        const t = types[Math.floor(Math.random() * types.length)];
        this.fallingCollectibles.push({
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height,
            vy: 1,
            radius: 8,
            color: t.color,
            symbol: t.symbol,
            points: t.points,
            rotation: Math.random() * Math.PI * 2,
            collected: false
        });
    }

    explodeBrick(brick) {
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

        for (const other of this.bricks) {
            if (other.hit || other === brick || other.type === BrickType.UNBREAKABLE) continue;
            const dx = other.x + other.width / 2 - brick.x - brick.width / 2;
            const dy = other.y + other.height / 2 - brick.y - brick.height / 2;
            if (Math.hypot(dx, dy) < 110) {
                other.hit = true;
                this.addScore(10);
                this.spawnParticles(other.x + other.width / 2, other.y + other.height / 2, 6, other.color);
            }
        }
    }

    spawnParticles(x, y, count, color) {
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
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }

    addScore(n) {
        this.score += n;
    }

    levelComplete() {
        const bonus = 100 * this.level + this.lives * 50;
        this.addScore(bonus);
        this.spawnFloatingText('LEVEL ' + this.level + ' CLEAR +' + bonus, this.viewW / 2, this.viewH / 2, '#f9ca24');
        this.level++;
        this.playSound(700, 0.15, 'triangle', 0.12);
        setTimeout(() => this.playSound(900, 0.2, 'triangle', 0.12), 100);
        this.resetGame();
        this.updateDisplay();
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();

        if (this.shakeTime > 0) {
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

        this.drawRoundedRect(
            this.paddle.x, this.paddle.y,
            this.paddle.width, this.paddle.height,
            this.paddle.radius, '#ffffff'
        );
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

        for (const c of this.collectibles) {
            this.drawCollectible(c, 16);
        }
        for (const c of this.fallingCollectibles) {
            this.drawCollectible(c, 10);
        }

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
        if (brick.type === BrickType.BOMB) {
            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.8;
            ctx.fillStyle = `rgb(${Math.floor(220 * pulse)}, 30, 30)`;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(brick.x + 5, brick.y + 5, brick.width - 10, 3);
            ctx.fillRect(brick.x + 5, brick.y + brick.height - 8, brick.width - 10, 3);
        } else if (brick.type === BrickType.UNBREAKABLE) {
            ctx.fillStyle = '#555555';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = '#888888';
            ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
            ctx.fillStyle = '#aaaaaa';
            ctx.fillRect(brick.x + 4, brick.y + 4, brick.width - 8, 2);
        } else if (brick.type === BrickType.MOVING) {
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.fillStyle = this.adjustBrightness(brick.color, pulse);
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        } else if (brick.type === BrickType.POWERUP) {
            const hue = (Date.now() / 20) % 360;
            ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', brick.x + brick.width / 2, brick.y + brick.height / 2);
        } else if (brick.type === BrickType.MULTI_HIT) {
            const hp = brick.hits / brick.maxHits;
            ctx.fillStyle = this.adjustBrightness(brick.color, 0.5 + hp * 0.5);
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
            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
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

    updateDisplay() {
        if (this.scoreDisplay) this.scoreDisplay.textContent = this.score;
        if (this.livesDisplay) this.livesDisplay.textContent = '♥'.repeat(Math.max(0, this.lives));
        if (this.levelDisplay) this.levelDisplay.textContent = this.level;
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.finalScoreDisplay) this.finalScoreDisplay.textContent = this.score;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            if (this.newRecordDisplay) this.newRecordDisplay.classList.remove('hidden');
        } else if (this.newRecordDisplay) {
            this.newRecordDisplay.classList.add('hidden');
        }

        this.screens.game.classList.remove('active');
        this.screens.gameOver.classList.add('active');
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem('bounceBallHighScore');
            return saved ? parseInt(saved, 10) || 0 : 0;
        } catch (e) { return 0; }
    }

    saveHighScore() {
        try { localStorage.setItem('bounceBallHighScore', this.highScore.toString()); } catch (e) {}
    }

    updateHighScoreDisplay() {
        if (this.menuHighScoreDisplay) this.menuHighScoreDisplay.textContent = this.highScore;
    }
}

let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new BounceBall();
});
