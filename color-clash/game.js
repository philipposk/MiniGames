const GameState = {
    SPLASH: 'splash',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver'
};

const SETTINGS_KEY = 'colorClashSettings';
const HIGH_SCORE_KEY = 'colorClashHighScore';

class ColorClash {
    constructor() {
        this.state = GameState.SPLASH;
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.level = 1;
        this.combo = 0;
        this.bestCombo = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;

        this.basePxPerSecond = 600;
        this.currentPxPerSecond = this.basePxPerSecond;
        this.leftPos = 0;
        this.rightPos = 0;
        this.isMoving = false;
        this.hasScored = false;
        this.isPaused = false;
        this.lastTimestamp = 0;

        this.leftColor = null;
        this.rightColor = null;
        this.animationFrame = null;

        this.settings = this.loadSettings();
        this.audioCtx = null;

        this.particles = [];
        this.particleAnimating = false;

        this.initializeDOM();
        this.setupEventListeners();
        this.applySettings();
        this.updateHighScoreDisplay();
        this.resizeParticleCanvas();
    }

    initializeDOM() {
        this.screens = {
            splash: document.getElementById('splash'),
            playing: document.getElementById('game'),
            gameOver: document.getElementById('gameOver')
        };

        this.leftBar = document.getElementById('leftBar');
        this.rightBar = document.getElementById('rightBar');
        this.tapArea = document.getElementById('tapArea');
        this.centerZone = document.getElementById('centerZone');
        this.gameCanvas = document.getElementById('gameCanvas');
        this.particleCanvas = document.getElementById('particleLayer');
        this.particleCtx = this.particleCanvas ? this.particleCanvas.getContext('2d') : null;

        this.currentScoreEl = document.getElementById('currentScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.splashHighScoreEl = document.getElementById('splashHighScore');
        this.comboTextEl = document.getElementById('comboText');
        this.feedbackEl = document.getElementById('feedback');
        this.finalScoreEl = document.getElementById('finalScore');
        this.newRecordEl = document.getElementById('newRecord');
        this.levelDisplayEl = document.getElementById('levelDisplay');

        this.perfectCountEl = document.getElementById('perfectCount');
        this.goodCountEl = document.getElementById('goodCount');
        this.okayCountEl = document.getElementById('okayCount');

        this.pauseBtn = document.getElementById('pauseBtn');
        this.pauseOverlay = document.getElementById('pauseOverlay');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.quitBtn = document.getElementById('quitBtn');
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeModalBtn = document.getElementById('closeModal');

        this.soundToggleSplash = document.getElementById('soundToggleSplash');
        this.cbToggleSplash = document.getElementById('cbToggleSplash');
    }

    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.startGame());

        if (this.tapArea) {
            const tap = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTap();
            };
            this.tapArea.addEventListener('pointerdown', tap);
            this.tapArea.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        }

        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.cleanupRound();
            this.showScreen(GameState.SPLASH);
            this.state = GameState.SPLASH;
        });

        if (this.infoBtn) {
            this.infoBtn.addEventListener('click', () => {
                if (this.state === GameState.PLAYING) this.pause();
                this.infoModal.classList.remove('hidden');
            });
        }
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => this.infoModal.classList.add('hidden'));
        }
        if (this.infoModal) {
            this.infoModal.addEventListener('click', (e) => {
                if (e.target === this.infoModal) this.infoModal.classList.add('hidden');
            });
        }

        if (this.pauseBtn) this.pauseBtn.addEventListener('click', () => this.togglePause());
        if (this.resumeBtn) this.resumeBtn.addEventListener('click', () => this.resume());
        if (this.quitBtn) {
            this.quitBtn.addEventListener('click', () => {
                this.cleanupRound();
                this.isPaused = false;
                this.pauseOverlay.classList.add('hidden');
                this.showScreen(GameState.SPLASH);
                this.state = GameState.SPLASH;
            });
        }

        if (this.soundToggleSplash) {
            this.soundToggleSplash.addEventListener('click', () => {
                this.settings.sound = !this.settings.sound;
                this.saveSettings();
                this.applySettings();
            });
        }
        if (this.cbToggleSplash) {
            this.cbToggleSplash.addEventListener('click', () => {
                this.settings.colorBlind = !this.settings.colorBlind;
                this.saveSettings();
                this.applySettings();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (this.state !== GameState.PLAYING) return;
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.handleTap();
            } else if (e.code === 'Escape' || e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                this.togglePause();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === GameState.PLAYING && !this.isPaused) {
                this.pause();
            }
        });

        window.addEventListener('resize', () => this.resizeParticleCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeParticleCanvas(), 200);
        });
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) return Object.assign({ sound: true, colorBlind: false }, JSON.parse(raw));
        } catch (e) {}
        return { sound: true, colorBlind: false };
    }

    saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) {}
    }

    applySettings() {
        if (this.soundToggleSplash) {
            this.soundToggleSplash.textContent = `SOUND: ${this.settings.sound ? 'ON' : 'OFF'}`;
            this.soundToggleSplash.setAttribute('aria-pressed', String(this.settings.sound));
        }
        if (this.cbToggleSplash) {
            this.cbToggleSplash.textContent = `COLOR-BLIND: ${this.settings.colorBlind ? 'ON' : 'OFF'}`;
            this.cbToggleSplash.setAttribute('aria-pressed', String(this.settings.colorBlind));
        }
        document.body.classList.toggle('cb-mode', this.settings.colorBlind);
    }

    generateColorPair() {
        let families;
        if (this.settings.colorBlind) {
            families = [
                { baseHue: 220, range: 25 },
                { baseHue: 45,  range: 20 },
                { baseHue: 25,  range: 20 }
            ];
        } else {
            families = [
                { baseHue: 210, range: 30 },
                { baseHue: 0,   range: 20 },
                { baseHue: 120, range: 30 },
                { baseHue: 270, range: 30 },
                { baseHue: 30,  range: 20 },
                { baseHue: 180, range: 25 },
                { baseHue: 330, range: 20 }
            ];
        }

        const family = families[Math.floor(Math.random() * families.length)];
        const baseHue = family.baseHue + (Math.random() - 0.5) * family.range;

        const maxDifference = Math.max(4, 22 - this.level * 1.8);
        const hueDifference = Math.random() * maxDifference;
        const direction = Math.random() > 0.5 ? 1 : -1;

        const hue1 = (baseHue + 360) % 360;
        const hue2 = (baseHue + hueDifference * direction + 360) % 360;

        const baseSat = 65 + Math.random() * 25;
        const baseLit = 52 + Math.random() * 13;
        const sat1 = Math.max(40, baseSat + (Math.random() - 0.5) * 8);
        const sat2 = Math.max(40, baseSat + (Math.random() - 0.5) * 8);
        const lit1 = Math.max(35, Math.min(75, baseLit + (Math.random() - 0.5) * 8));
        const lit2 = Math.max(35, Math.min(75, baseLit + (Math.random() - 0.5) * 8));

        this.leftColor = { h: hue1, s: sat1, l: lit1 };
        this.rightColor = { h: hue2, s: sat2, l: lit2 };

        this.leftBar.style.background = this.hslToString(this.leftColor);
        this.rightBar.style.background = this.hslToString(this.rightColor);
    }

    hslToString(c) { return `hsl(${c.h}, ${c.s}%, ${c.l}%)`; }

    startGame() {
        this.cleanupRound();
        this.state = GameState.PLAYING;
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.bestCombo = 0;
        this.isPaused = false;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;
        this.currentPxPerSecond = this.basePxPerSecond;

        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');

        this.updateScoreDisplay();
        this.updateLevelDisplay();
        this.updateComboDisplay();
        this.showScreen(GameState.PLAYING);
        this.resizeParticleCanvas();

        this.startRound();
    }

    startRound() {
        this.isMoving = true;
        this.hasScored = false;
        this.leftPos = 0;
        this.rightPos = 0;
        this.lastTimestamp = 0;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.generateColorPair();

        if (this.leftBar) this.leftBar.style.transform = `translateX(-100px)`;
        if (this.rightBar) this.rightBar.style.transform = `translateX(${window.innerWidth + 100}px)`;

        if (this.feedbackEl) {
            this.feedbackEl.textContent = '';
            this.feedbackEl.className = 'feedback';
        }

        this.updateComboDisplay();

        this.animationFrame = requestAnimationFrame((ts) => this.animate(ts));
    }

    animate(timestamp) {
        if (!this.isMoving || !this.leftBar || !this.rightBar) return;
        if (this.isPaused) {
            this.lastTimestamp = 0;
            return;
        }

        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;

        const screenWidth = window.innerWidth;
        const delta = this.currentPxPerSecond * dt;

        this.leftPos += delta;
        this.rightPos += delta;

        const leftBarX = -100 + this.leftPos;
        const rightBarX = screenWidth + 100 - this.rightPos;

        this.leftBar.style.transform = `translateX(${leftBarX}px)`;
        this.rightBar.style.transform = `translateX(${rightBarX}px)`;

        const leftBarCenter = leftBarX + 30;
        const rightBarCenter = rightBarX + 30;

        if (!this.hasScored && leftBarCenter > screenWidth + 20 && rightBarCenter < -20) {
            this.handleMiss();
            return;
        }

        this.animationFrame = requestAnimationFrame((ts) => this.animate(ts));
    }

    cleanupRound() {
        this.isMoving = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    handleTap() {
        if (this.state !== GameState.PLAYING || !this.isMoving || this.hasScored || this.isPaused) return;

        this.hasScored = true;
        this.isMoving = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        const leftRect = this.leftBar.getBoundingClientRect();
        const rightRect = this.rightBar.getBoundingClientRect();
        const centerZoneRect = this.centerZone.getBoundingClientRect();

        const overlapLeft = Math.max(leftRect.left, rightRect.left);
        const overlapRight = Math.min(leftRect.right, rightRect.right);
        const overlapPixels = Math.max(0, overlapRight - overlapLeft);
        const barWidth = Math.min(leftRect.width, rightRect.width);
        const overlapPercentage = barWidth > 0 ? (overlapPixels / barWidth) * 100 : 0;

        const leftBarCenter = leftRect.left + leftRect.width / 2;
        const rightBarCenter = rightRect.left + rightRect.width / 2;
        const leftInZone = leftBarCenter >= centerZoneRect.left && leftBarCenter <= centerZoneRect.right;
        const rightInZone = rightBarCenter >= centerZoneRect.left && rightBarCenter <= centerZoneRect.right;
        const barsOverlapping = leftRect.right > rightRect.left && leftRect.left < rightRect.right;

        if (barsOverlapping) {
            this.evaluateTap(overlapPercentage, 'overlapping', (leftBarCenter + rightBarCenter) / 2);
        } else if (leftInZone && rightInZone) {
            this.evaluateTap(0, 'touching', (leftBarCenter + rightBarCenter) / 2);
        } else {
            this.handleMiss();
        }
    }

    evaluateTap(overlapPercentage, tapType, spawnX) {
        let points = 0;
        let feedback = '';
        let cls = 'okay';

        if (tapType === 'overlapping') {
            if (overlapPercentage >= 90) {
                points = 100; feedback = 'PERFECT!'; cls = 'perfect';
                this.stats.perfect++; this.combo++;
            } else if (overlapPercentage >= 70) {
                points = 70; feedback = 'GREAT!'; cls = 'perfect';
                this.stats.good++; this.combo++;
            } else if (overlapPercentage >= 40) {
                points = 40; feedback = 'GOOD!'; cls = 'good';
                this.stats.good++; this.combo++;
            } else {
                points = 15; feedback = 'OKAY!'; cls = 'okay';
                this.stats.okay++; this.combo = 0;
            }
        } else {
            points = 10; feedback = 'CLOSE!'; cls = 'okay';
            this.stats.okay++; this.combo = 0;
        }

        let multiplier = 1;
        if (this.combo >= 2) {
            multiplier = 1 + Math.min((this.combo - 1) * 0.15, 2);
            points = Math.round(points * multiplier);
        }

        if (this.combo > this.bestCombo) this.bestCombo = this.combo;

        this.score += points;
        this.successfulRounds++;
        this.updateScoreDisplay();
        this.updateComboDisplay();

        const comboText = this.combo >= 2 ? ` x${multiplier.toFixed(1)}` : '';
        this.feedbackEl.textContent = `${feedback} +${points}${comboText}`;
        this.feedbackEl.className = `feedback ${cls}`;

        const spawnY = (this.leftBar.getBoundingClientRect().top + 30) - this.gameCanvas.getBoundingClientRect().top;
        const spawnXLocal = spawnX - this.gameCanvas.getBoundingClientRect().left;
        const particleColor = this.hslToString({
            h: (this.leftColor.h + this.rightColor.h) / 2,
            s: 80,
            l: 60
        });
        this.spawnParticles(spawnXLocal, spawnY, particleColor, cls === 'perfect' ? 24 : 12);

        if (cls === 'perfect') this.playTone(880, 0.08);
        else if (cls === 'good') this.playTone(660, 0.07);
        else this.playTone(440, 0.06);

        const roundsForLevel = [3, 5, 7, 9, 11, 13, 15, 18, 21];
        const idx = this.level - 1;
        const roundsNeeded = roundsForLevel[idx] || 25;

        if (this.successfulRounds >= roundsNeeded && this.level < 20) {
            this.levelUp();
        }

        if ('vibrate' in navigator) {
            navigator.vibrate(cls === 'perfect' ? 30 : 15);
        }

        setTimeout(() => {
            if (this.state === GameState.PLAYING && !this.isPaused) this.startRound();
        }, 650);
    }

    levelUp() {
        this.level++;
        this.successfulRounds = 0;
        this.currentPxPerSecond = this.basePxPerSecond + (this.level - 1) * 70;

        this.feedbackEl.textContent = `LEVEL ${this.level}!`;
        this.feedbackEl.className = 'feedback perfect';
        this.updateLevelDisplay();

        const w = this.gameCanvas.getBoundingClientRect().width;
        const h = this.gameCanvas.getBoundingClientRect().height;
        for (let i = 0; i < 30; i++) {
            this.spawnParticles(Math.random() * w, h / 2 + (Math.random() - 0.5) * 100,
                `hsl(${Math.random() * 360}, 80%, 60%)`, 1);
        }

        this.playTone(523, 0.08);
        setTimeout(() => this.playTone(659, 0.08), 80);
        setTimeout(() => this.playTone(784, 0.12), 160);

        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }

    updateLevelDisplay() {
        if (this.levelDisplayEl) this.levelDisplayEl.textContent = `LEVEL ${this.level}`;
    }

    updateComboDisplay() {
        if (!this.comboTextEl) return;
        if (this.combo >= 2) {
            this.comboTextEl.textContent = `${this.combo}x COMBO`;
            this.comboTextEl.classList.add('active');
        } else {
            this.comboTextEl.textContent = '';
            this.comboTextEl.classList.remove('active');
        }
    }

    handleMiss() {
        this.cleanupRound();
        this.stats.misses++;
        this.combo = 0;
        this.updateComboDisplay();

        if (this.feedbackEl) {
            this.feedbackEl.textContent = 'MISS!';
            this.feedbackEl.className = 'feedback miss';
        }

        this.playTone(180, 0.25, 'sawtooth');
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

        setTimeout(() => this.gameOver(), 900);
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        this.cleanupRound();

        const isNewRecord = this.score > this.highScore;
        if (isNewRecord) {
            this.highScore = this.score;
            this.saveHighScore(this.highScore);
            this.newRecordEl.classList.remove('hidden');
        } else {
            this.newRecordEl.classList.add('hidden');
        }

        this.finalScoreEl.textContent = this.score;
        this.perfectCountEl.textContent = this.stats.perfect;
        this.goodCountEl.textContent = this.stats.good;
        this.okayCountEl.textContent = this.stats.okay;

        this.showScreen(GameState.GAME_OVER);
    }

    togglePause() {
        if (this.isPaused) this.resume(); else this.pause();
    }

    pause() {
        if (this.state !== GameState.PLAYING || this.isPaused) return;
        this.isPaused = true;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
    }

    resume() {
        if (this.state !== GameState.PLAYING || !this.isPaused) return;
        this.isPaused = false;
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        if (this.isMoving) {
            this.lastTimestamp = 0;
            this.animationFrame = requestAnimationFrame((ts) => this.animate(ts));
        }
    }

    showScreen(screen) {
        Object.values(this.screens).forEach(s => { if (s) s.classList.remove('active'); });
        const target = this.screens[screen];
        if (target) target.classList.add('active');

        const showInGame = screen === GameState.PLAYING;
        if (this.infoBtn) this.infoBtn.classList.toggle('hidden', !showInGame);
        if (this.pauseBtn) this.pauseBtn.classList.toggle('hidden', !showInGame);
    }

    updateScoreDisplay() {
        if (this.currentScoreEl) this.currentScoreEl.textContent = this.score;
        if (this.bestScoreEl) this.bestScoreEl.textContent = Math.max(this.highScore, this.score);
    }

    updateHighScoreDisplay() {
        if (this.splashHighScoreEl) this.splashHighScoreEl.textContent = this.highScore;
        if (this.bestScoreEl) this.bestScoreEl.textContent = this.highScore;
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem(HIGH_SCORE_KEY);
            const n = saved ? parseInt(saved, 10) : 0;
            return Number.isFinite(n) ? n : 0;
        } catch (e) { return 0; }
    }

    saveHighScore(score) {
        try { localStorage.setItem(HIGH_SCORE_KEY, String(score)); } catch (e) {}
        this.updateHighScoreDisplay();
    }

    ensureAudio() {
        if (!this.settings.sound) return null;
        if (!this.audioCtx) {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this.audioCtx = new AC();
            } catch (e) { return null; }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
    }

    playTone(freq, duration = 0.1, type = 'sine') {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration + 0.02);
        } catch (e) {}
    }

    resizeParticleCanvas() {
        if (!this.particleCanvas || !this.gameCanvas) return;
        const rect = this.gameCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.particleCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
        this.particleCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
        this.particleCanvas.style.width = rect.width + 'px';
        this.particleCanvas.style.height = rect.height + 'px';
        if (this.particleCtx) this.particleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    spawnParticles(x, y, color, count) {
        if (!this.particleCtx) return;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 220;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.4,
                age: 0,
                size: 3 + Math.random() * 4,
                color
            });
        }
        if (!this.particleAnimating) {
            this.particleAnimating = true;
            this.lastParticleTs = 0;
            requestAnimationFrame((ts) => this.animateParticles(ts));
        }
    }

    animateParticles(timestamp) {
        if (!this.particleCtx) { this.particleAnimating = false; return; }
        if (!this.lastParticleTs) this.lastParticleTs = timestamp;
        const dt = Math.min(0.05, (timestamp - this.lastParticleTs) / 1000);
        this.lastParticleTs = timestamp;

        const w = this.particleCanvas.width / (window.devicePixelRatio || 1);
        const h = this.particleCanvas.height / (window.devicePixelRatio || 1);
        this.particleCtx.clearRect(0, 0, w, h);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;
            if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
            p.vy += 400 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const alpha = Math.max(0, 1 - p.age / p.life);
            this.particleCtx.globalAlpha = alpha;
            this.particleCtx.fillStyle = p.color;
            this.particleCtx.beginPath();
            this.particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.particleCtx.fill();
        }
        this.particleCtx.globalAlpha = 1;

        if (this.particles.length > 0) {
            requestAnimationFrame((ts) => this.animateParticles(ts));
        } else {
            this.particleAnimating = false;
        }
    }
}

let game;

window.addEventListener('DOMContentLoaded', () => {
    try {
        game = new ColorClash();
        window.game = game;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    } catch (error) {
        console.error('Game initialization error:', error);
    }
});

window.addEventListener('beforeunload', (e) => {
    if (game && game.state === GameState.PLAYING) {
        e.preventDefault();
        e.returnValue = '';
    }
});
