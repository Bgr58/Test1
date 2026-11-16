// Takım görselleri: logo diski (sprite), logodan renk çıkarma, yedek (baş harfli) logo.
import { TAU, glowColor, luminance, hexToRgb } from './draw.js';

const SIZE = 256;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel yüklenemedi'));
    img.src = src;
  });
}

export function initials(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toLocaleUpperCase('tr-TR');
  return words.slice(0, 3).map((w) => w[0]).join('').toLocaleUpperCase('tr-TR');
}

// İsimden tutarlı bir renk üret (veri bulunamazsa).
export function colorFromName(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return hslToHex(hue, 70, 45);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// Logodaki baskın 2 rengi bul (şeffaf/beyaza yakın pikselleri atlayarak).
export function extractColors(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
    if (max > 235 && min > 225) continue; // beyaz
    const key = ((r >> 5) << 6) | ((gg >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, sat: max - min };
    e.n++;
    e.r += r;
    e.g += gg;
    e.b += b;
    buckets.set(key, e);
  }
  const list = [...buckets.values()]
    .map((e) => ({ n: e.n * (1 + e.sat / 255), hex: toHex(e.r / e.n, e.g / e.n, e.b / e.n) }))
    .sort((a, b) => b.n - a.n);
  if (!list.length) return ['#ffffff', '#222222'];
  const first = list[0].hex;
  const second = list.find((x) => colorDistance(x.hex, first) > 120)?.hex || (luminance(first) > 0.5 ? '#111111' : '#ffffff');
  return [first, second];
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function colorDistance(a, b) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// Yuvarlak logo diski: beyaz zemin + logo + takım renginde halka.
export function makeSprite({ name, color, color2, logo }) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const R = SIZE / 2;
  g.beginPath();
  g.arc(R, R, R - 2, 0, TAU);
  g.fillStyle = logo ? '#ffffff' : color;
  g.fill();
  if (logo) {
    g.save();
    g.beginPath();
    g.arc(R, R, R - 18, 0, TAU);
    g.clip();
    const pad = SIZE * 0.17;
    const box = SIZE - pad * 2;
    const s = Math.min(box / logo.width, box / logo.height);
    const w = logo.width * s;
    const h = logo.height * s;
    g.drawImage(logo, R - w / 2, R - h / 2, w, h);
    g.restore();
  } else {
    const txt = initials(name);
    g.fillStyle = color2 && color2.toLowerCase() !== color.toLowerCase() ? color2 : '#ffffff';
    g.font = `900 ${txt.length > 2 ? 78 : 100}px Inter, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, R, R + 6);
  }
  g.lineWidth = 16;
  g.strokeStyle = color;
  g.beginPath();
  g.arc(R, R, R - 9, 0, TAU);
  g.stroke();
  g.lineWidth = 4;
  g.strokeStyle = color2 || '#ffffff';
  g.beginPath();
  g.arc(R, R, R - 19, 0, TAU);
  g.stroke();
  return c;
}

export function buildTeamAssets(team) {
  // Beyaz forma (ör. Real Madrid) koyu zeminde halka olarak iyi görünür; çok koyu renkleri parlat.
  return { ...team, glow: glowColor(team.color), sprite: makeSprite(team) };
}
