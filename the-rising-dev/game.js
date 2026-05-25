// Game Configuration
const config = {
    canvas: {
        width: 400,  // Base width (will scale to screen)
        height: 700  // Base height (will scale to screen)
    },
    block: {
        width: 60,
        height: 30,
        speed: 2
    },
    water: {
        riseSpeed: 0.3,
        freezeSpeed: 5
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

// Optional Sound Manager instance (defined in sounds.js)
let soundManager = null;

// Game State
const game = {
    canvas: null,
    ctx: null,
    level: 1,
    score: 0,
    survivors: 30,
    totalPeople: 30,
    state: 'menu', // menu, playing, paused, freezing, transitioning, gameOver, ending
    
    hero: null, // To store data about the player's character
    
    currentBlock: null,
    stackedBlocks: [],
    deadBlocks: [],
    frozenLayers: [],
    fish: [], // Array of fish swimming in water
    shark: null, // Shark appears at higher levels
    
    water: {
        y: config.water.startY,
        rising: true
    },
    
    targetHeight: 100,
    direction: 1,
    spawnFromLeft: true, // Alternate between left and right spawning
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match mobile screen
        this.resizeCanvas();

        // Initialize sound manager if available
        if (typeof SoundManager !== 'undefined') {
            soundManager = new SoundManager();
        }
        
        // Handle window resize/orientation change
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
        
        // Touch/Click events
        this.canvas.addEventListener('click', () => this.handleTap());
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap();
        }, { passive: false });
        
        // Prevent double-tap zoom on iOS
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            // Only handle keyboard input if the game is in a state that expects it
            if (['menu', 'playing', 'paused'].includes(this.state)) {
                
                // Start game from menu
                if (this.state === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    this.startGame();
                    return; // Stop further processing
                }
                
                // Pause/Unpause
                if ((this.state === 'playing' || this.state === 'paused') && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
                    e.preventDefault();
                    this.togglePause();
                    return; // Stop further processing
                }

                // Place block
                if (this.state === 'playing' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    this.handleTap();
                    return; // Stop further processing
                }
            }
            
            // Restart game (can be done from any state, even game over)
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                this.restartGame();
            }
        });
        
        // Start the game loop
        this.gameLoop();
        
        // AUTO-START FOR TESTING - Remove this later if you want menu back
        /*
        setTimeout(() => {
            if (this.state === 'menu') {
                this.startGame();
            }
        }, 500);
        */
    },
    
    startGame() {
        console.log('Starting game...');
        this.state = 'playing';
        this.level = 1;
        this.survivors = 30;
        this.totalPeople = 30;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.frozenLayers = [];
        this.fish = [];
        this.shark = null;
        // Start with clearly visible water (bottom 200px)
        this.water.y = config.canvas.height - 200;
        this.water.rising = true;
        this.targetHeight = 100;
        this.spawnFromLeft = true;
        this.direction = 1;
        this.updateUI();
        this.hideMessage();
        this.spawnBlock();
        this.spawnFish(); // Spawn fish for this level
        console.log('Game started, block spawned:', this.currentBlock);

        // Initialize audio on first real interaction
        if (soundManager) {
            soundManager.init();
            // Start subtle ambient/tension sounds
            soundManager.playTension();
            soundManager.playWaterAmbient();
        }
        
        // Show level start message
        this.showMessage(`LEVEL ${this.level}\n\nBuild your tower to the GOAL line!\nCollect fish for bonus points!`);
        setTimeout(() => this.hideMessage(), 4000); // Hide after 4 seconds
    },
    
    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.showMessage('PAUSED\n\nESC or P to resume\nR to restart');
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.hideMessage();
        }
    },
    
    restartGame() {
        // Reset everything to initial state
        this.level = 1;
        this.score = 0;
        this.survivors = 30;
        this.totalPeople = 30;
        this.state = 'menu';
        this.hero = null; // Reset hero
        this.currentBlock = null;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.frozenLayers = [];
        this.fish = [];
        this.shark = null;
        // Reset water to visible position
        this.water.y = config.canvas.height - 200;
        this.water.rising = true;
        this.targetHeight = 100;
        this.spawnFromLeft = true;
        this.direction = 1;
        this.hideMessage();
        this.updateUI();
    },
    
    resizeCanvas() {
        // Get device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        
        // Get actual screen dimensions
        let screenWidth = window.innerWidth;
        let screenHeight = window.innerHeight;
        
        // For desktop: use a reasonable game size (portrait aspect ratio)
        const isMobile = screenWidth < 768;
        if (!isMobile) {
            // Desktop: create a nice portrait window
            screenWidth = Math.min(500, screenWidth);
            screenHeight = Math.min(900, screenHeight);
        }
        
        // Set display size (css pixels)
        this.canvas.style.width = screenWidth + 'px';
        this.canvas.style.height = screenHeight + 'px';
        
        // Set actual size in memory (scaled by dpr for retina displays)
        this.canvas.width = screenWidth * dpr;
        this.canvas.height = screenHeight * dpr;
        
        // Scale context to match dpr
        this.ctx.scale(dpr, dpr);
        
        // Store logical dimensions
        config.canvas.width = screenWidth;
        config.canvas.height = screenHeight;
        
        // Scale block size based on screen width (bigger on desktop)
        config.block.width = Math.floor(screenWidth * 0.2); // 20% of screen width
        config.block.height = Math.floor(config.block.width * 0.5); // Half of width
        config.block.speed = Math.max(2, screenWidth * 0.005); // Proportional speed
        
        // Update water start position (keep it visible at bottom 200px)
        this.water.y = config.canvas.height - 200;
        
        // Recalculate target height if we're in a level
        if (this.level > 1) {
            const levelProgress = (this.level - 1) * 150;
            this.targetHeight = config.canvas.height - 200 - levelProgress;
        } else {
            this.targetHeight = 100;
        }
    },
    
    spawnBlock() {
        if (this.survivors <= 0) {
            this.endLevel();
            return;
        }
        
        const lastBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        const waterTop = this.water.y;
        // --- DEBUG OVERRIDE ---
        // Place block at 70% of the canvas height for max visibility
        let startY = Math.floor(config.canvas.height * 0.7);
        // End DEBUG OVERRIDE
        let startX;
        if (this.spawnFromLeft) {
            startX = 60;
            this.direction = 1;
        } else {
            startX = config.canvas.width - config.block.width - 60;
            this.direction = -1;
        }
        this.spawnFromLeft = !this.spawnFromLeft;
        const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
        let isHeroBlock = this.level === 1 && this.stackedBlocks.length === 0 && !this.currentBlock;
        this.currentBlock = {
            x: startX,
            y: startY,
            width: config.block.width,
            height: config.block.height,
            hasName: Math.random() > 0.7,
            name: this.generateName(),
            survivalCount: 0,
            scared: false,
            floatType: floatType,
            peopleCount: isHeroBlock ? 1 : Math.floor(Math.random() * 2) + 1,
            isHero: isHeroBlock,
            direction: this.direction
        };
        if (isHeroBlock) {
            this.hero = this.currentBlock;
        }
        this.survivors--;
        this.updateUI();
        // On-screen debug
        const msg = document.getElementById('message');
        if (msg) {
            msg.textContent = `X:${this.currentBlock.x} Y:${this.currentBlock.y} W:${this.currentBlock.width} H:${this.currentBlock.height} WaterY:${this.water.y}`;
            msg.classList.add('show');
        }
        // Console debug
        console.log('SPAWNED BLOCK', this.currentBlock, 'WaterY', this.water.y);
    },
    
    generateName() {
        const names = ['Anna', 'Ben', 'Chen', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
        return names[Math.floor(Math.random() * names.length)];
    },
    
    handleTap() {
        // Start game from menu on tap
        if (this.state === 'menu') {
            this.startGame();
            return;
        }
        
        // Prevent action unless actively playing
        if (this.state !== 'playing' || !this.currentBlock) return;
        
        // Save the block position before placing
        const blockY = this.currentBlock.y;
        
        let placed = false;
        if (this.stackedBlocks.length === 0) {
            // This is the FIRST block, it creates the foundation.
            this.stackedBlocks.push(this.currentBlock);
            placed = true;
        } else {
            // Otherwise, place it on the stack and check for overhang.
            placed = this.placeBlock();
        }

        // After placing, the currentBlock is gone.
        this.currentBlock = null;

        if (placed) {
            // A new block should spawn now
            this.spawnBlock();
        }
    },
    
    placeBlock() {
        // This function now ONLY handles blocks placed on TOP of other blocks.
        const placedBlock = this.currentBlock;
        const baseBlock = this.stackedBlocks[this.stackedBlocks.length - 1];

        // This should not happen, but as a safeguard:
        if (!baseBlock) {
            console.error("placeBlock called without a baseBlock!");
            return false;
        }
        
        // Calculate the overlap percentage
        const overlapStart = Math.max(placedBlock.x, baseBlock.x);
        const overlapEnd = Math.min(placedBlock.x + placedBlock.width, baseBlock.x + baseBlock.width);
        const overlapWidth = Math.max(0, overlapEnd - overlapStart);
        const overlapRatio = overlapWidth / placedBlock.width;

        if (overlapRatio > 0.1) { // Need at least 10% overlap to be stable
            const peopleToSave = Math.floor(placedBlock.peopleCount * overlapRatio);
            const peopleLost = placedBlock.peopleCount - peopleToSave;

            console.log(`Overlap: ${(overlapRatio * 100).toFixed(0)}%. Saved: ${peopleToSave}, Lost: ${peopleLost}`);
            
            // The new "block" is just the stable, overlapping part
            placedBlock.x = overlapStart;
            placedBlock.width = overlapWidth;
            placedBlock.peopleCount = peopleToSave;
            
            this.stackedBlocks.push(placedBlock);
            this.score += 10 * peopleToSave;

            // Play stack sound (and perfect if almost full overlap)
            if (soundManager) {
                soundManager.playStack();
                if (overlapRatio > 0.9) {
                    soundManager.playPerfect();
                }
            }

            if (peopleLost > 0) {
                // Create a "falling" block for the people who were lost
                const fallingPart = {
                    ...placedBlock,
                    width: config.block.width - overlapWidth,
                    x: overlapEnd, // Default to right side falling
                    peopleCount: peopleLost,
                    falling: true,
                    isHero: placedBlock.isHero && peopleToSave === 0, // Did the hero fall?
                    drowned: false
                };
                if (placedBlock.x > baseBlock.x) {
                    fallingPart.x = baseBlock.x;
                }
                this.deadBlocks.push(fallingPart);
            }
            
            // Check if the hero fell
            if (placedBlock.isHero && peopleToSave === 0) {
                this.endLevel(true); // Game over, hero died
                return false; // Placement failed
            }
            return true; // Placement was successful

        } else {
            // Not enough overlap, the whole block falls
            placedBlock.falling = true;
            this.deadBlocks.push(placedBlock);
            this.score -= 10;

            if (soundManager) {
                soundManager.playSplash();
                soundManager.playDrown();
            }
            
            if (placedBlock.isHero) {
                this.endLevel(true); // Game over, hero died
                return false; // Placement failed
            }
        }
        return false; // Placement failed
    },
    
    calculateOverlap(block1, block2) {
        const left1 = block1.x;
        const right1 = block1.x + block1.width;
        const left2 = block2.x;
        const right2 = block2.x + block2.width;
        
        const overlapLeft = Math.max(left1, left2);
        const overlapRight = Math.min(right1, right2);
        
        return Math.max(0, overlapRight - overlapLeft);
    },
    
    endLevel(heroDied = false) {
        this.water.rising = false;
        
        if (heroDied) {
            this.showMessage('YOU HAVE DIED\n\nPress R to Restart');
            if (soundManager) {
                soundManager.playDrown();
            }
            this.state = 'gameOver';
            return;
        }

        const success = this.stackedBlocks.length > 0 && this.stackedBlocks[this.stackedBlocks.length - 1].y <= this.targetHeight;
        
        if (success) {
            this.state = 'freezing';
            this.initialWaterY = this.water.y; // Store the water level when freezing starts
            this.water.rising = false;
            
            // Play freezing and level complete sounds
            if (soundManager) {
                soundManager.playFreeze();
                soundManager.playLevelComplete();
            }
            
            // Show message
            this.showMessage('WATER FREEZING...');
            
            setTimeout(() => {
                this.freezeLevel();
            }, 2000);
        } else {
            this.state = 'gameOver'; // Game over if not enough blocks
            this.showMessage('GAME OVER\n\nPress R to Restart');
            if (soundManager) {
                soundManager.playWarning();
            }
        }
    },
    
    freezeLevel() {
        // Determine survivors
        const aboveWater = this.stackedBlocks.filter(b => b.y < this.water.y);
        const belowWater = this.stackedBlocks.filter(b => b.y >= this.water.y);
        
        // Save frozen layer
        this.frozenLayers.push({
            blocks: [...this.stackedBlocks, ...this.deadBlocks],
            waterLevel: this.water.y,
            level: this.level
        });
        
        // Calculate survivors for next level
        const survivorCount = Math.floor(aboveWater.length * 0.6) + 5; // Some survive
        this.survivors = survivorCount;
        this.totalPeople = survivorCount + Math.floor(this.level * 10); // More people join
        
        // Show level complete message with CURRENT level and score
        this.showMessage(`LEVEL ${this.level} COMPLETE!\n\nSCORE: ${this.score}\nSURVIVORS: ${survivorCount}\n\nNEXT: LEVEL ${this.level + 1}`);
        
        setTimeout(() => {
            this.nextLevel();
        }, 4000);
    },
    
    nextLevel() {
        this.level++;
        
        console.log(`=== LEVEL ${this.level} STARTING ===`);
        
        // Check if we reached level 10 (extended from 5)
        if (this.level > 10) {
            this.showMessage('ASCENDING TO HEAVEN...');
            this.state = 'ending';
            setTimeout(() => {
                this.startEnding();
            }, 2000);
            return;
        }
        
        // Keep frozen blocks as background
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.fish = []; // Clear old fish
        this.shark = null; // Clear shark
        
        // New starting position is above the ice
        this.targetHeight = this.water.y - 200;
        if (this.targetHeight < 50) {
            this.targetHeight = 50; // Minimum height
        }
        
        this.water.y = this.water.y - 50; // Water starts a bit higher
        this.state = 'playing';
        
        // Spawn new fish for this level
        this.spawnFish();
        
        // Update UI FIRST to show new level
        this.updateUI();
        
        // Show BIG level start message
        const levelMessages = {
            1: 'LEVEL 1\n\nBuild your tower!\nCollect fish for points!',
            2: 'LEVEL 2\n\nWater is rising!\nStack carefully!',
            3: 'LEVEL 3\n\nBigger fish appear!\nMore points available!',
            4: 'LEVEL 4\n\nGetting harder!\nStay focused!',
            5: 'LEVEL 5\n\n⚠️ SHARK APPEARS! ⚠️\nKeep blocks high!',
            6: 'LEVEL 6\n\nShark is hunting!\nBuild higher!',
            7: 'LEVEL 7\n\nRare fish appear!\nWorth 100 points!',
            8: 'LEVEL 8\n\nAlmost there!\nKeep going!',
            9: 'LEVEL 9\n\nFinal stretch!\nYou can do it!',
            10: 'LEVEL 10\n\nFINAL LEVEL!\nReach the top!'
        };
        
        const message = levelMessages[this.level] || `LEVEL ${this.level}\n\nContinue building!`;
        this.showMessage(message);
        setTimeout(() => this.hideMessage(), 4000); // Show for 4 seconds
        
        this.spawnBlock();
    },
    
    spawnFish() {
        // Different fish types based on level
        const fishTypes = this.getFishTypesForLevel();
        if (!fishTypes || fishTypes.length === 0) {
            console.error('No fish types available for level', this.level);
            return;
        }
        
        const fishCount = 3 + Math.floor(this.level / 2); // More fish at higher levels
        console.log(`Spawning ${fishCount} fish for level ${this.level}`);
        
        // Clear existing fish
        this.fish = [];
        
        for (let i = 0; i < fishCount; i++) {
            const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
            // Spawn fish in the water area (below water surface)
            const waterDepth = config.canvas.height - this.water.y;
            const fishY = this.water.y + 30 + Math.random() * (waterDepth - 60); // Keep fish in water
            const direction = Math.random() > 0.5 ? 1 : -1;
            const speed = 0.8 + Math.random() * 1.2 + (this.level * 0.1);
            
            this.fish.push({
                x: direction > 0 ? -30 : config.canvas.width + 30,
                y: fishY,
                type: fishType,
                direction: direction,
                speed: speed,
                size: fishType.size || 15,
                color: fishType.color,
                points: fishType.points || 10,
                frame: Math.random() * Math.PI * 2 // For animation
            });
        }
        
        console.log(`Spawned ${this.fish.length} fish at water level ${this.water.y}`);
        
        // Spawn shark at level 5+
        if (this.level >= 5 && !this.shark) {
            this.shark = {
                x: -100,
                y: this.water.y + 80,
                direction: 1,
                speed: 1.5,
                size: 40,
                frame: 0,
                attackCooldown: 0
            };
            console.log('Shark spawned at level', this.level);
        }
    },
    
    getFishTypesForLevel() {
        // Different fish for different levels
        const allFishTypes = {
            // Level 1-2: Small friendly fish
            small: [
                { name: 'Goldfish', color: '#FFD700', size: 12, points: 10 },
                { name: 'Blue Fish', color: '#4A90E2', size: 10, points: 10 },
                { name: 'Orange Fish', color: '#FF6B35', size: 11, points: 10 }
            ],
            // Level 3-4: Medium fish
            medium: [
                { name: 'Tuna', color: '#2E86AB', size: 18, points: 25 },
                { name: 'Salmon', color: '#FF6B6B', size: 16, points: 25 },
                { name: 'Mackerel', color: '#4ECDC4', size: 15, points: 20 }
            ],
            // Level 5-7: Larger fish
            large: [
                { name: 'Bass', color: '#95A5A6', size: 22, points: 50 },
                { name: 'Pike', color: '#34495E', size: 25, points: 50 },
                { name: 'Carp', color: '#E67E22', size: 20, points: 40 }
            ],
            // Level 8+: Rare fish
            rare: [
                { name: 'Angelfish', color: '#9B59B6', size: 20, points: 100 },
                { name: 'Rainbow Fish', color: '#E74C3C', size: 18, points: 100 },
                { name: 'Tropical Fish', color: '#F39C12', size: 19, points: 80 }
            ]
        };
        
        if (this.level <= 2) return allFishTypes.small;
        if (this.level <= 4) return [...allFishTypes.small, ...allFishTypes.medium];
        if (this.level <= 7) return [...allFishTypes.medium, ...allFishTypes.large];
        return [...allFishTypes.large, ...allFishTypes.rare];
    },
    
    startEnding() {
        // Load ending sequence
        if (typeof EndingSequence !== 'undefined') {
            this.ending = new EndingSequence(this);
            this.ending.start();
            this.state = 'ending';
        }
    },
    
    update() {
        // Don't update if in menu or paused
        if (this.state === 'menu' || this.state === 'paused') {
            return;
        }
        
        if (this.state === 'ending' && this.ending) {
            // Update ending sequence
            this.ending.update(0.016); // ~60fps
            return;
        }
        
        if (this.state === 'playing') {
            // Move current block
            if (this.currentBlock) {
                this.currentBlock.x += config.block.speed * this.direction;
                
                // Bounce off walls
                if (this.currentBlock.x <= 0 && this.direction === -1) {
                    this.direction = 1; // Move right
                } else if (this.currentBlock.x + this.currentBlock.width >= config.canvas.width && this.direction === 1) {
                    this.direction = -1; // Move left
                }
                
                // Check if water reached block
                if (this.currentBlock.y >= this.water.y - 10) {
                    this.currentBlock.scared = true;
                }
            }
            
            // Rise water
            if (this.water.rising && this.water.y > this.targetHeight) {
                this.water.y -= config.water.riseSpeed;
            }
            
            // Update falling blocks
            this.deadBlocks.forEach(block => {
                if (block.falling) {
                    if (!block.velocity) block.velocity = 0; // Initialize velocity if not set
                    block.velocity += 0.5; // Gravity
                    block.y += block.velocity;
                    
                    // Hit water
                    if (block.y >= this.water.y) {
                        block.falling = false;
                        // Create splash effect
                        if (soundManager) {
                            soundManager.playSplash();
                        }
                    }
                }
            });
            
            // Check for drowning
            this.stackedBlocks.forEach(block => {
                if (block.y >= this.water.y && !block.drowned) {
                    block.drowned = true;
                    this.deadBlocks.push({...block});
                }
            });
            
            // Update fish (iterate backwards to safely remove items)
            for (let i = this.fish.length - 1; i >= 0; i--) {
                const fish = this.fish[i];
                fish.x += fish.speed * fish.direction;
                fish.frame += 0.1; // Animation frame
                
                // Remove fish that left screen
                if ((fish.direction > 0 && fish.x > config.canvas.width + 50) ||
                    (fish.direction < 0 && fish.x < -50)) {
                    this.fish.splice(i, 1);
                    continue;
                }
                
                // Check collision with stacked blocks (fish collection)
                let collected = false;
                for (const block of this.stackedBlocks) {
                    if (!block.drowned && 
                        fish.x + fish.size > block.x && 
                        fish.x - fish.size < block.x + block.width &&
                        fish.y + fish.size > block.y &&
                        fish.y - fish.size < block.y + block.height) {
                        // Fish collected! Add points
                        this.score += fish.points;
                        this.fish.splice(i, 1);
                        collected = true;
                        this.updateUI();
                        // Visual feedback
                        this.showMessage(`+${fish.points} POINTS!`);
                        setTimeout(() => this.hideMessage(), 1000);
                        break;
                    }
                }
            }
            
            // Respawn fish if too few (keep at least 3-4 fish in water)
            if (this.fish.length < 3 && this.state === 'playing') {
                const fishTypes = this.getFishTypesForLevel();
                if (fishTypes && fishTypes.length > 0) {
                    const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
                    const waterDepth = config.canvas.height - this.water.y;
                    const fishY = this.water.y + 30 + Math.random() * (waterDepth - 60);
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    const speed = 0.8 + Math.random() * 1.2 + (this.level * 0.1);
                    
                    this.fish.push({
                        x: direction > 0 ? -30 : config.canvas.width + 30,
                        y: fishY,
                        type: fishType,
                        direction: direction,
                        speed: speed,
                        size: fishType.size || 15,
                        color: fishType.color,
                        points: fishType.points || 10,
                        frame: Math.random() * Math.PI * 2
                    });
                }
            }
            
            // Update shark (level 5+)
            if (this.shark) {
                this.shark.x += this.shark.speed * this.shark.direction;
                this.shark.frame += 0.05;
                this.shark.attackCooldown = Math.max(0, this.shark.attackCooldown - 1);
                
                // Shark bounces back and forth
                if (this.shark.x > config.canvas.width + 100) {
                    this.shark.direction = -1;
                    this.shark.x = config.canvas.width + 100;
                } else if (this.shark.x < -100) {
                    this.shark.direction = 1;
                    this.shark.x = -100;
                }
                
                // Shark attacks blocks that are too low
                this.stackedBlocks.forEach((block, index) => {
                    if (!block.drowned && 
                        block.y >= this.water.y - 30 &&
                        this.shark.attackCooldown === 0 &&
                        Math.abs(this.shark.x - (block.x + block.width/2)) < 60) {
                        // Shark attack! Remove bottom block
                        this.shark.attackCooldown = 180; // 3 seconds cooldown
                        const attackedBlock = this.stackedBlocks[index];
                        attackedBlock.drowned = true;
                        this.deadBlocks.push({...attackedBlock, falling: true, velocity: 0});
                        this.stackedBlocks.splice(index, 1);
                        this.showMessage('SHARK ATTACK!');
                        setTimeout(() => this.hideMessage(), 1500);
                    }
                });
            }
        } else if (this.state === 'freezing') {
            // Water freezes (rises quickly to show freeze effect)
            if (this.water.y > 0) {
                this.water.y -= config.water.freezeSpeed;
            }
        }
    },
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        // Menu screen
        if (this.state === 'menu') {
            this.drawMenu();
            return;
        }
        
        // If ending sequence is playing, draw that instead
        if (this.state === 'ending' && this.ending) {
            this.ending.draw(this.ctx);
            return;
        }
        
        // --- NEW DRAWING ORDER ---
        
        // 1. Draw water and ice separately for animation
        this.drawWaterAndIce();
        
        // 1.5. Draw fish IN the water (behind everything else in water)
        this.fish.forEach(fish => {
            // Draw all fish that are in the water area
            if (fish.y >= this.water.y - 10 && fish.y <= config.canvas.height) {
                this.drawFish(fish);
            }
        });
        
        // 1.6. Draw shark IN the water
        if (this.shark && this.shark.y >= this.water.y - 10) {
            this.drawShark(this.shark);
        }
        
        // 2. Draw frozen layers FIRST
        this.frozenLayers.forEach(layer => {
            // Draw frozen dead bodies
            layer.blocks.forEach(block => {
                if (block.y >= layer.waterLevel - 20) {
                    this.ctx.fillStyle = config.colors.deadHuman;
                    this.ctx.fillRect(block.x, block.y, block.width, block.height);
                    
                    // Draw simple face
                    this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    const eyeSize = 2;
                    this.ctx.fillRect(block.x + 10, block.y + 8, eyeSize, eyeSize);
                    this.ctx.fillRect(block.x + block.width - 15, block.y + 8, eyeSize, eyeSize);
                }
            });
        });
        
        // 3. Draw target line
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Bright yellow and more opaque
        this.ctx.lineWidth = 3; // Thicker line
        this.ctx.setLineDash([10, 10]); // Longer dashes
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.targetHeight);
        this.ctx.lineTo(config.canvas.width, this.targetHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Add "GOAL" text next to the line
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('GOAL', 10, this.targetHeight - 10);
        
        // 4. Draw stacked blocks (living humans above water) - SIMPLE and VISIBLE
        this.stackedBlocks.forEach((block, index) => {
            if (!block.drowned) {
                // Simple shadow for depth
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.fillRect(block.x + 2, block.y + 2, block.width, block.height);
                
                // Draw the human/block
                this.drawHuman(block);
            }
        });
        
        // 5. Draw dead/falling blocks - ONLY BELOW WATER
        this.deadBlocks.forEach(block => {
            // Only draw if they're in or below the water
            if (block.y >= this.water.y - 5) {
                if (block.falling) {
                    // Falling - draw simple person
                    this.drawSimplePerson(block, true);
                } else {
                    // Drowned - draw faded underwater
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.4;
                    this.drawSimplePerson(block, false);
                    this.ctx.restore();
                }
            }
        });
        
        // 6. Draw current moving block LAST (so it's on top of everything)
        if (this.currentBlock) {
            // Draw bright outline so it's VERY visible
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(this.currentBlock.x - 2, this.currentBlock.y - 2, this.currentBlock.width + 4, this.currentBlock.height + 4);
            
            // Draw the human/block
            this.drawHuman(this.currentBlock, true);
        }

        // 7. Cinematic overlays (e.g., during freezing)
        if (this.state === 'freezing' && this.hero) {
            this.drawHeroCinematic();
        }
        
        // Show level progress indicator (big and visible)
        if (this.state === 'playing') {
            // Big level indicator in top right
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`LEVEL ${this.level}`, config.canvas.width - 15, 50);
            
            // Fish count indicator
            if (this.fish.length > 0) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(`🐟 ${this.fish.length} fish`, config.canvas.width - 15, 75);
            }
            
            // Shark warning at level 5+
            if (this.shark) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText('⚠️ SHARK!', config.canvas.width - 15, 100);
            }
        }
    },
    
    drawWaterAndIce() {
        // Clamp water position to screen
        if (this.water.y > config.canvas.height) this.water.y = config.canvas.height;
        if (this.water.y < 0) this.water.y = 0;

        const waterHeight = config.canvas.height - this.water.y;
        
        // Draw water with depth gradient (darker at bottom)
        const waterGradient = this.ctx.createLinearGradient(0, this.water.y, 0, config.canvas.height);
        waterGradient.addColorStop(0, 'rgba(64, 156, 255, 0.8)'); // Lighter at surface
        waterGradient.addColorStop(0.5, 'rgba(52, 152, 219, 0.7)'); // Medium
        waterGradient.addColorStop(1, 'rgba(41, 128, 185, 0.9)'); // Darker at bottom
        this.ctx.fillStyle = waterGradient;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, waterHeight);

        // Draw the freezing animation layer on top of the water
        if (this.state === 'freezing') {
            const freezeDistance = this.initialWaterY - this.water.y;
            const maxFreezeDistance = 100; // Maximum distance water moves during freeze
            const freezeProgress = Math.min(freezeDistance / maxFreezeDistance, 1);
            const iceColor = `rgba(173, 216, 230, ${Math.min(freezeProgress * 0.8, 0.8)})`; // Light blue, semi-transparent ice
            this.ctx.fillStyle = iceColor;
            this.ctx.fillRect(0, this.water.y, config.canvas.width, waterHeight);
            
            // Ice crystals/sparkles
            for (let i = 0; i < 20; i++) {
                const sparkleX = (config.canvas.width / 20) * i + Math.sin(Date.now() * 0.001 + i) * 10;
                const sparkleY = this.water.y + (waterHeight * Math.random());
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.beginPath();
                this.ctx.arc(sparkleX, sparkleY, 1 + Math.random() * 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Draw animated water surface with waves
        const time = Date.now() * 0.001;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        // Wavy surface
        for (let x = 0; x <= config.canvas.width; x += 5) {
            const waveY = this.water.y + Math.sin(time * 2 + x * 0.02) * 2;
            if (x === 0) {
                this.ctx.moveTo(x, waveY);
            } else {
                this.ctx.lineTo(x, waveY);
            }
        }
        this.ctx.stroke();
        
        // Additional wave highlights
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = 0; x <= config.canvas.width; x += 5) {
            const waveY = this.water.y + Math.sin(time * 2.5 + x * 0.015) * 1.5;
            if (x === 0) {
                this.ctx.moveTo(x, waveY);
            } else {
                this.ctx.lineTo(x, waveY);
            }
        }
        this.ctx.stroke();
        
        // Water depth lines (horizontal lines showing depth)
        for (let i = 1; i <= 3; i++) {
            const depthY = this.water.y + (waterHeight / 4) * i;
            this.ctx.strokeStyle = `rgba(41, 128, 185, ${0.2 / i})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, depthY);
            this.ctx.lineTo(config.canvas.width, depthY);
            this.ctx.stroke();
        }
    },

    drawFish(fish) {
        if (!fish || !fish.color) return; // Safety check
        
        this.ctx.save();
        
        // Fish body (ellipse)
        const bodyLength = fish.size * 1.5;
        const bodyHeight = fish.size * 0.8;
        
        // Animated swimming motion
        const swimOffset = Math.sin(fish.frame) * 2;
        
        this.ctx.translate(fish.x, fish.y + swimOffset);
        if (fish.direction < 0) {
            this.ctx.scale(-1, 1); // Flip horizontally if swimming left
        }
        
        // Fish body - BRIGHT and VISIBLE
        this.ctx.fillStyle = fish.color || '#FFD700';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, bodyLength/2, bodyHeight/2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Fish outline - THICK for visibility
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Fish tail
        this.ctx.fillStyle = fish.color;
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyLength/2, 0);
        this.ctx.lineTo(-bodyLength/2 - fish.size * 0.4, -fish.size * 0.3);
        this.ctx.lineTo(-bodyLength/2 - fish.size * 0.2, 0);
        this.ctx.lineTo(-bodyLength/2 - fish.size * 0.4, fish.size * 0.3);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        // Fish eye
        this.ctx.fillStyle = '#FFF';
        this.ctx.beginPath();
        this.ctx.arc(bodyLength/4, -fish.size * 0.15, fish.size * 0.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(bodyLength/4, -fish.size * 0.15, fish.size * 0.1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Fish fins
        this.ctx.fillStyle = fish.color;
        this.ctx.beginPath();
        // Top fin
        this.ctx.moveTo(-bodyLength/4, -bodyHeight/2);
        this.ctx.lineTo(0, -bodyHeight/2 - fish.size * 0.3);
        this.ctx.lineTo(bodyLength/4, -bodyHeight/2);
        this.ctx.closePath();
        this.ctx.fill();
        // Bottom fin
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyLength/4, bodyHeight/2);
        this.ctx.lineTo(0, bodyHeight/2 + fish.size * 0.2);
        this.ctx.lineTo(bodyLength/4, bodyHeight/2);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    },
    
    drawShark(shark) {
        this.ctx.save();
        
        const bodyLength = shark.size * 2;
        const bodyHeight = shark.size * 0.8;
        
        // Animated swimming
        const swimOffset = Math.sin(shark.frame * 2) * 3;
        
        this.ctx.translate(shark.x, shark.y + swimOffset);
        if (shark.direction < 0) {
            this.ctx.scale(-1, 1);
        }
        
        // Shark body (dark gray)
        this.ctx.fillStyle = '#2C3E50';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, bodyLength/2, bodyHeight/2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Shark outline
        this.ctx.strokeStyle = '#1A1A1A';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Shark tail (large and menacing)
        this.ctx.fillStyle = '#2C3E50';
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyLength/2, 0);
        this.ctx.lineTo(-bodyLength/2 - shark.size * 0.6, -shark.size * 0.5);
        this.ctx.lineTo(-bodyLength/2 - shark.size * 0.3, 0);
        this.ctx.lineTo(-bodyLength/2 - shark.size * 0.6, shark.size * 0.5);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        // Shark head/mouth
        this.ctx.fillStyle = '#34495E';
        this.ctx.beginPath();
        this.ctx.ellipse(bodyLength/3, 0, bodyLength/3, bodyHeight/2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Shark mouth (open, menacing)
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(bodyLength/2.5, bodyHeight/3, shark.size * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Shark teeth
        this.ctx.fillStyle = '#FFF';
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(bodyLength/2.5 + i * 3, bodyHeight/3);
            this.ctx.lineTo(bodyLength/2.5 + i * 3 - 2, bodyHeight/3 + 4);
            this.ctx.lineTo(bodyLength/2.5 + i * 3 + 2, bodyHeight/3 + 4);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Shark eye (red, menacing)
        this.ctx.fillStyle = '#E74C3C';
        this.ctx.beginPath();
        this.ctx.arc(bodyLength/4, -shark.size * 0.2, shark.size * 0.25, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(bodyLength/4, -shark.size * 0.2, shark.size * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Shark fin (dorsal fin)
        this.ctx.fillStyle = '#2C3E50';
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyLength/6, -bodyHeight/2);
        this.ctx.lineTo(0, -bodyHeight/2 - shark.size * 0.6);
        this.ctx.lineTo(bodyLength/6, -bodyHeight/2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        // Warning indicator if shark is about to attack
        if (shark.attackCooldown < 30 && shark.attackCooldown > 0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(0, -shark.size * 1.5, shark.size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    },
    
    drawHeroCinematic() {
        const heroBlock = this.hero;
        if (!heroBlock) return;

        this.ctx.save();

        // Darken background slightly
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);

        // Compute hero center
        const heroCenterX = heroBlock.x + heroBlock.width / 2;
        const heroCenterY = heroBlock.y + heroBlock.height / 2;

        // Slight breathing zoom
        const t = Date.now();
        const pulse = 1 + 0.05 * Math.sin(t * 0.005);
        const zoom = 2.0 * pulse;

        // Zoom into hero
        this.ctx.translate(config.canvas.width / 2, config.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-heroCenterX, -heroCenterY);

        // Draw hero block enlarged
        this.drawHuman(heroBlock, false);

        this.ctx.restore();

        // Text overlay
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SOME SURVIVE. MANY FREEZE BELOW.', config.canvas.width / 2, 40);
    },

    drawHuman(block, isMoving = false) {
        if (!block) {
            console.error('drawHuman called with null block!');
            return;
        }
        
        // Use SIMPLE person drawing - much more visible
        this.drawSimplePerson(block, block.scared || false);
        
        // Name tag
        if (block.hasName) {
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(block.name, block.x + 5, block.y - 5);
        }
    },
    
    drawFloat(block, floatHeight) {
        if (!block) return;
        
        const floatY = block.y + (block.height - floatHeight);
        const floatType = block.floatType || 'raft';
        
        if (floatType === 'boat') {
            // Enhanced boat with realistic details
            const boatColor = '#8B4513'; // Rich brown
            const boatDark = '#654321'; // Darker brown for depth
            const boatLight = '#A0522D'; // Lighter brown for highlights
            
            // Boat hull (curved bottom)
            this.ctx.fillStyle = boatColor;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x + block.width * 0.1, floatY);
            this.ctx.quadraticCurveTo(block.x + block.width * 0.5, floatY - floatHeight * 0.2, block.x + block.width * 0.9, floatY);
            this.ctx.lineTo(block.x + block.width * 0.95, floatY + floatHeight);
            this.ctx.lineTo(block.x + block.width * 0.05, floatY + floatHeight);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Boat outline
            this.ctx.strokeStyle = boatDark;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Boat interior (seats/benches)
            this.ctx.fillStyle = boatDark;
            this.ctx.fillRect(block.x + block.width * 0.2, floatY + floatHeight * 0.3, block.width * 0.6, floatHeight * 0.15);
            this.ctx.fillRect(block.x + block.width * 0.2, floatY + floatHeight * 0.6, block.width * 0.6, floatHeight * 0.15);
            
            // Wood grain effect
            this.ctx.strokeStyle = boatLight;
            this.ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const grainY = floatY + floatHeight * (0.2 + i * 0.25);
                this.ctx.beginPath();
                this.ctx.moveTo(block.x + block.width * 0.15, grainY);
                this.ctx.lineTo(block.x + block.width * 0.85, grainY);
                this.ctx.stroke();
            }
            
            // Water reflection on boat
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.fillRect(block.x + block.width * 0.3, floatY, block.width * 0.4, floatHeight * 0.3);
        }
        else if (floatType === 'raft') {
            // Enhanced raft with individual logs
            const logColor = '#CD853F'; // Tan/burlywood
            const logDark = '#8B4513'; // Darker for depth
            const logCount = 5;
            const logWidth = block.width / logCount;
            
            for (let i = 0; i < logCount; i++) {
                const logX = block.x + i * logWidth;
                
                // Individual log (rounded)
                this.ctx.fillStyle = logColor;
                const logRadius = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(logX + 2 + logRadius, floatY);
                this.ctx.lineTo(logX + logWidth - 2 - logRadius, floatY);
                this.ctx.quadraticCurveTo(logX + logWidth - 2, floatY, logX + logWidth - 2, floatY + logRadius);
                this.ctx.lineTo(logX + logWidth - 2, floatY + floatHeight - logRadius);
                this.ctx.quadraticCurveTo(logX + logWidth - 2, floatY + floatHeight, logX + logWidth - 2 - logRadius, floatY + floatHeight);
                this.ctx.lineTo(logX + 2 + logRadius, floatY + floatHeight);
                this.ctx.quadraticCurveTo(logX + 2, floatY + floatHeight, logX + 2, floatY + floatHeight - logRadius);
                this.ctx.lineTo(logX + 2, floatY + logRadius);
                this.ctx.quadraticCurveTo(logX + 2, floatY, logX + 2 + logRadius, floatY);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Log outline
                this.ctx.strokeStyle = logDark;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                // Log texture (rings)
                this.ctx.strokeStyle = logDark;
                this.ctx.lineWidth = 1;
                for (let j = 1; j < 3; j++) {
                    const ringY = floatY + (floatHeight / 3) * j;
                    this.ctx.beginPath();
                    this.ctx.arc(logX + logWidth / 2, ringY, logWidth * 0.3, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }
            
            // Rope binding (cross pieces)
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x, floatY + floatHeight * 0.3);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight * 0.3);
            this.ctx.moveTo(block.x, floatY + floatHeight * 0.7);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight * 0.7);
            this.ctx.stroke();
        }
        else {
            // Enhanced air mattress with realistic details
            const mattressColor = '#FF6347'; // Tomato red
            const mattressDark = '#CC4A2F'; // Darker red
            const radius = 8;
            
            // Main mattress body
            this.ctx.fillStyle = mattressColor;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x + radius, floatY);
            this.ctx.lineTo(block.x + block.width - radius, floatY);
            this.ctx.quadraticCurveTo(block.x + block.width, floatY, block.x + block.width, floatY + radius);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight - radius);
            this.ctx.quadraticCurveTo(block.x + block.width, floatY + floatHeight, block.x + block.width - radius, floatY + floatHeight);
            this.ctx.lineTo(block.x + radius, floatY + floatHeight);
            this.ctx.quadraticCurveTo(block.x, floatY + floatHeight, block.x, floatY + floatHeight - radius);
            this.ctx.lineTo(block.x, floatY + radius);
            this.ctx.quadraticCurveTo(block.x, floatY, block.x + radius, floatY);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Outline
            this.ctx.strokeStyle = mattressDark;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Seams/stitching
            this.ctx.strokeStyle = mattressDark;
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([3, 3]);
            this.ctx.strokeRect(block.x + 3, floatY + 3, block.width - 6, floatHeight - 6);
            this.ctx.setLineDash([]);
            
            // Air valve
            this.ctx.fillStyle = '#333';
            this.ctx.beginPath();
            this.ctx.arc(block.x + block.width - 8, floatY + 8, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Shine/highlight
            const gradient = this.ctx.createLinearGradient(block.x, floatY, block.x, floatY + floatHeight);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(block.x, floatY, block.width, floatHeight);
        }
    },
    
    drawSimplePerson(block, isScared = false) {
        // SIMPLE but visible person drawing
        if (!block) return;
        
        const x = block.x;
        const y = block.y;
        const width = block.width;
        const height = block.height;
        const centerX = x + width / 2;
        const isHero = block.isHero || false;
        
        // Draw float device FIRST (boat/raft/mattress)
        const floatHeight = height * 0.35;
        const floatY = y + height - floatHeight;
        this.drawFloat(block, floatHeight);
        
        // Draw person on top of float - SIMPLE but CLEAR
        const personY = y;
        const personHeight = height - floatHeight;
        const headSize = Math.min(width * 0.4, personHeight * 0.35);
        const headY = personY;
        const headCenterY = headY + headSize / 2;
        
        // Head - BIG and BRIGHT
        this.ctx.fillStyle = '#FFDBAC'; // Skin color
        this.ctx.beginPath();
        this.ctx.arc(centerX, headCenterY, headSize/2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#D4A574';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Hair - SIMPLE
        this.ctx.fillStyle = '#654321';
        this.ctx.beginPath();
        this.ctx.arc(centerX, headY + headSize * 0.2, headSize/2 * 0.85, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Body - BRIGHT COLOR
        const bodyColor = isHero ? '#FFD700' : (isScared ? '#FF0000' : '#3498DB');
        this.ctx.fillStyle = bodyColor;
        const bodyY = headY + headSize;
        const bodyHeight = personHeight - headSize;
        this.ctx.fillRect(centerX - width * 0.25, bodyY, width * 0.5, bodyHeight * 0.7);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(centerX - width * 0.25, bodyY, width * 0.5, bodyHeight * 0.7);
        
        // Arms - THICK
        this.ctx.strokeStyle = '#FFDBAC';
        this.ctx.lineWidth = width * 0.1;
        this.ctx.lineCap = 'round';
        if (isScared) {
            // Arms up
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - width * 0.2, bodyY);
            this.ctx.lineTo(centerX - width * 0.4, headY - headSize * 0.2);
            this.ctx.moveTo(centerX + width * 0.2, bodyY);
            this.ctx.lineTo(centerX + width * 0.4, headY - headSize * 0.2);
            this.ctx.stroke();
        } else {
            // Arms down
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - width * 0.2, bodyY);
            this.ctx.lineTo(centerX - width * 0.3, bodyY + bodyHeight * 0.5);
            this.ctx.moveTo(centerX + width * 0.2, bodyY);
            this.ctx.lineTo(centerX + width * 0.3, bodyY + bodyHeight * 0.5);
            this.ctx.stroke();
        }
        
        // Face - BIG EYES
        const eyeSize = Math.max(3, headSize * 0.2);
        const eyeY = headCenterY - headSize * 0.1;
        const eyeSpacing = headSize * 0.25;
        
        // Eyes
        this.ctx.fillStyle = '#FFF';
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Pupils
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeSpacing, eyeY, eyeSize * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeSpacing, eyeY, eyeSize * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Mouth
        const mouthY = headCenterY + headSize * 0.2;
        if (isScared) {
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(centerX, mouthY, eyeSize * 1.2, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, mouthY, eyeSize * 0.8, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
        }
        
        // Hero glow
        if (isHero) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(centerX, headCenterY, headSize/2 + 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    },
    
    drawPerson(x, y, width, height, scared, isMoving, isHero = false) {
        const personCenterX = x + width / 2;
        
        // Realistic proportions: head is about 1/7 of total height
        const headSize = Math.max(width * 0.4, height * 0.25);
        const headY = y;
        const headCenterY = y + headSize / 2;
        const neckHeight = headSize * 0.15;
        const torsoY = y + headSize + neckHeight;
        const torsoHeight = height * 0.4;
        const legY = torsoY + torsoHeight;
        const legHeight = height - (headSize + neckHeight + torsoHeight);
        
        // Body colors - more realistic clothing colors
        const shirtColors = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
        const pantsColor = '#34495e';
        const bodyColor = isHero ? '#f9ca24' : (scared ? '#e74c3c' : shirtColors[Math.floor((x + y) % shirtColors.length)]);
        
        // === DRAW LEGS FIRST (behind body) ===
        const legWidth = width * 0.15;
        const legSpacing = width * 0.25;
        
        // Left leg
        this.ctx.fillStyle = pantsColor;
        this.ctx.fillRect(personCenterX - legSpacing - legWidth/2, legY, legWidth, legHeight);
        // Right leg
        this.ctx.fillRect(personCenterX + legSpacing - legWidth/2, legY, legWidth, legHeight);
        
        // Leg outlines
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(personCenterX - legSpacing - legWidth/2, legY, legWidth, legHeight);
        this.ctx.strokeRect(personCenterX + legSpacing - legWidth/2, legY, legWidth, legHeight);
        
        // === DRAW TORSO (body/shirt) ===
        const torsoWidth = width * 0.5;
        this.ctx.fillStyle = bodyColor;
        this.ctx.beginPath();
        // Torso shape (slightly tapered)
        this.ctx.moveTo(personCenterX - torsoWidth/2, torsoY);
        this.ctx.lineTo(personCenterX - torsoWidth/2 * 0.9, torsoY + torsoHeight);
        this.ctx.lineTo(personCenterX + torsoWidth/2 * 0.9, torsoY + torsoHeight);
        this.ctx.lineTo(personCenterX + torsoWidth/2, torsoY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Torso outline
        this.ctx.strokeStyle = scared ? '#c0392b' : '#2980b9';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Shirt details (collar, buttons)
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 1;
        // Collar
        this.ctx.beginPath();
        this.ctx.moveTo(personCenterX - torsoWidth/2 * 0.7, torsoY);
        this.ctx.lineTo(personCenterX, torsoY + neckHeight * 0.5);
        this.ctx.lineTo(personCenterX + torsoWidth/2 * 0.7, torsoY);
        this.ctx.stroke();
        
        // Buttons (if not scared)
        if (!scared) {
            for (let i = 1; i <= 3; i++) {
                this.ctx.fillStyle = '#34495e';
                this.ctx.beginPath();
                this.ctx.arc(personCenterX, torsoY + torsoHeight * (0.2 + i * 0.2), 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // === DRAW ARMS ===
        const armWidth = width * 0.12;
        this.ctx.strokeStyle = '#ffdbac'; // Skin color for arms
        this.ctx.lineWidth = armWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (scared && isMoving) {
            // Arms raised in panic/reaching
            this.ctx.beginPath();
            this.ctx.moveTo(personCenterX - torsoWidth/2 * 0.8, torsoY + torsoHeight * 0.2);
            this.ctx.lineTo(personCenterX - width * 0.4, headY - headSize * 0.1);
            this.ctx.moveTo(personCenterX + torsoWidth/2 * 0.8, torsoY + torsoHeight * 0.2);
            this.ctx.lineTo(personCenterX + width * 0.4, headY - headSize * 0.1);
            this.ctx.stroke();
        } else {
            // Arms at sides (natural position)
            this.ctx.beginPath();
            this.ctx.moveTo(personCenterX - torsoWidth/2 * 0.8, torsoY + torsoHeight * 0.2);
            this.ctx.lineTo(personCenterX - width * 0.35, legY + legHeight * 0.3);
            this.ctx.moveTo(personCenterX + torsoWidth/2 * 0.8, torsoY + torsoHeight * 0.2);
            this.ctx.lineTo(personCenterX + width * 0.35, legY + legHeight * 0.3);
            this.ctx.stroke();
        }
        
        // === DRAW NECK ===
        this.ctx.fillStyle = '#ffdbac'; // Skin color
        this.ctx.fillRect(personCenterX - width * 0.08, y + headSize, width * 0.16, neckHeight);
        
        // === DRAW HEAD ===
        // Head shape (slightly oval, more realistic)
        this.ctx.fillStyle = '#ffdbac';
        this.ctx.beginPath();
        this.ctx.ellipse(personCenterX, headCenterY, headSize/2, headSize/2 * 0.9, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Head outline
        this.ctx.strokeStyle = '#d4a574';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // === DRAW HAIR ===
        const hairColors = ['#8B4513', '#654321', '#000000', '#4A4A4A', '#D2691E'];
        const hairColor = hairColors[Math.floor((x + y * 2) % hairColors.length)];
        this.ctx.fillStyle = hairColor;
        this.ctx.beginPath();
        // Hair sits on top of head
        this.ctx.ellipse(personCenterX, headY + headSize * 0.2, headSize/2 * 0.9, headSize/2 * 0.4, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Hair texture (lines)
        this.ctx.strokeStyle = hairColor;
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const hairX = personCenterX - headSize/2 * 0.6 + (headSize * 0.6 / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(hairX, headY + headSize * 0.15);
            this.ctx.lineTo(hairX + (Math.random() - 0.5) * 3, headY + headSize * 0.35);
            this.ctx.stroke();
        }
        
        // === DRAW FACE ===
        const eyeSize = Math.max(2, headSize * 0.15);
        const eyeY = headCenterY - headSize * 0.1;
        const eyeSpacing = headSize * 0.2;
        
        // Eyebrows
        this.ctx.strokeStyle = hairColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(personCenterX - eyeSpacing - eyeSize, eyeY - eyeSize);
        this.ctx.lineTo(personCenterX - eyeSpacing + eyeSize, eyeY - eyeSize * 0.5);
        this.ctx.moveTo(personCenterX + eyeSpacing - eyeSize, eyeY - eyeSize * 0.5);
        this.ctx.lineTo(personCenterX + eyeSpacing + eyeSize, eyeY - eyeSize);
        this.ctx.stroke();
        
        // Eyes (white sclera)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(personCenterX - eyeSpacing, eyeY, eyeSize * 0.8, eyeSize * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(personCenterX + eyeSpacing, eyeY, eyeSize * 0.8, eyeSize * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye outlines
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        // Pupils
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(personCenterX - eyeSpacing, eyeY, eyeSize * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(personCenterX + eyeSpacing, eyeY, eyeSize * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye shine (realistic detail)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(personCenterX - eyeSpacing - eyeSize * 0.15, eyeY - eyeSize * 0.1, eyeSize * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(personCenterX + eyeSpacing - eyeSize * 0.15, eyeY - eyeSize * 0.1, eyeSize * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Nose
        this.ctx.strokeStyle = '#d4a574';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(personCenterX, eyeY + eyeSize);
        this.ctx.lineTo(personCenterX, eyeY + eyeSize * 2);
        this.ctx.stroke();
        
        // Mouth
        const mouthY = headCenterY + headSize * 0.2;
        if (scared) {
            // Open mouth (scared/panicked)
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.ellipse(personCenterX, mouthY, eyeSize * 0.8, eyeSize * 1.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            // Teeth
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(personCenterX - eyeSize * 0.4, mouthY - eyeSize * 0.3, eyeSize * 0.8, eyeSize * 0.4);
        } else {
            // Smile
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(personCenterX, mouthY, eyeSize * 0.7, 0.3, Math.PI - 0.3);
            this.ctx.stroke();
        }
        
        // Hero indicator (glow/aura)
        if (isHero) {
            this.ctx.shadowColor = '#f9ca24';
            this.ctx.shadowBlur = 10;
            this.ctx.strokeStyle = '#f9ca24';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(personCenterX, headCenterY, headSize/2 + 3, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
    },
    
    drawDrowningPerson(block) {
        // Person falling into water - show panic, bubbles, splash
        const personCenterX = block.x + block.width / 2;
        const headSize = Math.max(block.width * 0.4, block.height * 0.25);
        const headCenterY = block.y + headSize / 2;
        
        // Draw person in panic pose (arms flailing)
        this.ctx.save();
        // Rotate slightly as they fall
        const rotation = (block.velocity || 0) * 0.1;
        this.ctx.translate(personCenterX, block.y + block.height / 2);
        this.ctx.rotate(rotation);
        this.ctx.translate(-personCenterX, -(block.y + block.height / 2));
        
        // Draw person (scared/panicked version)
        this.drawPerson(block.x, block.y, block.width, block.height, true, true, block.isHero);
        
        this.ctx.restore();
        
        // Splash effect at water surface
        if (block.y + block.height >= this.water.y - 5 && block.y + block.height <= this.water.y + 10) {
            const splashX = personCenterX;
            const splashY = this.water.y;
            
            // Water splash (white/blue droplets)
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const distance = 10 + Math.random() * 15;
                const dropX = splashX + Math.cos(angle) * distance;
                const dropY = splashY + Math.sin(angle) * distance * 0.5;
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(dropX, dropY, 2 + Math.random() * 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Bubbles rising from person
        if (block.y >= this.water.y - block.height) {
            for (let i = 0; i < 5; i++) {
                const bubbleX = block.x + (block.width * (0.2 + Math.random() * 0.6));
                const bubbleY = block.y + block.height - (block.height * Math.random());
                const bubbleSize = 2 + Math.random() * 3;
                
                this.ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
    },
    
    drawDrownedPerson(block) {
        // Person underwater - faded, blue tint, bubbles
        this.ctx.save();
        this.ctx.globalAlpha = 0.5; // Semi-transparent underwater
        
        // Blue tint for underwater effect
        this.ctx.fillStyle = 'rgba(64, 156, 255, 0.3)';
        this.ctx.fillRect(block.x, block.y, block.width, block.height);
        
        // Draw person but faded and blue-tinted
        this.ctx.globalCompositeOperation = 'multiply';
        this.drawPerson(block.x, block.y, block.width, block.height, false, false, false);
        this.ctx.globalCompositeOperation = 'source-over';
        
        this.ctx.restore();
        
        // Continuous bubbles from drowned person
        for (let i = 0; i < 3; i++) {
            const time = Date.now() * 0.001;
            const bubbleX = block.x + block.width * (0.3 + i * 0.2);
            const bubbleY = block.y - (time * 20 + i * 10) % 30;
            const bubbleSize = 1 + Math.random() * 2;
            
            if (bubbleY > this.water.y) {
                this.ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
    },
    
    drawDeadPerson(block) {
        // Dead person (gray, lifeless)
        this.ctx.save();
        this.ctx.globalAlpha = 0.6;
        
        // Gray tint
        this.ctx.fillStyle = config.colors.deadHuman;
        this.ctx.fillRect(block.x, block.y, block.width, block.height);
        
        // Draw person but grayed out
        this.ctx.globalCompositeOperation = 'multiply';
        this.drawPerson(block.x, block.y, block.width, block.height, false, false, false);
        this.ctx.globalCompositeOperation = 'source-over';
        
        this.ctx.restore();
    },
    
    drawMenu() {
        const width = config.canvas.width;
        const height = config.canvas.height;
        
        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0f3460');
        gradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);
        
        // Water at bottom
        this.ctx.fillStyle = config.colors.water;
        this.ctx.fillRect(0, height - 100, width, 100);
        
        // Title
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.font = 'bold 64px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('THE RISING', width / 2, height * 0.25);
        this.ctx.fillText('THE RISING', width / 2, height * 0.25);
        
        // Subtitle
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Stack the living. Remember the dead.', width / 2, height * 0.35);
        
        // Start instruction (pulsing)
        const alpha = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillText('PRESS ENTER TO START', width / 2, height * 0.55);
        
        // Controls
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('CONTROLS:', width / 2, height * 0.68);
        this.ctx.fillText('ENTER/SPACE - Place block', width / 2, height * 0.73);
        this.ctx.fillText('ESC/P - Pause', width / 2, height * 0.78);
        this.ctx.fillText('R - Restart', width / 2, height * 0.83);
        
        // Wave emoji
        this.ctx.font = '48px Arial';
        this.ctx.fillText('🌊', width / 2, height * 0.92);
    },
    
    drawPausedOverlay() {
        const width = config.canvas.width;
        const height = config.canvas.height;
        
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);
        
        // Paused text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 64px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('PAUSED', width / 2, height * 0.4);
        this.ctx.fillText('PAUSED', width / 2, height * 0.4);
        
        // Instructions
        this.ctx.font = '24px Arial';
        this.ctx.fillText('ESC or P - Resume', width / 2, height * 0.55);
        this.ctx.fillText('R - Restart', width / 2, height * 0.62);
    },
    
    gameLoop() {
        try {
            this.update();
            this.draw();
            
            // Draw paused overlay on top if paused
            if (this.state === 'paused') {
                this.drawPausedOverlay();
            }
        } catch (e) {
            console.error('Error in gameLoop:', e);
            const msg = document.getElementById('message');
            if (msg) {
                msg.textContent = 'LOOP ERROR: ' + (e && e.message ? e.message : e);
                msg.classList.add('show');
            }
            // Stop the loop on error
            return;
        }
        
        requestAnimationFrame(() => this.gameLoop());
    },
    
    updateUI() {
        document.getElementById('level').textContent = `LEVEL ${this.level}`;
        document.getElementById('survivors').textContent = `SURVIVORS: ${this.survivors}/${this.totalPeople}`;
        // Add score display if element exists
        const scoreEl = document.getElementById('score');
        if (scoreEl) {
            scoreEl.textContent = `SCORE: ${this.score}`;
        }
    },
    
    showMessage(text) {
        const msg = document.getElementById('message');
        // Replace all newlines with <br> tags
        msg.innerHTML = text.replace(/\n/g, '<br>');
        msg.classList.add('show');
    },
    
    hideMessage() {
        document.getElementById('message').classList.remove('show');
    }
};

// Start game when page loads, with visible error reporting
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

