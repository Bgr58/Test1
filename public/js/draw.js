// Ortak çizim yardımcıları (DOM'a bağımlı değil; ctx dışarıdan gelir).
export const TAU = Math.PI * 2;

export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Takım sprite'ını (logo diski) çiz.
export function drawSprite(ctx, sprite, x, y, r, rot = 0, alpha = 1) {
  if (!sprite) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
  ctx.restore();
}

export function drawTrail(ctx, trail, r, color) {
  const n = trail.length;
  if (n < 2) return;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n;
    ctx.globalAlpha = 0.28 * k;
    ctx.beginPath();
    ctx.arc(trail[i][0], trail[i][1], r * (0.35 + 0.55 * k), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function pushTrail(b, max = 12, every = 3) {
  b.trailTick = (b.trailTick || 0) + 1;
  if (b.trailTick % every) return;
  (b.trail ||= []).push([b.x, b.y]);
  if (b.trail.length > max) b.trail.shift();
}

// Klasik futbol topu.
export function drawSoccerBall(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(r * 0.25, r * 0.35, r * 1.05, r * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(rot);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  const pent = (cx, cy, s) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fill();
  };
  pent(0, 0, r * 0.38);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    pent(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.26);
  }
  ctx.strokeStyle = '#222';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// Metni verilen genişliğe sığacak şekilde küçültüp fontu ayarla.
export function fitFont(ctx, text, maxW, size, weight = '800', family = 'Inter, Arial, sans-serif') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 10 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Koyu zeminde görünür kalacak "parlak" bir ton.
export function glowColor(hex) {
  const l = luminance(hex);
  if (l < 0.06) return mix(hex, '#ffffff', 0.45);
  return hex;
}
