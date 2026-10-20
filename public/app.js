'use strict';
const { t, number } = KareI18n;
const $ = (id) => document.getElementById(id),
  GIB = 1024 ** 3;
let csrf = '',
  setupRequired = false,
  cameras = [],
  nvrs = [],
  archiveFrames = [],
  cursor = null,
  viewerIndex = 0,
  playbackDirection = 0,
  playbackTimer = null,
  currentMasks = [],
  copyingMasks = false,
  maskImage = null,
  dragStart = null;
const reasons = {
  INVALID_CLEANUP_DAYS: 'Gün sayısı 1–36600 arasında tam sayı olmalı.',
  CLEANUP_BUSY: 'Temizlik zaten çalışıyor; tamamlanmasını bekleyin.',
  CLEANUP_POLICY_CHANGED: 'Temizlik sırasında kamera ayarları değişti. Temizliği yeniden başlatın.',
  INVALID_DATE: 'Geçerli bir tarih seçin.',
  INVALID_NVR: 'NVR adını ve kullanıcı adını kontrol edin.',
  INVALID_NVR_HOST: 'Geçerli bir HTTP veya HTTPS NVR adresi girin.',
  INVALID_PASSWORD: 'Geçerli bir NVR parolası girin.',
  PASSWORD_REQUIRED: 'NVR parolası gerekli.',
  NVR_IN_USE: 'Önce bu NVR üzerindeki kameraları kaldırın.',
  INVALID_CAMERA: 'Kamera ayarlarını kontrol edin.',
  INVALID_CHANNEL: 'Kanal 1–1024 arasında olmalı.',
  INVALID_INTERVAL: 'Çekim aralığı en az bir saniye olmalı.',
  INVALID_ANCHOR: 'Koruma aralığı çekim aralığından kısa olamaz.',
  INVALID_FIRST_CHANNEL: 'Geçerli bir ilk kanal girin.',
  INVALID_LAST_CHANNEL: 'Geçerli bir son kanal girin.',
  INVALID_RANGE: 'Kanal aralığı sıralı ve en fazla 128 kanal olmalı.',
  EMPTY_MASKS: 'Önce bir alan ekleyin.',
  INVALID_CURSOR: 'Görüntü listesini yeniden yükleyin.',
  CAMERA_REQUIRED: 'Bir kamera seçin.',
  CAMERA_IMAGE_MISMATCH: 'Aynı kameraya ait iki görüntü seçin.',
  NOT_FOUND: 'İstenen kayıt bulunamadı.',
  NAS_MUST_BE_SEPARATE: 'NAS yolu yerel arşivden ayrı olmalı.',
  INVALID_COMPACTION: 'Sadeleştirme ayarını kontrol edin.',
  ORIGIN_REJECTED: 'İstek kaynağı reddedildi; uygulamanın kendi adresini kullanın.',
  ALREADY_CONFIGURED: 'Kurulum zaten tamamlandı; oturum açın.',
  NVR_HTTP_ERROR: 'NVR geçersiz bir yanıt verdi.',
  IMAGE_TOO_LARGE: 'Görüntü çok büyük.',
  NAS_BUSY: 'NAS meşgul; tekrar deneyin.',
  NAS_REQUIRED: 'Bu işlem için NAS bağlantısı gerekli.',
  INTERNAL_ERROR: 'İşlem tamamlanamadı',
  AUTH_FAILED: 'Kimlik doğrulama hatası',
  NVR_UNREACHABLE: 'NVR erişim hatası',
  CAPTURE_TIMEOUT: 'Çekim zaman aşımı',
  INVALID_IMAGE: 'Geçersiz görüntü',
  LOCAL_WRITE_FAILED: 'Yerel yazma hatası',
  SPOOL_FULL: 'Yerel tampon dolu',
  ARCHIVE_FULL: 'Arşiv kapasitesi dolu',
  LOCAL_SPACE_LOW: 'Yerel disk alanı yetersiz',
  ADMIN_DISABLED: 'Yönetici tarafından kapatıldı',
  APP_OFFLINE: 'Uygulama çalışmıyordu',
  NAS_UNAVAILABLE: 'NAS erişilemiyor',
  NAS_SPACE_LOW: 'NAS boş alanı yetersiz; aktarımlar bekliyor',
  NAS_WRONG_MOUNT: 'NAS mount kimliği uyuşmuyor',
  NAS_WRONG_DEPOT: 'NAS depo kimliği uyuşmuyor',
  FILE_MISSING: 'Dosya kaybı doğrulandı',
  CAPTURE_INTERRUPTED: 'Çekim yarıda kaldı',
  SCHEDULE_SKIPPED: 'Çekim takvimi atlandı',
  similarity: 'Benzerlik sadeleştirmesi',
  capacity: 'Kapasite temizliği',
  QUOTA_REQUIRED: 'Başlamak için kapasite belirleyin',
  COMPACTION_DISABLED: 'Benzerlik sadeleştirmesi kapalı',
  DEPOT_IN_USE: 'Arşiv mevcutken depo değiştirilemez',
  INVALID_MASK: 'Alanlar görüntünün tamamını kapatamaz',
  AUTH_REQUIRED: 'Oturum açın',
  CSRF_INVALID: 'Oturum doğrulanamadı; sayfayı yenileyin',
  LOGIN_FAILED: 'Parola doğru değil',
  SETUP_TOKEN_INVALID: 'Kurulum anahtarı doğru değil',
  PASSWORD_LENGTH_12_256: 'Parola 12–256 karakter olmalı',
  LOGIN_RATE_LIMIT: 'Çok fazla deneme; 15 dakika bekleyin',
  NAS_CONFIG_REQUIRED: 'NAS için mount noktası, kaynak ve depo kimliği gerekli',
  CAMERA_HAS_ARCHIVE_DISABLE_INSTEAD: 'Arşivi olan kamerayı silmek yerine devre dışı bırakın',
};
function reason(code) {
  return reasons[code]
    ? t(reasons[code])
    : KareI18n.hasMessage(code)
      ? t(code)
      : t('İşlem tamamlanamadı');
}
const date = (time) =>
  time == null
    ? '—'
    : new Intl.DateTimeFormat(KareI18n.locale(), {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(time);
const bytes = (n) =>
  n == null
    ? '—'
    : n >= GIB
      ? number(n / GIB, 1) + ' GiB'
      : n >= 1024 ** 2
        ? number(n / 1024 ** 2, 1) + ' MiB'
        : number(n / 1024, 1) + ' KiB';
function notice(text, bad = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', bad);
  $('notice').hidden = false;
}
function fail(e) {
  notice(reason(e.message), true);
}
function on(id, event, fn) {
  $(id).addEventListener(event, (e) => {
    if (event === 'submit') e.preventDefault();
    Promise.resolve()
      .then(() => fn(e))
      .catch(fail);
  });
}
async function api(url, body, method = body ? 'POST' : 'GET') {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && url !== '/api/login') showAuth();
    throw Error(data.error);
  }
  if (data.csrf) csrf = data.csrf;
  return data;
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function options(select, items, valueKey = 'id', labelKey = 'name', placeholder = null) {
  const previous = select.value;
  select.replaceChildren();
  if (placeholder) select.add(new Option(placeholder, ''));
  for (const row of items) select.add(new Option(row[labelKey], row[valueKey]));
  if (items.some((i) => i[valueKey] === previous)) select.value = previous;
}
function showAuth() {
  document.querySelector('.skip-link').href = '#auth-form';
  $('application').hidden = true;
  $('auth-screen').hidden = false;
  $('setup-label').hidden = !setupRequired;
  updateAuthText();
  $('password').minLength = setupRequired ? 12 : 1;
}
function updateAuthText() {
  $('auth-submit').textContent = setupRequired ? t('Yöneticiyi oluştur') : t('Giriş yap');
  $('auth-note').textContent = setupRequired
    ? t('İlk kurulum için .env içindeki anahtarı ve yeni yönetici parolanızı girin.')
    : t('Arşivinize güvenle erişin.');
}
async function bootstrap() {
  const session = await api('/api/session');
  setupRequired = session.setupRequired;
  if (!session.authenticated) return showAuth();
  csrf = session.csrf;
  await showApplication();
}
async function showApplication() {
  document.querySelector('.skip-link').href = '#main-content';
  $('auth-screen').hidden = true;
  $('application').hidden = false;
  $('password').value = '';
  await loadLists();
  await showPage('status');
}
async function loadLists() {
  [cameras, nvrs] = await Promise.all([api('/api/cameras'), api('/api/nvrs')]);
  options($('archive-camera'), cameras);
  options($('edit-camera'), cameras);
  options($('bulk-nvr'), nvrs);
  renderNvrs();
  fillCamera();
}
async function showPage(name) {
  if (window.gsap) {
    gsap.killTweensOf('.page');
    gsap.set('.page', { clearProps: 'transform,opacity' });
  }
  for (const p of ['status', 'archive', 'settings']) $('page-' + p).hidden = p !== name;
  for (const b of document.querySelectorAll('[data-page]')) {
    b.classList.toggle('active', b.dataset.page === name);
    if (b.dataset.page === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    gsap.fromTo(
      $('page-' + name),
      { y: 12, opacity: 0.35 },
      { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out', clearProps: 'all' },
    );
  $('notice').hidden = true;
  if (name === 'status') await refreshStatus();
  if (name === 'settings') {
    await loadSettings();
    await loadLists();
  }
}
for (const button of document.querySelectorAll('[data-page]'))
  button.addEventListener('click', () => {
    showPage(button.dataset.page).catch(fail);
    $('main-content').focus({ preventScroll: true });
  });
on('auth-form', 'submit', async () => {
  $('auth-error').textContent = '';
  try {
    await api(setupRequired ? '/api/setup' : '/api/login', {
      password: $('password').value,
      token: $('setup-token').value,
    });
    setupRequired = false;
    await showApplication();
  } catch (e) {
    $('auth-error').textContent = reason(e.message);
  }
});
on('logout', 'click', async () => {
  await api('/api/logout', {});
  await bootstrap();
});
let lastStatus = null,
  lastHistory = null,
  lastComparison = null,
  framesLoaded = false;
async function refreshStatus() {
  renderStatus(await api('/api/status'));
}
function renderStatus(data) {
  lastStatus = data;
  const selectedCamera = $('observation-camera').value;
  options($('observation-camera'), data.cameras);
  if (!data.cameras.some((c) => c.id === selectedCamera))
    $('observation-camera').value =
      data.cameras.find((c) => c.latestImageId)?.id || data.cameras[0]?.id || '';
  renderObservation();
  const s = data.storage;
  $('camera-count').textContent = data.cameras.filter((c) => c.enabled).length;
  $('camera-sub').textContent = t(
    '{0} kayıtlı kamera · {1} hata',
    data.cameras.length,
    data.cameras.filter((c) => c.lastError).length,
  );
  $('storage-size').textContent = bytes(s.bytes);
  $('storage-sub').textContent = t('{0} kapasite · {1} görüntü', bytes(s.quotaBytes), s.count);
  $('storage-progress').value = s.quotaBytes ? Math.min((s.bytes / s.quotaBytes) * 100, 100) : 0;
  $('retention-days').textContent = s.estimatedDays
    ? t('{0} gün', Math.floor(s.estimatedDays))
    : t('Henüz ölçülmedi');
  $('spool-size').textContent = bytes(s.pending.bytes);
  $('nas-state').textContent = t(
    '{0} aktarım bekliyor · {1}',
    s.pending.count,
    data.nas.stuck
      ? t('NAS işlemi takıldı')
      : data.nas.available
        ? t('NAS erişilebilir')
        : t('Yerel kayıt / NAS doğrulanmadı'),
  );
  $('warnings').replaceChildren(...data.warnings.map((w) => el('div', reason(w), 'warning')));
  if (s.nasFreeBytes != null)
    $('nas-state').textContent += t(
      ' · NAS boş alan {0} ({1}, {2})',
      bytes(s.nasFreeBytes),
      data.nas.available ? t('doğrulandı') : t('son ölçüm'),
      date(s.nasMeasuredAt),
    );
  if (data.runtime?.backgroundError)
    $('warnings').append(
      el('div', t('Arka plan işi durakladı: ') + reason(data.runtime.backgroundError), 'warning'),
    );
  if (data.scheduler.health)
    $('warnings').append(
      el('div', t('Yerel veritabanı sağlıksız; ayrıntılı kayıt garanti edilemiyor.'), 'warning'),
    );
  if (data.nas.stuck)
    $('warnings').append(
      el(
        'div',
        t(
          'NAS işlemi yanıt vermiyor. Yerel alan yettiği sürece çekimler sürer; NAS için işletim sistemi müdahalesi gerekebilir.',
        ),
        'warning',
      ),
    );
  if (data.nas.lastError && !data.nas.stuck)
    $('warnings').append(el('div', reason(data.nas.lastError), 'warning'));
  $('camera-table').replaceChildren();
  for (const c of data.cameras) {
    const tr = el('tr');
    const name = el('td'),
      wrap = el('div', null, 'camera-cell');
    if (c.latestImageId) {
      const preview = el('img');
      preview.src = `/api/images/${c.latestImageId}/thumbnail`;
      preview.alt = c.name + t(' son görüntüsü');
      preview.loading = 'lazy';
      wrap.append(preview);
    }
    wrap.append(el('span', c.name));
    name.append(wrap);
    tr.append(name);
    const state = el('td');
    state.append(
      el(
        'span',
        !c.enabled
          ? t('Kapalı')
          : c.lastError
            ? reason(c.lastError)
            : c.lastSuccess
              ? t('Çekim başarılı')
              : t('İlk çekim bekleniyor'),
        'pill ' + (!c.enabled ? 'neutral' : c.lastError ? 'bad' : ''),
      ),
    );
    tr.append(
      state,
      el('td', date(c.lastSuccess)),
      el('td', number(c.intervalMs / 60000) + t(' dk')),
    );
    $('camera-table').append(tr);
  }
  if (!data.cameras.length) {
    const tr = el('tr'),
      td = el('td', t('Henüz kamera eklenmedi. Ayarlar ekranından NVR ve kanalları ekleyin.'));
    td.colSpan = 4;
    tr.append(td);
    $('camera-table').append(tr);
  }
  $('clock-label').textContent = t('SON KONTROL · ') + date(Date.now());
}
on('refresh-status', 'click', refreshStatus);
function renderObservation() {
  const camera = lastStatus?.cameras.find((c) => c.id === $('observation-camera').value);
  const image = $('capture-preview');
  const hasImage = Boolean(camera?.latestImageId);
  $('capture-camera-name').textContent = camera?.name || 'Kare';
  $('capture-time').textContent = camera?.latestImageAt ? date(camera.latestImageAt) : '';
  $('capture-empty').hidden = hasImage;
  $('capture-empty').querySelector('p').textContent = t('Henüz bir görüntü yok');
  image.hidden = !hasImage;
  $('open-camera-archive').disabled = !camera;
  $('observation-camera').disabled = !camera;
  if (hasImage) {
    const source = `/api/images/${encodeURIComponent(camera.latestImageId)}/thumbnail`;
    image.alt = camera.name + t(' son görüntüsü');
    if (image.getAttribute('src') !== source) {
      image.src = source;
      if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.killTweensOf(image);
        gsap.fromTo(
          image,
          { x: 18, opacity: 0.3 },
          { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'all' },
        );
      }
    }
  } else image.removeAttribute('src');
}
$('capture-preview').addEventListener('error', () => {
  $('capture-preview').hidden = true;
  $('capture-empty').hidden = false;
  $('capture-empty').querySelector('p').textContent = t('Görüntü yüklenemedi');
});
on('observation-camera', 'change', renderObservation);
on('open-camera-archive', 'click', async () => {
  const camera = lastStatus?.cameras.find((c) => c.id === $('observation-camera').value);
  if (!camera) return;
  $('archive-camera').value = camera.id;
  if (camera.latestImageAt)
    $('archive-date').value = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(camera.latestImageAt);
  await showPage('archive');
  $('main-content').focus({ preventScroll: true });
  $('archive-filter').requestSubmit();
});
function archiveQuery() {
  return new URLSearchParams({ cameraId: $('archive-camera').value, day: $('archive-date').value });
}
async function loadFrames(more = false) {
  if (!more) {
    stopPlayback();
    $('viewer').close();
  }
  const query = archiveQuery();
  if (!query.get('cameraId')) throw Error('Önce bir kamera ekleyin');
  if (more && cursor) query.set('cursor', cursor);
  const data = await api('/api/images?' + query);
  if (!more) archiveFrames = [];
  archiveFrames.push(...data.items);
  cursor = data.nextCursor;
  renderFrames();
  if (!more) {
    const entries = await api('/api/history?' + archiveQuery());
    renderHistory(entries);
  }
}
function stateLabel(image) {
  return image.availability === 'missing'
    ? t('Dosya kaybı doğrulandı')
    : image.availability === 'unavailable'
      ? t('NAS geçici olarak erişilemiyor')
      : image.state === 'pending'
        ? t('Yerelde güvenle saklandı · aktarım bekliyor')
        : t('Arşivde');
}
function renderFrames() {
  framesLoaded = true;
  $('frames').replaceChildren();
  archiveFrames.forEach((image, index) => {
    const button = el('button', null, 'frame'),
      img = el('img');
    img.src = `/api/images/${image.id}/thumbnail`;
    img.alt = date(image.capturedAt) + t(' kamera görüntüsü');
    img.loading = 'lazy';
    img.onerror = () => {
      img.alt = stateLabel(image);
    };
    const caption = el('div', null, 'caption');
    caption.append(el('span', date(image.capturedAt)), el('small', stateLabel(image)));
    button.append(img, caption);
    button.addEventListener('click', () => openViewer(index));
    $('frames').append(button);
  });
  $('frame-count').textContent = number(archiveFrames.length) + t(' görüntü');
  $('archive-empty').hidden = !!archiveFrames.length;
  $('archive-empty').textContent = t(
    'Bu dönem için saklanan görüntü bulunamadı. Aşağıdaki geçmiş açıklamalarını inceleyin.',
  );
  $('more-frames').hidden = !cursor;
}
function renderHistory(entries) {
  lastHistory = entries;
  $('history-list').replaceChildren();
  for (const entry of entries) {
    let text;
    if (entry.kind === 'daily')
      text = t(
        '{0} · Planlanan {1}, başarılı {2}, başarısız {3}, atlanan {4}. Benzerlik: {5}, kapasite: {6} görüntü silindi.',
        new Intl.DateTimeFormat(KareI18n.locale(), {
          dateStyle: 'short',
          timeZone: 'Europe/Istanbul',
        }).format(entry.start),
        entry.planned,
        entry.success,
        entry.failed,
        entry.skipped,
        entry.deleted.similarity || 0,
        entry.deleted.capacity || 0,
      );
    else if (entry.kind === 'setting')
      text = t(
        'Çekim ayarı değişti · {0} dakika · {1}',
        entry.intervalMs / 60000,
        entry.enabled ? t('etkin') : t('kapalı'),
      );
    else
      text = `${reason(entry.reason)} · ${date(entry.start)} — ${entry.end == null ? t('devam ediyor') : date(entry.end)}${entry.approximate ? t(' · yaklaşık dönem') : ''}${entry.count ? ' · ' + number(entry.count) + t(' görüntü (dönem özeti)') : ''}`;
    $('history-list').append(el('div', text, 'history-item'));
  }
  if (!entries.length)
    $('history-list').append(
      el('p', t('Bu dönem için açıklayıcı kayıt yok; boşluğun nedeni bilinmiyor.'), 'muted'),
    );
}
function openViewer(index) {
  if (!archiveFrames[index]) return;
  viewerIndex = index;
  const image = archiveFrames[index];
  $('viewer-title').textContent = date(image.capturedAt);
  $('viewer-image').src = `/api/images/${image.id}/original`;
  $('viewer-state').textContent = stateLabel(image);
  $('download-frame').href = `/api/images/${image.id}/original?download=1`;
  $('previous-frame').disabled = index === 0;
  $('next-frame').disabled = index === archiveFrames.length - 1;
  $('play-backward').disabled = index === 0;
  $('play-forward').disabled = index === archiveFrames.length - 1;
  if (
    (playbackDirection === -1 && index === 0) ||
    (playbackDirection === 1 && index === archiveFrames.length - 1)
  )
    stopPlayback();
  if (!$('viewer').open) $('viewer').showModal();
}
function stopPlayback() {
  clearTimeout(playbackTimer);
  playbackTimer = null;
  playbackDirection = 0;
  $('pause-playback').disabled = true;
  $('play-backward').setAttribute('aria-pressed', 'false');
  $('play-forward').setAttribute('aria-pressed', 'false');
}
function schedulePlayback() {
  clearTimeout(playbackTimer);
  const fps = 0.3 + ((Number($('playback-speed').value) - 1) * 3.7) / 9;
  playbackTimer = setTimeout(() => {
    if (!$('viewer').open) return stopPlayback();
    openViewer(viewerIndex + playbackDirection);
    if (playbackDirection) schedulePlayback();
  }, 1000 / fps);
}
function startPlayback(direction) {
  stopPlayback();
  if (!archiveFrames[viewerIndex + direction]) return;
  playbackDirection = direction;
  $('pause-playback').disabled = false;
  $(direction === 1 ? 'play-forward' : 'play-backward').setAttribute('aria-pressed', 'true');
  schedulePlayback();
}
function stepViewer(direction) {
  stopPlayback();
  openViewer(viewerIndex + direction);
}
for (let speed = 1; speed <= 10; speed++) {
  const option = el('option', speed + 'x');
  option.value = speed;
  $('playback-speed').append(option);
}
on('play-forward', 'click', () => startPlayback(1));
on('play-backward', 'click', () => startPlayback(-1));
on('pause-playback', 'click', stopPlayback);
on('playback-speed', 'change', () => {
  if (playbackDirection) schedulePlayback();
});
on('viewer', 'close', stopPlayback);
on('viewer', 'cancel', stopPlayback);
document.addEventListener('keydown', (event) => {
  if (!$('viewer').open) return;
  if (event.target.closest('input, select, textarea, [contenteditable]')) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    stepViewer(event.key === 'ArrowRight' ? 1 : -1);
  }
});
on('archive-filter', 'submit', () => loadFrames());
on('more-frames', 'click', () => loadFrames(true));
on('close-viewer', 'click', () => $('viewer').close());
on('previous-frame', 'click', () => stepViewer(-1));
on('next-frame', 'click', () => stepViewer(1));
async function loadSettings() {
  const s = await api('/api/settings');
  $('quota').value = s.quotaBytes ? s.quotaBytes / GIB : '';
  $('spool-quota').value = s.spoolQuotaBytes ? s.spoolQuotaBytes / GIB : '';
  for (const [id, key] of [
    ['nas-path', 'nasPath'],
    ['mount-point', 'mountPoint'],
    ['mount-source', 'mountSource'],
    ['depot-id', 'depotId'],
  ])
    $(id).value = s[key] || '';
  $('compaction-enabled').checked = !!s.compactionEnabled;
}
on('storage-form', 'submit', async () => {
  await api(
    '/api/settings',
    {
      quotaBytes: Math.round(Number($('quota').value) * GIB),
      spoolQuotaBytes: $('spool-quota').value
        ? Math.round(Number($('spool-quota').value) * GIB)
        : null,
      nasPath: $('nas-path').value.trim() || null,
      mountPoint: $('mount-point').value.trim(),
      mountSource: $('mount-source').value.trim(),
      depotId: $('depot-id').value.trim(),
      compactionEnabled: $('compaction-enabled').checked,
    },
    'PUT',
  );
  notice(t('Depolama ayarları kaydedildi.'));
});
on('test-nas', 'click', async () => {
  const r = await api('/api/nas/test', {});
  notice(t('NAS kimliği doğrulandı · {0} boş alan', bytes(r.freeBytes)));
});
on('cleanup-form', 'submit', async () => {
  const button = $('cleanup-start');
  if (button.disabled) return;
  button.disabled = true;
  $('cleanup-result').textContent = t('Temizlik çalışıyor…');
  try {
    const result = await api('/api/cleanup', { days: Number($('cleanup-days').value) });
    $('cleanup-result').textContent = t(
      'Temizlik tamamlandı · {0} kamera · {1} görüntü silindi · {2} görüntü atlandı.',
      number(result.cameras),
      number(result.deleted),
      number(result.skipped),
    );
  } catch (e) {
    $('cleanup-result').textContent = t(
      'Temizlik tamamlanamadı; işlenen görüntüler silinmiş olabilir.',
    );
    throw e;
  } finally {
    button.disabled = false;
  }
});
on('init-nas', 'click', async () => {
  await api('/api/nas/initialize', {});
  notice(t('NAS depo kimliği oluşturuldu.'));
});
function renderNvrs() {
  $('nvr-list').replaceChildren();
  for (const n of nvrs) {
    const row = el('div', null, 'nvr-row');
    row.append(el('span', `${n.name} · ${n.host}`));
    const edit = el('button', t('Düzenle'));
    edit.type = 'button';
    edit.onclick = () => {
      $('nvr-id').value = n.id;
      $('nvr-name').value = n.name;
      $('nvr-host').value = n.host;
      $('nvr-user').value = n.username;
      $('nvr-password').value = '';
    };
    const test = el('button', t('Test'));
    test.type = 'button';
    test.onclick = () =>
      api(`/api/nvrs/${n.id}/test`, { channel: 1 })
        .then((r) => notice(t('NVR görüntüsü alındı · {0}', bytes(r.bytes))))
        .catch(fail);
    const remove = el('button', t('Sil'));
    remove.type = 'button';
    remove.onclick = () => api(`/api/nvrs/${n.id}`, null, 'DELETE').then(loadLists).catch(fail);
    row.append(edit, test, remove);
    $('nvr-list').append(row);
  }
}
on('new-nvr', 'click', () => {
  $('nvr-form').reset();
  $('nvr-id').value = '';
});
on('nvr-form', 'submit', async () => {
  const id = $('nvr-id').value;
  await api(
    '/api/nvrs' + (id ? '/' + id : ''),
    {
      name: $('nvr-name').value,
      host: $('nvr-host').value,
      username: $('nvr-user').value,
      password: $('nvr-password').value,
    },
    id ? 'PUT' : 'POST',
  );
  $('nvr-form').reset();
  $('nvr-id').value = '';
  await loadLists();
  notice(t('NVR bağlantısı kaydedildi.'));
});
on('bulk-form', 'submit', async () => {
  await api('/api/cameras/bulk', {
    nvrId: $('bulk-nvr').value,
    name: $('bulk-name').value,
    first: Number($('bulk-first').value),
    last: Number($('bulk-last').value),
  });
  await loadLists();
  notice(t('Kameralar eklendi.'));
});
function fillCamera() {
  const c = cameras.find((c) => c.id === $('edit-camera').value);
  $('camera-fields').hidden = !c;
  if (!c) return;
  $('camera-name').value = c.name;
  $('camera-interval').value = c.intervalMs / 60000;
  $('camera-anchor').value = (c.anchorMs || 3600000) / 60000;
  $('camera-sensitivity').value = c.sensitivity || 'medium';
  $('camera-enabled').checked = c.enabled;
  currentMasks = structuredClone(c.masks || []);
  maskImage = null;
  $('mask-canvas').hidden = true;
  $('compare-first').replaceChildren();
  $('compare-second').replaceChildren();
  $('compare-result').textContent = '';
  lastComparison = null;
  drawMasks();
}
on('edit-camera', 'change', fillCamera);
on('camera-form', 'submit', async () => {
  const id = $('edit-camera').value;
  await api(
    '/api/cameras/' + id,
    {
      name: $('camera-name').value,
      intervalMs: Math.round(Number($('camera-interval').value) * 60000),
      anchorMs: Math.round(Number($('camera-anchor').value) * 60000),
      sensitivity: $('camera-sensitivity').value,
      enabled: $('camera-enabled').checked,
      masks: currentMasks,
    },
    'PUT',
  );
  await loadLists();
  notice(t('Kamera ayarları kaydedildi.'));
});
on('copy-masks', 'click', async () => {
  const id = $('edit-camera').value;
  if (!id || !currentMasks.length || copyingMasks) return;
  const masks = structuredClone(currentMasks);
  copyingMasks = true;
  drawMasks();
  try {
    const result = await api(`/api/cameras/${id}/copy-masks`, { masks });
    cameras = await api('/api/cameras');
    notice(
      t('Alanlar {0} kameraya uygulandı; {1} kamera güncellendi.', result.total, result.updated),
    );
  } finally {
    copyingMasks = false;
    drawMasks();
  }
});
function drawMasks(preview) {
  $('mask-count').textContent = number(currentMasks.length) + t(' alan');
  $('copy-masks').disabled = copyingMasks || !currentMasks.length;
  if (!maskImage) return;
  const canvas = $('mask-canvas'),
    ctx = canvas.getContext('2d');
  ctx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
  for (const m of [...currentMasks, ...(preview ? [preview] : [])]) {
    ctx.fillStyle = '#1da99a44';
    ctx.strokeStyle = '#55f6cb';
    ctx.lineWidth = 2;
    ctx.fillRect(
      m.x * canvas.width,
      m.y * canvas.height,
      m.width * canvas.width,
      m.height * canvas.height,
    );
    ctx.strokeRect(
      m.x * canvas.width,
      m.y * canvas.height,
      m.width * canvas.width,
      m.height * canvas.height,
    );
  }
}
on('load-mask-image', 'click', async () => {
  const list = await api('/api/cameras/' + $('edit-camera').value + '/recent');
  if (!list.length) throw Error('Bu kameradan henüz görüntü alınmamış.');
  const choices = list.map((i) => ({ ...i, name: date(i.capturedAt) }));
  options($('compare-first'), choices);
  options($('compare-second'), choices);
  for (const id of ['compare-first', 'compare-second']) {
    for (const [index, option] of Array.from($(id).options).entries())
      option.dataset.time = list[index].capturedAt;
  }
  $('compare-second').selectedIndex = Math.min(1, choices.length - 1);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(Error('Görüntü erişilemiyor'));
    image.src = `/api/images/${list[0].id}/original`;
  });
  maskImage = image;
  const canvas = $('mask-canvas');
  canvas.width = Math.min(image.naturalWidth, 960);
  canvas.height = Math.round((canvas.width * image.naturalHeight) / image.naturalWidth);
  canvas.hidden = false;
  drawMasks();
});
function point(e) {
  const b = $('mask-canvas').getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - b.x) / b.width)),
    y: Math.max(0, Math.min(1, (e.clientY - b.y) / b.height)),
  };
}
function rect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
on('mask-canvas', 'pointerdown', (e) => {
  dragStart = point(e);
  $('mask-canvas').setPointerCapture(e.pointerId);
});
on('mask-canvas', 'pointermove', (e) => {
  if (dragStart) drawMasks(rect(dragStart, point(e)));
});
on('mask-canvas', 'pointerup', (e) => {
  if (!dragStart) return;
  const m = rect(dragStart, point(e));
  dragStart = null;
  if (m.width > 0.005 && m.height > 0.005) currentMasks.push(m);
  drawMasks();
});
on('clear-masks', 'click', () => {
  currentMasks = [];
  drawMasks();
});
on('add-mask', 'click', () => {
  const m = {
    x: Number($('mask-x').value) / 100,
    y: Number($('mask-y').value) / 100,
    width: Number($('mask-w').value) / 100,
    height: Number($('mask-h').value) / 100,
  };
  if (
    m.width <= 0 ||
    m.height <= 0 ||
    m.x < 0 ||
    m.y < 0 ||
    m.x + m.width > 1 ||
    m.y + m.height > 1
  )
    throw Error('Alan görüntü sınırları içinde olmalı.');
  currentMasks.push(m);
  drawMasks();
});
on('compare', 'click', async () => {
  const result = await api('/api/cameras/' + $('edit-camera').value + '/compare', {
    first: $('compare-first').value,
    second: $('compare-second').value,
  });
  renderComparison(result);
});
function renderComparison(result) {
  lastComparison = result;
  $('compare-result').textContent = t(
    '{0} Değişen alan: {1} · Politika {2}',
    result.similar
      ? t('Benzer; eskiyse sadeleştirilebilir.')
      : t('Değişiklik var veya analiz belirsiz; korunur.'),
    result.changedRatio == null ? t('belirsiz') : number(result.changedRatio * 100, 3) + '%',
    result.policyVersion,
  );
}
$('archive-date').value = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(Date.now());
KareI18n.init(() => {
  updateAuthText();
  if (lastStatus) renderStatus(lastStatus);
  if (framesLoaded) renderFrames();
  if (lastHistory) renderHistory(lastHistory);
  if ($('viewer').open) openViewer(viewerIndex);
  renderNvrs();
  if (lastComparison) renderComparison(lastComparison);
  for (const id of ['compare-first', 'compare-second']) {
    for (const option of $(id).options) {
      if (option.dataset.time) option.textContent = date(Number(option.dataset.time));
    }
  }
  drawMasks();
});
bootstrap().catch((e) => {
  $('auth-error').textContent = reason(e.message);
});
setInterval(() => {
  if (!$('application').hidden && !$('page-status').hidden && !document.hidden)
    refreshStatus().catch(fail);
}, 30000);
