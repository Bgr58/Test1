// Sunucu tarafı veri katmanı (anahtarsız, açık kaynaklar):
//  - ESPN herkese açık site API'si: takım listeleri, logolar, forma renkleri, fikstür, puan durumu
//  - ClubElo (clubelo.com): kulüp Elo puanları
//  - eloratings.net: milli takım Elo puanları
// Hepsi bellekte önbelleğe alınır.
import { matchClub, parseClubEloCsv, fallbackList, normalizeName, DEFAULT_ELO } from './public/js/strength.js';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer';
const TIMEOUT = 12_000;

// group: arayüzde gruplama · base: puan durumundan Elo tahmini için lig taban puanı
export const COMPETITIONS = [
  { id: 'tur.1', name: 'Süper Lig', nameEn: 'Süper Lig', tz: 'Europe/Istanbul', tag: '#SuperLig', group: 'Türkiye', national: false, base: 1590 },
  { id: 'eng.1', name: 'Premier League', nameEn: 'Premier League', tz: 'Europe/London', tag: '#PremierLeague', group: 'Avrupa ligleri', national: false, base: 1810 },
  { id: 'esp.1', name: 'LaLiga', nameEn: 'LaLiga', tz: 'Europe/Madrid', tag: '#LaLiga', group: 'Avrupa ligleri', national: false, base: 1760 },
  { id: 'ita.1', name: 'Serie A', nameEn: 'Serie A', tz: 'Europe/Rome', tag: '#SerieA', group: 'Avrupa ligleri', national: false, base: 1745 },
  { id: 'ger.1', name: 'Bundesliga', nameEn: 'Bundesliga', tz: 'Europe/Berlin', tag: '#Bundesliga', group: 'Avrupa ligleri', national: false, base: 1740 },
  { id: 'fra.1', name: 'Ligue 1', nameEn: 'Ligue 1', tz: 'Europe/Paris', tag: '#Ligue1', group: 'Avrupa ligleri', national: false, base: 1700 },
  { id: 'por.1', name: 'Liga Portugal', nameEn: 'Liga Portugal', tz: 'Europe/Lisbon', tag: '#LigaPortugal', group: 'Avrupa ligleri', national: false, base: 1650 },
  { id: 'uefa.champions', name: 'Şampiyonlar Ligi', nameEn: 'Champions League', tag: '#ChampionsLeague #UCL', group: 'UEFA kupaları', national: false },
  { id: 'uefa.europa', name: 'Avrupa Ligi', nameEn: 'Europa League', tag: '#EuropaLeague #UEL', group: 'UEFA kupaları', national: false },
  { id: 'uefa.europa.conf', name: 'Konferans Ligi', nameEn: 'Conference League', tag: '#ConferenceLeague #UECL', group: 'UEFA kupaları', national: false },
  { id: 'fifa.world', name: 'Dünya Kupası', nameEn: 'World Cup', tag: '#WorldCup', group: 'Milli takımlar', national: true },
  { id: 'fifa.worldq.uefa', name: 'Dünya Kupası Elemeleri (Avrupa)', nameEn: 'World Cup Qualifiers', tag: '#WorldCupQualifiers', group: 'Milli takımlar', national: true },
  { id: 'uefa.nations', name: 'UEFA Uluslar Ligi', nameEn: 'Nations League', tag: '#NationsLeague', group: 'Milli takımlar', national: true },
  { id: 'uefa.euro', name: 'EURO', nameEn: 'EURO', tag: '#EURO', group: 'Milli takımlar', national: true },
  { id: 'uefa.euroq', name: 'EURO Elemeleri', nameEn: 'EURO Qualifiers', tag: '#EUROQualifiers', group: 'Milli takımlar', national: true },
  { id: 'fifa.friendly', name: 'Hazırlık Maçları', nameEn: 'International Friendly', tag: '#InternationalFriendly', group: 'Milli takımlar', national: true },
];
const COMP = Object.fromEntries(COMPETITIONS.map((c) => [c.id, c]));

// Türkçe ülke adlarıyla aranabilsin diye (ESPN İngilizce isim kullanır)
const TR_COUNTRY = {
  turkiye: 'turkey', almanya: 'germany', fransa: 'france', ispanya: 'spain', italya: 'italy', ingiltere: 'england',
  hollanda: 'netherlands', belcika: 'belgium', portekiz: 'portugal', hirvatistan: 'croatia', sirbistan: 'serbia',
  isvicre: 'switzerland', avusturya: 'austria', polonya: 'poland', cekya: 'czechia', cekcumhuriyeti: 'czechia',
  danimarka: 'denmark', isvec: 'sweden', norvec: 'norway', finlandiya: 'finland', yunanistan: 'greece',
  romanya: 'romania', macaristan: 'hungary', ukrayna: 'ukraine', rusya: 'russia', gurcistan: 'georgia',
  azerbaycan: 'azerbaijan', arnavutluk: 'albania', bosnahersek: 'bosnia', iskocya: 'scotland', galler: 'wales',
  irlanda: 'ireland', kuzeyirlanda: 'northernireland', izlanda: 'iceland', slovakya: 'slovakia', slovenya: 'slovenia',
  bulgaristan: 'bulgaria', karadag: 'montenegro', kuzeymakedonya: 'northmacedonia', kosova: 'kosovo',
  brezilya: 'brazil', arjantin: 'argentina', kolombiya: 'colombia', sili: 'chile', meksika: 'mexico',
  abd: 'unitedstates', amerika: 'unitedstates', kanada: 'canada', japonya: 'japan', guneykore: 'southkorea',
  avustralya: 'australia', fas: 'morocco', misir: 'egypt', nijerya: 'nigeria', gana: 'ghana', kamerun: 'cameroon',
  cezayir: 'algeria', tunus: 'tunisia', fildisisahili: 'ivorycoast', suudiarabistan: 'saudiarabia', iran: 'iran',
  katar: 'qatar', israil: 'israel', kazakistan: 'kazakhstan', ermenistan: 'armenia', moldova: 'moldova',
  beyazrusya: 'belarus', letonya: 'latvia', litvanya: 'lithuania', estonya: 'estonia', kibris: 'cyprus',
  luksemburg: 'luxembourg', yenizelanda: 'newzealand', guneyafrika: 'southafrica', ekvador: 'ecuador',
  peru: 'peru', paraguay: 'paraguay', venezuela: 'venezuela', ozbekistan: 'uzbekistan', urdun: 'jordan',
};

// ESPN ↔ eloratings ad farkları
const NATIONAL_ALIASES = {
  turkiye: 'turkey', unitedstates: 'unitedstates', usa: 'unitedstates', korearepublic: 'southkorea',
  southkorea: 'southkorea', cotedivoire: 'ivorycoast', ivorycoast: 'ivorycoast', czechrepublic: 'czechia',
  republicofireland: 'ireland', ireland: 'ireland', bosniaandherzegovina: 'bosniaandherzegovina',
  bosniaherzegovina: 'bosniaandherzegovina', capeverde: 'capeverde', caboverde: 'capeverde',
  drcongo: 'drcongo', congodr: 'drcongo', iranir: 'iran', chinapr: 'china', curacao: 'curacao',
};

const cache = new Map();
const FAIL_TTL = 10 * 60_000; // ulaşılamayan kaynağı 10 dk tekrar deneme (her istek beklemesin)
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && 'value' in hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit?.pending) return hit.pending;
  if (hit?.error && Date.now() - hit.failedAt < FAIL_TTL) {
    if ('value' in hit) return hit.value;
    throw hit.error;
  }
  const pending = fn()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((e) => {
      const old = cache.get(key) || {};
      const rec = { error: e, failedAt: Date.now() };
      if ('value' in old) Object.assign(rec, { value: old.value, at: old.at });
      cache.set(key, rec);
      if ('value' in rec) return rec.value; // eski veri varsa onu kullan
      throw e;
    });
  cache.set(key, { ...(hit || {}), pending });
  return pending;
}

export async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': 'mac-tahmin-shorts/1.0', ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

async function getJson(url) {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  return r.json();
}

async function getText(url) {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  return r.text();
}

// ESPN'in forma renkleri bazı büyük kulüplerde yanlış/eksik. Bilinen kulüp renkleri (normalize isim → [ana, ikinci]).
// Burada olmayan takımlarda ESPN rengi, o da anlamsızsa tarayıcıda logodan çıkarılan renk kullanılır.
const CLUB_COLORS = {
  galatasaray: ['#a90432', '#fdb912'], fenerbahce: ['#0a1f5c', '#ffed00'], besiktas: ['#111111', '#ffffff'],
  trabzonspor: ['#7a1a33', '#4cb5e8'], basaksehir: ['#ef7d00', '#0a2240'], istanbulbasaksehir: ['#ef7d00', '#0a2240'],
  samsunspor: ['#e30a17', '#ffffff'], goztepe: ['#ffd200', '#c8102e'], kasimpasa: ['#1b3c87', '#ffffff'],
  realmadrid: ['#ffffff', '#febe10'], barcelona: ['#a50044', '#004d98'], atleticomadrid: ['#cb3524', '#272e61'],
  athleticclub: ['#ee2523', '#ffffff'], realsociedad: ['#0067b1', '#ffffff'], villarreal: ['#ffe667', '#005187'],
  realbetis: ['#0bb363', '#ffffff'], sevilla: ['#ffffff', '#d81920'], valencia: ['#ffffff', '#ee3524'],
  manchestercity: ['#6cabdd', '#1c2c5b'], manchesterunited: ['#da291c', '#fbe122'], liverpool: ['#c8102e', '#00b2a9'],
  arsenal: ['#ef0107', '#ffffff'], chelsea: ['#034694', '#ffffff'], tottenhamhotspur: ['#ffffff', '#132257'],
  newcastleunited: ['#241f20', '#ffffff'], astonvilla: ['#670e36', '#95bfe5'], everton: ['#003399', '#ffffff'],
  westhamunited: ['#7a263a', '#1bb1e7'], nottinghamforest: ['#dd0000', '#ffffff'],
  bayernmunich: ['#dc052d', '#0066b2'], borussiadortmund: ['#fde100', '#000000'], bayerleverkusen: ['#e32221', '#000000'],
  rbleipzig: ['#dd0741', '#ffffff'], eintrachtfrankfurt: ['#e1000f', '#000000'], vfbstuttgart: ['#e32219', '#ffffff'],
  parissaintgermain: ['#004170', '#da291c'], marseille: ['#2faee0', '#ffffff'], monaco: ['#e2001a', '#ffffff'],
  lyon: ['#ffffff', '#14387f'], lille: ['#e01e13', '#20325f'],
  internazionale: ['#0068a8', '#111111'], acmilan: ['#fb090b', '#111111'], milan: ['#fb090b', '#111111'],
  juventus: ['#111111', '#ffffff'], napoli: ['#12a0d7', '#ffffff'], roma: ['#8e1f2f', '#f0bc42'],
  lazio: ['#87d8f7', '#ffffff'], atalanta: ['#1e71b8', '#111111'], fiorentina: ['#482e92', '#ffffff'],
  benfica: ['#e83030', '#ffffff'], porto: ['#003893', '#ffffff'], sporting: ['#008057', '#ffffff'], braga: ['#e2001a', '#ffffff'],
  ajax: ['#d2122e', '#ffffff'], ajaxamsterdam: ['#d2122e', '#ffffff'], psveindhoven: ['#ed1c24', '#ffffff'], feyenoord: ['#e3001b', '#ffffff'],
  celtic: ['#018749', '#ffffff'], rangers: ['#1b458f', '#ffffff'], olympiacos: ['#e2001a', '#ffffff'],
};

// Milli maçlarda ev sahibi ülkenin saati (listede yoksa Orta Avrupa saati)
const NATIONAL_TZ = {
  turkey: 'Europe/Istanbul', turkiye: 'Europe/Istanbul', england: 'Europe/London', scotland: 'Europe/London', wales: 'Europe/London',
  northernireland: 'Europe/London', ireland: 'Europe/Dublin', republicofireland: 'Europe/Dublin', portugal: 'Europe/Lisbon',
  iceland: 'Atlantic/Reykjavik', faroeislands: 'Atlantic/Faroe', greece: 'Europe/Athens', cyprus: 'Asia/Nicosia', romania: 'Europe/Bucharest',
  bulgaria: 'Europe/Sofia', ukraine: 'Europe/Kyiv', finland: 'Europe/Helsinki', estonia: 'Europe/Tallinn', latvia: 'Europe/Riga',
  lithuania: 'Europe/Vilnius', moldova: 'Europe/Chisinau', georgia: 'Asia/Tbilisi', armenia: 'Asia/Yerevan', azerbaijan: 'Asia/Baku',
  kazakhstan: 'Asia/Almaty', israel: 'Asia/Jerusalem', belarus: 'Europe/Minsk', russia: 'Europe/Moscow',
  brazil: 'America/Sao_Paulo', argentina: 'America/Argentina/Buenos_Aires', uruguay: 'America/Montevideo', chile: 'America/Santiago',
  colombia: 'America/Bogota', peru: 'America/Lima', ecuador: 'America/Guayaquil', paraguay: 'America/Asuncion', bolivia: 'America/La_Paz',
  venezuela: 'America/Caracas', mexico: 'America/Mexico_City', unitedstates: 'America/New_York', usa: 'America/New_York', canada: 'America/Toronto',
  costarica: 'America/Costa_Rica', japan: 'Asia/Tokyo', southkorea: 'Asia/Seoul', korearepublic: 'Asia/Seoul', australia: 'Australia/Sydney',
  saudiarabia: 'Asia/Riyadh', qatar: 'Asia/Qatar', iran: 'Asia/Tehran', egypt: 'Africa/Cairo', morocco: 'Africa/Casablanca',
  algeria: 'Africa/Algiers', tunisia: 'Africa/Tunis', nigeria: 'Africa/Lagos', ghana: 'Africa/Accra', senegal: 'Africa/Dakar',
  cameroon: 'Africa/Douala', ivorycoast: 'Africa/Abidjan', southafrica: 'Africa/Johannesburg',
};
const CET = 'Europe/Paris';

// Maç saatinin hangi saat diliminde yazılacağı: lig maçında o ülkenin, Avrupa kupasında ev sahibi takımın
// ligi biliniyorsa o ülkenin, milli maçta ev sahibi ülkenin saati; bilinmiyorsa Orta Avrupa saati (CET).
async function matchTimeZone(compId, home) {
  const c = COMP[compId];
  if (c?.tz) return c.tz;
  if (c?.national) return NATIONAL_TZ[normalizeName(home?.name)] || CET;
  try {
    const t = await getTeam(home?.id, false);
    const lg = t?.comps.find((x) => COMP[x]?.tz);
    if (lg) return COMP[lg].tz;
  } catch { /* dizin yoksa CET */ }
  return CET;
}

const hex = (c) => (/^[0-9a-f]{6}$/i.test(c || '') ? '#' + c.toLowerCase() : null);
export const imgUrl = (u) => (u ? `/api/img?u=${encodeURIComponent(u)}` : '');

function mapTeam(t, compId) {
  const logo = t.logos?.[0]?.href || t.logo || '';
  const name = t.displayName || t.name;
  const known = !COMP[compId]?.national && CLUB_COLORS[normalizeName(name)];
  return {
    id: String(t.id),
    name,
    short: t.shortDisplayName || t.name || '',
    abbr: t.abbreviation || '',
    color: known ? known[0] : hex(t.color),
    color2: known ? known[1] : hex(t.alternateColor),
    knownColors: !!known,
    logo: imgUrl(logo),
    national: !!COMP[compId]?.national,
    comps: [compId],
  };
}

// ------------------------------------------------------------- takım dizini
async function teamsOf(compId) {
  return cached('teams:' + compId, 12 * 3600_000, async () => {
    const j = await getJson(`${ESPN}/${compId}/teams`);
    const list = j.sports?.[0]?.leagues?.[0]?.teams || [];
    return list.map((x) => mapTeam(x.team, compId));
  });
}

export async function teamIndex() {
  return cached('index', 12 * 3600_000, async () => {
    const results = await Promise.allSettled(COMPETITIONS.map((c) => teamsOf(c.id)));
    const byId = new Map();
    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      for (const t of r.value) {
        const key = (t.national ? 'n' : 'c') + t.id;
        const prev = byId.get(key);
        if (prev) {
          prev.comps = [...new Set([...prev.comps, ...t.comps])];
        } else byId.set(key, { ...t, comps: [...t.comps], key: normalizeName(t.name), keyShort: normalizeName(t.short) });
      }
    });
    const all = [...byId.values()];
    if (!all.length) throw new Error('Takım listesi alınamadı (ESPN)');
    return all;
  });
}

function primaryLeague(team) {
  return team.comps.find((c) => COMP[c]?.base) || team.comps[0];
}

export async function searchTeams(q, limit = 12) {
  const all = await teamIndex();
  let nq = normalizeName(q);
  if (!nq) return [];
  const alt = TR_COUNTRY[nq] || Object.entries(TR_COUNTRY).find(([k]) => k.startsWith(nq) && nq.length >= 3)?.[1];
  const scored = [];
  for (const t of all) {
    let s = 0;
    for (const [k, w] of [[t.key, 1], [t.keyShort, 0.9], [normalizeName(t.abbr), 0.7]]) {
      if (!k) continue;
      if (k === nq) s = Math.max(s, 100 * w);
      else if (k.startsWith(nq)) s = Math.max(s, 80 * w);
      else if (k.includes(nq)) s = Math.max(s, 55 * w);
      if (alt && (k === alt || k.startsWith(alt))) s = Math.max(s, 90);
    }
    // kelime başı eşleşmesi ("madrid" → Real Madrid, Atlético Madrid)
    if (!s && String(t.name).toLowerCase().split(/\s+/).some((w) => normalizeName(w).startsWith(nq))) s = 50;
    if (s) {
      // büyük liglere hafif öncelik, milli takımlar kulüplerle karışmasın
      if (t.comps.some((c) => ['uefa.champions', 'uefa.europa'].includes(c))) s += 3;
      scored.push({ t, s });
    }
  }
  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));
  return scored.slice(0, limit).map(({ t }) => publicTeam(t));
}

function publicTeam(t) {
  const lg = primaryLeague(t);
  return {
    id: t.id, name: t.name, short: t.short, abbr: t.abbr, color: t.color, color2: t.color2, logo: t.logo,
    national: t.national, league: COMP[lg]?.name || '', leagueId: lg,
  };
}

export async function getTeam(id, national) {
  const all = await teamIndex();
  const t = all.find((x) => x.id === String(id) && (national === undefined || x.national === national));
  return t || null;
}

// ------------------------------------------------------------- fikstür
export async function fixtures(date, comps = COMPETITIONS.map((c) => c.id)) {
  const d = String(date).replace(/-/g, '');
  if (!/^\d{8}$/.test(d)) throw new Error('Tarih YYYY-MM-DD olmalı');
  const ids = comps.filter((c) => COMP[c]);
  const results = await Promise.allSettled(
    ids.map((c) =>
      cached(`fx:${c}:${d}`, 10 * 60_000, async () => {
        const j = await getJson(`${ESPN}/${c}/scoreboard?dates=${d}`);
        return (j.events || []).map((e) => {
          const comp = e.competitions?.[0] || {};
          const side = (ha) => comp.competitors?.find((x) => x.homeAway === ha);
          const team = (x) => (x ? { ...mapTeam(x.team, c), score: x.score ?? null } : null);
          return {
            id: e.id, date: e.date, league: COMP[c].name, leagueEn: COMP[c].nameEn, leagueId: c, national: COMP[c].national, leagueTag: COMP[c].tag,
            status: e.status?.type?.description || '', state: e.status?.type?.state || '',
            venue: comp.venue?.fullName || '', home: team(side('home')), away: team(side('away')),
          };
        });
      }),
    ),
  );
  const out = [];
  const errors = [];
  results.forEach((r, i) => (r.status === 'fulfilled' ? out.push(...r.value) : errors.push(`${ids[i]}: ${r.reason?.message}`)));
  out.sort((a, b) => a.date.localeCompare(b.date) || a.league.localeCompare(b.league));
  const matches = out.filter((m) => m.home && m.away);
  await Promise.all(matches.map(async (m) => (m.tz = await matchTimeZone(m.leagueId, m.home))));
  return { matches, errors };
}

// ------------------------------------------------------------- güç (Elo)
async function clubEloList() {
  return cached('clubelo', 6 * 3600_000, async () => {
    const day = new Date().toISOString().slice(0, 10);
    const text = await Promise.any([
      getText(`http://api.clubelo.com/${day}`),
      getText(`https://api.clubelo.com/${day}`),
    ]).catch(() => {
      throw new Error('ClubElo erişilemedi');
    });
    const list = parseClubEloCsv(text);
    if (!list.length) throw new Error('ClubElo boş yanıt');
    return list;
  });
}

export function parseEloratings(worldTsv, teamsTsv) {
  const names = new Map();
  for (const line of teamsTsv.split(/\r?\n/)) {
    const [code, ...alts] = line.split('\t');
    if (code && alts.length) names.set(code.trim(), alts.map((s) => s.trim()).filter(Boolean));
  }
  const list = [];
  for (const line of worldTsv.split(/\r?\n/)) {
    const c = line.split('\t');
    const code = c[2];
    const elo = parseInt(c[3], 10);
    if (!code || Number.isNaN(elo) || !names.has(code)) continue;
    list.push({ club: names.get(code)[0], alts: names.get(code), elo, code });
  }
  return list;
}

async function nationalEloList() {
  return cached('eloratings', 12 * 3600_000, async () => {
    const [w, t] = await Promise.all([getText('https://www.eloratings.net/World.tsv'), getText('https://www.eloratings.net/en.teams.tsv')]);
    const list = parseEloratings(w, t);
    if (!list.length) throw new Error('eloratings boş yanıt');
    return list;
  });
}

export function matchNational(name, list) {
  let q = normalizeName(name);
  q = NATIONAL_ALIASES[q] || q;
  for (const x of list) {
    for (const a of x.alts) {
      const n = normalizeName(a);
      if (n === q || NATIONAL_ALIASES[n] === q) return x;
    }
  }
  return matchClub(name, list);
}

// Puan durumundan yaklaşık Elo: lig tabanı + maç başı puan ve averaj farkı
async function standingsElo(team) {
  const lg = team.comps.find((c) => COMP[c]?.base);
  if (!lg) return null;
  const table = await cached('st:' + lg, 3 * 3600_000, async () => {
    const j = await getJson(`${ESPN_V2}/${lg}/standings`);
    const entries = j.children?.[0]?.standings?.entries || j.standings?.entries || [];
    return entries.map((e) => {
      const st = Object.fromEntries((e.stats || []).map((s) => [s.name, s.value]));
      return { id: String(e.team?.id), gp: st.gamesPlayed || 0, pts: st.points || 0, gd: st.pointDifferential || 0 };
    });
  });
  const row = table.find((r) => r.id === team.id);
  if (!row || row.gp < 3) return null;
  const ppg = row.pts / row.gp;
  const gdpg = row.gd / row.gp;
  // ClubElo ölçeğine yakın tut: zirve takımları ~1950-2000, dipler ~lig tabanı - 150
  const elo = Math.round(Math.max(1350, Math.min(2050, COMP[lg].base + (ppg - 1.37) * 110 + gdpg * 30)));
  return { elo, source: `puan durumu tahmini (${COMP[lg].name})` };
}

export async function findElo({ id, name, national }) {
  const team = id ? await getTeam(id, national).catch(() => null) : null;
  const nm = team?.name || name;
  const isNational = team ? team.national : !!national;
  if (!nm) return null;
  if (isNational) {
    try {
      const hit = matchNational(nm, await nationalEloList());
      if (hit) return { elo: hit.elo, club: hit.club, source: 'eloratings.net' };
    } catch (e) {
      console.warn('[eloratings]', e.message);
    }
    return null;
  }
  try {
    const hit = matchClub(team?.short || nm, await clubEloList()) || matchClub(nm, await clubEloList());
    if (hit) return { elo: hit.elo, club: hit.club, source: 'ClubElo' };
  } catch (e) {
    console.warn('[clubelo]', e.message);
  }
  if (team) {
    try {
      const est = await standingsElo(team);
      if (est) return est;
    } catch (e) {
      console.warn('[standings]', e.message);
    }
  }
  const fb = matchClub(nm, fallbackList());
  if (fb) return { elo: fb.elo, club: fb.club, source: 'yaklaşık tablo' };
  return { elo: DEFAULT_ELO, source: 'varsayılan' };
}

// ------------------------------------------------------------- maç sonucu (tahmin takibi)
// ESPN "summary" ucu maç numarasıyla lig bilmeden çalışır (soccer/all).
export async function matchResult(eventId) {
  const id = String(eventId || '').replace(/\D/g, '');
  if (!id) throw new Error('Geçersiz maç numarası');
  return cached('res:' + id, 5 * 60_000, async () => {
    const j = await getJson(`${ESPN}/all/summary?event=${id}`);
    const c = j.header?.competitions?.[0];
    if (!c) throw new Error('Maç bulunamadı');
    const st = c.status?.type || {};
    const side = (ha) => c.competitors?.find((x) => x.homeAway === ha);
    const num = (x) => (x?.score === undefined || x?.score === null || x?.score === '' ? null : Number(x.score));
    return {
      completed: !!st.completed,
      state: st.state || '',
      statusName: st.name || '',
      home: { name: side('home')?.team?.displayName || '', score: num(side('home')) },
      away: { name: side('away')?.team?.displayName || '', score: num(side('away')) },
    };
  });
}
