// Takım gücü: ClubElo puanı (açık veri) ve/veya elle girilen kadro değeri.
// Güç, sonucu belirlemez; oyun içindeki küçük avantajlara (top hızı, kale genişliği vb.)
// dönüştürülür. "Güç etkisi" ayarı bu avantajın büyüklüğünü belirler.

export const HOME_ADVANTAGE = 65; // ClubElo'nun yaklaşık ev sahibi avantajı (Elo puanı)
export const DEFAULT_ELO = 1600;

// İnternet yoksa / ClubElo'ya ulaşılamazsa kullanılan YAKLAŞIK değerler (2025-26 sezonu civarı).
export const FALLBACK_ELO = {
  'Real Madrid': 1960, Barcelona: 1985, 'Atletico': 1860, Bilbao: 1770, Villarreal: 1770,
  Betis: 1740, Sociedad: 1720, Sevilla: 1680, Valencia: 1650, Girona: 1660, Celta: 1680,
  'Man City': 1940, Liverpool: 1975, Arsenal: 1990, Chelsea: 1900, 'Man United': 1790,
  Tottenham: 1800, Newcastle: 1830, 'Aston Villa': 1810, Brighton: 1780, Forest: 1770,
  'Crystal Palace': 1780, Everton: 1720, 'West Ham': 1720, Fulham: 1730, Bournemouth: 1760,
  Bayern: 1975, Leverkusen: 1840, Dortmund: 1820, 'RB Leipzig': 1760, Frankfurt: 1750,
  Stuttgart: 1750, Freiburg: 1720, Wolfsburg: 1680, 'Gladbach': 1690,
  'Paris SG': 1990, Marseille: 1770, Monaco: 1750, Lyon: 1760, Lille: 1760, Lens: 1720, Nice: 1700,
  Inter: 1940, Napoli: 1860, Juventus: 1830, Milan: 1820, Atalanta: 1820, Roma: 1800,
  Lazio: 1760, Bologna: 1770, Fiorentina: 1740, Como: 1760,
  Benfica: 1790, Porto: 1780, Sporting: 1800, Braga: 1700,
  PSV: 1790, Ajax: 1720, Feyenoord: 1730, AZ: 1700,
  Galatasaray: 1740, Fenerbahce: 1730, Besiktas: 1650, Trabzonspor: 1610, Basaksehir: 1580,
  Samsunspor: 1570, Goztepe: 1560,
  Celtic: 1700, Rangers: 1640, Brugge: 1730, 'Union SG': 1700, Salzburg: 1680,
  'Crvena Zvezda': 1640, Olympiakos: 1700, 'Slavia Praha': 1680, Shakhtar: 1650,
  'Dinamo Zagreb': 1630, Kobenhavn: 1650, Copenhagen: 1650, Basel: 1620, 'Young Boys': 1630,
};

const STOP = new Set([
  'fc', 'cf', 'sc', 'sk', 'ac', 'afc', 'club', 'de', 'the', 'cd', 'fk', 'as', 'ss', 'ssc',
  'calcio', 'spor', 'kulubu', 'jk', 'bk', 'sv', 'vfb', 'vfl', 'tsg', 'rc', 'ud', 'sd', 'rcd',
  'ogc', 'cp', 'sl', 'if', 'aik', 'kv', 'krc', 'cfc', 'football', 'futbol', 'a', 's', 'k',
  '1', '04', '05', '09', '1899', '1909', '1907', '1905', '1846', '1860', '1900', '1903', '1913',
]);

const ALIASES = {
  manchestercity: 'mancity', mcfc: 'mancity',
  manchesterunited: 'manunited', manutd: 'manunited', mufc: 'manunited',
  bayernmunich: 'bayern', bayernmunchen: 'bayern', bayernmuenchen: 'bayern',
  parissaintgermain: 'parissg', psg: 'parissg', parissaintgermainfc: 'parissg',
  internazionale: 'inter', intermilan: 'inter', intermilano: 'inter',
  atleticomadrid: 'atletico', atlmadrid: 'atletico', atletimadrid: 'atletico',
  borussiadortmund: 'dortmund', bvb: 'dortmund',
  bayerleverkusen: 'leverkusen', borussiamonchengladbach: 'gladbach', monchengladbach: 'gladbach',
  tottenhamhotspur: 'tottenham', spurs: 'tottenham',
  newcastleunited: 'newcastle', nottinghamforest: 'forest', westhamunited: 'westham',
  wolverhamptonwanderers: 'wolves', brightonhovealbion: 'brighton', brightonandhovealbion: 'brighton',
  realsociedad: 'sociedad', athleticbilbao: 'bilbao', athletic: 'bilbao', athleticclub: 'bilbao',
  realbetis: 'betis', celtavigo: 'celta', olympiquemarseille: 'marseille', om: 'marseille',
  olympiquelyonnais: 'lyon', ol: 'lyon', rbleipzig: 'rbleipzig', leipzig: 'rbleipzig',
  eintrachtfrankfurt: 'frankfurt', sportinglisbon: 'sporting', sportingclube: 'sporting',
  psveindhoven: 'psv', ajaxamsterdam: 'ajax', clubbrugge: 'brugge', brugge: 'brugge',
  redbullsalzburg: 'salzburg', olympiacos: 'olympiakos', olympiacospiraeus: 'olympiakos',
  redstarbelgrade: 'crvenazvezda', redstar: 'crvenazvezda',
  istanbulbasaksehir: 'basaksehir', rambasaksehir: 'basaksehir',
  shakhtardonetsk: 'shakhtar', dinamozagreb: 'dinamozagreb', gnkdinamozagreb: 'dinamozagreb',
  copenhagen: 'kobenhavn', fckobenhavn: 'kobenhavn', unionsaintgilloise: 'unionsg',
  slaviaprague: 'slaviapraha', azalkmaar: 'az',
  juve: 'juventus', barca: 'barcelona', real: 'realmadrid', gs: 'galatasaray', fb: 'fenerbahce', bjk: 'besiktas', ts: 'trabzonspor',
};

export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join('');
}

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

// `clubs`: [{ club, elo, country? }] listesi içinden isme en uygun kulübü bul.
export function matchClub(name, clubs) {
  const raw = normalizeName(name);
  if (!raw) return null;
  const q = ALIASES[raw] || raw;
  const list = clubs.map((c) => ({ c, n: normalizeName(c.club) }));
  let hit = list.find((x) => x.n === q);
  if (hit) return hit.c;
  // İçerme: "rbleipzig" ~ "leipzig", "galatasaray" ~ "galatasaray sk"
  const contains = list
    .filter((x) => x.n.length >= 3 && q.length >= 3 && (x.n.includes(q) || q.includes(x.n)))
    .sort((a, b) => Math.abs(a.n.length - q.length) - Math.abs(b.n.length - q.length) || b.c.elo - a.c.elo);
  if (contains.length) return contains[0].c;
  let best = null;
  let bestS = 0;
  for (const x of list) {
    const s = similarity(q, x.n);
    if (s > bestS) {
      bestS = s;
      best = x.c;
    }
  }
  return bestS >= 0.72 ? best : null;
}

export function fallbackList() {
  return Object.entries(FALLBACK_ELO).map(([club, elo]) => ({ club, elo, country: '' }));
}

// ClubElo CSV: Rank,Club,Country,Level,Elo,From,To
export function parseClubEloCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const iClub = head.indexOf('club');
  const iElo = head.indexOf('elo');
  const iCountry = head.indexOf('country');
  const iLevel = head.indexOf('level');
  if (iClub < 0 || iElo < 0) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const elo = parseFloat(cols[iElo]);
    if (!cols[iClub] || Number.isNaN(elo)) continue;
    out.push({ club: cols[iClub], elo: Math.round(elo), country: cols[iCountry] || '', level: cols[iLevel] || '' });
  }
  return out;
}

export function eloWinProb(diff) {
  return 1 / (1 + 10 ** (-diff / 400));
}

// Kadro değeri oranını yaklaşık Elo farkına çevir (5 kat değer farkı ≈ 210 Elo).
export function valueToEloDiff(valueA, valueB) {
  if (!(valueA > 0) || !(valueB > 0)) return null;
  return 300 * Math.log10(valueA / valueB);
}

/**
 * @returns {{ diff:number, pA:number, edge:[number, number] }}
 *  pA: A'nın güç bazlı "üstünlük" olasılığı (beraberlik ayrı değil)
 *  edge: her takım için -1..1 arası oyun avantajı (influence ile ölçeklenmiş)
 */
export function computeStrength({ eloA, eloB, valueA, valueB, homeAdvantage = true, influence = 0.5 }) {
  const eA = Number.isFinite(eloA) ? eloA : DEFAULT_ELO;
  const eB = Number.isFinite(eloB) ? eloB : DEFAULT_ELO;
  let diff = eA - eB;
  const vDiff = valueToEloDiff(valueA, valueB);
  if (vDiff !== null) {
    const haveElo = Number.isFinite(eloA) && Number.isFinite(eloB);
    diff = haveElo ? (diff + vDiff) / 2 : vDiff;
  }
  if (homeAdvantage) diff += HOME_ADVANTAGE;
  const pA = eloWinProb(diff);
  const k = Math.max(0, Math.min(1, influence));
  const e = Math.max(-0.9, Math.min(0.9, (pA - 0.5) * 2 * k));
  return { diff, pA, edge: [e, -e] };
}

/**
 * Gerçek futbola yakın sonuç olasılıkları (ev sahibi / berabere / deplasman).
 * Elo beklentisinden türetilir; beraberlik dengeli maçlarda ~%28, büyük güç farkında ~%15.
 * Sürpriz her zaman mümkün: hiçbir sonuç %5'in altına inmez.
 */
export function outcomeProbs(diff) {
  const pA = eloWinProb(diff);
  const draw = Math.max(0.12, 0.28 - 0.32 * Math.abs(pA - 0.5));
  const home = Math.max(0.05, pA - draw / 2);
  const away = Math.max(0.05, 1 - pA - draw / 2);
  const t = home + draw + away;
  return { home: home / t, draw: draw / t, away: away / t };
}

// r ∈ [0,1) → 1 (ev sahibi), 0 (berabere), -1 (deplasman)
export function pickOutcome(probs, r) {
  return r < probs.home ? 1 : r < probs.home + probs.draw ? 0 : -1;
}

// "Gerçekçi" modda fizik oyununun güç avantajı (sonucu olasılıklar belirler; fizik doğal kalsın)
export const REALISTIC_INFLUENCE = 0.3;
