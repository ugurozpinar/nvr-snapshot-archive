# Kamera arşivi — uygulama teslim kaydı

19 Ekim 2026. Dal: `codex/camera-archive`; başlangıç: `aaca367`.

## Teslim

Planın 11 yazılım görevi uygulandı: yerel SQLite katalog ve sır şifreleme; doğrulanmış snapshot adaptörü; önce yerelde kalıcı kayıt; kalıcı geçmiş; dört eşzamanlı çekim; ayrı süreçte NAS; maskeli sadeleştirme; kapasite temizliği; yönetici API'si; Türkçe web ekranları; uygulama bileşimi ve toparlanma. Startup/PM2 kurulumu eklenmedi. Eski mount/shell silme komutları ve kaynak kod parolaları kaldırıldı.

## Doğrulama

- `npm test`: 31 entegrasyon/hata testi; geçici dizinler, sahte HTTP NVR, gerçek SQLite/Sharp ve sahte/takılan NAS taşıması.
- `npm run test:browser`: gerçek Chromium'da kurulum/giriş, 90 kamera, son görüntü önizlemesi, arşiv tarama, indirme bağlantısı, geçmiş açıklaması, kamera aralığı, maske çizimi, dar ekran ve çıkış.
- Üretim bağımlılıklarının npm audit sonucu: bilinen açık bulunmadı.
- Kaynaklar Prettier ile biçimlendirildi; diff boşluk kontrolü yapıldı.
- Ortam: Windows, Node.js 22.23.3. Linux fsync/mount davranışı ve gerçek NVR/NAS erişimi bu ortamda doğrulanmadı; [kabul kontrolü](acceptance.md) dağıtım öncesinde uygulanmalı.

## Bağımsız inceleme ve düzeltmeler

Bağımsız salt okunur inceleme `aaca367..95fa7e8` aralığında yapıldı. Önemli bulgular düzeltme öncesinde hata testleriyle yeniden üretildi; düzeltme sonrasında tam test takımı çalıştırıldı:

1. Eşzamanlı yazmalar için kota rezervasyonu artık ilk dosya sistemi beklemesinden önce kalıcı SQLite niyetiyle yapılıyor.
2. Sadeleştirme, analiz/silme ve imleç güncellemesinde politika sürümünü kontrol ediyor; ayar değişikliğinde eski politika sürdürülmüyor.
3. Çekim niyeti ile görüntü aynı kimliği kullanıyor; kaydedilmiş dosya çökme sonrasında başarısız sayılmıyor.
4. Ayar yenileme yalnızca değişen kamera takvimlerini değiştiriyor.
5. Kaçırılan periyotlar yerel gün sınırlarına göre planlanan/atlanan sayımlarına ekleniyor.
6. NAS izin/mount/depo hatası veya yardımcı süreç çıkışı erişilebilirlik bilgisini geçersiz kılıyor.
7. Dosya kaybı kanıtı iki farklı başarılı sağlık turuna bağlı; salt dosya işlem numarası kanıt sayılmıyor.
8. Paylaşılan NAS boş alanı aktarım girişinde kontrol ediliyor ve son ölçüm arayüzde sunuluyor.
9. Eşzamanlı arşiv okumaları sınırlı NAS kuyruğuna alınıyor; kayıp dosya olayı her kontrolde çoğaltılmıyor.
10. Silme sonrası katalog işlemi kesintisinde günlük özet iki kez sayılmıyor. Tampon doluluğu kamera durumunda görünür.

## Uygulama sırasında alınan kararlar

Kararlar uygulama günlüğündeki sırayla:

1. Temiz mevcut checkout yeni özellik dalında kullanıldı; ek worktree açılmadı. Sonuç: değişiklikler bu checkout'ta görülebilir, master dalı değişmedi.
2. PowerShell ortamında POSIX yardımcı betikleri yerine aynı plan için manuel yürütme günlüğü kullanıldı. Sonuç: test/commit kanıtları bu teslim belgesinde ve Git'te korunuyor.
3. Dosyanın yerleşimi (`local/pending/transferred`) ile erişilebilirliği ayrı tutuldu. Sonuç: geçici NAS hatası yerleşimi veya kayıp kanıtını değiştirmiyor.
4. Yerel toparlanma ayrı bir yönlendirme dosyası yerine yerel depo modülünde tutuldu. Sonuç: kalıcılık sorumluluğu tek yerde, davranış farkı yok.
5. Katalogda arşiv varken depo kimliği/yolu değiştirme reddediliyor. Sonuç: sessiz taşıma yok; gelecekte açık bir arşiv taşıma iş akışı gerekir.
6. Kaynak okunabilirliği için Prettier geliştirme bağımlılığı eklendi; üretimde çalıştırılması gerekmiyor.
7. İncelemede düşük öncelikli sayılan sağlık turu kanıtı ve NAS boş alanı konuları bu uygulamanın veri güvenilirliği için önemli kabul edilip düzeltildi.
8. Gerçek Linux kernel I/O, donanım kimlik doğrulaması, NAS kalıcılığı ve sahne eşikleri dağıtım kabulü olarak bırakıldı. Sonuç: yazılım testleri donanım uyumluluğu veya güvenli sahne eşiği garantisi sayılmaz.

Ertelenmiş küçük kod inceleme bulgusu yok. Lisans seçimi değiştirilmedi; mevcut paket metadatası ISC, eski README MIT idi ve lisans dosyası yoktu. Gerçek kamera kalibrasyonu tamamlanana kadar benzerlik silmesi varsayılan kapalıdır. Eski arşiv otomatik içe aktarılmaz veya temizlenmez.

## Başlangıç hatası düzeltmesi

Geçersiz `ARCHIVE_KEY` başlangıçta genel bir hata kodunun arkasında gizleniyordu. Her iki giriş dosyası artık sır değerlerini yazdırmadan `INVALID_ARCHIVE_KEY` ve gerekli 64 hexadecimal karakter açıklamasını gösteriyor. Port, izin ve disk doluluğu için de sabit güvenli açıklamalar var. Gerçek giriş dosyalarında hata çıktısı regresyon testleri eklendi; tam takım 31/31 geçti. Yerel .env düzeltildikten sonra uygulamanın 3080 portunda başlatılıp kontrollü kapatılması ayrıca doğrulandı.
