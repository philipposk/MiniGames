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
        this.maxSpeed = this.baseSpeed * 8; // Explosion threshold - 8x base speed
        this.explosionTriggered = false;
        
        // Color management
        this.leftColor = null;
        this.rightColor = null;
        this.middleColor = null;
        
        // Level variation properties
        this.gameMode = 'classic'; // 'classic', 'speed', 'flash', 'vertical', 'size', 'multi'
        this.colorFlashInterval = null;
        this.barSize = 60; // For size variation
        this.verticalPosition = 0;
        this.verticalDirection = 1;
        
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
        this.middleBar = document.getElementById('middleBar');
        this.tapArea = document.getElementById('tapArea');
        this.centerZone = document.getElementById('centerZone');
        this.instructionEl = document.getElementById('instruction');
        
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
    
    generateColorTriple() {
        // Generate three colors - two matching, one different
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
        const baseHue = family.baseHue + (Math.random() - 0.5) * family.range;
        const maxDifference = Math.max(5, 20 - this.level * 1.5);
        const hueDifference = Math.random() * maxDifference;
        
        const baseSat = 60 + Math.random() * 30;
        const baseLit = 50 + Math.random() * 15;
        
        // Two matching colors
        const matchingHue = (baseHue + 360) % 360;
        this.leftColor = { h: matchingHue, s: baseSat, l: baseLit };
        this.middleColor = { h: matchingHue, s: baseSat + (Math.random() - 0.5) * 5, l: baseLit + (Math.random() - 0.5) * 5 };
        
        // One different color
        const differentHue = (baseHue + hueDifference + 360) % 360;
        this.rightColor = { h: differentHue, s: baseSat, l: baseLit };
        
        // Randomly assign which bar gets which color
        const positions = ['left', 'middle', 'right'];
        const shuffled = positions.sort(() => Math.random() - 0.5);
        
        // Apply colors
        const colors = [this.leftColor, this.middleColor, this.rightColor];
        this.leftBar.style.background = this.hslToString(colors[shuffled.indexOf('left')]);
        this.middleBar.style.background = this.hslToString(colors[shuffled.indexOf('middle')]);
        this.rightBar.style.background = this.hslToString(colors[shuffled.indexOf('right')]);
        
        // Store correct matching pair
        this.matchingPair = shuffled.filter((pos, idx) => colors[idx].h === matchingHue);
    }
    
    startColorFlash() {
        // Change colors rapidly every 300ms
        this.colorFlashInterval = setInterval(() => {
            if (this.isMoving && !this.hasScored) {
                this.generateColorPair();
            }
        }, 300);
    }
    
    initializeSizeVariation() {
        // Randomly set bar sizes (between 40px and 80px)
        const size1 = 40 + Math.random() * 40;
        const size2 = 40 + Math.random() * 40;
        
        this.leftBar.style.width = `${size1}px`;
        this.leftBar.style.height = `${size1}px`;
        this.rightBar.style.width = `${size2}px`;
        this.rightBar.style.height = `${size2}px`;
        
        // Store sizes for matching check
        this.leftBarSize = size1;
        this.rightBarSize = size2;
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
        this.level = 7; // TEST: Start at level 7
        this.combo = 0;
        this.stats = { perfect: 0, good: 0, okay: 0, misses: 0 };
        this.successfulRounds = 0;
        this.currentSpeed = this.baseSpeed;
        this.gameMode = 'flash'; // Level 7 is flash mode
        
        // Set up level 7 properties (color flash)
        this.currentSpeed = this.baseSpeed * 1.5;
        if (this.instructionEl) {
            this.instructionEl.textContent = 'COLOR FLASH - COLORS CHANGE FAST!';
        }
        
        this.updateScoreDisplay();
        this.showScreen(GameState.PLAYING);
        this.updateLevelDisplay();
        this.resetVariationProperties();
        
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
        this.verticalPosition = 0;
        this.verticalDirection = 1;
        this.explosionTriggered = false;
        
        // Reset bar transitions and opacity
        if (this.leftBar) {
            this.leftBar.style.transition = 'transform 0.05s linear';
            this.leftBar.style.opacity = '1';
        }
        if (this.rightBar) {
            this.rightBar.style.transition = 'transform 0.05s linear';
            this.rightBar.style.opacity = '1';
        }
        if (this.middleBar) {
            this.middleBar.style.transition = 'transform 0.05s linear';
            this.middleBar.style.opacity = '1';
        }

        // Cancel any existing animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Clear color flash interval if exists
        if (this.colorFlashInterval) {
            clearInterval(this.colorFlashInterval);
            this.colorFlashInterval = null;
        }

        // Generate new colors based on game mode
        if (this.gameMode === 'multi') {
            this.generateColorTriple();
        } else {
            this.generateColorPair();
        }
        
        // Start color flash for flash mode
        if (this.gameMode === 'flash') {
            this.startColorFlash();
        }
        
        // Initialize size variation
        if (this.gameMode === 'size') {
            this.initializeSizeVariation();
        }

        // Reset bar positions based on game mode
        if (this.gameMode === 'vertical') {
            // Vertical mode: bars start from top and bottom, centered horizontally
            const screenWidth = window.innerWidth;
            const centerX = screenWidth / 2 - 30; // 30 = half bar width
            if (this.leftBar) {
                // Left bar starts at top, centered horizontally
                this.leftBar.style.left = `${centerX}px`;
                this.leftBar.style.top = '-100px';
                this.leftBar.style.transform = 'none';
            }
            if (this.rightBar) {
                // Right bar starts at bottom, centered horizontally
                this.rightBar.style.left = `${centerX}px`;
                this.rightBar.style.top = `${window.innerHeight + 100}px`;
                this.rightBar.style.transform = 'none';
            }
        } else {
            // Horizontal mode (classic, speed, flash, size, multi)
            // Reset vertical positioning styles
            if (this.leftBar) {
                this.leftBar.style.left = '0';
                this.leftBar.style.top = '';
                this.leftBar.style.transform = `translateX(-100px)`;
            }
            if (this.rightBar) {
                this.rightBar.style.left = '0';
                this.rightBar.style.top = '';
                this.rightBar.style.transform = `translateX(${window.innerWidth + 100}px)`;
            }
        }
        
        // Position middle bar for multi mode
        if (this.gameMode === 'multi' && this.middleBar) {
            this.middleBar.style.transform = `translate(-50%, -50%)`;
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
        const screenHeight = window.innerHeight;

        if (this.gameMode === 'vertical') {
            // VERTICAL MODE: Bars move up and down toward each other
            this.verticalPosition += this.currentSpeed;
            
            const centerX = screenWidth / 2 - 30; // 30 = half bar width
            
            // Left bar moves down from top
            let leftBarY = -100 + this.verticalPosition;
            // Right bar moves up from bottom
            let rightBarY = screenHeight + 100 - this.verticalPosition;
            
            // Check for wall bounces in vertical mode and reverse
            if (leftBarY > screenHeight + 100) {
                // Left bar hit bottom - bounce back up
                const overshoot = leftBarY - (screenHeight + 100);
                this.verticalPosition = screenHeight + 200 - overshoot;
                leftBarY = screenHeight + 100 - overshoot;
                this.bounceCount++;
                this.currentSpeed += this.baseSpeed * 0.5;
                this.handleBounce();
            }
            
            if (rightBarY < -100) {
                // Right bar hit top - bounce back down
                const overshoot = -100 - rightBarY;
                this.verticalPosition = -200 + overshoot;
                rightBarY = -100 + overshoot;
                this.bounceCount++;
                this.currentSpeed += this.baseSpeed * 0.5;
                this.handleBounce();
            }
            
            // Apply positions directly using top property
            if (this.leftBar) {
                this.leftBar.style.left = `${centerX}px`;
                this.leftBar.style.top = `${leftBarY}px`;
            }
            if (this.rightBar) {
                this.rightBar.style.left = `${centerX}px`;
                this.rightBar.style.top = `${rightBarY}px`;
            }
            
            // Check for explosion - if speed exceeds max, trigger explosion
            if (this.currentSpeed >= this.maxSpeed && !this.explosionTriggered) {
                this.triggerExplosion();
                return;
            }
        } else {
            // HORIZONTAL MODE: Original movement
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
            
            // For multi mode, middle bar stays in center
            if (this.gameMode === 'multi' && this.middleBar) {
                this.middleBar.style.transform = `translate(-50%, -50%)`;
            }

            // Check for wall bounces and reverse direction (for all horizontal modes)
            if (this.gameMode === 'classic' || this.gameMode === 'speed' || this.gameMode === 'flash' || this.gameMode === 'size' || this.gameMode === 'multi') {
                // Left bar hits right wall (off-screen right) - bounce back
                if (leftBarX > screenWidth + 100 && this.leftDirection === 1) {
                    this.leftDirection = -1;
                    this.bounceCount++;
                    this.currentSpeed += this.baseSpeed * 0.5; // Increase speed more aggressively on bounce
                    this.handleBounce();
                }

                // Left bar returns to normal direction (moving toward center again)
                if (leftBarX < screenWidth / 2 && this.leftDirection === -1) {
                    this.leftDirection = 1;
                }

                // Right bar hits left wall (off-screen left) - bounce back
                if (rightBarX < -100 && this.rightDirection === -1) {
                    this.rightDirection = 1;
                    this.bounceCount++;
                    this.currentSpeed += this.baseSpeed * 0.5; // Increase speed more aggressively on bounce
                    this.handleBounce();
                }

                // Right bar returns to normal direction (moving toward center again)
                if (rightBarX > screenWidth / 2 && this.rightDirection === 1) {
                    this.rightDirection = -1;
                }
            }

            // Check for explosion - if speed exceeds max, trigger explosion
            if (this.currentSpeed >= this.maxSpeed && !this.explosionTriggered) {
                this.triggerExplosion();
                return;
            }
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
        
        // Stop color flash if active
        if (this.colorFlashInterval) {
            clearInterval(this.colorFlashInterval);
            this.colorFlashInterval = null;
        }
        
        // Handle multi-box mode (level 10)
        if (this.gameMode === 'multi') {
            this.handleMultiTap();
            return;
        }
        
        // Use getBoundingClientRect() for precise overlap detection
        const leftRect = this.leftBar.getBoundingClientRect();
        const rightRect = this.rightBar.getBoundingClientRect();
        const centerZoneRect = this.centerZone.getBoundingClientRect();

        // For vertical mode, check vertical overlap
        if (this.gameMode === 'vertical') {
            const leftBarCenterY = leftRect.top + leftRect.height / 2;
            const rightBarCenterY = rightRect.top + rightRect.height / 2;
            const centerZoneCenterY = centerZoneRect.top + centerZoneRect.height / 2;
            const centerZoneTop = centerZoneRect.top;
            const centerZoneBottom = centerZoneRect.bottom;
            
            const leftBarInZone = leftBarCenterY >= centerZoneTop && leftBarCenterY <= centerZoneBottom;
            const rightBarInZone = rightBarCenterY >= centerZoneTop && rightBarCenterY <= centerZoneBottom;
            
            // Calculate vertical overlap
            const overlapTop = Math.max(leftRect.top, rightRect.top);
            const overlapBottom = Math.min(leftRect.bottom, rightRect.bottom);
            const overlapPixels = Math.max(0, overlapBottom - overlapTop);
            const barHeight = Math.min(leftRect.height, rightRect.height);
            const overlapPercentage = barHeight > 0 ? Math.round((overlapPixels / barHeight) * 100) : 0;
            
            // Check color match
            const colorMatch = this.calculateColorDifference(this.leftColor, this.rightColor) < 15;
            
            if (leftBarInZone && rightBarInZone && colorMatch) {
                this.evaluateTap(overlapPercentage, 'overlapping');
            } else {
                this.handleMiss();
            }
            return;
        }

        // Horizontal mode (classic, speed, flash, size)
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
        
        // For size mode, also check if sizes match
        if (this.gameMode === 'size') {
            const sizeMatch = Math.abs(this.leftBarSize - this.rightBarSize) < 5; // Within 5px
            const colorMatch = this.calculateColorDifference(this.leftColor, this.rightColor) < 15;
            
            if (barsOverlapping && leftBarInZone && rightBarInZone && sizeMatch && colorMatch) {
                this.evaluateTap(overlapPercentage, 'overlapping');
            } else {
                this.handleMiss();
            }
            return;
        }

        // Classic, speed, and flash modes
        // Determine score based on overlap and position
        console.log('Tap detection:', {
            barsOverlapping,
            leftBarInZone,
            rightBarInZone,
            overlapPercentage,
            leftBarCenter: Math.round(leftBarCenter),
            rightBarCenter: Math.round(rightBarCenter),
            centerZoneLeft: Math.round(centerZoneRect.left),
            centerZoneRight: Math.round(centerZoneRect.right)
        });
        
        if (barsOverlapping && leftBarInZone && rightBarInZone) {
            // Bars are overlapping AND both in center zone - score based on percentage
            this.evaluateTap(overlapPercentage, 'overlapping');
        } else if (!barsOverlapping && leftBarInZone && rightBarInZone) {
            // Both bars in center zone but NOT overlapping - award 75 points
            this.evaluateTap(0, 'touching');
        } else {
            // For speed mode, be more lenient - if boxes are close to center zone, still score
            if (this.gameMode === 'speed') {
                const leftBarNearZone = Math.abs(leftBarCenter - (centerZoneRect.left + centerZoneRect.width / 2)) < 100;
                const rightBarNearZone = Math.abs(rightBarCenter - (centerZoneRect.left + centerZoneRect.width / 2)) < 100;
                
                if (barsOverlapping && (leftBarNearZone || rightBarNearZone)) {
                    // In speed mode, give points if overlapping and near center
                    this.evaluateTap(Math.max(overlapPercentage, 50), 'overlapping');
                } else {
                    this.handleMiss();
                }
            } else {
                // Not a valid tap - miss
                this.handleMiss();
            }
        }
    }
    
    handleMultiTap() {
        // Check if all three boxes are in center zone and two match
        const leftRect = this.leftBar.getBoundingClientRect();
        const middleRect = this.middleBar.getBoundingClientRect();
        const rightRect = this.rightBar.getBoundingClientRect();
        const centerZoneRect = this.centerZone.getBoundingClientRect();
        
        const leftCenter = leftRect.left + leftRect.width / 2;
        const middleCenter = middleRect.left + middleRect.width / 2;
        const rightCenter = rightRect.left + rightRect.width / 2;
        
        const leftInZone = leftCenter >= centerZoneRect.left && leftCenter <= centerZoneRect.right;
        const middleInZone = middleCenter >= centerZoneRect.left && middleCenter <= centerZoneRect.right;
        const rightInZone = rightCenter >= centerZoneRect.left && rightCenter <= centerZoneRect.right;
        
        // Get current colors from DOM
        const leftBg = window.getComputedStyle(this.leftBar).backgroundColor;
        const middleBg = window.getComputedStyle(this.middleBar).backgroundColor;
        const rightBg = window.getComputedStyle(this.rightBar).backgroundColor;
        
        // Check which two match
        const leftMiddleMatch = this.colorsMatch(leftBg, middleBg);
        const leftRightMatch = this.colorsMatch(leftBg, rightBg);
        const middleRightMatch = this.colorsMatch(middleBg, rightBg);
        
        if (leftInZone && middleInZone && rightInZone) {
            if (leftMiddleMatch || leftRightMatch || middleRightMatch) {
                // At least two match - success!
                this.evaluateTap(90, 'overlapping');
            } else {
                // None match - miss
                this.handleMiss();
            }
        } else {
            // Not all in zone - miss
            this.handleMiss();
        }
    }
    
    colorsMatch(color1, color2) {
        // Simple color matching by comparing RGB values
        // Convert to RGB if needed and compare
        return Math.abs(this.colorToHue(color1) - this.colorToHue(color2)) < 10;
    }
    
    colorToHue(rgbString) {
        // Extract RGB values and convert to hue approximation
        const match = rgbString.match(/\d+/g);
        if (match && match.length >= 3) {
            const r = parseInt(match[0]) / 255;
            const g = parseInt(match[1]) / 255;
            const b = parseInt(match[2]) / 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            if (delta === 0) return 0;
            let h = 0;
            if (max === r) h = ((g - b) / delta) % 6;
            else if (max === g) h = (b - r) / delta + 2;
            else h = (r - g) / delta + 4;
            return h * 60;
        }
        return 0;
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
        
        // Gradually increase speed for variation levels to help players adapt
        if (this.gameMode === 'speed' && this.successfulRounds > 0) {
            // Speed mode: gradually increase from 1.5x to 2.5x over first 3 rounds
            const speedIncrease = Math.min(this.successfulRounds * 0.3, 1.0);
            this.currentSpeed = this.baseSpeed * (1.5 + speedIncrease);
        } else if (this.gameMode === 'flash' && this.successfulRounds > 0) {
            // Flash mode: gradually increase from 1.0x to 1.5x
            const speedIncrease = Math.min(this.successfulRounds * 0.15, 0.5);
            this.currentSpeed = this.baseSpeed * (1.0 + speedIncrease);
        } else if (this.gameMode === 'vertical' && this.successfulRounds > 0) {
            // Vertical mode: gradually increase from 1.2x to 1.8x
            const speedIncrease = Math.min(this.successfulRounds * 0.2, 0.6);
            this.currentSpeed = this.baseSpeed * (1.2 + speedIncrease);
        } else if (this.gameMode === 'size' && this.successfulRounds > 0) {
            // Size mode: gradually increase from 1.0x to 1.5x
            const speedIncrease = Math.min(this.successfulRounds * 0.15, 0.5);
            this.currentSpeed = this.baseSpeed * (1.0 + speedIncrease);
        } else if (this.gameMode === 'multi' && this.successfulRounds > 0) {
            // Multi mode: gradually increase from 1.0x to 1.2x
            const speedIncrease = Math.min(this.successfulRounds * 0.05, 0.2);
            this.currentSpeed = this.baseSpeed * (1.0 + speedIncrease);
        }

        // Show feedback with clear point display
        this.feedbackEl.textContent = `${feedback}`;
        this.feedbackEl.className = 'feedback perfect';
        
        // Level progression system - 10 levels total
        const roundsForLevel = [3, 5, 7, 10, 12, 8, 8, 8, 8, 10]; // Rounds needed for each level (1-10)
        const currentLevelIndex = this.level - 1;
        const roundsNeeded = roundsForLevel[currentLevelIndex] || 10; // Default to 10 if beyond array
        
        console.log(`Level ${this.level}: ${this.successfulRounds}/${roundsNeeded} rounds completed`);
        
        if (this.successfulRounds >= roundsNeeded && this.level < 10) {
            // Level up!
            console.log(`Leveling up from ${this.level} to ${this.level + 1}`);
            this.levelUp();
            
            // Wait longer after level up to show the description (especially for new variations)
            const waitTime = (this.level >= 6 && this.level <= 10) ? 3000 : 1500; // 3 seconds for new variations
            
            setTimeout(() => {
                // Reset feedback styling before starting round
                if (this.feedbackEl) {
                    this.feedbackEl.style.fontSize = '';
                    this.feedbackEl.style.lineHeight = '';
                    this.feedbackEl.style.whiteSpace = '';
                }
                this.startRound();
            }, waitTime);
            return; // Don't continue with the normal delay
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
        
        // Level descriptions for new variations
        const levelDescriptions = {
            6: 'SPEED CHALLENGE!\nBoxes move EXTRA FAST!\nTap when they match!',
            7: 'COLOR FLASH!\nColors change rapidly!\nMatch them quickly!',
            8: 'VERTICAL MODE!\nBoxes move UP & DOWN!\nTap when they meet!',
            9: 'SIZE VARIATION!\nMatch SIZE & COLOR!\nBoth must match!',
            10: 'MULTI-BOX!\nThree boxes appear!\nMatch all three!'
        };
        
        // Determine game mode based on level
        if (this.level <= 5) {
            this.gameMode = 'classic';
            this.currentSpeed = this.baseSpeed + (this.level - 1) * 0.8;
        } else if (this.level === 6) {
            this.gameMode = 'speed';
            this.currentSpeed = this.baseSpeed * 1.5; // Start slower, will increase
            this.instructionEl.textContent = 'SPEED CHALLENGE - EXTRA FAST!';
        } else if (this.level === 7) {
            this.gameMode = 'flash';
            this.currentSpeed = this.baseSpeed * 1.0; // Start slower
            this.instructionEl.textContent = 'COLOR FLASH - COLORS CHANGE FAST!';
        } else if (this.level === 8) {
            this.gameMode = 'vertical';
            this.currentSpeed = this.baseSpeed * 1.2; // Start slower
            this.instructionEl.textContent = 'VERTICAL MODE - UP & DOWN!';
        } else if (this.level === 9) {
            this.gameMode = 'size';
            this.currentSpeed = this.baseSpeed * 1.0; // Start slower
            this.instructionEl.textContent = 'SIZE VARIATION - MATCH SIZE & COLOR!';
        } else if (this.level === 10) {
            this.gameMode = 'multi';
            this.currentSpeed = this.baseSpeed * 1.0; // Start slower
            this.instructionEl.textContent = 'MULTI-BOX - MATCH ALL THREE!';
        }
        
        // Reset variation-specific properties
        this.resetVariationProperties();
        
        // Show level up message with description for new variations
        if (levelDescriptions[this.level]) {
            this.feedbackEl.textContent = levelDescriptions[this.level];
            this.feedbackEl.className = 'feedback perfect';
            this.feedbackEl.style.fontSize = '18px';
            this.feedbackEl.style.lineHeight = '1.4';
            this.feedbackEl.style.whiteSpace = 'pre-line';
        } else {
            this.feedbackEl.textContent = `LEVEL ${this.level}!`;
            this.feedbackEl.className = 'feedback perfect';
            this.feedbackEl.style.fontSize = '';
            this.feedbackEl.style.lineHeight = '';
            this.feedbackEl.style.whiteSpace = '';
        }
        
        this.updateLevelDisplay();
        
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    resetVariationProperties() {
        // Reset all variation-specific properties
        if (this.colorFlashInterval) {
            clearInterval(this.colorFlashInterval);
            this.colorFlashInterval = null;
        }
        this.barSize = 60;
        this.verticalPosition = 0;
        this.verticalDirection = 1;
        
        // Show/hide middle bar
        if (this.middleBar) {
            if (this.gameMode === 'multi') {
                this.middleBar.classList.remove('hidden');
            } else {
                this.middleBar.classList.add('hidden');
            }
        }
        
        // Reset bar sizes
        if (this.leftBar) {
            this.leftBar.style.width = '60px';
            this.leftBar.style.height = '60px';
        }
        if (this.rightBar) {
            this.rightBar.style.width = '60px';
            this.rightBar.style.height = '60px';
        }
        if (this.middleBar) {
            this.middleBar.style.width = '60px';
            this.middleBar.style.height = '60px';
        }
    }
    
    updateLevelDisplay() {
        const levelDisplayEl = document.getElementById('levelDisplay');
        if (levelDisplayEl) {
            levelDisplayEl.textContent = `LEVEL ${this.level}`;
        }
    }
    
    handleBounce() {
        // Show bounce feedback
        if (this.feedbackEl) {
            this.feedbackEl.textContent = `BOUNCE! ${this.bounceCount}x - FASTER!`;
            this.feedbackEl.className = 'feedback good';
        }
        
        // Haptic feedback for bounce
        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }
        
        // Clear bounce message after a short time
        setTimeout(() => {
            if (this.feedbackEl && this.feedbackEl.textContent.includes('BOUNCE')) {
                this.feedbackEl.textContent = '';
            }
        }, 500);
    }
    
    triggerExplosion() {
        this.explosionTriggered = true;
        this.isMoving = false;
        
        // Cancel animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Create explosion effect
        if (this.leftBar) {
            this.leftBar.style.transition = 'all 0.5s ease-out';
            this.leftBar.style.transform = 'scale(3) rotate(360deg)';
            this.leftBar.style.opacity = '0';
        }
        if (this.rightBar) {
            this.rightBar.style.transition = 'all 0.5s ease-out';
            this.rightBar.style.transform = 'scale(3) rotate(360deg)';
            this.rightBar.style.opacity = '0';
        }
        if (this.middleBar && !this.middleBar.classList.contains('hidden')) {
            this.middleBar.style.transition = 'all 0.5s ease-out';
            this.middleBar.style.transform = 'scale(3) rotate(360deg)';
            this.middleBar.style.opacity = '0';
        }
        
        // Show explosion message
        if (this.feedbackEl) {
            this.feedbackEl.textContent = '💥 TOO FAST! EXPLOSION! 💥';
            this.feedbackEl.className = 'feedback miss';
            this.feedbackEl.style.fontSize = '20px';
        }
        
        // Haptic feedback for explosion
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
        // Game over after explosion animation
        setTimeout(() => {
            this.gameOver();
        }, 1500);
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

