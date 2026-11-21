// Maç akışı: giriş → oyun → son düdük → tahmin ekranı.
// Fizik sabit adımla (1/240 s) ilerler; böylece aynı seed her zaman aynı skoru üretir.
// Bu dosya DOM kullanmaz; Node'da simülasyon/test için de çalışır.
import { makeRng } from './rng.js';
import { getMode } from './modes/index.js';
import { Effects } from './effects.js';
import { makeTexts } from './i18n.js';

export const W = 1080;
export const H = 1920;
export const STEP = 1 / 240;
export const ARENA = { x: 70, y: 600, w: 940, h: 1000 };
export const INTRO = 3.2;
export const FINAL = 1.4;
export const OUTRO = 5.5;

const noop = () => {};
const NULL_AUDIO = new Proxy({}, { get: () => noop });

export class Match {
  /**
   * @param {object} o
   * @param {{name:string,color:string,color2:string,glow?:string}[]} o.teams
   * @param {string} o.modeId
   * @param {number} o.seed
   * @param {number} o.duration  oyun süresi (sn) — 90 dakikaya ölçeklenir
   * @param {[number,number]} o.edge  güç avantajı (-1..1)
   */
  constructor({ teams, modeId, seed, duration = 45, edge = [0, 0], audio = null, skipIntro = false, texts = null }) {
    this.texts = texts || makeTexts('tr');
    this.teams = teams;
    this.mode = getMode(modeId);
    this.seed = seed >>> 0;
    this.duration = duration;
    this.edge = edge;
    this.audio = audio || NULL_AUDIO;
    this.rng = makeRng(this.seed);
    this.fx = new Effects(makeRng(this.seed ^ 0x9e3779b9));
    this.score = [0, 0];
    this.goals = [];
    this.phase = skipIntro ? 'play' : 'intro';
    this.phaseT = 0;
    this.playSteps = 0;
    this.durationSteps = Math.round(duration / STEP);
    this.acc = 0;
    this.total = 0;
    this.done = false;
    this.ticks = 0;
    // müzik girişle başlar (ses yoksa NULL_AUDIO, hiçbir şey olmaz)
    if (!skipIntro) this.audio.musicStart?.(this.seed);
    this.tensionAt = Math.floor(this.durationSteps * 0.75);
    this.game = this.mode.create({
      rng: this.rng,
      edge,
      arena: ARENA,
      events: {
        goal: (team, x, y) => this.onGoal(team, x, y),
        hit: (v, x, y) => this.onHit(v, x, y),
        // key: 'save' | 'post' | 'out' — metin dil paketinden gelir
        pop: (key, x, y, color) => {
          if (this.phase === 'play') {
            this.fx.pop(this.texts.t(key), x, y, color);
            if (key === 'save' || key === 'post') this.audio.ooh?.();
          }
        },
      },
    });
  }

  get minute() {
    if (this.phase === 'intro') return 0;
    if (this.phase !== 'play') return 90;
    return Math.min(90, Math.max(1, Math.ceil((this.playSteps / this.durationSteps) * 90)));
  }

  get playProgress() {
    return Math.min(1, this.playSteps / this.durationSteps);
  }

  onGoal(team, x, y) {
    if (this.phase !== 'play') return;
    this.score[team]++;
    this.goals.push({ team, minute: this.minute });
    const t = this.teams[team];
    this.fx.goal(team, t.glow || t.color, t.name);
    this.fx.confetti(x, y, [t.color, t.color2, '#ffffff', '#ffd700'], 70, 1100);
    this.fx.confetti(team === 0 ? 230 : 850, 330, [t.color, t.color2, '#ffffff', '#ffd700'], 50, 800);
    this.audio.goal?.();
  }

  onHit(v, x, y) {
    if (this.phase !== 'play' && this.phase !== 'final') return;
    this.audio.bounce?.(v);
    if (v > 700) this.fx.spark(x, y, '#ffffff', 6, 320);
  }

  advance(dt) {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= STEP) {
      this.step();
      this.acc -= STEP;
    }
  }

  step() {
    this.phaseT += STEP;
    this.total += STEP;
    switch (this.phase) {
      case 'intro': {
        const tickAt = [0.9, 1.7, 2.5];
        if (this.ticks < tickAt.length && this.phaseT >= tickAt[this.ticks]) {
          this.ticks++;
          this.audio.tick?.();
        }
        if (this.phaseT >= INTRO) this.setPhase('play');
        break;
      }
      case 'play':
        this.game.update(STEP);
        this.playSteps++;
        if (this.playSteps === this.tensionAt) this.audio.musicLevel?.(2); // son dakikalar: müzik yoğunlaşır
        if (this.playSteps >= this.durationSteps) this.setPhase('final');
        break;
      case 'final':
        this.game.update(STEP);
        if (this.phaseT >= FINAL) this.setPhase('outro');
        break;
      case 'outro':
        this.game.update(STEP);
        if (Math.floor((this.phaseT - STEP) * 8) !== Math.floor(this.phaseT * 8)) {
          const w = this.winner;
          const cols = w === -1 ? ['#ffffff', '#ffd700'] : [this.teams[w].color, this.teams[w].color2, '#ffd700'];
          this.fx.rain(W, cols, 5);
        }
        if (this.phaseT >= OUTRO) {
          this.done = true;
          this.setPhase('done');
        }
        break;
      default:
        break;
    }
    this.fx.update(STEP);
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'play') {
      this.audio.whistle?.();
      this.audio.ambientStart?.();
      this.audio.musicLevel?.(1);
    } else if (p === 'final') {
      this.audio.finalWhistle?.();
      this.audio.musicLevel?.(-1);
    } else if (p === 'outro') {
      this.audio.outro?.();
      this.audio.musicLevel?.(3);
    } else if (p === 'done') {
      this.audio.ambientStop?.();
      this.audio.musicStop?.();
    }
  }

  get winner() {
    const [a, b] = this.score;
    return a === b ? -1 : a > b ? 0 : 1;
  }

  // Sadece oyunu (giriş/çıkış olmadan) hızlıca sonuna kadar oynat — test/simülasyon için.
  simulate() {
    if (this.phase === 'intro') this.setPhase('play');
    while (this.phase === 'play') this.step();
    return [...this.score];
  }
}
