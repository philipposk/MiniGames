/* Bounce Ball - Level Data
 *
 * Brick types:
 *   .  0  empty
 *   N  1  normal
 *   H  2  hard (multi-hit, 2 hits)
 *   M  3  metal (unbreakable)
 *   B  4  bomb
 *   X  5  multiball drop on break
 *   L  6  extra life on break
 *
 * Layouts are strings; non-symbol chars are skipped, so spaces/comments are fine.
 * rows/cols are derived from the layout. Width adapts at runtime.
 */

const BRICK_CHAR_MAP = {
    '.': 0, ' ': 0, '_': 0,
    'N': 1, 'n': 1, '1': 1,
    'H': 2, 'h': 2, '2': 2,
    'M': 3, 'm': 3, '3': 3,
    'B': 4, 'b': 4, '4': 4,
    'X': 5, 'x': 5, '5': 5,
    'L': 6, 'l': 6, '6': 6
};

function parseLayout(str) {
    const rawLines = str.split('\n');
    const lines = [];
    for (const ln of rawLines) {
        const trimmed = ln.replace(/\r$/, '');
        if (trimmed.trim() === '') continue;
        lines.push(trimmed);
    }
    const grid = [];
    let cols = 0;
    for (const line of lines) {
        const row = [];
        for (const ch of line) {
            if (BRICK_CHAR_MAP.hasOwnProperty(ch)) {
                row.push(BRICK_CHAR_MAP[ch]);
            }
        }
        if (row.length > 0) {
            grid.push(row);
            cols = Math.max(cols, row.length);
        }
    }
    for (const row of grid) {
        while (row.length < cols) row.push(0);
    }
    return { rows: grid.length, cols, grid };
}

// Levels: 30 hand-curated.
const RAW_LEVELS = [
    { name: 'Hello',          ballSpeed: 4.5, paddleWidth: 130, targetScore:  300, targetTimeSec:  45, layout:
`NNNNNN
NNNNNN
......` },
    { name: 'Walls Up',       ballSpeed: 4.8, paddleWidth: 130, targetScore:  400, targetTimeSec:  50, layout:
`NNNNNN
N....N
N....N
NNNNNN` },
    { name: 'Pyramid',        ballSpeed: 5.0, paddleWidth: 125, targetScore:  500, targetTimeSec:  55, layout:
`..NN..
.NNNN.
NNNNNN
......` },
    { name: 'Bomb Squad',     ballSpeed: 5.0, paddleWidth: 125, targetScore:  500, targetTimeSec:  55, layout:
`NNBNNN
NNNNNN
NNNBNN
......` },
    { name: 'Fortress',       ballSpeed: 5.2, paddleWidth: 120, targetScore:  600, targetTimeSec:  60, layout:
`MMMMMM
NHHHHM
NHHHHM
MNNNNM` },
    { name: 'Checker',        ballSpeed: 5.2, paddleWidth: 120, targetScore:  600, targetTimeSec:  60, layout:
`N.N.N.
.N.N.N
N.N.N.
.N.N.N` },
    { name: 'Twin Towers',    ballSpeed: 5.3, paddleWidth: 120, targetScore:  650, targetTimeSec:  60, layout:
`NN..NN
NH..HN
NH..HN
NN..NN` },
    { name: 'Heart',          ballSpeed: 5.3, paddleWidth: 115, targetScore:  700, targetTimeSec:  65, layout:
`.NN.NN.
NNNNNNN
NNNNNNN
.NNNNN.
..NNN..
...N...` },
    { name: 'Cross',          ballSpeed: 5.4, paddleWidth: 115, targetScore:  700, targetTimeSec:  65, layout:
`..NN..
..NN..
NNNNNN
NNNNNN
..NN..
..NN..` },
    { name: 'Power Pack',     ballSpeed: 5.4, paddleWidth: 115, targetScore:  750, targetTimeSec:  70, layout:
`NNXNNN
NHHHHN
NNLNNN
NBNNBN` },
    { name: 'The Wall',       ballSpeed: 5.5, paddleWidth: 110, targetScore:  800, targetTimeSec:  70, layout:
`HHHHHH
HHHHHH
NNNNNN
NNNNNN` },
    { name: 'Maze',           ballSpeed: 5.5, paddleWidth: 110, targetScore:  850, targetTimeSec:  75, layout:
`NMNMNM
N.N.N.
NMNMNM
N.N.N.` },
    { name: 'Bomb Run',       ballSpeed: 5.6, paddleWidth: 110, targetScore:  900, targetTimeSec:  75, layout:
`BNNNNB
NBNNBN
NNBBNN
NBNNBN
BNNNNB` },
    { name: 'Caverns',        ballSpeed: 5.6, paddleWidth: 110, targetScore:  900, targetTimeSec:  75, layout:
`NNNNNN
M....M
N....N
M....M
NNNNNN` },
    { name: 'Tough Crowd',    ballSpeed: 5.7, paddleWidth: 105, targetScore: 1000, targetTimeSec:  80, layout:
`HHHHHH
HHHHHH
HHHHHH
......` },
    { name: 'Star',           ballSpeed: 5.7, paddleWidth: 105, targetScore: 1000, targetTimeSec:  80, layout:
`...N...
..NNN..
NNNNNNN
.NNNNN.
NN...NN` },
    { name: 'Vault',          ballSpeed: 5.8, paddleWidth: 105, targetScore: 1100, targetTimeSec:  80, layout:
`MMMMMM
MHHHHM
MHLLHM
MHHHHM
MMMMMM` },
    { name: 'Bounce House',   ballSpeed: 5.9, paddleWidth: 100, targetScore: 1200, targetTimeSec:  85, layout:
`NMNNMN
NNNNNN
MNNNNM
NNNNNN
NMNNMN` },
    { name: 'Spiral',         ballSpeed: 5.9, paddleWidth: 100, targetScore: 1200, targetTimeSec:  85, layout:
`NNNNNN
N....N
N.NN.N
N.N..N
N.NNNN` },
    { name: 'Carnage',        ballSpeed: 6.0, paddleWidth: 100, targetScore: 1300, targetTimeSec:  90, layout:
`BHBHBH
HBHBHB
BHBHBH
NNNNNN` },
    { name: 'Lockdown',       ballSpeed: 6.0, paddleWidth: 100, targetScore: 1300, targetTimeSec:  90, layout:
`MMMMMM
MNNNNM
MNHHNM
MNNNNM
MMMMMM` },
    { name: 'Castle',         ballSpeed: 6.1, paddleWidth:  95, targetScore: 1400, targetTimeSec:  90, layout:
`M.MM.M
MMMMMM
MHHHHM
NHLLHN
NNNNNN` },
    { name: 'Hailstorm',      ballSpeed: 6.2, paddleWidth:  95, targetScore: 1500, targetTimeSec:  95, layout:
`NNNNNNN
NNNNNNN
NNNNNNN
NNNNNNN
NNNNNNN` },
    { name: 'Trinity',        ballSpeed: 6.2, paddleWidth:  95, targetScore: 1500, targetTimeSec:  95, layout:
`X.....X
HHHHHHH
HHHHHHH
B.....B` },
    { name: 'Gauntlet',       ballSpeed: 6.3, paddleWidth:  90, targetScore: 1600, targetTimeSec: 100, layout:
`MHMHMHM
HHHHHHH
MHMHMHM
HHHHHHH
MHMHMHM` },
    { name: 'Inferno',        ballSpeed: 6.4, paddleWidth:  90, targetScore: 1700, targetTimeSec: 100, layout:
`BBBBBB
BHHHHB
BHLLHB
BHHHHB
BBBBBB` },
    { name: 'Skull',          ballSpeed: 6.4, paddleWidth:  90, targetScore: 1700, targetTimeSec: 100, layout:
`.NNNNN.
NMMNMMN
NMMNMMN
NNNNNNN
.N.N.N.` },
    { name: 'No Escape',      ballSpeed: 6.5, paddleWidth:  85, targetScore: 1800, targetTimeSec: 105, layout:
`MMMMMM
MHHHHM
MHBBHM
MHHHHM
MHHHHM
MMMMMM` },
    { name: 'Final Stand',    ballSpeed: 6.6, paddleWidth:  85, targetScore: 1900, targetTimeSec: 110, layout:
`HHHHHHH
HBHBHBH
HHHHHHH
HBHBHBH
HHHHHHH` },
    { name: 'Endgame',        ballSpeed: 6.8, paddleWidth:  80, targetScore: 2200, targetTimeSec: 120, layout:
`MBMBMBM
HHHHHHH
HXLHLXH
HHHHHHH
MBMBMBM` }
];

const LEVELS = RAW_LEVELS.map((lv, idx) => {
    const parsed = parseLayout(lv.layout);
    return {
        index: idx + 1,
        name: lv.name,
        rows: parsed.rows,
        cols: parsed.cols,
        grid: parsed.grid,
        ballSpeed: lv.ballSpeed,
        paddleWidth: lv.paddleWidth,
        targetScore: lv.targetScore,
        targetTimeSec: lv.targetTimeSec
    };
});

// Seeded RNG (mulberry32) for daily challenge.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seedFromDateString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function buildDailyLevel(dateStr) {
    const rand = mulberry32(seedFromDateString(dateStr));
    const rows = 5;
    const cols = 7;
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const v = rand();
            let t;
            if (v < 0.55) t = 1;
            else if (v < 0.75) t = 2;
            else if (v < 0.85) t = 4;
            else if (v < 0.92) t = 3;
            else if (v < 0.96) t = 5;
            else t = 6;
            row.push(t);
        }
        grid.push(row);
    }
    return {
        index: 0,
        name: 'Daily ' + dateStr,
        rows, cols, grid,
        ballSpeed: 5.8,
        paddleWidth: 110,
        targetScore: 1200,
        targetTimeSec: 80,
        daily: true,
        dateStr
    };
}

function todayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
}

window.BB_LEVELS = LEVELS;
window.BB_buildDailyLevel = buildDailyLevel;
window.BB_todayDateStr = todayDateStr;
