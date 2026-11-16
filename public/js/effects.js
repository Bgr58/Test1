// Görsel efektler: konfeti, kıvılcım, uçan yazılar, ekran sarsıntısı, flaş.
import { TAU } from './draw.js';

export class Effects {
  constructor(rng) {
    this.rng = rng;
    this.parts = [];
    this.pops = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.banner = null;
    this.scorePulse = [0, 0];
    this.time = 0;
  }

  confetti(x, y, colors, n = 90, power = 1000) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.range(-Math.PI, 0) + r.range(-0.4, 0.4);
      const s = r.range(0.35, 1) * power;
      this.parts.push({
        kind: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        rot: r.range(0, TAU), vr: r.range(-12, 12), w: r.range(10, 20), h: r.range(6, 12),
        color: colors[i % colors.length], life: r.range(1.6, 2.6), age: 0,
      });
    }
  }

  rain(W, colors, n = 6) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      this.parts.push({
        kind: 'confetti', x: r.range(0, W), y: -20, vx: r.range(-80, 80), vy: r.range(100, 300),
        rot: r.range(0, TAU), vr: r.range(-10, 10), w: r.range(10, 20), h: r.range(6, 12),
        color: colors[i % colors.length], life: 4, age: 0,
      });
    }
  }

  spark(x, y, color, n = 8, power = 380) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, TAU);
      const s = r.range(0.3, 1) * power;
      this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: r.range(0.25, 0.5), age: 0, size: r.range(3, 6) });
    }
    if (this.parts.length > 1400) this.parts.splice(0, this.parts.length - 1400);
  }

  pop(text, x, y, color = '#fff') {
    this.pops.push({ text, x, y, color, age: 0, life: 1.1 });
  }

  goal(team, color, name) {
    this.banner = { team, color, name, age: 0, life: 1.9 };
    this.shake = 26;
    this.flash = 0.45;
    this.flashColor = color;
    this.scorePulse[team] = 1;
  }

  update(dt) {
    this.time += dt;
    for (const p of this.parts) {
      p.age += dt;
      if (p.kind === 'confetti') {
        p.vy += 900 * dt;
        const f = Math.exp(-2.2 * dt);
        p.vx *= f;
        p.vy = Math.min(p.vy * f, 420);
        p.rot += p.vr * dt;
      } else {
        const f = Math.exp(-4 * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const p of this.pops) {
      p.age += dt;
      p.y -= 70 * dt;
    }
    this.pops = this.pops.filter((p) => p.age < p.life);
    this.shake *= Math.exp(-6 * dt);
    if (this.shake < 0.3) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.2);
    this.scorePulse = this.scorePulse.map((v) => Math.max(0, v - dt * 1.5));
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age > this.banner.life) this.banner = null;
    }
  }

  shakeOffset() {
    if (!this.shake) return [0, 0];
    const t = this.time * 60;
    return [Math.sin(t * 1.7) * this.shake, Math.cos(t * 2.3) * this.shake];
  }

  drawParticles(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = p.kind === 'confetti' ? Math.min(1, a * 2) : a;
      ctx.fillStyle = p.color;
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.rot * 1.3)), p.w, p.h * Math.abs(Math.cos(p.rot * 1.3)) + 1);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 1, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPops(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const k = p.age / p.life;
      const s = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - (k - 0.15) * 0.15;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `900 ${Math.round(46 * s)}px Anton, Impact, sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
