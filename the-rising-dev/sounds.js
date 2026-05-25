// Sound Manager for The Rising
// Uses Web Audio API for game sounds

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.musicGain = null;
        this.sfxGain = null;
        this.enabled = true;
        this.initialized = false;
    }
    
    async init() {
        if (this.initialized) return;
        
        try {
            // Create audio context (needs user interaction first)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for volume control
            this.musicGain = this.audioContext.createGain();
            this.sfxGain = this.audioContext.createGain();
            
            this.musicGain.connect(this.audioContext.destination);
            this.sfxGain.connect(this.audioContext.destination);
            
            this.musicGain.gain.value = 0.3;
            this.sfxGain.gain.value = 0.5;
            
            this.initialized = true;
        } catch (e) {
            console.log('Audio context not available:', e);
        }
    }
    
    // Play water ambient sound (loop)
    playWaterAmbient() {
        this.playTone(100, 0.05, 'sine', 2.0, this.musicGain);
        setTimeout(() => {
            if (this.enabled) this.playWaterAmbient();
        }, 2000);
    }
    
    // Play splash when block hits water
    playSplash() {
        if (!this.enabled || !this.initialized) return;
        
        // White noise burst for splash
        const duration = 0.3;
        const now = this.audioContext.currentTime;
        
        const noise = this.audioContext.createBufferSource();
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start(now);
        noise.stop(now + duration);
    }
    
    // Play stacking sound (successful placement)
    playStack() {
        if (!this.enabled || !this.initialized) return;
        
        // Two-tone click
        this.playTone(400, 0.05, 'square', 0.1, this.sfxGain);
        setTimeout(() => {
            this.playTone(600, 0.05, 'square', 0.08, this.sfxGain);
        }, 30);
    }
    
    // Play perfect alignment sound
    playPerfect() {
        if (!this.enabled || !this.initialized) return;
        
        this.playTone(800, 0.1, 'sine', 0.15, this.sfxGain);
        setTimeout(() => {
            this.playTone(1000, 0.1, 'sine', 0.15, this.sfxGain);
        }, 50);
        setTimeout(() => {
            this.playTone(1200, 0.15, 'sine', 0.15, this.sfxGain);
        }, 100);
    }
    
    // Play drowning sound (subtle, not graphic)
    playDrown() {
        if (!this.enabled || !this.initialized) return;
        
        // Descending bubbling sound
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }
    
    // Play freeze sound
    playFreeze() {
        if (!this.enabled || !this.initialized) return;
        
        // Crystalline freezing sound
        const now = this.audioContext.currentTime;
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const freq = 800 + Math.random() * 400;
                this.playTone(freq, 0.2, 'sine', 0.1, this.sfxGain);
            }, i * 100);
        }
    }
    
    // Play level complete sound
    playLevelComplete() {
        if (!this.enabled || !this.initialized) return;
        
        // Ascending victory tones
        const notes = [400, 500, 600, 800];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.2, 'sine', 0.15, this.sfxGain);
            }, i * 150);
        });
    }
    
    // Play rising water warning
    playWarning() {
        if (!this.enabled || !this.initialized) return;
        
        this.playTone(300, 0.1, 'sawtooth', 0.08, this.sfxGain);
        setTimeout(() => {
            this.playTone(300, 0.1, 'sawtooth', 0.08, this.sfxGain);
        }, 150);
    }
    
    // Helper: Play a tone
    playTone(frequency, duration, type = 'sine', volume = 0.1, destination = null) {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = type;
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.connect(gain);
        gain.connect(destination || this.sfxGain);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    // Play ambient wind/tension
    playTension() {
        if (!this.enabled || !this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        gain.gain.value = 0.03;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(now);
        osc.stop(now + 3.0);
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Create global sound manager
const soundManager = new SoundManager();

