// The Rising - Full Game
// Vanilla JS. No build step. No deps. GH-Pages compatible.
// Hash routes: #menu, #level/<n>, #settings, #leaderboard, #achievements, #shop, #how-to, #credits

// ============================================================================
// CONFIG
// ============================================================================
const config = {
    canvas: { width: 400, height: 700 },
    block:  { width: 60, height: 30, speed: 2 },
    water:  { startY: 500, riseSpeed: 0.3, freezeSpeed: 5, freezeHeight: 200 },
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

// ============================================================================
// STORAGE (versioned namespace; legacy key migration)
// ============================================================================
const NS = 'the-rising:v1:';
const KEYS = {
    progress:     NS + 'progress',
    stars:        NS + 'stars',
    settings:     NS + 'settings',
    leaderboard:  NS + 'leaderboard',
    achievements: NS + 'achievements',
    selectedSkin: NS + 'selectedSkin',
    dailyStreak:  NS + 'dailyStreak',
    freezeUses:   NS + 'freezeUses',
    name:         NS + 'name'
};
const LEGACY_KEY = 'theRising.progress.v1';

const Store = {
    read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return fallback;
            return JSON.parse(raw);
        } catch (e) { return fallback; }
    },
    write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) {}
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    },
    // Future migration helper stub
    migrate() {
        const existing = this.read(KEYS.progress, null);
        if (existing) return;
        try {
            const legacyRaw = localStorage.getItem(LEGACY_KEY);
            if (!legacyRaw) return;
            const legacy = JSON.parse(legacyRaw);
            this.write(KEYS.progress, {
                bestLevel: legacy.bestLevel || 1,
                bestScore: legacy.bestScore || 0,
                unlockedLevel: legacy.bestLevel || 1
            });
            this.write(KEYS.settings, {
                volume: typeof legacy.volume === 'number' ? legacy.volume : 0.7,
                muted: !!legacy.muted
            });
        } catch (e) {}
    }
};

// ============================================================================
// LEVELS
// 20 hand-tuned levels. waterRiseRate is pixels/frame. goalHeight is fraction
// of canvas height (0 = top).
// ============================================================================
const LEVELS = [
    { id: 1,  startBlocks: 30, waterRiseRate: 0.20, goalHeight: 0.30, hazards: [],          targetTimeSec: 60 },
    { id: 2,  startBlocks: 28, waterRiseRate: 0.22, goalHeight: 0.28, hazards: [],          targetTimeSec: 55 },
    { id: 3,  startBlocks: 26, waterRiseRate: 0.25, goalHeight: 0.26, hazards: [],          targetTimeSec: 50 },
    { id: 4,  startBlocks: 24, waterRiseRate: 0.28, goalHeight: 0.24, hazards: ['wind'],    targetTimeSec: 50 },
    { id: 5,  startBlocks: 22, waterRiseRate: 0.30, goalHeight: 0.22, hazards: ['wind'],    targetTimeSec: 45 },
    { id: 6,  startBlocks: 22, waterRiseRate: 0.32, goalHeight: 0.22, hazards: ['fast'],    targetTimeSec: 45 },
    { id: 7,  startBlocks: 20, waterRiseRate: 0.34, goalHeight: 0.20, hazards: ['fast'],    targetTimeSec: 40 },
    { id: 8,  startBlocks: 20, waterRiseRate: 0.36, goalHeight: 0.20, hazards: ['narrow'],  targetTimeSec: 40 },
    { id: 9,  startBlocks: 18, waterRiseRate: 0.38, goalHeight: 0.18, hazards: ['narrow'],  targetTimeSec: 38 },
    { id: 10, startBlocks: 18, waterRiseRate: 0.40, goalHeight: 0.18, hazards: ['wind','fast'], targetTimeSec: 35 },
    { id: 11, startBlocks: 16, waterRiseRate: 0.42, goalHeight: 0.16, hazards: ['narrow'],  targetTimeSec: 35 },
    { id: 12, startBlocks: 16, waterRiseRate: 0.44, goalHeight: 0.16, hazards: ['fast'],    targetTimeSec: 35 },
    { id: 13, startBlocks: 14, waterRiseRate: 0.46, goalHeight: 0.15, hazards: ['wind'],    targetTimeSec: 32 },
    { id: 14, startBlocks: 14, waterRiseRate: 0.48, goalHeight: 0.15, hazards: ['narrow','fast'], targetTimeSec: 32 },
    { id: 15, startBlocks: 12, waterRiseRate: 0.50, goalHeight: 0.14, hazards: ['wind','fast'], targetTimeSec: 30 },
    { id: 16, startBlocks: 12, waterRiseRate: 0.52, goalHeight: 0.13, hazards: ['narrow'],  targetTimeSec: 30 },
    { id: 17, startBlocks: 12, waterRiseRate: 0.55, goalHeight: 0.12, hazards: ['wind','narrow'], targetTimeSec: 28 },
    { id: 18, startBlocks: 10, waterRiseRate: 0.58, goalHeight: 0.12, hazards: ['fast','narrow'], targetTimeSec: 28 },
    { id: 19, startBlocks: 10, waterRiseRate: 0.62, goalHeight: 0.11, hazards: ['wind','fast','narrow'], targetTimeSec: 25 },
    { id: 20, startBlocks: 10, waterRiseRate: 0.68, goalHeight: 0.10, hazards: ['wind','fast','narrow'], targetTimeSec: 25 }
];
const NUM_LEVELS = LEVELS.length;

// ============================================================================
// SKINS
// Each skin = { id, name, color, accent, shape, starsRequired }
// ============================================================================
const SKINS = [
    { id: 'default', name: 'Default', color: '#f9ca24', accent: '#b88e10', starsRequired: 0 },
    { id: 'gold',    name: 'Gold',    color: '#ffd700', accent: '#a07800', starsRequired: 5 },
    { id: 'neon',    name: 'Neon',    color: '#39ff14', accent: '#0a8000', starsRequired: 10 },
    { id: 'fire',    name: 'Fire',    color: '#ff4500', accent: '#a0220a', starsRequired: 20 },
    { id: 'ghost',   name: 'Ghost',   color: '#e0e0ff', accent: '#7878a0', starsRequired: 40 }
];

// ============================================================================
// ACHIEVEMENTS
// ============================================================================
const ACHIEVEMENTS = [
    { id: 'first',     name: 'First Ascent',  desc: 'Clear level 1',            icon: '*' },
    { id: 'threeStar', name: 'Three-Star',    desc: 'Earn 3 stars on any level', icon: '3' },
    { id: 'allStars',  name: 'All Stars',     desc: '3 stars on every level',    icon: 'A' },
    { id: 'survivor',  name: 'Survivor',      desc: 'Clear with 1 block left',   icon: 'S' },
    { id: 'speedrun',  name: 'Speedrun',      desc: 'Beat target time',          icon: '>' },
    { id: 'noDeaths',  name: 'No Deaths',     desc: 'Clear without restart',     icon: 'N' },
    { id: 'climber',   name: 'Climber',       desc: 'Clear 10 levels',           icon: 'C' },
    { id: 'summit',    name: 'Summit',        desc: 'Clear all 20 levels',       icon: 'T' },
    { id: 'frozen',    name: 'Frozen',        desc: 'Use freeze power 50 times', icon: 'F' },
    { id: 'daily7',    name: 'Daily Streak 7', desc: 'Play daily 7 days in a row', icon: 'D' }
];

// ============================================================================
// GAME STATE
// ============================================================================
const game = {
    canvas: null,
    ctx: null,
    dpr: 1,
    state: 'menu',      // menu | playing | paused | gameOver | freezing | ending
    screen: 'menu',     // menu | level | settings | leaderboard | achievements | shop | howto | credits

    // Active level fields
    levelId: 1,
    level: 1,           // legacy alias for backwards compat (still drawn by HUD)
    score: 0,
    survivors: 30,
    totalPeople: 30,
    blocksRemaining: 0,
    blocksPlaced: 0,
    levelStartTime: 0,
    levelDiedOnce: false,

    // Persistent state
    progress: { bestLevel: 1, bestScore: 0, unlockedLevel: 1 },
    stars: {},          // { 1: 3, 2: 2, ... }
    settings: {
        sfxVolume: 0.7,
        musicVolume: 0.6,
        muted: false,
        haptics: true,
        colorblind: false,
        reducedMotion: false,
        language: 'en'
    },
    leaderboard: { overall: [], daily: {}, levels: {} },
    achievements: {},   // { id: { unlocked: bool, date: '2026-01-01' } }
    selectedSkin: 'default',
    freezeUses: 0,
    playerName: 'YOU',
    showHelp: false,

    // Worldmap
    map: {
        scrollY: 0,
        nodes: [],           // [{x, y, levelId, unlocked, stars}]
        hero: { x: 0, y: 0, targetNode: 0, currentNode: 0 },
        walking: null,       // { path: [nodeIdx,...], step: 0, t: 0, then: null }
        snow: [],
        clouds: []
    },

    // Toasts
    _toasts: [],

    // In-level
    hero: null,
    currentBlock: null,
    stackedBlocks: [],
    deadBlocks: [],
    frozenLayers: [],
    water: { y: 500, rising: true },
    targetHeight: 100,
    direction: 1,
    spawnFromLeft: true,
    activeLevel: null,

    _rafId: null,
    _lastTime: 0,
    _levelFlashStart: 0,
    initialWaterY: 0,
    ending: null,

    // ========================================================================
    // INIT
    // ========================================================================
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.background = '#0f1530';

        Store.migrate();
        this.loadAll();

        if (typeof SoundManager !== 'undefined') {
            soundManager = new SoundManager();
        }

        this.resizeCanvas();
        this.buildWorldMap();

        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.buildWorldMap();
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => { this.resizeCanvas(); this.buildWorldMap(); }, 100);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === 'playing') this.togglePause();
                else if (soundManager && soundManager.audioContext && soundManager.audioContext.state === 'running') {
                    try { soundManager.audioContext.suspend(); } catch (e) {}
                }
            } else {
                if (this.state !== 'paused' && soundManager && soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
                    try { soundManager.audioContext.resume(); } catch (e) {}
                }
            }
        });

        // Canvas tap (handles map navigation, gameplay placement, etc)
        let lastTap = 0;
        const onTap = (e) => {
            if (e && e.preventDefault) e.preventDefault();
            const now = Date.now();
            if (now - lastTap < 80) return;
            lastTap = now;
            this.unlockAudio();
            const pt = this._eventPoint(e);
            this.handleCanvasTap(pt.x, pt.y);
        };
        this.canvas.addEventListener('click', onTap);
        this.canvas.addEventListener('touchstart', onTap, { passive: false });
        this.canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

        window.addEventListener('keydown', (e) => this.onKey(e));

        // Hash routing
        window.addEventListener('hashchange', () => this.applyHash());
        this.applyHash();

        // Wire up modal close buttons & settings inputs
        this.bindModalControls();

        this._lastTime = performance.now();
        this.gameLoop();

        this.recordDailyVisit();
    },

    // ========================================================================
    // STORAGE LOAD / SAVE
    // ========================================================================
    loadAll() {
        this.progress     = Store.read(KEYS.progress, this.progress);
        this.stars        = Store.read(KEYS.stars, {});
        this.settings     = Object.assign(this.settings, Store.read(KEYS.settings, {}));
        this.leaderboard  = Object.assign({ overall: [], daily: {}, levels: {} }, Store.read(KEYS.leaderboard, {}));
        this.achievements = Store.read(KEYS.achievements, {});
        this.selectedSkin = Store.read(KEYS.selectedSkin, 'default');
        this.freezeUses   = Store.read(KEYS.freezeUses, 0);
        this.playerName   = Store.read(KEYS.name, 'YOU');
        if (!this.progress.unlockedLevel) this.progress.unlockedLevel = this.progress.bestLevel || 1;
    },
    saveProgress()     { Store.write(KEYS.progress, this.progress); },
    saveStars()        { Store.write(KEYS.stars, this.stars); },
    saveSettings()     { Store.write(KEYS.settings, this.settings); },
    saveLeaderboard()  { Store.write(KEYS.leaderboard, this.leaderboard); },
    saveAchievements() { Store.write(KEYS.achievements, this.achievements); },
    saveSkin()         { Store.write(KEYS.selectedSkin, this.selectedSkin); },
    saveFreezeUses()   { Store.write(KEYS.freezeUses, this.freezeUses); },
    saveName()         { Store.write(KEYS.name, this.playerName); },

    totalStars() {
        let n = 0; for (const k in this.stars) n += this.stars[k] | 0;
        return n;
    },

    // ========================================================================
    // HASH ROUTING
    // ========================================================================
    applyHash() {
        const h = (location.hash || '#menu').replace(/^#/, '');
        const parts = h.split('/');
        const head = parts[0] || 'menu';

        // Close all modals
        ['settingsModal','leaderboardModal','achievementsModal','shopModal','howModal','creditsModal','nameModal']
            .forEach(id => this._closeModal(id));

        if (head === 'level' && parts[1]) {
            const n = Math.max(1, Math.min(NUM_LEVELS, parseInt(parts[1], 10) || 1));
            if (n > this.progress.unlockedLevel) {
                this.toast('Level locked');
                location.hash = '#menu';
                return;
            }
            this.screen = 'level';
            this.startLevel(n);
            return;
        }

        if (head === 'settings')     { this.screen = 'menu'; this._openModal('settingsModal'); this.refreshSettingsUI(); return; }
        if (head === 'leaderboard')  { this.screen = 'menu'; this._openModal('leaderboardModal'); this.refreshLeaderboardUI(); return; }
        if (head === 'achievements') { this.screen = 'menu'; this._openModal('achievementsModal'); this.refreshAchievementsUI(); return; }
        if (head === 'shop')         { this.screen = 'menu'; this._openModal('shopModal'); this.refreshShopUI(); return; }
        if (head === 'how-to')       { this.screen = 'menu'; this._openModal('howModal'); return; }
        if (head === 'credits')      { this.screen = 'menu'; this._openModal('creditsModal'); return; }

        // Default: worldmap menu
        this.screen = 'menu';
        this.state = 'menu';
        this.hideMessage();
        this.scrollMapToHero();
        this._setGameOverActionsVisible(false);
    },

    setHash(h) {
        if (location.hash === '#' + h) {
            // Force route apply even if same
            this.applyHash();
        } else {
            location.hash = '#' + h;
        }
    },

    // ========================================================================
    // MODALS
    // ========================================================================
    _openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('show'); },
    _closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); },

    bindModalControls() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-close');
                this._closeModal(id);
                if (location.hash !== '#menu') location.hash = '#menu';
            });
        });

        // Settings inputs
        const sfx = document.getElementById('sfxVol');
        const music = document.getElementById('musicVol');
        const mute = document.getElementById('muteAll');
        const haptics = document.getElementById('haptics');
        const cb = document.getElementById('colorblind');
        const rm = document.getElementById('reducedMotion');
        const lang = document.getElementById('language');
        const reset = document.getElementById('resetProgress');

        if (sfx) sfx.addEventListener('input', () => {
            this.settings.sfxVolume = (+sfx.value) / 100;
            this.applyVolumeToManager();
            this.saveSettings();
        });
        if (music) music.addEventListener('input', () => {
            this.settings.musicVolume = (+music.value) / 100;
            this.applyVolumeToManager();
            this.saveSettings();
        });
        if (mute) mute.addEventListener('change', () => {
            this.settings.muted = !!mute.checked;
            this.applyVolumeToManager();
            this.saveSettings();
        });
        if (haptics) haptics.addEventListener('change', () => {
            this.settings.haptics = !!haptics.checked;
            this.saveSettings();
        });
        if (cb) cb.addEventListener('change', () => {
            this.settings.colorblind = !!cb.checked;
            this.saveSettings();
        });
        if (rm) rm.addEventListener('change', () => {
            this.settings.reducedMotion = !!rm.checked;
            this.saveSettings();
        });
        if (lang) lang.addEventListener('change', () => {
            this.settings.language = lang.value;
            this.saveSettings();
        });
        if (reset) reset.addEventListener('click', () => {
            if (confirm('Reset ALL progress, stars, achievements, leaderboard? This cannot be undone.')) {
                this.resetAllProgress();
            }
        });

        // Theme toggle
        const themeWrap = document.getElementById('themeToggle');
        if (themeWrap && window.MGTheme) {
            const THEME_KEY = 'the-rising:v1:theme';
            const buttons = themeWrap.querySelectorAll('button[data-theme-pref]');
            const cur = MGTheme.get(THEME_KEY);
            buttons.forEach(b => {
                b.setAttribute('aria-pressed', b.getAttribute('data-theme-pref') === cur ? 'true' : 'false');
                b.addEventListener('click', () => {
                    const pref = b.getAttribute('data-theme-pref');
                    MGTheme.set(pref, THEME_KEY);
                    buttons.forEach(bb => bb.setAttribute('aria-pressed', bb.getAttribute('data-theme-pref') === pref ? 'true' : 'false'));
                });
            });
        }

        // Leaderboard scope
        const lbScope = document.getElementById('lbScope');
        if (lbScope) lbScope.addEventListener('change', () => this.refreshLeaderboardUI());

        // Name entry
        const nameSubmit = document.getElementById('nameSubmit');
        if (nameSubmit) nameSubmit.addEventListener('click', () => this._submitName());
        const nameInput = document.getElementById('nameInput');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                nameInput.value = nameInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._submitName();
            });
        }

        // Player identity (shared module)
        if (window.MGIdentity) {
            try { MGIdentity.uuid(); } catch (e) {}
            const playerNameInput = document.getElementById('player-name-input');
            if (playerNameInput) {
                playerNameInput.addEventListener('input', () => {
                    try { MGIdentity.setName(playerNameInput.value); } catch (e) {}
                });
            }
            const suggestBtn = document.getElementById('player-name-suggest');
            if (suggestBtn) {
                suggestBtn.addEventListener('click', () => {
                    try {
                        const s = MGIdentity.suggest();
                        if (playerNameInput) playerNameInput.value = s;
                        MGIdentity.setName(s);
                    } catch (e) {}
                });
            }
            const copyBtn = document.getElementById('player-id-copy');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    try {
                        const u = MGIdentity.uuid();
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(u).then(
                                () => this.toast('Player ID copied'),
                                () => this.toast(u)
                            );
                        } else {
                            this.toast(u);
                        }
                    } catch (e) {}
                });
            }
        }

        // Game-over SHARE button
        const shareBtn = document.getElementById('gameOverShare');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this._shareScore());
        }
    },

    refreshSettingsUI() {
        const sfx = document.getElementById('sfxVol');
        const music = document.getElementById('musicVol');
        const mute = document.getElementById('muteAll');
        const haptics = document.getElementById('haptics');
        const cb = document.getElementById('colorblind');
        const rm = document.getElementById('reducedMotion');
        const lang = document.getElementById('language');
        if (sfx) sfx.value = Math.round(this.settings.sfxVolume * 100);
        if (music) music.value = Math.round(this.settings.musicVolume * 100);
        if (mute) mute.checked = !!this.settings.muted;
        if (haptics) haptics.checked = !!this.settings.haptics;
        if (cb) cb.checked = !!this.settings.colorblind;
        if (rm) rm.checked = !!this.settings.reducedMotion;
        if (lang) lang.value = this.settings.language || 'en';

        // Player section (shared identity)
        if (window.MGIdentity) {
            const nameInput = document.getElementById('player-name-input');
            const idDisplay = document.getElementById('player-id-display');
            try {
                const fullId = MGIdentity.uuid();
                if (nameInput) nameInput.value = MGIdentity.name() || '';
                if (idDisplay) {
                    idDisplay.textContent = fullId.slice(0, 8) + '…';
                    idDisplay.title = fullId;
                }
            } catch (e) {}
        }
    },

    refreshLeaderboardUI() {
        const list = document.getElementById('lbList');
        const scopeEl = document.getElementById('lbScope');
        if (!list) return;
        const scope = scopeEl ? scopeEl.value : 'overall';
        // Inject GLOBAL toggle once
        const remoteOn = !!(window.MGRemote && MGRemote.enabled());
        const parent = list.parentNode;
        if (remoteOn && parent && !parent.querySelector('.lb-scope-toggle')) {
            const wrap = document.createElement('div');
            wrap.className = 'lb-scope-toggle';
            wrap.style.cssText = 'display:flex;gap:6px;justify-content:center;margin:6px 0;';
            wrap.innerHTML = '<button class="btn small" data-scope="local">LOCAL</button><button class="btn small" data-scope="global">GLOBAL</button>';
            parent.insertBefore(wrap, list);
            const self = this;
            wrap.querySelectorAll('button').forEach(b => {
                b.addEventListener('click', () => { self._lbRemoteScope = b.getAttribute('data-scope'); self.refreshLeaderboardUI(); });
            });
        }
        const remoteScope = this._lbRemoteScope || 'local';

        if (remoteScope === 'global' && remoteOn) {
            const mode = (scope === 'daily') ? ('daily-' + this._todayKey()) : 'overall';
            list.innerHTML = '<div class="item"><span>Loading…</span><span></span></div>';
            MGRemote.top('the-rising', mode, { limit: 10 }).then(rows => {
                list.innerHTML = '';
                if (!rows || !rows.length) { list.innerHTML = '<div class="item"><span>No global scores</span><span></span></div>'; return; }
                rows.forEach((e, i) => {
                    const div = document.createElement('div');
                    div.className = 'item';
                    div.innerHTML = `<span>${i + 1}. ${this._esc(e.display_name || '???')}</span><span>${e.score|0}</span>`;
                    list.appendChild(div);
                });
            });
            return;
        }

        let entries = [];
        if (scope === 'daily') {
            const key = this._todayKey();
            entries = (this.leaderboard.daily && this.leaderboard.daily[key]) || [];
        } else {
            entries = this.leaderboard.overall || [];
        }
        list.innerHTML = '';
        if (entries.length === 0) {
            list.innerHTML = '<div class="item"><span>No scores yet</span><span></span></div>';
            return;
        }
        entries.forEach((e, i) => {
            const div = document.createElement('div');
            div.className = 'item';
            const stars = typeof e.stars === 'number' ? ` (${e.stars}★)` : '';
            const displayName = e.displayName || e.name;
            div.innerHTML = `<span>${i + 1}. ${this._esc(displayName)}${stars}</span><span>${e.score}</span>`;
            list.appendChild(div);
        });
    },

    refreshAchievementsUI() {
        const wrap = document.getElementById('achList');
        if (!wrap) return;
        wrap.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const got = this.achievements[a.id] && this.achievements[a.id].unlocked;
            const div = document.createElement('div');
            div.className = 'ach' + (got ? '' : ' locked');
            div.innerHTML = `
                <div class="icon">${a.icon}</div>
                <div>
                    <div class="name">${a.name}</div>
                    <div class="desc">${a.desc}${got && this.achievements[a.id].date ? ' &middot; ' + this.achievements[a.id].date : ''}</div>
                </div>`;
            wrap.appendChild(div);
        });
    },

    refreshShopUI() {
        const wrap = document.getElementById('skinGrid');
        if (!wrap) return;
        wrap.innerHTML = '';
        const totalStars = this.totalStars();
        SKINS.forEach(sk => {
            const unlocked = totalStars >= sk.starsRequired;
            const selected = this.selectedSkin === sk.id;
            const cell = document.createElement('div');
            cell.className = 'skin-cell' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
            cell.setAttribute('role', 'button');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `${sk.name} skin${unlocked ? (selected ? ' (selected)' : '') : ' (locked)'}`);
            cell.innerHTML = `
                <div class="swatch" style="background:${sk.color}; border:2px solid ${sk.accent};"></div>
                <div><strong>${sk.name}</strong></div>
                <div style="font-size:10px; color:rgba(255,255,255,0.6);">${unlocked ? (selected ? 'Selected' : 'Tap to select') : sk.starsRequired + '★ required'}</div>
            `;
            const choose = () => {
                if (!unlocked) { this.toast(`Need ${sk.starsRequired} stars`); return; }
                this.selectedSkin = sk.id;
                this.saveSkin();
                this.refreshShopUI();
            };
            cell.addEventListener('click', choose);
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
            });
            wrap.appendChild(cell);
        });
    },

    resetAllProgress() {
        Object.keys(KEYS).forEach(k => Store.remove(KEYS[k]));
        Store.remove(LEGACY_KEY);
        this.progress = { bestLevel: 1, bestScore: 0, unlockedLevel: 1 };
        this.stars = {};
        this.leaderboard = { overall: [], daily: {}, levels: {} };
        this.achievements = {};
        this.selectedSkin = 'default';
        this.freezeUses = 0;
        this.toast('Progress reset');
        this.refreshSettingsUI();
        this.refreshAchievementsUI();
        this.buildWorldMap();
    },

    _esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[c]);
    },

    _todayKey() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    },

    recordDailyVisit() {
        const key = this._todayKey();
        const streakData = Store.read(KEYS.dailyStreak, { lastDate: null, streak: 0 });
        if (streakData.lastDate === key) return;
        // Compute if consecutive
        if (streakData.lastDate) {
            const last = new Date(streakData.lastDate + 'T00:00:00');
            const today = new Date(key + 'T00:00:00');
            const diffDays = Math.round((today - last) / 86400000);
            if (diffDays === 1) streakData.streak += 1;
            else streakData.streak = 1;
        } else {
            streakData.streak = 1;
        }
        streakData.lastDate = key;
        Store.write(KEYS.dailyStreak, streakData);
        if (streakData.streak >= 7) this.unlockAchievement('daily7');
    },

    // ========================================================================
    // AUDIO
    // ========================================================================
    unlockAudio() {
        if (!soundManager) return;
        if (!soundManager.initialized) {
            soundManager.init().then(() => this.applyVolumeToManager());
        } else if (soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
            soundManager.audioContext.resume();
        }
    },
    applyVolumeToManager() {
        if (!soundManager || !soundManager.initialized) return;
        const master = this.settings.muted ? 0 : (this.settings.sfxVolume + this.settings.musicVolume) / 2;
        soundManager.setMasterVolume(master);
        if (soundManager.musicGain) soundManager.musicGain.gain.value = this.settings.muted ? 0 : this.settings.musicVolume * 0.3;
        if (soundManager.sfxGain)   soundManager.sfxGain.gain.value   = this.settings.muted ? 0 : this.settings.sfxVolume * 0.5;
        // Ambient pad music: drive from musicVolume slider (silent when muted).
        if (typeof soundManager.setMusicVolume === 'function') {
            soundManager.setMusicVolume(this.settings.muted ? 0 : this.settings.musicVolume);
        }
    },
    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.applyVolumeToManager();
        this.saveSettings();
    },
    setVolume(v) {
        const clamped = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
        this.settings.sfxVolume = clamped;
        this.settings.musicVolume = clamped;
        this.applyVolumeToManager();
        this.saveSettings();
    },
    haptic(ms = 12) {
        if (!this.settings.haptics) return;
        if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
    },

    // ========================================================================
    // INPUT
    // ========================================================================
    _eventPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        let cx, cy;
        if (e && e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        else if (e && e.changedTouches && e.changedTouches[0]) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
        else if (e) { cx = e.clientX; cy = e.clientY; }
        else { cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2; }
        return { x: cx - rect.left, y: cy - rect.top };
    },

    onKey(e) {
        this.unlockAudio();

        // Global toggles
        if (e.key === 'h' || e.key === 'H' || e.key === '?') {
            e.preventDefault();
            if (this.screen === 'menu' && this.state === 'menu') this.setHash('how-to');
            else this.showHelp = !this.showHelp;
            return;
        }
        if (e.key === 'm' || e.key === 'M') { e.preventDefault(); this.toggleMute(); return; }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); this.setVolume(this.settings.sfxVolume + 0.1); return; }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); this.setVolume(this.settings.sfxVolume - 0.1); return; }

        // Menu (worldmap) navigation
        if (this.screen === 'menu' && this.state === 'menu') {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.mapNavigate(e.key);
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.mapEnterSelected();
                return;
            }
            if (e.key === 's' || e.key === 'S') { e.preventDefault(); this.setHash('settings'); return; }
            return;
        }

        // In-game
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameOver') {
                this.levelDiedOnce = true;
                this.restartCurrentLevel();
            }
            return;
        }

        if ((this.state === 'playing' || this.state === 'paused') &&
            (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            this.togglePause();
            return;
        }

        if (e.key === 'Escape' && (this.state === 'gameOver' || this.screen === 'level')) {
            e.preventDefault();
            this.setHash('menu');
            return;
        }

        if (this.state === 'playing' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            this.handleTap();
            return;
        }

        if (this.state === 'gameOver' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            this.restartCurrentLevel();
            return;
        }
    },

    handleCanvasTap(x, y) {
        if (this.screen === 'menu' && this.state === 'menu') {
            this.handleMapTap(x, y);
            return;
        }
        if (this.state === 'gameOver') {
            // Tap on menu zone vs replay zone
            const w = config.canvas.width, h = config.canvas.height;
            if (y > h * 0.75) { this.setHash('menu'); return; }
            this.restartCurrentLevel();
            return;
        }
        if (this.state === 'paused') {
            // Tap quit zone or resume
            const h = config.canvas.height;
            if (y > h * 0.65) { this.setHash('menu'); return; }
            this.togglePause();
            return;
        }
        this.handleTap();
    },

    // ========================================================================
    // CANVAS SIZING
    // ========================================================================
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

        if (this.state === 'menu') this.water.y = config.canvas.height - 200;

        if (this.activeLevel) {
            this.targetHeight = Math.max(40, config.canvas.height * this.activeLevel.goalHeight);
        }
    },

    // ========================================================================
    // WORLDMAP
    // ========================================================================
    buildWorldMap() {
        const w = config.canvas.width;
        const h = config.canvas.height;
        const margin = 40;
        const verticalSpacing = 92;
        const total = NUM_LEVELS;

        // Build a zigzag column-pair pattern centered horizontally
        this.map.nodes = [];
        for (let i = 0; i < total; i++) {
            const fromBottom = i; // bottom = i=0 = level 1
            // Levels ascend, so node y descends from canvas bottom toward top.
            const y = h - margin - 60 - fromBottom * verticalSpacing;
            const colShift = (i % 4 === 0) ? -1 : (i % 4 === 1) ? 0 : (i % 4 === 2) ? 1 : 0;
            const x = w / 2 + colShift * (w * 0.22);
            this.map.nodes.push({
                x, y,
                levelId: i + 1,
                unlocked: (i + 1) <= this.progress.unlockedLevel,
                stars: this.stars[i + 1] || 0
            });
        }

        // Hero starts on highest unlocked node
        const highestUnlockedIdx = Math.min(NUM_LEVELS, this.progress.unlockedLevel) - 1;
        this.map.hero.currentNode = highestUnlockedIdx;
        this.map.hero.targetNode = highestUnlockedIdx;
        const node = this.map.nodes[highestUnlockedIdx];
        this.map.hero.x = node.x;
        this.map.hero.y = node.y - 24;

        // Snow + clouds
        this.map.snow = [];
        for (let i = 0; i < 40; i++) {
            this.map.snow.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: 1 + Math.random() * 2,
                vy: 8 + Math.random() * 18,
                vx: -4 + Math.random() * 8
            });
        }
        this.map.clouds = [];
        for (let i = 0; i < 4; i++) {
            this.map.clouds.push({
                x: Math.random() * w,
                y: 40 + Math.random() * (h * 0.4),
                w: 80 + Math.random() * 60,
                vx: 4 + Math.random() * 8,
                alpha: 0.10 + Math.random() * 0.15
            });
        }

        this.scrollMapToHero();
    },

    scrollMapToHero() {
        const h = config.canvas.height;
        const heroIdx = this.map.hero.currentNode;
        if (this.map.nodes.length === 0) return;
        const node = this.map.nodes[heroIdx];
        // Center hero vertically; clamp so we don't show empty space
        const desired = (node.y) - h * 0.55;
        const mapTopY = this.map.nodes[this.map.nodes.length - 1].y - 80;
        const mapBotY = this.map.nodes[0].y + 80;
        const minScroll = Math.min(0, mapTopY - 40);
        const maxScroll = Math.max(0, mapBotY - h + 40);
        this.map.scrollY = Math.max(minScroll, Math.min(maxScroll, desired));
    },

    handleMapTap(x, y) {
        // HUD top-bar buttons (small icons)
        if (this._hitTopBarButton(x, y)) return;

        // Check node hits
        const radius = 26;
        for (let i = 0; i < this.map.nodes.length; i++) {
            const n = this.map.nodes[i];
            const ny = n.y - this.map.scrollY;
            const dx = x - n.x, dy = y - ny;
            if (dx * dx + dy * dy <= radius * radius) {
                if (!n.unlocked) { this.toast('Level locked'); this.haptic(8); return; }
                this.walkHeroTo(i, () => this.setHash(`level/${n.levelId}`));
                return;
            }
        }

        // Tap on hero -> enter current node
        const hy = this.map.hero.y - this.map.scrollY;
        if (Math.hypot(x - this.map.hero.x, y - hy) < 30) {
            const idx = this.map.hero.currentNode;
            this.setHash(`level/${this.map.nodes[idx].levelId}`);
            return;
        }
    },

    _hitTopBarButton(x, y) {
        const buttons = this._topBarButtons();
        for (const b of buttons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.setHash(b.hash);
                return true;
            }
        }
        return false;
    },
    _topBarButtons() {
        const w = config.canvas.width;
        const items = [
            { label: 'Settings',     hash: 'settings'     },
            { label: 'Leaderboard',  hash: 'leaderboard'  },
            { label: 'Achievements', hash: 'achievements' },
            { label: 'Heroes',       hash: 'shop'         },
            { label: 'Help',         hash: 'how-to'       }
        ];
        const bw = Math.min(70, (w - 20) / items.length);
        const bh = 28;
        const startX = (w - bw * items.length) / 2;
        return items.map((it, i) => ({ ...it, x: startX + i * bw, y: 32, w: bw, h: bh }));
    },

    mapNavigate(key) {
        // Up/Down: move along node sequence
        const idx = this.map.hero.targetNode;
        let target = idx;
        if (key === 'ArrowUp' || key === 'ArrowRight') target = Math.min(this.progress.unlockedLevel - 1, idx + 1);
        if (key === 'ArrowDown' || key === 'ArrowLeft') target = Math.max(0, idx - 1);
        if (target === idx) return;
        this.walkHeroTo(target);
    },
    mapEnterSelected() {
        const idx = this.map.hero.targetNode;
        const node = this.map.nodes[idx];
        if (!node || !node.unlocked) return;
        this.setHash(`level/${node.levelId}`);
    },

    walkHeroTo(targetIdx, then) {
        if (this.map.walking) return;
        const from = this.map.hero.currentNode;
        if (from === targetIdx) {
            if (then) then();
            return;
        }
        const step = targetIdx > from ? 1 : -1;
        const path = [];
        for (let i = from + step; ; i += step) {
            path.push(i);
            if (i === targetIdx) break;
        }
        this.map.walking = { path, step: 0, t: 0, then: then || null };
        this.map.hero.targetNode = targetIdx;
    },

    updateMap(dt) {
        // Walking animation: 200ms per hop, parabolic arc
        if (this.map.walking) {
            const w = this.map.walking;
            const dur = this.settings.reducedMotion ? 0.05 : 0.2;
            w.t += dt;
            const fromIdx = w.step === 0 ? this.map.hero.currentNode : w.path[w.step - 1];
            const toIdx = w.path[w.step];
            const fromNode = this.map.nodes[fromIdx];
            const toNode = this.map.nodes[toIdx];
            const tt = Math.min(1, w.t / dur);
            const ease = tt;
            this.map.hero.x = fromNode.x + (toNode.x - fromNode.x) * ease;
            // Parabolic arc: extra -20 in middle
            const arc = this.settings.reducedMotion ? 0 : -20 * Math.sin(Math.PI * tt);
            this.map.hero.y = fromNode.y + (toNode.y - fromNode.y) * ease + arc - 24;

            if (tt >= 1) {
                this.map.hero.currentNode = toIdx;
                this.map.hero.x = toNode.x;
                this.map.hero.y = toNode.y - 24;
                w.step++;
                w.t = 0;
                if (w.step >= w.path.length) {
                    const then = w.then;
                    this.map.walking = null;
                    if (then) then();
                }
            }
            this.scrollMapToHero();
        }

        if (this.settings.reducedMotion) return;

        // Snow
        const w = config.canvas.width, h = config.canvas.height;
        for (const s of this.map.snow) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.y > h) { s.y = -4; s.x = Math.random() * w; }
            if (s.x < -10) s.x = w + 5;
            if (s.x > w + 10) s.x = -5;
        }
        // Clouds
        for (const c of this.map.clouds) {
            c.x += c.vx * dt;
            if (c.x > w + c.w) c.x = -c.w;
        }
    },

    drawWorldMap() {
        const ctx = this.ctx;
        const w = config.canvas.width, h = config.canvas.height;

        // Sky gradient
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#0a1a3a');
        sky.addColorStop(0.6, '#0f3460');
        sky.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Frozen mountain silhouette (parallax with scroll)
        const mountainShift = this.settings.reducedMotion ? 0 : -this.map.scrollY * 0.2;
        ctx.fillStyle = 'rgba(40, 60, 100, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.55 + mountainShift);
        const peaks = 6;
        for (let i = 0; i <= peaks; i++) {
            const px = (w / peaks) * i;
            const py = h * 0.55 + mountainShift - (i % 2 === 0 ? 60 : 30);
            ctx.lineTo(px, py);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        // Clouds
        ctx.fillStyle = '#ffffff';
        for (const c of this.map.clouds) {
            ctx.globalAlpha = c.alpha;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w / 2, c.w / 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Snow
        ctx.fillStyle = '#ffffff';
        for (const s of this.map.snow) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        ctx.fillStyle = '#4ecca3';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('THE RISING', w / 2, 24);
        ctx.fillText('THE RISING', w / 2, 24);

        // Top-bar nav buttons
        this._drawTopBarButtons();

        // Path lines between nodes (drawn first so nodes overlap)
        ctx.save();
        ctx.translate(0, -this.map.scrollY);
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        for (let i = 0; i < this.map.nodes.length - 1; i++) {
            const a = this.map.nodes[i];
            const b = this.map.nodes[i + 1];
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // GOAL marker at top of path
        const topNode = this.map.nodes[this.map.nodes.length - 1];
        if (topNode) {
            ctx.fillStyle = 'rgba(255, 235, 80, 0.9)';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GOAL', topNode.x, topNode.y - 60);
            ctx.beginPath();
            ctx.moveTo(topNode.x - 14, topNode.y - 50);
            ctx.lineTo(topNode.x + 14, topNode.y - 50);
            ctx.lineTo(topNode.x, topNode.y - 70);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 235, 80, 0.7)';
            ctx.fill();
        }

        // Nodes
        for (let i = 0; i < this.map.nodes.length; i++) {
            const n = this.map.nodes[i];
            this._drawNode(n, i === this.map.hero.targetNode);
        }

        // Hero
        this._drawMapHero(this.map.hero.x, this.map.hero.y);

        ctx.restore();

        // Help overlay if open
        if (this.showHelp) this.drawHelpOverlay();
    },

    _drawTopBarButtons() {
        const ctx = this.ctx;
        const buttons = this._topBarButtons();
        buttons.forEach(b => {
            ctx.fillStyle = 'rgba(20, 40, 80, 0.75)';
            ctx.strokeStyle = 'rgba(120, 180, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = '#eaf2ff';
            ctx.font = '10px -apple-system, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
            ctx.textBaseline = 'alphabetic';
        });
    },

    _drawNode(node, isSelected) {
        const ctx = this.ctx;
        const radius = 24;
        // Cliff/ice base
        const baseColor = node.unlocked ? '#bcd9f0' : '#5a6878';
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = node.unlocked ? '#7fb1d6' : '#3a4858';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(node.x, node.y + 6, radius + 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Platform top
        ctx.fillStyle = node.unlocked ? '#dceffa' : '#6a7888';
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Level number or padlock
        if (node.unlocked) {
            ctx.fillStyle = '#0f3460';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(node.levelId), node.x, node.y);
            ctx.textBaseline = 'alphabetic';
        } else {
            // Padlock SVG-ish drawing
            ctx.fillStyle = '#2a3848';
            ctx.fillRect(node.x - 8, node.y - 2, 16, 14);
            ctx.strokeStyle = '#2a3848';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y - 2, 6, Math.PI, 0);
            ctx.stroke();
        }

        // Selection ring
        if (isSelected) {
            ctx.strokeStyle = '#4ecca3';
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Stars (only if cleared)
        if (node.stars > 0) {
            const sx = node.x - 16, sy = node.y + radius + 10;
            for (let s = 0; s < 3; s++) {
                const filled = s < node.stars;
                this._drawStar(sx + s * 12, sy, 5, filled ? '#ffd700' : 'rgba(255,255,255,0.2)');
            }
        }
    },

    _drawStar(cx, cy, r, color) {
        const ctx = this.ctx;
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const ang = (Math.PI / 5) * i - Math.PI / 2;
            const rad = i % 2 === 0 ? r : r * 0.45;
            const x = cx + Math.cos(ang) * rad;
            const y = cy + Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    },

    _drawMapHero(x, y) {
        const skin = SKINS.find(s => s.id === this.selectedSkin) || SKINS[0];
        const ctx = this.ctx;
        // Body
        ctx.fillStyle = skin.color;
        ctx.strokeStyle = skin.accent;
        ctx.lineWidth = 2;
        ctx.fillRect(x - 10, y - 14, 20, 18);
        ctx.strokeRect(x - 10, y - 14, 20, 18);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 4, y - 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(x - 4, y - 8, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 8, 1.3, 0, Math.PI * 2); ctx.fill();
    },

    // ========================================================================
    // LEVEL FLOW
    // ========================================================================
    startLevel(levelId) {
        const lvl = LEVELS[levelId - 1];
        if (!lvl) return;
        this.activeLevel = lvl;
        this.levelId = levelId;
        this.level = levelId;
        this.state = 'playing';
        this._setGameOverActionsVisible(false);
        this.score = 0;
        this.survivors = lvl.startBlocks;
        this.totalPeople = lvl.startBlocks;
        this.blocksRemaining = lvl.startBlocks;
        this.blocksPlaced = 0;
        this.levelStartTime = performance.now();
        this.levelDiedOnce = false;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.frozenLayers = [];
        this.hero = null;
        this.currentBlock = null;
        this.water.y = config.canvas.height - 200;
        this.water.rising = true;
        this.targetHeight = Math.max(40, config.canvas.height * lvl.goalHeight);
        this.spawnFromLeft = true;
        this.direction = 1;
        this._levelFlashStart = performance.now();
        this.updateUI();
        this.hideMessage();
        this.spawnBlock();

        if (soundManager) {
            soundManager.init().then(() => {
                this.applyVolumeToManager();
                soundManager.playTension();
                soundManager.playWaterAmbient();
            });
        }
        this.showMessage(`LEVEL ${levelId}\n\nStack to the GOAL line`);
        setTimeout(() => { if (this.state === 'playing') this.hideMessage(); }, 1800);
    },

    restartCurrentLevel() {
        this.levelDiedOnce = true;
        this.startLevel(this.levelId);
    },

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.showMessage('PAUSED\n\nTap below or press P to resume\nQuit: tap lower zone');
            if (soundManager && soundManager.audioContext && soundManager.audioContext.state === 'running') {
                try { soundManager.audioContext.suspend(); } catch (e) {}
            }
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.hideMessage();
            if (soundManager && soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
                try { soundManager.audioContext.resume(); } catch (e) {}
            }
        }
    },

    spawnBlock() {
        if (this.blocksRemaining <= 0) {
            this.endLevel();
            return;
        }
        const lastBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        let startY;
        if (lastBlock) startY = lastBlock.y - config.block.height;
        else startY = Math.max(40, this.water.y - config.block.height * 2);

        let startX;
        const narrow = this.activeLevel && this.activeLevel.hazards.indexOf('narrow') !== -1;
        const blockW = narrow ? Math.floor(config.block.width * 0.75) : config.block.width;
        if (this.spawnFromLeft) { startX = 10; this.direction = 1; }
        else { startX = config.canvas.width - blockW - 10; this.direction = -1; }
        this.spawnFromLeft = !this.spawnFromLeft;

        const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
        const isHeroBlock = this.stackedBlocks.length === 0 && !this.hero;

        this.currentBlock = {
            x: startX, y: startY, width: blockW, height: config.block.height,
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
        this.blocksRemaining--;
        this.survivors = this.blocksRemaining;
        this.updateUI();
    },

    generateName() {
        const names = ['Anna','Ben','Chen','David','Emma','Frank','Grace','Henry','Iris','Jack'];
        return names[Math.floor(Math.random() * names.length)];
    },

    handleTap() {
        if (this.state === 'paused') { this.togglePause(); return; }
        if (this.state !== 'playing' || !this.currentBlock) return;

        let placed = false;
        if (this.stackedBlocks.length === 0) {
            this.stackedBlocks.push(this.currentBlock);
            placed = true;
            if (soundManager) soundManager.playStack();
            this.haptic(8);
        } else {
            placed = this.placeBlock();
        }
        this.currentBlock = null;

        if (placed) {
            this.blocksPlaced++;
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
            this.haptic(overlapRatio > 0.9 ? 18 : 8);
            if (window.MGNative) MGNative.Haptics.light();

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
        if (soundManager) { soundManager.playSplash(); soundManager.playDrown(); }

        if (placedBlock.isHero) { this.endLevel(true); return false; }
        this.updateUI();
        return false;
    },

    endLevel(heroDied = false) {
        this.water.rising = false;
        if (heroDied) {
            this.state = 'gameOver';
            this.showMessage('YOU HAVE DIED\n\nTap to retry · long-tap bottom to quit');
            if (soundManager) soundManager.playDrown();
            this._setGameOverActionsVisible(true);
            return;
        }

        const success = this.stackedBlocks.length > 0 &&
            this.stackedBlocks[this.stackedBlocks.length - 1].y <= this.targetHeight;

        if (success) {
            // Count this as a freeze use
            this.freezeUses++; this.saveFreezeUses();
            if (this.freezeUses >= 50) this.unlockAchievement('frozen');

            this.state = 'freezing';
            this.initialWaterY = this.water.y;
            if (soundManager) { soundManager.playFreeze(); soundManager.playLevelComplete(); }
            this.showMessage('LEVEL CLEAR');
            setTimeout(() => this.completeLevelSuccess(), 1500);
        } else {
            this.state = 'gameOver';
            this.showMessage('GAME OVER\n\nTap to retry · long-tap bottom to quit');
            if (soundManager) soundManager.playWarning();
            this._setGameOverActionsVisible(true);
        }
    },

    completeLevelSuccess() {
        const lvl = this.activeLevel;
        const elapsedSec = (performance.now() - this.levelStartTime) / 1000;
        const stars = this._calcStars(lvl, elapsedSec, this.blocksRemaining, this.levelDiedOnce);

        // Persist stars (max)
        const prevStars = this.stars[lvl.id] || 0;
        const isNewBest = stars > prevStars;
        if (isNewBest) {
            this.stars[lvl.id] = stars;
            this.saveStars();
        }

        // Unlock next level
        if (lvl.id >= this.progress.unlockedLevel) {
            this.progress.unlockedLevel = Math.min(NUM_LEVELS, lvl.id + 1);
            this.progress.bestLevel = Math.max(this.progress.bestLevel, lvl.id);
            this.saveProgress();
        }
        if (this.score > this.progress.bestScore) {
            this.progress.bestScore = this.score;
            this.saveProgress();
        }

        // Achievements
        this.unlockAchievement('first');
        if (stars === 3) this.unlockAchievement('threeStar');
        if (this.blocksRemaining <= 1) this.unlockAchievement('survivor');
        if (elapsedSec <= lvl.targetTimeSec) this.unlockAchievement('speedrun');
        if (!this.levelDiedOnce) this.unlockAchievement('noDeaths');
        if (lvl.id >= 10) this.unlockAchievement('climber');
        if (lvl.id === NUM_LEVELS) this.unlockAchievement('summit');
        // All stars
        const allStars = LEVELS.every(L => (this.stars[L.id] || 0) === 3);
        if (allStars) this.unlockAchievement('allStars');

        // Leaderboard update
        this._considerLeaderboardEntry(lvl.id, this.score, stars, () => {
            this._finishLevelClear(stars);
        });
    },

    _finishLevelClear(stars) {
        // Refresh map state, return to map after short toast
        this.toast(`Level cleared! ${stars}★`);
        this.buildWorldMap();
        // Walk hero to next node
        const nextIdx = Math.min(NUM_LEVELS - 1, this.levelId); // levelId is 1-based; nextIdx 0-based = current
        setTimeout(() => {
            this.setHash('menu');
            // After returning to map, do a small hop to next unlocked
            setTimeout(() => {
                if (this.screen === 'menu') {
                    this.walkHeroTo(nextIdx);
                }
            }, 200);
        }, 1200);
    },

    _calcStars(lvl, elapsedSec, blocksLeft, diedOnce) {
        let s = 1;
        if (elapsedSec <= lvl.targetTimeSec) s++;
        if (blocksLeft >= Math.ceil(lvl.startBlocks * 0.25) && !diedOnce) s++;
        return Math.max(1, Math.min(3, s));
    },

    _considerLeaderboardEntry(levelId, score, stars, done) {
        const overall = this.leaderboard.overall || [];
        const levels = this.leaderboard.levels || {};
        levels[levelId] = levels[levelId] || [];

        const isOverallBest = overall.length < 10 || score > (overall[overall.length - 1] && overall[overall.length - 1].score);
        const isLevelBest   = levels[levelId].length < 10 || score > (levels[levelId][levels[levelId].length - 1] && levels[levelId][levels[levelId].length - 1].score);

        if (!isOverallBest && !isLevelBest) { done(); return; }

        // Show name entry on very first qualifying clear; afterwards re-use
        const showPrompt = !Store.read(KEYS.name, null) || score > (this.progress.bestScore || 0);
        const finalize = (name) => {
            const entry = { name: (name || this.playerName || 'YOU').toUpperCase().slice(0, 3), score, stars, date: this._todayKey() };
            try {
                if (window.MGIdentity) {
                    entry.playerId = MGIdentity.uuid();
                    const dn = MGIdentity.name();
                    if (dn) entry.displayName = dn;
                }
            } catch (e) {}
            // Overall
            overall.push(entry);
            overall.sort((a, b) => b.score - a.score);
            this.leaderboard.overall = overall.slice(0, 10);
            // Per-level
            levels[levelId].push(entry);
            levels[levelId].sort((a, b) => b.score - a.score);
            levels[levelId] = levels[levelId].slice(0, 10);
            this.leaderboard.levels = levels;
            this.saveLeaderboard();
            try {
                if (window.MGRemote && MGRemote.enabled()) {
                    MGRemote.submit('the-rising', 'level-' + levelId, {
                        name: entry.name, score: entry.score | 0,
                        detail: stars + '★',
                        payload: { stars: stars, level: levelId }
                    }).catch(function(){});
                    MGRemote.submit('the-rising', 'overall', {
                        name: entry.name, score: entry.score | 0,
                        detail: 'L' + levelId + ' ' + stars + '★',
                        payload: { stars: stars, level: levelId }
                    }).catch(function(){});
                }
            } catch (e) {}
            done();
        };

        if (showPrompt) {
            this._promptName(finalize);
        } else {
            finalize(this.playerName);
        }
    },

    _promptName(cb) {
        this._pendingName = cb;
        const input = document.getElementById('nameInput');
        if (input) input.value = (this.playerName || 'YOU').toUpperCase().slice(0, 3);
        this._openModal('nameModal');
    },

    _shareScore() {
        if (!window.MGShare) return;
        const name = (window.MGIdentity && MGIdentity.name())
            || (this.playerName || 'Anonymous');
        const stars = this.stars[this.levelId] || 0;
        MGShare.share({
            gameTitle: 'The Rising',
            subtitle: 'Game over',
            score: this.score || 0,
            name,
            detail: 'Level ' + this.levelId + ' • ' + stars + '★',
            url: 'https://philipposk.github.io/MiniGames/the-rising/',
            accent: '#5cf2c4', bg1: '#06173b', bg2: '#294a8e'
        });
    },

    _setGameOverActionsVisible(show) {
        const el = document.getElementById('gameOverActions');
        if (el) el.style.display = show ? 'flex' : 'none';
    },
    _submitName() {
        const input = document.getElementById('nameInput');
        const v = input ? (input.value || 'YOU').toUpperCase().slice(0, 3) : 'YOU';
        this.playerName = v;
        this.saveName();
        this._closeModal('nameModal');
        if (this._pendingName) {
            const cb = this._pendingName;
            this._pendingName = null;
            cb(v);
        }
    },

    unlockAchievement(id) {
        if (!this.achievements[id] || !this.achievements[id].unlocked) {
            this.achievements[id] = { unlocked: true, date: this._todayKey() };
            this.saveAchievements();
            const ach = ACHIEVEMENTS.find(a => a.id === id);
            if (ach) this.toast(`★ ${ach.name}`);
        }
    },

    toast(text, ms = 2200) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    },

    // ========================================================================
    // UPDATE / DRAW (gameplay)
    // ========================================================================
    update(dt) {
        if (this.screen === 'menu' && this.state === 'menu') {
            this.updateMap(dt);
            return;
        }

        if (this.state === 'menu' || this.state === 'paused' || this.state === 'gameOver') return;

        if (this.state === 'ending' && this.ending) { this.ending.update(dt); return; }

        if (this.state === 'playing') {
            if (this.currentBlock) {
                const speedMul = (this.activeLevel && this.activeLevel.hazards.indexOf('fast') !== -1) ? 1.6 : 1.0;
                const windOffset = (this.activeLevel && this.activeLevel.hazards.indexOf('wind') !== -1)
                    ? Math.sin(performance.now() * 0.003) * 0.6 : 0;
                this.currentBlock.x += (config.block.speed * speedMul + windOffset) * this.direction * dt * 60;
                if (this.currentBlock.x <= 0) { this.currentBlock.x = 0; this.direction = 1; }
                else if (this.currentBlock.x + this.currentBlock.width >= config.canvas.width) {
                    this.currentBlock.x = config.canvas.width - this.currentBlock.width;
                    this.direction = -1;
                }
                if (this.currentBlock.y >= this.water.y - 10) this.currentBlock.scared = true;
            }

            const dt60 = dt * 60;
            const riseRate = this.activeLevel ? this.activeLevel.waterRiseRate : config.water.riseSpeed;
            if (this.water.rising && this.water.y > this.targetHeight - 40) {
                this.water.y -= riseRate * dt60;
            }

            this.deadBlocks.forEach(block => {
                if (block.falling) {
                    block.velocity = (block.velocity || 0) + 0.5 * dt60;
                    block.y += block.velocity * dt60;
                    if (block.y >= this.water.y) { block.y = this.water.y; block.falling = false; }
                }
            });

            this.stackedBlocks.forEach(block => {
                if (block.y >= this.water.y && !block.drowned) {
                    block.drowned = true;
                    this.deadBlocks.push({ ...block, falling: false });
                    if (window.MGNative) MGNative.Haptics.heavy();
                    if (block.isHero) this.endLevel(true);
                }
            });
        } else if (this.state === 'freezing') {
            if (this.water.y > 0) this.water.y -= config.water.freezeSpeed;
        }
    },

    draw() {
        const w = config.canvas.width;
        const h = config.canvas.height;

        this.ctx.fillStyle = '#0f1530';
        this.ctx.fillRect(0, 0, w, h);

        if (this.screen === 'menu' && this.state === 'menu') {
            this.drawWorldMap();
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

        // Goal line
        this.ctx.save();
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
        if (this.settings.colorblind) {
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
            this.ctx.setLineDash([4, 4]);
        } else {
            this.ctx.strokeStyle = `rgba(255, 235, 80, ${pulse})`;
            this.ctx.setLineDash([10, 8]);
        }
        this.ctx.lineWidth = 2;
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

        this.stackedBlocks.forEach(block => { if (!block.drowned) this.drawHuman(block); });

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
        this.ctx.fillText(`L${this.levelId}  Score ${this.score}`, 8, 18);
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Best L${this.progress.bestLevel}  ${this.progress.bestScore}pts`, w / 2, 18);
        this.ctx.textAlign = 'right';
        const volStr = this.settings.muted ? 'MUTE' : `Vol ${Math.round(this.settings.sfxVolume * 100)}%`;
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
            'Arrows  -  Navigate world map',
            'H  -  Toggle this help'
        ];
        lines.forEach((line, i) => this.ctx.fillText(line, w / 2, h * 0.28 + i * 28));
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

        if (!this.settings.reducedMotion) {
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
        }
    },

    drawHeroCinematic() {
        const heroBlock = this.hero;
        if (!heroBlock) return;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        const heroCenterX = heroBlock.x + heroBlock.width / 2;
        const heroCenterY = heroBlock.y + heroBlock.height / 2;
        const pulse = this.settings.reducedMotion ? 1 : (1 + 0.05 * Math.sin(Date.now() * 0.005));
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
        const scale = Math.max(0.5, 1.0 - (this.levelId - 1) * 0.05);
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
        const skin = SKINS.find(s => s.id === this.selectedSkin) || SKINS[0];
        let bodyColor;
        if (isHero) {
            bodyColor = skin.color;
        } else if (scared) {
            bodyColor = this.settings.colorblind ? '#888' : '#ff3333';
        } else {
            bodyColor = '#ff3366';
        }
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

        // Colorblind: add stripes if scared
        if (scared && this.settings.colorblind) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            const cb_w = width * 0.6;
            const cb_x = x + width * 0.2;
            const cb_y = y + headSize * 0.8;
            for (let i = 0; i < 4; i++) {
                this.ctx.fillRect(cb_x + i * (cb_w / 4), cb_y, cb_w / 8, bodyHeight * 0.7);
            }
        }

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
        this.ctx.beginPath(); this.ctx.arc(personCenterX - eyeSpacing, eyeY, eyeSize * 0.8, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(personCenterX + eyeSpacing, eyeY, eyeSize * 0.8, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath(); this.ctx.arc(personCenterX - eyeSpacing, eyeY, eyeSize * 0.5, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(personCenterX + eyeSpacing, eyeY, eyeSize * 0.5, 0, Math.PI * 2); this.ctx.fill();

        const mouthY = headCenterY + headSize * 0.25;
        if (scared) {
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath(); this.ctx.arc(personCenterX, mouthY, eyeSize * 1.1, 0, Math.PI * 2); this.ctx.fill();
        } else {
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(personCenterX, mouthY, eyeSize * 0.8, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
        }
    },

    drawPausedOverlay() {
        const w = config.canvas.width;
        const h = config.canvas.height;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('PAUSED', w / 2, h * 0.4);
        this.ctx.fillText('PAUSED', w / 2, h * 0.4);
        this.ctx.font = '20px Arial';
        this.ctx.fillText('P or ESC to resume', w / 2, h * 0.5);
        this.ctx.fillText('R restart  ·  H help', w / 2, h * 0.56);
        this.ctx.fillStyle = '#ff8888';
        this.ctx.fillText('Tap bottom 35% to QUIT', w / 2, h * 0.72);
    },

    drawGameOverOverlay() {
        const w = config.canvas.width;
        const h = config.canvas.height;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('GAME OVER', w / 2, h * 0.35);
        this.ctx.fillText('GAME OVER', w / 2, h * 0.35);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Level: ${this.levelId}`, w / 2, h * 0.45);
        this.ctx.fillText(`Score: ${this.score}`, w / 2, h * 0.5);
        this.ctx.fillText(`Best: L${this.progress.bestLevel} (${this.progress.bestScore} pts)`, w / 2, h * 0.55);
        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Tap / R / Enter to retry', w / 2, h * 0.68);
        this.ctx.fillStyle = '#ff8888';
        this.ctx.fillText('Tap bottom 25% to QUIT', w / 2, h * 0.78);
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
        if (levelEl) levelEl.textContent = (this.screen === 'menu') ? 'WORLD MAP' : `LEVEL ${this.levelId}`;
        if (survEl) survEl.textContent = (this.screen === 'menu')
            ? `★ ${this.totalStars()} · Unlocked: ${this.progress.unlockedLevel}/${NUM_LEVELS}`
            : `BLOCKS: ${this.blocksRemaining}/${this.totalPeople}`;
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
        if (window.MGTheme) MGTheme.init('the-rising:v1:theme');
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
