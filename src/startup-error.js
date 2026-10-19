// Only fixed messages go into startup logs; upstream error messages may contain credentials.
function startupFailure(error) {
  const messages = {
    INVALID_PORT: '.env PORT must be an integer between 0 and 65535.',
    INVALID_ARCHIVE_KEY:
      '.env içindeki ARCHIVE_KEY, 64 hexadecimal karakterden (0-9, a-f) oluşmalıdır. Rastgele 32 baytlık anahtar üretin; mevcut şifreli veriler varsa eski geçerli anahtarı koruyun.',
    EADDRINUSE:
      'Seçilen port kullanımda. Çalışan uygulamayı kontrol edin veya .env içindeki PORT değerini değiştirin.',
    EACCES:
      'Yerel veri dizini veya seçilen port için erişim izni yok. Uygulama hesabının izinlerini kontrol edin.',
    EPERM:
      'Yerel dosya işlemi için izin verilmedi. Uygulama hesabının veri dizini izinlerini kontrol edin.',
    ENOSPC: 'Yerel diskte boş alan kalmadı. Veri diskinin boş alanını kontrol edin.',
    SQLITE_CANTOPEN:
      'Yerel SQLite kataloğu açılamadı. DATA_DIR yolunu ve yazma izinlerini kontrol edin.',
  };
  return {
    event: 'startup_failed',
    code: error?.code || 'CONFIG_OR_LOCAL_STORAGE_ERROR',
    message:
      messages[error?.code] ||
      'Uygulama başlatılamadı. Hata kodunu ve yerel yapılandırmayı kontrol edin.',
  };
}
module.exports = { startupFailure };
