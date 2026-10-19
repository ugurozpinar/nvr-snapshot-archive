# Geliştirme

Donanımsız ilk deneme için [README hızlı başlangıcını](README.md#try-it-without-a-camera)
izleyin. En değerli başlangıç katkısı, [gerçek cihaz kabul listesinden](docs/acceptance.md)
model/firmware ve sonuçları içeren, kimlik bilgileri temizlenmiş bir rapordur.
Yeni cihaz adaptöründen önce beklenen HTTP/kimlik doğrulama davranışını issue'da tartışın.
Hata raporuna commit kimliğini, işletim sistemi/Node sürümünü, tekrar adımlarını,
beklenen ve gerçekleşen sonucu ve gizli veri içermeyen hata kodlarını ekleyin.

Bu uygulama tek süreçte çalışan, yerel SQLite kataloğu kullanan bir kamera arşividir.
Kurulum ve ortam değişkenleri için [README](README.md), modül sınırları için
[mimari rehberi](docs/architecture.md) okuyun.

## Yerel doğrulama

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

`npm run lint` tanımsız değişkenler ve global isim çakışmaları dahil statik kontrolleri
çalıştırır. `npm run format` biçimlendirmeyi düzeltir. `.editorconfig` ve `.gitattributes`,
editörler ve işletim sistemleri arasında UTF-8/LF kullanımını sabitler.
Testler `.env` dosyasını okumaz; geçici veri dizinleri ve sahte NVR kullanır.
Entegrasyon testlerinde dosya başına 60 saniye sınırı vardır. Yerel HTTP,
alt süreç ve atomik dosya yeniden adlandırma izinleri gerekir; bunları kısıtlayan
sandbox ortamları testleri çalıştıramaz.

CI, Linux üzerinde Node.js 22 ve 24 ile aynı kontrolleri ve Chromium senaryosunu çalıştırır.
Üretim donanımı kabulü ayrıca [kabul listesi](docs/acceptance.md) ile yapılır.

## Değişiklik kuralları

- Davranış değişikliğini veya hata düzeltmesini, sorunu gösteren bir testle destekleyin.
- HTTP uçlarına SQL eklemeyin; sorguları `src/db/repositories.js` içinde tutun.
- NAS dosya işlemlerini ana sürece taşımayın; supervisor/worker sınırını koruyun.
- Kamera parolalarını, anahtarları, gerçek görüntüleri veya `.env` dosyalarını commit etmeyin.
- Saklama/silme değişikliklerinde kesinti sonrası toparlanma ve kota testlerini çalıştırın.
- Mevcut veritabanı için değişiklik gerektiğinde eski migration dosyasını değiştirmek yerine
  `src/db/migrations/` altına yeni sayısal sürüm ekleyin; yükseltmeyi ve hata durumunda
  geri almayı test edin. Yürütücü dosyaları sayısal sırayla ve transaction içinde çalıştırır.
- PR açıklamasında kullanıcıya etkisini, doğrulamayı ve varsa dağıtım gereksinimini belirtin.

Lisans seçimi depo sahibine aittir; mevcut ISC paket metadatası, eksik lisans
dosyasının yerine geçmez.
