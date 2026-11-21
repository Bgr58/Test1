import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../public/js/match.js';
import { MODES } from '../public/js/modes/index.js';
import { computeStrength, matchClub, fallbackList, parseClubEloCsv, normalizeName } from '../public/js/strength.js';

const teams = [{ name: 'A', color: '#ffffff', color2: '#000000' }, { name: 'B', color: '#a50044', color2: '#004d98' }];

test('isim eşleştirme: yaygın yazımlar doğru kulübe gider', () => {
  const list = fallbackList();
  const cases = {
    'Real Madrid CF': 'Real Madrid', 'FC Barcelona': 'Barcelona', 'Manchester City': 'Man City',
    'Man Utd': 'Man United', 'Bayern München': 'Bayern', 'Paris Saint-Germain': 'Paris SG',
    'Fenerbahçe': 'Fenerbahce', 'Beşiktaş JK': 'Besiktas', 'Galatasaray SK': 'Galatasaray',
    'Inter Milan': 'Inter', 'AC Milan': 'Milan', 'Atlético Madrid': 'Atletico', 'RB Leipzig': 'RB Leipzig',
  };
  for (const [q, want] of Object.entries(cases)) assert.equal(matchClub(q, list)?.club, want, q);
  assert.equal(matchClub('Zzzz Qqqq', list), null);
  assert.equal(normalizeName('İstanbul Başakşehir FK'), 'istanbulbasaksehir');
});

test('ClubElo CSV ayrıştırma', () => {
  const csv = 'Rank,Club,Country,Level,Elo,From,To\n1,Arsenal,ENG,1,2050.12,2026-11-10,2026-11-20\nNone,Galatasaray,TUR,1,1745.6,2026-11-10,2026-11-20\n';
  const list = parseClubEloCsv(csv);
  assert.deepEqual(list.map((c) => [c.club, c.elo]), [['Arsenal', 2050], ['Galatasaray', 1746]]);
});

test('güç: avantaj sınırlı ve etkiyle ölçekleniyor', () => {
  const s0 = computeStrength({ eloA: 1900, eloB: 1600, homeAdvantage: false, influence: 0 });
  assert.deepEqual(s0.edge, [0, -0]);
  const s1 = computeStrength({ eloA: 2100, eloB: 1300, homeAdvantage: true, influence: 1 });
  assert.ok(s1.edge[0] <= 0.9 && s1.edge[0] > 0.5);
  const v = computeStrength({ valueA: 1000, valueB: 200, homeAdvantage: false, influence: 0.5 });
  assert.ok(v.pA > 0.7 && v.pA < 0.85);
});

test('aynı seed aynı skoru üretir', () => {
  for (const m of MODES) {
    const a = new Match({ teams, modeId: m.meta.id, seed: 99, duration: 20 }).simulate();
    const b = new Match({ teams, modeId: m.meta.id, seed: 99, duration: 20 }).simulate();
    assert.deepEqual(a, b, m.meta.id);
  }
});

test('her mod gerçekçi skor üretir (ortalama 1-5 gol, aşırı skor yok)', () => {
  const N = 30;
  for (const m of MODES) {
    let total = 0;
    let max = 0;
    for (let s = 1; s <= N; s++) {
      const [a, b] = new Match({ teams, modeId: m.meta.id, seed: s * 31, duration: 45 }).simulate();
      assert.ok(Number.isInteger(a) && Number.isInteger(b));
      total += a + b;
      max = Math.max(max, a, b);
    }
    const avg = total / N;
    assert.ok(avg >= 1 && avg <= 5, `${m.meta.id} ortalama ${avg}`);
    assert.ok(max <= 9, `${m.meta.id} max ${max}`);
  }
});

test('maç fazları sırayla ilerler ve biter', () => {
  const m = new Match({ teams, modeId: 'ring', seed: 1, duration: 5 });
  const seen = new Set();
  let guard = 0;
  while (!m.done && guard++ < 240 * 30) {
    m.step();
    seen.add(m.phase);
  }
  assert.ok(m.done);
  assert.deepEqual([...seen], ['intro', 'play', 'final', 'outro', 'done']);
});

test('dil paketleri: her dilde tüm metinler var, yer tutucular korunuyor', async () => {
  const { LANGS, KEYS, makeTexts } = await import('../public/js/i18n.js');
  const ph = (s) => [...new Set(String(s).match(/\{\w+\}/g) || [])].sort().join();
  for (const [code, pack] of Object.entries(LANGS)) {
    for (const { key } of KEYS) {
      assert.ok(pack.strings[key], `${code}.${key} eksik`);
      assert.equal(ph(pack.strings[key]), ph(LANGS.tr.strings[key]), `${code}.${key} yer tutucu farklı`);
    }
  }
  const T = makeTexts('en', { goal: 'GOL GOL!' });
  assert.equal(T.t('goal'), 'GOL GOL!');
  assert.equal(T.t('wins', { team: 'ARSENAL' }), 'ARSENAL TO WIN');
  assert.equal(makeTexts('tr').upper('mini'), 'MİNİ');
});

test('eloratings ayrıştırma ve milli takım eşleştirme', async () => {
  const { parseEloratings, matchNational } = await import('../data.js');
  const world = '1\t1\tES\t2258\n2\t2\tEN\t2182\n20\t20\tTR\t1750\n30\t30\tKR\t1700\n';
  const names = 'ES\tSpain\nEN\tEngland\nTR\tTurkey\nKR\tSouth Korea\tKorea Republic\n';
  const list = parseEloratings(world, names);
  assert.equal(list.length, 4);
  assert.equal(matchNational('Türkiye', list)?.elo, 1750);
  assert.equal(matchNational('Korea Republic', list)?.elo, 1700);
  assert.equal(matchNational('Spain', list)?.elo, 2258);
});

test('alt başlık ligin ülke saatiyle; açıklamada anket + lig etiketi var, skor yok; başlık maça göre çeşitlenir', async () => {
  const { fixtureSubtitle, shortsText, tzLabel } = await import('../public/js/produce.js');
  const { makeTexts } = await import('../public/js/i18n.js');
  const base = { date: '2026-11-22T13:00:00Z', league: 'LaLiga', leagueEn: 'LaLiga' };
  assert.equal(fixtureSubtitle({ ...base, tz: 'Europe/Madrid' }, 'en'), 'LaLiga • Sun 22 Nov, 14:00 CET');
  assert.equal(fixtureSubtitle({ ...base, tz: 'Europe/London', leagueEn: 'Premier League' }, 'en'), 'Premier League • Sun 22 Nov, 13:00 GMT');
  assert.equal(fixtureSubtitle({ ...base, tz: 'Europe/Istanbul', leagueEn: 'Süper Lig' }, 'en'), 'Süper Lig • Sun 22 Nov, 16:00 TRT');
  assert.equal(tzLabel(new Date('2026-07-10T13:00Z'), 'Europe/London'), 'BST');
  const T = makeTexts('en');
  const mk = (A, B) => shortsText({ A: { name: A }, B: { name: B }, subtitle: 'LaLiga • Sun 22 Nov, 14:00 CET', leagueTag: '#LaLiga' }, 'ring', T);
  const r = mk('Barcelona', 'Villarreal');
  assert.match(r.desc, /⏰ LaLiga • Sun 22 Nov, 14:00 CET/);
  assert.match(r.desc, /#barcelona #villarreal #LaLiga/);
  assert.ok(/1/.test(r.desc) && /X/.test(r.desc), 'her tarzda 1/X/2 çağrısı olmalı');
  assert.ok(!/\{\w+\}/.test(r.title + r.desc), 'doldurulmamış yer tutucu kalmamalı');
  assert.ok(!/---/.test(r.desc), 'tarz ayırıcı açıklamaya sızmamalı');
  assert.deepEqual(mk('Barcelona', 'Villarreal'), r, 'aynı maç → aynı başlık ve açıklama');
  const pairs = ['Real Madrid|Getafe', 'Arsenal|Chelsea', 'Inter|Milan', 'Ajax|PSV', 'Benfica|Porto', 'Lyon|Nice', 'Roma|Lazio', 'Celtic|Rangers', 'Bayern|Dortmund', 'Sevilla|Betis'];
  const outs = pairs.map((x) => mk(...x.split('|')));
  assert.ok(new Set(outs.map((o) => o.title.split(' ')[0])).size >= 2, 'farklı maçlarda farklı başlık çeşitleri');
  assert.ok(new Set(outs.map((o) => o.desc.split('\n')[0].slice(0, 6))).size >= 3, 'farklı maçlarda farklı açıklama tarzları');
  for (const o of outs) assert.match(o.desc, /⏰ LaLiga/, 'her tarzda maç saati satırı');
});

test('gerçekçi mod: olasılıklar mantıklı, videodaki maç arka plan simülasyonuyla aynı skoru verir', async () => {
  const { outcomeProbs, pickOutcome, computeStrength } = await import('../public/js/strength.js');
  const { findSeed, STEP } = await import('../public/js/match.js');
  const p = outcomeProbs(345); // Real Madrid (ev) - Celta
  assert.ok(p.home > 0.7 && p.home < 0.85, 'favori ~%75-80');
  assert.ok(p.away >= 0.04 && p.away < 0.12, 'sürpriz mümkün ama seyrek');
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  const even = outcomeProbs(0);
  assert.ok(even.draw > 0.25 && Math.abs(even.home - even.away) < 1e-9);
  assert.equal(pickOutcome(p, 0.01), 1);
  assert.equal(pickOutcome(p, 0.999), -1);

  const edge = computeStrength({ eloA: 1960, eloB: 1680, homeAdvantage: true, influence: 0.3 }).edge;
  for (const modeId of ['ring', 'plinko', 'football', 'race']) {
    for (const target of [1, 0, -1]) {
      const r = findSeed({ teams, modeId, duration: 30, edge }, target, 12345);
      assert.ok(!r.missed, `${modeId} hedef ${target} bulunamadı`);
      assert.equal(Math.sign(r.score[0] - r.score[1]), target);
      // videodaki tam akış (giriş → oyun → bitiş) aynı skoru vermeli
      const full = new Match({ teams, modeId, seed: r.seed, duration: 30, edge });
      while (!full.done) full.step();
      assert.deepEqual(full.score, r.score, `${modeId}: video skoru simülasyondan farklı`);
    }
  }
});
