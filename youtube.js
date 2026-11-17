// YouTube Data API v3: OAuth bağlantısı + zamanlanmış video yükleme.
// Kimlik bilgileri sadece bu bilgisayarda, data/ klasöründe saklanır.
//
// ÖNEMLİ: Google, denetimden (audit) geçmemiş API projelerinden yüklenen videoları
// "özel" olarak kilitler. Otomatik yayın için projenin denetim onayı gerekir (README'de anlatılıyor).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const URLS = {
  auth: process.env.YT_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
  token: process.env.YT_TOKEN_URL || 'https://oauth2.googleapis.com/token',
  api: process.env.YT_API_URL || 'https://www.googleapis.com/youtube/v3',
  upload: process.env.YT_UPLOAD_URL || 'https://www.googleapis.com/upload/youtube/v3',
};
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

export class YouTube {
  constructor(dataDir) {
    this.dir = dataDir;
    this.clientFile = path.join(dataDir, 'youtube-client.json');
    this.tokenFile = path.join(dataDir, 'youtube-token.json');
    this.states = new Map(); // OAuth CSRF koruması
  }

  async readJson(f) {
    try {
      return JSON.parse(await readFile(f, 'utf8'));
    } catch {
      return null;
    }
  }

  async writeJson(f, v) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(f, JSON.stringify(v, null, 2));
  }

  // Google Cloud'dan indirilen client_secret JSON'u ya da {clientId, clientSecret}
  async saveClient(input) {
    let id = input.clientId;
    let secret = input.clientSecret;
    const j = input.json ? (typeof input.json === 'string' ? JSON.parse(input.json) : input.json) : null;
    if (j) {
      const c = j.installed || j.web || j;
      id = c.client_id;
      secret = c.client_secret;
    }
    id = String(id || '').trim();
    secret = String(secret || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id) || !secret) throw new Error('Geçersiz OAuth istemci bilgisi (Client ID ...apps.googleusercontent.com ile bitmeli)');
    await this.writeJson(this.clientFile, { clientId: id, clientSecret: secret });
    await rm(this.tokenFile, { force: true });
  }

  async status() {
    const client = await this.readJson(this.clientFile);
    let token = await this.readJson(this.tokenFile);
    // Kanal adı ilk bağlantıda alınamadıysa (ör. API henüz etkin değildi) dakikada bir tekrar dene
    if (token?.refresh_token && !token.channelTitle && Date.now() - (this.lastChannelTry || 0) > 60_000) {
      this.lastChannelTry = Date.now();
      try {
        await this.refreshChannel();
        token = await this.readJson(this.tokenFile);
      } catch { /* sonra tekrar denenir */ }
    }
    return {
      configured: !!client,
      connected: !!token?.refresh_token,
      channelTitle: token?.channelTitle || '',
      channelId: token?.channelId || '',
    };
  }

  async authUrl(redirectUri) {
    const client = await this.readJson(this.clientFile);
    if (!client) throw new Error('Önce OAuth istemci bilgilerini kaydet');
    const state = crypto.randomBytes(16).toString('hex');
    this.states.set(state, Date.now());
    const p = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${URLS.auth}?${p}`;
  }

  async handleCallback({ code, state, error }, redirectUri) {
    if (error) throw new Error(`Google izin vermedi: ${error}`);
    const t = this.states.get(state);
    this.states.delete(state);
    if (!t || Date.now() - t > 15 * 60_000) throw new Error('Oturum süresi doldu, tekrar bağlan');
    const client = await this.readJson(this.clientFile);
    const r = await fetch(URLS.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: client.clientId, client_secret: client.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) throw new Error(`Token alınamadı: ${j.error_description || j.error || r.status}`);
    const token = { refresh_token: j.refresh_token, access_token: j.access_token, expiry: Date.now() + (j.expires_in - 60) * 1000 };
    await this.writeJson(this.tokenFile, token);
    try {
      await this.refreshChannel();
    } catch (e) {
      console.warn('[youtube] kanal bilgisi alınamadı:', e.message);
    }
  }

  // Hangi kanala bağlandığını göster (yanlış kanala yüklemeyi önlemek için)
  async refreshChannel() {
    const ch = await this.api('GET', '/channels?part=snippet&mine=true');
    const c = ch.items?.[0];
    if (!c) throw new Error('Bu hesapta YouTube kanalı bulunamadı');
    const token = await this.readJson(this.tokenFile);
    await this.writeJson(this.tokenFile, { ...token, channelTitle: c.snippet?.title || '', channelId: c.id });
  }

  async disconnect() {
    await rm(this.tokenFile, { force: true });
  }

  async accessToken() {
    const token = await this.readJson(this.tokenFile);
    if (!token?.refresh_token) throw new Error('YouTube bağlı değil');
    if (token.access_token && token.expiry > Date.now()) return token.access_token;
    const client = await this.readJson(this.clientFile);
    const r = await fetch(URLS.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: token.refresh_token, client_id: client.clientId, client_secret: client.clientSecret, grant_type: 'refresh_token' }),
    });
    const j = await r.json();
    if (!r.ok) {
      if (j.error === 'invalid_grant') {
        await this.disconnect();
        throw new Error('YouTube izni geçersiz/süresi dolmuş — panelden tekrar bağlan (uygulamayı "Production" yapmayı unutma)');
      }
      throw new Error(`Token yenilenemedi: ${j.error_description || j.error || r.status}`);
    }
    const next = { ...token, access_token: j.access_token, expiry: Date.now() + (j.expires_in - 60) * 1000 };
    await this.writeJson(this.tokenFile, next);
    return next.access_token;
  }

  async api(method, p, body) {
    const at = await this.accessToken();
    const r = await fetch(URLS.api + p, {
      method,
      headers: { Authorization: `Bearer ${at}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(apiError(j, r.status));
    return j;
  }

  /**
   * Videoyu yükler. publishAt verilirse "özel + zamanlanmış" yüklenir ve YouTube o saatte
   * kendisi yayınlar (bilgisayarın açık olması gerekmez). Verilmezse hemen herkese açık olur.
   */
  async uploadVideo({ file, title, description, tags = [], publishAt = null, categoryId = '17' }) {
    const at = await this.accessToken();
    const data = await readFile(file);
    const type = file.endsWith('.webm') ? 'video/webm' : 'video/mp4';
    const meta = {
      snippet: { title: cut(title, 100), description: cut(description, 4900), tags: fitTags(tags), categoryId },
      status: publishAt
        ? { privacyStatus: 'private', publishAt: new Date(publishAt).toISOString(), selfDeclaredMadeForKids: false }
        : { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    };
    const init = await fetch(`${URLS.upload}/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${at}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': type,
        'X-Upload-Content-Length': String(data.length),
      },
      body: JSON.stringify(meta),
    });
    if (!init.ok) throw new Error(apiError(await init.json().catch(() => ({})), init.status));
    const loc = init.headers.get('location');
    if (!loc) throw new Error('Yükleme adresi alınamadı');
    const put = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': String(data.length) }, body: data });
    const j = await put.json().catch(() => ({}));
    if (!put.ok || !j.id) throw new Error(apiError(j, put.status));
    return { id: j.id, privacyStatus: j.status?.privacyStatus, publishAt: j.status?.publishAt || null };
  }

  // Kapak: telefon doğrulaması yapılmış kanallarda çalışır; Shorts'ta YouTube kullanmayabilir.
  async setThumbnail(videoId, jpgFile) {
    const at = await this.accessToken();
    const data = await readFile(jpgFile);
    const r = await fetch(`${URLS.upload}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'image/jpeg', 'Content-Length': String(data.length) },
      body: data,
    });
    if (!r.ok) throw new Error(apiError(await r.json().catch(() => ({})), r.status));
  }
}

function cut(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// YouTube etiketlerinin toplamı ~500 karakteri geçmemeli
function fitTags(tags) {
  const out = [];
  let len = 0;
  for (const t of tags.map((x) => String(x).replace(/[<>]/g, '').trim()).filter(Boolean)) {
    if (len + t.length + 3 > 480) break;
    out.push(t);
    len += t.length + 3;
  }
  return out;
}

function apiError(j, status) {
  const e = j?.error;
  const reason = e?.errors?.[0]?.reason || e?.status || '';
  const msg = e?.message || j?.error_description || `HTTP ${status}`;
  if (reason === 'quotaExceeded') return 'YouTube günlük API kotası doldu (yarın tekrar denenecek)';
  if (reason === 'uploadLimitExceeded') return 'YouTube yükleme sınırı aşıldı';
  if (reason === 'youtubeSignupRequired') return 'Bu Google hesabının YouTube kanalı yok';
  return `${msg}${reason ? ` (${reason})` : ''}`;
}
