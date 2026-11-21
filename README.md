# ⚽ Maç Tahmin Shorts

YouTube Shorts için **fizik tabanlı futbol skor tahmini videoları** üreten araç.
Takım adlarını yaz; araç logo, renk ve güç bilgisini bulur. Seçilen mini oyun oynanır ve
süre sonunda hangi takımın topu hedefe kaç kez ulaştıysa **skor tahmini** o olur.
Sonuç 1080×1920 dikey video (MP4, desteklenmezse WebM) olarak iner.

## Kurulum ve çalıştırma

Gereken tek şey **Node.js 18+** (<https://nodejs.org>, LTS sürümü). Otomatik kuyruk için tek bir paket
(`playwright-core`, Windows'taki Edge'i arka planda kullanır) gerekir; `baslat.bat` bunu ilk açılışta kendisi kurar.

**Windows:** Klasördeki `baslat.bat` dosyasına çift tıkla. Tarayıcı kendiliğinden açılır.
Açılan siyah pencereyi kapatma; araç o pencere açıkken çalışır.

**Terminalden** (her işletim sistemi):

```bash
node server.js
```

Ardından **Chrome** veya **Edge** ile <http://localhost:3000> adresini aç.
Kayıt sırasında sekme açık ve görünür kalmalı (tarayıcı arka plandaki sekmeyi yavaşlatır).

### Güncelleme

**Eski klasörü silme.** `data/` (YouTube bağlantısı, kuyruk) ve `output/` (üretilen videolar) klasörleri kaybolur.
Aracı kapat (siyah pencerede Ctrl + C) ve yeni sürümü eskisinin üzerine çıkar (PowerShell):

```powershell
Invoke-WebRequest "https://github.com/Bgr58/Test1/archive/refs/heads/claude/sleepy-archimedes-mzmfp9.zip" -OutFile "$HOME\Desktop\mac-tahmin.zip"
Expand-Archive "$HOME\Desktop\mac-tahmin.zip" -DestinationPath "$HOME\Desktop" -Force
```

`-Force` sadece aracın kendi dosyalarını yeniler; `data/` ve `output/` olduğu gibi kalır.

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
4. **Video dili:** Varsayılan **English**. Videodaki tüm yazılar, YouTube başlığı/açıklaması ve takvimden gelen alt başlık
   (ör. "Champions League • Wed 25 Nov, 20:00 UK", saat İngiltere saatiyle) İngilizce olur.
   İstersen Türkçe, Español, Português, Deutsch, Français, Italiano da seçilebilir.
   **Videodaki metinleri düzenle** bölümünden her yazıyı değiştirebilirsin. Buna gol bandı, kurtarış/direk yazıları,
   mod adları, bitiş ekranı, YouTube başlığı ve açıklaması dahil. Değişiklikler o dil için tarayıcıda saklanır
   ve "varsayılana döndür" ile sıfırlanır. `{home}`, `{away}`, `{score}`, `{mode}`, `{team}`, `{n}` gibi
   yer tutucular otomatik doldurulur.
5. **Önizle** ile izle, **Kaydet ve indir** ile videoyu al.
   **4 formatın hepsini üret** aynı maç için 4 farklı video üretir.
6. Kayıt bitince video ile birlikte **kapak görseli** (1080×1920 JPEG) de iner. Sonuç kartında
   hazır **Shorts başlığı ve açıklaması** (hashtag'li) var, tek tıkla kopyalanır.
   **Skor bilerek hiçbir yerde yazmaz:** kapakta "? – ?" var; başlıkta, açıklamada ve dosya adında skor yok.
   İzleyici skoru görmek için videoyu sonuna kadar izlemeli. Kayıt yapmadan kapak almak için **Sadece kapak indir** butonu var.
   Kapak metinleri ("WHO WINS?", "WATCH TILL THE END 👀") metin düzenleyiciden değiştirilebilir.

> **Seed:** Aynı seed + aynı ayarlar = birebir aynı maç ve skor. Boş bırakılırsa her seferinde rastgele seçilir. Kullanılan seed sonuç kartında yazar.

## 🤖 Otomatik kuyruk

1. **Seç:** "Günün maçları" listesinde maçların yanındaki **＋** ile maçları seç. Seçilenler "1 · Seçilen maçlar" listesine gelir.
   Tekrar tıklayınca (✓) ya da listedeki ✕ ile seçimden çıkar. **Seçmek üretimi başlatmaz.**
2. **Format ve ayarlar:** Her maç için görsel formatı seç ya da "Tümünün formatı" ile hepsine birden ver.
   🎲 Rastgele seçilirse formatlar sırayla dağıtılır. Her maça ayrıca bir **şans** seviyesi verilebilir (ya da "Tümünün şansı"):
   🎲 Tam şans (güç hiç etkilemez), Çoğu şans, Dengeli, Güç ağırlıklı, Güçlü favori. Seçilmezse paneldeki ortak "Güç etkisi" kullanılır.
   Örnek simülasyon (200 Elo fark + ev sahibi): "Güçlü favori"de favori ~%50–60 kazanır ama ~%20 kaybeder. **Video ve YouTube dili** (varsayılan English), oyun süresi,
   yükleme modu ve yayın zamanı da burada. Güç etkisi, ev sahibi avantajı ve düzenlenmiş metinler paneldeki ayarlardan alınır.
3. **Başlat:** "▶ Seçilen N maçı başlat" ile maçlar "2 · Kuyruk ve sonuçlar"a geçer ve arka planda
   (görünmez bir Edge/Chrome penceresinde) sırayla üretilir. Video başına yaklaşık 1 dakika sürer.
   Sırada bekleyen maçı ↩ ile seçilenlere geri alabilir (formatını değiştirmek için) ya da ✕ ile çıkarabilirsin.
   YouTube'a yüklenmiş bir maçı listeden çıkarmak videoyu YouTube'dan silmez.
4. Her maç için `output/<tarih>/<saat>_<ev>_vs_<deplasman>/` klasörüne şunlar kaydedilir:
   video, kapak ve `bilgi.txt` (YouTube başlık/açıklaması ve önerilen yayın saati).
5. **Yükleme** ayarı:
   - **Sadece üret:** Videoyu YouTube Studio'dan sen yüklersin. Panelde ve `bilgi.txt`'de yazan saate
     (varsayılan maçtan 60 dk önce) "Zamanla" ile planla.
   - **YouTube'a otomatik yükle:** Video, yayın saatine zamanlanmış olarak yüklenir. Yayına alma işini YouTube yapar,
     o saatte bilgisayarın açık olması gerekmez. Kurulum aşağıda.
6. Bilgisayar açılınca aracın kendiliğinden başlaması için `otomatik-baslat-ekle.bat` dosyasına bir kere çift tıkla.
   Kaldırmak için `otomatik-baslat-kaldir.bat`.

Bilgisayar kapalıyken maç saati gelirse o maç "Kaçırıldı" olur. Bilgisayar açılınca, başlamamış maçların videoları hemen üretilir.

## 📤 YouTube otomatik yükleme kurulumu (bir kerelik, ücretsiz)

> ⚠️ **Önemli:** Google, denetimden geçmemiş API projelerinden yüklenen videoları **"özel" olarak kilitler**
> ve bu videolar sonradan herkese açık yapılamaz. Bu yüzden önce kurulumu yap ve **denetim başvurusunu** gönder (6. adım).
> Onay gelene kadar "Sadece üret" modunu kullan.

1. <https://console.cloud.google.com> adresinde YouTube kanalının bağlı olduğu Google hesabıyla giriş yap ve **yeni proje** oluştur (ör. "Mac Tahmin").
2. **APIs & Services → Library** bölümünde **"YouTube Data API v3"** ara ve **Enable** de.
3. **OAuth consent screen** (Google Auth Platform) bölümünde:
   - Kullanıcı türü **External**, uygulama adı (ör. "Mac Tahmin"), destek e-postası ve geliştirici e-postası gir.
   - **Audience** bölümünde uygulamayı **"In production"** (Publish app) yap. *Testing* modunda izin 7 günde bir düşer.
4. **Credentials → Create credentials → OAuth client ID** → Application type: **Desktop app** → Create → **Download JSON**.
5. Panelde **Otomatik kuyruk → Yükleme: YouTube'a otomatik yükle** seç. Açılan kutuda **JSON dosyası seç → Kaydet → Google hesabıyla bağlan**.
   - Google "Bu uygulama doğrulanmadı" derse: **Gelişmiş → (uygulama adı)'na git** ve izin ver. Uygulama senin kendi uygulaman.
   - Birden çok kanalın varsa doğru kanalı seç. Panelde "Bağlı kanal: …" yazar.
6. **Denetim başvurusu:** "YouTube API Services – Audit and Quota Extension Form"
   (<https://support.google.com/youtube/contact/yt_api_form>). Kullanım amacı olarak kendi kanalına
   kendi ürettiğin videoları zamanlanmış yüklediğini anlat. Onay gelince "YouTube'a otomatik yükle" moduna geç.
   Klasörde bekleyen, henüz başlamamış maçların videoları da otomatik yüklenir.

Notlar:
- Varsayılan API kotası günde yaklaşık 6 video yüklemeye yeter; daha fazlası için aynı formdan kota artışı istenir.
- Kimlik bilgileri sadece bu bilgisayarda, `data/` klasöründe saklanır. Bu klasörü kimseyle paylaşma.
- Shorts kapağı API ile ayarlanamayabilir (YouTube reddederse panelde yazar). O durumda kapağı telefondaki YouTube uygulamasından ekle.

## 📊 Tahmin tuttu mu?

- Maç bittikten yaklaşık 2 saat sonra gerçek skor ESPN'den otomatik alınır ve tahminle karşılaştırılır
  (araç açıkken 5 dakikada bir kontrol eder; 🔄 ile hemen kontrol ettirebilirsin).
  - ✅ **Tam skor**: skor birebir tuttu
  - 🟡 **Sonuç tuttu**: kazanan ya da beraberlik (1/X/2) doğru, skor farklı
  - ❌ **Tutmadı**
  - ⏸ Ertelenen/iptal edilen maçlar sayılmaz
- **Tahmin karnesi** "Kuyruk ve sonuçlar"ın üstünde: maç sayısı, doğru sonuç yüzdesi, tam skor sayısı, son maçlar
  ve formata göre isabet (hangi oyunun daha iyi "tahmin ettiğini" görmek için).
- Her biten maçta 📋 butonu, kopyalanabilir bir **paylaşım metni** verir. Örnek:
  "✅ NAILED IT! We predicted Kosovo 0-0 Israel and it finished 0-0! 🔮 📊 Our record: 3/4 results right (75%)…".
  Topluluk gönderisi, sabit yorum ya da bir sonraki videonun açıklaması için kullanılabilir.
  Metinler videonun dilinde gelir ve metin düzenleyicideki "Tahmin takibi" bölümünden değiştirilebilir.
- **📅 Günün özeti:** Karnede gün seçip butona bas. O günün tüm sonuçları ve genel karne kopyalanır
  (YouTube → Oluştur → Gönderi oluştur'a yapıştırmak için).
- **Açıklamaların otomatik güncellenmesi:** Maç bitince videonun YouTube açıklamasının **başına** sonuç satırı ve karne eklenir;
  eski açıklama altında kalır, başlık ve etiketler değişmez.
  - Araçla yüklenen videolarda otomatik. **Elle yüklediğin** videolarda maçın yanındaki **🔗** ile Shorts linkini yapıştır.
  - Google'a ek izin gerekir: YouTube bağlıyken panel "🔄 Bağlantıyı yenile" der; bir kere tıklayıp izin ver.
    Bu izin, denetim onayı beklenirken de çalışır (sadece mevcut videoların açıklamasını düzenler).
  - Kapatmak için YouTube kutusundaki "Maç bitince video açıklamasının başına…" kutusunun işaretini kaldır.
- Kuyruktan üretilen videolar ve takvimden seçip panelde **"Kaydet ve indir"** ile ürettiğin videolar takibe girer.
  Takımları elle yazdığın (takvimden seçmediğin) videolar takip edilmez.

## 🎵 Müzik (telifsiz)

Panelde **Arka plan müziği** (kuyrukta **Müzik**) seçimi:

- **🎵 Dahili müzik (varsayılan):** Araç, enerjik bir elektronik parçayı (kick, clap, hi-hat, bas, arpej) **her videoda anlık besteler**.
  Hazır bir kayıt kullanılmadığı için **telif sorunu yoktur**. Her maçta tempo (124–142 BPM), ton ve akor dizisi farklıdır.
  Müzik videoyla senkron ilerler: girişte gerilim kurulur, başlama düdüğüyle ritim girer, son dakikalarda yoğunlaşır,
  son düdükte susar, tahmin ekranında kutlama çalar. Gollerde müzik kısılır, gol sesi öne çıkar.
- **📁 music klasöründen:** Aracın klasöründeki `music` klasörüne koyduğun parçalardan (.mp3 .m4a .ogg .wav) biri rastgele çalar.
  **Sadece kullanım hakkın olan müzikleri koy.** En güvenlisi YouTube Studio → **Ses kitaplığı**'ndan indirilen parçalardır.
  "Atıf gerekli" yazanlarda atıf satırını açıklamaya ekle. Trend/popüler şarkılar Content ID hak talebi alır, koyma.
- **Müzik yok.**

**Gol sesi:** Varsayılan olarak "GOOOOL!" diye bağıran tribün sentezlenir: farklı perdelerden 28 ses,
stadyum yankısı, uğultu ve alkış. Daha gerçekçi bir kayıt istersen `sounds` klasörüne adı `gol` ya da `goal` ile başlayan
bir ses dosyası koy (ör. YouTube Ses Kitaplığı → Ses efektleri → "crowd cheer"). Birden fazla dosya varsa her golde rastgele biri çalar.
Top/çarpışma sesleri kendi kanalında kısık tutulur.

Ses seviyesi YouTube'un normalizasyon seviyesine göre ayarlıdır (≈ -13/-14 LUFS, tepe ≤ -1 dB; kompresör + limiter).
YouTube uygulamasında yüklerken telifli "trend" müzik eklemek istersen, aracın müziğini "Müzik yok" yapıp müziği uygulamadan ekleyebilirsin.

## 📈 Etkileşim için yapılanlar

- **İlk kare:** Video ilk kareden itibaren logolar, VS ve büyük "WHO WINS?" ile açılır. Shorts'ta izleyici ilk saniyede karar verir.
- **Açıklama:** İlk satır soru ("Who wins …?"), ardından maç saati, **1 / X / 2 yorum anketi**
  ("Comment 1 for …, X for a draw, 2 for …"), takip çağrısı, takım + lig etiketleri (#ChampionsLeague, #PremierLeague …).
- **Başlık çeşitleri:** Her dilde 4 başlık var; maça göre biri seçilir, her video aynı başlıkla çıkmaz.
  Metin düzenleyicide "YouTube başlığı" kutusuna her satıra bir çeşit yazabilirsin.
- **Maç saati ligin ülkesinin saatiyle** yazılır: Süper Lig TRT, Premier League GMT/BST, LaLiga/Serie A/Bundesliga/Ligue 1 CET,
  Liga Portugal WET. Avrupa kupalarında ev sahibi takımın ülkesi, milli maçlarda ev sahibi ülke esas alınır; bilinmiyorsa CET.
- **Skor hiçbir yerde yazmaz** (kapak, başlık, açıklama, dosya adı). İzleyici skoru görmek için videoyu sonuna kadar izlemeli.

Elle yapman önerilenler: Videoyu yükledikten sonra ilk yorumu sen yaz ve sabitle (ör. "1, X or 2? 👇").
İlk saatte gelen yorumlara cevap ver. Maçtan sonra "Did we get it right?" diye bir topluluk gönderisi ya da kısa bir video paylaş.

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
baslat.bat              Windows için çift tıkla başlat (ilk açılışta gerekli bileşeni kurar)
otomatik-baslat-*.bat   bilgisayar açılınca otomatik başlatmayı ekle/kaldır
automation.js           otomatik kuyruk: arka planda üretim, klasöre kayıt, yayın zamanlama
youtube.js              YouTube Data API: Google ile bağlanma, zamanlanmış yükleme, kapak
public/render.html      kuyruk için görünmez üretici sayfa (js/autorender.js)
public/index.html       arayüz
public/js/app.js        arayüz mantığı, kayıt akışı
public/js/match.js      maç akışı (sabit adımlı, deterministik; Node'da da çalışır)
public/js/modes/*.js    4 oyun modu (fizik + çizim)
public/js/render.js     tabela, giriş/çıkış ekranları
public/js/strength.js   Elo/kadro değeri → oyun avantajı, isim eşleştirme
public/js/i18n.js       videodaki tüm metinler (dil paketleri) — yeni dil buraya eklenir
public/js/audio.js      sentez sesler
public/js/music.js      telifsiz sentez müzik motoru + music klasöründen çalma
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
