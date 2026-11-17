// Arayüz: takım arama, logo/renk, güç hesabı, önizleme ve video kaydı.
import { Match } from './match.js';
import { MODES, getMode } from './modes/index.js';
import { renderFrame } from './render.js';
import { Sound } from './audio.js';
import { Recorder, pickMime } from './recorder.js';
import { buildTeamAssets, loadImage, extractColors } from './assets.js';
import { computeStrength, matchClub, fallbackList } from './strength.js';
import { randomSeed } from './rng.js';
import { LANGS, KEYS, makeTexts } from './i18n.js';
import { slug, hashStr, weakColors, fixtureSubtitle, shortsText, makeThumbnail } from './produce.js';

const $ = (s, el = document) => el.querySelector(s);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const statusEl = $('#status');

const teams = [...document.querySelectorAll('.team')].map((el) => ({
  el,
  logo: null, // HTMLImageElement
  eloSource: '',
  selected: null, // açılır listeden seçilen takım
  suggest: [],
  active: -1,
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// ESPN rengi anlamsızsa (yok, iki renk aynı ya da ikisi de çok koyu) logodan çıkar
// Açılır listeden / fikstürden seçilen takımı uygula
async function selectTeam(i, t) {
  const el = teams[i].el;
  teams[i].selected = t;
  $('.t-name', el).value = t.name;
  $('.t-league', el).textContent = t.league ? `${t.league}${t.national ? ' · milli takım' : ''}` : '';
  if (t.color) $('.t-c1', el).value = t.color;
  if (t.color2) $('.t-c2', el).value = t.color2;
  closeSuggest(i);
  teamStatus(i, 'Güç puanı alınıyor…');
  const logoP = t.logo ? setLogo(i, t.logo, { autoColors: weakColors(t) }) : Promise.resolve();
  const eloP = fetch(`/api/elo?id=${encodeURIComponent(t.id)}&national=${t.national ? 1 : 0}&name=${encodeURIComponent(t.name)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const [, elo] = await Promise.all([logoP, eloP]);
  applyElo(i, elo, t.name);
}

function applyElo(i, elo, name) {
  const el = teams[i].el;
  if (!elo) {
    const fb = matchClub(name, fallbackList());
    if (fb) elo = { elo: fb.elo, source: 'yaklaşık tablo' };
  }
  if (elo) {
    $('.t-elo', el).value = elo.elo;
    teams[i].eloSource = elo.source;
    teamStatus(i, `Güç: Elo ${elo.elo} (${elo.source})`);
  } else {
    teams[i].eloSource = '';
    teamStatus(i, 'Güç puanı bulunamadı — elle girebilirsin.');
  }
  drawPoster();
}

// ---------------------------------------------------------------- açılır takım listesi
function closeSuggest(i) {
  const box = $('.t-suggest', teams[i].el);
  box.hidden = true;
  box.innerHTML = '';
  teams[i].suggest = [];
  teams[i].active = -1;
}

function renderSuggest(i, list, q) {
  const box = $('.t-suggest', teams[i].el);
  teams[i].suggest = list;
  teams[i].active = list.length ? 0 : -1;
  if (!list.length) {
    box.innerHTML = `<div class="sg-empty">“${escapeHtml(q)}” bulunamadı. Adı böyle bırakıp logoyu kendin yükleyebilirsin.</div>`;
  } else {
    box.innerHTML = list
      .map((t, k) => `<button type="button" class="sg-item${k === 0 ? ' active' : ''}" data-k="${k}">
        ${t.logo ? `<img src="${t.logo}" alt="" loading="lazy" />` : '<span class="sg-noimg"></span>'}
        <span class="sg-name">${escapeHtml(t.name)}</span>
        <span class="sg-league">${escapeHtml(t.national ? 'Milli takım' : t.league)}</span>
      </button>`)
      .join('');
  }
  box.hidden = false;
}

let suggestTimer = 0;
let suggestSeq = 0;
async function querySuggest(i) {
  const q = $('.t-name', teams[i].el).value.trim();
  teams[i].selected = null;
  $('.t-league', teams[i].el).textContent = '';
  if (q.length < 2) return closeSuggest(i);
  const seq = ++suggestSeq;
  try {
    const r = await fetch(`/api/teams?q=${encodeURIComponent(q)}&limit=12`);
    const j = await r.json();
    if (seq !== suggestSeq) return; // daha yeni bir arama var
    if (!r.ok) throw new Error(j.error || r.status);
    renderSuggest(i, j.teams || [], q);
  } catch (e) {
    if (seq !== suggestSeq) return;
    const box = $('.t-suggest', teams[i].el);
    box.innerHTML = `<div class="sg-empty">Takım listesi alınamadı (${escapeHtml(e.message)}). İnternet bağlantını kontrol et.</div>`;
    box.hidden = false;
  }
}

function moveActive(i, d) {
  const t = teams[i];
  if (!t.suggest?.length) return;
  t.active = (t.active + d + t.suggest.length) % t.suggest.length;
  [...$('.t-suggest', t.el).querySelectorAll('.sg-item')].forEach((b, k) => {
    b.classList.toggle('active', k === t.active);
    if (k === t.active) b.scrollIntoView({ block: 'nearest' });
  });
}

teams.forEach((t, i) => {
  const el = t.el;
  const input = $('.t-name', el);
  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => querySuggest(i), 180);
  });
  input.addEventListener('focus', () => input.value.trim().length >= 2 && !t.selected && querySuggest(i));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(i, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(i, -1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (t.suggest?.[t.active]) selectTeam(i, t.suggest[t.active]);
    } else if (e.key === 'Escape') closeSuggest(i);
  });
  input.addEventListener('blur', () => setTimeout(() => closeSuggest(i), 150));
  $('.t-suggest', el).addEventListener('mousedown', (e) => {
    const b = e.target.closest('.sg-item');
    if (!b) return;
    e.preventDefault();
    selectTeam(i, t.suggest[+b.dataset.k]);
  });
  $('.t-file', el).addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(i, reader.result, { autoColors: true });
    reader.readAsDataURL(f);
  });
  for (const s of ['.t-c1', '.t-c2', '.t-elo', '.t-value']) $(s, el).addEventListener('input', drawPoster);
  input.addEventListener('change', drawPoster);
});

// ---------------------------------------------------------------- takvim / günün maçları
const fxDate = $('#fxDate');
const fxComp = $('#fxComp');
const fxList = $('#fxList');
const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
fxDate.value = localDay();
let fixtures = [];

async function loadCompetitions() {
  try {
    const j = await (await fetch('/api/competitions')).json();
    const groups = {};
    for (const c of j.competitions) (groups[c.group] ||= []).push(c);
    fxComp.innerHTML = '<option value="">Tüm turnuvalar</option>' +
      Object.entries(groups).map(([g, cs]) => `<optgroup label="${escapeHtml(g)}">${cs.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</optgroup>`).join('');
  } catch { /* liste yüklenemezse "tümü" kalır */ }
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

async function loadFixtures() {
  fxList.innerHTML = '<div class="muted">Maçlar yükleniyor…</div>';
  const comps = fxComp.value ? `&comps=${fxComp.value}` : '';
  try {
    // ESPN günleri ABD saatine göre ayırır; yerel güne denk gelen maçlar için önceki/sonraki günü de al
    const day = fxDate.value;
    const d = new Date(day + 'T12:00:00');
    const days = [-1, 0, 1].map((k) => localDay(new Date(d.getTime() + k * 86400000)));
    const res = await Promise.all(days.map((x) => fetch(`/api/fixtures?date=${x}${comps}`).then((r) => r.json())));
    const seen = new Set();
    fixtures = res.flatMap((r) => r.matches || [])
      .filter((m) => localDay(new Date(m.date)) === day && !seen.has(m.id) && seen.add(m.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    renderFixtures();
  } catch (e) {
    fxList.innerHTML = `<div class="muted">Fikstür alınamadı: ${escapeHtml(e.message)}</div>`;
  }
}

function renderFixtures() {
  if (!fixtures.length) {
    fxList.innerHTML = '<div class="muted">Bu tarihte seçili turnuvalarda maç yok.</div>';
    return;
  }
  const byLeague = {};
  for (const m of fixtures) (byLeague[m.league] ||= []).push(m);
  fxList.innerHTML = Object.entries(byLeague).map(([lg, ms]) => `
    <div class="fx-league">${escapeHtml(lg)}</div>
    ${ms.map((m) => {
      const k = fixtures.indexOf(m);
      const score = m.state === 'pre' ? fmtTime(m.date) : `${m.home.score ?? ''}-${m.away.score ?? ''}`;
      const inQueue = queuedFixtures.has(String(m.id));
      const canAdd = m.state === 'pre' && new Date(m.date) > Date.now();
      return `<div class="fx-row">
        <button type="button" class="fx-item" data-k="${k}" title="${escapeHtml(m.venue)}">
          <span class="fx-time">${escapeHtml(score)}</span>
          <span class="fx-team">${m.home.logo ? `<img src="${m.home.logo}" alt="" loading="lazy" />` : ''}${escapeHtml(m.home.name)}</span>
          <span class="fx-vs">–</span>
          <span class="fx-team">${m.away.logo ? `<img src="${m.away.logo}" alt="" loading="lazy" />` : ''}${escapeHtml(m.away.name)}</span>
        </button>
        <button type="button" class="fx-add${inQueue ? ' added' : ''}" data-k="${k}" ${inQueue || !canAdd ? 'disabled' : ''}
          title="${inQueue ? 'Kuyrukta' : canAdd ? 'Otomatik kuyruğa ekle' : 'Başlamış maç eklenemez'}">${inQueue ? '✓' : '＋'}</button>
      </div>`;
    }).join('')}`).join('');
}

// Videodaki alt başlık videonun dilinde olur. İngilizce videoda saat İngiltere saatiyle (UK) yazılır.
let lastFixture = null;
let lastAutoSubtitle = '';
function setFixtureSubtitle(m) {
  const text = fixtureSubtitle(m, $('#lang').value);
  lastFixture = m;
  lastAutoSubtitle = text;
  $('#subtitle').value = text;
  drawPoster();
}

fxList.addEventListener('click', async (e) => {
  const b = e.target.closest('.fx-item');
  if (!b) return;
  const m = fixtures[+b.dataset.k];
  fxList.querySelectorAll('.fx-item').forEach((x) => x.classList.toggle('active', x === b));
  setFixtureSubtitle(m);
  const side = (t) => ({ ...t, league: m.league, national: m.national });
  await Promise.all([selectTeam(0, side(m.home)), selectTeam(1, side(m.away))]);
  setStatus(`Seçildi: ${m.home.name} - ${m.away.name}`);
});
fxDate.addEventListener('change', loadFixtures);
fxComp.addEventListener('change', loadFixtures);
$('#fxToday').addEventListener('click', () => { fxDate.value = localDay(); loadFixtures(); });
$('#fxPrev').addEventListener('click', () => { fxDate.value = localDay(new Date(new Date(fxDate.value + 'T12:00').getTime() - 86400000)); loadFixtures(); });
$('#fxNext').addEventListener('click', () => { fxDate.value = localDay(new Date(new Date(fxDate.value + 'T12:00').getTime() + 86400000)); loadFixtures(); });

// ---------------------------------------------------------------- ayarlar
const influence = $('#influence');
influence.addEventListener('input', () => {
  $('#influenceVal').textContent = influence.value + '%';
  drawPoster();
});
['#home', '#subtitle', '#mode', '#duration'].forEach((s) => $(s).addEventListener('input', drawPoster));

// ---------------------------------------------------------------- dil ve metinler
const langSel = $('#lang');
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
const savedLang = storage.get('videoLang', 'en');
langSel.value = LANGS[savedLang] ? savedLang : 'en';

const overridesFor = (lang) => storage.get('texts.' + lang, {});
const currentTexts = () => makeTexts(langSel.value, overridesFor(langSel.value));

function buildTextEditor() {
  const lang = langSel.value;
  const pack = LANGS[lang].strings;
  const ov = overridesFor(lang);
  const box = $('#textEditor');
  box.innerHTML = '';
  let group = '';
  for (const k of KEYS) {
    if (k.group !== group) {
      group = k.group;
      const h = document.createElement('h4');
      h.textContent = group;
      box.append(h);
    }
    const label = document.createElement('label');
    if (k.multiline || k.group === 'YouTube') label.className = 'wide';
    label.textContent = k.label;
    const input = document.createElement(k.multiline ? 'textarea' : 'input');
    if (!k.multiline) input.type = 'text';
    input.value = ov[k.key] ?? pack[k.key] ?? '';
    input.placeholder = pack[k.key] ?? '';
    input.classList.toggle('changed', k.key in ov);
    input.addEventListener('input', () => {
      const o = overridesFor(lang);
      if (input.value === (pack[k.key] ?? '')) delete o[k.key];
      else o[k.key] = input.value;
      storage.set('texts.' + lang, o);
      input.classList.toggle('changed', k.key in o);
      drawPoster();
    });
    label.append(input);
    box.append(label);
  }
}

langSel.addEventListener('change', () => {
  storage.set('videoLang', langSel.value);
  if (lastFixture && $('#subtitle').value === lastAutoSubtitle) setFixtureSubtitle(lastFixture);
  buildTextEditor();
  drawPoster();
});
$('#textsReset').addEventListener('click', () => {
  storage.set('texts.' + langSel.value, {});
  buildTextEditor();
  drawPoster();
});
buildTextEditor();

// Güç dengesi sadece panelde (videoda gösterilmez)
function showStrengthInfo(s) {
  const pA = s.st.pA;
  const e = s.st.edge[0];
  const a = Math.round(pA * 100);
  const fav = Math.abs(e) < 0.02 ? 'Dengeli maç' : `${e > 0 ? s.A.name : s.B.name} hafif avantajlı`;
  $('#strengthInfo').innerHTML = `🔒 <b>Arka plan güç dengesi</b> (videoda görünmez): ${escapeHtml(s.A.name)} %${a} · ${escapeHtml(s.B.name)} %${100 - a}
    <br><small class="muted">${escapeHtml(fav)} · kaynak: ${escapeHtml(s.strengthSource)} · oyun avantajı ${(Math.abs(e) * 100).toFixed(0)}%</small>
    <div class="bar"><span style="width:${a}%;background:${s.A.color}"></span><span style="width:${100 - a}%;background:${s.B.color}"></span></div>`;
}
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
  return { teams: [buildTeamAssets(s.A), buildTeamAssets(s.B)], texts: currentTexts() };
}

// Hareketsiz önizleme karesi
function drawPoster() {
  if (running) return;
  const s = settings();
  const sel = $('#mode').value;
  const modeId = sel === 'random' ? 'ring' : sel;
  showStrengthInfo(s);
  const assets = buildAssets(s);
  const m = new Match({ teams: [s.A, s.B], modeId, seed: 12345, duration: s.duration, edge: s.st.edge, skipIntro: true, texts: assets.texts });
  for (let k = 0; k < 120; k++) m.step();
  renderFrame(ctx, m, assets, { subtitle: s.subtitle });
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
  const opts = { subtitle: s.subtitle };
  const match = new Match({ teams: [assets.teams[0], assets.teams[1]], modeId, seed, duration: s.duration, edge: s.st.edge, audio: snd, texts: assets.texts });

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
  const result = { blob, ext: recorder.ext, match, s, seed, modeId, texts: assets.texts };
  await addResult(result);
  setStatus(`Bitti: ${s.A.name} ${match.score[0]}-${match.score[1]} ${s.B.name}`);
  return result;
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

async function addResult({ blob, ext, match, s, seed, modeId, texts }) {
  const url = URL.createObjectURL(blob);
  const [a, b] = match.score;
  // Dosya adında skor YOK: YouTube başlığı varsayılan olarak dosya adından doldurur, skor sızmasın.
  const base = `${slug(s.A.name)}_vs_${slug(s.B.name)}_prediction_${modeId}_${seed}`;
  const file = `${base}.${ext}`;
  const { title, desc } = shortsText(s, modeId, texts);
  const thumb = await makeThumbnail(s, texts);
  const thumbUrl = URL.createObjectURL(thumb);
  const div = document.createElement('div');
  div.className = 'result';
  div.innerHTML = `
    <div class="media">
      <video src="${url}" controls muted playsinline></video>
      <a href="${thumbUrl}" download="${base}_cover.jpg" title="Kapak görseli"><img class="thumb" src="${thumbUrl}" alt="Kapak" /></a>
    </div>
    <div>
      <h3>${escapeHtml(s.A.name)} ${a}-${b} ${escapeHtml(s.B.name)}</h3>
      <div class="meta">${escapeHtml(getMode(modeId).meta.name)} · ${LANGS[texts.lang].label} · seed ${seed} · ${(blob.size / 1e6).toFixed(1)} MB · ${ext.toUpperCase()}</div>
      <textarea readonly>${escapeHtml(title + '\n\n' + desc)}</textarea>
      <div class="row">
        <a class="btn" href="${url}" download="${file}">⬇ Video</a>
        <a class="btn alt" href="${thumbUrl}" download="${base}_cover.jpg">🖼 Kapak</a>
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
  downloadBlob(blob, file);
  setTimeout(() => downloadBlob(thumb, `${base}_cover.jpg`), 600);
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
$('#cover').addEventListener('click', () =>
  guarded(async () => {
    const s = settings();
    const texts = currentTexts();
    const blob = await makeThumbnail(s, texts);
    downloadBlob(blob, `${slug(s.A.name)}_vs_${slug(s.B.name)}_prediction_cover.jpg`);
    setStatus(`Kapak indirildi: ${s.A.name} - ${s.B.name}`);
  }),
);
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
// ---------------------------------------------------------------- otomatik kuyruk + YouTube
const H_POST = { 'X-Requested-With': 'mac-tahmin', 'Content-Type': 'application/json' };
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: H_POST, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}

let queuedFixtures = new Set();
let queueSig = '';
const STATUS = {
  queued: ['Sırada', 'st-wait'],
  rendering: ['Üretiliyor…', 'st-work'],
  rendered: ['Üretildi', 'st-work'],
  uploading: ['Yükleniyor…', 'st-work'],
  ready: ['Hazır · elle yükle', 'st-ok'],
  scheduled: ['YouTube’da zamanlandı', 'st-ok'],
  failed: ['Hata', 'st-bad'],
  missed: ['Kaçırıldı', 'st-bad'],
};
const fmtWhen = (iso) => new Date(iso).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function renderYoutubeBox(yt, settings) {
  const box = $('#qYoutube');
  let html;
  if (yt.connected) {
    html = `<div class="row"><span>✅ Bağlı kanal: <b>${escapeHtml(yt.channelTitle || '(adı alınamadı)')}</b></span>
      <button id="ytDisconnect" class="secondary">Bağlantıyı kes</button></div>`;
  } else if (yt.configured) {
    html = `<div class="row"><span>OAuth bilgileri kayıtlı.</span>
      <a class="btn-link" href="/auth/youtube">🔗 Google hesabıyla bağlan</a>
      <button id="ytReset" class="secondary">Bilgileri değiştir</button></div>`;
  } else {
    html = `<details ${settings.uploadMode === 'youtube' ? 'open' : ''}><summary>YouTube bağlı değil — kurulum (bir kerelik)</summary>
      <p class="muted">README'deki <b>“YouTube otomatik yükleme kurulumu”</b> adımlarıyla Google Cloud'dan bir <b>Desktop app</b> OAuth istemcisi oluştur,
      indirdiğin JSON dosyasını seç ya da Client ID / Secret'ı yapıştır. Bilgiler sadece bu bilgisayarda (data/ klasörü) saklanır.</p>
      <div class="row wrap">
        <label class="file">JSON dosyası seç<input id="ytJson" type="file" accept=".json,application/json" /></label>
        <input id="ytId" type="text" placeholder="Client ID (...apps.googleusercontent.com)" />
        <input id="ytSecret" type="text" placeholder="Client Secret" />
        <button id="ytSave">Kaydet</button>
      </div></details>`;
  }
  if (settings.uploadMode === 'youtube') {
    html += `<p class="warn">⚠️ Google, denetimden (audit) geçmemiş API projelerinden yüklenen videoları <b>“özel” olarak kilitler</b>.
      Denetim onayı gelene kadar “Sadece üret” modunu kullanman önerilir (README'de başvuru adımı var).</p>`;
  }
  box.innerHTML = html;
  $('#ytDisconnect')?.addEventListener('click', () => api('POST', '/api/youtube/disconnect').then(loadQueue));
  $('#ytReset')?.addEventListener('click', () => api('POST', '/api/youtube/disconnect').then(() => {
    box.innerHTML = '';
    renderYoutubeBox({ configured: false }, settings);
  }));
  $('#ytSave')?.addEventListener('click', async () => {
    try {
      const f = $('#ytJson').files?.[0];
      const body = f ? { json: await f.text() } : { clientId: $('#ytId').value, clientSecret: $('#ytSecret').value };
      await api('POST', '/api/youtube/client', body);
      setStatus('OAuth bilgileri kaydedildi. Şimdi “Google hesabıyla bağlan”a tıkla.');
      loadQueue(true);
    } catch (e) {
      setStatus('Hata: ' + e.message);
    }
  });
}

function renderQueue(q) {
  queuedFixtures = new Set(q.jobs.filter((j) => j.status !== 'failed').map((j) => j.fixture.id));
  $('#qUpload').value = q.settings.uploadMode;
  if (document.activeElement !== $('#qLead')) $('#qLead').value = q.settings.leadMinutes;
  const list = $('#qList');
  if (!q.jobs.length) {
    list.innerHTML = '<div class="muted">Kuyruk boş. Yukarıdaki fikstürde maçların yanındaki ＋ ile ekle.</div>';
    return;
  }
  list.innerHTML = q.jobs.map((j) => {
    const [label, cls] = STATUS[j.status] || [j.status, ''];
    const f = j.fixture;
    const yt = j.youtube;
    const pub = yt?.publishAt || j.plannedPublishAt;
    let info = '';
    if (j.status === 'scheduled') info = pub ? `Yayın: ${fmtWhen(pub)}` : 'Yayında';
    else if (j.status === 'ready' && pub) info = `Studio'da şu saate zamanla: <b>${fmtWhen(pub)}</b>`;
    else if (j.error) info = `<span class="err">${escapeHtml(j.error)}</span>`;
    const score = j.result ? ` · tahmin ${j.result.score[0]}-${j.result.score[1]}` : '';
    return `<div class="q-item" data-id="${j.id}">
      <div class="q-main">
        <div class="q-title">${escapeHtml(f.home.name)} – ${escapeHtml(f.away.name)}</div>
        <div class="q-meta">${escapeHtml(f.league)} · ${fmtWhen(f.date)} · ${escapeHtml(getMode(j.modeId).meta.name)}${score}</div>
        ${info ? `<div class="q-info">${info}</div>` : ''}
      </div>
      <span class="q-status ${cls}">${label}</span>
      <div class="q-actions">
        ${j.dir && j.result ? '<button data-act="open" title="Klasörü aç">📂</button>' : ''}
        ${yt?.url ? `<a href="${yt.url}" target="_blank" rel="noopener" title="YouTube'da aç">▶</a>` : ''}
        ${j.status === 'failed' ? '<button data-act="retry" title="Tekrar dene">↻</button>' : ''}
        ${['rendering', 'uploading'].includes(j.status) ? '' : '<button data-act="del" title="Kuyruktan çıkar">✕</button>'}
      </div>
    </div>`;
  }).join('');
}

async function loadQueue(force = false) {
  try {
    const q = await (await fetch('/api/queue')).json();
    const sig = JSON.stringify(q);
    if (!force && sig === queueSig) return;
    const fixturesChanged = JSON.stringify([...queuedFixtures].sort()) !== JSON.stringify(q.jobs.filter((j) => j.status !== 'failed').map((j) => j.fixture.id).sort());
    queueSig = sig;
    renderQueue(q);
    renderYoutubeBox(q.youtube, q.settings);
    if (fixturesChanged && fixtures.length) renderFixtures();
  } catch { /* sunucu kapalı olabilir */ }
}

fxList.addEventListener('click', async (e) => {
  const b = e.target.closest('.fx-add');
  if (!b || b.disabled) return;
  e.stopPropagation();
  const m = fixtures[+b.dataset.k];
  const lang = langSel.value;
  b.disabled = true;
  try {
    await api('POST', '/api/queue', {
      fixture: m,
      modeId: $('#mode').value,
      settings: { duration: +$('#duration').value, influence: +influence.value / 100, homeAdvantage: $('#home').checked, lang, overrides: overridesFor(lang) },
    });
    setStatus(`Kuyruğa eklendi: ${m.home.name} - ${m.away.name}`);
    loadQueue(true);
  } catch (err) {
    b.disabled = false;
    setStatus('Eklenemedi: ' + err.message);
  }
});

$('#qList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.q-item').dataset.id;
  try {
    if (b.dataset.act === 'del') await api('DELETE', `/api/queue/${id}`);
    if (b.dataset.act === 'retry') await api('POST', `/api/queue/${id}/retry`);
    if (b.dataset.act === 'open') await api('POST', `/api/queue/${id}/open`);
    loadQueue(true);
  } catch (err) {
    setStatus('Hata: ' + err.message);
  }
});
const saveQueueSettings = () => api('POST', '/api/queue/settings', { uploadMode: $('#qUpload').value, leadMinutes: +$('#qLead').value }).then(() => loadQueue(true)).catch((e) => setStatus('Hata: ' + e.message));
$('#qUpload').addEventListener('change', saveQueueSettings);
$('#qLead').addEventListener('change', saveQueueSettings);
setInterval(loadQueue, 4000);
loadQueue(true);
{
  const yt = new URLSearchParams(location.search).get('youtube');
  if (yt) {
    setStatus(yt === 'ok' ? '✅ YouTube hesabı bağlandı.' : 'YouTube bağlantısı başarısız: ' + yt);
    history.replaceState(null, '', '/');
  }
}

// Açılış: turnuva listesi, bugünün maçları ve varsayılan takımlar
loadCompetitions().then(loadFixtures);
(async () => {
  for (const [i, q] of [[0, 'Real Madrid'], [1, 'Barcelona']]) {
    try {
      const j = await (await fetch(`/api/teams?q=${encodeURIComponent(q)}&limit=1`)).json();
      if (j.teams?.[0] && !teams[i].selected) await selectTeam(i, j.teams[0]);
    } catch { /* çevrimdışı: varsayılan renklerle devam */ }
  }
})();
