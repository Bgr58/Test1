// MOD 1 — Dönen Halka: Takım topları dönen bir halkanın içinde zıplar.
// Halkadaki boşluktan dışarı kaçan top GOL olur, yerine yenisi doğar.
import { integrate, collideBalls, collideStatic, capSpeed, ensureSpeed } from '../physics.js';
import { TAU, angDiff, drawSprite, drawTrail, pushTrail, rgba } from '../draw.js';

export const meta = { id: 'ring', name: 'Dönen Halka', hint: 'Boşluktan kaçan top GOL!' };

export const config = {
  gravity: 1150,
  gapHalf: 0.145, // boşluğun yarı açısı (radyan)
  ballsPerTeam: 2,
  baseR: 40,
  e: 0.98,
  minSpeed: 560,
  maxSpeed: 1900,
  respawn: 1.2,
  spin: [0.9, 1.6],
};

export function create({ rng, edge, arena, events }) {
  const C = config;
  const cx = arena.x + arena.w / 2;
  const cy = arena.y + arena.h / 2;
  const R = Math.min(arena.w, arena.h) / 2 - 40;
  let angle = rng.range(0, TAU);
  let omega = rng.sign() * rng.range(...C.spin);
  let flipIn = rng.range(5, 9);
  let gapGlow = 0;
  const balls = [];
  const queue = [];

  const radius = (team) => C.baseR * (1 - edge[team] * 0.22);
  const vmin = (team) => C.minSpeed * (1 + edge[team] * 0.2);

  function spawn(team) {
    const a = rng.range(0, TAU);
    const d = rng.range(0, R * 0.35);
    balls.push({
      team, r: radius(team), invMass: 1,
      x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
      vx: rng.range(-650, 650), vy: rng.range(-750, -250),
      rot: 0, spin: rng.range(-6, 6), out: false, outT: 0, born: 0, trail: [],
    });
  }
  for (let i = 0; i < C.ballsPerTeam; i++) {
    spawn(0);
    spawn(1);
  }

  const gapEnds = () =>
    [-1, 1].map((s) => {
      const a = angle + s * C.gapHalf;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    });

  function update(dt) {
    angle = (angle + omega * dt) % TAU;
    flipIn -= dt;
    if (flipIn <= 0) {
      omega = -Math.sign(omega) * rng.range(...C.spin);
      flipIn = rng.range(4, 9);
    }
    gapGlow = Math.max(0, gapGlow - dt * 1.5);
    for (let i = queue.length - 1; i >= 0; i--) {
      queue[i].t -= dt;
      if (queue[i].t <= 0) {
        spawn(queue[i].team);
        queue.splice(i, 1);
      }
    }
    const ends = gapEnds();
    for (const b of balls) {
      integrate(b, dt, 0, C.gravity);
      b.rot += b.spin * dt;
      b.born += dt;
      pushTrail(b);
      if (b.out) {
        b.outT += dt;
        continue;
      }
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const diff = angDiff(Math.atan2(dy, dx), angle);
      if (Math.abs(diff) < C.gapHalf) {
        if (d > R) {
          b.out = true;
          gapGlow = 1;
          events.goal(b.team, b.x, b.y);
          queue.push({ team: b.team, t: C.respawn });
          continue;
        }
      } else if (d + b.r > R) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = cx + nx * (R - b.r);
        b.y = cy + ny * (R - b.r);
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= (1 + C.e) * vn * nx;
          b.vy -= (1 + C.e) * vn * ny;
          // dönen duvarın sürtünmesi topa teğetsel hız verir
          b.vx += -ny * omega * R * 0.06;
          b.vy += nx * omega * R * 0.06;
          b.spin = omega * 3 + rng.range(-2, 2);
          ensureSpeed(b, vmin(b.team));
          events.hit(vn, b.x, b.y);
        }
      }
      for (const [ex, ey] of ends) {
        const v = collideStatic(b, ex, ey, 9, 0.9, -omega * (ey - cy), omega * (ex - cx));
        if (v > 0) events.hit(v, ex, ey);
      }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.out) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.out) continue;
        const v = collideBalls(a, b, C.e);
        if (v > 60) events.hit(v, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      capSpeed(a, C.maxSpeed);
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      if (balls[i].out && (balls[i].outT > 1.6 || balls[i].y > arena.y + arena.h + 200)) balls.splice(i, 1);
    }
  }

  function draw(ctx, assets) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(arena.x - 20, arena.y - 20, arena.w + 40, arena.h + 40);
    ctx.clip();

    const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(255,255,255,0.015)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    // halka
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.shadowColor = 'rgba(120,220,255,0.9)';
    ctx.shadowBlur = 28;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, angle + C.gapHalf, angle - C.gapHalf + TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // boşluk işareti
    const ga = angle;
    const gx = cx + Math.cos(ga) * (R + 60);
    const gy = cy + Math.sin(ga) * (R + 60);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.fillStyle = gapGlow > 0 ? `rgba(255,215,0,${0.6 + gapGlow * 0.4})` : 'rgba(255,215,0,0.85)';
    ctx.font = '900 34px Anton, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(assets.texts.t('goalLabel'), 0, 0);
    ctx.restore();
    for (const [ex, ey] of gapEnds()) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ex, ey, 12, 0, TAU);
      ctx.fill();
    }
    if (gapGlow > 0) {
      ctx.strokeStyle = `rgba(255,215,0,${gapGlow})`;
      ctx.lineWidth = 30 * gapGlow + 6;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8, angle - C.gapHalf, angle + C.gapHalf);
      ctx.stroke();
    }

    for (const b of balls) {
      const t = assets.teams[b.team];
      const alpha = b.out ? Math.max(0, 1 - b.outT / 1.6) : Math.min(1, b.born * 4);
      drawTrail(ctx, b.trail, b.r, t.glow);
      ctx.save();
      ctx.shadowColor = rgba(t.glow, 0.8);
      ctx.shadowBlur = 18;
      drawSprite(ctx, t.sprite, b.x, b.y, b.r, b.rot, alpha);
      ctx.restore();
    }
    ctx.restore();
  }

  return { update, draw };
}
