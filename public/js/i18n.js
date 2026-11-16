// Videoda ve Shorts başlık/açıklamasında görünen TÜM metinler burada.
// Yeni dil eklemek için LANGS'a aynı anahtarlarla bir blok eklemen yeterli.
// Arayüzden yapılan düzenlemeler bunların üzerine yazılır (makeTexts overrides).

export const KEYS = [
  { key: 'badge', label: 'Üst etiket', group: 'Ekran' },
  { key: 'ctaPlay', label: 'Oyun sırasında alt yazı', group: 'Ekran' },
  { key: 'introTitle', label: 'Giriş başlığı', group: 'Giriş' },
  { key: 'introMode', label: 'Giriş: oyun adı ({mode})', group: 'Giriş' },
  { key: 'goal', label: 'Gol bandı', group: 'Oyun' },
  { key: 'goalLabel', label: 'Kale/cep etiketi', group: 'Oyun' },
  { key: 'save', label: 'Kurtarış yazısı', group: 'Oyun' },
  { key: 'post', label: 'Direk yazısı', group: 'Oyun' },
  { key: 'out', label: 'Kaçan şut yazısı', group: 'Oyun' },
  { key: 'shots', label: 'Şut sayacı ({n})', group: 'Oyun' },
  { key: 'fullTime', label: 'Maç sonu saat etiketi', group: 'Bitiş' },
  { key: 'matchEnd', label: 'Son düdük yazısı', group: 'Bitiş' },
  { key: 'ourPrediction', label: 'Tahmin başlığı', group: 'Bitiş' },
  { key: 'wins', label: 'Kazanan ({team})', group: 'Bitiş' },
  { key: 'draw', label: 'Beraberlik', group: 'Bitiş' },
  { key: 'ctaEnd', label: 'Bitiş çağrısı', group: 'Bitiş' },
  { key: 'subscribe', label: 'Abone çağrısı', group: 'Bitiş' },
  { key: 'mode.ring', label: 'Mod adı: Dönen Halka', group: 'Modlar' },
  { key: 'mode.ring.hint', label: 'Açıklama: Dönen Halka', group: 'Modlar' },
  { key: 'mode.plinko', label: 'Mod adı: Plinko', group: 'Modlar' },
  { key: 'mode.plinko.hint', label: 'Açıklama: Plinko', group: 'Modlar' },
  { key: 'mode.football', label: 'Mod adı: Mini Futbol', group: 'Modlar' },
  { key: 'mode.football.hint', label: 'Açıklama: Mini Futbol', group: 'Modlar' },
  { key: 'mode.race', label: 'Mod adı: Engelli Parkur', group: 'Modlar' },
  { key: 'mode.race.hint', label: 'Açıklama: Engelli Parkur', group: 'Modlar' },
  { key: 'thumbTitle', label: 'Kapak: büyük soru', group: 'Kapak görseli' },
  { key: 'thumbCta', label: 'Kapak: alt çağrı', group: 'Kapak görseli' },
  { key: 'ytTitle', label: 'YouTube başlığı ({home} {away} {mode}) — skor yazmıyoruz, izleyen merak etsin', group: 'YouTube' },
  { key: 'ytDesc', label: 'YouTube açıklaması ({home} {away} {mode} {subtitle} {tags})', group: 'YouTube', multiline: true },
];

export const LANGS = {
  tr: {
    label: 'Türkçe', locale: 'tr-TR',
    strings: {
      badge: '⚽ MAÇ TAHMİNİ', introTitle: 'SKOR TAHMİNİ', introMode: 'Oyun: {mode}',
      ctaPlay: 'Sence skor ne olur? Yorumlara yaz 👇',
      goal: 'GOOOL!', goalLabel: 'GOL', save: 'KURTARDI!', post: 'DİREK!', out: 'AUT', shots: 'ŞUT {n}',
      fullTime: 'MS', matchEnd: 'MAÇ SONU', ourPrediction: 'TAHMİNİMİZ', wins: '{team} KAZANIR', draw: 'BERABERLİK',
      ctaEnd: 'Sen ne düşünüyorsun? 👇', subscribe: 'Abone ol, her maçı tahmin edelim!',
      'mode.ring': 'Dönen Halka', 'mode.ring.hint': 'Boşluktan kaçan top GOL!',
      'mode.plinko': 'Plinko Kalesi', 'mode.plinko.hint': 'GOL cebine düşen top skor!',
      'mode.football': 'Mini Futbol', 'mode.football.hint': 'Logolar sahada, top kaleye!',
      'mode.race': 'Engelli Parkur', 'mode.race.hint': 'Engelleri aş, kaleciyi geç!',
      ytTitle: '{home} vs {away} Skor Tahmini ⚽ Kim kazanır? #shorts',
      ytDesc: '{home} - {away} maçını "{mode}" oyunuyla tahmin ettik.\nSkoru görmek için sonuna kadar izle! 👀\n{subtitle}\nSence maç kaç kaç biter? Yorumlara yaz! 👇\n{tags} #maçtahmini #skortahmini #futbol #shorts',
      thumbTitle: 'KİM KAZANIR?', thumbCta: 'SONUNA KADAR İZLE 👀',
    },
  },
  en: {
    label: 'English', locale: 'en-US',
    strings: {
      badge: '⚽ MATCH PREDICTION', introTitle: 'SCORE PREDICTION', introMode: 'Game: {mode}',
      ctaPlay: 'Drop your score prediction below 👇',
      goal: 'GOAAAL!', goalLabel: 'GOAL', save: 'SAVED!', post: 'POST!', out: 'MISS', shots: 'SHOTS {n}',
      fullTime: 'FT', matchEnd: 'FULL TIME', ourPrediction: 'OUR PREDICTION', wins: '{team} TO WIN', draw: 'DRAW',
      ctaEnd: 'Agree? Tell us in the comments 👇', subscribe: 'Subscribe for daily match predictions!',
      'mode.ring': 'Spinning Ring', 'mode.ring.hint': 'Escape through the gap = GOAL!',
      'mode.plinko': 'Plinko Goal', 'mode.plinko.hint': 'Land in the GOAL slot to score!',
      'mode.football': 'Mini Football', 'mode.football.hint': 'Crests on the pitch, ball to the net!',
      'mode.race': 'Obstacle Course', 'mode.race.hint': 'Beat the obstacles, beat the keeper!',
      ytTitle: '{home} vs {away} Prediction ⚽ Who wins? #shorts',
      ytDesc: 'Our physics game predicts {home} vs {away} ("{mode}").\nWatch till the end to see the score! 👀\n{subtitle}\nWhat\'s your prediction? Drop it in the comments! 👇\n{tags} #football #soccer #prediction #scoreprediction #shorts',
      thumbTitle: 'WHO WINS?', thumbCta: 'WATCH TILL THE END 👀',
    },
  },
  es: {
    label: 'Español', locale: 'es-ES',
    strings: {
      badge: '⚽ PRONÓSTICO', introTitle: 'PRONÓSTICO DEL MARCADOR', introMode: 'Juego: {mode}',
      ctaPlay: '¿Cómo quedará? Coméntalo 👇',
      goal: '¡GOOOL!', goalLabel: 'GOL', save: '¡PARADÓN!', post: '¡AL PALO!', out: 'FUERA', shots: 'TIROS {n}',
      fullTime: 'FIN', matchEnd: 'FINAL DEL PARTIDO', ourPrediction: 'NUESTRO PRONÓSTICO', wins: 'GANA {team}', draw: 'EMPATE',
      ctaEnd: '¿Tú qué opinas? 👇', subscribe: '¡Suscríbete para más pronósticos!',
      'mode.ring': 'Anillo Giratorio', 'mode.ring.hint': '¡Sal por el hueco = GOL!',
      'mode.plinko': 'Plinko Gol', 'mode.plinko.hint': '¡Cae en la casilla GOL y marca!',
      'mode.football': 'Mini Fútbol', 'mode.football.hint': '¡Escudos en el campo, balón a la red!',
      'mode.race': 'Carrera de Obstáculos', 'mode.race.hint': '¡Supera obstáculos, vence al portero!',
      ytTitle: '{home} vs {away}: pronóstico ⚽ ¿Quién gana? #shorts',
      ytDesc: 'Pronosticamos el {home} - {away} con el juego "{mode}".\n¡Mira hasta el final para ver el marcador! 👀\n{subtitle}\n¿Cómo crees que terminará? ¡Déjalo en los comentarios! 👇\n{tags} #pronostico #futbol #shorts',
      thumbTitle: '¿QUIÉN GANA?', thumbCta: 'MÍRALO HASTA EL FINAL 👀',
    },
  },
  pt: {
    label: 'Português', locale: 'pt-BR',
    strings: {
      badge: '⚽ PALPITE', introTitle: 'PALPITE DO PLACAR', introMode: 'Jogo: {mode}',
      ctaPlay: 'Qual o seu placar? Comente 👇',
      goal: 'GOOOL!', goalLabel: 'GOL', save: 'DEFENDEU!', post: 'NA TRAVE!', out: 'FORA', shots: 'CHUTES {n}',
      fullTime: 'FIM', matchEnd: 'FIM DE JOGO', ourPrediction: 'NOSSO PALPITE', wins: '{team} VENCE', draw: 'EMPATE',
      ctaEnd: 'E você, o que acha? 👇', subscribe: 'Inscreva-se para palpites de todo jogo!',
      'mode.ring': 'Anel Giratório', 'mode.ring.hint': 'Escapou pela abertura = GOL!',
      'mode.plinko': 'Plinko Gol', 'mode.plinko.hint': 'Caiu na casa GOL, é gol!',
      'mode.football': 'Mini Futebol', 'mode.football.hint': 'Escudos em campo, bola na rede!',
      'mode.race': 'Pista de Obstáculos', 'mode.race.hint': 'Passe os obstáculos, vença o goleiro!',
      ytTitle: '{home} x {away}: palpite ⚽ Quem vence? #shorts',
      ytDesc: 'Fizemos o palpite de {home} x {away} com o jogo "{mode}".\nAssista até o fim para ver o placar! 👀\n{subtitle}\nQual vai ser o placar? Comente! 👇\n{tags} #palpite #futebol #shorts',
      thumbTitle: 'QUEM VENCE?', thumbCta: 'ASSISTA ATÉ O FIM 👀',
    },
  },
  de: {
    label: 'Deutsch', locale: 'de-DE',
    strings: {
      badge: '⚽ SPIELPROGNOSE', introTitle: 'ERGEBNIS-TIPP', introMode: 'Spiel: {mode}',
      ctaPlay: 'Dein Tipp? Ab in die Kommentare 👇',
      goal: 'TOOOR!', goalLabel: 'TOR', save: 'GEHALTEN!', post: 'PFOSTEN!', out: 'DANEBEN', shots: 'SCHÜSSE {n}',
      fullTime: 'ENDE', matchEnd: 'ABPFIFF', ourPrediction: 'UNSER TIPP', wins: '{team} GEWINNT', draw: 'UNENTSCHIEDEN',
      ctaEnd: 'Was meinst du? 👇', subscribe: 'Abonniere für jeden Spieltipp!',
      'mode.ring': 'Drehender Ring', 'mode.ring.hint': 'Durch die Lücke = TOR!',
      'mode.plinko': 'Plinko-Tor', 'mode.plinko.hint': 'Ins TOR-Fach fallen = Treffer!',
      'mode.football': 'Mini-Fußball', 'mode.football.hint': 'Wappen auf dem Platz, Ball ins Netz!',
      'mode.race': 'Hindernisparcours', 'mode.race.hint': 'Hindernisse meistern, Keeper überwinden!',
      ytTitle: '{home} vs {away} Tipp ⚽ Wer gewinnt? #shorts',
      ytDesc: 'Unser Tipp für {home} - {away} mit dem Spiel "{mode}".\nSchau bis zum Ende, um das Ergebnis zu sehen! 👀\n{subtitle}\nWie geht das Spiel aus? Schreib es in die Kommentare! 👇\n{tags} #prognose #fussball #shorts',
      thumbTitle: 'WER GEWINNT?', thumbCta: 'BIS ZUM ENDE SCHAUEN 👀',
    },
  },
  fr: {
    label: 'Français', locale: 'fr-FR',
    strings: {
      badge: '⚽ PRONOSTIC', introTitle: 'PRONOSTIC DU SCORE', introMode: 'Jeu : {mode}',
      ctaPlay: 'Ton score ? Dis-le en commentaire 👇',
      goal: 'BUUUT !', goalLabel: 'BUT', save: 'ARRÊT !', post: 'POTEAU !', out: 'RATÉ', shots: 'TIRS {n}',
      fullTime: 'FIN', matchEnd: 'FIN DU MATCH', ourPrediction: 'NOTRE PRONO', wins: '{team} GAGNE', draw: 'MATCH NUL',
      ctaEnd: "Et toi, t'en penses quoi ? 👇", subscribe: 'Abonne-toi pour chaque prono !',
      'mode.ring': 'Anneau Tournant', 'mode.ring.hint': 'Sortie par la brèche = BUT !',
      'mode.plinko': 'Plinko But', 'mode.plinko.hint': 'Tombe dans la case BUT pour marquer !',
      'mode.football': 'Mini Foot', 'mode.football.hint': 'Les blasons sur le terrain, ballon au fond !',
      'mode.race': "Parcours d'Obstacles", 'mode.race.hint': 'Évite les obstacles, bats le gardien !',
      ytTitle: '{home} vs {away} : prono ⚽ Qui gagne ? #shorts',
      ytDesc: 'Notre prono pour {home} - {away} avec le jeu « {mode} ».\nRegarde jusqu\'à la fin pour voir le score ! 👀\n{subtitle}\nQuel sera le score final ? Dis-le en commentaire ! 👇\n{tags} #prono #foot #shorts',
      thumbTitle: 'QUI GAGNE ?', thumbCta: 'REGARDE JUSQU\'À LA FIN 👀',
    },
  },
  it: {
    label: 'Italiano', locale: 'it-IT',
    strings: {
      badge: '⚽ PRONOSTICO', introTitle: 'PRONOSTICO RISULTATO', introMode: 'Gioco: {mode}',
      ctaPlay: 'Tu come la vedi? Commenta 👇',
      goal: 'GOOOL!', goalLabel: 'GOL', save: 'PARATA!', post: 'PALO!', out: 'FUORI', shots: 'TIRI {n}',
      fullTime: 'FINE', matchEnd: 'FINE PARTITA', ourPrediction: 'IL NOSTRO PRONOSTICO', wins: 'VINCE {team}', draw: 'PAREGGIO',
      ctaEnd: 'Tu che ne pensi? 👇', subscribe: 'Iscriviti per ogni pronostico!',
      'mode.ring': 'Anello Rotante', 'mode.ring.hint': 'Fuori dal varco = GOL!',
      'mode.plinko': 'Plinko Gol', 'mode.plinko.hint': 'Cadi nella casella GOL e segna!',
      'mode.football': 'Mini Calcio', 'mode.football.hint': 'Stemmi in campo, palla in rete!',
      'mode.race': 'Percorso a Ostacoli', 'mode.race.hint': 'Supera gli ostacoli, batti il portiere!',
      ytTitle: '{home} vs {away}: pronostico ⚽ Chi vince? #shorts',
      ytDesc: 'Il nostro pronostico per {home} - {away} con il gioco "{mode}".\nGuarda fino alla fine per scoprire il risultato! 👀\n{subtitle}\nCome finirà? Scrivilo nei commenti! 👇\n{tags} #pronostico #calcio #shorts',
      thumbTitle: 'CHI VINCE?', thumbCta: 'GUARDA FINO ALLA FINE 👀',
    },
  },
};

export function fill(str, vars = {}) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * @param {string} lang  dil kodu (LANGS anahtarı)
 * @param {Record<string,string>} overrides  kullanıcının düzenlediği metinler
 */
export function makeTexts(lang = 'tr', overrides = {}) {
  const pack = LANGS[lang] || LANGS.tr;
  const base = LANGS.tr.strings;
  const get = (key) => {
    const o = overrides[key];
    if (typeof o === 'string' && o.length) return o;
    return pack.strings[key] ?? base[key] ?? key;
  };
  return {
    lang: LANGS[lang] ? lang : 'tr',
    locale: pack.locale,
    t: (key, vars) => fill(get(key), vars),
    upper: (s) => String(s).toLocaleUpperCase(pack.locale),
  };
}
