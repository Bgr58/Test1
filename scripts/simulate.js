// Her mod için yüzlerce maçı başsız (ekransız) oynatıp skor dağılımını gösterir.
// Kullanım: node scripts/simulate.js [maçSayısı] [süre] [edge]
import { Match } from '../public/js/match.js';
import { MODES } from '../public/js/modes/index.js';

const N = +process.argv[2] || 150;
const duration = +process.argv[3] || 45;
const e = +(process.argv[4] ?? 0.2);
const teams = [{ name: 'A', color: '#ffffff', color2: '#000000' }, { name: 'B', color: '#a50044', color2: '#004d98' }];

for (const m of MODES) {
  for (const edge of [0, e]) {
    let ga = 0, gb = 0, wa = 0, wb = 0, dr = 0, max = 0;
    const hist = {};
    const t0 = Date.now();
    for (let s = 1; s <= N; s++) {
      const [a, b] = new Match({ teams, modeId: m.meta.id, seed: s * 7919, duration, edge: [edge, -edge] }).simulate();
      ga += a; gb += b; max = Math.max(max, a, b);
      if (a > b) wa++; else if (b > a) wb++; else dr++;
      hist[a + b] = (hist[a + b] || 0) + 1;
    }
    console.log(`${m.meta.id.padEnd(9)} edge=${edge.toFixed(2)}  ort ${(ga / N).toFixed(2)}-${(gb / N).toFixed(2)}  toplam ${((ga + gb) / N).toFixed(2)}  A%${(100 * wa / N).toFixed(0)} X%${(100 * dr / N).toFixed(0)} B%${(100 * wb / N).toFixed(0)}  max ${max}  (${Date.now() - t0}ms)`);
    console.log('          toplam gol dağılımı:', JSON.stringify(hist));
  }
}
