// MOD 3 — Mini Futbol: Yukarıdan görünen saha, her takımda 1 kaleci + 3 oyuncu (logo diskleri).
// Ev sahibi (A) yukarıdaki kaleye, deplasman (B) aşağıdaki kaleye hücum eder.
import { integrate, collideBalls, collideStatic, collideSegment, capSpeed, speed } from '../physics.js';
import { TAU, drawSprite, drawSoccerBall, rgba } from '../draw.js';

export const meta = { id: 'football', name: 'Mini Futbol', hint: 'Logolar sahada, top kaleye!' };

export const config = {
  playerR: 40,
  gkR: 42,
  ballR: 22,
  speed: 360,
  gkSpeed: 130,
  kick: 1400,
  spread: 0.2,
  damp: 0.35,
  goalW: 340,
  depth: 56,
  freeze: 1.6,
};

export function create({ rng, edge, arena, events }) {
  const C = config;
  const f = { x: arena.x + 8, y: arena.y + 70, w: arena.w - 16, h: arena.h - 140 };
  const fcx = f.x + f.w / 2;
  const fcy = f.y + f.h / 2;
  const gx0 = fcx - C.goalW / 2;
  const gx1 = fcx + C.goalW / 2;
  const top = f.y;
  const bot = f.y + f.h;

  const walls = [
    [f.x, top, gx0, top], [gx1, top, f.x + f.w, top],
    [f.x, bot, gx0, bot], [gx1, bot, f.x + f.w, bot],
    [f.x, top, f.x, bot], [f.x + f.w, top, f.x + f.w, bot],
    [gx0, top, gx0, top - C.depth], [gx0, top - C.depth, gx1, top - C.depth], [gx1, top - C.depth, gx1, top],
    [gx0, bot, gx0, bot + C.depth], [gx0, bot + C.depth, gx1, bot + C.depth], [gx1, bot + C.depth, gx1, bot],
  ];
  const posts = [[gx0, top], [gx1, top], [gx0, bot], [gx1, bot]];

  // takım 0: aşağıyı savunur, yukarı hücum (dir=-1). takım 1 tersi.
  const dirOf = (team) => (team === 0 ? -1 : 1);
  const goalOf = (team) => ({ x: fcx, y: team === 0 ? top - 10 : bot + 10 }); // hücum ettiği kale
  const formation = [
    [0.5, 0.8],
    [0.26, 0.58],
    [0.74, 0.58],
  ];
  const homePos = (team, u, v) => ({ x: f.x + u * f.w, y: f.y + (team === 0 ? v : 1 - v) * f.h });

  const players = [];
  for (const team of [0, 1]) {
    const mult = 1 + edge[team] * 0.14;
    players.push({ team, gk: true, r: C.gkR, invMass: 0.12, x: fcx, y: team === 0 ? bot - 46 : top + 46, vx: 0, vy: 0, max: C.gkSpeed * (1 + edge[team] * 0.18), cool: 0, home: null, rot: 0 });
    for (const [u, v] of formation) {
      const h = homePos(team, u, v);
      players.push({ team, gk: false, r: C.playerR, invMass: 0.16, x: h.x, y: h.y, vx: 0, vy: 0, max: C.speed * mult, cool: 0, home: [u, v], wander: rng.range(0, TAU), rot: 0 });
    }
  }
  const ball = { x: fcx, y: fcy, vx: rng.range(-60, 60), vy: rng.sign() * 280, r: C.ballR, invMass: 1, rot: 0 };
  let freeze = 0;
  let stuckT = 0;
  let lastPostPop = 0;
  let time = 0;
  let kickoffTeam = rng.int(0, 1);

  function kickoff() {
    ball.x = fcx;
    ball.y = fcy;
    ball.vx = rng.range(-120, 120);
    ball.vy = dirOf(kickoffTeam) * rng.range(200, 320);
  }
  kickoff();

  function steer(p, tx, ty, maxV, dt, arrive = 90) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const s = maxV * Math.min(1, d / arrive);
    const dvx = (dx / d) * s;
    const dvy = (dy / d) * s;
    const k = Math.min(1, dt * 5);
    p.vx += (dvx - p.vx) * k;
    p.vy += (dvy - p.vy) * k;
  }

  function update(dt) {
    time += dt;
    // AI
    const chasers = [0, 1].map((team) => {
      let best = null;
      let bd = Infinity;
      for (const p of players) {
        if (p.team !== team || p.gk) continue;
        const d = Math.hypot(p.x - ball.x, p.y - ball.y) * (p === p.lastChaser ? 0.85 : 1);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    });
    for (const p of players) {
      p.cool = Math.max(0, p.cool - dt);
      if (freeze > 0) {
        if (p.gk) steer(p, fcx, p.team === 0 ? bot - 46 : top + 46, p.max, dt);
        else {
          const h = homePos(p.team, p.home[0], p.home[1]);
          steer(p, h.x, h.y, p.max * 0.8, dt);
        }
      } else if (p.gk) {
        const gy = p.team === 0 ? bot - 46 : top + 46;
        const near = Math.abs(ball.y - gy) < 260;
        const tx = Math.max(gx0 + 10, Math.min(gx1 - 10, ball.x + rng.normal() * 8));
        const ty = near ? gy + (ball.y - gy) * 0.35 : gy;
        steer(p, tx, ty, p.max, dt, 40);
      } else if (chasers[p.team] === p) {
        // topa koş; vuruş yönünü çarpışma anında kale belirler
        steer(p, ball.x, ball.y, p.max, dt, 10);
        p.lastChaser = p;
      } else {
        const h = homePos(p.team, p.home[0], p.home[1]);
        p.wander += rng.normal() * dt * 3;
        const tx = h.x + (ball.x - fcx) * 0.45 + Math.cos(p.wander) * 40;
        const ty = h.y + (ball.y - fcy) * 0.4 + Math.sin(p.wander) * 40;
        steer(p, tx, ty, p.max * 0.75, dt);
      }
      integrate(p, dt);
      p.rot += (p.vx * dt) / p.r * 0.3;
      // saha içinde kal
      p.x = Math.max(f.x + p.r, Math.min(f.x + f.w - p.r, p.x));
      p.y = Math.max(top + p.r * 0.6, Math.min(bot - p.r * 0.6, p.y));
    }

    integrate(ball, dt, 0, 0, C.damp);
    ball.rot += (ball.vx * dt) / ball.r;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) collideBalls(players[i], players[j], 0.3);
    }
    if (freeze <= 0) {
      for (const p of players) {
        const v = collideBalls(p, ball, 0.8);
        if (v > 0 && p.cool <= 0) {
          const g = p.gk ? { x: fcx + rng.range(-300, 300), y: fcy } : goalOf(p.team);
          const dx = g.x - ball.x;
          const dy = g.y - ball.y;
          const d = Math.hypot(dx, dy) || 1;
          const far = d > f.h * 0.55;
          const a = Math.atan2(dy, dx) + rng.normal() * (p.gk ? 0.7 : C.spread);
          const pow = C.kick * (1 + edge[p.team] * 0.12) * rng.range(0.55, 1.05) * (far ? 0.7 : 1);
          ball.vx = Math.cos(a) * pow * 0.8 + ball.vx * 0.2;
          ball.vy = Math.sin(a) * pow * 0.8 + ball.vy * 0.2;
          p.cool = 0.35;
          if (p.gk && Math.hypot(ball.vx, ball.vy) > 300 && v > 250) events.pop('KURTARDI!', p.x, p.y - 60, '#7cf');
          events.hit(pow * 0.5, ball.x, ball.y);
        } else if (v > 0) {
          events.hit(v, ball.x, ball.y);
        }
      }
    }
    for (const w of walls) {
      const v = collideSegment(ball, w[0], w[1], w[2], w[3], 0.8, 3);
      if (v > 120) events.hit(v * 0.7, ball.x, ball.y);
    }
    for (const [px, py] of posts) {
      const v = collideStatic(ball, px, py, 10, 0.9);
      if (v > 350 && time - lastPostPop > 1) {
        lastPostPop = time;
        events.pop('DİREK!', px, py + (py === top ? 60 : -60), '#ffd700');
        events.hit(v * 1.5, px, py);
      }
    }
    capSpeed(ball, 1650);
    // güvenlik: top asla saha/kale dışına taşmasın
    const r = ball.r;
    const inMouth = ball.x > gx0 + 2 && ball.x < gx1 - 2;
    if (ball.y < top || ball.y > bot) {
      if (ball.x < gx0 + r) { ball.x = gx0 + r; ball.vx = Math.abs(ball.vx) * 0.5; }
      if (ball.x > gx1 - r) { ball.x = gx1 - r; ball.vx = -Math.abs(ball.vx) * 0.5; }
      if (ball.y < top - C.depth + r) { ball.y = top - C.depth + r; ball.vy = Math.abs(ball.vy) * 0.4; }
      if (ball.y > bot + C.depth - r) { ball.y = bot + C.depth - r; ball.vy = -Math.abs(ball.vy) * 0.4; }
    } else {
      if (ball.x < f.x + r) { ball.x = f.x + r; ball.vx = Math.abs(ball.vx) * 0.8; }
      if (ball.x > f.x + f.w - r) { ball.x = f.x + f.w - r; ball.vx = -Math.abs(ball.vx) * 0.8; }
      if (!inMouth && ball.y < top + r) { ball.y = top + r; ball.vy = Math.abs(ball.vy) * 0.8; }
      if (!inMouth && ball.y > bot - r) { ball.y = bot - r; ball.vy = -Math.abs(ball.vy) * 0.8; }
    }

    if (freeze > 0) {
      freeze -= dt;
      if (freeze <= 0) kickoff();
      return;
    }
    // gol kontrolü
    if (ball.x > gx0 && ball.x < gx1) {
      if (ball.y < top - ball.r * 0.7) {
        freeze = C.freeze;
        kickoffTeam = 1;
        events.goal(0, ball.x, ball.y);
      } else if (ball.y > bot + ball.r * 0.7) {
        freeze = C.freeze;
        kickoffTeam = 0;
        events.goal(1, ball.x, ball.y);
      }
    }
    // top durursa / köşeye sıkışırsa
    const nearCorner = (ball.x < f.x + 70 || ball.x > f.x + f.w - 70) && (ball.y < top + 70 || ball.y > bot - 70);
    if (speed(ball) < 40 || nearCorner) stuckT += dt;
    else stuckT = Math.max(0, stuckT - dt);
    if (stuckT > 1.6) {
      // taç / serbest atış: topu biraz içeri al ve ortaya doğru at
      stuckT = 0;
      const a = Math.atan2(fcy - ball.y, fcx - ball.x) + rng.normal() * 0.4;
      ball.x += Math.cos(a) * 90;
      ball.y += Math.sin(a) * 90;
      ball.vx = Math.cos(a) * 650;
      ball.vy = Math.sin(a) * 650;
    }
  }

  function drawGoalNet(ctx, y0, y1) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(gx0, Math.min(y0, y1), C.goalW, Math.abs(y1 - y0));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let x = gx0; x <= gx1; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    const s = Math.sign(y1 - y0);
    for (let y = y0; s * (y1 - y) >= 0; y += 14 * s) {
      ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); ctx.stroke();
    }
  }

  function draw(ctx, assets) {
    ctx.save();
    // çim
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#1f8a3e' : '#23974a';
      ctx.fillRect(f.x, f.y + (i * f.h) / stripes, f.w, f.h / stripes + 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.beginPath(); ctx.moveTo(f.x, fcy); ctx.lineTo(f.x + f.w, fcy); ctx.stroke();
    ctx.beginPath(); ctx.arc(fcx, fcy, 110, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(fcx, fcy, 8, 0, TAU); ctx.fill();
    const boxW = 520;
    const boxH = 150;
    ctx.strokeRect(fcx - boxW / 2, top, boxW, boxH);
    ctx.strokeRect(fcx - boxW / 2, bot - boxH, boxW, boxH);
    ctx.beginPath(); ctx.arc(fcx, top + boxH, 70, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(fcx, bot - boxH, 70, Math.PI, TAU); ctx.stroke();

    // kaleler + hangi takımın kalesi olduğu
    drawGoalNet(ctx, top, top - C.depth);
    drawGoalNet(ctx, bot, bot + C.depth);
    ctx.fillStyle = '#fff';
    for (const [px, py] of posts) {
      ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.9;
    drawSprite(ctx, assets.teams[1].sprite, gx1 + 70, top - 30, 26);
    drawSprite(ctx, assets.teams[0].sprite, gx1 + 70, bot + 30, 26);
    ctx.globalAlpha = 1;

    for (const p of players) {
      const t = assets.teams[p.team];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 10, p.r, p.r * 0.8, 0, 0, TAU); ctx.fill();
      if (p.gk) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, TAU); ctx.stroke();
      }
      drawSprite(ctx, t.sprite, p.x, p.y, p.r, 0);
    }
    drawSoccerBall(ctx, ball.x, ball.y, ball.r, ball.rot);
    ctx.restore();
  }

  return { update, draw, state: { ball, players } };
}
