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

// Game State
const game = {
    canvas: null,
    ctx: null,
    level: 2,  // START AT LEVEL 2
    score: 0,
    survivors: 40,  // More survivors for level 2
    totalPeople: 40,
    state: 'playing', // playing, freezing, transitioning, gameOver
    
    currentBlock: null,
    stackedBlocks: [],
    deadBlocks: [],
    frozenLayers: [],  // Will be populated with level 1 frozen data
    
    water: {
        y: 0,  // Will be set in init
        rising: true
    },
    
    targetHeight: 100,  // Will be adjusted in init
    direction: 1,
    spawnFromLeft: true, // Alternate between left and right spawning
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match mobile screen
        this.resizeCanvas();
        
        // CREATE MOCK FROZEN LAYER FROM LEVEL 1
        this.createMockLevel1Frozen();
        
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
        
        // Keyboard controls (Enter or Space to place)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleTap();
            }
        });
        
        this.spawnBlock();
        this.gameLoop();
    },
    
    createMockLevel1Frozen() {
        // Create a realistic frozen layer from "level 1"
        const screenHeight = config.canvas.height;
        const level1WaterLevel = screenHeight * 0.65; // Water froze at 65% of screen
        
        // Create mock blocks that look like they were stacked in level 1
        const mockBlocks = [];
        const blockWidth = config.block.width;
        const blockHeight = config.block.height;
        let currentY = screenHeight - 50;
        let currentX = config.canvas.width / 2 - blockWidth / 2;
        
        // Create 8-12 stacked blocks
        const numBlocks = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numBlocks; i++) {
            const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
            mockBlocks.push({
                x: currentX + (Math.random() - 0.5) * 10, // Slight variation
                y: currentY,
                width: blockWidth - Math.random() * 15, // Blocks got smaller as they stacked
                height: blockHeight,
                floatType: floatType,
                peopleCount: 1 + Math.floor(Math.random() * 2),
                hasName: Math.random() > 0.7,
                name: this.generateName()
            });
            currentY -= blockHeight;
            currentX += (Math.random() - 0.5) * 5;
        }
        
        // Add some "dead" blocks (people who fell)
        for (let i = 0; i < 3; i++) {
            const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
            mockBlocks.push({
                x: Math.random() * config.canvas.width * 0.8,
                y: screenHeight - Math.random() * 100,
                width: blockWidth,
                height: blockHeight,
                floatType: floatType,
                peopleCount: 1,
                drowned: true
            });
        }
        
        // Add to frozen layers
        this.frozenLayers.push({
            blocks: mockBlocks,
            waterLevel: level1WaterLevel,
            level: 1
        });
        
        // Set water to start just above the frozen layer
        this.water.y = level1WaterLevel - 50;
        
        // Set target height higher (need to build on top of frozen layer)
        this.targetHeight = level1WaterLevel - 300;
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
        
        // Update water start position
        this.water.y = config.canvas.height;
        
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
        
        // For level 2+, start above the frozen layer
        let defaultStartY = config.canvas.height - 50;
        if (this.frozenLayers.length > 0) {
            const topFrozenLayer = this.frozenLayers[this.frozenLayers.length - 1];
            defaultStartY = topFrozenLayer.waterLevel - 30; // Start just above frozen ice
        }
        
        const startY = lastBlock ? lastBlock.y - config.block.height : defaultStartY;
        
        // Spawn from LEFT or RIGHT edge alternately (not from middle)
        let startX;
        if (this.spawnFromLeft) {
            startX = -config.block.width - 10; // Start completely off-screen on left
            this.direction = 1; // Move right
        } else {
            startX = config.canvas.width + 10; // Start completely off-screen on right
            this.direction = -1; // Move left
        }
        
        // Toggle for next spawn
        this.spawnFromLeft = !this.spawnFromLeft;
        
        // Random float type (boat, raft, or mattress)
        const floatType = config.floatTypes[Math.floor(Math.random() * config.floatTypes.length)];
        
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
            peopleCount: Math.floor(Math.random() * 2) + 1 // 1-2 people
        };
        
        this.survivors--;
        this.updateUI();
    },
    
    generateName() {
        const names = ['Anna', 'Ben', 'Chen', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
        return names[Math.floor(Math.random() * names.length)];
    },
    
    handleTap() {
        if (this.state !== 'playing' || !this.currentBlock) return;
        
        // Save the block position before placing
        const blockY = this.currentBlock.y;
        
        // Place the block
        const placed = this.placeBlock();
        
        if (placed) {
            // Check if we've reached the target height
            if (blockY <= this.targetHeight) {
                this.endLevel();
            } else {
                this.spawnBlock();
            }
        } else {
            // Misaligned - person falls
            this.deadBlocks.push({...this.currentBlock, falling: true, velocity: 0});
            this.currentBlock = null;
            this.spawnBlock();
        }
    },
    
    placeBlock() {
        if (this.stackedBlocks.length === 0) {
            // First block always succeeds
            this.stackedBlocks.push({...this.currentBlock});
            this.currentBlock = null;
            return true;
        }
        
        const lastBlock = this.stackedBlocks[this.stackedBlocks.length - 1];
        const overlap = this.calculateOverlap(this.currentBlock, lastBlock);
        
        if (overlap > 10) { // At least 10px overlap required
            // Successful placement
            this.currentBlock.width = overlap;
            
            // Align with overlapping section
            const leftEdge = Math.max(this.currentBlock.x, lastBlock.x);
            this.currentBlock.x = leftEdge;
            
            this.stackedBlocks.push({...this.currentBlock});
            this.currentBlock = null;
            return true;
        }
        
        return false;
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
    
    endLevel() {
        this.state = 'freezing';
        this.water.rising = false;
        
        // Show message
        this.showMessage('WATER FREEZING...');
        
        setTimeout(() => {
            this.freezeLevel();
        }, 2000);
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
        
        this.showMessage(`${survivorCount} SURVIVORS\nLEVEL ${this.level + 1}`);
        
        setTimeout(() => {
            this.nextLevel();
        }, 3000);
    },
    
    nextLevel() {
        this.level++;
        
        // Keep frozen blocks as background
        this.stackedBlocks = [];
        this.deadBlocks = [];
        
        // New starting position is above the ice
        this.targetHeight = this.water.y - 200;
        if (this.targetHeight < 50) {
            this.showMessage('YOU REACHED THE SUMMIT!');
            this.state = 'gameOver';
            return;
        }
        
        this.water.y = this.water.y - 50; // Water starts a bit higher
        this.state = 'playing';
        
        this.updateUI();
        this.hideMessage();
        this.spawnBlock();
    },
    
    update() {
        if (this.state === 'playing') {
            // Move current block
            if (this.currentBlock) {
                this.currentBlock.x += config.block.speed * this.direction;
                
                // Bounce off walls
                if (this.currentBlock.x <= 0 || this.currentBlock.x + this.currentBlock.width >= config.canvas.width) {
                    this.direction *= -1;
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
                    block.velocity += 0.5; // Gravity
                    block.y += block.velocity;
                    
                    // Hit water
                    if (block.y >= this.water.y) {
                        block.falling = false;
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
        
        // Draw frozen layers
        this.frozenLayers.forEach(layer => {
            // Draw ice
            this.ctx.fillStyle = config.colors.ice;
            this.ctx.fillRect(0, layer.waterLevel, config.canvas.width, config.canvas.height - layer.waterLevel);
            
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
        
        // Draw water
        this.ctx.fillStyle = config.colors.water;
        this.ctx.fillRect(0, this.water.y, config.canvas.width, config.canvas.height - this.water.y);
        
        // Draw water surface effect
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.water.y);
        this.ctx.lineTo(config.canvas.width, this.water.y);
        this.ctx.stroke();
        
        // Draw target line
        this.ctx.strokeStyle = 'rgba(78, 204, 163, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.targetHeight);
        this.ctx.lineTo(config.canvas.width, this.targetHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw stacked blocks (living humans above water)
        this.stackedBlocks.forEach(block => {
            if (!block.drowned) {
                this.drawHuman(block);
            }
        });
        
        // Draw dead/falling blocks
        this.deadBlocks.forEach(block => {
            this.ctx.fillStyle = config.colors.deadHuman;
            this.ctx.fillRect(block.x, block.y, block.width, block.height);
        });
        
        // Draw current moving block
        if (this.currentBlock) {
            this.drawHuman(this.currentBlock, true);
        }
    },
    
    drawHuman(block, isMoving = false) {
        const floatType = block.floatType || 'raft';
        const floatHeight = block.height * 0.4; // 40% for the float
        const peopleHeight = block.height * 0.6; // 60% for people
        
        // Draw the float device (boat/raft/mattress) at bottom
        this.drawFloat(block, floatHeight);
        
        // Draw people standing on top
        const peopleY = block.y;
        const peopleCount = block.peopleCount || 1;
        const personWidth = block.width / peopleCount;
        
        for (let i = 0; i < peopleCount; i++) {
            const personX = block.x + (i * personWidth);
            this.drawPerson(personX, peopleY, personWidth, peopleHeight, block.scared, isMoving);
        }
        
        // Name tag
        if (block.hasName) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.ctx.font = '10px Arial';
            this.ctx.fontWeight = 'bold';
            this.ctx.fillText(block.name, block.x + 5, block.y - 5);
        }
        
        // Float type indicator
        if (isMoving) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
            this.ctx.font = '8px Arial';
            const label = floatType === 'boat' ? '🚤' : floatType === 'mattress' ? '🛟' : '🪵';
            this.ctx.fillText(label, block.x + 2, block.y + block.height - 2);
        }
    },
    
    drawFloat(block, floatHeight) {
        const floatY = block.y + (block.height - floatHeight);
        const floatType = block.floatType || 'raft';
        
        // Choose color based on type
        let floatColor;
        if (floatType === 'boat') {
            floatColor = config.colors.boat;
        } else if (floatType === 'mattress') {
            floatColor = config.colors.mattress;
        } else {
            floatColor = config.colors.raft;
        }
        
        // Draw boat shape (trapezoid)
        if (floatType === 'boat') {
            this.ctx.fillStyle = floatColor;
            this.ctx.beginPath();
            this.ctx.moveTo(block.x + 5, floatY);
            this.ctx.lineTo(block.x + block.width - 5, floatY);
            this.ctx.lineTo(block.x + block.width, floatY + floatHeight);
            this.ctx.lineTo(block.x, floatY + floatHeight);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Boat outline
            this.ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        // Draw raft (rectangle with logs)
        else if (floatType === 'raft') {
            this.ctx.fillStyle = floatColor;
            this.ctx.fillRect(block.x, floatY, block.width, floatHeight);
            
            // Log lines
            this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            this.ctx.lineWidth = 1;
            const logCount = 3;
            for (let i = 1; i < logCount; i++) {
                const logX = block.x + (block.width / logCount) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(logX, floatY);
                this.ctx.lineTo(logX, floatY + floatHeight);
                this.ctx.stroke();
            }
        }
        // Draw air mattress (rounded rectangle)
        else {
            this.ctx.fillStyle = floatColor;
            const radius = 4;
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
            
            // Shine effect
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.fillRect(block.x + 3, floatY + 2, block.width - 6, floatHeight / 3);
        }
    },
    
    drawPerson(x, y, width, height, scared, isMoving) {
        const bodyColor = scared ? '#ff4757' : config.colors.human;
        const headSize = Math.min(width * 0.6, height * 0.3);
        const bodyHeight = height - headSize;
        
        // Head
        this.ctx.fillStyle = '#ffdbac'; // Skin tone
        this.ctx.beginPath();
        this.ctx.arc(x + width/2, y + headSize/2, headSize/2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Body (shirt)
        this.ctx.fillStyle = bodyColor;
        this.ctx.fillRect(x + width * 0.25, y + headSize, width * 0.5, bodyHeight * 0.6);
        
        // Arms
        if (scared && isMoving) {
            // Arms up reaching
            this.ctx.strokeStyle = bodyColor;
            this.ctx.lineWidth = Math.max(2, width * 0.1);
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.3, y + headSize + 5);
            this.ctx.lineTo(x + width * 0.1, y + headSize - 5);
            this.ctx.moveTo(x + width * 0.7, y + headSize + 5);
            this.ctx.lineTo(x + width * 0.9, y + headSize - 5);
            this.ctx.stroke();
        } else {
            // Arms down
            this.ctx.strokeStyle = bodyColor;
            this.ctx.lineWidth = Math.max(2, width * 0.1);
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.3, y + headSize + 5);
            this.ctx.lineTo(x + width * 0.2, y + headSize + bodyHeight * 0.4);
            this.ctx.moveTo(x + width * 0.7, y + headSize + 5);
            this.ctx.lineTo(x + width * 0.8, y + headSize + bodyHeight * 0.4);
            this.ctx.stroke();
        }
        
        // Face
        const eyeSize = Math.max(2, headSize * 0.15);
        this.ctx.fillStyle = '#000';
        
        // Eyes
        this.ctx.fillRect(x + width/2 - headSize/4, y + headSize/3, eyeSize, eyeSize);
        this.ctx.fillRect(x + width/2 + headSize/4 - eyeSize, y + headSize/3, eyeSize, eyeSize);
        
        // Mouth
        if (scared) {
            // O mouth (scared)
            this.ctx.beginPath();
            this.ctx.arc(x + width/2, y + headSize * 0.65, eyeSize * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Small smile
            this.ctx.beginPath();
            this.ctx.arc(x + width/2, y + headSize * 0.6, eyeSize, 0, Math.PI);
            this.ctx.stroke();
        }
    },
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    },
    
    updateUI() {
        document.getElementById('level').textContent = `LEVEL ${this.level}`;
        document.getElementById('survivors').textContent = `SURVIVORS: ${this.survivors}/${this.totalPeople}`;
    },
    
    showMessage(text) {
        const msg = document.getElementById('message');
        msg.innerHTML = text.replace('\n', '<br>');
        msg.classList.add('show');
    },
    
    hideMessage() {
        document.getElementById('message').classList.remove('show');
    }
};

// Start game when page loads
window.addEventListener('load', () => {
    game.init();
});

