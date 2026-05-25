// Sound Manager for The Rising
// Uses Web Audio API for game sounds

/* AmbientPad - WebAudio ambient-pad music engine.
 * Final gain capped ~0.15 so it stays unobtrusive ambience.
 * Caller drives setVolume() from a 0..1 settings slider. */
class AmbientPad {
    constructor(audioCtx, masterDestination) {
        this.ctx = audioCtx;
        this.dest = masterDestination;
        this.out = audioCtx.createGain();
        this.out.gain.value = 0;
        this.out.connect(this.dest);
        this.nodes = [];
        this.playing = false;
        this._vol = 0.0;
    }
    setVolume(v) {
        this._vol = Math.max(0, Math.min(1, v));
        if (!this.ctx) return;
        const target = this._vol * 0.15;
        const now = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.linearRampToValueAtTime(target, now + 0.4);
        if (target > 0 && !this.playing) this.start();
        if (target === 0 && this.playing) this.stop();
    }
    start() {
        if (this.playing || !this.ctx) return;
        const now = this.ctx.currentTime;
        const freqs = this._chord || [87.31, 103.83, 130.81, 155.56];
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        filter.Q.value = 1.2;
        filter.connect(this.out);
        freqs.forEach((f, i) => {
            const o = this.ctx.createOscillator();
            o.type = i === 0 ? 'sine' : 'sawtooth';
            o.frequency.value = f;
            o.detune.value = (i - freqs.length / 2) * 6;
            const g = this.ctx.createGain();
            g.gain.value = (i === 0 ? 0.35 : 0.18) / freqs.length;
            o.connect(g).connect(filter);
            o.start(now);
            this.nodes.push(o, g);
        });
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05 + Math.random() * 0.05;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 280;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
        this.nodes.push(lfo, lfoGain, filter);
        this.playing = true;
    }
    stop() {
        if (!this.playing || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.linearRampToValueAtTime(0, now + 0.5);
        const nodes = this.nodes;
        this.nodes = [];
        this.playing = false;
        setTimeout(() => {
            for (const n of nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) {} }
        }, 700);
    }
    setChord(freqs) { this._chord = freqs; }
    resumeIfNeeded() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.musicGain = null;
        this.sfxGain = null;
        this.enabled = true;
        this.initialized = false;
        this.musicPad = null;
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
            try {
                this.musicPad = new AmbientPad(this.audioContext, this.audioContext.destination);
                this.musicPad.setChord([87.31, 103.83, 130.81, 155.56]);
            } catch (e) {}
        } catch (e) {
            console.log('Audio context not available:', e);
        }
    }
    setMusicVolume(v) {
        if (this.musicPad) this.musicPad.setVolume(v);
    }
    
    setMasterVolume(v) {
        if (!this.initialized) return;
        const vol = Math.max(0, Math.min(1, v));
        this.musicGain.gain.value = vol * 0.3;
        this.sfxGain.gain.value = vol * 0.5;
        this.masterVolume = vol;
    }

    // Play water ambient sound (loop)
    playWaterAmbient() {
        if (this._ambientRunning) return;
        this._ambientRunning = true;
        const loop = () => {
            if (!this.enabled || !this.initialized) {
                this._ambientRunning = false;
                return;
            }
            this.playTone(100, 0.05, 'sine', 2.0, this.musicGain);
            setTimeout(loop, 2000);
        };
        loop();
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


