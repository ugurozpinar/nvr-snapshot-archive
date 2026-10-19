'use strict';
window.KareI18n = (() => {
  const messages = {
    'Geçerli bir tarih seçin.': {
      en: 'Select a valid date.',
      'pt-BR': 'Selecione uma data válida.',
    },
    'NVR adını ve kullanıcı adını kontrol edin.': {
      en: 'Check the NVR name and username.',
      'pt-BR': 'Verifique o nome do NVR e o usuário.',
    },
    'Geçerli bir HTTP veya HTTPS NVR adresi girin.': {
      en: 'Enter a valid HTTP or HTTPS NVR address.',
      'pt-BR': 'Insira um endereço NVR HTTP ou HTTPS válido.',
    },
    'Geçerli bir NVR parolası girin.': {
      en: 'Enter a valid NVR password.',
      'pt-BR': 'Insira uma senha NVR válida.',
    },
    'NVR parolası gerekli.': {
      en: 'NVR password is required.',
      'pt-BR': 'A senha do NVR é obrigatória.',
    },
    'Önce bu NVR üzerindeki kameraları kaldırın.': {
      en: "Remove this NVR's cameras first.",
      'pt-BR': 'Remova primeiro as câmeras deste NVR.',
    },
    'Kamera ayarlarını kontrol edin.': {
      en: 'Check the camera settings.',
      'pt-BR': 'Verifique as configurações da câmera.',
    },
    'Kanal 1–1024 arasında olmalı.': {
      en: 'Channel must be between 1 and 1024.',
      'pt-BR': 'O canal deve estar entre 1 e 1024.',
    },
    'Çekim aralığı en az bir saniye olmalı.': {
      en: 'Capture interval must be at least one second.',
      'pt-BR': 'O intervalo de captura deve ser de pelo menos um segundo.',
    },
    'Koruma aralığı çekim aralığından kısa olamaz.': {
      en: 'Keep interval cannot be shorter than the capture interval.',
      'pt-BR': 'O intervalo de preservação não pode ser menor que o de captura.',
    },
    'Geçerli bir ilk kanal girin.': {
      en: 'Enter a valid first channel.',
      'pt-BR': 'Insira um primeiro canal válido.',
    },
    'Geçerli bir son kanal girin.': {
      en: 'Enter a valid last channel.',
      'pt-BR': 'Insira um último canal válido.',
    },
    'Kanal aralığı sıralı ve en fazla 128 kanal olmalı.': {
      en: 'Use an ordered range of at most 128 channels.',
      'pt-BR': 'Use um intervalo ordenado de no máximo 128 canais.',
    },
    'Önce bir alan ekleyin.': { en: 'Add an area first.', 'pt-BR': 'Adicione uma área primeiro.' },
    'Görüntü listesini yeniden yükleyin.': {
      en: 'Reload the image list.',
      'pt-BR': 'Recarregue a lista de imagens.',
    },
    'Bir kamera seçin.': { en: 'Select a camera.', 'pt-BR': 'Selecione uma câmera.' },
    'Aynı kameraya ait iki görüntü seçin.': {
      en: 'Select two images from the same camera.',
      'pt-BR': 'Selecione duas imagens da mesma câmera.',
    },
    'İstenen kayıt bulunamadı.': {
      en: 'The requested record was not found.',
      'pt-BR': 'O registro solicitado não foi encontrado.',
    },
    'NAS yolu yerel arşivden ayrı olmalı.': {
      en: 'The NAS path must be separate from the local archive.',
      'pt-BR': 'O caminho do NAS deve ser separado do arquivo local.',
    },
    'Sadeleştirme ayarını kontrol edin.': {
      en: 'Check the compaction setting.',
      'pt-BR': 'Verifique a configuração de compactação.',
    },
    'İstek kaynağı reddedildi; uygulamanın kendi adresini kullanın.': {
      en: "Request origin rejected; use the application's own address.",
      'pt-BR': 'Origem da solicitação rejeitada; use o endereço do aplicativo.',
    },
    'Kurulum zaten tamamlandı; oturum açın.': {
      en: 'Setup is already complete; sign in.',
      'pt-BR': 'A configuração já foi concluída; entre.',
    },
    'NVR geçersiz bir yanıt verdi.': {
      en: 'The NVR returned an invalid response.',
      'pt-BR': 'O NVR retornou uma resposta inválida.',
    },
    'Görüntü çok büyük.': { en: 'The image is too large.', 'pt-BR': 'A imagem é muito grande.' },
    'NAS meşgul; tekrar deneyin.': {
      en: 'NAS is busy; try again.',
      'pt-BR': 'O NAS está ocupado; tente novamente.',
    },
    'Bu işlem için NAS bağlantısı gerekli.': {
      en: 'A NAS connection is required for this operation.',
      'pt-BR': 'Esta operação exige uma conexão com o NAS.',
    },
    'NAS kimliği doğrulandı · {0} boş alan': {
      en: 'NAS identity verified · {0} free space',
      'pt-BR': 'Identidade do NAS verificada · {0} de espaço livre',
    },
    'NVR görüntüsü alındı · {0}': {
      en: 'NVR image captured · {0}',
      'pt-BR': 'Imagem do NVR capturada · {0}',
    },
    'Kare — Kamera Arşivi': {
      en: 'Kare — Camera Archive',
      'pt-BR': 'Kare — Arquivo de câmeras',
    },
    'KARE / KAMERA ARŞİVİ': {
      en: 'KARE / CAMERA ARCHIVE',
      'pt-BR': 'KARE / ARQUIVO DE CÂMERAS',
    },
    'Geçmiş, bir kare uzağında.': {
      en: 'The past, one frame away.',
      'pt-BR': 'O passado, a um quadro de distância.',
    },
    'Arşivinize güvenle erişin.': {
      en: 'Access your archive securely.',
      'pt-BR': 'Acesse seu arquivo com segurança.',
    },
    'Kurulum anahtarı': {
      en: 'Setup token',
      'pt-BR': 'Chave de configuração',
    },
    'Yönetici parolası': {
      en: 'Administrator password',
      'pt-BR': 'Senha do administrador',
    },
    'Giriş yap': {
      en: 'Sign in',
      'pt-BR': 'Entrar',
    },
    'Yöneticiyi oluştur': {
      en: 'Create administrator',
      'pt-BR': 'Criar administrador',
    },
    'İlk kurulum için .env içindeki anahtarı ve yeni yönetici parolanızı girin.': {
      en: 'Enter the token from .env and your new administrator password to set up.',
      'pt-BR': 'Para configurar, insira a chave do .env e sua nova senha de administrador.',
    },
    'KAMERA ARŞİVİ': {
      en: 'CAMERA ARCHIVE',
      'pt-BR': 'ARQUIVO DE CÂMERAS',
    },
    'ÇALIŞMA ALANI': {
      en: 'WORKSPACE',
      'pt-BR': 'ESPAÇO DE TRABALHO',
    },
    'Ana menü': {
      en: 'Main navigation',
      'pt-BR': 'Menu principal',
    },
    'Genel durum': {
      en: 'Overview',
      'pt-BR': 'Visão geral',
    },
    Arşiv: {
      en: 'Archive',
      'pt-BR': 'Arquivo',
    },
    Ayarlar: {
      en: 'Settings',
      'pt-BR': 'Configurações',
    },
    'Yerel ağ · Tek yönetici': {
      en: 'Local network · Single administrator',
      'pt-BR': 'Rede local · Administrador único',
    },
    Çıkış: {
      en: 'Sign out',
      'pt-BR': 'Sair',
    },
    'GÖRÜNTÜ ARŞİVİ': {
      en: 'IMAGE ARCHIVE',
      'pt-BR': 'ARQUIVO DE IMAGENS',
    },
    'GENEL DURUM': {
      en: 'OVERVIEW',
      'pt-BR': 'VISÃO GERAL',
    },
    'Arşivin nabzı': {
      en: 'Archive overview',
      'pt-BR': 'Visão geral do arquivo',
    },
    'Kameralar, depolama ve son çekimler bir arada.': {
      en: 'Cameras, storage and recent captures in one place.',
      'pt-BR': 'Câmeras, armazenamento e capturas recentes em um só lugar.',
    },
    '↻ Yenile': {
      en: '↻ Refresh',
      'pt-BR': '↻ Atualizar',
    },
    'Etkin kameralar': {
      en: 'Active cameras',
      'pt-BR': 'Câmeras ativas',
    },
    'kamera izleniyor': {
      en: 'cameras monitored',
      'pt-BR': 'câmeras monitoradas',
    },
    'Arşiv kullanımı': {
      en: 'Archive usage',
      'pt-BR': 'Uso do arquivo',
    },
    'Kapasite bekleniyor': {
      en: 'Waiting for capacity',
      'pt-BR': 'Aguardando capacidade',
    },
    'Tahmini geçmiş': {
      en: 'Estimated retention',
      'pt-BR': 'Retenção estimada',
    },
    'Ölçülen tüketim · yaklaşık, sadeleştirme öncesi': {
      en: 'Measured usage · approximate, before compaction',
      'pt-BR': 'Uso medido · aproximado, antes da compactação',
    },
    'Yerel tampon': {
      en: 'Local buffer',
      'pt-BR': 'Buffer local',
    },
    'Depolama kontrol ediliyor': {
      en: 'Checking storage',
      'pt-BR': 'Verificando armazenamento',
    },
    'Kamera durumu': {
      en: 'Camera status',
      'pt-BR': 'Status das câmeras',
    },
    'CANLI DURUM': {
      en: 'LIVE STATUS',
      'pt-BR': 'STATUS AO VIVO',
    },
    Kamera: {
      en: 'Camera',
      'pt-BR': 'Câmera',
    },
    Durum: {
      en: 'Status',
      'pt-BR': 'Status',
    },
    'Son başarılı çekim': {
      en: 'Last successful capture',
      'pt-BR': 'Última captura bem-sucedida',
    },
    'Çekim aralığı': {
      en: 'Capture interval',
      'pt-BR': 'Intervalo de captura',
    },
    'ZAMAN İÇİNDE': {
      en: 'THROUGH TIME',
      'pt-BR': 'AO LONGO DO TEMPO',
    },
    'Görüntü arşivi': {
      en: 'Image archive',
      'pt-BR': 'Arquivo de imagens',
    },
    'Bir kamera seçin, geçmişte bir güne dönün.': {
      en: 'Choose a camera and revisit a day in the past.',
      'pt-BR': 'Escolha uma câmera e volte a um dia do passado.',
    },
    Tarih: {
      en: 'Date',
      'pt-BR': 'Data',
    },
    'Görüntüleri getir': {
      en: 'Load images',
      'pt-BR': 'Carregar imagens',
    },
    'Saklanan görüntüler': {
      en: 'Stored images',
      'pt-BR': 'Imagens armazenadas',
    },
    'Görüntülemek için kamera ve tarih seçin.': {
      en: 'Select a camera and date to browse.',
      'pt-BR': 'Selecione uma câmera e uma data para visualizar.',
    },
    'Daha fazla görüntü': {
      en: 'More images',
      'pt-BR': 'Mais imagens',
    },
    'Bu dönemdeki boşluklar ve arşiv işlemleri': {
      en: 'Gaps and archive activity in this period',
      'pt-BR': 'Lacunas e operações do arquivo neste período',
    },
    'Dönem özetleri, tek bir eksik karenin kesin nedenini göstermez. Kanıt bulunmayan nedenler bilinmiyor kabul edilir.':
      {
        en: 'Period summaries do not identify the exact cause of an individual missing frame. Causes without evidence are considered unknown.',
        'pt-BR':
          'Os resumos do período não identificam a causa exata de um quadro ausente. Causas sem evidências são consideradas desconhecidas.',
      },
    YÖNETİM: {
      en: 'ADMINISTRATION',
      'pt-BR': 'ADMINISTRAÇÃO',
    },
    'Arşivi şekillendirin': {
      en: 'Configure your archive',
      'pt-BR': 'Configure seu arquivo',
    },
    'Bağlantılar, çekim sıklığı ve saklama politikaları.': {
      en: 'Connections, capture frequency and retention policies.',
      'pt-BR': 'Conexões, frequência de captura e políticas de retenção.',
    },
    Depolama: {
      en: 'Storage',
      'pt-BR': 'Armazenamento',
    },
    'NAS yolu boşsa proje içindeki archive/ kullanılır. NAS varsa tüm çekimler önce yerel tampona yazılır.':
      {
        en: 'If the NAS path is empty, archive/ in the project is used. With NAS, all captures are written to the local buffer first.',
        'pt-BR':
          'Se o caminho do NAS estiver vazio, será usado archive/ no projeto. Com NAS, todas as capturas são gravadas primeiro no buffer local.',
      },
    'Arşiv kapasitesi (GiB)': {
      en: 'Archive capacity (GiB)',
      'pt-BR': 'Capacidade do arquivo (GiB)',
    },
    'Yerel tampon kapasitesi (GiB)': {
      en: 'Local buffer capacity (GiB)',
      'pt-BR': 'Capacidade do buffer local (GiB)',
    },
    'NAS arşiv yolu': {
      en: 'NAS archive path',
      'pt-BR': 'Caminho do arquivo no NAS',
    },
    'Beklenen mount noktası': {
      en: 'Expected mount point',
      'pt-BR': 'Ponto de montagem esperado',
    },
    'Beklenen mount kaynağı': {
      en: 'Expected mount source',
      'pt-BR': 'Origem de montagem esperada',
    },
    'Depo kimliği': {
      en: 'Depot ID',
      'pt-BR': 'ID do repositório',
    },
    'Yedi günden eski görüntülerde sadeleştirmeyi etkinleştir': {
      en: 'Enable compaction for images older than seven days',
      'pt-BR': 'Ativar compactação de imagens com mais de sete dias',
    },
    'Yalnızca karşılaştırması doğrulanmış kameralar sadeleştirilir. Kapasite zorunluluğu yedi günlük görüntüleri de silebilir.':
      {
        en: 'Only cameras with verified comparisons are compacted. Capacity limits may also delete images within seven days.',
        'pt-BR':
          'Somente câmeras com comparação validada são compactadas. Os limites de capacidade também podem excluir imagens dos últimos sete dias.',
      },
    'Depolamayı kaydet': {
      en: 'Save storage',
      'pt-BR': 'Salvar armazenamento',
    },
    'NAS bağlantısını test et': {
      en: 'Test NAS connection',
      'pt-BR': 'Testar conexão com o NAS',
    },
    'NAS depo kimliğini oluştur': {
      en: 'Initialize NAS depot ID',
      'pt-BR': 'Criar ID do repositório NAS',
    },
    'NVR bağlantıları': {
      en: 'NVR connections',
      'pt-BR': 'Conexões NVR',
    },
    'NVR adı': {
      en: 'NVR name',
      'pt-BR': 'Nome do NVR',
    },
    'NVR adresi': {
      en: 'NVR address',
      'pt-BR': 'Endereço do NVR',
    },
    'Kullanıcı adı': {
      en: 'Username',
      'pt-BR': 'Nome de usuário',
    },
    'NVR parolası': {
      en: 'NVR password',
      'pt-BR': 'Senha do NVR',
    },
    'Düzenlemede boşsa korunur': {
      en: 'Leave blank to keep the current password',
      'pt-BR': 'Deixe em branco para manter a senha atual',
    },
    "NVR'yi kaydet": {
      en: 'Save NVR',
      'pt-BR': 'Salvar NVR',
    },
    'Yeni bağlantı': {
      en: 'New connection',
      'pt-BR': 'Nova conexão',
    },
    'Kanal aralığından kamera ekle': {
      en: 'Add cameras from a channel range',
      'pt-BR': 'Adicionar câmeras por intervalo de canais',
    },
    'Kamera ad öneki': {
      en: 'Camera name prefix',
      'pt-BR': 'Prefixo do nome da câmera',
    },
    'İlk kanal': {
      en: 'First channel',
      'pt-BR': 'Primeiro canal',
    },
    'Son kanal': {
      en: 'Last channel',
      'pt-BR': 'Último canal',
    },
    'Varsayılan çekim aralığı 15 dakika. Yalnızca kullandığınız kanalları ekleyin.': {
      en: 'The default capture interval is 15 minutes. Add only the channels you use.',
      'pt-BR':
        'O intervalo padrão de captura é de 15 minutos. Adicione apenas os canais que você usa.',
    },
    'Kameraları ekle': {
      en: 'Add cameras',
      'pt-BR': 'Adicionar câmeras',
    },
    'Kamera ve karşılaştırma ayarları': {
      en: 'Camera and comparison settings',
      'pt-BR': 'Configurações de câmera e comparação',
    },
    'Düzenlenecek kamera': {
      en: 'Camera to edit',
      'pt-BR': 'Câmera a editar',
    },
    'Kamera adı': {
      en: 'Camera name',
      'pt-BR': 'Nome da câmera',
    },
    'Çekim aralığı (dakika)': {
      en: 'Capture interval (minutes)',
      'pt-BR': 'Intervalo de captura (minutos)',
    },
    'Değişmese de koruma aralığı (dakika)': {
      en: 'Keep interval even without changes (minutes)',
      'pt-BR': 'Intervalo de preservação mesmo sem alterações (minutos)',
    },
    'Değişiklik hassasiyeti': {
      en: 'Change sensitivity',
      'pt-BR': 'Sensibilidade a alterações',
    },
    'Yüksek · daha fazla kare korur': {
      en: 'High · keeps more frames',
      'pt-BR': 'Alta · preserva mais quadros',
    },
    Orta: {
      en: 'Medium',
      'pt-BR': 'Média',
    },
    'Düşük · daha çok sadeleştirir': {
      en: 'Low · compacts more',
      'pt-BR': 'Baixa · compacta mais',
    },
    'Kamera etkin': {
      en: 'Camera enabled',
      'pt-BR': 'Câmera ativada',
    },
    'Karşılaştırmanın dışında kalan alanlar': {
      en: 'Areas excluded from comparison',
      'pt-BR': 'Áreas excluídas da comparação',
    },
    '0 alan': {
      en: '0 areas',
      'pt-BR': '0 áreas',
    },
    'Tarih/saat yazısı veya hareketli alanlar üzerinde dikdörtgen çizin. Özgün fotoğraf değişmez.':
      {
        en: 'Draw rectangles over timestamps or moving areas. The original photo is unchanged.',
        'pt-BR':
          'Desenhe retângulos sobre datas, horários ou áreas em movimento. A foto original permanece intacta.',
      },
    'Son görüntüyü yükle': {
      en: 'Load latest image',
      'pt-BR': 'Carregar última imagem',
    },
    'Alanları temizle': {
      en: 'Clear areas',
      'pt-BR': 'Limpar áreas',
    },
    'Alanları tüm kameralara kopyala': {
      en: 'Copy areas to all cameras',
      'pt-BR': 'Copiar áreas para todas as câmeras',
    },
    'Kopyalama, ekrandaki alanları tüm kameralara kaydeder ve mevcut alanların üzerine yazar. Değişen kameraların karşılaştırma doğrulaması sıfırlanır; diğer kamera ayarları korunur.':
      {
        en: 'Copying saves the displayed areas to all cameras, replacing existing areas. Comparison verification is reset for changed cameras; other camera settings are preserved.',
        'pt-BR':
          'A cópia salva as áreas exibidas em todas as câmeras, substituindo as existentes. A validação da comparação é redefinida nas câmeras alteradas; as outras configurações são mantidas.',
      },
    'Karşılaştırma dışında kalacak alanları seçin': {
      en: 'Select areas to exclude from comparison',
      'pt-BR': 'Selecione as áreas a excluir da comparação',
    },
    'Koordinatla alan ekle (yüzde)': {
      en: 'Add area by coordinates (percent)',
      'pt-BR': 'Adicionar área por coordenadas (porcentagem)',
    },
    'Sol (%)': {
      en: 'Left (%)',
      'pt-BR': 'Esquerda (%)',
    },
    'Üst (%)': {
      en: 'Top (%)',
      'pt-BR': 'Topo (%)',
    },
    'Genişlik (%)': {
      en: 'Width (%)',
      'pt-BR': 'Largura (%)',
    },
    'Yükseklik (%)': {
      en: 'Height (%)',
      'pt-BR': 'Altura (%)',
    },
    'Alan ekle': {
      en: 'Add area',
      'pt-BR': 'Adicionar área',
    },
    'Karşılaştırmayı doğrula': {
      en: 'Verify comparison',
      'pt-BR': 'Validar comparação',
    },
    'Önce ayarları kaydedin. Gündüz ve gece örneklerinde değişikliklerin korunduğunu kontrol edin; sonra kamerayı doğrulanmış işaretleyin.':
      {
        en: 'Save settings first. Check that changes are preserved in daytime and nighttime samples, then mark the camera as verified.',
        'pt-BR':
          'Salve as configurações primeiro. Verifique se as alterações são preservadas nas amostras diurnas e noturnas e marque a câmera como validada.',
      },
    'Birinci görüntü': {
      en: 'First image',
      'pt-BR': 'Primeira imagem',
    },
    'İkinci görüntü': {
      en: 'Second image',
      'pt-BR': 'Segunda imagem',
    },
    'Karşılaştırmayı önizle': {
      en: 'Preview comparison',
      'pt-BR': 'Visualizar comparação',
    },
    'Bu kameranın karşılaştırmasını doğruladım': {
      en: "I verified this camera's comparison",
      'pt-BR': 'Validei a comparação desta câmera',
    },
    'Kamerayı kaydet': {
      en: 'Save camera',
      'pt-BR': 'Salvar câmera',
    },
    Kapat: {
      en: 'Close',
      'pt-BR': 'Fechar',
    },
    'Seçilen kamera görüntüsü': {
      en: 'Selected camera image',
      'pt-BR': 'Imagem da câmera selecionada',
    },
    'Önceki görüntü': {
      en: 'Previous image',
      'pt-BR': 'Imagem anterior',
    },
    '← Önceki': {
      en: '← Previous',
      'pt-BR': '← Anterior',
    },
    'Özgün görüntüyü indir': {
      en: 'Download original image',
      'pt-BR': 'Baixar imagem original',
    },
    'Sonraki görüntü': {
      en: 'Next image',
      'pt-BR': 'Próxima imagem',
    },
    'Sonraki →': {
      en: 'Next →',
      'pt-BR': 'Próxima →',
    },
    'Kimlik doğrulama hatası': {
      en: 'Authentication error',
      'pt-BR': 'Erro de autenticação',
    },
    'NVR erişim hatası': {
      en: 'NVR connection error',
      'pt-BR': 'Erro de conexão com o NVR',
    },
    'Çekim zaman aşımı': {
      en: 'Capture timed out',
      'pt-BR': 'Tempo limite da captura excedido',
    },
    'Geçersiz görüntü': {
      en: 'Invalid image',
      'pt-BR': 'Imagem inválida',
    },
    'Yerel yazma hatası': {
      en: 'Local write error',
      'pt-BR': 'Erro de gravação local',
    },
    'Yerel tampon dolu': {
      en: 'Local buffer full',
      'pt-BR': 'Buffer local cheio',
    },
    'Arşiv kapasitesi dolu': {
      en: 'Archive capacity full',
      'pt-BR': 'Capacidade do arquivo esgotada',
    },
    'Yerel disk alanı yetersiz': {
      en: 'Insufficient local disk space',
      'pt-BR': 'Espaço insuficiente no disco local',
    },
    'Yönetici tarafından kapatıldı': {
      en: 'Disabled by administrator',
      'pt-BR': 'Desativada pelo administrador',
    },
    'Uygulama çalışmıyordu': {
      en: 'Application was offline',
      'pt-BR': 'O aplicativo estava offline',
    },
    'NAS erişilemiyor': {
      en: 'NAS unavailable',
      'pt-BR': 'NAS indisponível',
    },
    'NAS boş alanı yetersiz; aktarımlar bekliyor': {
      en: 'Insufficient NAS space; transfers pending',
      'pt-BR': 'Espaço insuficiente no NAS; transferências pendentes',
    },
    'NAS mount kimliği uyuşmuyor': {
      en: 'NAS mount identity mismatch',
      'pt-BR': 'Identidade de montagem do NAS não corresponde',
    },
    'NAS depo kimliği uyuşmuyor': {
      en: 'NAS depot identity mismatch',
      'pt-BR': 'Identidade do repositório NAS não corresponde',
    },
    'Dosya kaybı doğrulandı': {
      en: 'File loss confirmed',
      'pt-BR': 'Perda de arquivo confirmada',
    },
    'Çekim yarıda kaldı': {
      en: 'Capture interrupted',
      'pt-BR': 'Captura interrompida',
    },
    'Çekim takvimi atlandı': {
      en: 'Capture schedule skipped',
      'pt-BR': 'Captura agendada ignorada',
    },
    'Benzerlik sadeleştirmesi': {
      en: 'Similarity compaction',
      'pt-BR': 'Compactação por similaridade',
    },
    'Kapasite temizliği': {
      en: 'Capacity cleanup',
      'pt-BR': 'Limpeza por capacidade',
    },
    'Başlamak için kapasite belirleyin': {
      en: 'Set capacity to get started',
      'pt-BR': 'Defina a capacidade para começar',
    },
    'Benzerlik sadeleştirmesi kapalı': {
      en: 'Similarity compaction disabled',
      'pt-BR': 'Compactação por similaridade desativada',
    },
    'Arşiv mevcutken depo değiştirilemez': {
      en: 'Cannot change depot while an archive exists',
      'pt-BR': 'Não é possível alterar o repositório enquanto houver um arquivo',
    },
    'Alanlar görüntünün tamamını kapatamaz': {
      en: 'Areas cannot cover the entire image',
      'pt-BR': 'As áreas não podem cobrir toda a imagem',
    },
    'Oturum açın': {
      en: 'Sign in to continue',
      'pt-BR': 'Entre para continuar',
    },
    'Oturum doğrulanamadı; sayfayı yenileyin': {
      en: 'Session verification failed; refresh the page',
      'pt-BR': 'Falha na validação da sessão; atualize a página',
    },
    'Parola doğru değil': {
      en: 'Incorrect password',
      'pt-BR': 'Senha incorreta',
    },
    'Kurulum anahtarı doğru değil': {
      en: 'Incorrect setup token',
      'pt-BR': 'Chave de configuração incorreta',
    },
    'Parola 12–256 karakter olmalı': {
      en: 'Password must contain 12–256 characters',
      'pt-BR': 'A senha deve ter de 12 a 256 caracteres',
    },
    'Çok fazla deneme; 15 dakika bekleyin': {
      en: 'Too many attempts; wait 15 minutes',
      'pt-BR': 'Muitas tentativas; aguarde 15 minutos',
    },
    'NAS için mount noktası, kaynak ve depo kimliği gerekli': {
      en: 'NAS requires a mount point, source and depot ID',
      'pt-BR': 'O NAS exige ponto de montagem, origem e ID do repositório',
    },
    'Arşivi olan kamerayı silmek yerine devre dışı bırakın': {
      en: 'Disable a camera with archived images instead of deleting it',
      'pt-BR': 'Desative a câmera com imagens arquivadas em vez de excluí-la',
    },
    'İşlem tamamlanamadı': {
      en: 'The operation could not be completed',
      'pt-BR': 'Não foi possível concluir a operação',
    },
    'Henüz ölçülmedi': {
      en: 'Not measured yet',
      'pt-BR': 'Ainda não medido',
    },
    'NAS işlemi takıldı': {
      en: 'NAS operation stalled',
      'pt-BR': 'Operação do NAS travada',
    },
    'NAS erişilebilir': {
      en: 'NAS available',
      'pt-BR': 'NAS disponível',
    },
    'Yerel kayıt / NAS doğrulanmadı': {
      en: 'Local storage / NAS unverified',
      'pt-BR': 'Armazenamento local / NAS não verificado',
    },
    doğrulandı: {
      en: 'verified',
      'pt-BR': 'verificado',
    },
    'son ölçüm': {
      en: 'last measurement',
      'pt-BR': 'última medição',
    },
    'Arka plan işi durakladı: ': {
      en: 'Background job paused: ',
      'pt-BR': 'Tarefa em segundo plano pausada: ',
    },
    'Yerel veritabanı sağlıksız; ayrıntılı kayıt garanti edilemiyor.': {
      en: 'Local database is unhealthy; detailed logging cannot be guaranteed.',
      'pt-BR': 'O banco de dados local apresenta problemas; o registro detalhado não é garantido.',
    },
    'NAS işlemi yanıt vermiyor. Yerel alan yettiği sürece çekimler sürer; NAS için işletim sistemi müdahalesi gerekebilir.':
      {
        en: 'The NAS operation is not responding. Captures continue while local space is available; NAS may require operating system intervention.',
        'pt-BR':
          'A operação do NAS não responde. As capturas continuam enquanto houver espaço local; o NAS pode exigir intervenção no sistema operacional.',
      },
    ' son görüntüsü': {
      en: ' latest image',
      'pt-BR': ' última imagem',
    },
    Kapalı: {
      en: 'Disabled',
      'pt-BR': 'Desativada',
    },
    'Çekim başarılı': {
      en: 'Capture successful',
      'pt-BR': 'Captura bem-sucedida',
    },
    'İlk çekim bekleniyor': {
      en: 'Waiting for first capture',
      'pt-BR': 'Aguardando primeira captura',
    },
    ' dk': {
      en: ' min',
      'pt-BR': ' min',
    },
    'Henüz kamera eklenmedi. Ayarlar ekranından NVR ve kanalları ekleyin.': {
      en: 'No cameras added yet. Add an NVR and channels in Settings.',
      'pt-BR': 'Nenhuma câmera adicionada. Adicione um NVR e canais nas Configurações.',
    },
    'SON KONTROL · ': {
      en: 'LAST CHECK · ',
      'pt-BR': 'ÚLTIMA VERIFICAÇÃO · ',
    },
    'Önce bir kamera ekleyin': {
      en: 'Add a camera first',
      'pt-BR': 'Adicione uma câmera primeiro',
    },
    'NAS geçici olarak erişilemiyor': {
      en: 'NAS temporarily unavailable',
      'pt-BR': 'NAS temporariamente indisponível',
    },
    'Yerelde güvenle saklandı · aktarım bekliyor': {
      en: 'Safely stored locally · transfer pending',
      'pt-BR': 'Armazenada com segurança localmente · transferência pendente',
    },
    Arşivde: {
      en: 'Archived',
      'pt-BR': 'Arquivada',
    },
    ' kamera görüntüsü': {
      en: ' camera image',
      'pt-BR': ' imagem da câmera',
    },
    ' görüntü': {
      en: ' images',
      'pt-BR': ' imagens',
    },
    'Bu dönem için saklanan görüntü bulunamadı. Aşağıdaki geçmiş açıklamalarını inceleyin.': {
      en: 'No stored images found for this period. Review the history explanations below.',
      'pt-BR':
        'Nenhuma imagem armazenada neste período. Consulte as explicações do histórico abaixo.',
    },
    etkin: {
      en: 'enabled',
      'pt-BR': 'ativada',
    },
    kapalı: {
      en: 'disabled',
      'pt-BR': 'desativada',
    },
    'devam ediyor': {
      en: 'ongoing',
      'pt-BR': 'em andamento',
    },
    ' · yaklaşık dönem': {
      en: ' · approximate period',
      'pt-BR': ' · período aproximado',
    },
    ' görüntü (dönem özeti)': {
      en: ' images (period summary)',
      'pt-BR': ' imagens (resumo do período)',
    },
    'Bu dönem için açıklayıcı kayıt yok; boşluğun nedeni bilinmiyor.': {
      en: 'No explanatory records for this period; the cause of the gap is unknown.',
      'pt-BR': 'Não há registros explicativos neste período; a causa da lacuna é desconhecida.',
    },
    'Depolama ayarları kaydedildi.': {
      en: 'Storage settings saved.',
      'pt-BR': 'Configurações de armazenamento salvas.',
    },
    'NAS kimliği doğrulandı · ': {
      en: 'NAS identity verified · ',
      'pt-BR': 'Identidade do NAS verificada · ',
    },
    ' boş alan': {
      en: ' free space',
      'pt-BR': ' de espaço livre',
    },
    'NAS depo kimliği oluşturuldu.': {
      en: 'NAS depot ID created.',
      'pt-BR': 'ID do repositório NAS criado.',
    },
    Düzenle: {
      en: 'Edit',
      'pt-BR': 'Editar',
    },
    Test: {
      en: 'Test',
      'pt-BR': 'Testar',
    },
    Sil: {
      en: 'Delete',
      'pt-BR': 'Excluir',
    },
    'NVR görüntüsü alındı · ': {
      en: 'NVR image captured · ',
      'pt-BR': 'Imagem do NVR capturada · ',
    },
    'NVR bağlantısı kaydedildi.': {
      en: 'NVR connection saved.',
      'pt-BR': 'Conexão NVR salva.',
    },
    'Kameralar eklendi.': {
      en: 'Cameras added.',
      'pt-BR': 'Câmeras adicionadas.',
    },
    'Kamera ayarları kaydedildi. Maske veya hassasiyet değiştiyse doğrulamayı yeniden yapın.': {
      en: 'Camera settings saved. Verify again if masks or sensitivity changed.',
      'pt-BR':
        'Configurações da câmera salvas. Valide novamente se as máscaras ou a sensibilidade foram alteradas.',
    },
    ' alan': {
      en: ' areas',
      'pt-BR': ' áreas',
    },
    'Bu kameradan henüz görüntü alınmamış.': {
      en: 'No images captured from this camera yet.',
      'pt-BR': 'Nenhuma imagem capturada por esta câmera ainda.',
    },
    'Görüntü erişilemiyor': {
      en: 'Image unavailable',
      'pt-BR': 'Imagem indisponível',
    },
    'Alan görüntü sınırları içinde olmalı.': {
      en: 'The area must be within the image boundaries.',
      'pt-BR': 'A área deve estar dentro dos limites da imagem.',
    },
    'Benzer; eskiyse sadeleştirilebilir.': {
      en: 'Similar; eligible for compaction when old.',
      'pt-BR': 'Semelhantes; podem ser compactadas quando antigas.',
    },
    'Değişiklik var veya analiz belirsiz; korunur.': {
      en: 'Changed or analysis uncertain; retained.',
      'pt-BR': 'Há alterações ou a análise é incerta; serão preservadas.',
    },
    belirsiz: {
      en: 'unknown',
      'pt-BR': 'indeterminada',
    },
    '{0} kayıtlı kamera · {1} hata': {
      en: '{0} registered cameras · {1} errors',
      'pt-BR': '{0} câmeras cadastradas · {1} erros',
    },
    '{0} kapasite · {1} görüntü': {
      en: '{0} capacity · {1} images',
      'pt-BR': '{0} de capacidade · {1} imagens',
    },
    '{0} gün': {
      en: '{0} days',
      'pt-BR': '{0} dias',
    },
    '{0} aktarım bekliyor · {1}': {
      en: '{0} transfers pending · {1}',
      'pt-BR': '{0} transferências pendentes · {1}',
    },
    ' · NAS boş alan {0} ({1}, {2})': {
      en: ' · NAS free space {0} ({1}, {2})',
      'pt-BR': ' · Espaço livre no NAS {0} ({1}, {2})',
    },
    '{0} · Planlanan {1}, başarılı {2}, başarısız {3}, atlanan {4}. Benzerlik: {5}, kapasite: {6} görüntü silindi.':
      {
        en: '{0} · Planned {1}, successful {2}, failed {3}, skipped {4}. Images deleted: similarity {5}, capacity {6}.',
        'pt-BR':
          '{0} · Planejadas {1}, bem-sucedidas {2}, falhas {3}, ignoradas {4}. Imagens excluídas: similaridade {5}, capacidade {6}.',
      },
    'Çekim ayarı değişti · {0} dakika · {1}': {
      en: 'Capture settings changed · {0} minutes · {1}',
      'pt-BR': 'Configurações de captura alteradas · {0} minutos · {1}',
    },
    'Alanlar {0} kameraya uygulandı; {1} kamera güncellendi. Değişen kameraların karşılaştırmasını yeniden doğrulayın.':
      {
        en: 'Areas applied to {0} cameras; {1} cameras updated. Verify comparisons again for changed cameras.',
        'pt-BR':
          'Áreas aplicadas a {0} câmeras; {1} câmeras atualizadas. Valide novamente a comparação das câmeras alteradas.',
      },
    '{0} Değişen alan: {1} · Politika {2}': {
      en: '{0} Changed area: {1} · Policy {2}',
      'pt-BR': '{0} Área alterada: {1} · Política {2}',
    },
    Dil: {
      en: 'Language',
      'pt-BR': 'Idioma',
    },
  };
  const locales = { en: 'en-US', tr: 'tr-TR', 'pt-BR': 'pt-BR' };
  const normalize = (value) => {
    const base = String(value || '')
      .toLowerCase()
      .split('-')[0];
    return base === 'pt' ? 'pt-BR' : base === 'tr' ? 'tr' : base === 'en' ? 'en' : null;
  };
  let language;
  try {
    language = normalize(localStorage.getItem('kare-language'));
  } catch {}
  language ||= (navigator.languages || [navigator.language]).map(normalize).find(Boolean) || 'en';
  const rendered = new Map();
  const locale = () => locales[language];
  const number = (value, digits) =>
    new Intl.NumberFormat(locale(), {
      minimumFractionDigits: digits ?? 0,
      maximumFractionDigits: digits ?? 3,
    }).format(value);
  function t(key, ...values) {
    const template =
      language === 'tr' ? key : messages[key]?.[language] || messages[key]?.en || key;
    const text = template.replace(/\{(\d+)\}/g, (_, index) => {
      const value = values[Number(index)];
      return typeof value === 'number' ? number(value) : (value ?? '');
    });
    // Only transient messages use this bounded registry; DOM content is never interpreted as HTML.
    if (rendered.size > 1000) rendered.clear();
    rendered.set(text, { key, values });
    return text;
  }
  let defaultPrefix = document.getElementById('bulk-name').value;
  function apply() {
    const prefix = document.getElementById('bulk-name');
    if (prefix.value === defaultPrefix) prefix.value = t('Kamera');
    defaultPrefix = t('Kamera');
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll('[data-i18n]'))
      node.textContent = t(node.dataset.i18n);
    for (const attr of ['aria-label', 'alt', 'placeholder']) {
      for (const node of document.querySelectorAll(`[data-i18n-${attr}]`)) {
        node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
      }
    }
    for (const select of document.querySelectorAll('.language-select')) select.value = language;
  }
  function init(onChange) {
    apply();
    for (const select of document.querySelectorAll('.language-select')) {
      select.addEventListener('change', () => {
        const transient = ['notice', 'auth-error'].map((id) => {
          const node = document.getElementById(id);
          return { node, message: rendered.get(node.textContent) };
        });
        language = normalize(select.value) || 'en';
        try {
          localStorage.setItem('kare-language', language);
        } catch {}
        apply();
        for (const { node, message } of transient) {
          if (message) node.textContent = t(message.key, ...message.values);
        }
        onChange();
      });
    }
  }
  return { t, number, locale, init, hasMessage: (key) => Object.hasOwn(messages, key) };
})();
