// ===== GAME STATE =====
const GameState = {
    SPLASH: 'splash',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver'
};

class ColorClash {
    constructor() {
        this.state = GameState.SPLASH;
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.level = 1;
        this.combo = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        
        // Game mechanics - MUCH faster now
        this.baseSpeed = 12.0;  // Increased from 6.0
        this.currentSpeed = this.baseSpeed;
        this.barPositionLeft = 0;
        this.barPositionRight = 0;
        this.isMoving = false;
        this.hasScored = false;
        this.leftDirection = 1;  // 1 = moving right, -1 = moving left (bouncing)
        this.rightDirection = -1; // -1 = moving left, 1 = moving right (bouncing)
        this.bounceCount = 0; // Track number of bounces
        
        // Color management
        this.leftColor = null;
        this.rightColor = null;
        
        // Animation frame
        this.animationFrame = null;
        
        // DOM elements
        this.initializeDOM();
        this.setupEventListeners();
        this.updateHighScoreDisplay();
    }
    
    initializeDOM() {
        // Screens - map to match GameState values
        this.screens = {
            splash: document.getElementById('splash'),
            playing: document.getElementById('game'),  // 'playing' state uses 'game' element
            gameOver: document.getElementById('gameOver')
        };
        
        // Game elements - with null checks
        this.leftBar = document.getElementById('leftBar');
        this.rightBar = document.getElementById('rightBar');
        this.tapArea = document.getElementById('tapArea');
        this.centerZone = document.getElementById('centerZone');
        
        // Verify critical elements exist
        if (!this.leftBar || !this.rightBar || !this.tapArea) {
            console.error('Critical game elements not found!');
        }
        
        // UI elements
        this.currentScoreEl = document.getElementById('currentScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.splashHighScoreEl = document.getElementById('splashHighScore');
        this.comboTextEl = document.getElementById('comboText');
        this.feedbackEl = document.getElementById('feedback');
        this.finalScoreEl = document.getElementById('finalScore');
        this.newRecordEl = document.getElementById('newRecord');
        
        // Stats
        this.perfectCountEl = document.getElementById('perfectCount');
        this.goodCountEl = document.getElementById('goodCount');
        this.okayCountEl = document.getElementById('okayCount');
    }
    
    setupEventListeners() {
        // Start button
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
        }
        
        // Tap area (main gameplay) - use both click and touch events
        if (this.tapArea) {
            this.tapArea.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTap();
            });
            
            // Touch events for mobile
            this.tapArea.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTap();
            }, { passive: false });
            
            this.tapArea.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
        }
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Menu button
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.showScreen(GameState.SPLASH);
        });
        
        // Info button and modal
        const infoBtn = document.getElementById('infoBtn');
        const infoModal = document.getElementById('infoModal');
        const closeModal = document.getElementById('closeModal');
        
        infoBtn.addEventListener('click', () => {
            infoModal.classList.remove('hidden');
        });
        
        closeModal.addEventListener('click', () => {
            infoModal.classList.add('hidden');
        });
        
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.classList.add('hidden');
            }
        });
    }
    
    // ===== COLOR GENERATION =====
    generateColorPair() {
        // Choose a random color family
        const families = [
            { name: 'blue', baseHue: 210, range: 30 },
            { name: 'red', baseHue: 0, range: 20 },
            { name: 'green', baseHue: 120, range: 30 },
            { name: 'purple', baseHue: 270, range: 30 },
            { name: 'orange', baseHue: 30, range: 20 },
            { name: 'cyan', baseHue: 180, range: 25 },
            { name: 'pink', baseHue: 330, range: 20 }
        ];
        
        const family = families[Math.floor(Math.random() * families.length)];
        
        // Generate base hue within family range
        const baseHue = family.baseHue + (Math.random() - 0.5) * family.range;
        
        // Calculate difficulty-based variation
        // Early levels: bigger differences (easier)
        // Later levels: smaller differences (harder)
        const maxDifference = Math.max(5, 25 - this.level * 2);
        const hueDifference = Math.random() * maxDifference;
        
        // Randomly decide which direction to shift
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        // Generate two hues
        const hue1 = (baseHue + 360) % 360;
        const hue2 = (baseHue + (hueDifference * direction) + 360) % 360;
        
        // Saturation and lightness with slight variations
        const baseSat = 60 + Math.random() * 30;
        const baseLit = 50 + Math.random() * 15;
        
        const sat1 = baseSat + (Math.random() - 0.5) * 10;
        const sat2 = baseSat + (Math.random() - 0.5) * 10;
        const lit1 = baseLit + (Math.random() - 0.5) * 10;
        const lit2 = baseLit + (Math.random() - 0.5) * 10;
        
        this.leftColor = { h: hue1, s: sat1, l: lit1 };
        this.rightColor = { h: hue2, s: sat2, l: lit2 };
        
        // Store the actual color difference for scoring
        this.colorDifference = this.calculateColorDifference(this.leftColor, this.rightColor);
        
        // Apply colors to bars
        this.leftBar.style.background = this.hslToString(this.leftColor);
        this.rightBar.style.background = this.hslToString(this.rightColor);
    }
    
    hslToString(color) {
        return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    }
    
    calculateColorDifference(color1, color2) {
        // Calculate perceptual color difference using Delta E (simplified)
        const dH = Math.min(Math.abs(color1.h - color2.h), 360 - Math.abs(color1.h - color2.h));
        const dS = Math.abs(color1.s - color2.s);
        const dL = Math.abs(color1.l - color2.l);
        
        // Weighted euclidean distance
        return Math.sqrt((dH * 0.5) ** 2 + (dS * 0.3) ** 2 + (dL * 0.2) ** 2);
    }
    
    // ===== GAME MECHANICS =====
    startGame() {
        this.state = GameState.PLAYING;
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;
        this.currentSpeed = this.baseSpeed;
        
        this.updateScoreDisplay();
        this.showScreen(GameState.PLAYING);
        this.updateLevelDisplay();
        
        // Start first round
        this.startRound();
    }
    
    startRound() {
        this.isMoving = true;
        this.hasScored = false;
        this.barPositionLeft = 0;
        this.barPositionRight = 0;
        this.leftDirection = 1;  // Reset to moving right
        this.rightDirection = -1; // Reset to moving left
        this.bounceCount = 0; // Reset bounce count

        // Cancel any existing animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Generate new colors
        this.generateColorPair();

        // Reset bar positions - both bars start off-screen and move toward center
        if (this.leftBar) {
            this.leftBar.style.transform = `translateX(-100px)`; // Left bar starts off-screen left
        }
        if (this.rightBar) {
            this.rightBar.style.transform = `translateX(${window.innerWidth + 100}px)`; // Right bar starts off-screen right
        }

        // Clear feedback
        if (this.feedbackEl) {
            this.feedbackEl.textContent = '';
            this.feedbackEl.className = 'feedback';
        }

        // Update combo display
        if (this.comboTextEl) {
            if (this.combo > 1) {
                this.comboTextEl.textContent = `${this.combo}x COMBO`;
            } else {
                this.comboTextEl.textContent = '';
            }
        }

        // Start animation immediately
        this.animate();
    }
    
    animate() {
        if (!this.isMoving || !this.leftBar || !this.rightBar) {
            return;
        }

        const screenWidth = window.innerWidth;

        // Move left bar (normally moves right: +speed, bounces left: -speed)
        if (this.leftDirection === 1) {
            this.barPositionLeft += this.currentSpeed;
        } else {
            this.barPositionLeft -= this.currentSpeed;
        }

        // Move right bar (normally moves left: +speed, bounces right: -speed)
        if (this.rightDirection === -1) {
            this.barPositionRight += this.currentSpeed;
        } else {
            this.barPositionRight -= this.currentSpeed;
        }

        // Calculate positions
        const leftBarX = -100 + this.barPositionLeft;
        const rightBarX = screenWidth + 100 - this.barPositionRight;

        // Apply transforms
        this.leftBar.style.transform = `translateX(${leftBarX}px)`;
        this.rightBar.style.transform = `translateX(${rightBarX}px)`;

        // Check for wall bounces and reverse direction
        // Left bar hits right wall (off-screen right) - bounce back
        if (leftBarX > screenWidth + 100 && this.leftDirection === 1) {
            this.leftDirection = -1;
            this.bounceCount++;
            this.currentSpeed += 0.3; // Increase speed slightly on bounce
            console.log(`Bounce #${this.bounceCount}! New speed: ${this.currentSpeed.toFixed(1)}`);
        }

        // Left bar returns to normal direction (moving toward center again)
        if (leftBarX < screenWidth / 2 && this.leftDirection === -1) {
            this.leftDirection = 1;
        }

        // Right bar hits left wall (off-screen left) - bounce back
        if (rightBarX < -100 && this.rightDirection === -1) {
            this.rightDirection = 1;
            this.bounceCount++;
            this.currentSpeed += 0.3; // Increase speed slightly on bounce
            console.log(`Bounce #${this.bounceCount}! New speed: ${this.currentSpeed.toFixed(1)}`);
        }

        // Right bar returns to normal direction (moving toward center again)
        if (rightBarX > screenWidth / 2 && this.rightDirection === 1) {
            this.rightDirection = -1;
        }

        // Check if bars have passed each other completely without being tapped
        const leftBarCenter = leftBarX + 30; // 30 = half of 60px bar width
        const rightBarCenter = rightBarX - 30;

        // Game over if bars have completely passed each other without tapping
        if (!this.hasScored && leftBarCenter > screenWidth && rightBarCenter < 0) {
            this.handleMiss();
            return;
        }

        // Continue animation
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    handleTap() {
        if (this.state !== GameState.PLAYING || !this.isMoving || this.hasScored) return;
        
        this.hasScored = true;
        this.isMoving = false;
        
        // Cancel animation to freeze bars in place
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Use getBoundingClientRect() for precise overlap detection
        const leftRect = this.leftBar.getBoundingClientRect();
        const rightRect = this.rightBar.getBoundingClientRect();
        const centerZoneRect = this.centerZone.getBoundingClientRect();

        // Debug info
        console.log('Tap positions:', {
            leftBar: { left: Math.round(leftRect.left), right: Math.round(leftRect.right), width: Math.round(leftRect.width) },
            rightBar: { left: Math.round(rightRect.left), right: Math.round(rightRect.right), width: Math.round(rightRect.width) },
            centerZone: { left: Math.round(centerZoneRect.left), right: Math.round(centerZoneRect.right), width: Math.round(centerZoneRect.width) }
        });

        // Calculate actual overlap amount (pixels)
        const overlapLeft = Math.max(leftRect.left, rightRect.left);
        const overlapRight = Math.min(leftRect.right, rightRect.right);
        const overlapPixels = Math.max(0, overlapRight - overlapLeft);
        
        // Maximum possible overlap (smaller bar's width)
        const barWidth = Math.min(leftRect.width, rightRect.width);
        
        // Overlap percentage (0-100)
        const overlapPercentage = barWidth > 0 ? Math.round((overlapPixels / barWidth) * 100) : 0;

        // Bar centers
        const leftBarCenter = leftRect.left + leftRect.width / 2;
        const rightBarCenter = rightRect.left + rightRect.width / 2;
        
        // Check if BOTH bars are within the center zone
        const leftBarInZone = leftBarCenter >= centerZoneRect.left && leftBarCenter <= centerZoneRect.right;
        const rightBarInZone = rightBarCenter >= centerZoneRect.left && rightBarCenter <= centerZoneRect.right;
        
        // Check if there's any overlap at all
        const barsOverlapping = leftRect.right > rightRect.left && leftRect.left < rightRect.right;

        console.log('Tap analysis:', {
            overlapPixels: Math.round(overlapPixels),
            barWidth: Math.round(barWidth),
            overlapPercentage,
            leftBarInZone,
            rightBarInZone,
            barsOverlapping
        });

        // Determine score based on overlap and position
        if (barsOverlapping && leftBarInZone && rightBarInZone) {
            // Bars are overlapping AND both in center zone - score based on percentage
            this.evaluateTap(overlapPercentage, 'overlapping');
        } else if (!barsOverlapping && leftBarInZone && rightBarInZone) {
            // Both bars in center zone but NOT overlapping - award 75 points
            this.evaluateTap(0, 'touching');
        } else {
            // Not a valid tap - miss
            this.handleMiss();
        }
    }
    
    evaluateTap(overlapPercentage, tapType) {
        // Scoring with increments of 5
        let points = 0;
        let feedback = '';

        if (tapType === 'overlapping') {
            // Bars are overlapping - score scales with overlap percentage
            // Round to nearest 5
            points = Math.round((overlapPercentage / 100) * 100 / 5) * 5;
            
            // Minimum 5 points for any overlap
            if (points === 0 && overlapPercentage > 0) {
                points = 5;
            }

            // Set feedback based on overlap amount
            if (overlapPercentage >= 90) {
                feedback = `PERFECT! +${points}`;
                this.stats.perfect++;
                this.combo++;
            } else if (overlapPercentage >= 70) {
                feedback = `GREAT! +${points}`;
                this.stats.good++;
                this.combo++;
            } else if (overlapPercentage >= 50) {
                feedback = `GOOD! +${points}`;
                this.stats.good++;
                this.combo++;
            } else if (overlapPercentage > 0) {
                feedback = `OKAY! +${points}`;
                this.stats.okay++;
                this.combo = 0;
            }
        } else if (tapType === 'touching') {
            // Both bars in center zone but NOT overlapping
            // Award 75 points (increments of 5: 75 = 15*5)
            points = 75;
            feedback = 'CLOSE! +75';
            this.stats.okay++;
            this.combo = 0;
        }

        // Apply combo multiplier
        if (this.combo > 1) {
            const bonusMultiplier = Math.min(this.combo * 0.1, 2); // Max 2x multiplier
            points = Math.floor(points * (1 + bonusMultiplier));
        }

        this.score += points;
        this.successfulRounds++;
        this.updateScoreDisplay();

        // Show feedback with clear point display
        this.feedbackEl.textContent = `${feedback}`;
        this.feedbackEl.className = 'feedback perfect';
        
        // Level progression system
        const roundsForLevel = [3, 5, 7, 10, 12, 15, 20]; // Rounds needed to advance each level
        const currentLevelIndex = this.level - 1;
        const roundsNeeded = roundsForLevel[currentLevelIndex] || 25; // Default to 25 if beyond array
        
        if (this.successfulRounds >= roundsNeeded && this.level < 10) {
            // Level up!
            this.levelUp();
        }
        
        // Haptic feedback (if available)
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
        
        // Next round after delay
        setTimeout(() => {
            this.startRound();
        }, 800);
    }
    
    levelUp() {
        this.level++;
        this.successfulRounds = 0;
        
        // Increase speed based on level
        this.currentSpeed = this.baseSpeed + (this.level - 1) * 0.8;
        
        // Show level up message
        this.feedbackEl.textContent = `LEVEL ${this.level}!`;
        this.feedbackEl.className = 'feedback perfect';
        this.updateLevelDisplay();
        
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    updateLevelDisplay() {
        const levelDisplayEl = document.getElementById('levelDisplay');
        if (levelDisplayEl) {
            levelDisplayEl.textContent = `LEVEL ${this.level}`;
        }
    }
    
    handleMiss() {
        this.isMoving = false;
        this.stats.misses++;
        this.combo = 0;
        
        // Show miss feedback
        this.feedbackEl.textContent = 'MISS!';
        this.feedbackEl.className = 'feedback miss';
        
        // Haptic feedback (if available)
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
        
        // Game over after delay
        setTimeout(() => {
            this.gameOver();
        }, 1000);
    }
    
    gameOver() {
        this.state = GameState.GAME_OVER;
        
        // Cancel animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Update high score
        const isNewRecord = this.score > this.highScore;
        if (isNewRecord) {
            this.highScore = this.score;
            this.saveHighScore(this.highScore);
            this.newRecordEl.classList.remove('hidden');
        } else {
            this.newRecordEl.classList.add('hidden');
        }
        
        // Update game over screen
        this.finalScoreEl.textContent = this.score;
        this.perfectCountEl.textContent = this.stats.perfect;
        this.goodCountEl.textContent = this.stats.good;
        this.okayCountEl.textContent = this.stats.okay;
        
        this.showScreen(GameState.GAME_OVER);
    }
    
    // ===== UI UPDATES =====
    showScreen(screen) {
        // Ensure all screens exist before manipulating
        Object.values(this.screens).forEach(s => {
            if (s) s.classList.remove('active');
        });
        
        const targetScreen = this.screens[screen];
        if (targetScreen) {
            targetScreen.classList.add('active');
        } else {
            console.error(`Screen '${screen}' not found in screens object`);
        }
        
        // Show/hide info button
        const infoBtn = document.getElementById('infoBtn');
        if (infoBtn) {
            if (screen === GameState.PLAYING) {
                infoBtn.classList.remove('hidden');
            } else {
                infoBtn.classList.add('hidden');
            }
        }
    }
    
    updateScoreDisplay() {
        this.currentScoreEl.textContent = this.score;
        this.bestScoreEl.textContent = this.highScore;
    }
    
    updateHighScoreDisplay() {
        this.splashHighScoreEl.textContent = this.highScore;
        this.bestScoreEl.textContent = this.highScore;
    }
    
    // ===== STORAGE =====
    loadHighScore() {
        const saved = localStorage.getItem('colorClashHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    saveHighScore(score) {
        localStorage.setItem('colorClashHighScore', score.toString());
        this.updateHighScoreDisplay();
    }
}

// ===== INITIALIZE GAME =====
let game;

window.addEventListener('DOMContentLoaded', () => {
    try {
        game = new ColorClash();
        window.game = game; // Expose to window for debugging
        
        // Register service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    } catch (error) {
        console.error('Game initialization error:', error);
        alert('Error loading game. Please check the console for details.');
    }
});

// Prevent accidental page refresh/navigation
window.addEventListener('beforeunload', (e) => {
    if (game && game.state === GameState.PLAYING) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    if (game && game.state === GameState.PLAYING) {
        // Pause briefly during orientation change
        game.isMoving = false;
        setTimeout(() => {
            if (game.state === GameState.PLAYING) {
                game.isMoving = true;
                game.animate();
            }
        }, 300);
    }
});

