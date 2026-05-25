/* ============================================================
   COLOR CLASH — full game
   Vanilla JS, no build, GH-Pages compatible.
   ============================================================ */

const NS = 'color-clash:v1:';
const KEY = {
    SETTINGS:     NS + 'settings',
    LEADERBOARD:  NS + 'leaderboard',
    ACHIEVEMENTS: NS + 'achievements',
    COINS:        NS + 'coins',
    UNLOCKS:      NS + 'unlocks',
    SELECTED:     NS + 'selected',
    DAILY:        NS + 'daily',
    PROGRESS:     NS + 'progress' // {totalScore, packsUnlocked, dailyStreak, lastDaily}
};

const LEGACY = {
    HIGH: 'colorClashHighScore',
    SETTINGS: 'colorClashSettings'
};

const GameState = {
    MENU:      'menu',
    LEVEL_SEL: 'levelSelect',
    PLAYING:   'game',
    GAME_OVER: 'gameOver',
    SETTINGS:  'settings',
    LEADERBOARD: 'leaderboard',
    ACHIEVEMENTS: 'achievements',
    SHOP:      'shop',
    HOW_TO:    'howTo',
    CREDITS:   'credits'
};

const HASH_TO_SCREEN = {
    '#menu': 'menu',
    '#classic': 'game',
    '#speed': 'game',
    '#zen': 'game',
    '#daily': 'game',
    '#settings': 'settings',
    '#leaderboard': 'leaderboard',
    '#achievements': 'achievements',
    '#shop': 'shop',
    '#how-to': 'howTo',
    '#credits': 'credits',
    '#level-select': 'levelSelect'
};

/* ---------- 30 PROGRESSIVE COLOR PACKS ---------- */
const PACKS = (() => {
    const out = [];
    const names = ['Sunrise','Lagoon','Ember','Forest','Twilight','Cobalt','Berry','Citrus',
                   'Rose','Coral','Indigo','Mint','Crimson','Aqua','Amber','Plum',
                   'Sage','Steel','Magenta','Cyan','Bronze','Lilac','Olive','Scarlet',
                   'Teal','Gold','Violet','Jade','Ruby','Onyx'];
    for (let i = 0; i < 30; i++) {
        const hueDiff = Math.max(2, 22 - i * 0.7);
        const baseSpeed = 600 + i * 18;
        const themeHue = (i * 36) % 360;
        out.push({
            id: i + 1,
            name: names[i] || `Pack ${i+1}`,
            hueDiff,
            baseSpeed,
            themeColor: `hsl(${themeHue}, 70%, 55%)`,
            unlockScore: i === 0 ? 0 : Math.round(500 * Math.pow(1.25, i - 1))
        });
    }
    return out;
})();

/* ---------- PALETTES ---------- */
const PALETTES = [
    { id: 'default', name: 'Default',  price: 0,   colors: ['#667eea','#764ba2','#4ecca3','#ffeb3b'] },
    { id: 'neon',    name: 'Neon',     price: 100, colors: ['#ff00e0','#00fff0','#ffea00','#9d00ff'] },
    { id: 'pastel',  name: 'Pastel',   price: 100, colors: ['#ffb6b9','#fae3d9','#bbded6','#8ac6d1'] },
    { id: 'mono',    name: 'Mono',     price: 150, colors: ['#222','#666','#aaa','#fff'] },
    { id: 'retro',   name: 'Retro',    price: 200, colors: ['#f25f5c','#ffe066','#247ba0','#70c1b3'] },
    { id: 'sunset',  name: 'Sunset',   price: 250, colors: ['#ff6b6b','#ffa07a','#ffd166','#f5576c'] },
    { id: 'forest',  name: 'Forest',   price: 300, colors: ['#2d6a4f','#52b788','#95d5b2','#d8f3dc'] },
    { id: 'ocean',   name: 'Ocean',    price: 400, colors: ['#03045e','#0077b6','#00b4d8','#90e0ef'] },
    { id: 'galaxy',  name: 'Galaxy',   price: 500, colors: ['#240046','#5a189a','#9d4edd','#e0aaff'] }
];
const SHAPES = [
    { id: 'rect',    name: 'Rect',    price: 0   },
    { id: 'rounded', name: 'Rounded', price: 150 },
    { id: 'hex',     name: 'Hex',     price: 300 },
    { id: 'blob',    name: 'Blob',    price: 500 }
];

/* ---------- ACHIEVEMENTS ---------- */
const ACHIEVEMENTS = [
    { id: 'first_match',   name: 'First Match',       desc: 'Land your first successful tap' },
    { id: 'eagle_eye',     name: 'Eagle Eye',         desc: '10 PERFECTs in a row' },
    { id: 'speed_demon',   name: 'Speed Demon',       desc: 'Reach level 15 in SPEED mode' },
    { id: 'zen_master',    name: 'Zen Master',        desc: 'Play 5 minutes of ZEN' },
    { id: 'daily_streak7', name: 'Daily Streak 7',    desc: 'Play 7 daily challenges in a row' },
    { id: 'connoisseur',   name: 'Color Connoisseur', desc: 'Unlock all 30 packs' },
    { id: 'combo20',       name: 'Combo x20',         desc: 'Hit a 20-combo' },
    { id: 'no_misses',     name: 'No Misses',         desc: 'Complete a round without an OKAY' },
    { id: 'marathon',      name: 'Marathon',          desc: 'Reach level 25 in CLASSIC' },
    { id: 'speedrunner',   name: 'Speedrunner',       desc: 'Reach level 10 in SPEED under 30s' }
];

/* ---------- STORAGE HELPERS ---------- */
const Store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            if (v == null) return fallback;
            return JSON.parse(v);
        } catch (e) { return fallback; }
    },
    set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    },
    del(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

/* ---------- SEEDED RNG (mulberry32) for DAILY ---------- */
function seededRng(seed) {
    let t = seed >>> 0;
    return function() {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function dailySeed(dateStr) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
    return h;
}
function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/* =================================================================
   MAIN GAME CLASS
   ================================================================= */
class ColorClash {
    constructor() {
        this.migrateLegacy();

        this.state = GameState.MENU;
        this.mode = null;           // 'classic' | 'speed' | 'zen' | 'daily'
        this.startingPack = 1;

        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.bestCombo = 0;
        this.perfectStreak = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;
        this.roundCount = 0;

        this.dailyRoundsTotal = 20;
        this.dailyRoundsLeft = 20;
        this.dailyRng = null;

        this.zenStart = 0;
        this.modeStart = 0;

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
        this.coins = Store.get(KEY.COINS, 0) || 0;
        this.unlocks = Object.assign({ palettes: ['default'], shapes: ['rect'] },
                                     Store.get(KEY.UNLOCKS, null) || {});
        this.selected = Object.assign({ palette: 'default', shape: 'rect' },
                                      Store.get(KEY.SELECTED, null) || {});
        this.achievements = Store.get(KEY.ACHIEVEMENTS, {}) || {};
        this.progress = Object.assign({ totalScore: 0, packsUnlocked: 1, dailyStreak: 0, lastDaily: null },
                                      Store.get(KEY.PROGRESS, null) || {});

        this.audioCtx = null;

        this.particles = [];
        this.particleAnimating = false;

        this.initDOM();
        this.bindEvents();
        this.applySettings();
        this.applyPalette();
        this.applyShape();
        this.updateProgressFromScore(0); // ensure packsUnlocked computed
        this.renderMenu();
        this.renderShop();
        this.renderAchievements();
        this.renderPacks();
        this.resizeParticleCanvas();
        this.handleRoute(); // route by hash
    }

    /* ===== legacy migration ===== */
    migrateLegacy() {
        try {
            const old = localStorage.getItem(LEGACY.HIGH);
            if (old != null) {
                const n = parseInt(old, 10);
                if (Number.isFinite(n) && n > 0) {
                    const lb = Store.get(KEY.LEADERBOARD, {}) || {};
                    if (!lb.classic) lb.classic = [];
                    if (!lb.classic.some(e => e.score === n && e.name === 'OLD')) {
                        lb.classic.push({ name: 'OLD', score: n, date: todayStr() });
                        lb.classic.sort((a, b) => b.score - a.score);
                        lb.classic = lb.classic.slice(0, 10);
                        Store.set(KEY.LEADERBOARD, lb);
                    }
                }
                localStorage.removeItem(LEGACY.HIGH);
            }
            const oldSet = localStorage.getItem(LEGACY.SETTINGS);
            if (oldSet) {
                try {
                    const s = JSON.parse(oldSet);
                    const cur = Store.get(KEY.SETTINGS, null);
                    if (!cur) Store.set(KEY.SETTINGS, {
                        sfx: s.sound !== false ? 100 : 0,
                        music: 50,
                        haptics: true,
                        colorBlind: !!s.colorBlind,
                        reducedMotion: false,
                        tapSize: 'med',
                        lang: 'en'
                    });
                } catch (e) {}
                localStorage.removeItem(LEGACY.SETTINGS);
            }
        } catch (e) {}
    }

    loadSettings() {
        const def = { sfx: 100, music: 50, haptics: true, colorBlind: false,
                      reducedMotion: false, tapSize: 'med', lang: 'en' };
        return Object.assign(def, Store.get(KEY.SETTINGS, null) || {});
    }
    saveSettings() { Store.set(KEY.SETTINGS, this.settings); }

    /* ===== DOM ===== */
    initDOM() {
        this.screens = {
            menu:        document.getElementById('menu'),
            game:        document.getElementById('game'),
            gameOver:    document.getElementById('gameOver'),
            settings:    document.getElementById('settings'),
            leaderboard: document.getElementById('leaderboard'),
            achievements: document.getElementById('achievements'),
            shop:        document.getElementById('shop'),
            howTo:       document.getElementById('howTo'),
            credits:     document.getElementById('credits'),
            levelSelect: document.getElementById('levelSelect')
        };

        this.topBar = document.getElementById('topBar');
        this.coinsDisplay = document.getElementById('coinsDisplay');
        this.dailyMeta = document.getElementById('dailyMeta');

        this.leftBar = document.getElementById('leftBar');
        this.rightBar = document.getElementById('rightBar');
        this.tapArea = document.getElementById('tapArea');
        this.centerZone = document.getElementById('centerZone');
        this.gameCanvas = document.getElementById('gameCanvas');
        this.particleCanvas = document.getElementById('particleLayer');
        this.particleCtx = this.particleCanvas ? this.particleCanvas.getContext('2d') : null;

        this.currentScoreEl = document.getElementById('currentScore');
        this.bestScoreEl = document.getElementById('bestScore');
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

        this.nameEntry = document.getElementById('nameEntry');
        this.nameInput = document.getElementById('nameInput');
        this.nameSaveBtn = document.getElementById('nameSaveBtn');

        this.toastContainer = document.getElementById('toastContainer');
    }

    /* ===== EVENTS ===== */
    bindEvents() {
        // top bar
        document.getElementById('navSettings').addEventListener('click', () => this.go('#settings'));
        document.getElementById('navLeaderboard').addEventListener('click', () => this.go('#leaderboard'));
        document.getElementById('navAchievements').addEventListener('click', () => this.go('#achievements'));
        document.getElementById('navShop').addEventListener('click', () => this.go('#shop'));
        document.getElementById('navHowTo').addEventListener('click', () => this.go('#how-to'));

        // mode tiles
        document.querySelectorAll('.mode-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const m = tile.getAttribute('data-mode');
                this.go('#' + m);
            });
        });

        document.getElementById('levelSelectBtn').addEventListener('click', () => this.go('#level-select'));

        // back buttons
        document.querySelectorAll('[data-back]').forEach(b => {
            b.addEventListener('click', () => this.go('#menu'));
        });

        // tap area
        if (this.tapArea) {
            const tap = (e) => { e.preventDefault(); e.stopPropagation(); this.handleTap(); };
            this.tapArea.addEventListener('pointerdown', tap);
            this.tapArea.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        }

        // game over
        document.getElementById('restartBtn').addEventListener('click', () => {
            if (this.mode) this.go('#' + this.mode);
        });
        document.getElementById('menuBtn').addEventListener('click', () => this.go('#menu'));

        // info / pause
        if (this.infoBtn) this.infoBtn.addEventListener('click', () => {
            if (this.state === GameState.PLAYING) this.pause();
            this.go('#how-to');
        });
        if (this.pauseBtn) this.pauseBtn.addEventListener('click', () => this.togglePause());
        if (this.resumeBtn) this.resumeBtn.addEventListener('click', () => this.resume());
        if (this.quitBtn) this.quitBtn.addEventListener('click', () => {
            this.cleanupRound();
            this.isPaused = false;
            this.pauseOverlay.classList.add('hidden');
            this.go('#menu');
        });

        // settings controls
        const sfx = document.getElementById('setSfx');
        const music = document.getElementById('setMusic');
        const hap = document.getElementById('setHaptics');
        const cb = document.getElementById('setCb');
        const rm = document.getElementById('setRm');
        const tap = document.getElementById('setTap');
        const lang = document.getElementById('setLang');
        const reset = document.getElementById('resetProgress');

        sfx.value = this.settings.sfx;
        music.value = this.settings.music;
        tap.value = this.settings.tapSize;
        lang.value = this.settings.lang;

        const toggleVis = (btn, key, onTxt, offTxt) => {
            const upd = () => {
                btn.setAttribute('aria-pressed', String(!!this.settings[key]));
                btn.textContent = this.settings[key] ? onTxt : offTxt;
            };
            upd();
            btn.addEventListener('click', () => {
                this.settings[key] = !this.settings[key];
                this.saveSettings();
                this.applySettings();
                upd();
            });
        };
        toggleVis(hap, 'haptics', 'ON', 'OFF');
        toggleVis(cb, 'colorBlind', 'ON', 'OFF');
        toggleVis(rm, 'reducedMotion', 'ON', 'OFF');

        sfx.addEventListener('input', () => { this.settings.sfx = parseInt(sfx.value, 10) || 0; this.saveSettings(); });
        music.addEventListener('input', () => { this.settings.music = parseInt(music.value, 10) || 0; this.saveSettings(); });
        tap.addEventListener('change', () => { this.settings.tapSize = tap.value; this.saveSettings(); this.applySettings(); });
        lang.addEventListener('change', () => { this.settings.lang = lang.value; this.saveSettings(); });

        reset.addEventListener('click', () => {
            if (confirm('Reset ALL progress? This cannot be undone.')) {
                [KEY.LEADERBOARD, KEY.ACHIEVEMENTS, KEY.COINS, KEY.UNLOCKS, KEY.SELECTED, KEY.DAILY, KEY.PROGRESS]
                    .forEach(k => Store.del(k));
                location.reload();
            }
        });

        // leaderboard tabs
        document.querySelectorAll('.tab').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                this.renderLeaderboard(t.getAttribute('data-tab'));
            });
        });

        // name entry
        if (this.nameSaveBtn) this.nameSaveBtn.addEventListener('click', () => this.commitName());

        // keyboard
        document.addEventListener('keydown', (e) => this.handleKey(e));

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === GameState.PLAYING && !this.isPaused) this.pause();
        });

        window.addEventListener('resize', () => this.resizeParticleCanvas());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resizeParticleCanvas(), 200));
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    handleKey(e) {
        // global Esc → menu (unless playing, then pause)
        if (e.code === 'Escape') {
            if (this.state === GameState.PLAYING) { e.preventDefault(); this.togglePause(); return; }
            if (location.hash && location.hash !== '#menu') { e.preventDefault(); this.go('#menu'); return; }
        }

        if (this.state === GameState.PLAYING) {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.handleTap();
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                this.togglePause();
            }
            return;
        }

        // menu nav
        if (this.state === GameState.MENU) {
            const tiles = Array.from(document.querySelectorAll('.mode-tile'));
            const idx = tiles.indexOf(document.activeElement);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const next = tiles[(idx + 1 + tiles.length) % tiles.length] || tiles[0];
                next.focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const next = tiles[(idx - 1 + tiles.length) % tiles.length] || tiles[0];
                next.focus();
            } else if (e.code === 'Enter' && tiles.includes(document.activeElement)) {
                e.preventDefault();
                document.activeElement.click();
            }
        }
    }

    /* ===== ROUTING ===== */
    go(hash) {
        if (location.hash === hash) {
            this.handleRoute();
        } else {
            location.hash = hash;
        }
    }
    handleRoute() {
        const hash = location.hash || '#menu';
        const screen = HASH_TO_SCREEN[hash] || 'menu';

        // if leaving game while playing, cleanup
        if (this.state === GameState.PLAYING && screen !== 'game') {
            this.cleanupRound();
        }

        if (screen === 'game') {
            const mode = hash.slice(1); // 'classic'|'speed'|'zen'|'daily'
            this.startGame(mode);
        } else if (screen === 'menu') {
            this.state = GameState.MENU;
            this.showScreen('menu');
            this.renderMenu();
        } else if (screen === 'levelSelect') {
            this.state = GameState.LEVEL_SEL;
            this.showScreen('levelSelect');
            this.renderPacks();
        } else if (screen === 'settings') {
            this.state = GameState.SETTINGS;
            this.showScreen('settings');
        } else if (screen === 'leaderboard') {
            this.state = GameState.LEADERBOARD;
            this.showScreen('leaderboard');
            const active = document.querySelector('.tab.active');
            this.renderLeaderboard(active ? active.getAttribute('data-tab') : 'classic');
        } else if (screen === 'achievements') {
            this.state = GameState.ACHIEVEMENTS;
            this.showScreen('achievements');
            this.renderAchievements();
        } else if (screen === 'shop') {
            this.state = GameState.SHOP;
            this.showScreen('shop');
            this.renderShop();
        } else if (screen === 'howTo') {
            this.state = GameState.HOW_TO;
            this.showScreen('howTo');
        } else if (screen === 'credits') {
            this.state = GameState.CREDITS;
            this.showScreen('credits');
        }
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => { if (s) s.classList.remove('active'); });
        const target = this.screens[name];
        if (target) target.classList.add('active');

        const inGame = name === 'game';
        if (this.infoBtn) this.infoBtn.classList.toggle('hidden', !inGame);
        if (this.pauseBtn) this.pauseBtn.classList.toggle('hidden', !inGame);
        if (this.topBar) this.topBar.classList.toggle('hidden', inGame || name === 'gameOver');
        this.renderCoins();
    }

    /* ===== SETTINGS APPLY ===== */
    applySettings() {
        document.body.classList.toggle('cb-mode', !!this.settings.colorBlind);
        document.body.classList.toggle('reduced-motion', !!this.settings.reducedMotion);
        document.body.setAttribute('data-tap', this.settings.tapSize || 'med');
        const cssMap = { small: '44px', med: '56px', large: '72px' };
        document.documentElement.style.setProperty('--tap-target', cssMap[this.settings.tapSize] || '56px');
    }
    applyPalette() {
        const pal = PALETTES.find(p => p.id === this.selected.palette) || PALETTES[0];
        document.documentElement.style.setProperty('--pal-bg-1', pal.colors[0]);
        document.documentElement.style.setProperty('--pal-bg-2', pal.colors[1]);
        document.documentElement.style.setProperty('--pal-accent', pal.colors[2]);
    }
    applyShape() {
        SHAPES.forEach(s => document.body.classList.remove('shape-' + s.id));
        document.body.classList.add('shape-' + (this.selected.shape || 'rect'));
    }

    /* ===== MENU RENDER ===== */
    renderMenu() {
        const lb = Store.get(KEY.LEADERBOARD, {}) || {};
        ['classic', 'speed', 'zen'].forEach(m => {
            const top = (lb[m] && lb[m][0] && lb[m][0].score) || 0;
            const el = document.querySelector(`.mode-tile [data-best="${m}"]`);
            if (el) el.textContent = top;
        });
        if (this.dailyMeta) {
            const today = todayStr();
            const daily = Store.get(KEY.DAILY, {}) || {};
            const ent = daily[today];
            this.dailyMeta.textContent = ent ? `TODAY ${ent.score}` : `TODAY ${today.slice(5)}`;
        }
        this.renderCoins();
    }
    renderCoins() {
        if (this.coinsDisplay) this.coinsDisplay.textContent = this.coins;
    }

    /* ===== PACKS RENDER (level select) ===== */
    renderPacks() {
        const grid = document.getElementById('packsGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const unlocked = this.progress.packsUnlocked || 1;
        PACKS.forEach(p => {
            const tile = document.createElement('button');
            tile.className = 'pack-tile' + (p.id > unlocked ? ' locked' : '');
            tile.style.borderColor = p.themeColor;
            tile.innerHTML = `<span class="pack-id">${p.id}</span><span class="pack-name">${p.name}</span>`;
            if (p.id > unlocked) {
                tile.setAttribute('aria-disabled', 'true');
                tile.title = `Need ${p.unlockScore} total score`;
                tile.disabled = true;
            } else {
                tile.addEventListener('click', () => {
                    this.startingPack = p.id;
                    this.go('#classic');
                });
            }
            grid.appendChild(tile);
        });
    }

    /* ===== SHOP RENDER ===== */
    renderShop() {
        const palGrid = document.getElementById('palettesGrid');
        const shGrid = document.getElementById('shapesGrid');
        if (!palGrid || !shGrid) return;
        palGrid.innerHTML = '';
        shGrid.innerHTML = '';

        PALETTES.forEach(p => {
            const owned = this.unlocks.palettes.includes(p.id);
            const sel = this.selected.palette === p.id;
            const item = document.createElement('button');
            item.className = 'shop-item' + (sel ? ' selected' : '') + (!owned ? ' locked' : '');
            const sw = p.colors.map(c => `<span class="sw" style="background:${c}"></span>`).join('');
            item.innerHTML = `<div class="shop-swatch">${sw}</div>
                <div class="shop-name">${p.name}</div>
                <div class="shop-price ${owned ? 'owned' : ''}">${owned ? (sel ? 'SELECTED' : 'OWNED') : p.price + ' C'}</div>`;
            item.addEventListener('click', () => this.handleShopBuy('palette', p));
            palGrid.appendChild(item);
        });

        SHAPES.forEach(s => {
            const owned = this.unlocks.shapes.includes(s.id);
            const sel = this.selected.shape === s.id;
            const item = document.createElement('button');
            item.className = 'shop-item' + (sel ? ' selected' : '') + (!owned ? ' locked' : '');
            const shapeStyle =
                s.id === 'rect'    ? 'border-radius:4px' :
                s.id === 'rounded' ? 'border-radius:14px' :
                s.id === 'hex'     ? 'clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)' :
                                     'border-radius:40% 60% 55% 45% / 50% 40% 60% 50%';
            item.innerHTML = `<div class="shop-swatch"><span class="sw" style="width:28px;height:28px;background:#fff;${shapeStyle}"></span></div>
                <div class="shop-name">${s.name}</div>
                <div class="shop-price ${owned ? 'owned' : ''}">${owned ? (sel ? 'SELECTED' : 'OWNED') : s.price + ' C'}</div>`;
            item.addEventListener('click', () => this.handleShopBuy('shape', s));
            shGrid.appendChild(item);
        });
    }

    handleShopBuy(kind, item) {
        const ownedList = kind === 'palette' ? this.unlocks.palettes : this.unlocks.shapes;
        const owned = ownedList.includes(item.id);
        if (!owned) {
            if (this.coins < item.price) {
                this.toast(`NEED ${item.price - this.coins} MORE COINS`);
                return;
            }
            this.coins -= item.price;
            ownedList.push(item.id);
            Store.set(KEY.COINS, this.coins);
            Store.set(KEY.UNLOCKS, this.unlocks);
            this.toast(`UNLOCKED ${item.name.toUpperCase()}`);
        }
        // select
        if (kind === 'palette') { this.selected.palette = item.id; this.applyPalette(); }
        else { this.selected.shape = item.id; this.applyShape(); }
        Store.set(KEY.SELECTED, this.selected);
        this.renderShop();
        this.renderCoins();
    }

    /* ===== ACHIEVEMENTS RENDER ===== */
    renderAchievements() {
        const ul = document.getElementById('achList');
        if (!ul) return;
        ul.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const li = document.createElement('li');
            const unlocked = !!this.achievements[a.id];
            if (unlocked) li.classList.add('unlocked');
            li.innerHTML = `<div class="ach-icon">${unlocked ? '*' : '-'}</div>
                <div class="ach-text"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
            ul.appendChild(li);
        });
    }
    unlockAchievement(id) {
        if (this.achievements[id]) return;
        this.achievements[id] = { date: todayStr() };
        Store.set(KEY.ACHIEVEMENTS, this.achievements);
        const def = ACHIEVEMENTS.find(a => a.id === id);
        this.toast(`UNLOCKED: ${def ? def.name : id}`);
        this.addCoins(50);
    }

    /* ===== LEADERBOARD RENDER ===== */
    renderLeaderboard(tab) {
        const ol = document.getElementById('lbList');
        if (!ol) return;
        ol.innerHTML = '';
        const lb = Store.get(KEY.LEADERBOARD, {}) || {};
        let list = [];
        if (tab === 'daily') {
            const today = todayStr();
            list = (lb.dailyByDate && lb.dailyByDate[today]) || [];
        } else {
            list = lb[tab] || [];
        }
        if (!list.length) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="lb-name" style="opacity:0.6">NO SCORES YET</span>`;
            ol.appendChild(li);
            return;
        }
        list.slice(0, 10).forEach((e, i) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="lb-rank">#${i + 1}</span>
                <span class="lb-name">${(e.name || '---').toUpperCase()}</span>
                <span class="lb-score">${e.score}</span>`;
            ol.appendChild(li);
        });
    }

    /* ===== TOAST ===== */
    toast(text, ms = 2200) {
        if (!this.toastContainer) return;
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = text;
        this.toastContainer.appendChild(t);
        setTimeout(() => { try { t.remove(); } catch (e) {} }, ms);
    }

    /* ===== START GAME ===== */
    startGame(mode) {
        this.cleanupRound();
        this.mode = mode;
        this.state = GameState.PLAYING;
        this.score = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.perfectStreak = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;
        this.roundCount = 0;
        this.isPaused = false;
        this.modeStart = performance.now();
        this.zenStart = mode === 'zen' ? performance.now() : 0;

        // starting pack
        let startPack = 1;
        if (mode === 'classic') startPack = Math.min(this.startingPack || 1, this.progress.packsUnlocked || 1);
        else if (mode === 'speed') startPack = 3;
        else if (mode === 'zen') startPack = 1;
        else if (mode === 'daily') startPack = 5;
        this.level = startPack;

        const pack = PACKS[this.level - 1] || PACKS[0];
        this.basePxPerSecond = pack.baseSpeed;
        this.currentPxPerSecond = this.basePxPerSecond;

        // daily setup
        if (mode === 'daily') {
            const today = todayStr();
            const daily = Store.get(KEY.DAILY, {}) || {};
            if (daily[today]) {
                this.toast('TODAY ALREADY PLAYED — REPLAYING');
            }
            this.dailyRng = seededRng(dailySeed(today));
            this.dailyRoundsTotal = 20;
            this.dailyRoundsLeft = 20;
        } else {
            this.dailyRng = null;
        }

        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');

        this.updateScoreDisplay();
        this.updateLevelDisplay();
        this.updateComboDisplay();
        this.showScreen('game');
        this.resizeParticleCanvas();

        this.startRound();
    }

    startRound() {
        this.isMoving = true;
        this.hasScored = false;
        this.leftPos = 0;
        this.rightPos = 0;
        this.lastTimestamp = 0;
        this.roundCount++;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.generateColorPair();

        if (this.leftBar) this.leftBar.style.transform = `translateX(-100px)`;
        if (this.rightBar) this.rightBar.style.transform = `translateX(${window.innerWidth + 100}px)`;
        if (this.feedbackEl) { this.feedbackEl.textContent = ''; this.feedbackEl.className = 'feedback'; }

        this.updateComboDisplay();
        this.animationFrame = requestAnimationFrame((ts) => this.animate(ts));
    }

    rand() {
        return this.dailyRng ? this.dailyRng() : Math.random();
    }

    generateColorPair() {
        const pack = PACKS[Math.min(this.level - 1, PACKS.length - 1)] || PACKS[0];
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
        const family = families[Math.floor(this.rand() * families.length)];
        const baseHue = family.baseHue + (this.rand() - 0.5) * family.range;

        const maxDifference = pack.hueDiff;
        const hueDifference = this.rand() * maxDifference;
        const direction = this.rand() > 0.5 ? 1 : -1;

        const hue1 = (baseHue + 360) % 360;
        const hue2 = (baseHue + hueDifference * direction + 360) % 360;

        const baseSat = 65 + this.rand() * 25;
        const baseLit = 52 + this.rand() * 13;
        const sat1 = Math.max(40, baseSat + (this.rand() - 0.5) * 8);
        const sat2 = Math.max(40, baseSat + (this.rand() - 0.5) * 8);
        const lit1 = Math.max(35, Math.min(75, baseLit + (this.rand() - 0.5) * 8));
        const lit2 = Math.max(35, Math.min(75, baseLit + (this.rand() - 0.5) * 8));

        this.leftColor = { h: hue1, s: sat1, l: lit1 };
        this.rightColor = { h: hue2, s: sat2, l: lit2 };

        this.leftBar.style.background = this.hslToString(this.leftColor);
        this.rightBar.style.background = this.hslToString(this.rightColor);
    }
    hslToString(c) { return `hsl(${c.h}, ${c.s}%, ${c.l}%)`; }

    animate(timestamp) {
        if (!this.isMoving || !this.leftBar || !this.rightBar) return;
        if (this.isPaused) { this.lastTimestamp = 0; return; }

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
        if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }

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
        let isPerfect = false;

        if (tapType === 'overlapping') {
            if (overlapPercentage >= 90) {
                points = 100; feedback = 'PERFECT!'; cls = 'perfect';
                this.stats.perfect++; this.combo++; isPerfect = true; this.perfectStreak++;
            } else if (overlapPercentage >= 70) {
                points = 70; feedback = 'GREAT!'; cls = 'perfect';
                this.stats.good++; this.combo++; this.perfectStreak = 0;
            } else if (overlapPercentage >= 40) {
                points = 40; feedback = 'GOOD!'; cls = 'good';
                this.stats.good++; this.combo++; this.perfectStreak = 0;
            } else {
                points = 15; feedback = 'OKAY!'; cls = 'okay';
                this.stats.okay++; this.combo = 0; this.perfectStreak = 0;
            }
        } else {
            points = 10; feedback = 'CLOSE!'; cls = 'okay';
            this.stats.okay++; this.combo = 0; this.perfectStreak = 0;
        }

        let multiplier = 1;
        if (this.combo >= 2) {
            multiplier = 1 + Math.min((this.combo - 1) * 0.15, 2);
            points = Math.round(points * multiplier);
        }

        if (this.combo > this.bestCombo) this.bestCombo = this.combo;

        this.score += points;
        this.successfulRounds++;

        // Coins: 1 per success, +5 if perfect
        this.addCoins(1 + (isPerfect ? 4 : 0));

        this.updateScoreDisplay();
        this.updateComboDisplay();

        const comboText = this.combo >= 2 ? ` x${multiplier.toFixed(1)}` : '';
        this.feedbackEl.textContent = `${feedback} +${points}${comboText}`;
        this.feedbackEl.className = `feedback ${cls}`;

        const spawnY = (this.leftBar.getBoundingClientRect().top + 30) - this.gameCanvas.getBoundingClientRect().top;
        const spawnXLocal = spawnX - this.gameCanvas.getBoundingClientRect().left;
        const particleColor = this.hslToString({
            h: (this.leftColor.h + this.rightColor.h) / 2, s: 80, l: 60
        });
        if (!this.settings.reducedMotion) {
            this.spawnParticles(spawnXLocal, spawnY, particleColor, cls === 'perfect' ? 24 : 12);
        }

        if (cls === 'perfect') this.playTone(880, 0.08);
        else if (cls === 'good') this.playTone(660, 0.07);
        else this.playTone(440, 0.06);

        // ACHIEVEMENT: first match
        this.unlockAchievement('first_match');
        // perfect streak
        if (this.perfectStreak >= 10) this.unlockAchievement('eagle_eye');
        // combo 20
        if (this.combo >= 20) this.unlockAchievement('combo20');

        // Level-up logic
        const baseRounds = [3, 5, 7, 9, 11, 13, 15, 18, 21];
        const idx = Math.max(0, Math.min(baseRounds.length - 1, this.level - 1));
        const roundsNeeded = this.mode === 'speed' ? Math.max(2, (baseRounds[idx] || 25) - 2)
                            : (baseRounds[idx] || 25);

        if (this.mode === 'daily') {
            this.dailyRoundsLeft--;
        }

        if (this.successfulRounds >= roundsNeeded && this.level < PACKS.length && this.mode !== 'daily') {
            this.levelUp();
        }

        // mode-specific achievements
        if (this.mode === 'speed' && this.level >= 15) this.unlockAchievement('speed_demon');
        if (this.mode === 'classic' && this.level >= 25) this.unlockAchievement('marathon');
        if (this.mode === 'speed' && this.level >= 10 && (performance.now() - this.modeStart) < 30000) {
            this.unlockAchievement('speedrunner');
        }
        if (this.mode === 'zen' && (performance.now() - this.zenStart) >= 5 * 60 * 1000) {
            this.unlockAchievement('zen_master');
        }

        if (this.settings.haptics && 'vibrate' in navigator) {
            navigator.vibrate(cls === 'perfect' ? 30 : 15);
        }

        // daily end?
        if (this.mode === 'daily' && this.dailyRoundsLeft <= 0) {
            setTimeout(() => this.endDaily(), 650);
            return;
        }

        setTimeout(() => {
            if (this.state === GameState.PLAYING && !this.isPaused) this.startRound();
        }, 650);
    }

    levelUp() {
        this.level = Math.min(PACKS.length, this.level + 1);
        this.successfulRounds = 0;
        const pack = PACKS[this.level - 1];
        const speedMult = this.mode === 'speed' ? 1.5 : 1.0;
        this.currentPxPerSecond = pack.baseSpeed * speedMult;

        this.feedbackEl.textContent = `LEVEL ${this.level}!`;
        this.feedbackEl.className = 'feedback perfect';
        this.updateLevelDisplay();

        if (!this.settings.reducedMotion) {
            const w = this.gameCanvas.getBoundingClientRect().width;
            const h = this.gameCanvas.getBoundingClientRect().height;
            for (let i = 0; i < 30; i++) {
                this.spawnParticles(Math.random() * w, h / 2 + (Math.random() - 0.5) * 100,
                    `hsl(${Math.random() * 360}, 80%, 60%)`, 1);
            }
        }

        this.playTone(523, 0.08);
        setTimeout(() => this.playTone(659, 0.08), 80);
        setTimeout(() => this.playTone(784, 0.12), 160);

        if (this.settings.haptics && 'vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }

    updateLevelDisplay() {
        if (this.levelDisplayEl) {
            const pack = PACKS[this.level - 1];
            this.levelDisplayEl.textContent = pack ? `L${this.level} ${pack.name}` : `LEVEL ${this.level}`;
        }
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

        // ZEN — no fail state
        if (this.mode === 'zen') {
            this.combo = 0; this.perfectStreak = 0;
            this.updateComboDisplay();
            if (this.feedbackEl) {
                this.feedbackEl.textContent = 'TRY AGAIN!';
                this.feedbackEl.className = 'feedback okay';
            }
            this.playTone(330, 0.12);
            setTimeout(() => {
                if (this.state === GameState.PLAYING && !this.isPaused) this.startRound();
            }, 700);
            return;
        }

        this.combo = 0;
        this.updateComboDisplay();
        if (this.feedbackEl) {
            this.feedbackEl.textContent = 'MISS!';
            this.feedbackEl.className = 'feedback miss';
        }
        this.playTone(180, 0.25, 'sawtooth');
        if (this.settings.haptics && 'vibrate' in navigator) navigator.vibrate([100, 50, 100]);

        setTimeout(() => this.gameOver(), 900);
    }

    endDaily() {
        // record daily and end
        const today = todayStr();
        const daily = Store.get(KEY.DAILY, {}) || {};
        const prev = daily[today];
        if (!prev || this.score > prev.score) {
            daily[today] = { score: this.score, date: today };
            Store.set(KEY.DAILY, daily);
        }
        // streak
        if (this.progress.lastDaily) {
            const last = new Date(this.progress.lastDaily);
            const now = new Date(today);
            const diff = Math.round((now - last) / (1000 * 60 * 60 * 24));
            if (diff === 1) this.progress.dailyStreak = (this.progress.dailyStreak || 0) + 1;
            else if (diff > 1) this.progress.dailyStreak = 1;
        } else {
            this.progress.dailyStreak = 1;
        }
        this.progress.lastDaily = today;
        Store.set(KEY.PROGRESS, this.progress);
        if (this.progress.dailyStreak >= 7) this.unlockAchievement('daily_streak7');
        this.gameOver();
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        this.cleanupRound();

        // no-misses achievement (round = >=5 successful, 0 okay, 0 misses)
        if (this.successfulRounds >= 5 && this.stats.okay === 0 && this.stats.misses === 0) {
            this.unlockAchievement('no_misses');
        }

        // record into leaderboard
        const lbKey = this.mode || 'classic';
        const lb = Store.get(KEY.LEADERBOARD, {}) || {};
        if (lbKey === 'daily') {
            lb.dailyByDate = lb.dailyByDate || {};
            const today = todayStr();
            lb.dailyByDate[today] = lb.dailyByDate[today] || [];
            this.pendingLb = { listRef: 'daily', dateKey: today };
        } else {
            lb[lbKey] = lb[lbKey] || [];
            this.pendingLb = { listRef: lbKey };
        }
        Store.set(KEY.LEADERBOARD, lb);

        const list = this.pendingLb.dateKey ? (lb.dailyByDate[this.pendingLb.dateKey] || [])
                                            : (lb[lbKey] || []);
        const minTop = list.length < 10 ? -1 : (list[list.length - 1] ? list[list.length - 1].score : -1);
        const isTop = this.score > minTop;

        if (isTop && this.score > 0) {
            this.newRecordEl.classList.remove('hidden');
            this.nameEntry.classList.remove('hidden');
            if (this.nameInput) {
                this.nameInput.value = '';
                setTimeout(() => this.nameInput.focus(), 100);
            }
        } else {
            this.newRecordEl.classList.add('hidden');
            this.nameEntry.classList.add('hidden');
        }

        // progress / pack unlock
        this.updateProgressFromScore(this.score);

        this.finalScoreEl.textContent = this.score;
        this.perfectCountEl.textContent = this.stats.perfect;
        this.goodCountEl.textContent = this.stats.good;
        this.okayCountEl.textContent = this.stats.okay;

        // award coins bonus = floor(score/100)
        this.addCoins(Math.floor(this.score / 100));

        this.showScreen('gameOver');
    }

    commitName() {
        const raw = (this.nameInput.value || 'YOU').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'YOU';
        const lb = Store.get(KEY.LEADERBOARD, {}) || {};
        const today = todayStr();
        const entry = { name: raw, score: this.score, date: today };
        if (this.pendingLb && this.pendingLb.dateKey) {
            lb.dailyByDate = lb.dailyByDate || {};
            const list = lb.dailyByDate[this.pendingLb.dateKey] || [];
            list.push(entry);
            list.sort((a, b) => b.score - a.score);
            lb.dailyByDate[this.pendingLb.dateKey] = list.slice(0, 10);
        } else if (this.pendingLb) {
            const list = lb[this.pendingLb.listRef] || [];
            list.push(entry);
            list.sort((a, b) => b.score - a.score);
            lb[this.pendingLb.listRef] = list.slice(0, 10);
        }
        Store.set(KEY.LEADERBOARD, lb);
        this.nameEntry.classList.add('hidden');
        this.toast(`SAVED AS ${raw}`);
        this.renderMenu();
    }

    addCoins(n) {
        if (!n) return;
        this.coins = Math.max(0, (this.coins || 0) + n);
        Store.set(KEY.COINS, this.coins);
        this.renderCoins();
    }

    updateProgressFromScore(newScore) {
        this.progress.totalScore = (this.progress.totalScore || 0) + Math.max(0, newScore || 0);
        let unlocked = this.progress.packsUnlocked || 1;
        for (let i = unlocked; i < PACKS.length; i++) {
            if (this.progress.totalScore >= PACKS[i].unlockScore) unlocked = i + 1;
            else break;
        }
        if (unlocked > (this.progress.packsUnlocked || 1)) {
            const before = this.progress.packsUnlocked || 1;
            this.progress.packsUnlocked = unlocked;
            for (let i = before + 1; i <= unlocked; i++) {
                const p = PACKS[i - 1];
                if (p) this.toast(`PACK UNLOCKED: ${p.name}`);
            }
        }
        if (unlocked >= PACKS.length) this.unlockAchievement('connoisseur');
        Store.set(KEY.PROGRESS, this.progress);
    }

    togglePause() { if (this.isPaused) this.resume(); else this.pause(); }
    pause() {
        if (this.state !== GameState.PLAYING || this.isPaused) return;
        this.isPaused = true;
        if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
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

    updateScoreDisplay() {
        if (this.currentScoreEl) this.currentScoreEl.textContent = this.score;
        // best for this mode
        const lb = Store.get(KEY.LEADERBOARD, {}) || {};
        let best = 0;
        if (this.mode === 'daily') {
            const today = todayStr();
            best = (lb.dailyByDate && lb.dailyByDate[today] && lb.dailyByDate[today][0] && lb.dailyByDate[today][0].score) || 0;
        } else {
            best = (lb[this.mode] && lb[this.mode][0] && lb[this.mode][0].score) || 0;
        }
        if (this.bestScoreEl) this.bestScoreEl.textContent = Math.max(best, this.score);
    }

    /* ===== AUDIO ===== */
    ensureAudio() {
        if (!this.settings.sfx) return null;
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
            const vol = (this.settings.sfx / 100) * 0.18;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration + 0.02);
        } catch (e) {}
    }

    /* ===== PARTICLES ===== */
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

/* ===== BOOT ===== */
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
