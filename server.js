// Basit, bağımlılıksız sunucu: statik dosyalar + takım/fikstür/güç verisi + otomatik kuyruk + YouTube.
//  GET  /api/competitions            → desteklenen ligler/turnuvalar
//  GET  /api/teams?q=barc            → takım arama (açılır liste için)
//  GET  /api/fixtures?date=YYYY-MM-DD&comps=tur.1,eng.1 → o günün maçları
//  GET  /api/elo?id=83&national=0    → güç puanı (ClubElo / eloratings / puan durumu)
//  GET  /api/img?u=<url>             → logo görselini aynı kökenden sunar (video kaydı için şart)
//  GET  /api/queue                   → otomatik kuyruk + YouTube durumu
//  POST /api/queue                   → maçı kuyruğa ekle
//  ...  /auth/youtube                → Google ile bağlan
// Sunucu sadece bu bilgisayardan erişilebilir (ağdaki diğer cihazlardan gelen istekler reddedilir).
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPETITIONS, searchTeams, fixtures, findElo, fetchWithTimeout, teamIndex, matchResult } from './data.js';
import { YouTube } from './youtube.js';
import { Automation } from './automation.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const MUSIC = path.join(ROOT, 'music');
const SOUNDS = path.join(ROOT, 'sounds');
const MUSIC_EXT = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const PORT = Number(process.env.PORT) || 3000;
const IMG_HOSTS = ['a.espncdn.com', 'thesportsdb.com'];
const REDIRECT = `http://localhost:${PORT}/auth/youtube/callback`;

const youtube = new YouTube(path.join(ROOT, 'data'));
const automation = new Automation({ root: ROOT, port: PORT, youtube, getResult: matchResult });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('İstek çok büyük'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function proxyImage(u, res) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return send(res, 400, { error: 'Geçersiz adres' });
  }
  // Açık proxy olmasın: sadece bilinen logo sunucuları
  const ok = url.protocol === 'https:' && IMG_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
  if (!ok) return send(res, 403, { error: 'Bu kaynağa izin yok' });
  const r = await fetchWithTimeout(url.href);
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) return send(res, 502, { error: 'Görsel alınamadı' });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) return send(res, 413, { error: 'Görsel çok büyük' });
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
  res.end(buf);
}

function openFolder(dir) {
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

async function queueState() {
  return { ...automation.publicState(), youtube: await youtube.status() };
}

async function handleApi(req, res, url, q) {
  const m = req.method;
  const p = url.pathname;
  // Değişiklik yapan istekler sadece kendi sayfamızdan (başka siteler bu başlığı ekleyemez)
  if (m !== 'GET' && req.headers['x-requested-with'] !== 'mac-tahmin') return send(res, 403, { error: 'İzin yok' });

  if (p === '/api/competitions') return send(res, 200, { competitions: COMPETITIONS.map(({ base, ...c }) => c) });
  if (p === '/api/teams') {
    if (!q('q')) return send(res, 200, { teams: [] });
    return send(res, 200, { teams: await searchTeams(q('q'), Math.min(30, +q('limit') || 12)) });
  }
  if (p === '/api/fixtures') {
    const comps = q('comps') ? q('comps').split(',') : undefined;
    return send(res, 200, await fixtures(q('date') || new Date().toISOString().slice(0, 10), comps));
  }
  if (p === '/api/elo') {
    const nat = q('national');
    const hit = await findElo({ id: q('id') || null, name: q('name'), national: nat === '' ? undefined : nat === '1' || nat === 'true' });
    return hit ? send(res, 200, hit) : send(res, 404, { error: 'Güç puanı bulunamadı' });
  }
  if (p === '/api/img') return proxyImage(q('u'), res);
  if (p === '/api/sounds') {
    let files = [];
    try {
      files = (await readdir(SOUNDS)).filter((f) => /^(gol|goal)/i.test(f) && MUSIC_EXT[path.extname(f).toLowerCase()]).sort();
    } catch { /* klasör yok */ }
    return send(res, 200, { goal: files.map((f) => '/sounds/' + encodeURIComponent(f)) });
  }
  if (p === '/api/music') {
    let files = [];
    try {
      files = (await readdir(MUSIC)).filter((f) => MUSIC_EXT[path.extname(f).toLowerCase()]).sort();
    } catch { /* klasör yok */ }
    return send(res, 200, { files: files.map((f) => ({ name: f, url: '/music/' + encodeURIComponent(f) })) });
  }

  // ---- kuyruk
  if (p === '/api/queue' && m === 'GET') return send(res, 200, await queueState());
  if (p === '/api/queue' && m === 'POST') {
    const job = await automation.addDraft(await readJson(req));
    return send(res, 200, { job });
  }
  if (p === '/api/queue/tracked' && m === 'POST') {
    const job = await automation.addTracked(await readJson(req));
    return send(res, 200, { job });
  }
  if (p === '/api/queue/check-results' && m === 'POST') {
    const n = await automation.checkResults();
    return send(res, 200, { updated: n });
  }
  if (p === '/api/queue/start' && m === 'POST') {
    const b = await readJson(req);
    const n = await automation.startDrafts(b.settings, Array.isArray(b.ids) ? b.ids : null);
    return send(res, 200, { started: n });
  }
  if (p === '/api/queue/settings' && m === 'POST') {
    await automation.updateSettings(await readJson(req));
    return send(res, 200, await queueState());
  }
  let mm = p.match(/^\/api\/queue\/([a-f0-9]+)(?:\/(retry|open|mode|luck|unstart))?$/);
  if (mm) {
    const [, id, action] = mm;
    if (m === 'DELETE' && !action) {
      await automation.removeJob(id);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && action === 'mode') {
      await automation.setMode(id, (await readJson(req)).modeId);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && action === 'luck') {
      await automation.setLuck(id, (await readJson(req)).luck);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && action === 'unstart') {
      await automation.unstart(id);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && action === 'retry') {
      await automation.retryJob(id);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && action === 'open') {
      const job = automation.getJob(id);
      if (!job?.dir) return send(res, 404, { error: 'Klasör henüz yok' });
      openFolder(job.dir);
      return send(res, 200, { ok: true });
    }
  }

  // ---- görünmez üretici sayfanın uçları
  mm = p.match(/^\/api\/jobs\/([a-f0-9]+)(?:\/(files\/[\w.]+|rendered|error))?$/);
  if (mm) {
    const job = automation.getJob(mm[1]);
    if (!job) return send(res, 404, { error: 'İş bulunamadı' });
    const action = mm[2];
    if (!action && m === 'GET') return send(res, 200, job);
    if (action?.startsWith('files/') && m === 'PUT') {
      const name = await automation.saveFile(job, action.slice(6), req);
      return send(res, 200, { name });
    }
    if (action === 'rendered' && m === 'POST') {
      automation.rendered(job.id, await readJson(req));
      return send(res, 200, { ok: true });
    }
    if (action === 'error' && m === 'POST') {
      automation.failed(job.id, (await readJson(req)).message);
      return send(res, 200, { ok: true });
    }
  }

  // ---- YouTube
  if (p === '/api/youtube/client' && m === 'POST') {
    await youtube.saveClient(await readJson(req));
    return send(res, 200, await youtube.status());
  }
  if (p === '/api/youtube/disconnect' && m === 'POST') {
    await youtube.disconnect();
    return send(res, 200, await youtube.status());
  }
  return send(res, 404, { error: 'Bulunamadı' });
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const server = http.createServer(async (req, res) => {
  if (!LOOPBACK.has(req.socket.remoteAddress)) return send(res, 403, 'Sadece bu bilgisayardan erişilebilir', 'text/plain');
  const url = new URL(req.url, 'http://localhost');
  const q = (k) => (url.searchParams.get(k) || '').trim();
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url, q);
    if (url.pathname === '/auth/youtube') {
      res.writeHead(302, { Location: await youtube.authUrl(REDIRECT) });
      return res.end();
    }
    if (url.pathname === '/auth/youtube/callback') {
      try {
        await youtube.handleCallback({ code: q('code'), state: q('state'), error: q('error') }, REDIRECT);
        res.writeHead(302, { Location: '/?youtube=ok' });
      } catch (e) {
        res.writeHead(302, { Location: '/?youtube=' + encodeURIComponent(e.message) });
      }
      return res.end();
    }

    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/music/') || p.startsWith('/sounds/')) {
      const dir = p.startsWith('/music/') ? MUSIC : SOUNDS;
      const f = path.normalize(path.join(dir, p.slice(p.indexOf('/', 1) + 1)));
      const type = MUSIC_EXT[path.extname(f).toLowerCase()];
      if (!f.startsWith(dir + path.sep) || !type) return send(res, 403, 'Yasak', 'text/plain');
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(await readFile(f));
    }
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Yasak', 'text/plain');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return send(res, 404, 'Bulunamadı', 'text/plain');
    if (e instanceof SyntaxError) return send(res, 400, { error: 'Geçersiz JSON' });
    console.error('[hata]', url.pathname, e.message);
    send(res, e.status || (url.pathname.startsWith('/api/queue') ? 400 : 502), { error: e.name === 'AbortError' ? 'Zaman aşımı' : e.message });
  }
});

await automation.load();
server.listen(PORT, () => {
  console.log(`\n⚽ Maç Tahmin aracı hazır: http://localhost:${PORT}\n`);
  automation.start();
  // Takım listesini arka planda ısıt; internet sorunu varsa hemen görünsün
  teamIndex()
    .then((all) => console.log(`✓ ${all.length} takım yüklendi (ESPN)`))
    .catch((e) => console.warn(`✗ Takım listesi alınamadı: ${e.message} — internet bağlantını kontrol et`));
});
