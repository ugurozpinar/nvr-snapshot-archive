'use strict';
const $ = (id) => document.getElementById(id),
  GIB = 1024 ** 3;
let csrf = '',
  setupRequired = false,
  cameras = [],
  nvrs = [],
  frames = [],
  cursor = null,
  viewerIndex = 0,
  currentMasks = [],
  maskImage = null,
  dragStart = null;
const reasons = {
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
const date = (time) =>
  time == null
    ? '—'
    : new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(time);
const bytes = (n) =>
  n == null
    ? '—'
    : n >= GIB
      ? (n / GIB).toFixed(1) + ' GiB'
      : n >= 1024 ** 2
        ? (n / 1024 ** 2).toFixed(1) + ' MiB'
        : (n / 1024).toFixed(1) + ' KiB';
function notice(text, bad = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', bad);
  $('notice').hidden = false;
}
function fail(e) {
  notice(reasons[e.message] || e.message || 'İşlem tamamlanamadı', true);
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
  $('application').hidden = true;
  $('auth-screen').hidden = false;
  $('setup-label').hidden = !setupRequired;
  $('auth-submit').textContent = setupRequired ? 'Yöneticiyi oluştur' : 'Giriş yap';
  $('auth-note').textContent = setupRequired
    ? 'İlk kurulum için .env içindeki anahtarı ve yeni yönetici parolanızı girin.'
    : 'Arşivinize güvenle erişin.';
  $('password').minLength = setupRequired ? 12 : 1;
}
async function bootstrap() {
  const session = await api('/api/session');
  setupRequired = session.setupRequired;
  if (!session.authenticated) return showAuth();
  csrf = session.csrf;
  await showApplication();
}
async function showApplication() {
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
  for (const p of ['status', 'archive', 'settings']) $('page-' + p).hidden = p !== name;
  for (const b of document.querySelectorAll('[data-page]'))
    b.classList.toggle('active', b.dataset.page === name);
  $('notice').hidden = true;
  if (name === 'status') await refreshStatus();
  if (name === 'settings') {
    await loadSettings();
    await loadLists();
  }
}
for (const button of document.querySelectorAll('[data-page]'))
  button.addEventListener('click', () => showPage(button.dataset.page).catch(fail));
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
    $('auth-error').textContent = reasons[e.message] || e.message;
  }
});
on('logout', 'click', async () => {
  await api('/api/logout', {});
  await bootstrap();
});
async function refreshStatus() {
  const data = await api('/api/status'),
    s = data.storage;
  $('camera-count').textContent = data.cameras.filter((c) => c.enabled).length;
  $('camera-sub').textContent =
    `${data.cameras.length} kayıtlı kamera · ${data.cameras.filter((c) => c.lastError).length} hata`;
  $('storage-size').textContent = bytes(s.bytes);
  $('storage-sub').textContent = `${bytes(s.quotaBytes)} kapasite · ${s.count} görüntü`;
  $('storage-progress').value = s.quotaBytes ? Math.min((s.bytes / s.quotaBytes) * 100, 100) : 0;
  $('retention-days').textContent = s.estimatedDays
    ? Math.floor(s.estimatedDays) + ' gün'
    : 'Henüz ölçülmedi';
  $('spool-size').textContent = bytes(s.pending.bytes);
  $('nas-state').textContent =
    `${s.pending.count} aktarım bekliyor · ${data.nas.stuck ? 'NAS işlemi takıldı' : data.nas.available ? 'NAS erişilebilir' : 'Yerel kayıt / NAS doğrulanmadı'}`;
  $('warnings').replaceChildren(...data.warnings.map((w) => el('div', reasons[w] || w, 'warning')));
  if (data.scheduler.health)
    $('warnings').append(
      el('div', 'Yerel veritabanı sağlıksız; ayrıntılı kayıt garanti edilemiyor.', 'warning'),
    );
  if (data.nas.stuck)
    $('warnings').append(
      el(
        'div',
        'NAS işlemi yanıt vermiyor. Yerel alan yettiği sürece çekimler sürer; NAS için işletim sistemi müdahalesi gerekebilir.',
        'warning',
      ),
    );
  $('camera-table').replaceChildren();
  for (const c of data.cameras) {
    const tr = el('tr');
    tr.append(el('td', c.name));
    const state = el('td');
    state.append(
      el(
        'span',
        !c.enabled
          ? 'Kapalı'
          : c.lastError
            ? reasons[c.lastError] || c.lastError
            : c.lastSuccess
              ? 'Çekim başarılı'
              : 'İlk çekim bekleniyor',
        'pill ' + (!c.enabled ? 'neutral' : c.lastError ? 'bad' : ''),
      ),
    );
    tr.append(state, el('td', date(c.lastSuccess)), el('td', c.intervalMs / 60000 + ' dk'));
    $('camera-table').append(tr);
  }
  if (!data.cameras.length) {
    const tr = el('tr'),
      td = el('td', 'Henüz kamera eklenmedi. Ayarlar ekranından NVR ve kanalları ekleyin.');
    td.colSpan = 4;
    tr.append(td);
    $('camera-table').append(tr);
  }
  $('clock-label').textContent = 'SON KONTROL · ' + date(Date.now());
}
on('refresh-status', 'click', refreshStatus);
function archiveQuery() {
  return new URLSearchParams({ cameraId: $('archive-camera').value, day: $('archive-date').value });
}
async function loadFrames(more = false) {
  const query = archiveQuery();
  if (!query.get('cameraId')) throw Error('Önce bir kamera ekleyin');
  if (more && cursor) query.set('cursor', cursor);
  const data = await api('/api/images?' + query);
  if (!more) frames = [];
  frames.push(...data.items);
  cursor = data.nextCursor;
  renderFrames();
  if (!more) {
    const entries = await api('/api/history?' + archiveQuery());
    renderHistory(entries);
  }
}
function stateLabel(image) {
  return image.availability === 'missing'
    ? 'Dosya kaybı doğrulandı'
    : image.availability === 'unavailable'
      ? 'NAS geçici olarak erişilemiyor'
      : image.state === 'pending'
        ? 'Yerelde güvenle saklandı · aktarım bekliyor'
        : 'Arşivde';
}
function renderFrames() {
  $('frames').replaceChildren();
  frames.forEach((image, index) => {
    const button = el('button', null, 'frame'),
      img = el('img');
    img.src = `/api/images/${image.id}/thumbnail`;
    img.alt = date(image.capturedAt) + ' kamera görüntüsü';
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
  $('frame-count').textContent = frames.length + ' görüntü';
  $('archive-empty').hidden = !!frames.length;
  $('archive-empty').textContent =
    'Bu dönem için saklanan görüntü bulunamadı. Aşağıdaki geçmiş açıklamalarını inceleyin.';
  $('more-frames').hidden = !cursor;
}
function renderHistory(entries) {
  $('history-list').replaceChildren();
  for (const entry of entries) {
    let text;
    if (entry.kind === 'daily')
      text = `${entry.day} · Planlanan ${entry.planned}, başarılı ${entry.success}, başarısız ${entry.failed}, atlanan ${entry.skipped}. Benzerlik: ${entry.deleted.similarity || 0}, kapasite: ${entry.deleted.capacity || 0} görüntü silindi.`;
    else if (entry.kind === 'setting')
      text = `Çekim ayarı değişti · ${entry.intervalMs / 60000} dakika · ${entry.enabled ? 'etkin' : 'kapalı'}`;
    else
      text = `${reasons[entry.reason] || entry.reason} · ${date(entry.start)} — ${entry.end == null ? 'devam ediyor' : date(entry.end)}${entry.approximate ? ' · yaklaşık dönem' : ''}${entry.count ? ' · ' + entry.count + ' görüntü (dönem özeti)' : ''}`;
    $('history-list').append(el('div', text, 'history-item'));
  }
  if (!entries.length)
    $('history-list').append(
      el('p', 'Bu dönem için açıklayıcı kayıt yok; boşluğun nedeni bilinmiyor.', 'muted'),
    );
}
function openViewer(index) {
  viewerIndex = index;
  const image = frames[index];
  $('viewer-title').textContent = date(image.capturedAt);
  $('viewer-image').src = `/api/images/${image.id}/original`;
  $('viewer-state').textContent = stateLabel(image);
  $('download-frame').href = `/api/images/${image.id}/original?download=1`;
  $('previous-frame').disabled = index === 0;
  $('next-frame').disabled = index === frames.length - 1;
  if (!$('viewer').open) $('viewer').showModal();
}
on('archive-filter', 'submit', () => loadFrames());
on('more-frames', 'click', () => loadFrames(true));
on('close-viewer', 'click', () => $('viewer').close());
on('previous-frame', 'click', () => openViewer(viewerIndex - 1));
on('next-frame', 'click', () => openViewer(viewerIndex + 1));
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
  notice('Depolama ayarları kaydedildi.');
});
on('test-nas', 'click', async () => {
  const r = await api('/api/nas/test', {});
  notice('NAS kimliği doğrulandı · ' + bytes(r.freeBytes) + ' boş alan');
});
on('init-nas', 'click', async () => {
  await api('/api/nas/initialize', {});
  notice('NAS depo kimliği oluşturuldu.');
});
function renderNvrs() {
  $('nvr-list').replaceChildren();
  for (const n of nvrs) {
    const row = el('div', null, 'nvr-row');
    row.append(el('span', `${n.name} · ${n.host}`));
    const edit = el('button', 'Düzenle');
    edit.type = 'button';
    edit.onclick = () => {
      $('nvr-id').value = n.id;
      $('nvr-name').value = n.name;
      $('nvr-host').value = n.host;
      $('nvr-user').value = n.username;
      $('nvr-password').value = '';
    };
    const test = el('button', 'Test');
    test.type = 'button';
    test.onclick = () =>
      api(`/api/nvrs/${n.id}/test`, { channel: 1 })
        .then((r) => notice('NVR görüntüsü alındı · ' + bytes(r.bytes)))
        .catch(fail);
    const remove = el('button', 'Sil');
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
  notice('NVR bağlantısı kaydedildi.');
});
on('bulk-form', 'submit', async () => {
  await api('/api/cameras/bulk', {
    nvrId: $('bulk-nvr').value,
    name: $('bulk-name').value,
    first: Number($('bulk-first').value),
    last: Number($('bulk-last').value),
  });
  await loadLists();
  notice('Kameralar eklendi.');
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
  $('camera-calibrated').checked = !!c.calibrated;
  currentMasks = structuredClone(c.masks || []);
  maskImage = null;
  $('mask-canvas').hidden = true;
  $('compare-first').replaceChildren();
  $('compare-second').replaceChildren();
  $('compare-result').textContent = '';
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
      calibrated: $('camera-calibrated').checked,
      masks: currentMasks,
    },
    'PUT',
  );
  await loadLists();
  notice('Kamera ayarları kaydedildi. Maske veya hassasiyet değiştiyse doğrulamayı yeniden yapın.');
});
function drawMasks(preview) {
  $('mask-count').textContent = currentMasks.length + ' alan';
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
  $('camera-calibrated').checked = false;
  drawMasks();
});
on('clear-masks', 'click', () => {
  currentMasks = [];
  $('camera-calibrated').checked = false;
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
  $('camera-calibrated').checked = false;
  drawMasks();
});
on('compare', 'click', async () => {
  const result = await api('/api/cameras/' + $('edit-camera').value + '/compare', {
    first: $('compare-first').value,
    second: $('compare-second').value,
  });
  $('compare-result').textContent =
    `${result.similar ? 'Benzer; eskiyse sadeleştirilebilir.' : 'Değişiklik var veya analiz belirsiz; korunur.'} Değişen alan: ${result.changedRatio == null ? 'belirsiz' : (result.changedRatio * 100).toFixed(3) + '%'} · Politika ${result.policyVersion}`;
});
$('archive-date').value = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(Date.now());
bootstrap().catch((e) => {
  $('auth-error').textContent = e.message;
});
