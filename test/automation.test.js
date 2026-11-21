import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { publishPlan, Automation, judge, parseYoutubeId } from '../automation.js';

const H = 3600_000;

test('yayın planı: maçtan 1 saat önce zamanla, yakınsa hemen, başladıysa kaçırıldı', () => {
  const now = Date.parse('2026-11-22T08:00:00Z');
  assert.deepEqual(publishPlan('2026-11-22T13:00:00Z', 60, now), { action: 'schedule', publishAt: '2026-11-22T12:00:00.000Z' });
  assert.deepEqual(publishPlan('2026-11-22T09:05:00Z', 60, now), { action: 'now', publishAt: null });
  assert.equal(publishPlan('2026-11-22T07:00:00Z', 60, now).action, 'missed');
  assert.equal(publishPlan('bozuk', 60, now).action, 'invalid');
});

const fixture = (id, hoursAhead) => ({
  id, date: new Date(Date.now() + hoursAhead * H).toISOString(), league: 'LaLiga', leagueEn: 'LaLiga',
  home: { id: '83', name: 'Barcelona', color: '#a50044', color2: '#004d98', logo: '' },
  away: { id: '102', name: 'Villarreal', color: '#ffe667', color2: '#005187', logo: '' },
});

test('kuyruk: formatlar sırayla dağıtılır, aynı maç iki kez eklenmez, kalıcıdır', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mt-'));
  try {
    const a = new Automation({ root, port: 0, youtube: null, log: { log() {}, warn() {}, error() {} } });
    await a.load();
    a.kick = () => {};
    const modes = [];
    for (let i = 0; i < 5; i++) modes.push((await a.addJob({ fixture: fixture('f' + i, 24 + i), modeId: 'random', settings: { duration: 30 } })).modeId);
    assert.deepEqual(modes, ['ring', 'plinko', 'football', 'race', 'ring']);
    assert.equal((await a.addJob({ fixture: fixture('x', 30), modeId: 'race', settings: {} })).modeId, 'race');
    await assert.rejects(a.addJob({ fixture: fixture('f0', 24), modeId: 'random', settings: {} }), /zaten listede/);
    const b = new Automation({ root, port: 0, youtube: null });
    await b.load();
    assert.equal(b.state.jobs.length, 6);
    assert.equal(b.state.jobs[0].settings.duration, 30);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('YouTube: bağlanma, zamanlanmış yükleme, kapak hatası yüklemeyi bozmaz', async () => {
  const calls = [];
  const mock = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    calls.push({ m: req.method, p: u.pathname, body, auth: req.headers.authorization });
    const json = (s, o, h = {}) => { res.writeHead(s, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/token') {
      const f = new URLSearchParams(body.toString());
      return json(200, f.get('grant_type') === 'authorization_code' ? { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } : { access_token: 'A2', expires_in: 3600 });
    }
    if (u.pathname === '/yt/channels') return json(200, { items: [{ id: 'UC1', snippet: { title: 'Test Kanal' } }] });
    if (u.pathname === '/up/videos') return json(200, {}, { Location: `http://127.0.0.1:${mock.address().port}/s/1` });
    if (u.pathname === '/s/1') return json(200, { id: 'V1', status: { privacyStatus: 'private' } });
    if (u.pathname === '/up/thumbnails/set') return json(403, { error: { message: 'no thumbs', errors: [{ reason: 'forbidden' }] } });
    json(404, {});
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${mock.address().port}`;
  Object.assign(process.env, { YT_AUTH_URL: base + '/auth', YT_TOKEN_URL: base + '/token', YT_API_URL: base + '/yt', YT_UPLOAD_URL: base + '/up' });
  const { YouTube } = await import('../youtube.js?mock=' + Date.now());
  const root = await mkdtemp(path.join(os.tmpdir(), 'yt-'));
  try {
    const yt = new YouTube(path.join(root, 'data'));
    await assert.rejects(yt.saveClient({ clientId: 'kotu', clientSecret: 'x' }), /Geçersiz/);
    await yt.saveClient({ json: { installed: { client_id: '1-a.apps.googleusercontent.com', client_secret: 's' } } });
    const url = new URL(await yt.authUrl('http://localhost:3000/cb'));
    assert.equal(url.searchParams.get('access_type'), 'offline');
    await assert.rejects(yt.handleCallback({ code: 'c', state: 'sahte' }, 'http://localhost:3000/cb'), /Oturum/);
    await yt.handleCallback({ code: 'c', state: url.searchParams.get('state') }, 'http://localhost:3000/cb');
    assert.deepEqual(await yt.status(), { configured: true, connected: true, channelTitle: 'Test Kanal', channelId: 'UC1', canEdit: false });

    // Automation üzerinden: üretilmiş bir işi yükle
    const a = new Automation({ root, port: 0, youtube: yt, log: { log() {}, warn() {}, error() {} } });
    await a.load();
    a.kick = () => {};
    await a.updateSettings({ uploadMode: 'youtube', leadMinutes: 60 });
    const job = await a.addJob({ fixture: fixture('m1', 48), modeId: 'ring', settings: {} });
    job.dir = path.join(root, 'out');
    await import('node:fs/promises').then((fs) => fs.mkdir(job.dir, { recursive: true }));
    await writeFile(path.join(job.dir, 'Barcelona_vs_Villarreal.mp4'), Buffer.alloc(1234, 1));
    await writeFile(path.join(job.dir, 'Barcelona_vs_Villarreal_cover.jpg'), Buffer.alloc(99, 2));
    job.result = { score: [2, 1], modeId: 'ring', seed: 1, ext: 'mp4', title: 'T ⚽ #shorts', desc: 'D' };
    job.status = 'rendered';
    await a.tick();
    assert.equal(job.status, 'scheduled', job.error);
    assert.equal(job.youtube.id, 'V1');
    assert.equal(job.youtube.thumbnail, false);
    const init = JSON.parse(calls.find((c) => c.p === '/up/videos').body);
    assert.equal(init.status.privacyStatus, 'private');
    assert.equal(init.status.publishAt, new Date(Date.parse(job.fixture.date) - H).toISOString());
    assert.equal(init.snippet.title, 'T ⚽ #shorts');
    assert.equal(calls.find((c) => c.p === '/s/1').body.length, 1234);
    // skor başlık/açıklamada yok
    assert.ok(!/2-1/.test(init.snippet.title + init.snippet.description));
  } finally {
    mock.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('YouTube: kanal adı ilk bağlantıda alınamazsa sonradan alınır; hazır olan işte eski hata kalmaz', async () => {
  let channelOk = false;
  const mock = http.createServer(async (req, res) => {
    for await (const _ of req);
    const u = new URL(req.url, 'http://x');
    const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/token') return json(200, { access_token: 'A', refresh_token: 'R', expires_in: 3600 });
    if (u.pathname === '/yt/channels') {
      return channelOk ? json(200, { items: [{ id: 'UC9', snippet: { title: 'Kickcall' } }] })
        : json(403, { error: { message: 'YouTube Data API v3 has not been used', errors: [{ reason: 'accessNotConfigured' }] } });
    }
    json(404, {});
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${mock.address().port}`;
  Object.assign(process.env, { YT_AUTH_URL: base + '/auth', YT_TOKEN_URL: base + '/token', YT_API_URL: base + '/yt', YT_UPLOAD_URL: base + '/up' });
  const { YouTube } = await import('../youtube.js?mock2=' + Date.now());
  const root = await mkdtemp(path.join(os.tmpdir(), 'yt2-'));
  try {
    const yt = new YouTube(path.join(root, 'data'));
    await yt.saveClient({ clientId: '1-a.apps.googleusercontent.com', clientSecret: 's' });
    const url = new URL(await yt.authUrl('http://localhost:3000/cb'));
    await yt.handleCallback({ code: 'c', state: url.searchParams.get('state') }, 'http://localhost:3000/cb');
    assert.equal((await yt.status()).channelTitle, '');
    channelOk = true; // kullanıcı API'yi etkinleştirdi
    yt.lastChannelTry = 0;
    assert.equal((await yt.status()).channelTitle, 'Kickcall');

    const a = new Automation({ root, port: 0, youtube: yt, log: { log() {}, warn() {}, error() {} } });
    await a.load();
    a.kick = () => {};
    const job = await a.addJob({ fixture: fixture('m2', 30), modeId: 'ring', settings: {} });
    Object.assign(job, { status: 'rendered', error: 'eski hata', attempts: 1, result: { score: [0, 0], modeId: 'ring', seed: 1, ext: 'mp4', title: 't', desc: 'd' } });
    await a.tick(); // yükleme modu 'off' → klasörde hazır
    assert.equal(job.status, 'ready');
    assert.equal(job.error, '');
  } finally {
    mock.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('seç → format → başlat akışı: taslak üretilmez, başlatınca ayarlar alınır, geri alınabilir, çıkarılabilir', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mt3-'));
  try {
    const a = new Automation({ root, port: 0, youtube: null, log: { log() {}, warn() {}, error() {} } });
    await a.load();
    let kicked = 0;
    a.kick = () => kicked++;
    const d1 = await a.addDraft({ fixture: fixture('d1', 20) });
    const d2 = await a.addDraft({ fixture: fixture('d2', 22) });
    const d3 = await a.addDraft({ fixture: fixture('d3', 24) });
    assert.equal(d1.status, 'draft');
    assert.equal(d1.luck, 'real', 'varsayılan şans: Gerçekçi');
    await a.setLuck(d1.id, null); // ortak ayara çek
    assert.equal(kicked, 0, 'taslak eklemek üretimi tetiklememeli');
    // taslak varken worker hiçbir şey yapmamalı
    a.render = async () => assert.fail('taslak üretilmemeli');
    await a.tick();
    await a.setMode(d2.id, 'football');
    await a.removeJob(d3.id);
    assert.equal(a.state.jobs.length, 2);
    const n = await a.startDrafts({ lang: 'en', duration: 30, influence: 0.5 });
    assert.equal(n, 2);
    assert.equal(d1.status, 'queued');
    assert.equal(d1.modeId, 'ring'); // random → sıradaki format
    assert.equal(d2.modeId, 'football'); // elle seçilen korunur
    assert.deepEqual([d1.settings.lang, d1.settings.duration, d1.settings.influence], ['en', 30, 0.5]);
    await assert.rejects(a.setMode(d1.id, 'race'), /değiştirilemez/);
    await a.unstart(d1.id);
    assert.equal(d1.status, 'draft');
    await a.setMode(d1.id, 'race');
    assert.equal(d1.modeId, 'race');
    await assert.rejects(a.startDrafts({}, ['yok']), /yok/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('maç başına şans: seçilen değer başlatınca güç etkisi olur, seçilmezse ortak ayar kullanılır', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mt4-'));
  try {
    const a = new Automation({ root, port: 0, youtube: null, log: { log() {}, warn() {}, error() {} } });
    await a.load();
    a.kick = () => {};
    const d1 = await a.addDraft({ fixture: fixture('l1', 20) });
    const d2 = await a.addDraft({ fixture: fixture('l2', 21) });
    const d3 = await a.addDraft({ fixture: fixture('l3', 22) });
    await a.setLuck(d1.id, 0); // tam şans
    await a.setLuck(d2.id, 0.8);
    await a.setLuck(d3.id, 0.6);
    await a.setLuck(d3.id, null); // ortak ayara geri dön
    await a.startDrafts({ influence: 0.4 });
    assert.deepEqual([d1, d2, d3].map((j) => j.settings.influence), [0, 0.8, 0.4]);
    await assert.rejects(a.setLuck(d1.id, 0.2), /değiştirilemez/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tahmin takibi: tam skor / sonuç / ıska, ertelenen maç sayılmaz, bitmemiş maç beklenir', async () => {
  assert.equal(judge([2, 1], [2, 1]), 'exact');
  assert.equal(judge([2, 1], [3, 0]), 'outcome');
  assert.equal(judge([1, 1], [0, 0]), 'outcome');
  assert.equal(judge([2, 1], [1, 1]), 'miss');
  assert.equal(judge([0, 2], [1, 0]), 'miss');

  const root = await mkdtemp(path.join(os.tmpdir(), 'mt5-'));
  try {
    const results = {
      e1: { completed: true, statusName: 'STATUS_FULL_TIME', home: { score: 2 }, away: { score: 1 } },
      e2: { completed: true, statusName: 'STATUS_FULL_TIME', home: { score: 0 }, away: { score: 0 } },
      e3: { completed: false, statusName: 'STATUS_POSTPONED', home: { score: null }, away: { score: null } },
      e4: { completed: false, statusName: 'STATUS_SECOND_HALF', home: { score: 1 }, away: { score: 0 } },
    };
    const a = new Automation({ root, port: 0, youtube: null, log: { log() {}, warn() {}, error() {} }, getResult: async (id) => results[id] });
    await a.load();
    const past = (h) => ({ ...fixture('x', 0), date: new Date(Date.now() - h * H).toISOString() });
    const mk = async (id, score, hoursAgo) => a.addTracked({ fixture: { ...past(hoursAgo), id }, score, modeId: 'ring', seed: 1 });
    const j1 = await mk('e1', [2, 1], 3);
    const j2 = await mk('e2', [1, 0], 3);
    const j3 = await mk('e3', [1, 1], 3);
    const j4 = await mk('e4', [1, 0], 3);
    const j5 = await mk('e1', [0, 0], 1); // daha 110 dk geçmedi → kontrol edilmez
    const n = await a.checkResults();
    assert.equal(n, 3);
    assert.deepEqual([j1.verdict, j2.verdict, j3.verdict, j4.verdict, j5.verdict], ['exact', 'miss', 'void', undefined, undefined]);
    assert.deepEqual([j1.actual.home, j1.actual.away], [2, 1]);
    // elle takip edilen maç, aynı maçın kuyruğa seçilmesini engellemez
    await a.addDraft({ fixture: { ...fixture('e9', 30) } });
    await a.addTracked({ fixture: fixture('e9', 30), score: [1, 0], modeId: 'race' });
    await assert.rejects(a.addTracked({ fixture: fixture('e10', 30), score: [1, -1] }), /Geçersiz skor/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('maç sonunda açıklama güncellenir: izin yoksa beklenir, link eklenince başa sonuç + karne yazılır, ikinci kez yazılmaz', async () => {
  const videos = { VIDabc12345: { title: 'Barcelona vs Villarreal Prediction ⚽ #shorts', description: 'Who wins? 🤔\n#barcelona', categoryId: '17', tags: ['x'] } };
  const puts = [];
  let scope = 'https://www.googleapis.com/auth/youtube.upload';
  const mock = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const u = new URL(req.url, 'http://x');
    const json = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/token') return json(200, { access_token: 'A', refresh_token: 'R', expires_in: 3600, scope });
    if (u.pathname === '/yt/channels') return json(200, { items: [{ id: 'UC1', snippet: { title: 'K' } }] });
    if (u.pathname === '/yt/videos' && req.method === 'GET') {
      const v = videos[u.searchParams.get('id')];
      return json(200, { items: v ? [{ id: u.searchParams.get('id'), snippet: v }] : [] });
    }
    if (u.pathname === '/yt/videos' && req.method === 'PUT') {
      const b = JSON.parse(Buffer.concat(chunks).toString());
      puts.push(b);
      videos[b.id] = { ...videos[b.id], ...b.snippet };
      return json(200, b);
    }
    json(404, {});
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${mock.address().port}`;
  Object.assign(process.env, { YT_AUTH_URL: base + '/auth', YT_TOKEN_URL: base + '/token', YT_API_URL: base + '/yt', YT_UPLOAD_URL: base + '/up' });
  const { YouTube } = await import('../youtube.js?mock3=' + Date.now());
  const root = await mkdtemp(path.join(os.tmpdir(), 'yt3-'));
  try {
    assert.equal(parseYoutubeId('https://youtube.com/shorts/VIDabc12345?feature=share'), 'VIDabc12345');
    const yt = new YouTube(path.join(root, 'data'));
    await yt.saveClient({ clientId: '1-a.apps.googleusercontent.com', clientSecret: 's' });
    const connect = async () => {
      const url = new URL(await yt.authUrl('http://localhost:3000/cb'));
      await yt.handleCallback({ code: 'c', state: url.searchParams.get('state') }, 'http://localhost:3000/cb');
    };
    await connect();
    assert.equal((await yt.status()).canEdit, false);
    const results = { m1: { completed: true, statusName: 'STATUS_FULL_TIME', home: { score: 2 }, away: { score: 1 } } };
    const a = new Automation({ root, port: 0, youtube: yt, log: { log() {}, warn() {}, error() {} }, getResult: async (id) => results[id] });
    await a.load();
    const job = await a.addTracked({ fixture: { ...fixture('m1', 0), date: new Date(Date.now() - 3 * H).toISOString() }, score: [2, 1], modeId: 'ring', lang: 'en' });
    await a.setYoutubeLink(job.id, 'https://youtube.com/shorts/VIDabc12345');
    await a.checkResults();
    assert.equal(job.verdict, 'exact');
    assert.equal(puts.length, 0, 'düzenleme izni yokken açıklama değiştirilmemeli');
    scope += ' https://www.googleapis.com/auth/youtube.force-ssl'; // kullanıcı bağlantıyı yeniledi
    await connect();
    assert.equal((await yt.status()).canEdit, true);
    await a.updateDescriptions();
    assert.equal(puts.length, 1);
    const d = videos.VIDabc12345.description;
    assert.match(d, /^✅ NAILED IT! We predicted Barcelona 2-1 Villarreal and it finished 2-1! 🔮\n📊 Our record: 1\/1 results right \(100%\), 1 exact scores/);
    assert.match(d, /\n\nWho wins\? 🤔\n#barcelona$/, 'eski açıklama altta korunmalı');
    assert.equal(puts[0].snippet.title, 'Barcelona vs Villarreal Prediction ⚽ #shorts');
    assert.deepEqual(puts[0].snippet.tags, ['x']);
    job.youtube.descUpdated = null; // tekrar denense bile ikinci kez yazmamalı
    await a.updateDescriptions();
    assert.equal(puts.length, 1);
    await assert.rejects(a.setYoutubeLink(job.id, 'https://example.com'), /anlaşılamadı/);
  } finally {
    mock.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('silme ve "en son video geçerli": eski tahmin karneye girmez, yenisi silinince eskisi geri gelir', async () => {
  const { trackStats } = await import('../automation.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'mt6-'));
  try {
    const results = { r1: { completed: true, statusName: 'STATUS_FULL_TIME', home: { score: 0 }, away: { score: 2 } } };
    const a = new Automation({ root, port: 0, youtube: null, log: { log() {}, warn() {}, error() {} }, getResult: async (id) => results[id] });
    await a.load();
    const fx = { ...fixture('r1', 0), date: new Date(Date.now() - 3 * H).toISOString() };
    const old = await a.addTracked({ fixture: fx, score: [0, 2], modeId: 'ring' }); // eski (gerçekçi olmayan) video
    await new Promise((r) => setTimeout(r, 5));
    const neu = await a.addTracked({ fixture: fx, score: [2, 0], modeId: 'plinko' }); // yeniden üretildi
    assert.equal(old.superseded, true);
    assert.equal(neu.superseded, false);
    await a.checkResults();
    let st = trackStats(a.state.jobs);
    assert.deepEqual([st.total, st.hits], [1, 0], 'sadece en son video (2-0) sayılır → tutmadı');
    await a.removeJob(neu.id); // yeni videoyu panelden (ve kanaldan) sildi
    assert.equal(old.superseded, false, 'eskisi tekrar geçerli');
    st = trackStats(a.state.jobs);
    assert.deepEqual([st.total, st.hits, st.exact], [1, 1, 1]);
    await a.removeJob(old.id);
    assert.equal(trackStats(a.state.jobs).total, 0, 'silinen video karneden çıkar');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
