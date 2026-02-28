(() => {
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.2;
        this.master.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    click() {
      this.ensure();
      this.tone(900, 0.02, 'square', 0.08);
    }

    move() {
      this.ensure();
      this.tone(600, 0.04, 'triangle', 0.12);
    }

    illegal() {
      this.ensure();
      this.tone(200, 0.12, 'sawtooth', 0.12, -120);
    }

    check() {
      this.ensure();
      this.tone(820, 0.16, 'square', 0.14, 80);
    }

    capture() {
      this.ensure();
      this.tone(120, 0.12, 'triangle', 0.2);
      this.noise(0.16, 0.18);
      setTimeout(() => this.tone(80, 0.2, 'sawtooth', 0.12, -60), 18);
    }

    checkmate() {
      this.ensure();
      this.chord([220, 277, 330], 0.7, 0.18);
    }

    tone(freq, duration, type, gain = 0.12, sweep = 0) {
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (sweep !== 0) {
        osc.frequency.linearRampToValueAtTime(freq + sweep, now + duration);
      }

      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(amp);
      amp.connect(this.master);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    chord(notes, duration, gain) {
      notes.forEach((note, idx) => {
        const offset = idx * 0.03;
        setTimeout(() => this.tone(note, duration, 'triangle', gain, 40), offset * 1000);
      });
      this.noise(0.35, 0.08);
    }

    noise(duration, gain) {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 650;
      const amp = this.ctx.createGain();
      const now = this.ctx.currentTime;

      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(amp);
      amp.connect(this.master);
      source.start(now);
    }
  }

  window.AudioManager = AudioManager;
})();
