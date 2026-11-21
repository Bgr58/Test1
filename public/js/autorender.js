// Görünmez üretici: sunucudaki kuyruk işini alır, videoyu + kapağı üretip sunucuya gönderir.
import { Match, findSeed } from './match.js';
import { renderFrame } from './render.js';
import { Sound } from './audio.js';
import { Recorder } from './recorder.js';
import { buildTeamAssets, loadImage, extractColors } from './assets.js';
import { computeStrength, outcomeProbs, pickOutcome } from './strength.js';
import { randomSeed } from './rng.js';
import { makeTexts } from './i18n.js';
import { weakColors, fixtureSubtitle, shortsText, makeThumbnail, ensureFonts } from './produce.js';

const jobId = new URLSearchParams(location.search).get('job');
const H = { 'X-Requested-With': 'mac-tahmin' };

async function team(t) {
  let logo = null;
  let color = t.color || '#ffffff';
  let color2 = t.color2 || '#222222';
  if (t.logo) {
    try {
      logo = await loadImage(t.logo);
      if (weakColors(t)) [color, color2] = extractColors(logo);
    } catch { /* logosuz devam */ }
  }
  let elo;
  try {
    const r = await fetch(`/api/elo?id=${encodeURIComponent(t.id)}&national=${t.national ? 1 : 0}&name=${encodeURIComponent(t.name)}`);
    if (r.ok) elo = (await r.json()).elo;
  } catch { /* eşit güç */ }
  return { name: t.name, color, color2, logo, elo };
}

// Müzik: dahili (telifsiz sentez) / music klasöründen rastgele parça / kapalı
async function prepareMusic(sound, music, seed) {
  const m = music || { mode: 'synth', volume: 0.6 };
  let file = null;
  if (m.mode === 'file') {
    try {
      const { files } = await (await fetch('/api/music')).json();
      if (files.length) file = files[seed % files.length].url;
    } catch { /* dahili müziğe düşer */ }
  }
  await sound.prepareMusic({ mode: m.mode, volume: m.volume, file });
  try {
    await sound.prepareGoalSounds((await (await fetch('/api/sounds')).json()).goal || []);
  } catch { /* sentez gol sesi */ }
}

async function upload(name, blob) {
  const r = await fetch(`/api/jobs/${jobId}/files/${name}`, { method: 'PUT', headers: H, body: blob });
  if (!r.ok) throw new Error(`${name} kaydedilemedi: ${r.status}`);
}

async function run() {
  const job = await (await fetch(`/api/jobs/${jobId}`)).json();
  const { fixture, settings: st, modeId } = job;
  const [A, B] = await Promise.all([team(fixture.home), team(fixture.away)]);
  const strength = computeStrength({ eloA: A.elo, eloB: B.elo, homeAdvantage: st.homeAdvantage, influence: st.influence });
  const texts = makeTexts(st.lang, st.overrides);
  const subtitle = fixtureSubtitle(fixture, st.lang);
  await ensureFonts();

  const assets = { teams: [buildTeamAssets(A), buildTeamAssets(B)], texts };
  const sound = new Sound();
  await sound.resume();
  sound.setMonitor(false); // hoparlörden çalma, sadece videoya kaydet
  let seed = randomSeed();
  let realistic = null;
  if (st.realistic) {
    // 🎯 Gerçekçi: sonucu gerçek futbol olasılıklarıyla çek, onu kendiliğinden veren fizik maçını bul
    const probs = outcomeProbs(strength.diff);
    const target = pickOutcome(probs, Math.random());
    const r = findSeed({ teams: assets.teams, modeId, duration: st.duration, edge: strength.edge, texts }, target, seed);
    seed = r.seed;
    realistic = { target, probs, tries: r.tries, missed: !!r.missed };
  }
  await prepareMusic(sound, st.music, seed);
  const match = new Match({ teams: assets.teams, modeId, seed, duration: st.duration, edge: strength.edge, audio: sound, texts });
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const opts = { subtitle };
  renderFrame(ctx, match, assets, opts);
  const rec = new Recorder(canvas, sound.stream);
  rec.start();
  await new Promise((resolve) => {
    let last = performance.now();
    const frame = (now) => {
      match.advance((now - last) / 1000);
      last = now;
      renderFrame(ctx, match, assets, opts);
      if (match.done) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  sound.ambientStop();
  sound.musicStop();
  await new Promise((r) => setTimeout(r, 300));
  const video = await rec.stop();
  const s = { A, B, subtitle, leagueTag: fixture.leagueTag || '' };
  const thumb = await makeThumbnail(s, texts);
  const { title, desc } = shortsText(s, modeId, texts);
  await upload(`video.${rec.ext}`, video);
  await upload('cover.jpg', thumb);
  const r = await fetch(`/api/jobs/${jobId}/rendered`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ score: match.score, modeId, seed, ext: rec.ext, title, desc, subtitle, elo: [A.elo, B.elo], realistic }),
  });
  if (!r.ok) throw new Error('Sonuç bildirilemedi');
}

run().catch((e) => {
  console.error(e);
  fetch(`/api/jobs/${jobId}/error`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: e.message }) });
});
