// Panel (app.js) ve arka plan üretici (autorender.js) için ortak yardımcılar.
import { buildTeamAssets } from './assets.js';
import { renderThumbnail } from './render.js';
import { LANGS } from './i18n.js';

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

// Fikstürden gelen maç için videodaki alt başlık (videonun dilinde; İngilizcede İngiltere saati)
export function fixtureSubtitle(m, lang) {
  const locale = LANGS[lang]?.locale || 'en-GB';
  if (lang === 'en') {
    const d = new Date(m.date);
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    return `${m.leagueEn || m.league} • ${day}, ${time} UK`;
  }
  const when = new Date(m.date).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return `${lang === 'tr' ? m.league : m.leagueEn || m.league} • ${when}`;
}

// Başlık/açıklamada skor YOK (izleyici videoyu izlesin). Eski şablonda {score} kalmışsa boş geçilir.
export function shortsText(s, modeId, T) {
  const tags = ['#' + slug(s.A.name).toLowerCase(), '#' + slug(s.B.name).toLowerCase()].join(' ');
  const vars = { home: s.A.name, away: s.B.name, score: '', mode: T.t('mode.' + modeId), subtitle: s.subtitle, tags };
  const title = T.t('ytTitle', vars);
  const desc = T.t('ytDesc', vars).split('\n').filter((l) => l.trim()).join('\n');
  return { title: title.replace(/\s{2,}/g, ' ').trim(), desc };
}

// Kapak görseli (JPEG, 1080×1920). YouTube kapak sınırı 2 MB; kalite buna göre ayarlanır.
export async function makeThumbnail(s, texts) {
  await document.fonts.ready;
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
