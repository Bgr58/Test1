// Arayüz: takım arama, logo/renk, güç hesabı, önizleme ve video kaydı.
import { Match } from './match.js';
import { MODES, getMode } from './modes/index.js';
import { renderFrame } from './render.js';
import { Sound } from './audio.js';
import { Recorder, pickMime } from './recorder.js';
import { buildTeamAssets, loadImage, extractColors } from './assets.js';
import { computeStrength, matchClub, fallbackList } from './strength.js';
import { randomSeed } from './rng.js';

const $ = (s, el = document) => el.querySelector(s);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const statusEl = $('#status');

const teams = [...document.querySelectorAll('.team')].map((el) => ({
  el,
  logo: null, // HTMLImageElement
  candidates: [],
  eloSource: '',
}));

let sound = null;
let running = null; // { stop() }

const setStatus = (t) => (statusEl.textContent = t);
const storage = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yoksay */ }
  },
};

// ---------------------------------------------------------------- takım verisi
function teamInput(i) {
  const el = teams[i].el;
  const num = (s) => {
    const v = parseFloat($(s, el).value);
    return Number.isFinite(v) ? v : undefined;
  };
  return {
    name: $('.t-name', el).value.trim() || (i ? 'Deplasman' : 'Ev Sahibi'),
    color: $('.t-c1', el).value,
    color2: $('.t-c2', el).value,
    elo: num('.t-elo'),
    value: num('.t-value'),
    logo: teams[i].logo,
  };
}

function teamStatus(i, text) {
  $('.t-status', teams[i].el).textContent = text;
}

async function setLogo(i, src, { autoColors = false } = {}) {
  const el = teams[i].el;
  try {
    const img = await loadImage(src);
    teams[i].logo = img;
    $('.t-logo', el).src = src;
    if (autoColors) {
      const [c1, c2] = extractColors(img);
      $('.t-c1', el).value = c1;
      $('.t-c2', el).value = c2;
    }
  } catch {
    teams[i].logo = null;
    $('.t-logo', el).removeAttribute('src');
    teamStatus(i, 'Logo yüklenemedi — kendin yükleyebilirsin.');
  }
  drawPoster();
}

async function applyCandidate(i, c) {
  const el = teams[i].el;
  $('.t-name', el).value = c.name;
  if (c.colors.length) {
    $('.t-c1', el).value = c.colors[0];
    $('.t-c2', el).value = c.colors[1] || (c.colors[0].toLowerCase() === '#ffffff' ? '#222222' : '#ffffff');
  }
  if (c.badge) await setLogo(i, c.badge, { autoColors: !c.colors.length });
}

async function searchTeam(i) {
  const el = teams[i].el;
  const name = $('.t-name', el).value.trim();
  if (!name) return;
  const sel = $('.t-candidates', el);
  teamStatus(i, 'Aranıyor…');
  const [teamRes, eloRes] = await Promise.allSettled([
    fetch(`/api/team?name=${encodeURIComponent(name)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
    fetch(`/api/elo?name=${encodeURIComponent(name)}`).then((r) => (r.ok ? r.json() : null)),
  ]);

  const msgs = [];
  if (teamRes.status === 'fulfilled' && teamRes.value.teams?.length) {
    const list = teamRes.value.teams;
    teams[i].candidates = list;
    sel.innerHTML = list.map((c, k) => `<option value="${k}">${escapeHtml(c.name)} — ${escapeHtml(c.league || c.country)}</option>`).join('');
    sel.hidden = list.length < 2;
    await applyCandidate(i, list[0]);
    msgs.push(`Logo/renk: ${list[0].name}`);
  } else {
    sel.hidden = true;
    msgs.push('Logo bulunamadı (yükleyebilirsin)');
  }

  let elo = eloRes.status === 'fulfilled' ? eloRes.value : null;
  if (!elo) {
    // sunucu yoksa tarayıcı tarafında yaklaşık tablo
    const fb = matchClub(name, fallbackList());
    if (fb) elo = { club: fb.club, elo: fb.elo, source: 'yaklaşık tablo' };
  }
  if (elo) {
    $('.t-elo', el).value = elo.elo;
    teams[i].eloSource = elo.source;
    msgs.push(`Elo ${elo.elo} (${elo.source}${elo.club ? ': ' + elo.club : ''})`);
  } else {
    teams[i].eloSource = '';
    msgs.push('Elo bulunamadı — elle girebilirsin');
  }
  teamStatus(i, msgs.join(' · '));
  drawPoster();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

teams.forEach((t, i) => {
  const el = t.el;
  $('.t-search', el).addEventListener('click', () => searchTeam(i));
  $('.t-name', el).addEventListener('keydown', (e) => e.key === 'Enter' && searchTeam(i));
  $('.t-candidates', el).addEventListener('change', (e) => applyCandidate(i, t.candidates[+e.target.value]));
  $('.t-file', el).addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(i, reader.result, { autoColors: true });
    reader.readAsDataURL(f);
  });
  for (const s of ['.t-c1', '.t-c2', '.t-elo', '.t-value']) $(s, el).addEventListener('input', drawPoster);
  $('.t-name', el).addEventListener('change', drawPoster);
});

// ---------------------------------------------------------------- ayarlar
const influence = $('#influence');
influence.addEventListener('input', () => {
  $('#influenceVal').textContent = influence.value + '%';
  drawPoster();
});
['#home', '#showStrength', '#subtitle', '#mode'].forEach((s) => $(s).addEventListener('input', drawPoster));
$('#dice').addEventListener('click', () => {
  $('#seed').value = randomSeed();
});

function settings() {
  const A = teamInput(0);
  const B = teamInput(1);
  const st = computeStrength({
    eloA: A.elo, eloB: B.elo, valueA: A.value, valueB: B.value,
    homeAdvantage: $('#home').checked, influence: +influence.value / 100,
  });
  const usesValue = A.value > 0 && B.value > 0;
  const src = usesValue ? 'Elo + kadro değeri' : A.elo || B.elo ? 'ClubElo' : 'eşit güç';
  return {
    A, B, st,
    duration: +$('#duration').value,
    subtitle: $('#subtitle').value.trim(),
    showStrength: $('#showStrength').checked,
    sound: $('#sound').checked,
    monitor: $('#monitor').checked,
    strengthSource: src,
  };
}

// Rastgele modda aynı formatı arka arkaya vermemek için "torba" sistemi
function nextRandomMode() {
  let bag = storage.get('modeBag', []);
  const last = storage.get('lastMode', null);
  if (!bag.length) {
    bag = MODES.map((m) => m.meta.id).sort(() => Math.random() - 0.5);
    if (bag[0] === last && bag.length > 1) bag.push(bag.shift());
  }
  const id = bag.shift();
  storage.set('modeBag', bag);
  storage.set('lastMode', id);
  return id;
}

function buildAssets(s) {
  return { teams: [buildTeamAssets(s.A), buildTeamAssets(s.B)] };
}

// Hareketsiz önizleme karesi
function drawPoster() {
  if (running) return;
  const s = settings();
  const sel = $('#mode').value;
  const modeId = sel === 'random' ? 'ring' : sel;
  const m = new Match({ teams: [s.A, s.B], modeId, seed: 12345, duration: s.duration, edge: s.st.edge, skipIntro: true });
  for (let k = 0; k < 120; k++) m.step();
  renderFrame(ctx, m, buildAssets(s), { subtitle: s.subtitle, showStrength: s.showStrength, pA: s.st.pA, strengthSource: s.strengthSource });
}

// ---------------------------------------------------------------- oynatma / kayıt
function setBusy(b) {
  for (const id of ['#preview', '#record', '#batch']) $(id).disabled = b;
  $('#stop').disabled = !b;
}

async function ensureSound(s) {
  if (!sound) sound = new Sound();
  await sound.resume();
  sound.setMuted(!s.sound);
  sound.setMonitor(true);
  return sound;
}

async function playOnce({ record, modeId: forcedMode }) {
  const s = settings();
  await document.fonts.ready;
  const snd = await ensureSound(s);
  const sel = $('#mode').value;
  const modeId = forcedMode || (sel === 'random' ? nextRandomMode() : sel);
  const seedText = $('#seed').value.trim();
  const seed = seedText ? (/^\d+$/.test(seedText) ? +seedText : hashStr(seedText)) : randomSeed();
  const assets = buildAssets(s);
  const opts = { subtitle: s.subtitle, showStrength: s.showStrength, pA: s.st.pA, strengthSource: s.strengthSource };
  const match = new Match({ teams: [assets.teams[0], assets.teams[1]], modeId, seed, duration: s.duration, edge: s.st.edge, audio: snd });

  let recorder = null;
  if (record) {
    snd.setMonitor(s.monitor);
    recorder = new Recorder(canvas, snd.stream);
    recorder.start();
  }
  setStatus(`${record ? 'Kaydediliyor' : 'Önizleme'}: ${getMode(modeId).meta.name} (seed ${seed})…`);

  let stopped = false;
  await new Promise((resolve) => {
    running = { stop: () => { stopped = true; } };
    let last = performance.now();
    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      match.advance(dt);
      renderFrame(ctx, match, assets, opts);
      if (match.done || stopped) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  running = null;
  snd.ambientStop();
  snd.setMonitor(true);

  if (!recorder) {
    setStatus(stopped ? 'Durduruldu.' : `Önizleme bitti: ${s.A.name} ${match.score[0]}-${match.score[1]} ${s.B.name} (seed ${seed})`);
    return null;
  }
  // son kareyi biraz tut
  await new Promise((r) => setTimeout(r, 300));
  const blob = await recorder.stop();
  if (stopped) {
    setStatus('Kayıt iptal edildi.');
    return null;
  }
  const result = { blob, ext: recorder.ext, match, s, seed, modeId };
  addResult(result);
  setStatus(`Bitti: ${s.A.name} ${match.score[0]}-${match.score[1]} ${s.B.name}`);
  return result;
}

function hashStr(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24) || 'takim';
}

function shortsText(s, match, modeId) {
  const [a, b] = match.score;
  const tagA = '#' + slug(s.A.name).toLowerCase();
  const tagB = '#' + slug(s.B.name).toLowerCase();
  const title = `${s.A.name} vs ${s.B.name} Skor Tahmini: ${a}-${b}! ⚽ #shorts`;
  const desc = [
    `${s.A.name} - ${s.B.name} maçının skorunu "${getMode(modeId).meta.name}" oyunuyla tahmin ettik: ${a}-${b}.`,
    s.subtitle ? s.subtitle : '',
    'Sence maç kaç kaç biter? Yorumlara yaz! 👇',
    `${tagA} ${tagB} #maçtahmini #skortahmini #futbol #shorts`,
  ].filter(Boolean).join('\n');
  return { title, desc };
}

function addResult({ blob, ext, match, s, seed, modeId }) {
  const url = URL.createObjectURL(blob);
  const [a, b] = match.score;
  const file = `tahmin_${slug(s.A.name)}_${slug(s.B.name)}_${a}-${b}_${modeId}.${ext}`;
  const { title, desc } = shortsText(s, match, modeId);
  const div = document.createElement('div');
  div.className = 'result';
  div.innerHTML = `
    <video src="${url}" controls muted playsinline></video>
    <div>
      <h3>${escapeHtml(s.A.name)} ${a}-${b} ${escapeHtml(s.B.name)}</h3>
      <div class="meta">${escapeHtml(getMode(modeId).meta.name)} · seed ${seed} · ${(blob.size / 1e6).toFixed(1)} MB · ${ext.toUpperCase()}</div>
      <textarea readonly>${escapeHtml(title + '\n\n' + desc)}</textarea>
      <div class="row">
        <a class="btn" href="${url}" download="${file}">⬇ İndir</a>
        <button class="copy">Başlık/açıklamayı kopyala</button>
      </div>
    </div>`;
  $('.copy', div).addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(title + '\n\n' + desc);
      e.target.textContent = 'Kopyalandı ✓';
    } catch {
      $('textarea', div).select();
    }
  });
  $('#results').prepend(div);
  const link = document.createElement('a');
  link.href = url;
  link.download = file;
  link.click();
}

async function guarded(fn) {
  if (running) return;
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    console.error(e);
    setStatus('Hata: ' + e.message);
  } finally {
    running = null;
    setBusy(false);
  }
}

$('#preview').addEventListener('click', () => guarded(() => playOnce({ record: false })));
$('#record').addEventListener('click', () => guarded(() => playOnce({ record: true })));
$('#batch').addEventListener('click', () =>
  guarded(async () => {
    const order = MODES.map((m) => m.meta.id);
    for (let k = 0; k < order.length; k++) {
      const r = await playOnce({ record: true, modeId: order[k] });
      if (!r) break;
      setStatus(`${k + 1}/${order.length} video hazır…`);
    }
  }),
);
$('#stop').addEventListener('click', () => running?.stop());

if (pickMime() === null) setStatus('Bu tarayıcı video kaydını desteklemiyor. Chrome veya Edge kullan.');
else if (!pickMime().includes('mp4')) setStatus('Not: Bu tarayıcı MP4 kaydedemiyor, WebM üretilecek (YouTube kabul eder).');

document.fonts.ready.then(drawPoster);
drawPoster();
// Açılışta varsayılan takımları otomatik ara
searchTeam(0);
searchTeam(1);
