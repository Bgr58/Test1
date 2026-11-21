// Arka plan müziği.
//  - 'synth': Telifsiz, araç tarafından anlık BESTELENİP çalınan enerjik elektronik müzik
//    (kick, clap, hi-hat, bas, arpej). Her maç seed'e göre farklı tempo/ton/akor dizisi.
//  - 'file' : music/ klasöründeki bir parça (ör. YouTube Ses Kitaplığı'ndan indirilen) döngüde çalar.
// Seviyeler (videoyla senkron): 0 giriş (gerilim), 1 maç (tam ritim), 2 son dakikalar (yoğun),
// -1 son düdük (durur), 3 bitiş ekranı (kutlama), stop.
import { makeRng } from './rng.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// Minör tonda akor dizileri: [kök (yarım ton), majör mü]
const PROGRESSIONS = [
  [[0, false], [-4, true], [3, true], [-2, true]], // i – VI – III – VII
  [[0, false], [3, true], [-2, true], [-4, true]], // i – III – VII – VI
  [[0, false], [-4, true], [-2, true], [0, false]], // i – VI – VII – i
  [[0, false], [5, false], [-4, true], [-2, true]], // i – iv – VI – VII
];
const KEYS = [33, 31, 34, 35, 36, 30]; // A1, G1, A#1, B1, C2, F#1 (bas kökü, MIDI)

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    this.volume = 0.6;
    this.mode = 'synth';
    this.buffer = null;
    this.timer = null;
    this.level = 0;
    this.noise = this.makeNoise();
  }

  makeNoise() {
    const n = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Kayıttan ÖNCE çağrılır (dosya modunda parçayı indirip çözer)
  async prepare({ mode = 'synth', volume = 0.6, file = null } = {}) {
    this.mode = mode;
    this.volume = Math.max(0, Math.min(1, volume));
    this.buffer = null;
    if (mode === 'file') {
      if (!file) {
        this.mode = 'synth'; // klasör boşsa dahili müziğe düş
        return;
      }
      try {
        const r = await fetch(file);
        if (!r.ok) throw new Error(r.status);
        this.buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch {
        this.mode = 'synth';
      }
    }
  }

  gainFor(level) {
    if (this.mode === 'off') return 0;
    const base = this.mode === 'file' ? 0.8 : 0.85;
    const k = { 0: 0.75, 1: 1, 2: 1.1, 3: 0.9 }[level] ?? 1;
    return base * this.volume * k;
  }

  ramp(target, sec) {
    const g = this.out.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0, target), now + sec);
  }

  start(seed = 1) {
    this.stop(true);
    if (this.mode === 'off') return;
    this.level = 0;
    this.ramp(this.gainFor(0), 0.3);
    if (this.mode === 'file' && this.buffer) {
      const rng = makeRng(seed ^ 0x51f15e);
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = true;
      src.connect(this.out);
      src.start(this.ctx.currentTime + 0.02, rng.range(0, Math.max(0, this.buffer.duration - 60)) % this.buffer.duration);
      this.src = src;
      return;
    }
    const rng = makeRng((seed ^ 0x6d757369) >>> 0);
    this.tempo = Math.round(rng.range(124, 142));
    this.prog = rng.pick(PROGRESSIONS);
    this.root = rng.pick(KEYS);
    this.bassPattern = rng.pick([
      [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
      [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0],
    ]);
    this.arpShape = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]]);
    this.step = 0;
    this.stepDur = 60 / this.tempo / 4;
    this.next = this.ctx.currentTime + 0.06;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900; // giriş: boğuk, maçla açılır
    this.filter.Q.value = 0.7;
    this.filter.connect(this.out);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  setLevel(level) {
    if (this.mode === 'off') return;
    this.level = level;
    if (level === -1) {
      this.ramp(0, 0.6); // son düdük: müzik susar, düdük duyulsun
      return;
    }
    this.ramp(this.gainFor(level), level === 1 ? 0.05 : 0.6);
    if (this.filter) {
      const f = this.filter.frequency;
      const now = this.ctx.currentTime;
      f.cancelScheduledValues(now);
      f.setValueAtTime(f.value, now);
      f.exponentialRampToValueAtTime(level === 0 ? 900 : level === 3 ? 6000 : 12000, now + (level === 1 ? 0.08 : 1.5));
    }
  }

  // Gol anında müziği kıs (gol sesi öne çıksın), sonra geri aç
  duck(sec = 1.6) {
    if (this.mode === 'off' || this.level === -1) return;
    const g = this.out.gain;
    const now = this.ctx.currentTime;
    const v = this.gainFor(this.level);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(v * 0.3, now + 0.08);
    g.setValueAtTime(v * 0.3, now + sec);
    g.linearRampToValueAtTime(v, now + sec + 0.8);
  }

  stop(immediate = false) {
    clearInterval(this.timer);
    this.timer = null;
    if (this.src) {
      try {
        this.src.stop(this.ctx.currentTime + (immediate ? 0 : 1));
      } catch { /* zaten durmuş */ }
      this.src = null;
    }
    if (!immediate) this.ramp(0, 0.8);
    else this.out.gain.value = 0;
  }

  // ------------------------------------------------------------ sentez müzik
  schedule() {
    while (this.next < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.next);
      this.next += this.stepDur;
      this.step++;
    }
  }

  chordAt(bar) {
    const [deg, major] = this.prog[bar % this.prog.length];
    const r = this.root + deg;
    return { root: r, tones: [r, r + (major ? 4 : 3), r + 7, r + 12] };
  }

  playStep(s, t) {
    const pos = s % 16;
    const bar = Math.floor(s / 16);
    const L = this.level;
    if (L === -1) return;
    const chord = this.chordAt(bar);

    if (L === 0) {
      // giriş: boğuk kick + hızlanan hi-hat + yükselen "riser"
      if (pos % 4 === 0) this.kick(t, 0.7);
      if (pos % 2 === 0) this.hat(t, 0.12 + 0.05 * (bar % 2));
      if (pos === 0 && bar % 2 === 0) this.riser(t, this.stepDur * 16 * 2);
      if (pos % 8 === 4) this.bass(t, chord.root, this.stepDur * 3, 0.5);
      return;
    }
    if (L === 3) {
      // bitiş: kutlama akorları + yarım tempo ritim
      if (pos === 0) this.stab(t, chord.tones, this.stepDur * 12, 0.22);
      if (pos === 0 || pos === 10) this.kick(t, 0.8);
      if (pos === 8) this.clap(t, 0.5);
      if (pos % 2 === 1) this.hat(t, 0.08);
      if (pos % 4 === 0) this.bass(t, chord.root, this.stepDur * 2, 0.6);
      return;
    }
    // maç (L=1) ve son dakikalar (L=2)
    if (pos % 4 === 0) this.kick(t, 1);
    if (L === 2 && pos === 14) this.kick(t, 0.6);
    if (pos === 4 || pos === 12) this.clap(t, 0.7);
    if (pos % 4 === 2) this.hat(t, 0.22, true);
    else if (L === 2 || pos % 2 === 1) this.hat(t, 0.09);
    if (this.bassPattern[pos]) this.bass(t, chord.root + (pos === 15 ? 12 : 0), this.stepDur * 0.9, 0.9);
    if (pos === 0 && bar % 2 === 0) this.stab(t, chord.tones.map((n) => n + 24), this.stepDur * 2, 0.12);
    if (L === 2 || bar % 4 >= 2) {
      const n = chord.tones[this.arpShape[pos % 4]] + 36;
      this.lead(t, n, this.stepDur * 0.8, L === 2 ? 0.1 : 0.06);
    }
  }

  env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  kick(t, v) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this.env(g, t, 0.9 * v, 0.003, 0.25);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + 0.3);
  }

  noiseHit(t, v, type, freq, dur, q = 0.8) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, v, 0.002, dur);
    n.connect(f).connect(g).connect(this.filter);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.05);
  }

  hat(t, v, open = false) {
    this.noiseHit(t, v, 'highpass', 8000, open ? 0.12 : 0.04);
  }

  clap(t, v) {
    for (const d of [0, 0.012, 0.024]) this.noiseHit(t + d, v * 0.6, 'bandpass', 1500, 0.12, 1.2);
  }

  bass(t, midi, dur, v) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    this.env(g, t, 0.32 * v, 0.005, dur);
    o.connect(f).connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  lead(t, midi, dur, v) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = mtof(midi);
    this.env(g, t, v, 0.004, dur);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  stab(t, notes, dur, v) {
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det;
        this.env(g, t, v / notes.length, 0.01, dur);
        o.connect(g).connect(this.filter);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  riser(t, dur) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    n.connect(f).connect(g).connect(this.out); // riser filtreye takılmasın
    n.start(t);
    n.stop(t + dur + 0.1);
  }
}
