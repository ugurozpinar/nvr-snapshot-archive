# Kare — Kamera Arşivi

İki NVR ve yaklaşık 90 kameradan düzenli snapshot alan, kapasite sınırına göre arşivleyen ve yerel ağdaki tek yöneticiye web arayüzü sunan Node.js uygulaması.

- Varsayılan 15 dakika; kamera bazında çekim aralığı.
- Geçerli JPEG kontrolü, dört eşzamanlı çekim, sınırlı tekrar deneme.
- NAS tanımlı değilse proje içindeki `archive/`; tanımlıysa önce yerel tampon, ardından doğrulanmış NAS aktarımı.
- İlk yedi gün tam saklama; daha eski benzer görüntülerde maskeli sadeleştirme ve varsayılan saatlik koruma.
- Kapasite %95'e ulaştığında %90'a kadar en eski görüntüleri temizleme. Bu politika yedi günlük ve saatlik korumayı aşabilir.
- Kamera/tarih filtreleri, önizleme, indirme, kalıcı günlük özetler ve boşluk nedenleri.

## Gereksinimler ve çalıştırma

Linux üzerinde Node.js 22.12 veya üstü desteklenen LTS gerekir. NAS, işletim sistemi tarafından önceden bağlanır; uygulama mount yapmaz. Süreç yönetimi dışarıdan sağlanır; startup/PM2 kurulumu bu projenin kapsamı dışındadır.

```sh
npm ci
cp .env.example .env
```

İki bağımsız rastgele değer üretip `.env` içine yazın. Örneğin her değer için `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` kullanılabilir:

```dotenv
ARCHIVE_KEY=<64-hex-karakter>
SETUP_TOKEN=<ayri-rastgele-kurulum-anahtari>
HOST=0.0.0.0
PORT=3080
```

`npm start` ile çalıştırın, yerel ağdan `http://<bilgisayar-adresi>:3080` adresini açın. Varsayılan HOST yalnızca `127.0.0.1` dinler; `0.0.0.0` yerel ağ erişimini açar. İnternet yayını kapsam dışındadır.

İlk ekranda `SETUP_TOKEN` ve en az 12 karakterlik yönetici parolasıyla yöneticiyi oluşturun. Sonraki girişlerde yalnızca parola gerekir. İlk kurulum tek seferliktir; oturumlar sekiz saat sonra ve uygulama yeniden başladığında sona erer.

**Ayarlar** üzerinden kapasiteyi, NVR'leri ve kullanılan kanalları ekleyin. Varsayılan boş kurulum cihazlara bağlanmaz. Kapasite belirlenmeden çekim başlamaz. NVR parolaları `ARCHIVE_KEY` ile şifrelenir ve arayüzden geri okunamaz. Anahtar sonradan değiştirilirse mevcut NVR sırları çözülemez; anahtarı güvenle saklayın.

## Depolama

- `archive/<kamera-id>/YYYY/MM/DD/<UTC-zamanı>_<id>.jpg`: NAS yokken özgün arşiv.
- `data/catalog.sqlite`: yerel SQLite katalog, ayarlar ve kalıcı geçmiş.
- `data/spool/`: NAS'a aktarım bekleyen tek yerel kopyalar.
- `data/cache/`: en fazla 128 MiB yeniden üretilebilir önizleme önbelleği.

`DATA_DIR` ile `data/` konumu değiştirilebilir; **daima yerel diskte** olmalıdır. Yerel dosya sisteminde en az 256 MiB rezerv bırakılır; planlanan çekim için ayrıca en fazla 20 MiB görüntü payı aranır. Tampon kotası dolunca mevcut dosyalar korunur, yeni çekimler geçmişte açıklanarak atlanır. Başarılı yerel kayıt ile tamamlanmış NAS aktarımı ayrı durumlardır.

NAS için arşiv yolu, beklenen mount noktası/kaynağı, benzersiz depo kimliği ve tampon kotası girilir. Depo dizinini önceden oluşturun; ayarları kaydettikten sonra **NAS depo kimliğini oluştur** düğmesi doğru mount üzerinde kimlik dosyasını bir kez oluşturur. Mevcut kimlik üzerine yazılmaz. Katalogda görüntü varken depo değişikliği reddedilir; otomatik depo taşıma veya eski betiğin arşivini içe aktarma yoktur.

Tüm NAS dosya çağrıları ayrı süreçtedir. 30 saniyede yanıt alınamazsa ana uygulama beklemeyi bırakır. Yardımcı süreç kernel I/O içinde takılırsa yeni süreçler çoğaltılmaz; yerel disk ve tampon müsaitken çekim sürer. NAS'a erişilemiyor olması dosyanın kaybolduğu anlamına gelmez. Doğru depoda iki ayrı başarılı kontrolde yokluğu doğrulanan görüntü kayıp işaretlenir; katalog kaydı korunur.

NAS'ın paylaşılan dosya sisteminde 256 MiB rezerv ve aktarılacak görüntü kadar boş alan yoksa aktarım durur; özgün yerel kopya korunur. Son boş alan ölçümünün zamanı durum ekranında gösterilir. Doğrulanmış kayıp dosyanın eski boyutu katalogda kalır; fiziksel arşiv kota hesabına dahil edilmez. Erişilemeyen dosyalar ise kota hesabından çıkarılmaz.

## Sadeleştirme ve geçmiş

Özgün fotoğraf değiştirilmez. Kamera ekranında tarih/saat ve istenmeyen hareketli alanları dikdörtgenlerle dışlayın; görüntü üzerinde çizim veya yüzde koordinatları kullanılabilir. Aynı kameranın saklanmış iki görüntüsünü karşılaştırma önizlemesinde deneyin. Gündüz/gece örnekleri doğrulanmadan kamera sadeleştirmesini açmayın; varsayılan kapalıdır.

```sh
npm run calibrate -- first.jpg second.jpg masks.json
```

`masks.json` örneği: `[{"x":0.65,"y":0,"width":0.35,"height":0.1}]`. Son korunan görüntü referanstır; küçük biriken değişiklikler böylece kaybolmaz. Analiz hatası ve çözünürlük değişiminde görüntü korunur. Maske/hassasiyet/koruma aralığı değişince kamera yeniden doğrulanmalıdır. Silme geri alınamaz; snapshot'lar çekimler arasındaki olayları gösterme garantisi vermez.

Tek tek benzer silinen karelerin kaydı tutulmaz. Kamera/gün özetleri, politika sürümleri ve hata dönemleri kalıcıdır; uygulama kesintileri yaşam işaretinden yaklaşık belirlenir. Veri yoksa neden bilinmiyor olarak kalır. Özetler görüntü kotasıyla silinmez. Yerel veritabanı ve anahtarın yedeğini ayrıca alın; tek yerel diskin kaybına karşı ikinci kopya bu uygulamada otomatik oluşturulmaz.

Kamera aralığı değişikliği diğer kameraların takvimini ertelemez. Geciken ve çalışılmayan periyotlar ilgili günün atlanan çekim sayısına yazılır; ani kesintinin sınırları yaklaşık gösterilir. Çekim, yerel kalıcı dosya ve geçmiş kaydı aynı iş kimliğiyle toparlanır. Sadeleştirme ayarı değişirse henüz başlamamış silmeler eski politikayla devam etmez; dosya sistemine zaten gönderilmiş bir silme geri alınamaz.

Uygulama tek süreç/tek örnek olarak aynı `DATA_DIR` üzerinde çalıştırılmalıdır. NVR ve arşiv hataları kimliklerle yapılandırılmış stdout olaylarına yazılır; aynı kamera/neden için tekrarlanan olaylar dakika içinde birleştirilir. Teknik loglar kalıcı arşiv geçmişinin yerine geçmez.

## Geliştirme ve doğrulama

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Testler geçici yerel dizinler ve sahte NVR kullanır; cihazlara veya mevcut arşive erişmez. Gerçek Linux, NVR ve NAS kabulü için [kontrol listesi](docs/acceptance.md) kullanılır. HTTP `/cgi-bin/snapshot.cgi` ve Digest kimlik doğrulaması hedeflenir; ONVIF keşfi ve genel üretici uyumluluğu uygulanmamıştır.

[Tasarım](docs/superpowers/specs/2026-10-19-camera-archive-design.md) · [Uygulama planı](docs/superpowers/plans/2026-10-19-camera-archive.md)

Lisans notu: Mevcut paket metadatası ISC'dir; eski README MIT belirtiyordu ve repoda lisans dosyası yoktu. Bu geliştirme lisans seçimini değiştirmez; dağıtım için sahibinin lisansı netleştirmesi gerekir.
