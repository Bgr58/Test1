// Otomatik kuyruk: seçilen maçların videolarını arka planda (görünmez tarayıcıda) üretir,
// output/ klasörüne kaydeder ve YouTube bağlıysa maç saatinden önce yayına girecek şekilde zamanlar.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeTexts } from './public/js/i18n.js';

const MODES = ['ring', 'plinko', 'football', 'race'];
const MAX_ATTEMPTS = 3;
const RETRY_MS = 3 * 60_000;

export const DEFAULT_SETTINGS = {
  uploadMode: 'off', // 'off' = sadece üret (klasöre), 'youtube' = otomatik yükle
  leadMinutes: 60, // maç saatinden kaç dakika önce yayına girsin
  autoDesc: true, // maç sonunda YouTube açıklamasının başına sonucu ekle
};

// Tahmin karnesi (ertelenenler sayılmaz)
export function trackStats(jobs) {
  const judged = jobs.filter((j) => ['exact', 'outcome', 'miss'].includes(j.verdict));
  const total = judged.length;
  const exact = judged.filter((j) => j.verdict === 'exact').length;
  const hits = exact + judged.filter((j) => j.verdict === 'outcome').length;
  return { total, hits, exact, pct: total ? Math.round((100 * hits) / total) : 0 };
}

// Maç sonu metni (📋 paylaşım metni ve açıklama başı aynı): sonuç satırı + karne satırı
export function resultLines(job, stats) {
  const T = makeTexts(job.settings?.lang || 'en', job.settings?.overrides || {});
  const f = job.fixture;
  const vars = { home: f.home.name, away: f.away.name, pred: job.result.score.join('-'), final: `${job.actual.home}-${job.actual.away}` };
  const key = { exact: 'postExact', outcome: 'postOutcome', miss: 'postMiss' }[job.verdict];
  return [T.t(key, vars), T.t('postRecord', { hits: stats.hits, total: stats.total, pct: stats.pct, exact: stats.exact })];
}

// YouTube linkinden video kimliği (shorts/ID, watch?v=ID, youtu.be/ID ya da sadece ID)
export function parseYoutubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const slug = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24) || 'takim';

// Tahmin tuttu mu? (saf fonksiyon) → 'exact' tam skor, 'outcome' sadece 1/X/2, 'miss' tutmadı
export function judge(pred, actual) {
  const [ph, pa] = pred;
  const [ah, aa] = actual;
  if (ph === ah && pa === aa) return 'exact';
  return Math.sign(ph - pa) === Math.sign(ah - aa) ? 'outcome' : 'miss';
}

const VOID_STATUS = /POSTPONED|CANCEL|ABANDON|SUSPEND|FORFEIT|DELAYED/;

// Yayın zamanı kararı (saf fonksiyon; test edilir)
//  - maç başlamışsa: kaçırıldı
//  - yayın saati çok yakın/geçmişse: hemen yayınla
//  - değilse: o saate zamanla
export function publishPlan(kickoffIso, leadMinutes, now = Date.now()) {
  const kickoff = new Date(kickoffIso).getTime();
  if (!Number.isFinite(kickoff)) return { action: 'invalid' };
  if (kickoff <= now) return { action: 'missed' };
  const at = kickoff - leadMinutes * 60_000;
  // YouTube publishAt için birkaç dakikalık pay bırak
  if (at <= now + 10 * 60_000) return { action: 'now', publishAt: null };
  return { action: 'schedule', publishAt: new Date(at).toISOString() };
}

export class Automation {
  constructor({ root, port, youtube, log = console, getResult = null }) {
    this.getResult = getResult; // maç sonucu çekici (data.js matchResult)
    this.root = root;
    this.port = port;
    this.yt = youtube;
    this.log = log;
    this.dataDir = path.join(root, 'data');
    this.outDir = path.join(root, 'output');
    this.file = path.join(this.dataDir, 'queue.json');
    this.state = { jobs: [], rotation: 0, settings: { ...DEFAULT_SETTINGS } };
    this.busy = false;
    this.waiters = new Map(); // jobId -> {resolve, reject}
    this.timer = null;
  }

  async load() {
    try {
      const j = JSON.parse(await readFile(this.file, 'utf8'));
      this.state = { ...this.state, ...j, settings: { ...DEFAULT_SETTINGS, ...(j.settings || {}) } };
    } catch {
      /* ilk çalıştırma */
    }
    // yarıda kalan işler (bilgisayar kapanmış olabilir) tekrar sıraya
    for (const j of this.state.jobs) {
      if (j.status === 'rendering') j.status = 'queued';
      if (j.status === 'uploading') j.status = 'rendered';
    }
    await this.save();
  }

  async save() {
    await mkdir(this.dataDir, { recursive: true });
    const tmp = this.file + '.tmp';
    await writeFile(tmp, JSON.stringify(this.state, null, 2));
    await rename(tmp, this.file);
  }

  start(intervalMs = 15_000) {
    const tick = () => this.tick().catch((e) => this.log.error('[kuyruk]', e));
    this.timer = setInterval(tick, intervalMs);
    setTimeout(tick, 2000);
    // tahmin takibi: biten maçların sonucunu 5 dakikada bir kontrol et
    const check = () => this.checkResults().catch((e) => this.log.warn('[sonuç takibi]', e.message));
    this.resultTimer = setInterval(check, 5 * 60_000);
    setTimeout(check, 5000);
  }

  stop() {
    clearInterval(this.timer);
    clearInterval(this.resultTimer);
  }

  // ------------------------------------------------------------ tahmin takibi
  // Maç bitince gerçek skoru alıp tahminle karşılaştırır. Ertelenen/iptal maçlar 'void' (sayılmaz).
  async checkResults(now = Date.now()) {
    if (!this.getResult) return 0;
    const due = this.state.jobs.filter(
      (j) => j.result?.score && !j.verdict && new Date(j.fixture.date).getTime() + 110 * 60_000 <= now,
    );
    let changed = 0;
    for (const j of due) {
      let r;
      try {
        r = await this.getResult(j.fixture.id);
      } catch (e) {
        this.log.warn(`[sonuç takibi] ${j.fixture.home.name}-${j.fixture.away.name}: ${e.message}`);
        continue;
      }
      const tooOld = now - new Date(j.fixture.date).getTime() > 4 * 24 * 3600_000;
      if (VOID_STATUS.test(r.statusName) || (tooOld && !r.completed)) {
        j.verdict = 'void';
        j.actual = { statusName: r.statusName, checkedAt: new Date(now).toISOString() };
        changed++;
      } else if (r.completed && Number.isFinite(r.home.score) && Number.isFinite(r.away.score)) {
        j.actual = { home: r.home.score, away: r.away.score, statusName: r.statusName, checkedAt: new Date(now).toISOString() };
        j.verdict = judge(j.result.score, [r.home.score, r.away.score]);
        changed++;
        this.log.log(`✓ Sonuç: ${j.fixture.home.name} ${r.home.score}-${r.away.score} ${j.fixture.away.name} · tahmin ${j.result.score.join('-')} → ${j.verdict}`);
      }
    }
    if (changed) await this.save();
    await this.updateDescriptions(now);
    return changed;
  }

  // Sonucu belli olan ve YouTube linki bilinen videoların açıklamasının başına sonucu ekle
  async updateDescriptions(now = Date.now()) {
    if (!this.state.settings.autoDesc || !this.yt) return 0;
    const due = this.state.jobs.filter(
      (j) => ['exact', 'outcome', 'miss'].includes(j.verdict) && j.youtube?.id && !j.youtube.descUpdated
        && (j.youtube.descTries || 0) < 3 && (j.youtube.descNextTry || 0) <= now,
    );
    if (!due.length) return 0;
    const st = await this.yt.status();
    if (!st.connected || !st.canEdit) return 0; // panel "bağlantıyı yenile" uyarısı gösterir
    const stats = trackStats(this.state.jobs);
    let n = 0;
    for (const j of due) {
      const lines = resultLines(j, stats);
      try {
        await this.yt.updateDescription(j.youtube.id, (old) => (old.startsWith(lines[0]) ? old : `${lines.join('\n')}\n\n${old}`));
        j.youtube.descUpdated = new Date(now).toISOString();
        j.youtube.descError = '';
        n++;
        this.log.log(`✓ Açıklama güncellendi: ${j.fixture.home.name}-${j.fixture.away.name}`);
      } catch (e) {
        j.youtube.descTries = (j.youtube.descTries || 0) + 1;
        j.youtube.descNextTry = now + 30 * 60_000;
        j.youtube.descError = e.message;
        this.log.warn(`[açıklama] ${j.fixture.home.name}-${j.fixture.away.name}: ${e.message}`);
      }
    }
    await this.save();
    return n;
  }

  // Elle yüklenen videonun linkini maça bağla (maç sonunda açıklaması otomatik güncellensin)
  async setYoutubeLink(id, url) {
    const j = this.getJob(id);
    if (!j) throw new Error('Maç bulunamadı');
    if (!url) {
      if (j.youtube && !j.youtube.uploadedAt) j.youtube = null;
      await this.save();
      return j;
    }
    const vid = parseYoutubeId(url);
    if (!vid) throw new Error('YouTube linki anlaşılamadı (ör. https://youtube.com/shorts/XXXXXXXXXXX)');
    j.youtube = { ...(j.youtube || {}), id: vid, url: `https://youtube.com/shorts/${vid}`, linked: true, descTries: 0, descError: '' };
    await this.save();
    this.updateDescriptions().catch((e) => this.log.warn('[açıklama]', e.message));
    return j;
  }

  // Panelden elle kaydedilen (takvimden seçilmiş) videoyu da takibe al
  async addTracked({ fixture, score, modeId, seed, lang }) {
    if (!fixture?.id || !fixture.home?.name || !fixture.away?.name || !fixture.date) throw new Error('Eksik maç bilgisi');
    if (!Array.isArray(score) || score.length !== 2 || !score.every((x) => Number.isInteger(x) && x >= 0)) throw new Error('Geçersiz skor');
    const pick = (t) => ({ id: t.id, name: t.name, logo: t.logo || '' });
    const job = {
      id: crypto.randomBytes(6).toString('hex'),
      createdAt: new Date().toISOString(),
      fixture: {
        id: String(fixture.id), date: fixture.date, league: fixture.league, leagueEn: fixture.leagueEn || fixture.league,
        national: !!fixture.national, home: pick(fixture.home), away: pick(fixture.away), tz: fixture.tz || null, leagueTag: fixture.leagueTag || '',
      },
      modeId: MODES.includes(modeId) ? modeId : 'ring',
      luck: null,
      settings: { lang: typeof lang === 'string' ? lang : 'en' },
      status: 'manual',
      attempts: 0,
      error: '',
      result: { score, modeId, seed: seed ?? null, manual: true },
      youtube: null,
    };
    this.state.jobs.push(job);
    this.state.jobs.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date));
    await this.save();
    return job;
  }

  publicState() {
    return { jobs: this.state.jobs, settings: this.state.settings };
  }

  async updateSettings(s) {
    const next = { ...this.state.settings };
    if (s.uploadMode === 'off' || s.uploadMode === 'youtube') next.uploadMode = s.uploadMode;
    if (Number.isFinite(+s.leadMinutes)) next.leadMinutes = Math.max(0, Math.min(24 * 60, Math.round(+s.leadMinutes)));
    if (typeof s.autoDesc === 'boolean') next.autoDesc = s.autoDesc;
    this.state.settings = next;
    // YouTube'a geçildiyse: klasörde bekleyen (henüz başlamamış maçların) videolarını da yükle
    if (next.uploadMode === 'youtube') {
      for (const j of this.state.jobs) if (j.status === 'ready' && new Date(j.fixture.date) > Date.now()) j.status = 'rendered';
    }
    await this.save();
    this.kick();
  }

  getJob(id) {
    return this.state.jobs.find((j) => j.id === id);
  }

  // 1) Seç: maç "taslak" olarak eklenir; üretim başlamaz
  async addDraft({ fixture, modeId }) {
    if (!fixture?.id || !fixture.home?.name || !fixture.away?.name || !fixture.date) throw new Error('Eksik maç bilgisi');
    const dup = this.state.jobs.find((j) => j.fixture.id === String(fixture.id) && j.status !== 'failed' && j.status !== 'manual');
    if (dup) throw new Error('Bu maç zaten listede');
    const pick = (t) => ({
      id: t.id, name: t.name, color: t.color, color2: t.color2, logo: t.logo, knownColors: !!t.knownColors, national: !!fixture.national,
    });
    const job = {
      id: crypto.randomBytes(6).toString('hex'),
      createdAt: new Date().toISOString(),
      fixture: {
        id: String(fixture.id), date: fixture.date, league: fixture.league, leagueEn: fixture.leagueEn || fixture.league,
        national: !!fixture.national, home: pick(fixture.home), away: pick(fixture.away),
        tz: typeof fixture.tz === 'string' ? fixture.tz : null, leagueTag: typeof fixture.leagueTag === 'string' ? fixture.leagueTag : '',
      },
      modeId: MODES.includes(modeId) ? modeId : 'random',
      luck: null,
      settings: null,
      status: 'draft',
      attempts: 0,
      nextTryAt: 0,
      error: '',
      result: null,
      youtube: null,
    };
    this.state.jobs.push(job);
    this.state.jobs.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date));
    await this.save();
    return job;
  }

  // 2) Format seç (sadece taslakta)
  async setMode(id, modeId) {
    const j = this.getJob(id);
    if (!j) throw new Error('Maç bulunamadı');
    if (j.status !== 'draft') throw new Error('Başlatılmış maçın formatı değiştirilemez (önce seçilenlere geri al)');
    j.modeId = MODES.includes(modeId) ? modeId : 'random';
    await this.save();
  }

  // Maç başına şans: null = başlatırken verilen ortak ayar; 0..1 = güç etkisi (0 = tamamen şans)
  async setLuck(id, luck) {
    const j = this.getJob(id);
    if (!j) throw new Error('Maç bulunamadı');
    if (j.status !== 'draft') throw new Error('Başlatılmış maçın şans ayarı değiştirilemez (önce seçilenlere geri al)');
    j.luck = luck === null || luck === '' || luck === undefined ? null : Math.max(0, Math.min(1, +luck));
    if (Number.isNaN(j.luck)) j.luck = null;
    await this.save();
  }

  // 3) Başlat: taslaklar o anki ayarlarla sıraya girer. "random" formatlar sırayla dağıtılır.
  async startDrafts(settings, ids = null) {
    const drafts = this.state.jobs.filter((j) => j.status === 'draft' && (!ids || ids.includes(j.id)));
    if (!drafts.length) throw new Error('Başlatılacak seçili maç yok');
    const snap = {
      duration: [30, 45, 60].includes(+settings?.duration) ? +settings.duration : 45,
      influence: Math.max(0, Math.min(1, Number.isFinite(+settings?.influence) ? +settings.influence : 0.4)),
      homeAdvantage: settings?.homeAdvantage !== false,
      lang: typeof settings?.lang === 'string' && settings.lang ? settings.lang : 'en',
      overrides: settings?.overrides && typeof settings.overrides === 'object' ? settings.overrides : {},
      music: {
        mode: ['synth', 'file', 'off'].includes(settings?.music?.mode) ? settings.music.mode : 'synth',
        volume: Math.max(0, Math.min(1, Number.isFinite(+settings?.music?.volume) ? +settings.music.volume : 0.6)),
      },
    };
    for (const j of drafts) {
      if (!MODES.includes(j.modeId)) {
        j.modeId = MODES[this.state.rotation % MODES.length];
        this.state.rotation++;
      }
      j.settings = { ...snap, influence: Number.isFinite(j.luck) ? j.luck : snap.influence };
      j.status = new Date(j.fixture.date).getTime() <= Date.now() ? 'missed' : 'queued';
    }
    await this.save();
    this.kick();
    return drafts.length;
  }

  // Sıradaki (henüz üretilmeye başlamamış) maçı seçilenlere geri al
  async unstart(id) {
    const j = this.getJob(id);
    if (!j) throw new Error('Maç bulunamadı');
    if (j.status !== 'queued') throw new Error('Sadece sırada bekleyen maç geri alınabilir');
    j.status = 'draft';
    j.settings = null;
    await this.save();
  }

  // Seç + hemen başlat (testler ve geriye uyumluluk için)
  async addJob({ fixture, modeId, settings }) {
    const job = await this.addDraft({ fixture, modeId });
    await this.startDrafts(settings || {}, [job.id]);
    return job;
  }

  async removeJob(id) {
    const j = this.getJob(id);
    if (!j) return;
    if (j.status === 'rendering' || j.status === 'uploading') throw new Error('Şu an işleniyor, bitince çıkarabilirsin');
    this.state.jobs = this.state.jobs.filter((x) => x.id !== id);
    await this.save();
  }

  async retryJob(id) {
    const j = this.getJob(id);
    if (!j) throw new Error('İş bulunamadı');
    j.attempts = 0;
    j.nextTryAt = 0;
    j.error = '';
    j.status = j.result ? 'rendered' : 'queued';
    await this.save();
    this.kick();
  }

  kick() {
    setTimeout(() => this.tick().catch((e) => this.log.error('[kuyruk]', e)), 100);
  }

  // Bir sonraki işi seç ve işle (aynı anda tek iş)
  async tick() {
    if (this.busy) return;
    const now = Date.now();
    const job = this.state.jobs.find((j) => (j.status === 'queued' || j.status === 'rendered') && (j.nextTryAt || 0) <= now);
    if (!job) return;
    this.busy = true;
    try {
      if (new Date(job.fixture.date).getTime() <= now) {
        job.status = 'missed';
        job.error = 'Maç başladı; video zamanında üretilemedi';
        await this.save();
        return;
      }
      if (job.status === 'queued') await this.render(job);
      if (job.status === 'rendered') await this.publish(job);
    } catch (e) {
      job.attempts++;
      job.error = e.message;
      if (job.attempts >= MAX_ATTEMPTS) job.status = 'failed';
      else {
        job.status = job.result ? 'rendered' : 'queued';
        job.nextTryAt = Date.now() + RETRY_MS * job.attempts;
      }
      this.log.warn(`[kuyruk] ${job.fixture.home.name}-${job.fixture.away.name}: ${e.message}`);
      await this.save();
    } finally {
      this.busy = false;
    }
    this.kick(); // sıradaki işe geç
  }

  // ------------------------------------------------------------ üretim
  jobDir(job) {
    const d = new Date(job.fixture.date);
    const day = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const hm = `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
    return path.join(this.outDir, day, `${hm}_${slug(job.fixture.home.name)}_vs_${slug(job.fixture.away.name)}`);
  }

  // Görünmez tarayıcı: önce Windows'taki Edge, sonra Chrome, en son Playwright'ın kendi Chromium'u
  async launchBrowser() {
    let pw;
    try {
      pw = await import('playwright-core');
    } catch {
      try {
        pw = await import('playwright');
      } catch {
        throw new Error('Arka plan üretimi için "npm install" gerekli (playwright-core bulunamadı). baslat.bat bunu kendisi yapar.');
      }
    }
    const chromium = pw.chromium || pw.default?.chromium;
    const args = ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
    const tries = [];
    if (process.env.BROWSER_PATH) tries.push({ executablePath: process.env.BROWSER_PATH });
    tries.push({ channel: 'msedge' }, { channel: 'chrome' }, {});
    let lastErr;
    for (const t of tries) {
      try {
        return await chromium.launch({ headless: true, args, ...t });
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`Tarayıcı başlatılamadı (Edge/Chrome bulunamadı): ${lastErr?.message?.split('\n')[0]}`);
  }

  async render(job) {
    job.status = 'rendering';
    job.error = '';
    await this.save();
    const dir = this.jobDir(job);
    await mkdir(dir, { recursive: true });
    job.dir = dir;
    const browser = await this.launchBrowser();
    const timeoutMs = (job.settings.duration + 120) * 1000;
    try {
      const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
      page.on('pageerror', (e) => this.log.warn('[üretici sayfa]', e.message));
      const done = new Promise((resolve, reject) => {
        this.waiters.set(job.id, { resolve, reject });
        setTimeout(() => reject(new Error('Video üretimi zaman aşımına uğradı')), timeoutMs);
      });
      await page.goto(`http://127.0.0.1:${this.port}/render.html?job=${job.id}`);
      const result = await done;
      job.result = result;
      job.status = 'rendered';
      job.attempts = 0;
      await this.writeInfo(job);
      await this.save();
      this.log.log(`✓ Video hazır: ${job.fixture.home.name} - ${job.fixture.away.name} (${result.modeId})`);
    } finally {
      this.waiters.delete(job.id);
      await browser.close().catch(() => {});
    }
  }

  // Üretici sayfa dosyaları buraya gönderir
  async saveFile(job, name, stream) {
    const allowed = ['video.mp4', 'video.webm', 'cover.jpg'];
    if (!allowed.includes(name)) throw new Error('Geçersiz dosya adı');
    const dir = job.dir || this.jobDir(job);
    await mkdir(dir, { recursive: true });
    const base = `${slug(job.fixture.home.name)}_vs_${slug(job.fixture.away.name)}`;
    const target = name === 'cover.jpg' ? `${base}_cover.jpg` : `${base}${path.extname(name)}`;
    await pipeline(stream, createWriteStream(path.join(dir, target)));
    return target;
  }

  rendered(jobId, data) {
    const w = this.waiters.get(jobId);
    if (!w) throw new Error('Bu iş için bekleyen üretim yok');
    w.resolve(data);
  }

  failed(jobId, message) {
    const w = this.waiters.get(jobId);
    if (w) w.reject(new Error(message || 'Üretim hatası'));
  }

  async writeInfo(job) {
    const r = job.result;
    const plan = publishPlan(job.fixture.date, this.state.settings.leadMinutes);
    const fmt = (iso) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' });
    const txt = [
      `MAÇ: ${job.fixture.home.name} - ${job.fixture.away.name} (${job.fixture.league})`,
      `Maç saati: ${fmt(job.fixture.date)}`,
      plan.publishAt ? `Önerilen yayın saati (maçtan ${this.state.settings.leadMinutes} dk önce): ${fmt(plan.publishAt)}` : 'Önerilen yayın: hemen',
      `Tahmin (sadece sen gör, başlığa yazma): ${r.score[0]}-${r.score[1]} · format: ${r.modeId} · seed: ${r.seed}`,
      '',
      '=== YOUTUBE BAŞLIK ===',
      r.title,
      '',
      '=== YOUTUBE AÇIKLAMA ===',
      r.desc,
      '',
    ].join('\r\n');
    await writeFile(path.join(job.dir, 'bilgi.txt'), '﻿' + txt, 'utf8');
  }

  // ------------------------------------------------------------ yayın
  async publish(job) {
    const plan = publishPlan(job.fixture.date, this.state.settings.leadMinutes);
    if (plan.action === 'missed') {
      job.status = 'missed';
      await this.save();
      return;
    }
    job.plannedPublishAt = plan.publishAt || new Date().toISOString();
    const yt = this.state.settings.uploadMode === 'youtube' ? await this.yt.status() : null;
    if (!yt?.connected) {
      // sadece üret modu: video klasörde, kullanıcı elle yükler
      job.status = 'ready';
      job.error = '';
      job.attempts = 0;
      await this.save();
      return;
    }
    job.status = 'uploading';
    await this.save();
    const r = job.result;
    const base = `${slug(job.fixture.home.name)}_vs_${slug(job.fixture.away.name)}`;
    const up = await this.yt.uploadVideo({
      file: path.join(job.dir, `${base}.${r.ext}`),
      title: r.title,
      description: r.desc,
      tags: [job.fixture.home.name, job.fixture.away.name, job.fixture.leagueEn, 'football prediction', 'score prediction', 'shorts'],
      publishAt: plan.publishAt,
      lang: job.settings?.lang || 'en',
    });
    job.youtube = { id: up.id, url: `https://youtube.com/shorts/${up.id}`, publishAt: plan.publishAt, uploadedAt: new Date().toISOString() };
    try {
      await this.yt.setThumbnail(up.id, path.join(job.dir, `${base}_cover.jpg`));
      job.youtube.thumbnail = true;
    } catch (e) {
      job.youtube.thumbnail = false;
      job.youtube.thumbnailError = e.message;
    }
    job.status = 'scheduled';
    job.attempts = 0;
    job.error = '';
    await this.save();
    this.log.log(`✓ YouTube'a yüklendi: ${job.youtube.url}`);
  }
}
