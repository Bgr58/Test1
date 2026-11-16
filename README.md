# ⚽ Maç Tahmin Shorts

YouTube Shorts için **fizik tabanlı futbol skor tahmini videoları** üreten araç.
Takım adlarını yaz; araç logo, renk ve güç bilgisini bulur. Seçilen mini oyun oynanır ve
süre sonunda hangi takımın topu hedefe kaç kez ulaştıysa **skor tahmini** o olur.
Sonuç 1080×1920 dikey video (MP4, desteklenmezse WebM) olarak iner.

## Kurulum ve çalıştırma

Gereken tek şey **Node.js 18+**. Hiçbir npm paketi kurulmaz.

```bash
npm start
```

Ardından **Chrome** veya **Edge** ile <http://localhost:3000> adresini aç.
Kayıt sırasında sekme açık ve görünür kalmalı (tarayıcı arka plandaki sekmeyi yavaşlatır).

## Kullanım

1. Ev sahibi ve deplasman takımının adını yazıp **Bul**'a bas.
   - **Logo + renkler:** TheSportsDB'den gelir. Birden fazla eşleşme varsa listeden seç.
   - Logo bulunamazsa **Logo yükle** ile kendin yükle. Renkler logodan otomatik çıkarılır, istersen elle değiştir.
   - **Elo puanı:** [ClubElo](http://clubelo.com)'dan (açık veri) çekilir. İnternet yoksa yaklaşık bir yedek tablo kullanılır. Elle de girebilirsin.
   - **Kadro değeri (M€):** İsteğe bağlı. İki takım için de girilirse güç hesabına katılır.
2. **Oyun formatı:** 4 mod var. **Rastgele** seçeneği aynı formatı arka arkaya vermez.
3. **Güç etkisi:** %0 tamamen şanstır. Yükseldikçe güçlü takım hafif avantaj alır
   (daha hızlı oyuncular, biraz daha geniş kale vb.) ama zayıf takım yine kazanabilir.
4. **Önizle** ile izle, **Kaydet ve indir** ile videoyu al.
   **4 formatın hepsini üret** aynı maç için 4 farklı video üretir.
5. Sonuç kartında hazır **Shorts başlığı ve açıklaması** (hashtag'li) var, tek tıkla kopyalanır.

> **Seed:** Aynı seed + aynı ayarlar = birebir aynı maç ve skor. Boş bırakılırsa her seferinde rastgele seçilir. Kullanılan seed sonuç kartında yazar.

## Oyun formatları

| Mod | Nasıl gol olur? |
| --- | --- |
| **Dönen Halka** | Takım topları dönen bir halkanın içinde zıplar. Boşluktan kaçan top gol olur, yerine yenisi gelir. |
| **Plinko Kalesi** | Toplar çivilere çarparak düşer. Kalecinin koruduğu altın GOL cebine giren top gol olur. |
| **Mini Futbol** | Her takımda 1 kaleci + 3 oyuncu (logo diskleri) ve gerçek bir top. Top kaleye girerse gol. |
| **Engelli Parkur** | Ekran ikiye bölünür, her takımın aynı parkuru vardır. Pervaneler, tamponlar ve huniler var. Top kaleciyi geçip kaleye girerse gol, girmezse AUT. |

Her mod 45 sn'de ortalama **2,5–3 gol** üretecek şekilde simülasyonla ayarlandı.
Kontrol etmek için:

```bash
npm run simulate
```

## Video içeriği

- **Giriş (3 sn):** Logolar kayarak gelir, VS ve 3-2-1 geri sayım, başlama düdüğü.
- **Oyun:** Skor tabelası, 1'–90' dakika sayacı, ilerleme çubuğu ve güç yüzdesi.
  Gollerde GOOOL bandı, konfeti, ekran sarsıntısı, flaş ve tribün sesi.
  Kurtarış ve direk anlarında yazı ve "ooo" sesi çıkar.
- **Son:** Üç düdük, büyük skor, kazanan ya da beraberlik, gol dakikaları ve yorum çağrısı.

Tüm sesler Web Audio ile sentezlenir. Ses dosyası kullanılmadığı için telif sorunu yoktur.

## Yapı

```
server.js               statik sunucu + /api/team, /api/elo, /api/img proxy
public/index.html       arayüz
public/js/app.js        arayüz mantığı, kayıt akışı
public/js/match.js      maç akışı (sabit adımlı, deterministik; Node'da da çalışır)
public/js/modes/*.js    4 oyun modu (fizik + çizim)
public/js/render.js     tabela, giriş/çıkış ekranları
public/js/strength.js   Elo/kadro değeri → oyun avantajı, isim eşleştirme
public/js/audio.js      sentez sesler
public/js/recorder.js   MediaRecorder ile video kaydı
test/                   birim testleri (npm test)
```

## Notlar

- Transfermarkt'ın açık API'si yoktur ve sitesinin kazınması kullanım şartlarına aykırıdır.
  Bu yüzden otomatik güç kaynağı olarak açık veri olan ClubElo kullanılır.
  Kadro değerini istersen elle girebilirsin.
- ClubElo yalnızca Avrupa kulüplerini kapsar. Milli takımlar ve diğer ligler için Elo'yu elle gir
  (ör. eloratings.net değerleri) ya da boş bırak (eşit güç).
- TheSportsDB'nin ücretsiz anahtarı (`3`) varsayılandır. Kendi anahtarın varsa:
  `SPORTSDB_KEY=xxx npm start`. Port değiştirmek için: `PORT=8080 npm start`.
- Logolar kulüplerin tescilli markalarıdır. Videolarda kullanırken YouTube politikalarını göz önünde bulundur.
