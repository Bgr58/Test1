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
  { key: 'ytTitle', label: 'YouTube başlığı — her satır bir çeşit, maça göre biri seçilir ({home} {away} {mode}). Skor yazmıyoruz, izleyen merak etsin.', group: 'YouTube', multiline: true },
  { key: 'ytDesc', label: 'YouTube açıklaması ({home} {away} {mode} {subtitle} = lig + maç saati, {tags} = takım etiketleri, {leagueTag} = lig etiketi)', group: 'YouTube', multiline: true },
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
      ytTitle: "{home} - {away} Skor Tahmini ⚽ Kim kazanır? #shorts\n{home} mi {away} mı? 🔮 Top karar verdi #shorts\n{home} - {away}: Bu maçı kim alır? 🎲 #shorts\n{home} vs {away} tahmini: sence kim kazanır? ⚽ #shorts",
      ytDesc: "{home} - {away} maçını kim kazanır? 🤔 Fizik oyunumuz (\"{mode}\") kararını verdi, skoru görmek için sonuna kadar izle! 👀\n⏰ {subtitle}\n💬 Yorumlara {home} için 1, beraberlik için X, {away} için 2 yaz, tahmin ettiğin skoru da ekle!\n🔔 Her büyük maçtan önce yeni tahmin için takip et.\n{tags} {leagueTag} #maçtahmini #skortahmini #futbol #shorts",
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
      ytTitle: "{home} vs {away} Prediction ⚽ Who wins? #shorts\nCan {away} beat {home}? 🔮 The ball decides #shorts\n{home} vs {away}: who takes it? 🎲 Score prediction #shorts\nWho wins {home} vs {away}? ⚽ Watch till the end #shorts",
      ytDesc: "Who wins {home} vs {away}? 🤔 Our physics game (\"{mode}\") has made its call. Watch till the end to see the score! 👀\n⏰ {subtitle}\n💬 Comment 1 for {home}, X for a draw, 2 for {away}, and drop your exact score!\n🔔 Follow for a new prediction before every big match.\n{tags} {leagueTag} #football #soccer #prediction #scoreprediction #shorts",
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
      ytTitle: "{home} vs {away}: pronóstico ⚽ ¿Quién gana? #shorts\n¿Puede {away} ganar a {home}? 🔮 Decide el balón #shorts\n{home} vs {away}: ¿quién se lo lleva? 🎲 #shorts\n¿Quién gana el {home} vs {away}? ⚽ Míralo hasta el final #shorts",
      ytDesc: "¿Quién gana el {home} - {away}? 🤔 Nuestro juego de física (\"{mode}\") ya decidió. ¡Mira hasta el final para ver el marcador! 👀\n⏰ {subtitle}\n💬 Comenta 1 para {home}, X para empate, 2 para {away}, ¡y tu resultado exacto!\n🔔 Síguenos para un pronóstico antes de cada gran partido.\n{tags} {leagueTag} #pronostico #futbol #shorts",
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
      ytTitle: "{home} x {away}: palpite ⚽ Quem vence? #shorts\nO {away} consegue vencer o {home}? 🔮 A bola decide #shorts\n{home} x {away}: quem leva? 🎲 #shorts\nQuem vence {home} x {away}? ⚽ Assista até o fim #shorts",
      ytDesc: "Quem vence {home} x {away}? 🤔 Nosso jogo de física (\"{mode}\") já decidiu. Assista até o fim para ver o placar! 👀\n⏰ {subtitle}\n💬 Comente 1 para {home}, X para empate, 2 para {away}, e o seu placar exato!\n🔔 Siga para um palpite antes de cada grande jogo.\n{tags} {leagueTag} #palpite #futebol #shorts",
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
      ytTitle: "{home} vs {away} Tipp ⚽ Wer gewinnt? #shorts\nSchlägt {away} {home}? 🔮 Der Ball entscheidet #shorts\n{home} vs {away}: Wer holt den Sieg? 🎲 #shorts\nWer gewinnt {home} vs {away}? ⚽ Bis zum Ende schauen #shorts",
      ytDesc: "Wer gewinnt {home} - {away}? 🤔 Unser Physik-Spiel (\"{mode}\") hat entschieden. Schau bis zum Ende, um das Ergebnis zu sehen! 👀\n⏰ {subtitle}\n💬 Kommentiere 1 für {home}, X für Unentschieden, 2 für {away} und dein genaues Ergebnis!\n🔔 Folge uns für einen Tipp vor jedem großen Spiel.\n{tags} {leagueTag} #prognose #fussball #shorts",
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
      ytTitle: "{home} vs {away} : prono ⚽ Qui gagne ? #shorts\n{away} peut-il battre {home} ? 🔮 Le ballon décide #shorts\n{home} vs {away} : qui l'emporte ? 🎲 #shorts\nQui gagne {home} vs {away} ? ⚽ Regarde jusqu'à la fin #shorts",
      ytDesc: "Qui gagne {home} - {away} ? 🤔 Notre jeu de physique (« {mode} ») a tranché. Regarde jusqu'à la fin pour voir le score ! 👀\n⏰ {subtitle}\n💬 Commente 1 pour {home}, X pour le nul, 2 pour {away}, et ton score exact !\n🔔 Abonne-toi pour un prono avant chaque grand match.\n{tags} {leagueTag} #prono #foot #shorts",
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
      ytTitle: "{home} vs {away}: pronostico ⚽ Chi vince? #shorts\nIl {away} può battere il {home}? 🔮 Decide il pallone #shorts\n{home} vs {away}: chi la spunta? 🎲 #shorts\nChi vince {home} vs {away}? ⚽ Guarda fino alla fine #shorts",
      ytDesc: "Chi vince {home} - {away}? 🤔 Il nostro gioco di fisica (\"{mode}\") ha deciso. Guarda fino alla fine per scoprire il risultato! 👀\n⏰ {subtitle}\n💬 Commenta 1 per {home}, X per il pareggio, 2 per {away}, e il tuo risultato esatto!\n🔔 Seguici per un pronostico prima di ogni big match.\n{tags} {leagueTag} #pronostico #calcio #shorts",
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
