// Basit, bağımlılıksız sunucu: statik dosyalar + takım verisi proxy'si.
//  GET /api/team?name=Barcelona   → TheSportsDB'den logo + renk adayları
//  GET /api/elo?name=Barcelona    → ClubElo'dan güncel Elo puanı (yoksa yaklaşık yedek tablo)
//  GET /api/img?u=<url>           → logo görselini aynı kökenden sunar (canvas kaydı için şart)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchClub, parseClubEloCsv, fallbackList } from './public/js/strength.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const SPORTSDB_KEY = process.env.SPORTSDB_KEY || '3'; // TheSportsDB ücretsiz test anahtarı
const TIMEOUT = 10_000;

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

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': 'mac-tahmin-shorts/1.0', ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

// --- TheSportsDB ---------------------------------------------------------
async function searchTeams(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`TheSportsDB ${r.status}`);
  const j = await r.json();
  const teams = (j.teams || []).filter((t) => !t.strSport || t.strSport === 'Soccer');
  return teams.slice(0, 8).map((t) => {
    const badge = t.strBadge || t.strTeamBadge || t.strLogo || '';
    return {
      id: t.idTeam,
      name: t.strTeam,
      short: t.strTeamShort || '',
      league: t.strLeague || '',
      country: t.strCountry || '',
      colors: [t.strColour1, t.strColour2, t.strColour3].filter((c) => /^#?[0-9a-f]{6}$/i.test(c || '')).map((c) => (c.startsWith('#') ? c : '#' + c)),
      badge: badge ? `/api/img?u=${encodeURIComponent(badge)}` : '',
    };
  });
}

async function proxyImage(u, res) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return send(res, 400, { error: 'Geçersiz adres' });
  }
  // Açık proxy olmasın: sadece TheSportsDB görselleri
  if (url.protocol !== 'https:' || !(url.hostname === 'thesportsdb.com' || url.hostname.endsWith('.thesportsdb.com'))) {
    return send(res, 403, { error: 'Bu kaynağa izin yok' });
  }
  const r = await fetchWithTimeout(url.href);
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) return send(res, 502, { error: 'Görsel alınamadı' });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) return send(res, 413, { error: 'Görsel çok büyük' });
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
  res.end(buf);
}

// --- ClubElo -------------------------------------------------------------
let eloCache = { at: 0, list: null };
async function eloList() {
  if (eloCache.list && Date.now() - eloCache.at < 6 * 3600_000) return eloCache.list;
  const day = new Date().toISOString().slice(0, 10);
  const r = await fetchWithTimeout(`http://api.clubelo.com/${day}`);
  if (!r.ok) throw new Error(`ClubElo ${r.status}`);
  const list = parseClubEloCsv(await r.text());
  if (!list.length) throw new Error('ClubElo boş yanıt');
  eloCache = { at: Date.now(), list };
  return list;
}

async function findElo(name) {
  try {
    const hit = matchClub(name, await eloList());
    if (hit) return { club: hit.club, elo: hit.elo, country: hit.country, source: 'ClubElo' };
  } catch (e) {
    console.warn('[elo]', e.message);
  }
  const fb = matchClub(name, fallbackList());
  if (fb) return { club: fb.club, elo: fb.elo, source: 'yaklaşık (çevrimdışı tablo)' };
  return null;
}

// --- HTTP ----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/team') {
      const name = (url.searchParams.get('name') || '').trim();
      if (!name) return send(res, 400, { error: 'name gerekli' });
      return send(res, 200, { teams: await searchTeams(name) });
    }
    if (url.pathname === '/api/elo') {
      const name = (url.searchParams.get('name') || '').trim();
      if (!name) return send(res, 400, { error: 'name gerekli' });
      const hit = await findElo(name);
      return hit ? send(res, 200, hit) : send(res, 404, { error: 'Takım Elo listesinde bulunamadı' });
    }
    if (url.pathname === '/api/img') return await proxyImage(url.searchParams.get('u') || '', res);

    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Yasak', 'text/plain');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return send(res, 404, 'Bulunamadı', 'text/plain');
    console.error(e);
    send(res, 502, { error: e.name === 'AbortError' ? 'Zaman aşımı' : e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n⚽ Maç Tahmin aracı hazır: http://localhost:${PORT}\n`);
});
