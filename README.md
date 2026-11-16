# ⚽ Maç Tahmin Shorts

YouTube Shorts için **fizik tabanlı futbol skor tahmini videoları** üreten araç.
Takım adlarını yaz; araç logo, renk ve güç bilgisini bulur. Seçilen mini oyun oynanır ve
süre sonunda hangi takımın topu hedefe kaç kez ulaştıysa **skor tahmini** o olur.
Sonuç 1080×1920 dikey video (MP4, desteklenmezse WebM) olarak iner.

## Kurulum ve çalıştırma

Gereken tek şey **Node.js 18+** (<https://nodejs.org>, LTS sürümü). Hiçbir npm paketi kurulmaz.

**Windows:** Klasördeki `baslat.bat` dosyasına çift tıkla. Tarayıcı kendiliğinden açılır.
Açılan siyah pencereyi kapatma; araç o pencere açıkken çalışır.

**Terminalden** (her işletim sistemi):

```bash
node server.js
```

Ardından **Chrome** veya **Edge** ile <http://localhost:3000> adresini aç.
Kayıt sırasında sekme açık ve görünür kalmalı (tarayıcı arka plandaki sekmeyi yavaşlatır).

## Veri kaynakları (hepsi ücretsiz, anahtar gerekmez)

| Ne | Kaynak |
| --- | --- |
| Takım listesi, logolar, forma renkleri, günün maçları | ESPN'in herkese açık site API'si |
| Kulüp gücü | [ClubElo](http://clubelo.com). Ulaşılamazsa lig puan durumundan tahmin edilir |
| Milli takım gücü | [eloratings.net](https://www.eloratings.net) |

Kapsam: **Süper Lig**, **Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Liga Portugal**,
**Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi** ve **milli takımlar** (Dünya Kupası, elemeler,
Uluslar Ligi, EURO, hazırlık maçları; yaklaşık 200 ülke).
Turnuva eklemek için `data.js` içindeki `COMPETITIONS` listesine ESPN lig kodunu eklemen yeterli.

> ESPN'in bu API'si resmî olarak belgelenmemiştir; ileride değişirse `data.js` güncellenmelidir.
> Büyük kulüplerin forma renkleri `data.js` içindeki `CLUB_COLORS` tablosundan gelir.
> Diğer takımlarda ESPN rengi kullanılır, o da anlamsızsa renk logodan çıkarılır.

## Kullanım

1. **📅 Günün maçları:** Tarihi seç (‹ › ile gün değiştir), istersen turnuvayı filtrele ve bir maça tıkla.
   İki takım, logolar, renkler, güç puanları ve alt başlık (ör. "Şampiyonlar Ligi • 25 Kasım 23:00") otomatik dolar.
   - Ya da takım kutusuna yazmaya başla (ör. "fener", "galata", "almanya"). **Açılır listeden** seç.
     Türkçe ülke adları da çalışır.
   - Listede olmayan bir takım için adı yaz ve **Logo yükle** ile logoyu kendin ekle.
     Renkler logodan otomatik çıkarılır, istersen elle değiştir.
   - **Kadro değeri (M€):** İsteğe bağlı. İki takım için de girilirse güç hesabına katılır.
2. **Oyun formatı:** 4 mod var. **Rastgele** seçeneği aynı formatı arka arkaya vermez.
3. **Güç etkisi:** %0 tamamen şanstır. Yükseldikçe güçlü takım hafif avantaj alır
   (daha hızlı oyuncular, biraz daha geniş kale vb.) ama zayıf takım yine kazanabilir.
   Güç **videoda gösterilmez**. Hesaplanan denge sadece panelde ("Arka plan güç dengesi") görünür.
4. **Video dili:** Türkçe, English, Español, Português, Deutsch, Français, Italiano.
   **Videodaki metinleri düzenle** bölümünden her yazıyı değiştirebilirsin. Buna gol bandı, kurtarış/direk yazıları,
   mod adları, bitiş ekranı, YouTube başlığı ve açıklaması dahil. Değişiklikler o dil için tarayıcıda saklanır
   ve "varsayılana döndür" ile sıfırlanır. `{home}`, `{away}`, `{score}`, `{mode}`, `{team}`, `{n}` gibi
   yer tutucular otomatik doldurulur.
5. **Önizle** ile izle, **Kaydet ve indir** ile videoyu al.
   **4 formatın hepsini üret** aynı maç için 4 farklı video üretir.
6. Sonuç kartında seçili dilde hazır **Shorts başlığı ve açıklaması** (hashtag'li) var, tek tıkla kopyalanır.

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
- **Oyun:** Skor tabelası, 1'–90' dakika sayacı ve ilerleme çubuğu.
  Gollerde GOOOL bandı, konfeti, ekran sarsıntısı, flaş ve tribün sesi.
  Kurtarış ve direk anlarında yazı ve "ooo" sesi çıkar.
- **Son:** Üç düdük, büyük skor, kazanan ya da beraberlik, gol dakikaları ve yorum çağrısı.

Tüm sesler Web Audio ile sentezlenir. Ses dosyası kullanılmadığı için telif sorunu yoktur.

## Yapı

```
server.js               statik sunucu + API uçları (/api/teams, /api/fixtures, /api/elo, /api/img)
data.js                 ESPN / ClubElo / eloratings veri katmanı, önbellek, kulüp renkleri
baslat.bat              Windows için çift tıkla başlat
public/index.html       arayüz
public/js/app.js        arayüz mantığı, kayıt akışı
public/js/match.js      maç akışı (sabit adımlı, deterministik; Node'da da çalışır)
public/js/modes/*.js    4 oyun modu (fizik + çizim)
public/js/render.js     tabela, giriş/çıkış ekranları
public/js/strength.js   Elo/kadro değeri → oyun avantajı, isim eşleştirme
public/js/i18n.js       videodaki tüm metinler (dil paketleri) — yeni dil buraya eklenir
public/js/audio.js      sentez sesler
public/js/recorder.js   MediaRecorder ile video kaydı
test/                   birim testleri (npm test)
```

## Notlar

- Transfermarkt'ın açık API'si yoktur ve sitesinin kazınması kullanım şartlarına aykırıdır.
  Bu yüzden otomatik güç kaynağı olarak açık veri olan ClubElo ve eloratings.net kullanılır.
  Kadro değerini istersen elle girebilirsin.
- Güç puanının nereden geldiği takım kutusunun altında yazar (ClubElo / eloratings.net / puan durumu tahmini).
  Her zaman elle değiştirebilirsin.
- Port değiştirmek için: Windows PowerShell'de `$env:PORT=8080; node server.js`, Mac/Linux'ta `PORT=8080 node server.js`.
- Logolar kulüplerin tescilli markalarıdır. Videolarda kullanırken YouTube politikalarını göz önünde bulundur.
