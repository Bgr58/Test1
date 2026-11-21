// Panel (app.js) ve arka plan üretici (autorender.js) için ortak yardımcılar.
import { buildTeamAssets } from './assets.js';
import { renderThumbnail } from './render.js';
import { LANGS } from './i18n.js';

// Canvas yazı tipleri ancak kullanılınca indirilir; ilk karenin doğru tiple çizilmesi için önceden yükle
let fontsP = null;
export function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsP ||= Promise.all(
    ['400 120px Anton', '600 40px Inter', '700 40px Inter', '800 40px Inter', '900 40px Inter'].map((f) => document.fonts.load(f).catch(() => null)),
  ).then(() => document.fonts.ready);
  return fontsP;
}

export function hashStr(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24) || 'takim';
}

// ESPN rengi anlamsızsa (yok, iki renk aynı ya da ikisi de çok koyu) logodan çıkarılmalı
export function weakColors(t) {
  if (t.knownColors) return false;
  if (!t.color || !t.color2) return true;
  if (t.color === t.color2) return true;
  const dark = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16) < 90;
  return dark(t.color) && dark(t.color2);
}

// Saat dilimi kısaltması: Türkiye "TRT", diğerleri tarayıcının verdiği kısa ad (GMT/BST, CET/CEST, WET, GMT-3…)
export function tzLabel(date, tz) {
  if (tz === 'Europe/Istanbul') return 'TRT';
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName');
    return part?.value || '';
  } catch {
    return '';
  }
}

// Fikstürden gelen maç için alt başlık (video + açıklama): videonun dilinde, maç saati LİGİN ÜLKESİNİN saatiyle.
// Avrupa kupalarında ev sahibi takımın ülkesi, milli maçlarda ev sahibi ülke; bilinmiyorsa Orta Avrupa saati.
export function fixtureSubtitle(m, lang) {
  const locale = LANGS[lang]?.locale || 'en-GB';
  const tz = m.tz || 'Europe/Paris';
  const d = new Date(m.date);
  const league = lang === 'tr' ? m.league : m.leagueEn || m.league;
  let day, time;
  try {
    day = d.toLocaleDateString(lang === 'en' ? 'en-GB' : locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
    time = d.toLocaleTimeString(lang === 'en' ? 'en-GB' : locale, { hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch {
    day = d.toUTCString().slice(0, 11);
    time = d.toISOString().slice(11, 16);
  }
  return `${league} • ${day}, ${time} ${tzLabel(d, tz)}`.trim();
}

// Başlık şablonunda her satır bir çeşit: maça göre (sabit) biri seçilir, böylece her video aynı başlıkla çıkmaz
export function pickVariant(text, key) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return lines[0] || '';
  return lines[hashStr(String(key)) % lines.length];
}

// Başlık/açıklamada skor YOK (izleyici videoyu izlesin). Eski şablonda {score} kalmışsa boş geçilir.
export function shortsText(s, modeId, T) {
  const tags = ['#' + slug(s.A.name).toLowerCase(), '#' + slug(s.B.name).toLowerCase()].join(' ');
  const vars = { home: s.A.name, away: s.B.name, score: '', mode: T.t('mode.' + modeId), subtitle: s.subtitle || '', tags, leagueTag: s.leagueTag || '' };
  const title = pickVariant(T.t('ytTitle', vars), `${s.A.name}|${s.B.name}|${s.subtitle}`);
  const desc = T.t('ytDesc', vars)
    .split('\n')
    .map((l) => l.replace(/\s{2,}/g, ' ').trim())
    .filter((l) => l && !/^⏰\s*$/.test(l))
    .join('\n');
  return { title: title.replace(/\s{2,}/g, ' ').trim(), desc };
}

// Kapak görseli (JPEG, 1080×1920). YouTube kapak sınırı 2 MB; kalite buna göre ayarlanır.
export async function makeThumbnail(s, texts) {
  await ensureFonts();
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1920;
  const assets = { teams: [buildTeamAssets(s.A), buildTeamAssets(s.B)], texts };
  renderThumbnail(c.getContext('2d'), assets, { subtitle: s.subtitle, texts });
  for (const q of [0.92, 0.85, 0.75]) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (blob.size < 1.9e6) return blob;
  }
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.6));
}
