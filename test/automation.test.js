import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { publishPlan, Automation } from '../automation.js';

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
    await assert.rejects(a.addJob({ fixture: fixture('f0', 24), modeId: 'random', settings: {} }), /zaten kuyrukta/);
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
    assert.deepEqual(await yt.status(), { configured: true, connected: true, channelTitle: 'Test Kanal', channelId: 'UC1' });

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
