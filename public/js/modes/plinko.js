// MOD 2 — Plinko Kalesi: Yukarıdan takım topları düşer, çivilere çarparak iner.
// Alttaki altın "GOL" cebine giren top gol olur. Ceplerde sağa sola kayan kaleciler var.
import { integrate, collideBalls, collideStatic, collideSegment, capSpeed } from '../physics.js';
import { TAU, drawSprite, roundRect, rgba } from '../draw.js';

export const meta = { id: 'plinko', name: 'Plinko Kalesi', hint: 'GOL cebine düşen top skor!' };

export const config = {
  gravity: 1500,
  dropEvery: 1.2,
  ballR: 25,
  pegR: 9,
  rows: 10,
  cols: 9,
  nSlots: 7,
  goalSlots: 1,
  e: 0.5,
  keeperW: 0.45, // cep genişliğine oranla kaleci boyu
  keeperSpeed: [1.3, 2.2],
  maxBalls: 14,
};

export function create({ rng, edge, arena, events }) {
  const C = config;
  const left = arena.x;
  const right = arena.x + arena.w;
  const floor = arena.y + arena.h - 12;
  const divH = 160;
  const slotTop = floor - divH;
  const pegTop = arena.y + 150;
  const pegBottom = slotTop - 70;
  const rowGap = (pegBottom - pegTop) / (C.rows - 1);
  const spacing = arena.w / C.cols;
  const slotW = arena.w / C.nSlots;

  const pegs = [];
  for (let r = 0; r < C.rows; r++) {
    const y = pegTop + r * rowGap;
    const off = r % 2 ? spacing / 2 : 0;
    for (let c = 0; c <= C.cols; c++) {
      const x = left + off + c * spacing;
      if (x < left + 18 || x > right - 18) continue;
      pegs.push({ x, y, flash: 0 });
    }
  }

  const dividers = [];
  for (let i = 1; i < C.nSlots; i++) dividers.push(left + i * slotW);

  // gol cepleri (yan yana olmayan, ortadaki cebe ağırlık vermeyen seçim)
  const idx = [...Array(C.nSlots).keys()];
  const goalSet = new Set();
  while (goalSet.size < C.goalSlots) {
    const k = rng.pick(idx);
    if (![...goalSet].some((g) => Math.abs(g - k) < 2)) goalSet.add(k);
  }
  const keepers = [...goalSet].map((slot) => ({
    slot, phase: rng.range(0, TAU), speed: rng.range(...C.keeperSpeed), x: left + (slot + 0.5) * slotW, vx: 0, y: slotTop + 40, flash: 0,
  }));
  const keeperHalf = (slotW * C.keeperW) / 2;
  const slotFlash = new Array(C.nSlots).fill(0);

  const balls = [];
  let dropT = 0.2;
  let launcherX = arena.x + arena.w / 2;
  let time = 0;

  function drop() {
    if (balls.filter((b) => !b.done).length >= C.maxBalls) return;
    const team = rng.chance(0.5 + edge[0] * 0.3) ? 0 : 1;
    const x = arena.x + arena.w / 2 + rng.range(-arena.w * 0.4, arena.w * 0.4);
    launcherX = x;
    balls.push({
      team, r: C.ballR * (1 - edge[team] * 0.15), invMass: 1,
      x, y: arena.y + 50, vx: rng.range(-80, 80), vy: rng.range(0, 120),
      rot: 0, spin: rng.range(-4, 4), done: false, doneT: 0, saved: false,
    });
  }

  function updateKeepers(dt) {
    for (const k of keepers) {
      const cxs = left + (k.slot + 0.5) * slotW;
      const range = slotW / 2 - keeperHalf - 4;
      const nx = cxs + Math.sin(time * k.speed + k.phase) * range;
      k.vx = (nx - k.x) / (dt || 1);
      k.x = nx;
      k.flash = Math.max(0, k.flash - dt * 2);
    }
  }

  function update(dt) {
    time += dt;
    dropT -= dt;
    if (dropT <= 0) {
      drop();
      dropT = C.dropEvery * rng.range(0.85, 1.15);
    }
    updateKeepers(dt);
    for (const p of pegs) p.flash = Math.max(0, p.flash - dt * 3);
    for (let i = 0; i < slotFlash.length; i++) slotFlash[i] = Math.max(0, slotFlash[i] - dt * 1.2);

    for (const b of balls) {
      if (b.done) {
        b.doneT += dt;
        continue;
      }
      integrate(b, dt, 0, C.gravity, 0.15);
      b.rot += b.spin * dt;
      if (b.y < slotTop + 10) {
        for (const p of pegs) {
          const v = collideStatic(b, p.x, p.y, C.pegR, C.e);
          if (v > 0) {
            if (v > 80) {
              b.vx += rng.range(-70, 70);
              p.flash = 1;
              b.spin = rng.range(-8, 8);
              events.hit(v, p.x, p.y);
            }
          }
        }
      }
      // yan duvarlar
      if (b.x - b.r < left) { b.x = left + b.r; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x + b.r > right) { b.x = right - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      // bölmeler
      for (const x of dividers) {
        const v = collideSegment(b, x, slotTop, x, floor, 0.4, 4);
        if (v > 120) events.hit(v * 0.6, x, b.y);
      }
      // kaleciler
      for (const k of keepers) {
        const v = collideSegment(b, k.x - keeperHalf, k.y, k.x + keeperHalf, k.y, 0.55, 7);
        if (v > 0) {
          b.vx += k.vx * 0.5;
          if (v > 150 && !b.saved) {
            b.saved = true;
            k.flash = 1;
            events.pop('KURTARDI!', k.x, k.y - 40, '#7cf');
            events.hit(v, k.x, k.y);
          }
        }
      }
      // zemin
      if (b.y + b.r >= floor - 2) {
        b.y = floor - b.r;
        b.done = true;
        const slot = Math.max(0, Math.min(C.nSlots - 1, Math.floor((b.x - left) / slotW)));
        if (goalSet.has(slot)) {
          slotFlash[slot] = 1;
          events.goal(b.team, b.x, b.y);
        } else {
          events.hit(200, b.x, b.y);
        }
      }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.done) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].done) continue;
        collideBalls(a, balls[j], 0.5);
      }
      capSpeed(a, 1700);
    }
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].done && balls[i].doneT > 0.5) balls.splice(i, 1);
  }

  function draw(ctx, assets) {
    ctx.save();
    // zemin paneli
    roundRect(ctx, arena.x - 12, arena.y - 12, arena.w + 24, arena.h + 24, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // fırlatıcı
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, launcherX - 46, arena.y + 4, 92, 22, 11);
    ctx.fill();

    // cepler
    for (let i = 0; i < C.nSlots; i++) {
      const x = left + i * slotW;
      const isGoal = goalSet.has(i);
      if (isGoal) {
        ctx.fillStyle = `rgba(255,200,0,${0.22 + slotFlash[i] * 0.6})`;
        ctx.fillRect(x + 4, slotTop, slotW - 8, divH);
        // file deseni
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < slotW; k += 14) {
          ctx.beginPath();
          ctx.moveTo(x + k, slotTop + 60);
          ctx.lineTo(x + k, floor);
          ctx.stroke();
        }
        for (let k = slotTop + 60; k < floor; k += 14) {
          ctx.beginPath();
          ctx.moveTo(x + 4, k);
          ctx.lineTo(x + slotW - 4, k);
          ctx.stroke();
        }
      }
      ctx.fillStyle = isGoal ? '#ffd700' : 'rgba(255,255,255,0.35)';
      ctx.font = isGoal ? '900 30px Anton, Impact, sans-serif' : '700 30px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isGoal ? 'GOL' : '✕', x + slotW / 2, floor - 30);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const x of dividers) {
      roundRect(ctx, x - 4, slotTop, 8, divH, 4);
      ctx.fill();
    }

    for (const p of pegs) {
      ctx.fillStyle = p.flash > 0 ? `rgba(255,255,160,${0.5 + p.flash * 0.5})` : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, C.pegR + p.flash * 4, 0, TAU);
      ctx.fill();
    }

    for (const k of keepers) {
      ctx.fillStyle = k.flash > 0 ? '#aee9ff' : '#3fb8ff';
      ctx.shadowColor = '#3fb8ff';
      ctx.shadowBlur = 16;
      roundRect(ctx, k.x - keeperHalf, k.y - 8, keeperHalf * 2, 16, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      // eldivenler
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(k.x - keeperHalf, k.y, 11, 0, TAU);
      ctx.arc(k.x + keeperHalf, k.y, 11, 0, TAU);
      ctx.fill();
    }

    for (const b of balls) {
      const t = assets.teams[b.team];
      ctx.save();
      ctx.shadowColor = rgba(t.glow, 0.7);
      ctx.shadowBlur = 14;
      drawSprite(ctx, t.sprite, b.x, b.y, b.r, b.rot, b.done ? 1 - b.doneT / 0.5 : 1);
      ctx.restore();
    }
    ctx.restore();
  }

  return { update, draw };
}
