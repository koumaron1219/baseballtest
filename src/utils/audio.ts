// Web Audio API Sound Generator for 3D Baseball Game

class AudioController {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private isMuted: boolean = false;

  private init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported in this browser/frame.', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterVolume && this.ctx) {
      this.masterVolume.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  getMuteStatus() {
    return this.isMuted;
  }

  // Play Pitcher Throw "Swoosh" sound
  playThrow() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(300, time + 0.15);

    gain.gain.setValueAtTime(0.01, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
    gain.gain.linearRampToValueAtTime(0.01, time + 0.15);

    osc.connect(gain);
    if (this.masterVolume) gain.connect(this.masterVolume);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  // Play Bat Contact "Crack!" Sound
  playBatCrack() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    
    // Add wood pitch (medium frequency sine wave decayed quickly)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, time);
    osc1.frequency.exponentialRampToValueAtTime(600, time + 0.1);
    gain1.gain.setValueAtTime(0.8, time);
    gain1.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    osc1.connect(gain1);

    // Add snap/noise (white noise or filtered high osc)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1500, time);
    osc2.frequency.exponentialRampToValueAtTime(1200, time + 0.04);
    gain2.gain.setValueAtTime(0.9, time);
    gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    osc2.connect(gain2);

    if (this.masterVolume) {
      gain1.connect(this.masterVolume);
      gain2.connect(this.masterVolume);
    }

    osc1.start(time);
    osc1.stop(time + 0.2);
    osc2.start(time);
    osc2.stop(time + 0.1);
  }

  // Play Ball-Catch "Pop!" in glove
  playCatch() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    osc.connect(gain);
    if (this.masterVolume) gain.connect(this.masterVolume);

    osc.start(time);
    osc.stop(time + 0.09);
  }

  // Play Umpire call: "Strike!"
  playStrikeCall() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    // Two tones: first higher, then lower
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.setValueAtTime(170, time + 0.1);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.35);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.2);
    gain.gain.linearRampToValueAtTime(0.01, time + 0.38);

    osc.connect(gain);
    if (this.masterVolume) gain.connect(this.masterVolume);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  // Play Umpire call: "Ball!"
  playBallCall() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.setValueAtTime(130, time + 0.1);
    osc.frequency.exponentialRampToValueAtTime(90, time + 0.3);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(gain);
    if (this.masterVolume) gain.connect(this.masterVolume);

    osc.start(time);
    osc.stop(time + 0.32);
  }

  // Play Umpire call: "Out!"
  playOutCall() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.setValueAtTime(200, time + 0.05);
    osc.frequency.exponentialRampToValueAtTime(90, time + 0.25);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.15);
    gain.gain.linearRampToValueAtTime(0.01, time + 0.28);

    osc.connect(gain);
    if (this.masterVolume) gain.connect(this.masterVolume);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  // Simple crown celebration cheer
  playCheer() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const duration = 1.8;
    const time = this.ctx.currentTime;
    
    // Simulate crowd cheer with filtered noise or rising chord frequencies
    const frequencies = [261.63, 311.13, 392.00, 523.25]; // C Minor 7th chord elements
    frequencies.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + Math.random() * 5, time);
      // Vibrato & swell
      osc.frequency.linearRampToValueAtTime(freq * 1.05, time + 0.3);
      osc.frequency.linearRampToValueAtTime(freq, time + duration);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.2 + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      if (this.masterVolume) gain.connect(this.masterVolume);

      osc.start(time);
      osc.stop(time + duration + 0.1);
    });
  }

  // Inning transition sting (warm synth fanfare)
  playInningSting() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.3]; // Major triad sweep
    
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const noteTime = time + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.4);
      
      osc.connect(gain);
      if (this.masterVolume) gain.connect(this.masterVolume);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });
  }

  // Home run fanfare
  playHomerunTheme() {
    this.init();
    if (!this.ctx || this.isMuted || this.ctx.state === 'suspended') return;

    const time = this.ctx.currentTime;
    const notes = [329.63, 392.00, 523.25, 392.00, 523.25, 659.25]; // E, G, High C, G, High C, High E
    const intervals = [0, 0.15, 0.3, 0.45, 0.6, 0.75];

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const noteTime = time + intervals[idx];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.4);

      osc.connect(gain);
      if (this.masterVolume) gain.connect(this.masterVolume);

      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });
    
    // Play crowd cheer as well!
    this.playCheer();
  }
}

export const gameAudio = new AudioController();
