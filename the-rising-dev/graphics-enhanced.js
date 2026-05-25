// Enhanced Graphics Rendering for The Rising
// Realistic human characters, water effects, particles

class EnhancedGraphics {
    constructor(ctx) {
        this.ctx = ctx;
        this.particles = [];
        this.waterRipples = [];
        this.time = 0;
    }
    
    update(deltaTime) {
        this.time += deltaTime;
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= deltaTime;
            p.y += p.vy * deltaTime;
            p.x += p.vx * deltaTime;
            p.vy += 200 * deltaTime; // Gravity
            p.alpha = p.life / p.maxLife;
            return p.life > 0;
        });
        
        // Update ripples
        this.waterRipples = this.waterRipples.filter(r => {
            r.radius += r.speed * deltaTime;
            r.alpha = 1 - (r.radius / r.maxRadius);
            return r.radius < r.maxRadius;
        });
    }
    
    // Draw realistic person
    drawRealisticPerson(x, y, width, height, scared, reaching, skinTone = '#ffd1b3') {
        const headRadius = width * 0.25;
        const bodyWidth = width * 0.5;
        const bodyHeight = height * 0.45;
        const legHeight = height * 0.25;
        const headCenterX = x + width / 2;
        const headCenterY = y + headRadius + 5;
        
        // Shadow under person
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + width/2, y + height, width * 0.4, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Legs
        const legColor = '#2c3e50';
        this.ctx.fillStyle = legColor;
        const legWidth = bodyWidth * 0.4;
        this.ctx.fillRect(x + width * 0.3, y + headRadius * 2 + bodyHeight, legWidth * 0.8, legHeight);
        this.ctx.fillRect(x + width * 0.3 + legWidth, y + headRadius * 2 + bodyHeight, legWidth * 0.8, legHeight);
        
        // Body/Torso with shading
        const shirtColor = scared ? '#e74c3c' : '#3498db';
        const gradient = this.ctx.createLinearGradient(x, y + headRadius * 2, x + width, y + headRadius * 2 + bodyHeight);
        gradient.addColorStop(0, shirtColor);
        gradient.addColorStop(1, this.darkenColor(shirtColor, 0.7));
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.roundRect(x + width * 0.25, y + headRadius * 2, bodyWidth, bodyHeight, 5);
        this.ctx.fill();
        
        // Body outline
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Arms
        this.drawArms(x, y, width, headRadius, bodyHeight, scared, reaching, shirtColor);
        
        // Neck
        this.ctx.fillStyle = skinTone;
        this.ctx.fillRect(x + width * 0.4, y + headRadius * 1.8, width * 0.2, headRadius * 0.4);
        
        // Head with gradient for depth
        const headGradient = this.ctx.createRadialGradient(
            headCenterX - headRadius * 0.3, headCenterY - headRadius * 0.3, headRadius * 0.2,
            headCenterX, headCenterY, headRadius
        );
        headGradient.addColorStop(0, this.lightenColor(skinTone, 1.1));
        headGradient.addColorStop(1, skinTone);
        
        this.ctx.fillStyle = headGradient;
        this.ctx.beginPath();
        this.ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Head outline
        this.ctx.strokeStyle = this.darkenColor(skinTone, 0.8);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Hair
        this.drawHair(headCenterX, headCenterY, headRadius);
        
        // Face
        this.drawFace(headCenterX, headCenterY, headRadius, scared);
    }
    
    drawArms(x, y, width, headRadius, bodyHeight, scared, reaching, shirtColor) {
        const armLength = bodyHeight * 0.7;
        const armThickness = width * 0.12;
        
        this.ctx.strokeStyle = shirtColor;
        this.ctx.lineWidth = armThickness;
        this.ctx.lineCap = 'round';
        
        if (scared && reaching) {
            // Arms reaching up desperately
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.25, y + headRadius * 2 + 10);
            this.ctx.lineTo(x + width * 0.1, y + headRadius * 1.5 - 10);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.75, y + headRadius * 2 + 10);
            this.ctx.lineTo(x + width * 0.9, y + headRadius * 1.5 - 10);
            this.ctx.stroke();
            
            // Hands
            this.ctx.fillStyle = '#ffd1b3';
            this.ctx.beginPath();
            this.ctx.arc(x + width * 0.1, y + headRadius * 1.5 - 10, armThickness * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(x + width * 0.9, y + headRadius * 1.5 - 10, armThickness * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Arms at sides
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.25, y + headRadius * 2 + 10);
            this.ctx.lineTo(x + width * 0.15, y + headRadius * 2 + armLength);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.75, y + headRadius * 2 + 10);
            this.ctx.lineTo(x + width * 0.85, y + headRadius * 2 + armLength);
            this.ctx.stroke();
        }
    }
    
    drawHair(centerX, centerY, radius) {
        this.ctx.fillStyle = '#2c1810'; // Dark brown/black hair
        this.ctx.beginPath();
        
        // Simple hair cap
        this.ctx.arc(centerX, centerY - radius * 0.2, radius * 0.9, Math.PI, Math.PI * 2);
        this.ctx.fill();
        
        // Hair texture lines
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const angle = Math.PI + (i / 4) * Math.PI;
            const startX = centerX + Math.cos(angle) * radius * 0.7;
            const startY = centerY - radius * 0.2 + Math.sin(angle) * radius * 0.7;
            const endX = centerX + Math.cos(angle) * radius * 0.9;
            const endY = centerY - radius * 0.2 + Math.sin(angle) * radius * 0.9;
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
    }
    
    drawFace(centerX, centerY, radius, scared) {
        // Eyes
        const eyeSize = radius * 0.15;
        const eyeY = centerY - radius * 0.1;
        const eyeSpacing = radius * 0.4;
        
        // Eye whites
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX - eyeSpacing, eyeY, eyeSize * 1.2, eyeSize, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(centerX + eyeSpacing, eyeY, eyeSize * 1.2, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Pupils (wider if scared)
        this.ctx.fillStyle = '#2c3e50';
        const pupilSize = scared ? eyeSize * 1.2 : eyeSize * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeSpacing, eyeY, pupilSize, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeSpacing, eyeY, pupilSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye highlights
        this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeSpacing - eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeSpacing - eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eyebrows
        this.ctx.strokeStyle = '#2c1810';
        this.ctx.lineWidth = 2;
        if (scared) {
            // Raised worried eyebrows
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - eyeSpacing - eyeSize, eyeY - radius * 0.3);
            this.ctx.lineTo(centerX - eyeSpacing + eyeSize, eyeY - radius * 0.35);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + eyeSpacing - eyeSize, eyeY - radius * 0.35);
            this.ctx.lineTo(centerX + eyeSpacing + eyeSize, eyeY - radius * 0.3);
            this.ctx.stroke();
        } else {
            // Normal eyebrows
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - eyeSpacing - eyeSize, eyeY - radius * 0.25);
            this.ctx.lineTo(centerX - eyeSpacing + eyeSize, eyeY - radius * 0.25);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + eyeSpacing - eyeSize, eyeY - radius * 0.25);
            this.ctx.lineTo(centerX + eyeSpacing + eyeSize, eyeY - radius * 0.25);
            this.ctx.stroke();
        }
        
        // Mouth
        const mouthY = centerY + radius * 0.3;
        if (scared) {
            // Open mouth (O shape)
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.beginPath();
            this.ctx.ellipse(centerX, mouthY, radius * 0.15, radius * 0.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Slight smile
            this.ctx.strokeStyle = '#2c3e50';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, mouthY - radius * 0.1, radius * 0.2, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
        }
        
        // Nose
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY + radius * 0.05, radius * 0.08, radius * 0.12, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // Enhanced float rendering with realistic details
    drawRealisticBoat(x, y, width, height) {
        // Boat shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(x + 2, y + height - 2, width, 4);
        
        // Boat body with gradient
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, '#8B4513');
        gradient.addColorStop(0.6, '#654321');
        gradient.addColorStop(1, '#3e2a14');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width * 0.1, y);
        this.ctx.lineTo(x + width * 0.9, y);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Boat outline and details
        this.ctx.strokeStyle = '#2c1810';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Wooden plank lines
        this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
            const py = y + (height / 3) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x + width * 0.1 + (i * 3), py);
            this.ctx.lineTo(x + width * 0.9 - (i * 3), py);
            this.ctx.stroke();
        }
        
        // Highlight on edge
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width * 0.15, y + 2);
        this.ctx.lineTo(x + width * 0.85, y + 2);
        this.ctx.stroke();
    }
    
    drawRealisticRaft(x, y, width, height) {
        // Raft shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.25)';
        this.ctx.fillRect(x + 2, y + height - 2, width, 3);
        
        // Individual logs
        const logCount = 4;
        const logWidth = width / logCount;
        
        for (let i = 0; i < logCount; i++) {
            const logX = x + i * logWidth;
            
            // Log gradient
            const gradient = this.ctx.createLinearGradient(logX, y, logX + logWidth, y);
            gradient.addColorStop(0, '#a0826d');
            gradient.addColorStop(0.5, '#CD853F');
            gradient.addColorStop(1, '#8b6f47');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(logX, y, logWidth - 2, height);
            
            // Log rings
            this.ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            this.ctx.lineWidth = 1;
            const rings = 2 + Math.floor(Math.random() * 2);
            for (let r = 0; r < rings; r++) {
                const ringY = y + (height / (rings + 1)) * (r + 1);
                this.ctx.beginPath();
                this.ctx.moveTo(logX, ringY);
                this.ctx.lineTo(logX + logWidth - 2, ringY);
                this.ctx.stroke();
            }
        }
        
        // Rope binding
        this.ctx.strokeStyle = '#8b7355';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height * 0.3);
        this.ctx.lineTo(x + width, y + height * 0.3);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height * 0.7);
        this.ctx.lineTo(x + width, y + height * 0.7);
        this.ctx.stroke();
    }
    
    drawRealisticMattress(x, y, width, height) {
        // Mattress shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(x + 2, y + height - 1, width, 3);
        
        // Main mattress body
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, '#ff7f7f');
        gradient.addColorStop(0.5, '#FF6347');
        gradient.addColorStop(1, '#cd5334');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.roundRect(x, y, width, height, 8);
        this.ctx.fill();
        
        // Shine/highlight
        this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this.ctx.beginPath();
        this.roundRect(x + 3, y + 2, width - 6, height * 0.3, 5);
        this.ctx.fill();
        
        // Inflation valve
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(x + width - 10, y + height - 10, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    // Water effects
    drawWaterSurface(y, width, time) {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        // Animated wave
        for (let x = 0; x < width; x += 5) {
            const wave = Math.sin((x * 0.02) + (time * 0.002)) * 3;
            if (x === 0) {
                this.ctx.moveTo(x, y + wave);
            } else {
                this.ctx.lineTo(x, y + wave);
            }
        }
        this.ctx.stroke();
    }
    
    // Add splash particles
    addSplash(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: (Math.random() - 0.5) * 200,
                vy: -Math.random() * 300 - 100,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                alpha: 1.0,
                size: 2 + Math.random() * 3,
                color: 'rgba(100, 180, 255, '
            });
        }
    }
    
    // Add water ripple
    addRipple(x, y) {
        this.waterRipples.push({
            x: x,
            y: y,
            radius: 0,
            maxRadius: 50 + Math.random() * 50,
            speed: 80,
            alpha: 1.0
        });
    }
    
    // Draw all particles
    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color + p.alpha + ')';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    // Draw water ripples
    drawRipples() {
        this.waterRipples.forEach(r => {
            this.ctx.strokeStyle = `rgba(100, 180, 255, ${r.alpha * 0.5})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }
    
    // Helper functions
    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) * factor);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) * factor);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) * factor;
        const g = parseInt(hex.substr(2, 2), 16) * factor;
        const b = parseInt(hex.substr(4, 2), 16) * factor;
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.arcTo(x + width, y, x + width, y + radius, radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.arcTo(x, y + height, x, y + height - radius, radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.arcTo(x, y, x + radius, y, radius);
        this.ctx.closePath();
    }
}

