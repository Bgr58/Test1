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
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
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
