# Kamera görüntüsü arşivi — tasarım

## Amaç ve başarı ölçütleri

İki NVR üzerinden yaklaşık 90 kameranın görüntülerini, video kayıtlarının yaklaşık iki aylık ömründen daha uzun süre ve daha az depolamayla saklamak. Öncelik sırası: geçmiş bir güne ait görüntü bulmak, zaman içindeki değişimi izlemek, olay incelemek.

Başarı; saklanan görüntülere kamera ve tarih üzerinden hızlı erişmek, kamera hatalarını görünür kılmak, kapasiteyi aşmadan çalışmak ve yeniden başlatmalarda tutarlı arşiv korumaktır. Snapshot arşivi, çekimler arasındaki olayları kaydetme garantisi vermez.

## Ortam ve kapsam

- Sürekli açık Linux bilgisayar; süreç yaşam döngüsü PM2 tarafından yönetilir.
- Yalnızca yerel ağda çalışan web arayüzü ve tek yönetici hesabı.
- Tek Node.js uygulaması, yerel SQLite veritabanı ve dosya tabanlı görüntü deposu.
- Startup, servis kurulumu ve PM2 yapılandırması kapsam dışıdır.
- Çoklu kullanıcı, internet erişimi, nesne tanıma, video üretimi ve ikinci arşiv kopyası ilk sürümün dışındadır.

Mevcut betik HTTP snapshot uç noktasını kullanır. İlk sürüm mevcut NVR'lerin snapshot erişimini korur; ONVIF keşfi veya tüm üreticiler için uyumluluk vaadi içermez. Cihaz erişimi ayrı bir adaptör arayüzü arkasında tutulur.

## Mimari ve sorumluluklar

Tek uygulama içinde birbirinden ayrılmış bileşenler; NAS dosya sistemi işlemleri ayrı yardımcı süreçte yürütülür:

1. **Cihaz adaptörü:** NVR kimlik doğrulaması ve kanal görüntüsü alma. Diğer bileşenler cihaz URL ayrıntılarını bilmez.
2. **Çekim zamanlayıcısı:** Kamera aralıkları, sınırlı eşzamanlılık, zaman aşımı ve tekrar deneme. Kamera başına aynı anda tek çekim.
3. **Arşiv deposu:** Geçici dosya, doğrulama, nihai dosyaya geçiş, yerel/NAS konumları ve aktarım.
4. **Arşiv kataloğu:** SQLite üzerinden ayarlar, saklanan görüntü bilgileri ve bekleyen aktarımlar.
5. **Sadeleştirme ve kapasite işleri:** Yaş, benzerlik, korunacak örnekler ve alan sınırlarına göre silme.
6. **Web/API:** Tek yönetici oturumu, ayarlar, durum ve sayfalı arşiv sorguları.

SQLite ve uygulama durumu yerel diskte tutulur; veritabanı NAS'a yerleştirilmez. Görüntü sorguları dosya sistemi taraması yerine katalogdan yapılır. Arka plan işleri sınırlı gruplarla ilerler; çekim ve web isteklerini bloke etmez.

## Kamera ve NVR ayarları

NVR için ad, adres, erişim bilgileri; kamera için NVR, kanal, benzersiz kimlik, görünen ad ve etkinlik durumu saklanır. Kameralar arayüzden kanal aralığıyla toplu eklenebilir ve tek tek düzenlenebilir. İlk kurulumda mevcut 104 kanalın tamamı otomatik etkinleştirilmez; gerçek kullanılan kanallar seçilir.

Varsayılan çekim aralığı 15 dakikadır; kamera bazında değiştirilebilir. Ayar değişikliği uygulama yeniden başlatılmadan gelecek çekimlere uygulanır. Başarısız veya kapalı bir kamera diğerlerini durdurmaz.

Başlangıç varsayılanları: en fazla dört eşzamanlı istek, 20 saniye istek zaman aşımı, başarısız çekim başına en fazla iki ek deneme ve aralarında 15/30 saniye bekleme. Sonraki periyotla çakışan işler biriktirilmez. Yeniden başlatmada geçmiş tüm periyotları telafi etmeye çalışmak yerine güncel çekim takvimi başlatılır.

## Çekim ve kayıt akışı

1. Zamanı gelen kamera için çekim işi alınır.
2. HTTP başarısı, içerik boyutu ve görüntünün çözümlenebilirliği kontrol edilir; HTML hata yanıtı JPG olarak saklanmaz.
3. Dosya her zaman önce yerel dosya sistemi üzerinde geçici adla yazılır, diske kalıcılığı sağlanır ve kapatılır. Çekim yolu hiçbir NAS dosya sistemi çağrısı beklemez.
4. Dosya yerelde atomik yeniden adlandırmayla son adına geçirilir, ardından katalog kaydı tamamlanır. NAS kullanılıyorsa kalıcı aktarım kuyruğuna eklenir; kullanılmıyorsa bu dosya yerel ana arşivdir.
5. Kamera son başarı/hata bilgisi güncellenir. Yerelde güvenle kaydedilen çekim başarılıdır; NAS'a aktarımın tamamlanması ayrı durumdur.

Dosya yazma ve veritabanı işlemi tek atomik işlem olmadığı için kayıt durumları ve başlangıç uzlaştırması kullanılır. Tamamlanmamış yerel dosyalar ve kataloglanmamış tamamlanmış yerel dosyalar toparlanır. NAS uzlaştırması yalnızca doğrulanmış erişim sırasında yapılır; erişim başarısızlığı kayıp dosya olarak yorumlanmaz. Yerel bekleyen ve NAS'a aktarılmış görüntüler ayrı durumlarla gösterilir.

Yol düzeni: `<arşiv-kökü>/<kamera-kimliği>/YYYY/MM/DD/<UTC-zamanı>_<benzersiz-kimlik>.jpg`. Kimlikler yol için güvenli uygulama üretimi değerlerdir. Katalogda zaman UTC, arayüzde varsayılan gösterim Europe/Istanbul'dur. NVR'nin görüntü üzerine bastığı saat değiştirilmez; arama zamanı uygulamanın çekim zamanıdır.

## NAS ve yerel depolama

NAS yolu tanımlıysa ana arşiv orasıdır; tanımlı değilse proje kökündeki `archive/` kullanılır. NAS, Linux üzerinde önceden erişilebilir bir dosya sistemi yolu olarak sağlanır. Uygulama mount komutu çalıştırmaz ve NAS paylaşımını bağlama kurulumu yapmaz.

NAS açıkken de kapalıyken de çekimler önce kapasitesi sınırlı yerel bekleme alanına yazılır. Aktarım, okuma, listeleme, boş alan kontrolü ve silme dahil tüm NAS işlemleri ayrı yardımcı süreçten geçer; ana süreç doğrudan NAS'a `stat` veya dosya erişimi yapmaz. İş başına varsayılan 30 saniye son tarih vardır. Süre aşımında ana süreç beklemeyi bırakır, NAS'ı erişilemez işaretler ve yeni NAS işleri göndermez. Bekleyen yerel görüntüler korunur; çekim zamanlayıcısı ve yerel SQLite bu çağrıyı beklemez.

Bir JavaScript Promise zaman aşımı işletim sisteminde takılan dosya işlemini iptal etmez. Yardımcı sürece sonlandırma gönderilir; Linux'ta kesilemeyen I/O durumunda çıkışı garanti edilmez. Sonlanmamış NAS yardımcı süreci varken yeni yardımcı süreçler çoğaltılmaz; açık işler ve kaynak kullanımı sınırlanır, durum arayüzde gösterilir. Süreç çıkmadan NAS çalışması yeniden başlatılmaz; gerekirse işletim sistemi düzeyinde müdahale gerekir. Yerel disk sağlıklı, yazılabilir ve tampon sınırı içinde olduğu sürece NAS'ın takılması yeni çekimlerin yerelde saklanmasını engellemez.

NAS yapılandırmasında beklenen mount kimliği ve uygulamaya ait depo kimliği doğrulanır; bağlantısı düşmüş mount klasörünün yerel diske sessizce yazması veya başka depoyla karışması önlenir. Bağlantı dönünce dosyalar NAS'ta geçici ada kopyalanır, boyut ve checksum doğrulanır, diske kalıcılığı sağlanır, son adına geçirilir ve katalog güncellenir; ancak bundan sonra yerel kopya kaldırılır. Tekrarlanan aktarım aynı görüntüyü çoğaltmaz. Belirsiz sonuçlu işlem, yeniden erişimde aynı görüntü kimliğiyle uzlaştırılır.

NAS'taki özgün dosya yokken yerelde bekleyen görüntüler de arayüzden açılabilir. NAS kesintisi ve aktarım kuyruğu görünür olur. Bekleme alanı dolarsa mevcut bekleyen dosyalar korunur, yeni çekimlerin kaydı duraklatılır ve açık hata gösterilir; sınırsız yerel disk kullanımı yapılmaz.

### Erişilememe ve doğrulanmış dosya kaybı

Depo erişilebilirliği ile görüntü varlığı ayrı durumlar olarak saklanır. NAS kesintisinde görüntü katalog kayıtları, bilinen boyutlar ve son doğrulama zamanları korunur; görüntü yalnızca geçici olarak erişilemiyor gösterilir. Zaman aşımı, izin hatası, I/O hatası veya yanlış mount dosya kaybı değildir. Önbellekte önizlemesi varsa gösterilebilir; özgün görüntünün erişilemediği ayrıca belirtilir.

Bir dosya ancak beklenen NAS/depo kimliği doğrulanmış, depo sağlık kontrolü başarılı olmuş ve aynı yolda iki ayrı başarılı erişim turunda `ENOENT` alınmışsa doğrulanmış kayıp sayılır. Sonrasında katalog kaydı sessizce silinmez; kayıp durumu ve doğrulama zamanı korunur. Okuma başarısızlığında varsayılan sonuç bilinmiyor/erişilemiyor olur. NAS kesikken sadeleştirme, NAS temizliği ve kayıp tespiti durur; silme tamamlanmadan katalog veya kullanım sayacı silinmiş gibi güncellenmez. Kuyrukta bekleyen tek yerel kopyalar kapasite temizliğine dahil edilmez.

## Kapasite ve saklama politikası

Saklama süresi sabit değildir; yönetici arşive ayrılan kapasiteyi belirler ve sonra değiştirebilir. Henüz kapasite seçilmediğinden ilk kurulumda bu değer girilmeden otomatik çekim başlamaz. NAS kullanılacaksa yerel bekleme alanı sınırı da girilir. Depolama adresi ve erişim bilgileri olmadan çekim etkinleştirilmez.

Uygulama yalnızca kendi katalogladığı arşiv dosyalarını siler; NAS'taki diğer dosyalara dokunmaz. Kapasite arşiv dosyalarının toplam boyutudur. Ayrıca hedef dosya sisteminin boş alanı izlenir; paylaşılan disk doluluğu da yazmayı durdurabilir.

İlk temizlik eşiği ayrılan kapasitenin %95'i, hedef %90'ıdır. Önce yedi günden eski görüntüler sadeleştirilir; alan hâlâ yetersizse çekim zamanı en eski olan görüntüler kamera ayrımı olmadan silinir. Kapasite zorunluluğu ilk yedi gün içindeki görüntüleri ve normal sadeleştirmede korunacak saatlik örnekleri de silebilir. Yedi gün mutlak garanti değildir.

Arayüz toplam kullanım, boş alan, mevcut en eski/en yeni görüntü tarihleri ve yakın dönemin ölçülen boyut/sıklık değerlerinden tahmini arşiv süresi gösterir. Tahmin açıkça tahmin olarak sunulur; sadeleştirme oranı değiştikçe güncellenir. Boş alan güvenli yazmaya yetmediğinde hata döngüsüne girmek yerine kayıt duraklatılır ve durum gösterilir.

## Yedi gün sonrası benzerlik sadeleştirmesi

İlk yedi gün tüm başarılı çekimler saklanır. Yedi gün, görüntünün çekiminden itibaren geçen 168 saattir. Daha eski görüntüler kamera içinde zaman sırasıyla işlenir; aday her zaman son korunan görüntüyle karşılaştırılır. Bu, küçük değişikliklerin zaman içinde birikip fark edilmesini sağlar.

Orijinal görüntü değiştirilmez. Karşılaştırma kopyaları aynı ölçekte hazırlanır; kameraya özel dikdörtgen maskeler uygulanır. Tarih/saat yazısı, hareketli logo, ağaç veya yol gibi alanlar bu maskelerle yok sayılabilir. Maskeler görüntü çözünürlüğünden bağımsız normalize koordinatlarla saklanır. Tam görüntüyü dışlayan maske kabul edilmez. Tarih/saat için otomatik OCR ilk sürümde yoktur; alan yönetici tarafından seçilir.

Başlangıç yöntemi: küçültülmüş gri ton görüntülerde hafif gürültü azaltma sonrasında piksel farkı ve değişen alan oranı. Kamera bazında hassasiyet ayarı ve iki kare üzerinde karşılaştırma önizlemesi bulunur. Sadece dosya boyutu veya dosya hash'i benzerlik ölçütü değildir. Sayısal varsayılan eşikler gerçek kameralardan alınan gündüz/gece örnekleriyle doğrulanır; güvenli başlangıç davranışı şüpheli kareyi korumaktır.

Sahne benzer olsa da varsayılan olarak en fazla bir saat arayla bir görüntü korunur. Koruma aralığı kamera bazında değiştirilebilir; çekim aralığından kısa ayarlanamaz. Kamera çevrimdışı kaldığında mevcut olmayan görüntüler üretilemez; saatlik koruma yalnızca başarılı çekimler için geçerlidir. Çözünürlük değişimi, karşılaştırma hatası veya yetersiz analiz verisinde aday korunur.

Benzerlik nedeniyle silinen çekimler için ayrı olay veya görüntü kaydı tutulmaz; dosya ve katalog girdisi kaldırılır. Bunun yerine aşağıdaki dönem özetleri tutulur. Ayar değişiklikleri silinmiş görüntüleri geri getirmez ve gelecek sadeleştirmelere uygulanır. Bu işlem geri alınamaz; arayüz politika açıklamasında bunu belirtir.

## Geçmiş boşluklarının açıklanması

Yerel SQLite'ta kalıcı kamera durum dönemleri ve kamera/gün özetleri tutulur; bunlar döndürülen teknik loglara bağlı değildir. Başlangıç/bitiş zamanı, neden ve etkilenen kamera veya depo kaydedilir. Nedenler: kamera/NVR erişim hatası, kimlik doğrulama hatası, geçersiz görüntü, yerel yazma hatası, tampon doluluğu, yönetici tarafından kapatma, uygulama çalışmıyor, benzerlik sadeleştirmesi, kapasite temizliği ve doğrulanmış dosya kaybı. NAS kesintisi ayrıca erişim olayıdır; yerel çekim sürdüyse çekim boşluğu olarak gösterilmez.

Kamera/gün özetinde planlanan, başarılı, başarısız ve atlanan çekim sayıları, nedenlere göre sayılar, benzerlik ve kapasite nedeniyle silinen görüntü sayıları ve bu işlemlerin kapsadığı zaman aralığı bulunur. Çekim aralığı/etkinlik ayarlarının tarihçesi ve sadeleştirmede kullanılan politika sürümü saklanır. Tek karelik benzerlik kayıtları tutulmadığı için günlük silme sayıları belirli bir eksik karenin kesin nedeni olarak sunulmaz; arayüz bu dönem için sadeleştirme uygulandığını belirtir. Hata dönemleri ve doğrulanmış kayıplar biliniyorsa daha kesin açıklama gösterilir. Kanıt yoksa neden bilinmiyor olarak kalır.

Uygulama yerel veritabanına dakikada bir yaşam işareti ve düzgün kapanış zamanı yazar. Sonraki açılışta çalışılmayan dönem son bilinen yaşam işareti/kapanış ile açılış arasında işaretlenir; ani kesinti sınırı yaklaşık olarak gösterilir ve elektrik kesintisi gibi kanıtlanmamış nedenler uydurulmaz. Her çekim başlamadan yerel iş kaydı oluşturulur; tamamlanmamış iş yeniden açılışta yarıda kalmış olarak hesaba katılır, günlük özet tamamlanınca tek çekim iş kaydı silinebilir.

Özetler ve durum dönemleri ilgili görüntüler kapasite nedeniyle silinse de korunur; görüntü kotasıyla birlikte otomatik temizlenmez. Diskte büyümeleri görünür olur. Yerel SQLite yazılamıyorsa ayrıntılı neden kaydı garanti edilemez; uygulama sağlıksız duruma geçer, loglar ve sonraki yaşam işareti boşluğu yalnızca eldeki kanıtı sağlar.

## Web arayüzü

### Genel durum

Kamera listesi, son başarılı görüntü ve zamanı, son hata, aktif/kapalı durum, NAS erişimi, bekleyen aktarım sayısı/boyutu, arşiv kullanımı ve tahmini geçmiş uzunluğu. Tekrarlanan çekim hataları kamera bazında görünür olur; bu durumlar için harici bildirim entegrasyonu ilk sürümde yoktur.

### Arşiv

Kamera ve tarih filtreleri, sayfalı küçük önizlemeler, büyük görüntü, önceki/sonraki saklanan görüntüye geçiş ve özgün görüntüyü indirme. Tarih filtresi gösterim saat dilimine göre çalışır. Görüntünün çekim zamanı ve kamera adı gösterilir. Silinmiş benzer çekimler için tek karelik zaman çizelgesi satırı veya yer tutucu üretilmez. Seçilen dönemdeki durum olayları ve günlük özetler ayrı bir geçmiş açıklaması görünümünde gösterilir; erişilemeyen NAS dosyaları silinmiş veya hiç çekilmemiş görüntülerle karıştırılmaz.

Önizlemeler talep üzerine üretilir ve ayrı boyutu sınırlı yerel önbellekte tutulur; önbellek temizlenebilir ve özgün arşivin tek kopyası değildir. UI tüm fotoğrafları bir defada yüklemez.

### Ayarlar

NVR/kamera yönetimi, bağlantı testi, çekim aralıkları, arşiv yolu ve kapasite, NAS bekleme alanı kapasitesi, benzerlik hassasiyeti, saatlik koruma aralığı ve görüntü üzerinde maske çizme. Varsayılan yedi günlük tam saklama ilk sürümde sabittir. Henüz silinmemiş iki görüntüyle karşılaştırma önizlemesi yapılabilir.

## Güvenlik ve hata yönetimi

Tek yönetici parolası güvenli parola hash'i olarak saklanır. Oturum çerezleri HttpOnly ve SameSite kullanır; ayar değişikliklerinde CSRF koruması uygulanır. Oturum açılmadan görüntülere veya ayarlara erişilmez. API dosya yollarını istemciden doğrudan kabul etmez; görüntüler katalog kimliğiyle sunulur.

NVR sırları sürüm kontrolüne veya loglara yazılmaz. Kalıcı kimlik bilgileri yerel veritabanında şifrelenir; ana anahtar uygulama ortamından sağlanır. Eski betikteki açık parolalar yeni yapıya taşınmaz ve kullanım öncesinde yenilenmelidir. Kimlik bilgileri arayüzden geri okunabilir açık metin olarak verilmez.

Günlükler yapılandırılmıştır; çekim/aktarım/temizlik hatalarında kamera veya iş kimliği içerir, parola ve kimlik bilgili URL içermez. Günlükler sınırsız büyütülmez. Harici log rotasyonu ve PM2 ayarları bu spec'in dışındadır.

Çekim ile silme/aktarım aynı görüntü üzerinde çakışmaz. Dosya veya veritabanı hatası uygulamanın tüm kamera kuyruğunu düşürmez. Uygulama kapanış sinyalinde yeni iş almayı durdurur, devam eden işlere sınırlı süre tanır; sonraki açılış uzlaştırma yapar.

## Doğrulama ve kabul senaryoları

- İki NVR ve yaklaşık 90 etkin kamera için farklı aralıklar uygulanır; bozuk bir kamera diğerlerini durdurmaz.
- Sahte NVR ile zaman aşımı, kimlik doğrulama hatası, HTML yanıtı ve kesilen görüntü denenir; başarısız çekim tamamlanmış JPG görünmez.
- Disk yazma hatası ve süreç kesintisinden sonra geçici dosya/katalog uzlaştırması doğrulanır.
- NAS kesilirken yerel kuyruk oluşur; geri gelince doğrulanmış aktarım yapılır. Kuyruk sınırında yeni kayıt durur; mevcut dosyalar kaybolmaz.
- NAS dosya işlemi süresiz bekletilerek sınanır: 30 saniye içinde kontrol ana uygulamaya döner; yeterli yerel alan varken sonraki çekimler ve web/API çalışır. Sonlandırılamayan yardımcı süreçte yeni süreçler birikmez.
- NAS yokken, yanlış mount varken veya izin hatasında hiçbir görüntü kayıp sayılmaz ve katalogdan çıkarılmaz. Sağlıklı doğru depoda iki turda yokluğu doğrulanan dosya kayıp olarak işaretlenir; geçmiş kaydı korunur.
- Kamera arızası, tampon doluluğu, uygulama kesintisi, benzerlik ve kapasite temizliği sonrasında yeniden başlatma ve log rotasyonundan bağımsız geçmiş açıklaması açılabilir. Yaklaşık dönemler ve kesin nedeni bilinmeyen kareler açıkça ayrılır; benzer silinen her kare için kayıt oluşmaz.
- Yalnızca saat yazısı değişen örnekler maskeyle benzer kabul edilir. Maskenin dışında belirgin değişiklik korunur. Küçük biriken değişiklikler son korunan kareye göre değerlendirilir.
- Yedi günden genç dosyalar benzerlik işiyle silinmez; durağan eski seride saatlik örnekler korunur.
- Kapasite işi gerekirse genç ve saatlik örnekleri de en eskiden başlayarak siler, yabancı dosyalara dokunmaz.
- Arşiv filtreleri, tarih sınırları, indirme ve sayfalama doğrulanır. Oturumsuz erişim ve yol dışına çıkma denemeleri reddedilir.
- Gerçek NVR ve NAS kabul kontrolü kullanıcı ortamında yapılır; sahte cihaz testleri gerçek cihaz uyumluluğu iddiasının yerine geçmez.

## Teslim sınırı

Bu belge onaylanan ürün kapsamını ve önerilen teknik varsayılanları tanımlar. Uygulama henüz yapılmamıştır. Yazılı spec kullanıcı tarafından incelenip onaylandıktan sonra ayrı uygulama planı hazırlanır; plan incelenip yürütme yöntemi seçilmeden ürün kodu yazılmaz.
