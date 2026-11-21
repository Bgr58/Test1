// Video karesi çizimi: arka plan, skor tabelası, oyun alanı, efektler, giriş/çıkış ekranları.
import { W, H, ARENA, INTRO, OUTRO } from './match.js';
import { drawSprite, roundRect, fitFont, rgba, luminance } from './draw.js';

// Türkçe karakter içeren isimlerde tr-TR, diğerlerinde standart büyük harf (MADRID, MADRİD değil)
const upper = (s) => (/[çğıöşüİ]/i.test(s) ? s.toLocaleUpperCase('tr-TR') : s.toUpperCase());
const textOn = (hex) => (luminance(hex) > 0.5 ? '#111111' : '#ffffff');

const DISPLAY = 'Anton, Impact, "Arial Black", sans-serif';
const BODY = 'Inter, "Segoe UI", Arial, sans-serif';

const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const easeBack = (t) => {
  t = Math.min(1, Math.max(0, t));
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

function drawBackground(ctx, assets) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0f24');
  g.addColorStop(1, '#05070f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const [a, b] = assets.teams;
  for (const [t, x] of [[a, 0], [b, W]]) {
    const rg = ctx.createRadialGradient(x, 300, 20, x, 300, 900);
    rg.addColorStop(0, rgba(t.glow, 0.45));
    rg.addColorStop(1, rgba(t.glow, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  // hafif çizgi deseni
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 2;
  for (let i = -H; i < W; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
}

function drawTitle(ctx, opts) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = opts.texts.t('badge');
  fitFont(ctx, label, 820, 46, '400', DISPLAY);
  const w = ctx.measureText(label).width + 70;
  roundRect(ctx, W / 2 - w / 2, 62, w, 70, 35);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillText(label, W / 2, 99);
  if (opts.subtitle) {
    fitFont(ctx, opts.subtitle, 900, 34, '600', BODY);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(opts.subtitle, W / 2, 170);
  }
}

function drawLogo(ctx, team, x, y, r, pulse = 0) {
  const s = 1 + pulse * 0.25;
  ctx.save();
  ctx.shadowColor = rgba(team.glow, 0.9);
  ctx.shadowBlur = 40 + pulse * 40;
  drawSprite(ctx, team.sprite, x, y, r * s);
  ctx.restore();
}

function drawScoreboard(ctx, match, assets, opts) {
  const [A, B] = assets.teams;
  const pulse = match.fx.scorePulse;
  const cy = 330;
  drawLogo(ctx, A, 200, cy, 100, pulse[0]);
  drawLogo(ctx, B, W - 200, cy, 100, pulse[1]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  for (const [t, x] of [[A, 200], [B, W - 200]]) {
    const name = upper(t.name);
    fitFont(ctx, name, 330, 40, '800', BODY);
    ctx.fillText(name, x, cy + 140);
  }

  // skor
  const sc = match.score;
  for (const [i, x] of [[0, 430], [1, W - 430]]) {
    const s = 1 + pulse[i] * 0.5;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(s, s);
    ctx.font = `400 150px ${DISPLAY}`;
    ctx.fillStyle = pulse[i] > 0 ? '#ffd700' : '#ffffff';
    ctx.fillText(String(sc[i]), 0, 6);
    ctx.restore();
  }
  ctx.font = `400 90px ${DISPLAY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(':', W / 2, cy);

  // dakika
  const min = match.minute;
  const label = match.phase === 'intro' ? "0'" : match.phase === 'play' ? `${min}'` : opts.texts.t('fullTime');
  roundRect(ctx, W / 2 - 75, cy + 105, 150, 58, 29);
  ctx.fillStyle = match.phase === 'play' ? '#e63946' : 'rgba(255,255,255,0.15)';
  ctx.fill();
  fitFont(ctx, label, 130, 36, '800', BODY);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, W / 2, cy + 135);

  // ilerleme çubuğu
  const bw = 820;
  const bx = W / 2 - bw / 2;
  const by = 520;
  roundRect(ctx, bx, by, bw, 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  roundRect(ctx, bx, by, Math.max(10, bw * match.playProgress), 10, 5);
  ctx.fillStyle = '#ffd700';
  ctx.fill();

}

function drawFooter(ctx, match, assets, opts) {
  const T = opts.texts;
  const id = match.mode.meta.id;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const line = `${T.upper(T.t('mode.' + id))} • ${T.t('mode.' + id + '.hint')}`;
  fitFont(ctx, line, 960, 40, '400', DISPLAY);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(line, W / 2, ARENA.y + ARENA.h + 70);
  const cta = T.t('ctaPlay');
  fitFont(ctx, cta, 960, 34, '700', BODY);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(cta, W / 2, ARENA.y + ARENA.h + 130);
}

function drawBanner(ctx, fx, T) {
  const b = fx.banner;
  if (!b) return;
  const k = b.age / b.life;
  const inT = easeBack(b.age / 0.35);
  const out = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  const y = ARENA.y + ARENA.h / 2;
  ctx.save();
  ctx.globalAlpha = out;
  ctx.translate(W / 2, y);
  ctx.rotate(-0.06);
  ctx.scale(inT, inT);
  ctx.fillStyle = rgba(b.color, 0.92);
  ctx.fillRect(-W, -120, W * 2, 240);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const goalTxt = T.t('goal');
  fitFont(ctx, goalTxt, 980, 170, '400', DISPLAY);
  const ink = textOn(b.color);
  ctx.lineWidth = 14;
  ctx.strokeStyle = ink === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
  ctx.strokeText(goalTxt, 0, -25);
  ctx.fillStyle = ink;
  ctx.fillText(goalTxt, 0, -25);
  const name = upper(b.name);
  fitFont(ctx, name, 900, 52, '900', BODY);
  ctx.fillStyle = ink;
  ctx.fillText(name, 0, 80);
  ctx.restore();
}

function drawIntro(ctx, match, assets, opts) {
  // İlk kare çok önemli (Shorts'ta izleyici ilk saniyede karar verir): logolar, VS ve soru
  // 0. kareden itibaren görünür; sadece hafif "pop" animasyonu var.
  const t = match.phaseT;
  const [A, B] = assets.teams;
  const T = opts.texts;
  ctx.fillStyle = `rgba(5,7,15,${0.7 - ease((t - INTRO + 0.5) / 0.5) * 0.7})`;
  ctx.fillRect(0, 0, W, H);
  const fade = 1 - ease((t - INTRO + 0.45) / 0.45);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // büyük soru (kapakla aynı): "WHO WINS?"
  const q = T.t('thumbTitle');
  const qs = 0.92 + 0.08 * easeBack(t / 0.45) + Math.sin(t * 5) * 0.012;
  ctx.save();
  ctx.translate(W / 2, 640);
  ctx.scale(qs, qs);
  fitFont(ctx, q, 980, 150, '400', DISPLAY);
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(q, 0, 0);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(q, 0, 0);
  ctx.restore();
  const im = T.t('introMode', { mode: T.t('mode.' + match.mode.meta.id) });
  fitFont(ctx, im, 960, 36, '700', BODY);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(im, W / 2, 745);

  // logolar: yerinde başlar, küçük bir kayma + büyüme
  const ay = 960;
  const byy = 1300;
  const pa = easeBack(t / 0.5);
  const pb = easeBack((t - 0.1) / 0.5);
  const ax = 280 - (1 - pa) * 70;
  const bx = W - 280 + (1 - pb) * 70;
  drawLogo(ctx, A, ax, ay, 150 * (0.85 + 0.15 * pa));
  drawLogo(ctx, B, bx, byy, 150 * (0.85 + 0.15 * pb));
  const vs = 0.85 + 0.15 * easeBack((t - 0.15) / 0.4);
  ctx.save();
  ctx.translate(W / 2, (ay + byy) / 2);
  ctx.scale(vs, vs);
  ctx.font = `400 140px ${DISPLAY}`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('VS', 0, 0);
  ctx.restore();
  ctx.fillStyle = '#fff';
  fitFont(ctx, upper(A.name), 560, 62, '900', BODY);
  ctx.textAlign = 'left';
  ctx.fillText(upper(A.name), ax + 180, ay);
  fitFont(ctx, upper(B.name), 560, 62, '900', BODY);
  ctx.textAlign = 'right';
  ctx.fillText(upper(B.name), bx - 180, byy);
  ctx.textAlign = 'center';

  // geri sayım
  const ticks = [0.9, 1.7, 2.5];
  for (let i = 0; i < 3; i++) {
    const dt = t - ticks[i];
    if (dt >= 0 && dt < 0.8) {
      const s = 1 + (1 - ease(dt / 0.8)) * 0.6;
      ctx.globalAlpha = fade * (1 - dt / 0.8);
      ctx.font = `400 ${Math.round(220 * s)}px ${DISPLAY}`;
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(3 - i), W / 2, 1620);
    }
  }
  ctx.restore();
}

function drawOutro(ctx, match, assets, opts) {
  const T = opts.texts;
  const t = match.phase === 'final' ? 0 : match.phase === 'done' ? OUTRO : match.phaseT;
  if (match.phase === 'final') {
    const k = ease(match.phaseT / 0.6);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const me = T.t('matchEnd');
    fitFont(ctx, me, 980, 130, '400', DISPLAY);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(me, W / 2, ARENA.y + ARENA.h / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(me, W / 2, ARENA.y + ARENA.h / 2);
    ctx.restore();
    return;
  }
  const [A, B] = assets.teams;
  const k = ease(t / 0.5);
  ctx.fillStyle = `rgba(5,7,15,${0.88 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const op = T.t('ourPrediction');
  fitFont(ctx, op, 980, 80, '400', DISPLAY);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(op, W / 2, 640);

  const y = 900;
  const s = easeBack((t - 0.2) / 0.5);
  drawLogo(ctx, A, 200, y, 130 * s);
  drawLogo(ctx, B, W - 200, y, 130 * s);
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(s, s);
  ctx.font = `400 230px ${DISPLAY}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${match.score[0]}-${match.score[1]}`, 0, 10);
  ctx.restore();

  const w = match.winner;
  const verdict = w === -1 ? T.t('draw') : T.t('wins', { team: upper(assets.teams[w].name) });
  const vy = 1110;
  fitFont(ctx, verdict, 900, 64, '900', BODY);
  const vw = ctx.measureText(verdict).width + 80;
  roundRect(ctx, W / 2 - vw / 2, vy - 50, vw, 100, 50);
  ctx.fillStyle = w === -1 ? 'rgba(255,255,255,0.18)' : rgba(assets.teams[w].glow, 0.9);
  ctx.fill();
  ctx.fillStyle = w === -1 ? '#fff' : textOn(assets.teams[w].glow);
  ctx.fillText(verdict, W / 2, vy + 2);

  // gol dakikaları
  ctx.font = `700 38px ${BODY}`;
  const cols = [[], []];
  for (const g of match.goals) cols[g.team].push(`⚽ ${g.minute}'`);
  for (const [i, x] of [[0, 300], [1, W - 300]]) {
    cols[i].slice(0, 6).forEach((txt, j) => {
      ctx.globalAlpha = k * ease((t - 0.6 - j * 0.12) / 0.3);
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, x, 1250 + j * 56);
    });
    if (cols[i].length > 6) ctx.fillText(`+${cols[i].length - 6}`, x, 1250 + 6 * 56);
  }
  ctx.globalAlpha = k * ease((t - 1.2) / 0.4);
  fitFont(ctx, T.t('ctaEnd'), 960, 44, '800', BODY);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(T.t('ctaEnd'), W / 2, 1640);
  fitFont(ctx, T.t('subscribe'), 960, 32, '600', BODY);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(T.t('subscribe'), W / 2, 1700);
  ctx.restore();
}

export function renderFrame(ctx, match, assets, opts = {}) {
  opts = { ...opts, texts: opts.texts || assets.texts || match.texts };
  ctx.save();
  drawBackground(ctx, assets);
  const [sx, sy] = match.fx.shakeOffset();
  ctx.translate(sx, sy);
  drawTitle(ctx, opts);
  drawScoreboard(ctx, match, assets, opts);
  match.game.draw(ctx, assets);
  match.fx.drawParticles(ctx);
  match.fx.drawPops(ctx);
  if (match.phase === 'intro' || match.phase === 'play' || match.phase === 'final') drawFooter(ctx, match, assets, opts);
  drawBanner(ctx, match.fx, opts.texts);
  ctx.restore();
  if (match.fx.flash > 0) {
    ctx.fillStyle = rgba(match.fx.flashColor, match.fx.flash * 0.5);
    ctx.fillRect(0, 0, W, H);
  }
  if (match.phase === 'intro') drawIntro(ctx, match, assets, opts);
  if (match.phase === 'final' || match.phase === 'outro' || match.phase === 'done') {
    drawOutro(ctx, match, assets, opts);
    if (match.phase !== 'final') match.fx.drawParticles(ctx);
  }
}

export { OUTRO };

// ------------------------------------------------------------------ kapak görseli
// Shorts kapağı (1080×1920). Skor YOK: izleyici merak edip videoyu izlesin.
export function renderThumbnail(ctx, assets, opts = {}) {
  const T = opts.texts || assets.texts;
  const [A, B] = assets.teams;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // çapraz ikiye bölünmüş zemin: üst-sol A rengi, alt-sağ B rengi
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);
  const half = (team, pts, gx0, gy0, gx1, gy1) => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, rgba(team.glow, 0.95));
    g.addColorStop(1, rgba(team.glow, 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  half(A, [[0, 0], [W, 0], [W, 760], [0, 1240]], 0, 0, W * 0.6, 1100);
  half(B, [[0, 1240], [W, 760], [W, H], [0, H]], W, H, W * 0.4, 820);
  // kontrast için karartma + ışık
  const dark = ctx.createLinearGradient(0, 0, 0, H);
  dark.addColorStop(0, 'rgba(5,7,15,0.55)');
  dark.addColorStop(0.5, 'rgba(5,7,15,0.25)');
  dark.addColorStop(1, 'rgba(5,7,15,0.5)');
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
  // ortadaki çapraz ışık şeridi
  ctx.save();
  ctx.translate(W / 2, 1000);
  ctx.rotate(Math.atan2(-480, W));
  const band = ctx.createLinearGradient(0, -70, 0, 70);
  band.addColorStop(0, 'rgba(255,215,0,0)');
  band.addColorStop(0.5, 'rgba(255,215,0,0.55)');
  band.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-W, -70, W * 2, 140);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // üst etiket + alt başlık
  const label = T.t('badge');
  fitFont(ctx, label, 820, 54, '400', DISPLAY);
  const lw = ctx.measureText(label).width + 80;
  roundRect(ctx, W / 2 - lw / 2, 110, lw, 84, 42);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillText(label, W / 2, 154);
  if (opts.subtitle) {
    fitFont(ctx, opts.subtitle, 940, 40, '700', BODY);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(opts.subtitle, W / 2, 245);
  }

  // büyük soru
  const q = T.t('thumbTitle');
  fitFont(ctx, q, 980, 170, '400', DISPLAY);
  ctx.lineWidth = 16;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(q, W / 2, 410);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(q, W / 2, 410);

  // logolar + isimler
  const logo = (team, x, y) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 50;
    drawSprite(ctx, team.sprite, x, y, 215);
    ctx.restore();
  };
  logo(A, 330, 760);
  logo(B, W - 330, 1250);
  const name = (team, x, y, align) => {
    const n = upper(team.name);
    fitFont(ctx, n, 560, 64, '900', BODY);
    ctx.textAlign = align;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(n, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(n, x, y);
  };
  name(A, 330, 1020, 'center');
  name(B, W - 330, 1510, 'center');

  // VS
  ctx.save();
  ctx.translate(W / 2 + 170, 960);
  ctx.rotate(-0.12);
  ctx.textAlign = 'center';
  ctx.font = `400 230px ${DISPLAY}`;
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('VS', 0, 0);
  ctx.restore();

  // gizli skor tabelası "? - ?"
  ctx.textAlign = 'center';
  const sy = 1680;
  roundRect(ctx, W / 2 - 300, sy - 115, 600, 230, 40);
  ctx.fillStyle = 'rgba(5,7,15,0.85)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();
  ctx.font = `400 190px ${DISPLAY}`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('?', W / 2 - 150, sy + 8);
  ctx.fillText('?', W / 2 + 150, sy + 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('-', W / 2, sy + 4);

  // alt çağrı
  const cta = T.t('thumbCta');
  fitFont(ctx, cta, 960, 54, '900', BODY);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(cta, W / 2, 1855);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cta, W / 2, 1855);
  ctx.restore();
}
