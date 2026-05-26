/* Bounce Ball - App Shell.
 *
 * Owns: screen rendering (menu/level-grid, settings, leaderboard, achievements,
 * shop, daily, how-to, credits), hash routing, save state, achievements toasts,
 * leaderboards, coins, shop, PWA registration. Drives gameplay via BounceBallGame.
 */

(function () {
    'use strict';

    const NS = 'bounce-ball:v1:';
    const KEYS = {
        progress: NS + 'progress',
        coins:    NS + 'coins',
        unlocks:  NS + 'unlocks.skins',
        selPad:   NS + 'selected.paddle',
        selBall:  NS + 'selected.ball',
        settings: NS + 'settings',
        ach:      NS + 'achievements',
        lb:       NS + 'leaderboard',
        lbDaily:  NS + 'leaderboard.daily',
        stats:    NS + 'stats'
    };

    const LEGACY_KEYS = ['bounceBallHighScore', 'bounceBallSound'];

    // ----- Storage helpers (try/catch wrapped) -----
    function lsGet(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            if (v === null) return fallback;
            return JSON.parse(v);
        } catch (e) { return fallback; }
    }
    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    // ----- Migration from old keys -----
    function migrate() {
        try {
            const oldHi = localStorage.getItem('bounceBallHighScore');
            if (oldHi !== null && lsGet(KEYS.stats, null) === null) {
                lsSet(KEYS.stats, { highScore: parseInt(oldHi, 10) || 0 });
            }
            const oldSound = localStorage.getItem('bounceBallSound');
            if (oldSound !== null && lsGet(KEYS.settings, null) === null) {
                const enabled = oldSound === '1';
                lsSet(KEYS.settings, defaultSettings(enabled ? 0.8 : 0));
            }
        } catch (e) {}
    }

    function defaultSettings(sfx) {
        return {
            sfxVol: sfx === undefined ? 0.8 : sfx,
            musicVol: 0,
            haptics: true,
            colorblind: false,
            reducedMotion: false,
            controlStyle: 'auto',
            sensitivity: 1.0,
            language: 'en'
        };
    }

    // ----- State -----
    const state = {
        settings: null,
        progress: null,   // { byLevel: { "1": {stars, bestScore, bestTimeSec}, ... } }
        coins: 0,
        unlocks: null,    // { paddle: ['classic', ...], ball: ['classic', ...] }
        selPaddle: 'classic',
        selBall: 'classic',
        achievements: null,
        leaderboard: null, // { "1": [{name, score, time}, ...], overall: [...] }
        lbDaily: null,
        stats: null,
        game: null,
        currentLevel: null,
        soundOn: true
    };

    const SKINS = {
        paddle: [
            { id: 'classic', name: 'Classic',  cost: 0,   color: '#ffffff' },
            { id: 'neon',    name: 'Neon',     cost: 100, color: '#39ff14' },
            { id: 'pastel',  name: 'Pastel',   cost: 150, color: '#ffb3ba' },
            { id: 'mono',    name: 'Mono',     cost: 250, color: '#cccccc' },
            { id: 'gold',    name: 'Gold',     cost: 500, color: '#ffd700' }
        ],
        ball: [
            { id: 'classic', name: 'Classic',  cost: 0,   color: '#ff6b6b' },
            { id: 'neon',    name: 'Neon',     cost: 100, color: '#39ff14' },
            { id: 'pastel',  name: 'Pastel',   cost: 150, color: '#ffb3ba' },
            { id: 'mono',    name: 'Mono',     cost: 250, color: '#ffffff' },
            { id: 'gold',    name: 'Gold',     cost: 500, color: '#ffd700' }
        ]
    };

    const ACHIEVEMENTS = [
        { id: 'first_brick',    name: 'First Brick',    desc: 'Break your first brick.' },
        { id: 'perfect_level',  name: 'Perfect Level',  desc: 'Earn 3 stars on any level.' },
        { id: 'all_stars',      name: 'All Stars',      desc: 'Earn 3 stars on every level.' },
        { id: 'combo_king',     name: 'Combo King',     desc: 'Reach a 10-brick combo.' },
        { id: 'bomber',         name: 'Bomber',         desc: 'Chain 3 bombs in one detonation.' },
        { id: 'survivor',       name: 'Survivor',       desc: 'Clear a level with 1 life left.' },
        { id: 'marathon',       name: 'Marathon',       desc: 'Clear 10 levels in a row without quitting.' },
        { id: 'power_player',   name: 'Power Player',   desc: 'Collect 50 power-ups total.' },
        { id: 'speedrun',       name: 'Speedrun',       desc: 'Clear a level in under half the target time.' },
        { id: 'master',         name: 'Master',         desc: 'Clear all 30 levels.' }
    ];

    // ----- Load all -----
    function loadAll() {
        migrate();
        state.settings = lsGet(KEYS.settings, defaultSettings());
        // Ensure keys exist on update.
        const defS = defaultSettings();
        for (const k in defS) if (!(k in state.settings)) state.settings[k] = defS[k];
        state.progress = lsGet(KEYS.progress, { byLevel: {}, marathonStreak: 0 });
        if (!state.progress.byLevel) state.progress.byLevel = {};
        if (typeof state.progress.marathonStreak !== 'number') state.progress.marathonStreak = 0;
        state.coins = lsGet(KEYS.coins, 0);
        state.unlocks = lsGet(KEYS.unlocks, { paddle: ['classic'], ball: ['classic'] });
        if (!state.unlocks.paddle) state.unlocks.paddle = ['classic'];
        if (!state.unlocks.ball) state.unlocks.ball = ['classic'];
        state.selPaddle = lsGet(KEYS.selPad, 'classic');
        state.selBall = lsGet(KEYS.selBall, 'classic');
        state.achievements = lsGet(KEYS.ach, { unlocked: {}, totalPowerUps: 0, totalBricks: 0 });
        if (!state.achievements.unlocked) state.achievements.unlocked = {};
        state.leaderboard = lsGet(KEYS.lb, { byLevel: {}, overall: [] });
        if (!state.leaderboard.byLevel) state.leaderboard.byLevel = {};
        if (!state.leaderboard.overall) state.leaderboard.overall = [];
        state.lbDaily = lsGet(KEYS.lbDaily, { byDate: {} });
        if (!state.lbDaily.byDate) state.lbDaily.byDate = {};
        state.stats = lsGet(KEYS.stats, { highScore: 0 });
    }

    function saveAll() {
        lsSet(KEYS.settings, state.settings);
        lsSet(KEYS.progress, state.progress);
        lsSet(KEYS.coins, state.coins);
        lsSet(KEYS.unlocks, state.unlocks);
        lsSet(KEYS.selPad, state.selPaddle);
        lsSet(KEYS.selBall, state.selBall);
        lsSet(KEYS.ach, state.achievements);
        lsSet(KEYS.lb, state.leaderboard);
        lsSet(KEYS.lbDaily, state.lbDaily);
        lsSet(KEYS.stats, state.stats);
    }

    // ----- Level unlock logic -----
    function isLevelUnlocked(n) {
        if (n <= 1) return true;
        const prev = state.progress.byLevel[n - 1];
        return !!(prev && prev.stars >= 1);
    }

    function getLevelStars(n) {
        const p = state.progress.byLevel[n];
        return p ? p.stars : 0;
    }

    function totalStars() {
        let s = 0;
        for (const k in state.progress.byLevel) s += state.progress.byLevel[k].stars || 0;
        return s;
    }

    function clearedLevels() {
        let n = 0;
        for (const k in state.progress.byLevel) if ((state.progress.byLevel[k].stars || 0) >= 1) n++;
        return n;
    }

    // ----- DOM -----
    const app = document.getElementById('app');
    const toastHost = document.getElementById('toastHost');

    function clearApp() { while (app.firstChild) app.removeChild(app.firstChild); }

    function el(tag, attrs, children) {
        const e = document.createElement(tag);
        if (attrs) {
            for (const k in attrs) {
                if (k === 'class') e.className = attrs[k];
                else if (k === 'html') e.innerHTML = attrs[k];
                else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
                else if (k === 'aria') {
                    for (const a in attrs.aria) e.setAttribute('aria-' + a, attrs.aria[a]);
                } else e.setAttribute(k, attrs[k]);
            }
        }
        if (children) {
            if (!Array.isArray(children)) children = [children];
            for (const c of children) {
                if (c === null || c === undefined) continue;
                if (typeof c === 'string') e.appendChild(document.createTextNode(c));
                else e.appendChild(c);
            }
        }
        return e;
    }

    // ----- Router -----
    function navigate(hash) {
        if (location.hash !== hash) location.hash = hash;
        else renderRoute();
    }

    function renderRoute() {
        const h = location.hash || '#menu';
        if (h.startsWith('#level/')) {
            const n = parseInt(h.slice(7), 10);
            if (!isNaN(n) && n >= 1 && n <= window.BB_LEVELS.length) {
                renderGame(window.BB_LEVELS[n - 1]);
                return;
            }
        }
        if (h === '#daily') { renderGame(window.BB_buildDailyLevel(window.BB_todayDateStr())); return; }
        if (h === '#settings')     return renderSettings();
        if (h === '#leaderboard')  return renderLeaderboard();
        if (h === '#achievements') return renderAchievements();
        if (h === '#shop')         return renderShop();
        if (h === '#how-to')       return renderHowTo();
        if (h === '#credits')      return renderCredits();
        return renderMenu();
    }

    window.addEventListener('hashchange', renderRoute);

    // ----- TOP BAR -----
    function topBar() {
        return el('div', { class: 'topbar' }, [
            el('div', { class: 'topbar-stat' }, [
                el('span', { class: 'tb-icon' }, '★'),
                el('span', null, totalStars() + ' / ' + (window.BB_LEVELS.length * 3))
            ]),
            el('div', { class: 'topbar-stat' }, [
                el('span', { class: 'tb-icon' }, '◉'),
                el('span', null, String(state.coins))
            ]),
            el('div', { class: 'topbar-stat' }, [
                el('span', { class: 'tb-icon' }, '⌛'),
                el('span', null, String(state.stats.highScore || 0))
            ]),
            el('div', { class: 'topbar-actions' }, [
                el('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => navigate('#settings') }, '⚙'),
                el('button', { class: 'icon-btn', 'aria-label': 'Leaderboard', onclick: () => navigate('#leaderboard') }, '🏆'),
                el('button', { class: 'icon-btn', 'aria-label': 'Achievements', onclick: () => navigate('#achievements') }, '✓'),
                el('button', { class: 'icon-btn', 'aria-label': 'Shop', onclick: () => navigate('#shop') }, '$'),
                el('button', { class: 'icon-btn', 'aria-label': 'How to play', onclick: () => navigate('#how-to') }, '?')
            ])
        ]);
    }

    // ----- MENU (level grid) -----
    function renderMenu() {
        clearApp();
        document.body.classList.remove('in-game');

        const screen = el('div', { class: 'screen menu-screen' });
        screen.appendChild(topBar());

        const title = el('div', { class: 'menu-title-row' }, [
            el('h1', { class: 'game-title-small' }, 'BOUNCE BALL'),
            el('p', { class: 'tagline-small' }, 'Pick a level. Bounce. Win.')
        ]);
        screen.appendChild(title);

        const daily = el('button', {
            class: 'daily-tile',
            'aria-label': 'Daily Challenge',
            onclick: () => navigate('#daily')
        }, [
            el('div', { class: 'daily-left' }, [
                el('div', { class: 'daily-label' }, 'DAILY CHALLENGE'),
                el('div', { class: 'daily-date' }, window.BB_todayDateStr())
            ]),
            el('div', { class: 'daily-right' }, '▶')
        ]);
        screen.appendChild(daily);

        const gridWrap = el('div', { class: 'level-grid-wrap' });
        const grid = el('div', { class: 'level-grid', role: 'grid', 'aria-label': 'Levels' });
        for (let i = 1; i <= window.BB_LEVELS.length; i++) {
            grid.appendChild(buildLevelTile(i));
        }
        gridWrap.appendChild(grid);
        screen.appendChild(gridWrap);

        app.appendChild(screen);
        setupGridKeyboardNav(grid);
    }

    function buildLevelTile(n) {
        const unlocked = isLevelUnlocked(n);
        const stars = getLevelStars(n);
        const lv = window.BB_LEVELS[n - 1];
        const tile = el('button', {
            class: 'level-tile' + (unlocked ? '' : ' locked'),
            'data-level': String(n),
            'aria-label': 'Level ' + n + (unlocked ? ' (' + stars + ' stars)' : ' locked'),
            onclick: () => {
                if (!unlocked) {
                    toast('Locked — clear level ' + (n - 1) + ' first.');
                    return;
                }
                animateTileEnter(tile, () => navigate('#level/' + n));
            }
        });
        tile.appendChild(el('div', { class: 'level-num' }, String(n)));
        // Brick preview thumbnail
        const thumb = el('div', { class: 'level-thumb', 'aria-hidden': 'true' });
        const tg = document.createElement('canvas');
        tg.width = 60; tg.height = 36;
        drawLevelThumb(tg, lv);
        thumb.appendChild(tg);
        tile.appendChild(thumb);

        const starRow = el('div', { class: 'star-row', 'aria-hidden': 'true' });
        for (let i = 1; i <= 3; i++) {
            starRow.appendChild(el('span', { class: 'star' + (i <= stars ? ' filled' : '') }, '★'));
        }
        tile.appendChild(starRow);
        if (!unlocked) tile.appendChild(lockIcon());
        return tile;
    }

    function drawLevelThumb(canvas, lv) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const padX = 2, padY = 2;
        const cw = (canvas.width - padX * 2) / lv.cols;
        const ch = (canvas.height - padY * 2) / lv.rows;
        const colorByType = { 1: '#4ecdc4', 2: '#f9ca24', 3: '#888', 4: '#ff6b6b', 5: '#a29bfe', 6: '#2ecc71' };
        for (let r = 0; r < lv.rows; r++) {
            for (let c = 0; c < lv.cols; c++) {
                const v = lv.grid[r][c];
                if (!v) continue;
                ctx.fillStyle = colorByType[v] || '#fff';
                ctx.fillRect(padX + c * cw, padY + r * ch, cw - 0.5, ch - 0.5);
            }
        }
    }

    function lockIcon() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'lock-icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z');
        path.setAttribute('fill', '#fff');
        svg.appendChild(path);
        return svg;
    }

    function animateTileEnter(tile, done) {
        if (state.settings.reducedMotion) { done(); return; }
        tile.classList.add('zooming');
        setTimeout(() => {
            tile.classList.remove('zooming');
            done();
        }, 280);
    }

    function setupGridKeyboardNav(grid) {
        const tiles = Array.from(grid.querySelectorAll('.level-tile'));
        if (!tiles.length) return;
        // focus first unlocked
        const firstUnlocked = tiles.find(t => !t.classList.contains('locked')) || tiles[0];
        firstUnlocked.setAttribute('tabindex', '0');
        tiles.forEach(t => { if (t !== firstUnlocked) t.setAttribute('tabindex', '-1'); });
        grid.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            const idx = tiles.indexOf(active);
            if (idx === -1) return;
            const cols = parseInt(getComputedStyle(grid).getPropertyValue('--cols')) || 5;
            let next = idx;
            if (e.key === 'ArrowRight') next = Math.min(tiles.length - 1, idx + 1);
            else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
            else if (e.key === 'ArrowDown') next = Math.min(tiles.length - 1, idx + cols);
            else if (e.key === 'ArrowUp') next = Math.max(0, idx - cols);
            else if (e.key === 'Enter') { e.preventDefault(); active.click(); return; }
            else return;
            e.preventDefault();
            tiles[idx].setAttribute('tabindex', '-1');
            tiles[next].setAttribute('tabindex', '0');
            tiles[next].focus();
        });
    }

    // ----- GAME -----
    function renderGame(levelConfig) {
        clearApp();
        document.body.classList.add('in-game');
        state.currentLevel = levelConfig;

        const screen = el('div', { class: 'screen game-screen' });

        const header = el('div', { class: 'game-header' }, [
            el('button', { class: 'icon-btn', 'aria-label': 'Back to menu', onclick: () => quitToMenu() }, '←'),
            el('div', { class: 'hud' }, [
                el('div', null, [el('span', { class: 'hud-label' }, 'LV'), el('span', { id: 'hudLevel', class: 'hud-val' }, levelConfig.daily ? 'D' : String(levelConfig.index))]),
                el('div', null, [el('span', { class: 'hud-label' }, 'SCORE'), el('span', { id: 'hudScore', class: 'hud-val' }, '0')]),
                el('div', null, [el('span', { class: 'hud-label' }, 'LIVES'), el('span', { id: 'hudLives', class: 'hud-val lives' }, '♥♥♥')]),
                el('div', null, [el('span', { class: 'hud-label' }, 'TIME'), el('span', { id: 'hudTime', class: 'hud-val' }, '0s')])
            ]),
            el('div', { class: 'hud-actions' }, [
                el('button', { class: 'icon-btn', id: 'pauseBtn', 'aria-label': 'Pause', onclick: () => state.game && state.game.togglePause() }, '‖'),
                el('button', { class: 'icon-btn', id: 'soundBtn', 'aria-label': 'Toggle sound', onclick: toggleSound }, state.settings.sfxVol > 0 ? '♪' : '♪̸')
            ])
        ]);

        const canvasWrap = el('div', { class: 'canvas-wrap' }, [
            el('canvas', { id: 'gameCanvas', 'aria-label': 'Game canvas' })
        ]);

        const pauseOverlay = el('div', { class: 'pause-overlay hidden', id: 'pauseOverlay' }, [
            el('div', { class: 'pause-content' }, [
                el('h2', null, 'PAUSED'),
                el('div', { class: 'button-row' }, [
                    el('button', { class: 'btn-primary', onclick: () => state.game && state.game.togglePause() }, 'RESUME'),
                    el('button', { class: 'btn-secondary', onclick: () => quitToMenu() }, 'QUIT')
                ])
            ])
        ]);

        screen.appendChild(header);
        screen.appendChild(canvasWrap);
        screen.appendChild(pauseOverlay);
        app.appendChild(screen);

        // HUD update timer
        const hudScore = document.getElementById('hudScore');
        const hudLives = document.getElementById('hudLives');
        const hudTime = document.getElementById('hudTime');
        let hudTimer = null;

        // Build game instance
        if (!state.game) {
            state.game = new window.BounceBallGame();
        }
        const g = state.game;
        g.setSettings(Object.assign({}, state.settings, {
            paddleSkin: state.selPaddle,
            ballSkin: state.selBall
        }));
        g.onScoreChange = (s) => { if (hudScore) hudScore.textContent = String(s); };
        g.onLifeChange = (l) => { if (hudLives) hudLives.textContent = '♥'.repeat(Math.max(0, l)) || '·'; };
        g.onBrickDestroyed = () => {
            state.coins += 1;
            state.achievements.totalBricks++;
            if (!state.achievements.unlocked.first_brick) unlockAchievement('first_brick');
        };
        g.onPowerUpCollected = () => {
            state.achievements.totalPowerUps++;
            if (state.achievements.totalPowerUps >= 50 && !state.achievements.unlocked.power_player) unlockAchievement('power_player');
        };
        g.onComboChange = (combo) => {
            if (combo >= 10 && !state.achievements.unlocked.combo_king) unlockAchievement('combo_king');
        };
        g.onBombChain = (chain) => {
            if (chain >= 3 && !state.achievements.unlocked.bomber) unlockAchievement('bomber');
        };
        g.onPaused = () => { pauseOverlay.classList.remove('hidden'); };
        g.onResumed = () => { pauseOverlay.classList.add('hidden'); };
        g.onQuit = () => quitToMenu();
        g.onLevelComplete = (r) => onLevelComplete(levelConfig, r);
        g.onGameOver = (r) => onGameOverHandler(levelConfig, r);

        g.attach(document.getElementById('gameCanvas'));
        g.loadLevel(levelConfig);
        g.startGame();

        hudTimer = setInterval(() => {
            if (g && hudTime) hudTime.textContent = g.elapsedSec + 's';
        }, 250);
        state._hudTimer = hudTimer;
    }

    function quitToMenu() {
        if (state._hudTimer) { clearInterval(state._hudTimer); state._hudTimer = null; }
        if (state.game && state.game.animationFrame) {
            cancelAnimationFrame(state.game.animationFrame);
            state.game.animationFrame = null;
        }
        if (state.game) state.game.state = 'menu';
        state.progress.marathonStreak = 0;
        saveAll();
        navigate('#menu');
    }

    function toggleSound() {
        state.settings.sfxVol = state.settings.sfxVol > 0 ? 0 : 0.8;
        if (state.game) state.game.setSettings(state.settings);
        saveAll();
        const btn = document.getElementById('soundBtn');
        if (btn) btn.textContent = state.settings.sfxVol > 0 ? '♪' : '♪̸';
    }

    function onLevelComplete(levelConfig, r) {
        if (state._hudTimer) { clearInterval(state._hudTimer); state._hudTimer = null; }
        // Coins reward
        const coinReward = 20 + r.stars * 15 + Math.floor(r.score / 100);
        state.coins += coinReward;

        if (levelConfig.daily) {
            updateDailyLeaderboard(levelConfig.dateStr, r);
        } else {
            // Persist progress
            const lvKey = String(levelConfig.index);
            const prev = state.progress.byLevel[lvKey] || { stars: 0, bestScore: 0, bestTimeSec: Infinity };
            const newStars = Math.max(prev.stars, r.stars);
            const newBest = Math.max(prev.bestScore, r.score);
            const newTime = Math.min(prev.bestTimeSec || Infinity, r.timeSec);
            state.progress.byLevel[lvKey] = { stars: newStars, bestScore: newBest, bestTimeSec: newTime };
            state.progress.marathonStreak++;

            updateLeaderboard(levelConfig.index, r);

            // Achievements
            if (r.stars === 3 && !state.achievements.unlocked.perfect_level) unlockAchievement('perfect_level');
            if (r.livesLeft === 1 && !state.achievements.unlocked.survivor) unlockAchievement('survivor');
            if (r.timeSec * 2 <= levelConfig.targetTimeSec && !state.achievements.unlocked.speedrun) unlockAchievement('speedrun');
            if (state.progress.marathonStreak >= 10 && !state.achievements.unlocked.marathon) unlockAchievement('marathon');

            // All-stars / Master
            let allStars = true, allCleared = true;
            for (let i = 1; i <= window.BB_LEVELS.length; i++) {
                const p = state.progress.byLevel[String(i)];
                if (!p) { allStars = false; allCleared = false; }
                else {
                    if (p.stars < 3) allStars = false;
                    if (p.stars < 1) allCleared = false;
                }
            }
            if (allCleared && !state.achievements.unlocked.master) unlockAchievement('master');
            if (allStars && !state.achievements.unlocked.all_stars) unlockAchievement('all_stars');
        }

        if (r.score > (state.stats.highScore || 0)) state.stats.highScore = r.score;
        saveAll();

        renderLevelCompleteOverlay(levelConfig, r, coinReward);
    }

    function onGameOverHandler(levelConfig, r) {
        if (state._hudTimer) { clearInterval(state._hudTimer); state._hudTimer = null; }
        state.progress.marathonStreak = 0;
        if (r.score > (state.stats.highScore || 0)) state.stats.highScore = r.score;
        saveAll();
        renderGameOverOverlay(levelConfig, r);
    }

    function renderLevelCompleteOverlay(levelConfig, r, coinReward) {
        const overlay = el('div', { class: 'modal-overlay', role: 'dialog', 'aria-label': 'Level Complete' });
        const content = el('div', { class: 'modal-content' }, [
            el('h2', null, 'LEVEL CLEAR'),
            el('div', { class: 'big-stars' }, [
                el('span', { class: 'star big' + (r.stars >= 1 ? ' filled' : '') }, '★'),
                el('span', { class: 'star big' + (r.stars >= 2 ? ' filled' : '') }, '★'),
                el('span', { class: 'star big' + (r.stars >= 3 ? ' filled' : '') }, '★')
            ]),
            el('div', { class: 'mc-row' }, 'Score: ' + r.score),
            el('div', { class: 'mc-row' }, 'Time: ' + r.timeSec + 's (target ' + levelConfig.targetTimeSec + 's)'),
            el('div', { class: 'mc-row coins' }, '+ ' + coinReward + ' coins'),
            checkNewBestEntry(levelConfig, r),
            el('div', { class: 'button-row' }, [
                el('button', {
                    class: 'btn-primary',
                    onclick: () => {
                        overlay.remove();
                        if (levelConfig.daily) navigate('#menu');
                        else if (levelConfig.index < window.BB_LEVELS.length) navigate('#level/' + (levelConfig.index + 1));
                        else navigate('#menu');
                    }
                }, levelConfig.daily ? 'BACK' : (levelConfig.index < window.BB_LEVELS.length ? 'NEXT' : 'MENU')),
                el('button', { class: 'btn-secondary', onclick: () => _shareScore(r, levelConfig, true) }, 'SHARE'),
                el('button', { class: 'btn-secondary', onclick: () => { overlay.remove(); navigate('#menu'); } }, 'MENU')
            ])
        ]);
        overlay.appendChild(content);
        app.appendChild(overlay);
    }

    function renderGameOverOverlay(levelConfig, r) {
        const overlay = el('div', { class: 'modal-overlay', role: 'dialog', 'aria-label': 'Game Over' });
        const content = el('div', { class: 'modal-content' }, [
            el('h2', null, 'GAME OVER'),
            el('div', { class: 'mc-row' }, 'Score: ' + r.score),
            el('div', { class: 'mc-row' }, 'Bricks: ' + r.bricks),
            el('div', { class: 'button-row' }, [
                el('button', {
                    class: 'btn-primary',
                    onclick: () => { overlay.remove(); navigate('#level/' + (levelConfig.daily ? 1 : levelConfig.index)); }
                }, 'RETRY'),
                el('button', { class: 'btn-secondary', onclick: () => _shareScore(r, levelConfig, false) }, 'SHARE'),
                el('button', { class: 'btn-secondary', onclick: () => { overlay.remove(); navigate('#menu'); } }, 'MENU')
            ])
        ]);
        overlay.appendChild(content);
        app.appendChild(overlay);
    }

    function _shareScore(r, levelConfig, cleared) {
        if (!window.MGShare) return;
        const name = (window.MGIdentity && MGIdentity.name())
            || lsGet(NS + 'lastName', '')
            || 'Anonymous';
        const stars = r.stars != null ? r.stars : 0;
        MGShare.share({
            gameTitle: 'Bounce Ball',
            subtitle: cleared ? 'Level cleared' : 'Game over',
            score: r.score,
            name,
            detail: 'Level ' + (levelConfig.index || 1) + ' • ' + stars + '★',
            url: 'https://philipposk.github.io/MiniGames/bounce-ball/',
            accent: '#ff5c8a', bg1: '#1a2455', bg2: '#3b1d6e'
        });
    }

    function checkNewBestEntry(levelConfig, r) {
        // Return a container that, if this is a top-10 score, asks for name.
        let key, board;
        if (levelConfig.daily) {
            key = 'daily-' + levelConfig.dateStr;
            board = state.lbDaily.byDate[levelConfig.dateStr] || [];
        } else {
            key = String(levelConfig.index);
            board = state.leaderboard.byLevel[key] || [];
        }
        if (board.length < 10 || r.score > board[board.length - 1].score) {
            const wrap = el('div', { class: 'new-best' });
            wrap.appendChild(el('div', { class: 'new-best-label' }, 'NEW LEADERBOARD ENTRY!'));
            const input = el('input', {
                type: 'text', maxlength: '3', class: 'arcade-input',
                placeholder: 'AAA', 'aria-label': '3-letter name'
            });
            input.value = lsGet(NS + 'lastName', 'AAA');
            input.addEventListener('input', () => {
                input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
            });
            const saveBtn = el('button', {
                class: 'btn-secondary small',
                onclick: () => {
                    const name = (input.value || 'AAA').padEnd(3, 'A').slice(0, 3);
                    lsSet(NS + 'lastName', name);
                    if (levelConfig.daily) addDailyLeaderboardEntry(levelConfig.dateStr, name, r);
                    else addLeaderboardEntry(levelConfig.index, name, r);
                    saveAll();
                    wrap.innerHTML = '<div class="new-best-label">Saved as ' + name + '</div>';
                }
            }, 'SAVE');
            wrap.appendChild(input);
            wrap.appendChild(saveBtn);
            return wrap;
        }
        return null;
    }

    function _identityFields() {
        const out = {};
        try {
            if (window.MGIdentity) {
                out.playerId = MGIdentity.uuid();
                const dn = MGIdentity.name();
                if (dn) out.displayName = dn;
            }
        } catch (e) {}
        return out;
    }

    function addLeaderboardEntry(level, name, r) {
        const key = String(level);
        const board = state.leaderboard.byLevel[key] || [];
        board.push(Object.assign({ name, score: r.score, time: r.timeSec }, _identityFields()));
        board.sort((a, b) => b.score - a.score || a.time - b.time);
        state.leaderboard.byLevel[key] = board.slice(0, 10);
    }
    function updateLeaderboard(level, r) { /* added on user save */ }

    function addDailyLeaderboardEntry(dateStr, name, r) {
        const board = state.lbDaily.byDate[dateStr] || [];
        board.push(Object.assign({ name, score: r.score, time: r.timeSec }, _identityFields()));
        board.sort((a, b) => b.score - a.score || a.time - b.time);
        state.lbDaily.byDate[dateStr] = board.slice(0, 10);
    }
    function updateDailyLeaderboard(dateStr, r) { /* added on user save */ }

    // ----- ACHIEVEMENT TOAST -----
    function unlockAchievement(id) {
        if (state.achievements.unlocked[id]) return;
        state.achievements.unlocked[id] = Date.now();
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) toast('🏆 ' + ach.name + ' — ' + ach.desc);
        state.coins += 25;
        saveAll();
    }

    function toast(msg) {
        if (!toastHost) return;
        const t = el('div', { class: 'toast', role: 'status' }, msg);
        toastHost.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        }, 3000);
    }

    // ----- SETTINGS -----
    function renderSettings() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('SETTINGS'));

        const body = el('div', { class: 'sub-body' });

        body.appendChild(sliderRow('SFX volume', state.settings.sfxVol, (v) => {
            state.settings.sfxVol = v; if (state.game) state.game.setSettings(state.settings); saveAll();
        }));
        body.appendChild(sliderRow('Music volume', state.settings.musicVol, (v) => {
            state.settings.musicVol = v;
            if (state.game) state.game.setSettings(state.settings);
            saveAll();
        }));
        body.appendChild(toggleRow('Haptics', state.settings.haptics, (v) => {
            state.settings.haptics = v; if (state.game) state.game.setSettings(state.settings); saveAll();
        }));
        body.appendChild(toggleRow('Colorblind mode', state.settings.colorblind, (v) => {
            state.settings.colorblind = v; if (state.game) state.game.setSettings(state.settings); saveAll();
        }));
        body.appendChild(toggleRow('Reduced motion', state.settings.reducedMotion, (v) => {
            state.settings.reducedMotion = v; if (state.game) state.game.setSettings(state.settings); saveAll();
        }));

        body.appendChild(selectRow('Control style', state.settings.controlStyle, [
            ['auto', 'Auto'], ['mouse', 'Mouse'], ['touch', 'Touch'], ['keyboard', 'Keyboard']
        ], (v) => { state.settings.controlStyle = v; saveAll(); }));

        body.appendChild(sliderRow('Sensitivity', state.settings.sensitivity, (v) => {
            state.settings.sensitivity = Math.max(0.3, Math.min(2.0, v * 2));
            if (state.game) state.game.setSettings(state.settings); saveAll();
        }, 0, 1, 0.05));

        body.appendChild(selectRow('Language', state.settings.language, [['en', 'English']], (v) => {
            state.settings.language = v; saveAll();
        }));

        body.appendChild(themeRow());

        appendPlayerSection(body);

        const reset = el('button', {
            class: 'btn-secondary danger',
            onclick: () => {
                if (confirm('Reset ALL progress, coins, achievements, leaderboards?')) {
                    try {
                        for (const k in KEYS) localStorage.removeItem(KEYS[k]);
                        for (const lk of LEGACY_KEYS) localStorage.removeItem(lk);
                    } catch (e) {}
                    loadAll();
                    toast('Progress reset.');
                    navigate('#menu');
                }
            }
        }, 'RESET PROGRESS');
        body.appendChild(reset);

        screen.appendChild(body);
        app.appendChild(screen);
    }

    function sliderRow(label, value, onChange, min, max, step) {
        min = min === undefined ? 0 : min;
        max = max === undefined ? 1 : max;
        step = step === undefined ? 0.05 : step;
        const row = el('div', { class: 'setting-row' });
        row.appendChild(el('label', null, label));
        const input = el('input', {
            type: 'range',
            min: String(min), max: String(max), step: String(step),
            value: String(Math.max(min, Math.min(max, label === 'Sensitivity' ? value / 2 : value)))
        });
        input.addEventListener('input', () => onChange(parseFloat(input.value)));
        row.appendChild(input);
        return row;
    }
    function toggleRow(label, value, onChange) {
        const row = el('div', { class: 'setting-row' });
        row.appendChild(el('label', null, label));
        const btn = el('button', {
            class: 'toggle' + (value ? ' on' : ''),
            'aria-pressed': value ? 'true' : 'false',
            onclick: () => {
                value = !value;
                btn.classList.toggle('on', value);
                btn.setAttribute('aria-pressed', value ? 'true' : 'false');
                onChange(value);
            }
        }, value ? 'ON' : 'OFF');
        // keep text in sync
        btn.addEventListener('click', () => { btn.textContent = btn.classList.contains('on') ? 'ON' : 'OFF'; });
        row.appendChild(btn);
        return row;
    }
    function themeRow() {
        const THEME_KEY = 'bounce-ball:v1:theme';
        const row = el('div', { class: 'setting-row' });
        row.appendChild(el('label', null, 'Theme'));
        const group = el('div', { class: 'theme-toggle', role: 'radiogroup', 'aria-label': 'Theme' });
        const opts = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']];
        const cur = (window.MGTheme && MGTheme.get(THEME_KEY)) || 'system';
        const buttons = [];
        opts.forEach(([pref, label]) => {
            const b = el('button', {
                type: 'button',
                'data-theme-pref': pref,
                'aria-pressed': pref === cur ? 'true' : 'false',
                onclick: () => {
                    if (window.MGTheme) MGTheme.set(pref, THEME_KEY);
                    buttons.forEach(bb => bb.setAttribute('aria-pressed', bb.getAttribute('data-theme-pref') === pref ? 'true' : 'false'));
                }
            }, label);
            buttons.push(b);
            group.appendChild(b);
        });
        row.appendChild(group);
        return row;
    }

    function appendPlayerSection(body) {
        if (!window.MGIdentity) return;
        body.appendChild(el('h3', { class: 'lb-h4' }, 'PLAYER'));
        const nameRow = el('div', { class: 'setting-row' });
        nameRow.appendChild(el('label', { for: 'mg-player-name' }, 'Your name'));
        const nameInput = el('input', {
            type: 'text', id: 'mg-player-name', maxlength: '24',
            placeholder: 'Anonymous', value: MGIdentity.name() || ''
        });
        nameInput.addEventListener('input', () => {
            MGIdentity.setName(nameInput.value);
        });
        nameRow.appendChild(nameInput);
        body.appendChild(nameRow);

        const sugRow = el('div', { class: 'setting-row' });
        sugRow.appendChild(el('label', null, 'Suggest a name'));
        const sugBtn = el('button', {
            class: 'btn-secondary small',
            onclick: () => {
                const s = MGIdentity.suggest();
                nameInput.value = s;
                MGIdentity.setName(s);
            }
        }, 'SUGGEST');
        sugRow.appendChild(sugBtn);
        body.appendChild(sugRow);

        const idRow = el('div', { class: 'setting-row' });
        idRow.appendChild(el('label', null, 'Player ID'));
        const fullId = MGIdentity.uuid();
        const idText = el('span', { title: fullId, style: 'font-family:monospace;font-size:12px;opacity:0.7;' }, fullId.slice(0, 8) + '…');
        idRow.appendChild(idText);
        const copyBtn = el('button', {
            class: 'btn-secondary small',
            onclick: () => {
                try {
                    if (navigator.clipboard) navigator.clipboard.writeText(fullId).then(() => toast('Player ID copied'));
                    else toast(fullId);
                } catch (e) { toast(fullId); }
            }
        }, 'COPY');
        idRow.appendChild(copyBtn);
        body.appendChild(idRow);
    }

    function selectRow(label, value, options, onChange) {
        const row = el('div', { class: 'setting-row' });
        row.appendChild(el('label', null, label));
        const sel = el('select');
        for (const [v, t] of options) {
            const o = el('option', { value: v }, t);
            if (v === value) o.setAttribute('selected', 'selected');
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => onChange(sel.value));
        row.appendChild(sel);
        return row;
    }

    function backHeader(title) {
        return el('div', { class: 'sub-header' }, [
            el('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => navigate('#menu') }, '←'),
            el('h2', null, title)
        ]);
    }

    // ----- LEADERBOARD -----
    function renderLeaderboard() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('LEADERBOARD'));
        const body = el('div', { class: 'sub-body' });

        body.appendChild(el('h3', null, 'Overall (sum of stars)'));
        body.appendChild(el('div', { class: 'lb-row' }, [
            el('span', null, 'YOU'),
            el('span', null, totalStars() + ' ★')
        ]));

        body.appendChild(el('h3', null, 'Best per level'));
        for (let i = 1; i <= window.BB_LEVELS.length; i++) {
            const board = (state.leaderboard.byLevel[String(i)] || []).slice(0, 3);
            if (board.length === 0) continue;
            body.appendChild(el('h4', { class: 'lb-h4' }, 'Level ' + i));
            for (const e of board) {
                body.appendChild(el('div', { class: 'lb-row' }, [
                    el('span', null, e.displayName || e.name),
                    el('span', null, e.score + ' pts · ' + e.time + 's')
                ]));
            }
        }

        const dailyKeys = Object.keys(state.lbDaily.byDate).sort().reverse().slice(0, 5);
        if (dailyKeys.length) {
            body.appendChild(el('h3', null, 'Daily Challenge'));
            for (const d of dailyKeys) {
                body.appendChild(el('h4', { class: 'lb-h4' }, d));
                for (const e of (state.lbDaily.byDate[d] || []).slice(0, 3)) {
                    body.appendChild(el('div', { class: 'lb-row' }, [
                        el('span', null, e.displayName || e.name),
                        el('span', null, e.score + ' pts · ' + e.time + 's')
                    ]));
                }
            }
        }

        screen.appendChild(body);
        app.appendChild(screen);
    }

    // ----- ACHIEVEMENTS -----
    function renderAchievements() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('ACHIEVEMENTS'));
        const body = el('div', { class: 'sub-body' });
        for (const a of ACHIEVEMENTS) {
            const ok = !!state.achievements.unlocked[a.id];
            body.appendChild(el('div', { class: 'ach-row' + (ok ? ' unlocked' : '') }, [
                el('div', { class: 'ach-icon' }, ok ? '🏆' : '🔒'),
                el('div', { class: 'ach-meta' }, [
                    el('div', { class: 'ach-name' }, a.name),
                    el('div', { class: 'ach-desc' }, a.desc)
                ])
            ]));
        }
        screen.appendChild(body);
        app.appendChild(screen);
    }

    // ----- SHOP -----
    function renderShop() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('SHOP'));
        const body = el('div', { class: 'sub-body' });
        body.appendChild(el('div', { class: 'coins-display' }, '◉ ' + state.coins + ' coins'));

        body.appendChild(el('h3', null, 'Paddle skins'));
        body.appendChild(buildSkinGrid('paddle'));
        body.appendChild(el('h3', null, 'Ball skins'));
        body.appendChild(buildSkinGrid('ball'));

        screen.appendChild(body);
        app.appendChild(screen);
    }

    function buildSkinGrid(kind) {
        const grid = el('div', { class: 'skin-grid' });
        const list = SKINS[kind];
        const unlocked = state.unlocks[kind];
        const selected = kind === 'paddle' ? state.selPaddle : state.selBall;
        for (const s of list) {
            const isUnlocked = unlocked.indexOf(s.id) !== -1;
            const isSelected = selected === s.id;
            const tile = el('button', {
                class: 'skin-tile' + (isSelected ? ' selected' : '') + (isUnlocked ? '' : ' locked'),
                'aria-label': s.name + (isUnlocked ? '' : ' costs ' + s.cost + ' coins'),
                onclick: () => {
                    if (!isUnlocked) {
                        if (state.coins < s.cost) { toast('Not enough coins.'); return; }
                        state.coins -= s.cost;
                        state.unlocks[kind].push(s.id);
                    }
                    if (kind === 'paddle') state.selPaddle = s.id;
                    else state.selBall = s.id;
                    saveAll();
                    renderShop();
                }
            });
            const swatch = el('div', { class: 'swatch' });
            swatch.style.background = s.color;
            tile.appendChild(swatch);
            tile.appendChild(el('div', { class: 'skin-name' }, s.name));
            tile.appendChild(el('div', { class: 'skin-cost' }, isUnlocked ? (isSelected ? 'EQUIPPED' : 'OWNED') : (s.cost + ' ◉')));
            grid.appendChild(tile);
        }
        return grid;
    }

    // ----- HOW TO -----
    function renderHowTo() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('HOW TO PLAY'));
        const body = el('div', { class: 'sub-body howto' });
        body.appendChild(el('p', null, 'Move the paddle with mouse, touch, or arrow keys.'));
        body.appendChild(el('p', null, 'Break every breakable brick to clear the level.'));
        body.appendChild(el('p', null, 'Earn stars: clear (1★), beat target time (2★), no life lost (3★).'));
        body.appendChild(el('p', null, 'Bricks: N normal · H 2-hit · M unbreakable · B bomb · X multiball drop · L extra life.'));
        body.appendChild(el('p', null, 'Pause: P. Quit to menu: Esc.'));
        screen.appendChild(body);
        app.appendChild(screen);
    }
    function renderCredits() {
        clearApp();
        document.body.classList.remove('in-game');
        const screen = el('div', { class: 'screen sub-screen' });
        screen.appendChild(backHeader('CREDITS'));
        const body = el('div', { class: 'sub-body' });
        body.appendChild(el('p', null, 'Bounce Ball — vanilla JS mini-game.'));
        screen.appendChild(body);
        app.appendChild(screen);
    }

    // ----- PWA -----
    function registerSW() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js').catch(() => {});
            });
        }
    }

    // ----- Init -----
    function init() {
        if (window.MGTheme) MGTheme.init('bounce-ball:v1:theme');
        loadAll();
        registerSW();
        if (!location.hash) location.hash = '#menu';
        renderRoute();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
