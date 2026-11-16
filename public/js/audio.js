// Tüm sesler Web Audio ile sentezlenir (dosya yok, telif sorunu yok).
// Ses hem hoparlöre hem de video kaydına (MediaStream) gider.
export class Sound {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.comp = this.ctx.createDynamicsCompressor();
    this.master.connect(this.comp);
    this.monitor = this.ctx.createGain();
    this.comp.connect(this.monitor);
    this.monitor.connect(this.ctx.destination);
    this.dest = this.ctx.createMediaStreamDestination();
    this.comp.connect(this.dest);
    this.noise = this.makeNoise(3);
    this.lastBounce = 0;
    this.muted = false;
    this.ambient = null;
  }

  get stream() {
    return this.dest.stream;
  }

  setMuted(m) {
    this.muted = m;
    this.master.gain.value = m ? 0 : 0.9;
  }

  // Kayıt sırasında hoparlörden duymak istemezsen
  setMonitor(on) {
    this.monitor.gain.value = on ? 1 : 0;
  }

  resume() {
    return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
  }

  makeNoise(sec) {
    const n = this.ctx.sampleRate * sec;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  env(gainNode, t, a, peak, d) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noiseSrc(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  bounce(v) {
    const now = this.ctx.currentTime;
    if (now - this.lastBounce < 0.035) return;
    this.lastBounce = now;
    const vol = Math.min(0.32, (v / 2200) ** 1.2);
    if (vol < 0.01) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const f = 320 + Math.random() * 380 + Math.min(500, v * 0.15);
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, now + 0.09);
    this.env(g, now, 0.003, vol, 0.1);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.15);
    // tık
    const n = this.noiseSrc();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    const ng = this.ctx.createGain();
    this.env(ng, now, 0.001, vol * 0.5, 0.03);
    n.connect(bp).connect(ng).connect(this.master);
    n.start(now, Math.random() * 2);
    n.stop(now + 0.05);
  }

  tick() {
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    this.env(g, now, 0.005, 0.12, 0.12);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.2);
  }

  whistleAt(t, dur) {
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    const g = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = 2900;
    lfo.frequency.value = 32;
    lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    bp.type = 'bandpass';
    bp.frequency.value = 2900;
    bp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.setValueAtTime(0.28, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  whistle() {
    this.whistleAt(this.ctx.currentTime, 0.55);
  }

  finalWhistle() {
    const t = this.ctx.currentTime;
    this.whistleAt(t, 0.28);
    this.whistleAt(t + 0.4, 0.28);
    this.whistleAt(t + 0.8, 0.9);
  }

  crowdSwell(peak, attack, decay, freq = 900) {
    const now = this.ctx.currentTime;
    const n = this.noiseSrc(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.6;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const g = this.ctx.createGain();
    this.env(g, now, attack, peak, decay);
    n.connect(bp).connect(lp).connect(g).connect(this.master);
    n.start(now, Math.random() * 2);
    n.stop(now + attack + decay + 0.1);
  }

  goal() {
    const now = this.ctx.currentTime;
    this.crowdSwell(0.7, 0.25, 2.6);
    this.crowdSwell(0.35, 0.15, 1.8, 1800);
    // korna (iki nota)
    for (const [f, d] of [[233, 0], [311, 0.02]]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = f;
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.14, now + d + 0.04);
      g.gain.setValueAtTime(0.14, now + 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      o.connect(lp).connect(g).connect(this.master);
      o.start(now + d);
      o.stop(now + 1.05);
    }
    // davul
    const k = this.ctx.createOscillator();
    const kg = this.ctx.createGain();
    k.frequency.setValueAtTime(150, now);
    k.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    this.env(kg, now, 0.003, 0.6, 0.3);
    k.connect(kg).connect(this.master);
    k.start(now);
    k.stop(now + 0.4);
  }

  ooh() {
    this.crowdSwell(0.25, 0.12, 0.8, 600);
  }

  outro() {
    this.crowdSwell(0.45, 0.4, 3.5);
  }

  ambientStart() {
    if (this.ambient) return;
    const n = this.noiseSrc(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.07;
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 0.25;
    lg.gain.value = 0.025;
    lfo.connect(lg).connect(g.gain);
    n.connect(bp).connect(g).connect(this.master);
    n.start();
    lfo.start();
    this.ambient = { n, lfo, g };
  }

  ambientStop() {
    if (!this.ambient) return;
    const { n, lfo, g } = this.ambient;
    const now = this.ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.6);
    n.stop(now + 0.7);
    lfo.stop(now + 0.7);
    this.ambient = null;
  }
}
