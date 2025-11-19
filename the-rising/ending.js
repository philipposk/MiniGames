// The Rising - Epic Ending Sequence
// Heaven scene with St. Peter, the kick, and the dream reveal

class EndingSequence {
    constructor(game) {
        this.game = game;
        this.phase = 'ascent'; // ascent, gates, peter-angry, kicked, falling, wakeup, banner
        this.time = 0;
        this.cloudY = 0;
        this.peterX = 0;
        this.kickVelocity = 0;
        this.playerY = 0;
        this.textAlpha = 0;
        this.shakeAmount = 0;
        this.bannerY = -200;
    }
    
    start() {
        this.phase = 'ascent';
        this.time = 0;
        this.cloudY = this.game.canvas.height;
    }
    
    update(deltaTime) {
        this.time += deltaTime;
        
        switch(this.phase) {
            case 'ascent':
                // Clouds descending (heaven coming down)
                this.cloudY -= 150 * deltaTime;
                if (this.cloudY < 0) {
                    this.cloudY = 0;
                    this.phase = 'gates';
                    this.time = 0;
                }
                break;
                
            case 'gates':
                // St. Peter appears
                this.peterX = Math.min(this.game.canvas.width / 2, this.peterX + 200 * deltaTime);
                if (this.time > 2.0) {
                    this.phase = 'peter-angry';
                    this.time = 0;
                }
                break;
                
            case 'peter-angry':
                // Peter gets angry, screen shakes
                this.shakeAmount = Math.sin(this.time * 20) * 5;
                if (this.time > 4.0) {
                    this.phase = 'kicked';
                    this.time = 0;
                    this.kickVelocity = -800;
                }
                break;
                
            case 'kicked':
                // Player falls back down
                this.kickVelocity += 1200 * deltaTime; // Gravity
                this.playerY += this.kickVelocity * deltaTime;
                this.cloudY += 300 * deltaTime; // Heaven going away
                
                if (this.playerY > this.game.canvas.height + 200) {
                    this.phase = 'falling';
                    this.time = 0;
                }
                break;
                
            case 'falling':
                // Falling through flames/melted ice
                if (this.time > 3.0) {
                    this.phase = 'wakeup';
                    this.time = 0;
                }
                break;
                
            case 'wakeup':
                // Person waking up in bed
                this.textAlpha = Math.min(1, this.time / 2.0);
                if (this.time > 4.0) {
                    this.phase = 'banner';
                    this.time = 0;
                }
                break;
                
            case 'banner':
                // Final comforting message
                this.bannerY = Math.min(this.game.canvas.height / 2, this.bannerY + 200 * deltaTime);
                this.textAlpha = Math.min(1, this.time / 1.5);
                break;
        }
    }
    
    draw(ctx) {
        const width = this.game.canvas.width;
        const height = this.game.canvas.height;
        
        switch(this.phase) {
            case 'ascent':
                this.drawAscent(ctx, width, height);
                break;
            case 'gates':
            case 'peter-angry':
                this.drawHeavenGates(ctx, width, height);
                break;
            case 'kicked':
                this.drawKicked(ctx, width, height);
                break;
            case 'falling':
                this.drawFalling(ctx, width, height);
                break;
            case 'wakeup':
                this.drawWakeup(ctx, width, height);
                break;
            case 'banner':
                this.drawBanner(ctx, width, height);
                break;
        }
    }
    
    drawAscent(ctx, width, height) {
        // Sky getting brighter
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Clouds
        this.drawClouds(ctx, width, this.cloudY);
        
        // Text
        ctx.fillStyle = `rgba(255,255,255,${Math.sin(this.time * 2) * 0.3 + 0.7})`;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ASCENDING...', width / 2, height / 2);
    }
    
    drawHeavenGates(ctx, width, height) {
        ctx.save();
        ctx.translate(this.shakeAmount, this.shakeAmount);
        
        // Beautiful sky
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#87CEEB');
        gradient.addColorStop(1, '#FFF8DC');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Fluffy clouds
        this.drawClouds(ctx, width, 50);
        this.drawClouds(ctx, width, height - 100);
        
        // Pearly gates
        this.drawGates(ctx, width, height);
        
        // St. Peter (comic style)
        this.drawStPeter(ctx, width / 2, height / 2 - 50, this.phase === 'peter-angry');
        
        // Speech bubble
        if (this.phase === 'peter-angry') {
            this.drawSpeechBubble(ctx, width / 2, height / 2 - 200);
        }
        
        ctx.restore();
    }
    
    drawGates(ctx, width, height) {
        // Golden gates
        const gateWidth = 80;
        const gateHeight = 250;
        const centerX = width / 2;
        const gateY = height / 2 - 100;
        
        // Left gate
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(centerX - 100 - gateWidth, gateY, gateWidth, gateHeight);
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 4;
        ctx.strokeRect(centerX - 100 - gateWidth, gateY, gateWidth, gateHeight);
        
        // Right gate
        ctx.fillRect(centerX + 100, gateY, gateWidth, gateHeight);
        ctx.strokeRect(centerX + 100, gateY, gateWidth, gateHeight);
        
        // Gate decorations (crosses)
        for (let i = 0; i < 3; i++) {
            const y = gateY + 50 + i * 70;
            this.drawCross(ctx, centerX - 100 - gateWidth/2, y, 20);
            this.drawCross(ctx, centerX + 100 + gateWidth/2, y, 20);
        }
    }
    
    drawCross(ctx, x, y, size) {
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 3;
        // Vertical
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(x - size/2, y - size/2);
        ctx.lineTo(x + size/2, y - size/2);
        ctx.stroke();
    }
    
    drawStPeter(ctx, x, y, angry) {
        // Cloud platform
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(x, y + 120, 100, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Robe (white)
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.moveTo(x, y + 20);
        ctx.lineTo(x - 60, y + 130);
        ctx.lineTo(x + 60, y + 130);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Golden sash
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x - 40, y + 40, 80, 15);
        
        // Arms (angry = raised)
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        
        if (angry) {
            // Arms raised in frustration
            ctx.beginPath();
            ctx.moveTo(x - 30, y + 30);
            ctx.lineTo(x - 70, y - 20);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + 30, y + 30);
            ctx.lineTo(x + 70, y - 20);
            ctx.stroke();
        } else {
            // Arms at sides
            ctx.beginPath();
            ctx.moveTo(x - 30, y + 30);
            ctx.lineTo(x - 50, y + 80);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + 30, y + 30);
            ctx.lineTo(x + 50, y + 80);
            ctx.stroke();
        }
        
        // Head (big comic style)
        ctx.fillStyle = '#FFE0BD';
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D4A574';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Halo
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, y - 50, 35, 0, Math.PI * 2);
        ctx.stroke();
        
        // Beard (white and fluffy)
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(x, y + 20, 30, 0, Math.PI);
        ctx.fill();
        
        // Mustache
        ctx.beginPath();
        ctx.arc(x - 15, y + 5, 12, 0, Math.PI);
        ctx.arc(x + 15, y + 5, 12, 0, Math.PI);
        ctx.fill();
        
        // Eyes (ANGRY)
        if (angry) {
            // Angry eyebrows
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x - 30, y - 15);
            ctx.lineTo(x - 10, y - 5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 30, y - 15);
            ctx.lineTo(x + 10, y - 5);
            ctx.stroke();
            
            // Eyes (furious)
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - 15, y - 5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 15, y - 5, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Mouth (shouting)
            ctx.beginPath();
            ctx.arc(x, y + 10, 15, 0.2, Math.PI - 0.2);
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            // Normal eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - 15, y - 5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 15, y - 5, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawSpeechBubble(ctx, x, y) {
        // Bubble
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        
        const bubbleWidth = 300;
        const bubbleHeight = 100;
        
        ctx.beginPath();
        ctx.roundRect(x - bubbleWidth/2, y - bubbleHeight, bubbleWidth, bubbleHeight, 20);
        ctx.fill();
        ctx.stroke();
        
        // Tail
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x - 20, y + 20);
        ctx.lineTo(x + 20, y - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Text with animation
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        
        const text1 = "...";
        const text2 = "BUT YOU LET";
        const text3 = "THEM ALL DIEEEEE!!!";
        
        if (this.time < 1.0) {
            ctx.fillText(text1, x, y - 60);
        } else if (this.time < 2.5) {
            ctx.fillText(text2, x, y - 60);
        } else {
            // Shaking text for emphasis
            const shake = Math.sin(this.time * 30) * 3;
            ctx.fillText(text3, x + shake, y - 70);
            ctx.font = 'bold 20px Arial';
            ctx.fillText("😱😭💀", x, y - 35);
        }
    }
    
    drawClouds(ctx, width, baseY) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        
        for (let i = 0; i < 5; i++) {
            const x = (width / 5) * i + 50;
            const y = baseY + Math.sin(this.time + i) * 20;
            
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.arc(x + 30, y, 50, 0, Math.PI * 2);
            ctx.arc(x + 60, y, 40, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawKicked(ctx, width, height) {
        // Sky transitioning
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#2c3e50');
        gradient.addColorStop(1, '#c0392b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Heaven receding
        this.drawClouds(ctx, width, this.cloudY);
        
        // Peter's leg (SPARTA KICK)
        if (this.playerY < 300) {
            ctx.save();
            ctx.translate(width / 2, 200);
            ctx.rotate(-0.3);
            
            // Leg
            ctx.fillStyle = '#FFF';
            ctx.fillRect(-30, 0, 60, 150);
            // Sandal
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-40, 140, 80, 30);
            
            ctx.restore();
            
            // "THIS IS HEAVEN!!!" text
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText("THIS IS HEAVEN!!!", width / 2, 350);
            ctx.fillText("THIS IS HEAVEN!!!", width / 2, 350);
        }
        
        // Player falling (stick figure style)
        const playerY = 300 + this.playerY;
        if (playerY < height) {
            ctx.save();
            ctx.translate(width / 2, playerY);
            ctx.rotate(this.time * 5); // Spinning
            
            // Stick figure
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            
            // Head
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.stroke();
            
            // Body
            ctx.beginPath();
            ctx.moveTo(0, 15);
            ctx.lineTo(0, 50);
            ctx.stroke();
            
            // Arms (flailing)
            ctx.beginPath();
            ctx.moveTo(0, 25);
            ctx.lineTo(-20, 10);
            ctx.moveTo(0, 25);
            ctx.lineTo(20, 40);
            ctx.stroke();
            
            // Legs
            ctx.beginPath();
            ctx.moveTo(0, 50);
            ctx.lineTo(-15, 70);
            ctx.moveTo(0, 50);
            ctx.lineTo(15, 70);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    drawFalling(ctx, width, height) {
        // Dark with flames
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Flames from below
        for (let i = 0; i < 10; i++) {
            const x = (width / 10) * i;
            const flameHeight = 100 + Math.sin(this.time * 5 + i) * 50;
            
            const gradient = ctx.createLinearGradient(x, height, x, height - flameHeight);
            gradient.addColorStop(0, '#ff0000');
            gradient.addColorStop(0.5, '#ff6600');
            gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x, height);
            ctx.lineTo(x + 20, height - flameHeight);
            ctx.lineTo(x + 40, height);
            ctx.closePath();
            ctx.fill();
        }
        
        // Melted ice text
        ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('THE ICE HAS MELTED', width / 2, height / 2);
        
        // Falling text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px Arial';
        ctx.fillText('...', width / 2, height / 2 + 80);
    }
    
    drawWakeup(ctx, width, height) {
        // Dark bedroom
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        // Bed
        ctx.fillStyle = '#654321';
        ctx.fillRect(width * 0.2, height * 0.6, width * 0.6, height * 0.3);
        
        // Blanket
        ctx.fillStyle = '#3498db';
        ctx.fillRect(width * 0.25, height * 0.65, width * 0.5, height * 0.2);
        
        // Person in bed (head visible)
        ctx.fillStyle = '#FFE0BD';
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.65, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes wide open (startled)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(width / 2 - 10, height * 0.65 - 5, 8, 0, Math.PI * 2);
        ctx.arc(width / 2 + 10, height * 0.65 - 5, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(width / 2 - 10, height * 0.65 - 5, 4, 0, Math.PI * 2);
        ctx.arc(width / 2 + 10, height * 0.65 - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth (gasp)
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.65 + 10, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Sweat drops
        ctx.fillStyle = 'rgba(100, 180, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(width / 2 - 25, height * 0.65 - 15, 5, 0, Math.PI * 2);
        ctx.arc(width / 2 + 25, height * 0.65 - 15, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Text
        ctx.fillStyle = `rgba(255,255,255,${this.textAlpha})`;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('*GASP*', width / 2, height * 0.3);
        
        ctx.font = '32px Arial';
        ctx.fillText('It was all a dream...', width / 2, height * 0.4);
    }
    
    drawBanner(ctx, width, height) {
        // Peaceful bedroom
        this.drawWakeup(ctx, width, height);
        
        // Comforting banner
        ctx.fillStyle = `rgba(78, 204, 163, ${this.textAlpha})`;
        ctx.fillRect(width * 0.1, this.bannerY - 40, width * 0.8, 120);
        
        ctx.strokeStyle = `rgba(255,255,255, ${this.textAlpha})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(width * 0.1, this.bannerY - 40, width * 0.8, 120);
        
        // Text
        ctx.fillStyle = `rgba(255,255,255, ${this.textAlpha})`;
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('IT WILL ALL BE OKAY', width / 2, this.bannerY);
        
        ctx.font = '36px Arial';
        ctx.fillText('shhh...', width / 2, this.bannerY + 50);
        
        // Gentle emojis
        ctx.font = '32px Arial';
        ctx.fillText('💤 😌 💙', width / 2, this.bannerY - 70);
    }
}

