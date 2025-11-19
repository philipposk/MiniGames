// ===== GAME STATE =====
const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver',
    LEVEL_COMPLETE: 'levelComplete'
};

// ===== BRICK TYPES =====
const BrickType = {
    NORMAL: 'normal',
    BOMB: 'bomb',
    UNBREAKABLE: 'unbreakable',
    MOVING: 'moving',
    POWERUP: 'powerup',
    MULTI_HIT: 'multiHit' // Needs multiple hits to break
};

// ===== GAME CONFIG =====
const config = {
    ball: {
        radius: 12,
        baseSpeed: 4,
        maxSpeed: 20
    },
    paddle: {
        width: 120,
        height: 18,
        radius: 9, // Rounded corners
        speed: 8
    },
    brick: {
        width: 75,
        height: 28,
        rows: 5,
        cols: 6,
        spacing: 5
    }
};

// ===== GAME CLASS =====
class BounceBall {
    constructor() {
        this.state = GameState.MENU;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = this.loadHighScore();
        
        // Multiple balls (array)
        this.balls = [];
        
        // Paddle properties
        this.paddle = {
            x: 0,
            y: 0,
            width: config.paddle.width,
            height: config.paddle.height,
            radius: config.paddle.radius,
            targetX: 0
        };
        
        // Bricks
        this.bricks = [];
        
        // Explosions from bombs
        this.explosions = [];
        
        // Passing collectibles (power-ups that move across screen)
        this.collectibles = [];
        this.collectibleSpawnTimer = 0;
        
        // Falling collectibles (dropped from multi-hit bricks)
        this.fallingCollectibles = [];
        
        // Canvas
        this.canvas = null;
        this.ctx = null;
        
        // Animation
        this.animationFrame = null;
        
        // Mouse/Touch tracking
        this.mouseX = 0;
        
        // Level complete timer
        this.levelCompleteTimer = 0;
        
        this.init();
    }
    
    init() {
        console.log('Initializing game...');
        
        // Get DOM elements
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas not found!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Screens
        this.screens = {
            menu: document.getElementById('menu'),
            game: document.getElementById('game'),
            gameOver: document.getElementById('gameOver')
        };
        
        // Buttons
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.menuBtn = document.getElementById('menuBtn');
        
        // Display elements
        this.scoreDisplay = document.getElementById('score');
        this.livesDisplay = document.getElementById('lives');
        this.levelDisplay = document.getElementById('level');
        this.finalScoreDisplay = document.getElementById('finalScore');
        this.menuHighScoreDisplay = document.getElementById('menuHighScore');
        this.newRecordDisplay = document.getElementById('newRecord');
        
        // Setup canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update high score display
        this.updateHighScoreDisplay();
        
        console.log('Game initialized!');
    }
    
    resizeCanvas() {
        // Use window dimensions if canvas is hidden
        if (this.canvas.offsetWidth === 0 || this.canvas.offsetHeight === 0) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight - 200;
        } else {
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
        
        // Reset game positions if playing
        if (this.state === GameState.PLAYING) {
            this.resetGame();
        }
    }
    
    setupEventListeners() {
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startGame());
        }
        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => this.startGame());
        }
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', () => this.showMenu());
        }
        
        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
            });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = e.touches[0].clientX - rect.left;
            });
        }
    }
    
    showMenu() {
        this.state = GameState.MENU;
        this.screens.menu.classList.add('active');
        this.screens.game.classList.remove('active');
        this.screens.gameOver.classList.remove('active');
        this.updateHighScoreDisplay();
    }
    
    startGame() {
        this.state = GameState.PLAYING;
        this.score = 0;
        this.lives = 3;
        this.level = 1; // Normal start
        
        this.screens.menu.classList.remove('active');
        this.screens.gameOver.classList.remove('active');
        this.screens.game.classList.add('active');
        
        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.resetGame();
            this.gameLoop();
        });
    }
    
    getLevelSpeed() {
        // Speed increases continuously based on level
        // Base speed + (level - 1) * speed increment
        const speedIncrement = 1.2;
        const maxSpeed = 18;
        const calculatedSpeed = config.ball.baseSpeed + (this.level - 1) * speedIncrement;
        return Math.min(calculatedSpeed, maxSpeed);
    }
    
    getBallCount() {
        // Level 1-5: 1 ball
        // Level 6-10: 2 balls
        // Level 11-15: 3 balls
        // Level 16-20: 4 balls
        // Level 21-25: 5 balls
        // Level 26+: 5 balls (max)
        if (this.level <= 5) return 1;
        if (this.level <= 10) return 2;
        if (this.level <= 15) return 3;
        if (this.level <= 20) return 4;
        if (this.level <= 25) return 5;
        return 5; // Max 5 balls
    }
    
    resetGame() {
        const ballCount = this.getBallCount();
        const speed = this.getLevelSpeed();
        
        // Create balls
        this.balls = [];
        for (let i = 0; i < ballCount; i++) {
            const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
            this.balls.push({
                x: this.canvas.width / 2 + (i - ballCount / 2) * 30,
                y: this.canvas.height - 100 - i * 20,
                vx: Math.cos(angle) * speed,
                vy: -Math.sin(angle) * speed,
                radius: config.ball.radius,
                color: this.getBallColor(i)
            });
        }
        
        // Reset paddle
        this.paddle.x = this.canvas.width / 2 - this.paddle.width / 2;
        this.paddle.y = this.canvas.height - 50;
        
        // Create bricks
        this.createBricks();
        
        // Clear explosions
        this.explosions = [];
        
        // Clear collectibles
        this.collectibles = [];
        this.collectibleSpawnTimer = 0;
        this.fallingCollectibles = [];
        
        this.updateDisplay();
    }
    
    getBallColor(index) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
        return colors[index % colors.length];
    }
    
    createBricks() {
        this.bricks = [];
        const totalWidth = config.brick.cols * config.brick.width + (config.brick.cols - 1) * config.brick.spacing;
        const startX = (this.canvas.width - totalWidth) / 2;
        const startY = 80;
        
        for (let row = 0; row < config.brick.rows; row++) {
            for (let col = 0; col < config.brick.cols; col++) {
                const brick = {
                    x: startX + col * (config.brick.width + config.brick.spacing),
                    y: startY + row * (config.brick.height + config.brick.spacing),
                    width: config.brick.width,
                    height: config.brick.height,
                    hit: false,
                    type: this.getBrickType(row, col),
                    color: this.getBrickColor(row),
                    vx: 0, // For moving bricks
                    direction: Math.random() > 0.5 ? 1 : -1,
                    hits: 1, // Number of hits needed (default 1)
                    maxHits: 1 // Original max hits
                };
                
                // Set moving bricks
                if (brick.type === BrickType.MOVING) {
                    brick.vx = 1.5 * brick.direction;
                }
                
                // Set multi-hit bricks
                if (brick.type === BrickType.MULTI_HIT) {
                    brick.hits = 2 + Math.floor(this.level / 5); // 2-5 hits depending on level
                    brick.maxHits = brick.hits;
                }
                
                this.bricks.push(brick);
            }
        }
    }
    
    getBrickType(row, col) {
        // Level 1-2: Only normal bricks
        if (this.level <= 2) {
            return BrickType.NORMAL;
        }
        
        // Level 3-4: Add bombs (10% chance)
        if (this.level <= 4) {
            if (Math.random() < 0.1) return BrickType.BOMB;
            return BrickType.NORMAL;
        }
        
        // Level 5: Add unbreakable (5%) and bombs (10%)
        if (this.level === 5) {
            const rand = Math.random();
            if (rand < 0.05) return BrickType.UNBREAKABLE;
            if (rand < 0.15) return BrickType.BOMB;
            return BrickType.NORMAL;
        }
        
        // Level 6-7: Add moving bricks (15%), bombs (10%), unbreakable (5%)
        if (this.level <= 7) {
            const rand = Math.random();
            if (rand < 0.05) return BrickType.UNBREAKABLE;
            if (rand < 0.15) return BrickType.BOMB;
            if (rand < 0.30) return BrickType.MOVING;
            return BrickType.NORMAL;
        }
        
        // Level 8-10: Add multi-hit bricks (20%)
        if (this.level <= 10) {
            const rand = Math.random();
            if (rand < 0.08) return BrickType.UNBREAKABLE;
            if (rand < 0.18) return BrickType.BOMB;
            if (rand < 0.35) return BrickType.MOVING;
            if (rand < 0.40) return BrickType.POWERUP;
            if (rand < 0.60) return BrickType.MULTI_HIT;
            return BrickType.NORMAL;
        }
        
        // Level 11+: All types, more chaos
        const rand = Math.random();
        if (rand < 0.08) return BrickType.UNBREAKABLE;
        if (rand < 0.18) return BrickType.BOMB;
        if (rand < 0.30) return BrickType.MOVING;
        if (rand < 0.35) return BrickType.POWERUP;
        if (rand < 0.55) return BrickType.MULTI_HIT;
        return BrickType.NORMAL;
    }
    
    getBrickColor(row) {
        const colors = [
            '#ff6b6b', // Red
            '#4ecdc4', // Teal
            '#45b7d1', // Blue
            '#f9ca24', // Yellow
            '#6c5ce7'  // Purple
        ];
        return colors[row % colors.length];
    }
    
    gameLoop() {
        if (this.state !== GameState.PLAYING) {
            return;
        }
        
        this.update();
        this.draw();
        
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        // Update paddle
        this.paddle.targetX = this.mouseX - this.paddle.width / 2;
        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.2;
        this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));
        
        // Update moving bricks
        for (let brick of this.bricks) {
            if (brick.hit || brick.type !== BrickType.MOVING) continue;
            
            brick.x += brick.vx;
            
            // Bounce off walls
            if (brick.x <= 0 || brick.x + brick.width >= this.canvas.width) {
                brick.vx = -brick.vx;
                brick.x = Math.max(0, Math.min(this.canvas.width - brick.width, brick.x));
            }
        }
        
        // Update explosions
        this.explosions = this.explosions.filter(exp => {
            exp.life--;
            return exp.life > 0;
        });
        
        // Spawn collectibles (passing power-ups)
        this.collectibleSpawnTimer++;
        if (this.collectibleSpawnTimer > 300) { // Spawn every ~5 seconds at 60fps
            this.spawnCollectible();
            this.collectibleSpawnTimer = 0;
        }
        
        // Update collectibles
        for (let collectible of this.collectibles) {
            collectible.y += collectible.vy;
            collectible.rotation += 0.1;
            
            // Check collision with paddle
            if (collectible.y + collectible.radius >= this.paddle.y &&
                collectible.y - collectible.radius <= this.paddle.y + this.paddle.height &&
                collectible.x + collectible.radius >= this.paddle.x &&
                collectible.x - collectible.radius <= this.paddle.x + this.paddle.width) {
                // Collected!
                this.score += collectible.points;
                collectible.collected = true;
                this.updateDisplay();
            }
        }
        
        // Remove collected or off-screen collectibles
        this.collectibles = this.collectibles.filter(c => {
            return !c.collected && c.y - c.radius < this.canvas.height + 50;
        });
        
        // Update falling collectibles (from multi-hit bricks)
        for (let collectible of this.fallingCollectibles) {
            collectible.y += collectible.vy;
            collectible.vy += 0.3; // Gravity
            collectible.rotation += 0.15;
            
            // Check collision with paddle
            if (collectible.y + collectible.radius >= this.paddle.y &&
                collectible.y - collectible.radius <= this.paddle.y + this.paddle.height &&
                collectible.x + collectible.radius >= this.paddle.x &&
                collectible.x - collectible.radius <= this.paddle.x + this.paddle.width) {
                // Collected!
                this.score += collectible.points;
                collectible.collected = true;
                this.updateDisplay();
            }
        }
        
        // Remove collected or off-screen falling collectibles
        this.fallingCollectibles = this.fallingCollectibles.filter(c => {
            return !c.collected && c.y - c.radius < this.canvas.height + 50;
        });
        
        // Update all balls
        for (let ball of this.balls) {
            this.updateBall(ball);
        }
        
        // Check level complete
        const normalBricks = this.bricks.filter(b => !b.hit && b.type !== BrickType.UNBREAKABLE);
        if (normalBricks.length === 0) {
            this.levelComplete();
        }
    }
    
    spawnCollectible() {
        const types = [
            { color: '#ffd700', points: 50, symbol: '★' }, // Gold star
            { color: '#ff6b6b', points: 30, symbol: '●' }, // Red circle
            { color: '#4ecdc4', points: 40, symbol: '◆' }, // Teal diamond
            { color: '#f9ca24', points: 35, symbol: '▲' }, // Yellow triangle
            { color: '#6c5ce7', points: 60, symbol: '♦' }  // Purple diamond
        ];
        
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.collectibles.push({
            x: Math.random() * (this.canvas.width - 40) + 20,
            y: -30,
            vy: 2 + (this.level * 0.1), // Faster at higher levels
            radius: 15,
            color: type.color,
            symbol: type.symbol,
            points: type.points,
            rotation: 0,
            collected: false
        });
    }
    
    updateBall(ball) {
        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Wall collisions
        if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.canvas.width) {
            ball.vx = -ball.vx;
            ball.x = Math.max(ball.radius, Math.min(this.canvas.width - ball.radius, ball.x));
        }
        
        if (ball.y - ball.radius <= 0) {
            ball.vy = -ball.vy;
            ball.y = ball.radius;
        }
        
        // Paddle collision (rounded paddle)
        const paddleCenterX = this.paddle.x + this.paddle.width / 2;
        const paddleCenterY = this.paddle.y + this.paddle.height / 2;
        const ballDistX = ball.x - paddleCenterX;
        const ballDistY = ball.y - paddleCenterY;
        
        // Check if ball is near paddle
        if (ball.y + ball.radius >= this.paddle.y &&
            ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
            ball.x + ball.radius >= this.paddle.x &&
            ball.x - ball.radius <= this.paddle.x + this.paddle.width) {
            
            // Calculate distance from paddle center
            const distFromCenter = Math.abs(ballDistX) / (this.paddle.width / 2);
            
            // Rounded paddle physics - angle based on position
            const hitPos = ballDistX / (this.paddle.width / 2); // -1 to 1
            const angle = hitPos * Math.PI / 3; // Max 60 degrees
            
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.sin(angle) * speed;
            ball.vy = -Math.cos(angle) * speed;
            
            // Ensure ball goes up
            if (ball.vy > 0) {
                ball.vy = -ball.vy;
            }
            
            ball.y = this.paddle.y - ball.radius;
        }
        
        // Brick collisions
        for (let brick of this.bricks) {
            if (brick.hit) continue;
            
            if (ball.x + ball.radius >= brick.x &&
                ball.x - ball.radius <= brick.x + brick.width &&
                ball.y + ball.radius >= brick.y &&
                ball.y - ball.radius <= brick.y + brick.height) {
                
                this.hitBrick(brick, ball);
                break;
            }
        }
        
        // Ball fell off
        if (ball.y - ball.radius > this.canvas.height) {
            // Remove this ball
            const index = this.balls.indexOf(ball);
            if (index > -1) {
                this.balls.splice(index, 1);
            }
            
            // If no balls left, lose a life
            if (this.balls.length === 0) {
                this.lives--;
                this.updateDisplay();
                
                if (this.lives <= 0) {
                    this.gameOver();
                } else {
                    // Reset balls
                    const ballCount = this.getBallCount();
                    const speed = this.getLevelSpeed();
                    for (let i = 0; i < ballCount; i++) {
                        const angle = (Math.random() * Math.PI / 3) + Math.PI / 3;
                        this.balls.push({
                            x: this.canvas.width / 2,
                            y: this.canvas.height - 100,
                            vx: Math.cos(angle) * speed,
                            vy: -Math.sin(angle) * speed,
                            radius: config.ball.radius,
                            color: this.getBallColor(i)
                        });
                    }
                }
            }
        }
    }
    
    hitBrick(brick, ball) {
        // Unbreakable bricks just bounce
        if (brick.type === BrickType.UNBREAKABLE) {
            const dx = ball.x - (brick.x + brick.width / 2);
            const dy = ball.y - (brick.y + brick.height / 2);
            if (Math.abs(dx) > Math.abs(dy)) {
                ball.vx = -ball.vx;
            } else {
                ball.vy = -ball.vy;
            }
            return;
        }
        
        // Multi-hit bricks
        if (brick.type === BrickType.MULTI_HIT) {
            brick.hits--;
            this.score += 5; // Small points for each hit
            
            // Drop a falling collectible
            this.dropFallingCollectible(brick);
            
            // If still has hits left, just bounce (don't destroy)
            if (brick.hits > 0) {
                const dx = ball.x - (brick.x + brick.width / 2);
                const dy = ball.y - (brick.y + brick.height / 2);
                if (Math.abs(dx) > Math.abs(dy)) {
                    ball.vx = -ball.vx;
                } else {
                    ball.vy = -ball.vy;
                }
                return;
            }
            
            // No hits left, destroy the brick
            brick.hit = true;
            this.score += 15; // Bonus for breaking it
        } else {
            // Normal hit - destroy immediately
            brick.hit = true;
            this.score += 10;
        }
        
        // Bomb bricks explode
        if (brick.type === BrickType.BOMB) {
            this.explodeBrick(brick);
        }
        
        // Power-up bricks give bonus
        if (brick.type === BrickType.POWERUP) {
            this.score += 50;
        }
        
        // Bounce ball
        const dx = ball.x - (brick.x + brick.width / 2);
        const dy = ball.y - (brick.y + brick.height / 2);
        if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx = -ball.vx;
        } else {
            ball.vy = -ball.vy;
        }
        
        this.updateDisplay();
    }
    
    dropFallingCollectible(brick) {
        // Create a small collectible that falls from the brick
        const collectibleTypes = [
            { color: '#ffd700', points: 20, symbol: '●' }, // Gold coin
            { color: '#c0c0c0', points: 15, symbol: '○' }, // Silver coin
            { color: '#cd7f32', points: 10, symbol: '●' }  // Bronze coin
        ];
        
        const type = collectibleTypes[Math.floor(Math.random() * collectibleTypes.length)];
        
        this.fallingCollectibles.push({
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height,
            vy: 1, // Start slow, gravity will accelerate
            radius: 8, // Smaller than passing collectibles
            color: type.color,
            symbol: type.symbol,
            points: type.points,
            rotation: Math.random() * Math.PI * 2,
            collected: false
        });
    }
    
    explodeBrick(brick) {
        // Create explosion effect
        this.explosions.push({
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height / 2,
            radius: 0,
            maxRadius: 60,
            life: 20
        });
        
        // Destroy nearby bricks (except unbreakable)
        for (let otherBrick of this.bricks) {
            if (otherBrick.hit || otherBrick.type === BrickType.UNBREAKABLE) continue;
            
            const dx = otherBrick.x + otherBrick.width / 2 - brick.x - brick.width / 2;
            const dy = otherBrick.y + otherBrick.height / 2 - brick.y - brick.height / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 100) {
                otherBrick.hit = true;
                this.score += 10;
            }
        }
    }
    
    levelComplete() {
        this.level++;
        this.score += 100 * this.level; // Bonus points
        
        // Reset for next level
        this.resetGame();
        this.updateDisplay();
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw explosions
        for (let exp of this.explosions) {
            const alpha = exp.life / 20;
            const radius = exp.maxRadius * (1 - exp.life / 20);
            this.ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`;
            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
        
        // Draw bricks
        for (let brick of this.bricks) {
            if (brick.hit) continue;
            
            // Different styles for different types
            if (brick.type === BrickType.BOMB) {
                // Red with warning stripes
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                this.ctx.fillStyle = '#ffff00';
                this.ctx.fillRect(brick.x + 5, brick.y + 5, brick.width - 10, 3);
                this.ctx.fillRect(brick.x + 5, brick.y + brick.height - 8, brick.width - 10, 3);
            } else if (brick.type === BrickType.UNBREAKABLE) {
                // Gray metallic
                this.ctx.fillStyle = '#555555';
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                this.ctx.fillStyle = '#888888';
                this.ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
            } else if (brick.type === BrickType.MOVING) {
                // Animated color
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                this.ctx.fillStyle = this.adjustBrightness(brick.color, pulse);
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            } else if (brick.type === BrickType.POWERUP) {
                // Rainbow effect
                const hue = (Date.now() / 20) % 360;
                this.ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            } else if (brick.type === BrickType.MULTI_HIT) {
                // Multi-hit brick - darker color, show hits remaining
                const healthPercent = brick.hits / brick.maxHits;
                this.ctx.fillStyle = this.adjustBrightness(brick.color, 0.5 + healthPercent * 0.5);
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                
                // Show cracks/damage
                if (brick.hits < brick.maxHits) {
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    this.ctx.lineWidth = 1;
                    // Draw crack lines
                    for (let i = 0; i < (brick.maxHits - brick.hits); i++) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(brick.x + Math.random() * brick.width, brick.y);
                        this.ctx.lineTo(brick.x + Math.random() * brick.width, brick.y + brick.height);
                        this.ctx.stroke();
                    }
                }
                
                // Show hits remaining number
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(
                    brick.hits.toString(),
                    brick.x + brick.width / 2,
                    brick.y + brick.height / 2
                );
            } else {
                // Normal brick
                this.ctx.fillStyle = brick.color;
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            }
            
            // Border
            this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        }
        
        // Draw rounded paddle
        this.drawRoundedRect(
            this.paddle.x,
            this.paddle.y,
            this.paddle.width,
            this.paddle.height,
            this.paddle.radius,
            '#fff'
        );
        
        // Draw paddle highlight
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(
            this.paddle.x + this.paddle.width / 2,
            this.paddle.y + 3,
            this.paddle.width / 2 - 2,
            4,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();
        
        // Draw all balls
        for (let ball of this.balls) {
            this.ctx.fillStyle = ball.color;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Ball highlight
            this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
            this.ctx.beginPath();
            this.ctx.arc(ball.x - 4, ball.y - 4, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw collectibles (passing power-ups)
        for (let collectible of this.collectibles) {
            // Outer glow
            this.ctx.fillStyle = collectible.color;
            this.ctx.globalAlpha = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(collectible.x, collectible.y, collectible.radius + 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Main circle
            this.ctx.globalAlpha = 1;
            this.ctx.fillStyle = collectible.color;
            this.ctx.beginPath();
            this.ctx.arc(collectible.x, collectible.y, collectible.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Symbol
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.save();
            this.ctx.translate(collectible.x, collectible.y);
            this.ctx.rotate(collectible.rotation);
            this.ctx.fillText(collectible.symbol, 0, 0);
            this.ctx.restore();
        }
        
        // Draw falling collectibles (from multi-hit bricks)
        for (let collectible of this.fallingCollectibles) {
            // Outer glow
            this.ctx.fillStyle = collectible.color;
            this.ctx.globalAlpha = 0.4;
            this.ctx.beginPath();
            this.ctx.arc(collectible.x, collectible.y, collectible.radius + 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Main circle
            this.ctx.globalAlpha = 1;
            this.ctx.fillStyle = collectible.color;
            this.ctx.beginPath();
            this.ctx.arc(collectible.x, collectible.y, collectible.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            // Symbol (smaller)
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.save();
            this.ctx.translate(collectible.x, collectible.y);
            this.ctx.rotate(collectible.rotation);
            this.ctx.fillText(collectible.symbol, 0, 0);
            this.ctx.restore();
        }
    }
    
    drawRoundedRect(x, y, width, height, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    adjustBrightness(color, factor) {
        // Simple brightness adjustment
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }
    
    updateDisplay() {
        if (this.scoreDisplay) this.scoreDisplay.textContent = this.score;
        if (this.livesDisplay) this.livesDisplay.textContent = this.lives;
        if (this.levelDisplay) this.levelDisplay.textContent = this.level;
    }
    
    gameOver() {
        this.state = GameState.GAME_OVER;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.finalScoreDisplay) {
            this.finalScoreDisplay.textContent = this.score;
        }
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            if (this.newRecordDisplay) {
                this.newRecordDisplay.classList.remove('hidden');
            }
        } else {
            if (this.newRecordDisplay) {
                this.newRecordDisplay.classList.add('hidden');
            }
        }
        
        this.screens.game.classList.remove('active');
        this.screens.gameOver.classList.add('active');
    }
    
    loadHighScore() {
        const saved = localStorage.getItem('bounceBallHighScore');
        return saved ? parseInt(saved, 10) : 0;
    }
    
    saveHighScore() {
        localStorage.setItem('bounceBallHighScore', this.highScore.toString());
    }
    
    updateHighScoreDisplay() {
        if (this.menuHighScoreDisplay) {
            this.menuHighScoreDisplay.textContent = this.highScore;
        }
    }
}

// ===== INITIALIZE GAME =====
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new BounceBall();
});
