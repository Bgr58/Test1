// Tüm sesler Web Audio ile sentezlenir (dosya yok, telif sorunu yok).
// Ses hem hoparlöre hem de video kaydına (MediaStream) gider.
import { Music } from './music.js';

export class Sound {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1.4; // Shorts için yeterince yüksek; kompresör + limiter kırpılmayı önler
    // master → kompresör → kazanç → limiter → (hoparlör + video kaydı)
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.2;
    this.makeup = this.ctx.createGain();
    this.makeup.gain.value = 0.95; // hedef ≈ -14 LUFS (YouTube normalizasyon seviyesi)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.master.connect(this.comp).connect(this.makeup).connect(this.limiter);
    this.monitor = this.ctx.createGain();
    this.limiter.connect(this.monitor);
    this.monitor.connect(this.ctx.destination);
    this.dest = this.ctx.createMediaStreamDestination();
    this.limiter.connect(this.dest);
    this.noise = this.makeNoise(3);
    this.lastBounce = 0;
    this.muted = false;
    this.ambient = null;
    this.music = new Music(this.ctx, this.master);
    // top/çarpışma sesleri ayrı kanalda ve kısık (müzik ve tribün öne çıksın)
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.4;
    this.sfx.connect(this.master);
    // stadyum yankısı (yapay impuls yanıtı)
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.2, 2.8);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.goalBuffers = []; // sounds/ klasöründen gerçek gol/tribün kayıtları (varsa)
  }

  get stream() {
    return this.dest.stream;
  }

  setMuted(m) {
    this.muted = m;
    this.master.gain.value = m ? 0 : 1.4;
  }

  // Kayıt sırasında hoparlörden duymak istemezsen
  setMonitor(on) {
    this.monitor.gain.value = on ? 1 : 0;
  }

  resume() {
    return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
  }

  makeImpulse(sec, decay) {
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * sec);
    const b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
    }
    return b;
  }

  // sounds/ klasöründeki gol sesleri (ör. YouTube Ses Kitaplığı'ndan "crowd cheer"): varsa sentez yerine bunlar çalar
  async prepareGoalSounds(urls = []) {
    this.goalBuffers = [];
    for (const u of urls.slice(0, 6)) {
      try {
        const r = await fetch(u);
        if (r.ok) this.goalBuffers.push(await this.ctx.decodeAudioData(await r.arrayBuffer()));
      } catch { /* bozuk dosya: atla */ }
    }
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
    if (now - this.lastBounce < 0.06) return;
    this.lastBounce = now;
    const vol = Math.min(0.25, (v / 2400) ** 1.3);
    if (vol < 0.015) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const f = 320 + Math.random() * 380 + Math.min(500, v * 0.15);
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, now + 0.09);
    this.env(g, now, 0.003, vol, 0.08);
    o.connect(g).connect(this.sfx);
    o.start(now);
    o.stop(now + 0.15);
    // tık
    const n = this.noiseSrc();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    const ng = this.ctx.createGain();
    this.env(ng, now, 0.001, vol * 0.3, 0.025);
    n.connect(bp).connect(ng).connect(this.sfx);
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

  // ---- müzik (bkz. music.js)
  prepareMusic(opts) {
    return this.music.prepare(opts);
  }

  musicStart(seed) {
    this.music.start(seed);
  }

  musicLevel(level) {
    this.music.setLevel(level);
  }

  musicStop() {
    this.music.stop();
  }

  goal() {
    this.music.duck(2.4);
    const now = this.ctx.currentTime;
    if (this.goalBuffers.length) {
      // gerçek kayıt (sounds/ klasörü)
      const src = this.ctx.createBufferSource();
      src.buffer = this.goalBuffers[Math.floor(Math.random() * this.goalBuffers.length)];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.9, now);
      g.gain.setValueAtTime(0.9, now + 3.2);
      g.gain.linearRampToValueAtTime(0, now + 4);
      src.connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 4.1);
      return;
    }
    // sentez: "GOOOOL!" diye bağıran tribün + uğultu + alkış + yankı
    this.crowdShout(now, 2.4);
    this.crowdSwell(0.55, 0.2, 3.2);
    this.crowdSwell(0.25, 0.3, 2.6, 1800);
    this.claps(now + 1.4, 2.2, 0.35);
    // vuruş anı: alçak "gümm"
    const k = this.ctx.createOscillator();
    const kg = this.ctx.createGain();
    k.frequency.setValueAtTime(120, now);
    k.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    this.env(kg, now, 0.003, 0.5, 0.35);
    k.connect(kg).connect(this.master);
    k.start(now);
    k.stop(now + 0.45);
  }

  // Kalabalık "GOOOOL": farklı perdelerde 28 ses (erkek/kadın karışık), "o" ünlüsü formantları,
  // yükselen perde + titreşim, sonda "l"ye kapanış; stadyum yankısıyla.
  crowdShout(t0, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.75, t0 + 0.14); // "G" atağı
    out.gain.setValueAtTime(0.75, t0 + dur - 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(this.master);
    out.connect(this.reverb);
    const voice = ctx.createGain();
    voice.gain.value = 1;
    // "o" formantları; sonda F1/F2 düşer ("l")
    for (const [f, q, g, fEnd] of [[560, 6, 1, 380], [900, 7, 0.6, 700], [2450, 8, 0.22, 2400], [3300, 9, 0.1, 3200]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f * 1.15, t0); // "Go"nun başı biraz açık
      bp.frequency.linearRampToValueAtTime(f, t0 + 0.25);
      bp.frequency.setValueAtTime(f, t0 + dur - 0.5);
      bp.frequency.linearRampToValueAtTime(fEnd, t0 + dur - 0.15);
      const gg = ctx.createGain();
      gg.gain.value = g * 2.2;
      voice.connect(bp).connect(gg).connect(out);
    }
    const N = 28;
    for (let i = 0; i < N; i++) {
      const female = i % 3 === 0;
      const base = female ? 230 + Math.random() * 110 : 120 + Math.random() * 90;
      const start = t0 + Math.random() * 0.12; // herkes aynı anda başlamaz
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.82, start);
      o.frequency.exponentialRampToValueAtTime(base * 1.12, start + 0.35 + Math.random() * 0.2); // bağırırken perde yükselir
      o.frequency.exponentialRampToValueAtTime(base * (1.0 + Math.random() * 0.08), t0 + dur);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 4.5 + Math.random() * 2.5;
      lg.gain.value = base * 0.018;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = (0.6 + Math.random() * 0.4) / N;
      o.connect(g).connect(voice);
      o.start(start);
      lfo.start(start);
      o.stop(t0 + dur + 0.05);
      lfo.stop(t0 + dur + 0.05);
    }
    // nefes / bağırış pürüzü
    const n = this.noiseSrc(true);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1400;
    hp.Q.value = 0.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    n.connect(hp).connect(ng).connect(voice);
    n.start(t0, Math.random() * 2);
    n.stop(t0 + dur + 0.05);
  }

  // dağınık alkış
  claps(t0, dur, peak) {
    for (let i = 0; i < 70; i++) {
      const t = t0 + Math.random() * dur;
      const fade = 1 - (t - t0) / dur;
      const n = this.noiseSrc();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 1400;
      bp.Q.value = 1.5;
      const g = this.ctx.createGain();
      this.env(g, t, 0.001, peak * (0.3 + Math.random() * 0.7) * fade + 0.001, 0.05);
      n.connect(bp).connect(g).connect(this.master);
      n.start(t, Math.random() * 2);
      n.stop(t + 0.08);
    }
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
