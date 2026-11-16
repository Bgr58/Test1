// MOD 4 — Engelli Parkur: Ekran ikiye bölünür, her takımın kendi şeridi var (aynı parkur).
// Top engellerden geçip aşağı iner; kaleci barını geçip kaleye girerse GOL, değilse AUT.
import { integrate, collideStatic, collideSegment, capSpeed, speed } from '../physics.js';
import { TAU, drawSprite, drawTrail, pushTrail, roundRect, rgba } from '../draw.js';

export const meta = { id: 'race', name: 'Engelli Parkur', hint: 'Engelleri aş, kaleciyi geç!' };

export const config = {
  gravity: 1250,
  ballR: 23,
  mouth: 0.46, // şerit genişliğine oranla kale ağzı
  keeperW: 0.5, // kale ağzına oranla kaleci
  keeperSpeed: [1.6, 2.4],
  e: 0.55,
  respawn: 0.45,
};

function buildCourse(rng, y0, y1) {
  const bands = 4;
  const bh = (y1 - y0) / bands;
  const types = ['pegs', 'spinner', 'bumpers', 'funnel', 'pegs', 'spinner'];
  const items = [];
  const order = [];
  let last = '';
  for (let i = 0; i < bands; i++) {
    let t;
    do t = rng.pick(types); while (t === last);
    last = t;
    order.push(t);
  }
  order.forEach((t, i) => {
    const by = y0 + i * bh;
    if (t === 'pegs') {
      for (let r = 0; r < 2; r++) {
        const n = r ? 4 : 5;
        for (let c = 0; c < n; c++) items.push({ k: 'peg', u: (c + (r ? 1 : 0.5)) / 5, y: by + bh * (0.3 + r * 0.4), r: 10 });
      }
    } else if (t === 'spinner') {
      const two = rng.chance(0.5);
      const om = rng.sign() * rng.range(1.8, 2.8);
      const ph = rng.range(0, TAU);
      if (two) {
        items.push({ k: 'spin', u: 0.3, y: by + bh / 2, len: 0.2, omega: om, phase: ph });
        items.push({ k: 'spin', u: 0.7, y: by + bh / 2, len: 0.2, omega: -om, phase: ph + 1 });
      } else items.push({ k: 'spin', u: 0.5, y: by + bh / 2, len: 0.32, omega: om, phase: ph });
    } else if (t === 'bumpers') {
      const n = rng.int(2, 3);
      for (let c = 0; c < n; c++) items.push({ k: 'bump', u: (c + 0.5) / n + rng.range(-0.06, 0.06), y: by + bh * rng.range(0.35, 0.65), r: 28 });
    } else if (t === 'funnel') {
      const gapC = rng.range(0.35, 0.65);
      const gw = 0.26;
      items.push({ k: 'seg', u1: 0, y1: by + bh * 0.2, u2: gapC - gw / 2, y2: by + bh * 0.7 });
      items.push({ k: 'seg', u1: 1, y1: by + bh * 0.2, u2: gapC + gw / 2, y2: by + bh * 0.7 });
    }
  });
  return items;
}

export function create({ rng, edge, arena, events }) {
  const C = config;
  const gap = 24;
  const laneW = (arena.w - gap) / 2;
  const goalY = arena.y + arena.h - 90;
  const bottom = arena.y + arena.h - 6;
  const course = buildCourse(rng, arena.y + 120, goalY - 130);
  let time = 0;

  const lanes = [0, 1].map((team) => {
    const x0 = arena.x + team * (laneW + gap);
    const mw = laneW * C.mouth * (1 + edge[team] * 0.25);
    const mc = x0 + laneW / 2;
    return {
      team, x0, x1: x0 + laneW, ux: (u) => x0 + u * laneW,
      mouthL: mc - mw / 2, mouthR: mc + mw / 2, mw,
      keeper: { x: mc, vx: 0, phase: rng.range(0, TAU), speed: rng.range(...C.keeperSpeed), flash: 0 },
      ball: null, wait: 0.2 + team * 0.25, shots: 0, stuck: 0, flash: 0,
    };
  });

  function spawnBall(l) {
    l.ball = { team: l.team, r: C.ballR, x: l.ux(rng.range(0.15, 0.85)), y: arena.y + 50, vx: rng.range(-120, 120), vy: 0, rot: 0, spin: rng.range(-5, 5), trail: [], saved: false };
  }

  function spinEnds(it, l) {
    const a = it.phase + time * it.omega;
    const cx = l.ux(it.u);
    const half = (it.len * laneW) / 2;
    return [cx - Math.cos(a) * half, it.y - Math.sin(a) * half, cx + Math.cos(a) * half, it.y + Math.sin(a) * half, cx];
  }

  function update(dt) {
    time += dt;
    for (const l of lanes) {
      const k = l.keeper;
      const range = l.mw / 2 - (l.mw * C.keeperW) / 2;
      const nx = (l.mouthL + l.mouthR) / 2 + Math.sin(time * k.speed + k.phase) * range;
      k.vx = (nx - k.x) / dt;
      k.x = nx;
      k.flash = Math.max(0, k.flash - dt * 2);
      l.flash = Math.max(0, l.flash - dt * 1.2);

      if (!l.ball) {
        l.wait -= dt;
        if (l.wait <= 0) spawnBall(l);
        continue;
      }
      const b = l.ball;
      integrate(b, dt, 0, C.gravity, 0.1);
      b.rot += b.spin * dt;
      pushTrail(b, 10, 3);
      if (b.x - b.r < l.x0) { b.x = l.x0 + b.r; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x + b.r > l.x1) { b.x = l.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.7; }

      for (const it of course) {
        let v = 0;
        if (it.k === 'peg') v = collideStatic(b, l.ux(it.u), it.y, it.r, C.e);
        else if (it.k === 'bump') {
          v = collideStatic(b, l.ux(it.u), it.y, it.r, 1.15);
          if (v > 0) it['hit' + l.team] = 1;
        } else if (it.k === 'seg') v = collideSegment(b, l.ux(it.u1), it.y1, l.ux(it.u2), it.y2, 0.4, 5);
        else if (it.k === 'spin') {
          const [x1, y1, x2, y2, cx] = spinEnds(it, l);
          v = collideSegment(b, x1, y1, x2, y2, 0.6, 7, { x: cx, y: it.y, omega: it.omega });
        }
        if (v > 90) {
          b.vx += rng.range(-50, 50);
          events.hit(v, b.x, b.y);
        }
      }
      // direkler + kaleci
      for (const px of [l.mouthL, l.mouthR]) {
        const v = collideStatic(b, px, goalY, 9, 0.8);
        if (v > 250) {
          events.pop('post', px, goalY - 50, '#ffd700');
          events.hit(v * 1.4, px, goalY);
        }
      }
      const kh = (l.mw * C.keeperW) / 2;
      const kv = collideSegment(b, k.x - kh, goalY - 34, k.x + kh, goalY - 34, 0.7, 8);
      if (kv > 0) {
        b.vx += k.vx * 0.4 + rng.range(-120, 120);
        if (kv > 150 && !b.saved) {
          b.saved = true;
          k.flash = 1;
          events.pop('save', k.x, goalY - 90, '#7cf');
          events.hit(kv, k.x, goalY);
        }
      }
      // file yan duvarları (kale içinde)
      if (b.y > goalY) {
        const inside = b.x > l.mouthL && b.x < l.mouthR;
        if (inside) {
          if (b.x - b.r < l.mouthL) { b.x = l.mouthL + b.r; b.vx *= -0.4; }
          if (b.x + b.r > l.mouthR) { b.x = l.mouthR - b.r; b.vx *= -0.4; }
        }
      }
      capSpeed(b, 1500);
      if (speed(b) < 25) l.stuck += dt;
      else l.stuck = 0;
      if (l.stuck > 1.2) {
        b.vy -= 400;
        b.vx += rng.range(-250, 250);
        l.stuck = 0;
      }

      if (b.y > bottom - b.r) {
        l.shots++;
        const inside = b.x > l.mouthL && b.x < l.mouthR;
        if (inside) {
          l.flash = 1;
          events.goal(l.team, b.x, b.y);
        } else {
          events.pop('out', b.x, b.y - 50, 'rgba(255,255,255,0.8)');
        }
        l.ball = null;
        l.wait = C.respawn;
      }
    }
    for (const it of course) {
      if (it.k === 'bump') {
        it.hit0 = Math.max(0, (it.hit0 || 0) - dt * 3);
        it.hit1 = Math.max(0, (it.hit1 || 0) - dt * 3);
      }
    }
  }

  function draw(ctx, assets) {
    ctx.save();
    for (const l of lanes) {
      const t = assets.teams[l.team];
      roundRect(ctx, l.x0, arena.y, laneW, arena.h, 22);
      const g = ctx.createLinearGradient(0, arena.y, 0, arena.y + arena.h);
      g.addColorStop(0, rgba(t.glow, 0.22));
      g.addColorStop(1, rgba(t.glow, 0.05));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(t.glow, 0.7);
      ctx.lineWidth = 4;
      ctx.stroke();

      drawSprite(ctx, t.sprite, l.x0 + 44, arena.y + 40, 26, 0, 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 26px Inter, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(assets.texts.t('shots', { n: l.shots }), l.x1 - 18, arena.y + 40);

      for (const it of course) {
        if (it.k === 'peg') {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath(); ctx.arc(l.ux(it.u), it.y, it.r, 0, TAU); ctx.fill();
        } else if (it.k === 'bump') {
          const h = it['hit' + l.team] || 0;
          ctx.fillStyle = h > 0 ? '#ffe680' : '#ff5fa2';
          ctx.shadowColor = '#ff5fa2';
          ctx.shadowBlur = 10 + h * 20;
          ctx.beginPath(); ctx.arc(l.ux(it.u), it.y, it.r + h * 5, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
        } else if (it.k === 'seg') {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(l.ux(it.u1), it.y1); ctx.lineTo(l.ux(it.u2), it.y2); ctx.stroke();
        } else if (it.k === 'spin') {
          const [x1, y1, x2, y2, cx] = spinEnds(it, l);
          ctx.strokeStyle = '#ffb02e';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(cx, it.y, 7, 0, TAU); ctx.fill();
        }
      }

      // kale
      ctx.fillStyle = `rgba(255,215,0,${0.15 + l.flash * 0.55})`;
      ctx.fillRect(l.mouthL, goalY, l.mw, bottom - goalY);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      for (let x = l.mouthL; x <= l.mouthR; x += 13) { ctx.beginPath(); ctx.moveTo(x, goalY); ctx.lineTo(x, bottom); ctx.stroke(); }
      for (let y = goalY; y <= bottom; y += 13) { ctx.beginPath(); ctx.moveTo(l.mouthL, y); ctx.lineTo(l.mouthR, y); ctx.stroke(); }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(l.mouthL, bottom); ctx.lineTo(l.mouthL, goalY); ctx.lineTo(l.mouthR, goalY); ctx.lineTo(l.mouthR, bottom);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const px of [l.mouthL, l.mouthR]) { ctx.beginPath(); ctx.arc(px, goalY, 9, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '700 22px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      const outTxt = assets.texts.t('out');
      ctx.fillText(outTxt, (l.x0 + l.mouthL) / 2, bottom - 30, l.mouthL - l.x0 - 8);
      ctx.fillText(outTxt, (l.mouthR + l.x1) / 2, bottom - 30, l.x1 - l.mouthR - 8);

      const k = l.keeper;
      const kh = (l.mw * C.keeperW) / 2;
      ctx.fillStyle = k.flash > 0 ? '#aee9ff' : '#3fb8ff';
      roundRect(ctx, k.x - kh, goalY - 42, kh * 2, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(k.x - kh, goalY - 34, 10, 0, TAU); ctx.arc(k.x + kh, goalY - 34, 10, 0, TAU); ctx.fill();

      if (l.ball) {
        const b = l.ball;
        drawTrail(ctx, b.trail, b.r, t.glow);
        ctx.save();
        ctx.shadowColor = rgba(t.glow, 0.8);
        ctx.shadowBlur = 14;
        drawSprite(ctx, t.sprite, b.x, b.y, b.r, b.rot);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  return { update, draw };
}
