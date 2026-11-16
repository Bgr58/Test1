// Basit, bağımlılıksız sunucu: statik dosyalar + takım/fikstür/güç verisi.
//  GET /api/competitions            → desteklenen ligler/turnuvalar
//  GET /api/teams?q=barc            → takım arama (açılır liste için)
//  GET /api/fixtures?date=2026-11-22&comps=tur.1,eng.1 → o günün maçları
//  GET /api/elo?id=83&national=0    → güç puanı (ClubElo / eloratings / puan durumu)
//  GET /api/img?u=<url>             → logo görselini aynı kökenden sunar (video kaydı için şart)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPETITIONS, searchTeams, fixtures, findElo, fetchWithTimeout, teamIndex } from './data.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const IMG_HOSTS = ['a.espncdn.com', 'thesportsdb.com'];

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const q = (k) => (url.searchParams.get(k) || '').trim();
  try {
    if (url.pathname === '/api/competitions') return send(res, 200, { competitions: COMPETITIONS.map(({ base, ...c }) => c) });
    if (url.pathname === '/api/teams') {
      if (!q('q')) return send(res, 200, { teams: [] });
      return send(res, 200, { teams: await searchTeams(q('q'), Math.min(30, +q('limit') || 12)) });
    }
    if (url.pathname === '/api/fixtures') {
      const comps = q('comps') ? q('comps').split(',') : undefined;
      return send(res, 200, await fixtures(q('date') || new Date().toISOString().slice(0, 10), comps));
    }
    if (url.pathname === '/api/elo') {
      const nat = q('national');
      const hit = await findElo({ id: q('id') || null, name: q('name'), national: nat === '' ? undefined : nat === '1' || nat === 'true' });
      return hit ? send(res, 200, hit) : send(res, 404, { error: 'Güç puanı bulunamadı' });
    }
    if (url.pathname === '/api/img') return await proxyImage(q('u'), res);

    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Yasak', 'text/plain');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return send(res, 404, 'Bulunamadı', 'text/plain');
    console.error('[hata]', url.pathname, e.message);
    send(res, 502, { error: e.name === 'AbortError' ? 'Zaman aşımı' : e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n⚽ Maç Tahmin aracı hazır: http://localhost:${PORT}\n`);
  // Takım listesini arka planda ısıt; internet sorunu varsa hemen görünsün
  teamIndex()
    .then((all) => console.log(`✓ ${all.length} takım yüklendi (ESPN)`))
    .catch((e) => console.warn(`✗ Takım listesi alınamadı: ${e.message} — internet bağlantını kontrol et`));
});
