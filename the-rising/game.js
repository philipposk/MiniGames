const config = {
    canvas: {
        width: 400,
        height: 700
    },
    block: {
        width: 60,
        height: 30,
        speed: 2
    },
    water: {
        startY: 500,
        riseSpeed: 0.3,
        freezeSpeed: 5,
        freezeHeight: 200
    },
    colors: {
        human: '#ff6b6b',
        humanFace: '#fff',
        water: 'rgba(64, 156, 255, 0.7)',
        ice: 'rgba(200, 230, 255, 0.8)',
        deadHuman: 'rgba(100, 100, 100, 0.5)',
        boat: '#8B4513',
        raft: '#CD853F',
        mattress: '#FF6347'
    },
    floatTypes: ['boat', 'raft', 'mattress']
};

let soundManager = null;

const STORAGE_KEY = 'theRising.progress.v1';

const game = {
    canvas: null,
    ctx: null,
    dpr: 1,
    level: 1,
    score: 0,
    survivors: 30,
    totalPeople: 30,
    state: 'menu',

    bestLevel: 1,
    bestScore: 0,
    volume: 0.7,
    muted: false,
    showHelp: false,

    hero: null,
    currentBlock: null,
    stackedBlocks: [],
    deadBlocks: [],
    frozenLayers: [],

    water: {
        y: 500,
        rising: true
    },

    targetHeight: 100,
    direction: 1,
    spawnFromLeft: true,

    _rafId: null,
    _lastTime: 0,
    _levelFlashStart: 0,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.background = '#0f1530';

        this.loadProgress();
        this.resizeCanvas();

        if (typeof SoundManager !== 'undefined') {
            soundManager = new SoundManager();
        }

        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') {
                this.togglePause();
            }
        });

        let lastTap = 0;
        const onTap = (e) => {
            if (e) e.preventDefault();
            const now = Date.now();
            if (now - lastTap < 80) return;
            lastTap = now;
            this.unlockAudio();
            this.handleTap();
        };

        this.canvas.addEventListener('click', onTap);
        this.canvas.addEventListener('touchstart', onTap, { passive: false });
        this.canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

        window.addEventListener('keydown', (e) => {
            this.unlockAudio();

            if (e.key === 'h' || e.key === 'H' || e.key === '?') {
                e.preventDefault();
                this.showHelp = !this.showHelp;
                return;
            }
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.toggleMute();
                return;
            }
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                this.setVolume(this.volume + 0.1);
                return;
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                this.setVolume(this.volume - 0.1);
                return;
            }
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                this.restartGame();
                return;
            }

            if (this.state === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.startGame();
                return;
            }

            if ((this.state === 'playing' || this.state === 'paused') &&
                (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                this.togglePause();
                return;
            }

            if (this.state === 'playing' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.handleTap();
                return;
            }

            if (this.state === 'gameOver' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.startGame();
                return;
            }
        });

        this._lastTime = performance.now();
        this.gameLoop();
    },

    loadProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.bestLevel === 'number') this.bestLevel = data.bestLevel;
            if (typeof data.bestScore === 'number') this.bestScore = data.bestScore;
            if (typeof data.volume === 'number') this.volume = data.volume;
            if (typeof data.muted === 'boolean') this.muted = data.muted;
        } catch (e) {}
    },

    saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                bestLevel: this.bestLevel,
                bestScore: this.bestScore,
                volume: this.volume,
                muted: this.muted
            }));
        } catch (e) {}
    },

    unlockAudio() {
        if (!soundManager) return;
        if (!soundManager.initialized) {
            soundManager.init().then(() => {
                soundManager.setMasterVolume(this.muted ? 0 : this.volume);
            });
        } else if (soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
            soundManager.audioContext.resume();
        }
    },

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
        if (soundManager && soundManager.initialized) {
            soundManager.setMasterVolume(this.muted ? 0 : this.volume);
        }
        this.saveProgress();
    },

    toggleMute() {
        this.muted = !this.muted;
        if (soundManager && soundManager.initialized) {
            soundManager.setMasterVolume(this.muted ? 0 : this.volume);
        }
        this.saveProgress();
    },

    startGame() {
        this.state = 'playing';
        this.level = 1;
        this.score = 0;
        this.survivors = 30;
        this.totalPeople = 30;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.frozenLayers = [];
        this.hero = null;
        this.currentBlock = null;
        this.water.y = config.canvas.height - 200;
        this.water.rising = true;
        this.targetHeight = Math.max(80, config.canvas.height * 0.25);
        this.spawnFromLeft = true;
        this.direction = 1;
        this._levelFlashStart = performance.now();
        this.updateUI();
        this.hideMessage();
        this.spawnBlock();

        if (soundManager) {
            soundManager.init().then(() => {
                soundManager.setMasterVolume(this.muted ? 0 : this.volume);
                soundManager.playTension();
                soundManager.playWaterAmbient();
            });
        }

        this.showMessage(`LEVEL ${this.level}\n\nStack to the GOAL line`);
        setTimeout(() => {
            if (this.state === 'playing') this.hideMessage();
        }, 2200);
    },

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.hideMessage();
        }
    },

    restartGame() {
        this.hideMessage();
        this.startGame();
    },

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr;

        let screenWidth = window.innerWidth;
        let screenHeight = window.innerHeight;

        const isMobile = screenWidth < 768;
        if (!isMobile) {
            screenWidth = Math.min(500, screenWidth);
            screenHeight = Math.min(900, screenHeight);
        }

        this.canvas.style.width = screenWidth + 'px';
        this.canvas.style.height = screenHeight + 'px';
        this.canvas.width = screenWidth * dpr;
        this.canvas.height = screenHeight * dpr;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        config.canvas.width = screenWidth;
        config.canvas.height = screenHeight;

        config.block.width = Math.floor(screenWidth * 0.2);
        config.block.height = Math.floor(config.block.width * 0.5);
        config.block.speed = Math.max(2, screenWidth * 0.005);

        if (this.state === 'menu') {
            this.water.y = config.canvas.height - 200;
        }

        if (this.level > 1) {
            const levelProgress = (this.level - 1) * 150;
            this.targetHeight = Math.max(50, config.canvas.height - 200 - levelProgress);
        } else if (this.state !== 'playing' && this.state !== 'freezing') {
            this.targetHeight = Math.max(80, config.canvas.height * 0.25);
        }
    },

    spawnBlock() {
        if (this.survivors <= 0) {
            this.endLevel();
            return;
        }

        const lastBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        let startY;
        if (lastBlock) {
            startY = lastBlock.y - config.block.height;
        } else {
            startY = Math.max(40, this.water.y - config.block.height * 2);
        }

        let startX;
        if (this.spawnFromLeft) {
            startX = 10;
            this.direction = 1;
        } else {
            startX = config.canvas.width - config.block.width - 10;
            this.direction = -1;
        }
        this.spawnFromLeft = !this.spawnFromLeft;

        const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
        const isHeroBlock = this.level === 1 && this.stackedBlocks.length === 0 && !this.hero;

        this.currentBlock = {
            x: startX,
            y: startY,
            width: config.block.width,
            height: config.block.height,
            hasName: Math.random() > 0.7,
            name: this.generateName(),
            survivalCount: 0,
            scared: false,
            floatType,
            peopleCount: isHeroBlock ? 1 : Math.floor(Math.random() * 2) + 1,
            isHero: isHeroBlock,
            direction: this.direction,
            velocity: 0,
            falling: false,
            drowned: false
        };
        if (isHeroBlock) this.hero = this.currentBlock;
        this.survivors--;
        this.updateUI();
    },

    generateName() {
        const names = ['Anna', 'Ben', 'Chen', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
        return names[Math.floor(Math.random() * names.length)];
    },

    handleTap() {
        if (this.state === 'menu') {
            this.startGame();
            return;
        }
        if (this.state === 'gameOver') {
            this.startGame();
            return;
        }
        if (this.state === 'paused') {
            this.togglePause();
            return;
        }
        if (this.state !== 'playing' || !this.currentBlock) return;

        let placed = false;
        if (this.stackedBlocks.length === 0) {
            this.stackedBlocks.push(this.currentBlock);
            placed = true;
            if (soundManager) soundManager.playStack();
        } else {
            placed = this.placeBlock();
        }
        this.currentBlock = null;

        if (placed) {
            if (this.stackedBlocks.length > 0 &&
                this.stackedBlocks[this.stackedBlocks.length - 1].y <= this.targetHeight) {
                this.endLevel();
            } else {
                this.spawnBlock();
            }
        } else if (this.state === 'playing') {
            this.spawnBlock();
        }
    },

    placeBlock() {
        const placedBlock = this.currentBlock;
        const baseBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        if (!baseBlock) return false;

        const overlapStart = Math.max(placedBlock.x, baseBlock.x);
        const overlapEnd = Math.min(placedBlock.x + placedBlock.width, baseBlock.x + baseBlock.width);
        const overlapWidth = Math.max(0, overlapEnd - overlapStart);
        const overlapRatio = placedBlock.width > 0 ? overlapWidth / placedBlock.width : 0;

        if (overlapRatio > 0.1) {
            const peopleToSave = Math.max(1, Math.floor(placedBlock.peopleCount * overlapRatio));
            const peopleLost = Math.max(0, placedBlock.peopleCount - peopleToSave);

            placedBlock.x = overlapStart;
            placedBlock.width = overlapWidth;
            placedBlock.peopleCount = peopleToSave;
            placedBlock.y = baseBlock.y - placedBlock.height;

            this.stackedBlocks.push(placedBlock);
            this.score += 10 * peopleToSave;
            if (overlapRatio > 0.9) this.score += 25;

            if (soundManager) {
                soundManager.playStack();
                if (overlapRatio > 0.9) soundManager.playPerfect();
            }

            if (peopleLost > 0) {
                const fallingPart = {
                    ...placedBlock,
                    width: Math.max(8, config.block.width - overlapWidth),
                    x: placedBlock.x > baseBlock.x ? baseBlock.x : overlapEnd,
                    peopleCount: peopleLost,
                    falling: true,
                    velocity: 0,
                    isHero: false,
                    drowned: false
                };
                this.deadBlocks.push(fallingPart);
                if (soundManager) soundManager.playSplash();
            }

            this.updateUI();
            return true;
        }

        placedBlock.falling = true;
        placedBlock.velocity = 0;
        this.deadBlocks.push(placedBlock);
        this.score = Math.max(0, this.score - 10);

        if (soundManager) {
            soundManager.playSplash();
            soundManager.playDrown();
        }

        if (placedBlock.isHero) {
            this.endLevel(true);
            return false;
        }
        this.updateUI();
        return false;
    },

    endLevel(heroDied = false) {
        this.water.rising = false;

        if (heroDied) {
            this.persistBest();
            this.showMessage('YOU HAVE DIED\n\nPress R or Tap to Restart');
            if (soundManager) soundManager.playDrown();
            this.state = 'gameOver';
            return;
        }

        const success = this.stackedBlocks.length > 0 &&
            this.stackedBlocks[this.stackedBlocks.length - 1].y <= this.targetHeight;

        if (success) {
            this.state = 'freezing';
            this.initialWaterY = this.water.y;
            this.water.rising = false;

            if (soundManager) {
                soundManager.playFreeze();
                soundManager.playLevelComplete();
            }
            this.showMessage('WATER FREEZING...');
            setTimeout(() => this.freezeLevel(), 1800);
        } else {
            this.persistBest();
            this.state = 'gameOver';
            this.showMessage('GAME OVER\n\nPress R or Tap to Restart');
            if (soundManager) soundManager.playWarning();
        }
    },

    persistBest() {
        if (this.level > this.bestLevel) this.bestLevel = this.level;
        if (this.score > this.bestScore) this.bestScore = this.score;
        this.saveProgress();
    },

    freezeLevel() {
        const aboveWater = this.stackedBlocks.filter(b => b.y < this.water.y);

        this.frozenLayers.push({
            blocks: [...this.stackedBlocks, ...this.deadBlocks],
            waterLevel: this.water.y,
            level: this.level
        });

        const savedPeople = aboveWater.reduce((s, b) => s + (b.peopleCount || 1), 0);
        const survivorCount = Math.max(5, Math.floor(savedPeople * 0.8) + 5);
        this.survivors = survivorCount;
        this.totalPeople = survivorCount + Math.floor(this.level * 8);

        this.persistBest();
        this.showMessage(`${survivorCount} SURVIVORS\nLEVEL ${this.level + 1}`);
        setTimeout(() => this.nextLevel(), 2200);
    },

    nextLevel() {
        this.level++;
        this._levelFlashStart = performance.now();

        if (this.level > 5) {
            this.showMessage('ASCENDING TO HEAVEN...');
            this.state = 'ending';
            setTimeout(() => this.startEnding(), 1800);
            return;
        }

        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.hero = null;

        this.targetHeight = Math.max(50, this.water.y - 220);
        this.water.y = Math.max(100, this.water.y - 50);
        this.water.rising = true;
        this.state = 'playing';

        this.updateUI();
        this.hideMessage();
        this.spawnBlock();
    },

    startEnding() {
        if (typeof EndingSequence !== 'undefined') {
            this.ending = new EndingSequence(this);
            this.ending.start();
            this.state = 'ending';
        }
    },

    update(dt) {
        if (this.state === 'menu' || this.state === 'paused' || this.state === 'gameOver') return;

        if (this.state === 'ending' && this.ending) {
            this.ending.update(dt);
            return;
        }

        if (this.state === 'playing') {
            if (this.currentBlock) {
                this.currentBlock.x += config.block.speed * this.direction;
                if (this.currentBlock.x <= 0) {
                    this.currentBlock.x = 0;
                    this.direction = 1;
                } else if (this.currentBlock.x + this.currentBlock.width >= config.canvas.width) {
                    this.currentBlock.x = config.canvas.width - this.currentBlock.width;
                    this.direction = -1;
                }
                if (this.currentBlock.y >= this.water.y - 10) {
                    this.currentBlock.scared = true;
                }
            }

            if (this.water.rising && this.water.y > this.targetHeight) {
                this.water.y -= config.water.riseSpeed;
            }

            this.deadBlocks.forEach(block => {
                if (block.falling) {
                    block.velocity = (block.velocity || 0) + 0.5;
                    block.y += block.velocity;
                    if (block.y >= this.water.y) {
                        block.y = this.water.y;
                        block.falling = false;
                    }
                }
            });

            this.stackedBlocks.forEach(block => {
                if (block.y >= this.water.y && !block.drowned) {
                    block.drowned = true;
                    this.deadBlocks.push({ ...block, falling: false });
                    if (block.isHero) this.endLevel(true);
                }
            });
        } else if (this.state === 'freezing') {
            if (this.water.y > 0) {
                this.water.y -= config.water.freezeSpeed;
            }
        }
    },

    draw() {
        const w = config.canvas.width;
        const h = config.canvas.height;

        this.ctx.fillStyle = '#0f1530';
        this.ctx.fillRect(0, 0, w, h);

        if (this.state === 'menu') {
            this.drawMenu();
            this.drawHud();
            if (this.showHelp) this.drawHelpOverlay();
            return;
        }

        if (this.state === 'ending' && this.ending) {
            this.ending.draw(this.ctx);
            return;
        }

        this.drawWaterAndIce();

        this.frozenLayers.forEach(layer => {
            layer.blocks.forEach(block => {
                this.ctx.fillStyle = 'rgba(180, 210, 230, 0.55)';
                this.ctx.fillRect(block.x, block.y, block.width, block.height);
            });
        });

        this.ctx.save();
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
        this.ctx.strokeStyle = `rgba(255, 235, 80, ${pulse})`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 8]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.targetHeight);
        this.ctx.lineTo(w, this.targetHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = `rgba(255, 235, 80, ${pulse})`;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('GOAL', 10, this.targetHeight - 6);
        this.ctx.restore();

        this.stackedBlocks.forEach(block => {
            if (!block.drowned) this.drawHuman(block);
        });

        this.deadBlocks.forEach(block => {
            this.ctx.fillStyle = config.colors.deadHuman;
            this.ctx.fillRect(block.x, block.y, block.width, block.height);
        });

        if (this.currentBlock) this.drawHuman(this.currentBlock, true);

        if (this.state === 'freezing' && this.hero) this.drawHeroCinematic();

        this.drawLevelFlash();
        this.drawHud();
        if (this.showHelp) this.drawHelpOverlay();
        if (this.state === 'paused') this.drawPausedOverlay();
        if (this.state === 'gameOver') this.drawGameOverOverlay();
    },

    drawLevelFlash() {
        const elapsed = performance.now() - this._levelFlashStart;
        if (elapsed > 900) return;
        const t = elapsed / 900;
        const alpha = (1 - t) * 0.45;
        this.ctx.fillStyle = `rgba(78, 204, 163, ${alpha})`;
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
    },

    drawHud() {
        const w = config.canvas.width;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.ctx.fillRect(0, 0, w, 28);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px -apple-system, Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score ${this.score}`, 8, 18);
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Best L${this.bestLevel}  ${this.bestScore}pts`, w / 2, 18);
        this.ctx.textAlign = 'right';
        const volStr = this.muted ? 'MUTE' : `Vol ${Math.round(this.volume * 100)}%`;
        this.ctx.fillText(`${volStr}  ·  H help`, w - 8, 18);
        this.ctx.restore();
    },

    drawHelpOverlay() {
        const w = config.canvas.width;
        const h = config.canvas.height;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.75)';
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 28px Arial';
        this.ctx.fillText('CONTROLS', w / 2, h * 0.2);
        this.ctx.font = '18px Arial';
        const lines = [
            'TAP / SPACE / ENTER  -  Place block',
            'P or ESC  -  Pause',
            'R  -  Restart',
            'M  -  Mute / Unmute',
            '+ / -  -  Volume',
            'H  -  Toggle this help'
        ];
        lines.forEach((line, i) => {
            this.ctx.fillText(line, w / 2, h * 0.3 + i * 30);
        });
        this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Press H to close', w / 2, h * 0.85);
        this.ctx.restore();
    },

    drawWaterAndIce() {
        if (this.water.y > config.canvas.height) this.water.y = config.canvas.height;
        if (this.water.y < 0) this.water.y = 0;

        const grad = this.ctx.createLinearGradient(0, this.water.y, 0, config.canvas.height);
        grad.addColorStop(0, 'rgba(64, 156, 255, 0.85)');
        grad.addColorStop(1, 'rgba(20, 60, 120, 0.95)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, config.canvas.height - this.water.y);

        if (this.state === 'freezing') {
            const denom = Math.max(1, config.water.freezeHeight);
            const freezeProgress = Math.min(1, (this.initialWaterY - this.water.y) / denom);
            const iceColor = `rgba(173, 216, 230, ${Math.min(freezeProgress, 0.8)})`;
            this.ctx.fillStyle = iceColor;
            this.ctx.fillRect(0, this.water.y, config.canvas.width, config.canvas.height - this.water.y);
        }

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        const amp = 3;
        const t = performance.now() * 0.003;
        this.ctx.moveTo(0, this.water.y);
        for (let x = 0; x <= config.canvas.width; x += 12) {
            this.ctx.lineTo(x, this.water.y + Math.sin(t + x * 0.05) * amp);
        }
        this.ctx.stroke();
    },

    drawHeroCinematic() {
        const heroBlock = this.hero;
        if (!heroBlock) return;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        const heroCenterX = heroBlock.x + heroBlock.width / 2;
        const heroCenterY = heroBlock.y + heroBlock.height / 2;
        const pulse = 1 + 0.05 * Math.sin(Date.now() * 0.005);
        const zoom = 2.0 * pulse;
        this.ctx.translate(config.canvas.width / 2, config.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-heroCenterX, -heroCenterY);
        this.drawHuman(heroBlock, false);
        this.ctx.restore();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SOME SURVIVE. MANY FREEZE BELOW.', config.canvas.width / 2, 50);
    },

    drawHuman(block, isMoving = false) {
        if (!block) return;
        const floatHeight = block.height * 0.4;
        const peopleHeight = block.height * 0.6;
        this.drawFloat(block, floatHeight);

        const peopleY = block.y;
        const peopleCount = block.peopleCount || 1;
        const personWidth = block.width / peopleCount;
        const scale = Math.max(0.5, 1.0 - (this.level - 1) * 0.1);
        const scaledPersonHeight = peopleHeight * scale;
        const scaledPersonWidth = personWidth * scale;
        const scaledPeopleY = peopleY + (peopleHeight - scaledPersonHeight);

        for (let i = 0; i < peopleCount; i++) {
            const personX = block.x + (i * personWidth) + (personWidth - scaledPersonWidth) / 2;
            this.drawPerson(personX, scaledPeopleY, scaledPersonWidth, scaledPersonHeight, block.scared, isMoving, block.isHero);
        }

        if (block.hasName) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(block.name, block.x + 5, block.y - 5);
        }
    },

    drawFloat(block, floatHeight) {
        if (!block) return;
        const floatY = block.y + (block.height - floatHeight);
        const floatType = block.floatType || 'raft';
        let floatColor;
        if (floatType === 'boat') floatColor = '#A0522D';
        else if (floatType === 'mattress') floatColor = '#FF4500';
        else floatColor = '#DEB887';

        if (floatType === 'boat') {
            this.ctx.fillStyle = floatColor;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x + 5, floatY);
            this.ctx.lineTo(block.x + block.width - 5, floatY);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight);
            this.ctx.lineTo(block.x, floatY + floatHeight);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (floatType === 'raft') {
            this.ctx.fillStyle = floatColor;
            this.ctx.fillRect(block.x, floatY, block.width, floatHeight);
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(block.x, floatY, block.width, floatHeight);
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 1;
            const logCount = 4;
            for (let i = 1; i < logCount; i++) {
                const logX = block.x + (block.width / logCount) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(logX, floatY);
                this.ctx.lineTo(logX, floatY + floatHeight);
                this.ctx.stroke();
            }
        } else {
            this.ctx.fillStyle = floatColor;
            const radius = 6;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x + radius, floatY);
            this.ctx.lineTo(block.x + block.width - radius, floatY);
            this.ctx.arcTo(block.x + block.width, floatY, block.x + block.width, floatY + radius, radius);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight - radius);
            this.ctx.arcTo(block.x + block.width, floatY + floatHeight, block.x + block.width - radius, floatY + floatHeight, radius);
            this.ctx.lineTo(block.x + radius, floatY + floatHeight);
            this.ctx.arcTo(block.x, floatY + floatHeight, block.x, floatY + floatHeight - radius, radius);
            this.ctx.lineTo(block.x, floatY + radius);
            this.ctx.arcTo(block.x, floatY, block.x + radius, floatY, radius);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#CC4A2F';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            this.ctx.fillRect(block.x + 4, floatY + 3, block.width - 8, floatHeight / 3);
        }
    },

    drawPerson(x, y, width, height, scared, isMoving, isHero = false) {
        const bodyColor = isHero ? '#f9ca24' : (scared ? '#ff3333' : '#ff3366');
        const headSize = Math.max(width * 0.55, height * 0.4);
        const bodyHeight = height - headSize;
        const personCenterX = x + width / 2;
        const headCenterY = y + headSize / 2;

        this.ctx.fillStyle = '#ffdbac';
        this.ctx.beginPath();
        this.ctx.arc(personCenterX, headCenterY, headSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#d4a574';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.fillStyle = bodyColor;
        this.ctx.fillRect(x + width * 0.2, y + headSize * 0.8, width * 0.6, bodyHeight * 0.7);

        this.ctx.strokeStyle = bodyColor;
        this.ctx.lineWidth = Math.max(2, width * 0.1);
        this.ctx.lineCap = 'round';
        if (scared && isMoving) {
            this.ctx.beginPath();
            this.ctx.moveTo(personCenterX - width * 0.15, y + headSize * 0.9);
            this.ctx.lineTo(personCenterX - width * 0.35, y + headSize * 0.3);
            this.ctx.moveTo(personCenterX + width * 0.15, y + headSize * 0.9);
            this.ctx.lineTo(personCenterX + width * 0.35, y + headSize * 0.3);
            this.ctx.stroke();
        } else {
            this.ctx.beginPath();
            this.ctx.moveTo(personCenterX - width * 0.15, y + headSize * 0.9);
            this.ctx.lineTo(personCenterX - width * 0.25, y + headSize * 1.3);
            this.ctx.moveTo(personCenterX + width * 0.15, y + headSize * 0.9);
            this.ctx.lineTo(personCenterX + width * 0.25, y + headSize * 1.3);
            this.ctx.stroke();
        }

        const eyeSize = Math.max(2, headSize * 0.15);
        const eyeY = headCenterY - headSize * 0.15;
        const eyeSpacing = headSize * 0.22;

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(personCenterX - eyeSpacing, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(personCenterX + eyeSpacing, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(personCenterX - eyeSpacing, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(personCenterX + eyeSpacing, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
        this.ctx.fill();

        const mouthY = headCenterY + headSize * 0.25;
        if (scared) {
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(personCenterX, mouthY, eyeSize * 1.1, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(personCenterX, mouthY, eyeSize * 0.8, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
        }
    },

    drawMenu() {
        const width = config.canvas.width;
        const height = config.canvas.height;

        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0f3460');
        gradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.fillStyle = config.colors.water;
        this.ctx.fillRect(0, height - 100, width, 100);

        this.ctx.fillStyle = '#4ecca3';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('THE RISING', width / 2, height * 0.25);
        this.ctx.fillText('THE RISING', width / 2, height * 0.25);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Stack the living. Remember the dead.', width / 2, height * 0.33);

        const alpha = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.font = 'bold 26px Arial';
        this.ctx.fillText('TAP OR PRESS ENTER', width / 2, height * 0.5);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Best Level: ${this.bestLevel}   ·   Best Score: ${this.bestScore}`, width / 2, height * 0.58);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('SPACE/ENTER place  ·  P pause  ·  R restart', width / 2, height * 0.72);
        this.ctx.fillText('M mute  ·  +/- volume  ·  H help', width / 2, height * 0.76);
    },

    drawPausedOverlay() {
        const width = config.canvas.width;
        const height = config.canvas.height;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('PAUSED', width / 2, height * 0.4);
        this.ctx.fillText('PAUSED', width / 2, height * 0.4);
        this.ctx.font = '20px Arial';
        this.ctx.fillText('P or ESC to resume', width / 2, height * 0.5);
        this.ctx.fillText('R to restart  ·  H for help', width / 2, height * 0.56);
    },

    drawGameOverOverlay() {
        const width = config.canvas.width;
        const height = config.canvas.height;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('GAME OVER', width / 2, height * 0.35);
        this.ctx.fillText('GAME OVER', width / 2, height * 0.35);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Level reached: ${this.level}`, width / 2, height * 0.45);
        this.ctx.fillText(`Score: ${this.score}`, width / 2, height * 0.5);
        this.ctx.fillText(`Best: L${this.bestLevel} (${this.bestScore} pts)`, width / 2, height * 0.55);
        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Tap or press R / Enter to restart', width / 2, height * 0.68);
    },

    gameLoop(now) {
        try {
            const t = now || performance.now();
            const dtRaw = (t - (this._lastTime || t)) / 1000;
            this._lastTime = t;
            const dt = Math.min(0.05, dtRaw);
            this.update(dt);
            this.draw();
        } catch (e) {
            console.error('Error in gameLoop:', e);
        }
        this._rafId = requestAnimationFrame((nt) => this.gameLoop(nt));
    },

    updateUI() {
        const levelEl = document.getElementById('level');
        const survEl = document.getElementById('survivors');
        if (levelEl) levelEl.textContent = `LEVEL ${this.level}`;
        if (survEl) survEl.textContent = `SURVIVORS: ${this.survivors}/${this.totalPeople}`;
    },

    showMessage(text) {
        const msg = document.getElementById('message');
        if (!msg) return;
        msg.innerHTML = text.replace(/\n/g, '<br>');
        msg.classList.add('show');
    },

    hideMessage() {
        const msg = document.getElementById('message');
        if (msg) msg.classList.remove('show');
    }
};

window.addEventListener('load', () => {
    try {
        game.init();
    } catch (e) {
        console.error('Error during game.init:', e);
        const msg = document.getElementById('message');
        if (msg) {
            msg.textContent = 'INIT ERROR: ' + (e && e.message ? e.message : e);
            msg.classList.add('show');
        }
    }
});
