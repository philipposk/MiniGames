// THE RISING - PROPER VERSION WITH STACK LOGIC & GRAPHICS

const config = {
    canvas: {
        width: 500,
        height: 800
    },
    block: {
        width: 100,
        height: 50,
        speed: 2.5
    },
    colors: {
        water: 'rgba(50, 150, 255, 0.8)',
        sky: '#1a1a2e',
        boat: '#8B4513',
        raft: '#CD853F',
        mattress: '#FF4500',
        person: '#ff3366',
        personHero: '#f9ca24',
        deadPerson: 'rgba(100, 100, 100, 0.6)'
    }
};

// Simple sound effects using Web Audio API
const sounds = {
    audioContext: null,
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    },
    
    playStack() { this.playTone(440, 0.1); }, // A note
    playSplash() { this.playTone(220, 0.3, 'sawtooth'); }, // Low splash
    playFreeze() { this.playTone(880, 1.0, 'triangle'); }, // High freeze sound
    playLevelComplete() { this.playTone(660, 0.5); }, // Success sound
    playGameOver() { this.playTone(110, 1.0, 'sawtooth'); } // Low game over
};

const game = {
    canvas: null,
    ctx: null,
    state: 'menu', // menu, playing, levelComplete
    level: 1,
    survivors: 30,
    
    currentBlock: null,
    stackedBlocks: [],
    deadBlocks: [],
    
    water: { y: 650, rising: true },
    targetHeight: 150,
    score: 0,
    freezingProgress: 0,
    waterRiseSpeed: 0.6, // Water rises faster - starts at 0.6, increases each level
    
    init() {
        console.log('=== GAME INIT ===');
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize sound
        sounds.init();
        
        if (!this.canvas || !this.ctx) {
            console.error('Canvas or context not found!');
            return;
        }
        
        this.canvas.width = config.canvas.width;
        this.canvas.height = config.canvas.height;
        
        console.log(`Canvas ready: ${this.canvas.width}x${this.canvas.height}`);
        
        // Events
        this.canvas.addEventListener('click', () => this.handleTap());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleTap();
            }
            if (e.key === 'r' || e.key === 'R') {
                this.restartGame();
            }
        });
        
        this.gameLoop();
    },
    
    handleTap() {
        console.log('TAP - State:', this.state);
        
        if (this.state === 'menu') {
            this.startGame();
            return;
        }
        
        if (this.state === 'playing' && this.currentBlock) {
            this.placeBlock();
        }
    },
    
    startGame() {
        console.log('=== START GAME ===');
        this.state = 'playing';
        this.level = 1;
        this.survivors = 30;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.currentBlock = null;
        this.water.y = 650;
        this.water.rising = true;
        this.score = 0;
        this.targetHeight = 250; // Lower target - more achievable (was 150, too high)
        this.waterRiseSpeed = 0.6; // Start at 0.6, increases each level
        
        this.spawnBlock();
    },
    
    spawnBlock() {
        console.log('>>> SPAWN BLOCK');
        
        if (this.survivors <= 0) {
            console.log('No survivors left, level over');
            this.state = 'levelComplete';
            return;
        }
        
        const lastBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        
        // Spawn above last block or at safe height
        let startY;
        if (lastBlock) {
            startY = lastBlock.y - config.block.height - 15;
        } else {
            startY = config.canvas.height - 300;
        }
        
        // Spawn from LEFT or RIGHT alternately
        let startX;
        let direction;
        if (this.stackedBlocks.length % 2 === 0) {
            startX = -config.block.width;
            direction = 1; // Move right
        } else {
            startX = config.canvas.width;
            direction = -1; // Move left
        }
        
        const floatType = ['boat', 'raft', 'mattress'][Math.floor(Math.random() * 3)];
        const isHero = this.stackedBlocks.length === 0;
        const peopleCount = 5 + Math.floor(Math.random() * 2); // 5-6 people
        
        this.currentBlock = {
            x: startX,
            y: startY,
            width: config.block.width,
            height: config.block.height,
            peopleCount: peopleCount,
            isHero: isHero,
            direction: direction,
            floatType: floatType,
            velocity: 0
        };
        
        // Only decrement survivors if we have enough (prevent negative)
        const peopleToUse = Math.min(peopleCount, this.survivors);
        this.survivors = Math.max(0, this.survivors - peopleToUse);
        this.currentBlock.peopleCount = peopleToUse; // Use actual count
        
        console.log(`Block spawned: ${peopleToUse} people, moving dir=${direction}, survivors left: ${this.survivors}`);
    },
    
    placeBlock() {
        console.log('<<< PLACE BLOCK at x=' + Math.floor(this.currentBlock.x));
        
        if (this.stackedBlocks.length === 0) {
            // First block always succeeds
            this.stackedBlocks.push({...this.currentBlock});
            this.score += 10;
            sounds.playStack();
            console.log('First block placed!');
        } else {
            // Check overlap with block below
            const below = this.stackedBlocks[this.stackedBlocks.length - 1];
            
            // Calculate overlap
            const overlapStart = Math.max(this.currentBlock.x, below.x);
            const overlapEnd = Math.min(this.currentBlock.x + this.currentBlock.width, below.x + below.width);
            const overlapWidth = Math.max(0, overlapEnd - overlapStart);
            const overlapRatio = overlapWidth / this.currentBlock.width;
            
            console.log(`Overlap: ${(overlapRatio * 100).toFixed(0)}%`);
            
            if (overlapRatio > 0.3) {
                // Enough overlap to save some people
                const peopleSaved = Math.floor(this.currentBlock.peopleCount * overlapRatio);
                const peopleKilled = this.currentBlock.peopleCount - peopleSaved;
                
                // Place the stable part
                this.currentBlock.x = overlapStart;
                this.currentBlock.width = overlapWidth;
                this.currentBlock.peopleCount = peopleSaved;
                this.currentBlock.y = below.y - config.block.height - 15;
                
                this.stackedBlocks.push({...this.currentBlock});
                this.score += 10 * peopleSaved;
                sounds.playStack();
                
                // Show fallen people
                if (peopleKilled > 0) {
                    sounds.playSplash();
                    for (let i = 0; i < peopleKilled; i++) {
                        this.deadBlocks.push({
                            x: overlapEnd + Math.random() * 40,
                            y: below.y + config.block.height + i * 15,
                            width: 15,
                            height: 15,
                            falling: true,
                            velocity: 0
                        });
                    }
                }
                
                // Check if hero died
                if (this.currentBlock.isHero && peopleSaved === 0) {
                    console.log('HERO DIED!');
                    sounds.playGameOver();
                    this.state = 'gameOver';
                    return;
                }
                
                console.log(`Placed! Saved ${peopleSaved}, killed ${peopleKilled}`);
            } else {
                // NOT ENOUGH OVERLAP - ENTIRE BOAT FALLS INTO THE SEA
                console.log('NOT ENOUGH OVERLAP - ENTIRE BOAT FALLS INTO SEA');
                
                // All people fall into water immediately
                for (let i = 0; i < this.currentBlock.peopleCount; i++) {
                    this.deadBlocks.push({
                        x: this.currentBlock.x + Math.random() * this.currentBlock.width,
                        y: this.water.y + Math.random() * 30, // Drop directly into water
                        width: 15,
                        height: 15,
                        falling: false,
                        drowned: true, // Immediately drowned
                        velocity: 0
                    });
                }
                
                // If hero was on this boat, game over
                if (this.currentBlock.isHero) {
                    console.log('HERO DIED - BOAT FELL INTO SEA');
                    sounds.playGameOver();
                    this.state = 'gameOver';
                    return;
                }
            }
        }
        
        this.currentBlock = null;
        
        // Check if level complete - ANY person above goal line = WIN
        this.checkLevelComplete();
        
        this.spawnBlock();
    },
    
    checkLevelComplete() {
        // Don't check if already transitioning
        if (this.state !== 'playing') return false;
        
        // Check if ANY person (top of block) is above the target line
        if (this.stackedBlocks.length === 0) return false;
        
        for (let block of this.stackedBlocks) {
            // Block.y is the bottom of the boat, person sits on top
            // Person height is 12px, so top of person is block.y - 12
            const personHeight = 12;
            const personTop = block.y - personHeight;
            
            // Also check if the boat itself reaches the target
            const boatReachesTarget = block.y <= this.targetHeight;
            const personReachesTarget = personTop <= this.targetHeight;
            
            if (boatReachesTarget || personReachesTarget) {
                console.log(`🎯 LEVEL COMPLETE! Block Y=${Math.floor(block.y)}, Person Top=${Math.floor(personTop)}, Target=${this.targetHeight}`);
                console.log(`   Boat reaches: ${boatReachesTarget}, Person reaches: ${personReachesTarget}`);
                this.nextLevel();
                return true;
            }
        }
        return false;
    },
    
    nextLevel() {
        // Prevent multiple calls
        if (this.state === 'freezing' || this.state === 'levelComplete' || this.state === 'ending') {
            console.log('Already transitioning, ignoring nextLevel call');
            return;
        }
        
        this.level++;
        
        // After level 10, go to ending
        if (this.level > 10) {
            this.state = 'ending';
            console.log('ASCENDING TO HEAVEN...');
            return;
        }
        
        // Freezing animation
        this.state = 'freezing';
        this.freezingProgress = 0;
        sounds.playFreeze();
        
        // Clear any existing freeze interval
        if (this.freezeInterval) {
            clearInterval(this.freezeInterval);
        }
        
        this.freezeInterval = setInterval(() => {
            this.freezingProgress += 0.02;
            if (this.freezingProgress >= 1) {
                clearInterval(this.freezeInterval);
                this.freezeInterval = null;
                this.state = 'levelComplete';
                this.levelCompleteTime = Date.now(); // Track when we entered this state
                sounds.playLevelComplete();
                console.log(`✅ Freezing complete! Level ${this.level} finished. Starting next level in 2 seconds...`);
                
                // Clear the interval reference
                this.freezeInterval = null;
                
                setTimeout(() => {
                    console.log(`🚀 Starting Level ${this.level}...`);
                    this.levelCompleteTime = null; // Clear timer since we're advancing
                    
                    // Reset for next level
                    this.state = 'playing';
                    this.stackedBlocks = [];
                    this.deadBlocks = [];
                    this.currentBlock = null;
                    
                    // Water gets progressively harder
                    const waterY = 650 - (this.level - 1) * 35;
                    this.water.y = Math.max(100, waterY); // Never go too high
                    
                    const targetY = 250 - (this.level - 1) * 20; // Start at 250, get harder each level
                    this.targetHeight = Math.max(50, targetY); // Never go too high (minimum 50)
                    
                    // More survivors join each level
                    this.survivors = 30 + this.level * 8;
                    
                    // Water rises faster each level (more tension!)
                    this.waterRiseSpeed = 0.6 + (this.level - 1) * 0.15; // 0.6, 0.75, 0.9, 1.05, etc.
                    
                    console.log(`=== LEVEL ${this.level} START === (Water: ${this.water.y}, Target: ${this.targetHeight}, Water Speed: ${this.waterRiseSpeed.toFixed(2)}, Survivors: ${this.survivors})`);
                    this.spawnBlock();
                }, 2000);
            }
        }, 50);
    },
    
    forceNextLevel() {
        console.log(`🚀 FORCE ADVANCING to Level ${this.level}...`);
        
        // Reset for next level
        this.state = 'playing';
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.currentBlock = null;
        
        // Water gets progressively harder
        const waterY = 650 - (this.level - 1) * 35;
        this.water.y = Math.max(100, waterY);
        
        const targetY = 250 - (this.level - 1) * 20;
        this.targetHeight = Math.max(50, targetY);
        
        // More survivors join each level
        this.survivors = 30 + this.level * 8;
        
        // Water rises faster each level
        this.waterRiseSpeed = 0.6 + (this.level - 1) * 0.15;
        
        console.log(`=== LEVEL ${this.level} START (FORCED) === (Water: ${this.water.y}, Target: ${this.targetHeight}, Water Speed: ${this.waterRiseSpeed.toFixed(2)}, Survivors: ${this.survivors})`);
        this.spawnBlock();
    },
    
    restartGame() {
        console.log('=== RESTART ===');
        
        // Clear any running intervals
        if (this.freezeInterval) {
            clearInterval(this.freezeInterval);
            this.freezeInterval = null;
        }
        
        this.state = 'menu';
        this.level = 1;
        this.score = 0;
        this.survivors = 30;
        this.stackedBlocks = [];
        this.deadBlocks = [];
        this.currentBlock = null;
        this.water.y = 650;
        this.water.rising = true;
        this.targetHeight = 150;
        this.waterRiseSpeed = 0.6; // Reset to starting speed
        this.freezingProgress = 0;
    },
    
    update() {
        // Handle stuck levelComplete state (fallback)
        if (this.state === 'levelComplete') {
            if (!this.levelCompleteTime) {
                this.levelCompleteTime = Date.now();
            } else if (Date.now() - this.levelCompleteTime > 3000) {
                // Been stuck for more than 3 seconds, force advance
                console.log('⚠️ Level complete stuck, forcing advance...');
                this.levelCompleteTime = null;
                this.forceNextLevel();
            }
            return;
        }
        
        if (this.state !== 'playing') return;
        
        // Move block side to side
        if (this.currentBlock) {
            this.currentBlock.x += config.block.speed * this.currentBlock.direction;
            
            // Bounce off walls
            if (this.currentBlock.x <= 0) {
                this.currentBlock.direction = 1;
                this.currentBlock.x = 0;
            } else if (this.currentBlock.x + this.currentBlock.width >= config.canvas.width) {
                this.currentBlock.direction = -1;
                this.currentBlock.x = config.canvas.width - this.currentBlock.width;
            }
        }
        
        // Update falling people
        this.deadBlocks.forEach(person => {
            if (person.falling) {
                person.velocity += 0.3;
                person.y += person.velocity;
                
                if (person.y >= this.water.y) {
                    person.falling = false;
                    person.drowned = true;
                }
            }
        });
        
        // Check level complete during update (in case blocks are already high enough)
        if (this.state === 'playing') {
            this.checkLevelComplete();
        }
        
        // Rise water - faster as levels increase
        if (this.water.rising && this.water.y > this.targetHeight) {
            this.water.y -= this.waterRiseSpeed;
        }
    },
    
    draw() {
        // SKY
        this.ctx.fillStyle = config.colors.sky;
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        // MENU
        if (this.state === 'menu') {
            this.drawMenu();
            return;
        }
        
        if (this.state === 'levelComplete') {
            this.drawLevelComplete();
            return;
        }
        
        if (this.state === 'gameOver') {
            this.drawGameOver();
            return;
        }
        
        if (this.state === 'gameWon') {
            this.drawGameWon();
            return;
        }
        
        if (this.state === 'freezing') {
            this.drawFreezing();
            return;
        }
        
        if (this.state === 'ending') {
            this.drawEnding();
            return;
        }
        
        // WATER
        this.ctx.fillStyle = config.colors.water;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, config.canvas.height - this.water.y);
        
        // Water line
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.water.y);
        this.ctx.lineTo(config.canvas.width, this.water.y);
        this.ctx.stroke();
        
        // TARGET LINE
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.targetHeight);
        this.ctx.lineTo(config.canvas.width, this.targetHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText('GOAL', 10, this.targetHeight - 8);
        
        // STACKED BLOCKS
        this.stackedBlocks.forEach(block => {
            this.drawHuman(block);
        });
        
        // DEAD/FALLING PEOPLE
        this.deadBlocks.forEach(person => {
            this.ctx.fillStyle = person.drowned ? config.colors.deadPerson : config.colors.person;
            this.ctx.fillRect(person.x, person.y, person.width, person.height);
        });
        
        // CURRENT MOVING BLOCK
        if (this.currentBlock) {
            this.drawHuman(this.currentBlock);
        }
        
        // UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`LEVEL ${this.level}`, 15, 35);
        this.ctx.fillText(`SURVIVORS: ${Math.max(0, this.survivors)}`, 15, 65);
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`SCORE: ${this.score}`, 15, 90);
        
        // Debug
        if (this.currentBlock) {
            this.ctx.font = '12px monospace';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fillText(`X:${Math.floor(this.currentBlock.x)} People:${this.currentBlock.peopleCount}`, 15, 110);
        }
    },
    
    drawBoat(block) {
        const boatHeight = block.height * 0.4;
        const boatY = block.y + block.height - boatHeight;
        
        // Boat hull
        let hullColor;
        if (block.floatType === 'boat') hullColor = config.colors.boat;
        else if (block.floatType === 'mattress') hullColor = config.colors.mattress;
        else hullColor = config.colors.raft;
        
        this.ctx.fillStyle = hullColor;
        this.ctx.beginPath();
        this.ctx.moveTo(block.x + 5, boatY);
        this.ctx.lineTo(block.x + block.width - 5, boatY);
        this.ctx.lineTo(block.x + block.width, boatY + boatHeight);
        this.ctx.lineTo(block.x, boatY + boatHeight);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Boat outline
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // People on boat (overcrowded)
        const peopleHeight = block.height * 0.6;
        const personWidth = block.width / block.peopleCount;
        
        for (let i = 0; i < block.peopleCount; i++) {
            const personX = block.x + i * personWidth + personWidth * 0.1;
            const personY = block.y;
            
            // Head
            this.ctx.fillStyle = '#ffdbac';
            const headSize = Math.min(personWidth * 0.35, peopleHeight * 0.4);
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth * 0.4, personY + headSize * 0.5, headSize * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Head outline
            this.ctx.strokeStyle = '#d4a574';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Body
            this.ctx.fillStyle = block.isHero && i === 0 ? config.colors.personHero : config.colors.person;
            this.ctx.fillRect(personX + personWidth * 0.2, personY + headSize * 0.8, personWidth * 0.6, peopleHeight * 0.4);
            
            // Eyes
            this.ctx.fillStyle = '#ffffff';
            const eyeSize = 2;
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth * 0.25, personY + headSize * 0.35, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth * 0.55, personY + headSize * 0.35, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Pupils
            this.ctx.fillStyle = '#000000';
            const pupilSize = 1;
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth * 0.25, personY + headSize * 0.35, pupilSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth * 0.55, personY + headSize * 0.35, pupilSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
    },
    
    drawMenu() {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('THE RISING', config.canvas.width / 2, 200);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.fillText('Stack the living. Remember the dead.', config.canvas.width / 2, 280);
        
        const pulsing = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulsing})`;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillText('PRESS ENTER', config.canvas.width / 2, 450);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fillText('ENTER/SPACE - Place block', config.canvas.width / 2, 550);
        this.ctx.fillText('R - Restart', config.canvas.width / 2, 590);
    },
    
    drawLevelComplete() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEVEL COMPLETE!', config.canvas.width / 2, config.canvas.height / 2 - 40);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`SCORE: ${this.score}`, config.canvas.width / 2, config.canvas.height / 2 + 40);
    },
    
    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        this.ctx.fillStyle = '#ff4444';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', config.canvas.width / 2, config.canvas.height / 2 - 40);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Press R to restart', config.canvas.width / 2, config.canvas.height / 2 + 40);
    },
    
    drawGameWon() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('YOU SURVIVED!', config.canvas.width / 2, config.canvas.height / 2 - 80);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`FINAL SCORE: ${this.score}`, config.canvas.width / 2, config.canvas.height / 2 - 20);
        this.ctx.fillText('10 LEVELS COMPLETED', config.canvas.width / 2, config.canvas.height / 2 + 20);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Press R to restart', config.canvas.width / 2, config.canvas.height / 2 + 80);
    },
    
    drawFreezing() {
        // Draw the normal game state first
        this.ctx.fillStyle = config.colors.sky;
        this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
        
        // WATER
        this.ctx.fillStyle = config.colors.water;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, config.canvas.height - this.water.y);
        
        // TARGET LINE
        this.ctx.strokeStyle = config.colors.target;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.targetHeight);
        this.ctx.lineTo(config.canvas.width, this.targetHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw stacked blocks
        this.stackedBlocks.forEach(block => this.drawHuman(block));
        
        // Draw falling people
        this.deadBlocks.forEach(person => {
            if (person.drowned) {
                this.ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
                this.ctx.fillRect(person.x, person.y, person.width, person.height);
            } else {
                this.drawHuman(person);
            }
        });
        
        // FREEZING EFFECT - Ice overlay
        const iceHeight = (config.canvas.height - this.water.y) * this.freezingProgress;
        const gradient = this.ctx.createLinearGradient(0, this.water.y, 0, this.water.y + iceHeight);
        gradient.addColorStop(0, 'rgba(173, 216, 230, 0.8)'); // Light blue
        gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.6)'); // Sky blue
        gradient.addColorStop(1, 'rgba(70, 130, 180, 0.4)'); // Steel blue
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, iceHeight);
        
        // Ice crystals effect
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * config.canvas.width;
            const y = this.water.y + Math.random() * iceHeight;
            const size = Math.random() * 3 + 1;
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Freezing text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText('FREEZING...', config.canvas.width / 2, config.canvas.height / 2);
        this.ctx.fillText('FREEZING...', config.canvas.width / 2, config.canvas.height / 2);
        
        // Progress bar
        const barWidth = 200;
        const barHeight = 20;
        const barX = (config.canvas.width - barWidth) / 2;
        const barY = config.canvas.height / 2 + 50;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        this.ctx.fillStyle = '#4ecca3';
        this.ctx.fillRect(barX, barY, barWidth * this.freezingProgress, barHeight);
        
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
    },
    
    drawHuman(block) {
        if (!block) return;
        
        // Draw boat/raft first
        this.ctx.fillStyle = config.colors.boat;
        this.ctx.fillRect(block.x, block.y, block.width, block.height);
        
        // Boat outline
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(block.x, block.y, block.width, block.height);
        
        // Draw people on the boat
        const peopleCount = block.peopleCount || 1;
        const personWidth = Math.max(8, block.width / peopleCount - 2);
        const personHeight = 12;
        
        for (let i = 0; i < peopleCount; i++) {
            const personX = block.x + (i * (block.width / peopleCount)) + 2;
            const personY = block.y - personHeight;
            
            // Person color (hero is yellow)
            const isHero = block.isHero && i === 0;
            this.ctx.fillStyle = isHero ? config.colors.personHero : config.colors.person;
            
            // Body
            this.ctx.fillRect(personX, personY, personWidth, personHeight);
            
            // Head
            this.ctx.beginPath();
            this.ctx.arc(personX + personWidth/2, personY - 4, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Eyes (scared expression)
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(personX + personWidth/2 - 2, personY - 5, 1, 1);
            this.ctx.fillRect(personX + personWidth/2 + 1, personY - 5, 1, 1);
        }
    },
    
    drawEnding() {
        if (!this.endingPhase) this.endingPhase = 1;
        if (!this.endingTimer) this.endingTimer = Date.now();
        
        const elapsed = Date.now() - this.endingTimer;
        
        if (this.endingPhase === 1 && elapsed < 3000) {
            // Phase 1: Ascending to Heaven (0-3 seconds)
            const gradient = this.ctx.createLinearGradient(0, 0, 0, config.canvas.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#FFD700');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('ASCENDING TO HEAVEN...', config.canvas.width / 2, config.canvas.height / 2);
            
        } else if (this.endingPhase === 1) {
            this.endingPhase = 2;
            this.endingTimer = Date.now();
        }
        
        if (this.endingPhase === 2 && elapsed < 4000) {
            // Phase 2: Meet St. Peter (3-7 seconds)
            const gradient = this.ctx.createLinearGradient(0, 0, 0, config.canvas.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#FFD700');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            // St. Peter
            const peterX = config.canvas.width / 2;
            const peterY = 200;
            
            // Halo
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(peterX, peterY - 30, 50, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Head
            this.ctx.fillStyle = '#FDBCB4';
            this.ctx.beginPath();
            this.ctx.arc(peterX, peterY - 30, 25, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Robe
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(peterX - 40, peterY, 80, 100);
            
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('St. Peter: "Wait... what?"', config.canvas.width / 2, 400);
            this.ctx.font = '18px Arial';
            this.ctx.fillText('Looking at your record...', config.canvas.width / 2, 440);
            
        } else if (this.endingPhase === 2) {
            this.endingPhase = 3;
            this.endingTimer = Date.now();
        }
        
        if (this.endingPhase === 3 && elapsed < 4000) {
            // Phase 3: St. Peter gets ANGRY (7-11 seconds)
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            const peterX = config.canvas.width / 2;
            const peterY = 200;
            
            // Angry St. Peter
            this.ctx.fillStyle = '#FDBCB4';
            this.ctx.beginPath();
            this.ctx.arc(peterX, peterY - 30, 25, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Angry eyes
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(peterX - 15, peterY - 40, 8, 8);
            this.ctx.fillRect(peterX + 7, peterY - 40, 8, 8);
            
            // Robe
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(peterX - 40, peterY, 80, 100);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('BUT YOU LET THEM ALL', config.canvas.width / 2, 380);
            this.ctx.fillText('DIEEEEEE!!!', config.canvas.width / 2, 420);
            
            this.ctx.font = '20px Arial';
            this.ctx.fillText('(Getting lunatic-crazy-sad-frustrated)', config.canvas.width / 2, 460);
            
        } else if (this.endingPhase === 3) {
            this.endingPhase = 4;
            this.endingTimer = Date.now();
        }
        
        if (this.endingPhase === 4 && elapsed < 2000) {
            // Phase 4: SPARTA KICK! (11-13 seconds)
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 64px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SPARTA KICK!', config.canvas.width / 2, config.canvas.height / 2);
            
            this.ctx.font = '24px Arial';
            this.ctx.fillText('*BOOT*', config.canvas.width / 2, config.canvas.height / 2 + 60);
            
        } else if (this.endingPhase === 4) {
            this.endingPhase = 5;
            this.endingTimer = Date.now();
        }
        
        if (this.endingPhase === 5 && elapsed < 3000) {
            // Phase 5: Falling with flames (13-16 seconds)
            const gradient = this.ctx.createLinearGradient(0, 0, 0, config.canvas.height);
            gradient.addColorStop(0, '#000');
            gradient.addColorStop(0.5, '#ff4500');
            gradient.addColorStop(1, '#ff0000');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            // Falling flames
            for (let i = 0; i < 20; i++) {
                this.ctx.fillStyle = `hsl(${Math.random() * 60}, 100%, 50%)`;
                const x = Math.random() * config.canvas.width;
                const y = (Date.now() * 0.5 + i * 50) % config.canvas.height;
                this.ctx.fillRect(x, y, 10, 30);
            }
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 36px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FALLING...', config.canvas.width / 2, config.canvas.height / 2);
            
        } else if (this.endingPhase === 5) {
            this.endingPhase = 6;
            this.endingTimer = Date.now();
        }
        
        if (this.endingPhase === 6) {
            // Phase 6: Wake up - it was a dream!
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillRect(0, 0, config.canvas.width, config.canvas.height);
            
            // Bed
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(config.canvas.width / 2 - 100, config.canvas.height / 2, 200, 80);
            
            // Person in bed
            this.ctx.fillStyle = '#FDBCB4';
            this.ctx.beginPath();
            this.ctx.arc(config.canvas.width / 2, config.canvas.height / 2 - 20, 20, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('*WAKES UP*', config.canvas.width / 2, 200);
            
            this.ctx.font = '24px Arial';
            this.ctx.fillText('It was all a dream...', config.canvas.width / 2, 250);
            
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = '#4ecca3';
            this.ctx.fillText('IT WILL ALL BE OKAY', config.canvas.width / 2, 600);
            this.ctx.fillText('SHHH...', config.canvas.width / 2, 640);
            
            this.ctx.font = '18px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText('Press R to restart', config.canvas.width / 2, 700);
        }
    },
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
};

// START
window.addEventListener('load', () => {
    console.log('PAGE LOADED - STARTING GAME');
    game.init();
});
