# Linux ve gerçek cihaz kabul kontrolü

Bu kontroller otomatik testlerin yerine geçmez. Gerçek NVR/NAS erişimi olmadan tamamlanmış sayılmaz. Mevcut cihaz parolalarını eski betikteki değerlerden yenileyin; testlerde eski arşiv dizinini kullanmayın.

## Ortam

- Linux, Node.js 22.13 veya üstü desteklenen LTS; `npm ci` başarılı.
- `DATA_DIR`, SQLite, tampon ve önizleme önbelleği yerel diskte. Yerel kayıt diski sağlıklı ve yeterli boş alana sahip.
- NAS mevcutsa Linux tarafından önceden bağlanmış; uygulama mount yapmaz. Mount kaynağı ve noktası `/proc/self/mountinfo` değerleriyle uyuşmalı; NAS arşiv dizini önceden oluşturulmuş olmalı.
- Uygulama hesabı yerel durum dizinlerine ve seçilen NAS alt dizinine erişebiliyor; NAS yolu symlink içermiyor.
- Yönetici girişi ve yetkisiz görüntü erişimi kontrol edildi.

## Cihazlar

1. Her iki NVR'yi arayüzden ekle; kullanılan kanalları seç. Test düğmesi varsayılan kanal 1'i dener; kanal 1 kullanılmıyorsa API'ye ilgili kanalı ver veya etkin kameranın çekimini izle.
2. Digest kimlik doğrulaması ve `/cgi-bin/snapshot.cgi?channel=N` yanıtını her cihazda doğrula. Desteklenmeyen üretici/kimlik doğrulama biçimi doğrulanmadan uyumlu kabul edilmez.
3. Yaklaşık 90 kamerayı etkinleştir; dört eşzamanlı istek sınırıyla bir turun tamamlandığını izle. Bir kanalın bağlantısını kes; diğerleri devam etmeli ve hata geçmişe yazılmalı.
4. Her NVR için gündüz/gece görüntü boyutlarını ve çizili maskeleri kontrol et. NVR saati ile uygulama çekim zamanı farklı olabilir; arama uygulama zamanıyla yapılır.

## NAS dayanıklılığı

1. Boş ve uygulamaya ayrılmış bir alt dizin seç. Ayarlardaki depo kimliğini kaydet, ardından **NAS depo kimliğini oluştur** düğmesini bir kez kullan. Mevcut farklı kimliğin üzerine yazılmamalı.
2. Çekim sırasında NAS erişimini kes. Yeni dosyalar yerel tampona yazılmalı; önceden aktarılmış görüntüler erişilemiyor görünmeli, kayıp sayılmamalı ve katalogdan silinmemeli.
3. NAS dosya çağrısını takılı bırakabilen izole bir test ortamında 30 saniye son tarihini kontrol et. Web, SQLite ve yerel çekim ilerlemeli. Çıkmayan yardımcı süreç yenileriyle çoğaltılmamalı. Kernel seviyesinde kesilemeyen I/O için OS müdahalesi gerekebilir; uygulama bunu iptal ettiğini iddia etmez.
4. NAS dönünce dosyaların checksum doğrulaması sonrası aktarıldığını ve yerel kopyaların ancak doğrulanmış katalog geçişinden sonra kaldırıldığını kontrol et.
5. Tampon kotasını kontrollü doldur: yeni çekimler atlanmalı, mevcut tek yerel kopyalar korunmalı ve geçmişte neden görünmeli. Bağlantı ve alan düzeldiğinde sonraki çekimler devam etmeli.
6. Yanlış mount, izin hatası ve okunamayan depo kimliği ayrı ayrı denendiğinde kayıp dosya işaretlenmemeli. Doğru sağlıklı depoda bir test dosyasını haricen kaldırınca iki ayrı kontrol turundan sonra kayıp işareti görünmeli; geçmiş kaydı kalmalı.

## Politika ve geçmiş

1. Gerçek görüntülerde tarih/saat yazısını çevreleyen maskeler çiz. Saat değişirken sahne sabitse benzer; maske dışında kişi/nesne değişince farklı çıkmalı.
2. `npm run calibrate -- first.jpg second.jpg masks.json` ile gündüz, gece, ışık geçişi ve değişen nesne örneklerini kıyasla. Maskeler normalize 0..1 koordinatlardır. Sayısal eşikler düşük/orta/yüksek önayarlarıdır, evrensel doğruluk garantisi değildir.
3. Önizleme beklenen sonucu verince kamerayı doğrulanmış işaretle ve genel sadeleştirmeyi aç. Maske/hassasiyet/koruma aralığı değişikliği kamera doğrulamasını sıfırlar.
4. Test verisiyle 168 saat korumasını ve saatlik örnekleri doğrula. Kota baskısı bu korumaları aşabilir.
5. %95 kullanımda sadeleştirme ardından en eskiden silme ile %90 hedefi doğrula. Yabancı dosyalara dokunulmamalı; başarısız silme kullanım sayacını düşürmemeli.
6. Süreci yazma/aktarım/silme sırasında sonlandır ve yeniden çalıştır. Yarım işler toparlanmalı; özetler iki kez sayılmamalı. Çalışılmayan dönem yaklaşık işaretlenmeli, elektrik kesintisi gibi bilinmeyen neden uydurulmamalı.
7. Görüntüler silindikten ve teknik loglar döndürüldükten sonra günlük özetler ve neden dönemleri hâlâ sorgulanabilmeli. Günlük sadeleştirme sayısı tek bir karenin kesin nedeni olarak sunulmamalı.

## Kanıt kaydı

Kabul sırasında tarih, Linux/Node sürümü, NVR modelleri/firmware, kullanılan kanallar, NAS filesystem/mount bilgisi, test sonuçları ve örnek karşılaştırma kararlarını kaydedin. Parola veya kimlik bilgili URL kaydetmeyin. Bu repoda yapılan geliştirme Windows'ta sahte NVR ve geçici dizinlerle doğrulanmıştır; gerçek Linux/NVR/NAS kabul sonuçları henüz yoktur.
