# Camera Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yaklaşık 90 kameradan alınan görüntüleri kapasite kontrollü, geçmişi açıklanabilir ve web üzerinden taranabilir bir arşive dönüştürmek.

**Architecture:** Yerel SQLite ve önce yerelde kalıcı kayıt kullanan tek Node.js uygulaması. NAS dosya işlemleri ayrı yardımcı süreçte; çekim, aktarım, sadeleştirme ve web sorumlulukları ayrı modüllerde. Aşağıdaki teslimler bağımlılık sırasındadır; her biri kendi testleriyle çalışır.

**Tech Stack:** CommonJS JavaScript, yürütme başında destek durumu doğrulanarak seçilecek Node.js LTS; Express, better-sqlite3, sharp, digest-fetch, argon2; node:test; Playwright ile tarayıcı kabul testleri. Sunucunun sunduğu yalın HTML/CSS/JavaScript arayüz; ayrı frontend derlemesi yok. Paket sürümleri kurulum sırasında registry üzerinden doğrulanıp lockfile'a sabitlenir.

**Spec:** `docs/superpowers/specs/2026-10-19-camera-archive-design.md`

## Global Constraints

- Sürekli açık Linux bilgisayar; süreç yaşam döngüsü PM2 tarafından yönetilir.
- Startup, servis kurulumu ve PM2 yapılandırması kapsam dışıdır.
- Yalnızca yerel ağda çalışan web arayüzü ve tek yönetici hesabı.
- Varsayılan çekim aralığı 15 dakikadır; kamera bazında değiştirilebilir.
- En fazla dört eşzamanlı istek; 20 saniye zaman aşımı; iki ek deneme, 15/30 saniye bekleme.
- Her görüntü önce yerelde güvenle saklanır; NAS çağrıları çekim yoluna girmez.
- NAS işleri 30 saniye son tarihli ayrı süreçte; sonlanmayan yardımcı süreç çoğaltılmaz.
- İlk 168 saat benzerlik nedeniyle silme yok; kapasite zorunluluğu bu korumayı aşabilir.
- Benzerlik maskeleri orijinali değiştirmez; varsayılan koruma aralığı bir saat.
- Kapasite temizliği %95'te başlar ve %90'a inmeyi hedefler.
- NAS erişilemezliği dosya kaybı değildir; kuyruktaki tek yerel kopya temizlenmez.
- Kamera başına tek karelik benzerlik silme geçmişi yok; kalıcı dönem/gün özetleri var.
- Katalog zamanı UTC, varsayılan gösterim Europe/Istanbul.
- Ürün kodu ancak bu plan incelenip yürütme yöntemi seçildikten sonra yazılır.

## Review Focus

1. NAS çağrısı kernel seviyesinde takılırken çekim, web ve SQLite çalışmayı sürdürmeli; görev 6.
2. Yazma/rename/katalog/aktarım aralarında ani süreç ölümü dosyayı kaybettirmemeli veya çoğaltmamalı; görev 3 ve 6.
3. Yeniden kullanılan mount yolu veya NAS izin hatası görüntüleri kayıp göstermemeli; görev 6.
4. Aralık değişikliği, gece yarısı ve uygulama kesintisi günlük geçmiş sayımlarını bozmamalı; görev 4 ve 9.
5. Tekrarlanan temizlik, ayar değişikliği ve boş sahne benzerlikte yanlış zincirleme silmeye yol açmamalı; görev 7 ve 8.

## Dosya haritası ve ortak sözleşmeler

- `src/app.js`, `src/config.js`: bağımlılıkların kurulması ve doğrulanmış ortam ayarları.
- `src/db/{open,migrate,repositories}.js`, `src/db/migrations/001-initial.sql`: yerel kalıcı durum.
- `src/security/{secrets,auth}.js`: NVR sırları ve yönetici oturumu.
- `src/capture/{nvr-client,scheduler}.js`: cihaz HTTP adaptörü ve zamanlayıcı.
- `src/archive/{local-store,reconcile}.js`: yerel atomik kayıt ve başlangıç uzlaştırması.
- `src/nas/{supervisor,worker,transfer}.js`: NAS IPC sınırı ve aktarım.
- `src/retention/{similarity,compaction,capacity}.js`: görüntü analizi ve silme.
- `src/history/service.js`: kalıcı dönemler, günlük özet ve yaşam işareti.
- `src/web/{server,routes,media}.js`, `public/{index.html,app.js,styles.css}`: API ve Türkçe arayüz.
- `test/{unit,integration,browser}/`, `test/helpers/`: sahte saat, NVR, dosya sistemi ve worker taşıması.

Ortak türler JSDoc ile `src/types.js` içinde tanımlanır: `Camera {id,nvrId,channel,name,enabled,intervalMs,anchorMs,sensitivity,masks}`, `Mask {x,y,width,height}` (0..1), `Image {id,cameraId,capturedAt,bytes,checksum,localPath,nasPath,state,policyVersion}`, `state = local|pending|transferred|unavailable|missing|deleting`. Görüntü erişilebilirliği ayrı `availability = unknown|available|unavailable|missing` alanıdır; NAS kesintisi kalıcı yerleşim durumunu değiştirmez. Zamanlar UTC epoch milisaniye; kimlikler UUID. Dosya işlemlerinde istemci girdisi değil katalog kimliği kullanılır.

`createRepositories(db)` aşağıdaki depoları verir: `settings`, `nvrs`, `cameras`, `images`, `jobs`, `history`. Her depoda `get(id)`, `list(filter)`, `save(record)`; yalnızca gereken depolarda açık isimli ek metotlar eklenir. Kalıcı dosya geçişleri aynı iş kimliğiyle yeniden yürütülebilir olmalıdır. Testlerde gerçek Linux I/O yerine enjekte edilen `fs`, `clock` ve worker taşıması kullanılabilir; son kabul ayrıca Linux'ta yapılır.

## Task 1: Kalıcı ayarlar ve güvenli yapılandırma

**Files:** Create `src/config.js`, `src/types.js`, `src/db/open.js`, `src/db/migrate.js`, `src/db/repositories.js`, `src/db/migrations/001-initial.sql`, `src/security/secrets.js`, `.env.example`; modify `package.json`, `package-lock.json`, `.gitignore`; test `test/integration/database.test.js`.

**Interfaces:** `loadConfig(env,projectRoot) -> Config`; `openDatabase(path) -> db`; `createRepositories(db) -> Repositories`; `encryptSecret(text,key)` / `decryptSecret(cipher,key)`. `Config` includes local database, archive, spool and cache paths; environment secret key. NAS path and quotas are persistent settings; absent quota means capture disabled.

- [ ] Write `database.test.js`: reopening preserves camera/settings; applying migration twice changes nothing; transaction rollback preserves old state; encrypted credentials do not contain plaintext; missing/invalid key rejects secret access; paths and quotas reject invalid inputs.
- [ ] Run `rtk proxy node --test test/integration/database.test.js`; expect failure because modules do not exist.
- [ ] Implement schema for settings, NVRs, cameras, image catalog, durable jobs, camera setting versions, history periods, daily summaries, deletion batches and heartbeat. Add uniqueness for image/job identity, foreign keys, schema versions and transactions. Choose WAL on local disk. Add npm test/start scripts and only dependencies this task requires; ignore all state, secrets and generated files.
- [ ] Run the same test; expect all assertions pass. Confirm the fixture contains no real credentials.
- [ ] Commit only this task's files: `rtk git commit -m "feat: add local archive configuration and catalog"` after explicit `rtk git add <files>`.

## Task 2: Gerçek görüntü döndüren cihaz adaptörü

**Files:** Create `src/capture/nvr-client.js`, `test/helpers/fake-nvr.js`; test `test/integration/nvr-client.test.js`.

**Interfaces:** `captureSnapshot({nvr,channel,signal}) -> Promise<{buffer,contentType}>`. Consumes decrypted NVR credentials; no URL with credentials in logs. Endpoint remains `/cgi-bin/snapshot.cgi?channel=<channel>`, authenticated with supported HTTP challenge flow. Legacy query-password mode only if real-device acceptance proves necessary, with URL redaction.

- [ ] Write tests using a local fake HTTP server: valid JPEG returns buffer; digest challenge succeeds; 401, HTML, truncated JPEG, oversized response and 20-second timeout return typed errors. Example assertion: `await assert.rejects(captureSnapshot(input), {code:'INVALID_IMAGE'})`. Use injected clock/abort for timing; set a 20 MiB response cap and test its boundary.
- [ ] Run `rtk proxy node --test test/integration/nvr-client.test.js`; expect missing-module failure.
- [ ] Implement bounded streaming response, abort handling and image decode validation with sharp. Return typed errors without secret-bearing URLs. Add adapter dependencies to lockfile.
- [ ] Repeat test command; expect pass, including no secret in captured error output.
- [ ] Stage task files and commit `feat: validate NVR snapshot responses`.

## Task 3: Önce yerelde kalıcı kayıt

**Files:** Create `src/archive/local-store.js`, `src/archive/reconcile.js`; test `test/integration/local-store.test.js`.

**Interfaces:** `createLocalStore({repos,fs,config}) -> {persist(capture),read(imageId),reconcile()}`; `persist({id,cameraId,capturedAt,buffer}) -> Promise<Image>`. NAS configured: destination spool and state pending; otherwise archive and state local. Uses `repos.jobs` / `repos.images`.

- [ ] Write tests: successful write produces dated path, bytes and checksum; partial write never appears as complete; fsync/rename/catalog failure retains recoverable job; reopening at each boundary recovers exactly one image. Assert `images.list({id}).length === 1` after two reconciliation runs. Inject an fs spy that rejects all NAS paths; all persistence tests must still pass.
- [ ] Run `rtk proxy node --test test/integration/local-store.test.js`; expect missing-module failure.
- [ ] Implement durable intent, local temp write, file sync, rename and parent-directory sync before committed catalog. Reconcile orphan jobs/temp/final files within managed roots only. Use UTC path components and UUIDs. Reject insufficient local space before capture; reserve space for SQLite/history rather than filling the filesystem.
- [ ] Repeat test command; expect pass; document local failure as a typed error, never a successful capture.
- [ ] Stage task files and commit `feat: persist snapshots locally before archive transfer`.

## Task 4: Kalıcı geçmiş ve açıklanabilir boşluklar

**Files:** Create `src/history/service.js`; test `test/integration/history.test.js`.

**Interfaces:** `createHistory({repos,clock}) -> {beginCapture(camera,dueAt),finishCapture(jobId,result),openPeriod(scope,reason),closePeriod(id),recordDeletionBatch(batch),heartbeat(),recoverStartup(),summarize(cameraId,day),query(cameraId,from,to)}`. `result` carries success/failure/skipped and typed reason. Deletion batch carries reason, policy version, camera, time bounds and count, never one record per similar deleted image.

- [ ] Test camera failure then recovery, full spool, disabled camera, interval changes across midnight, deletion summaries and restart. Assert a 60-second heartbeat interval; after an unclean stop, recovery reports an approximate offline interval without claiming power failure. Replaying completion/batch IDs must not increase counts. Assert a daily similarity summary cannot label a particular absent frame as definitely removed.
- [ ] Run `rtk proxy node --test test/integration/history.test.js`; expect missing-module failure.
- [ ] Implement persistent periods, local capture intents, setting versions, idempotent daily aggregation and restart recovery. Keep summaries after image deletion; compact completed capture jobs only after summary commit. NAS outage is an access period, not capture failure when local persistence succeeded. If DB cannot write, expose unhealthy status and do not invent exact historical reasons later.
- [ ] Repeat test command; expect all assertions pass independent of log files.
- [ ] Stage task files and commit `feat: retain archive coverage and gap explanations`.

## Task 5: Çekim zamanlayıcısı

**Files:** Create `src/capture/scheduler.js`; test `test/integration/scheduler.test.js`.

**Interfaces:** `createScheduler({repos,client,store,history,clock}) -> {start(),refresh(),stop({deadlineMs})}`. Uses task 2 `captureSnapshot`, task 3 `persist` and task 4 capture history. Inject clock rather than using real waits.

- [ ] Test 90 cameras: at most four requests globally and one per camera; default interval 900000 ms; camera overrides; retries after 15000/30000 ms with at most three attempts total; disabled camera never runs; missed periods do not accumulate; one broken NVR does not block healthy cameras; refresh applies next due time; restart does not replay old captures. Assert every skipped/failing job contributes to history once.
- [ ] Run `rtk proxy node --test test/integration/scheduler.test.js`; expect missing-module failure.
- [ ] Implement bounded queue, typed retry decisions and per-camera locks. Do not retry permanent credential/configuration errors within the same scheduled capture. Check local recording capacity before requesting an image. Stop new work at shutdown and leave unfinished durable jobs recoverable after deadline.
- [ ] Repeat test command; expect pass without accessing NAS.
- [ ] Stage task files and commit `feat: schedule independent camera capture jobs`.

## Task 6: NAS izolasyonu, aktarım ve kayıp doğrulaması

**Files:** Create `src/nas/supervisor.js`, `src/nas/worker.js`, `src/nas/transfer.js`, `test/helpers/fake-worker.js`; test `test/integration/nas.test.js`.

**Interfaces:** `createNasSupervisor({spawn,clock,config}) -> {request(op,payload),status(),stop()}`; ops `health|transfer|read|stat|delete|scan`. `runTransfers({repos,nas,history})`; `verifyPresence(imageId,{repos,nas,history})`. Only worker imports filesystem APIs for NAS paths. `health` verifies expected mount identity and depot sentinel; absence/mismatch never creates sentinel automatically on an unverified mount.

- [ ] Test never-settling worker: after 30000 ms request rejects `NAS_UNAVAILABLE`; scheduler persists next image and local API health remains responsive. Fake worker ignores termination; assert `spawnCount === 1` while it remains alive. After confirmed exit allow bounded backoff/recovery. Timeout alone never means cancelled kernel I/O.
- [ ] Run `rtk proxy node --test test/integration/nas.test.js`; expect missing-module failure.
- [ ] Implement IPC IDs, bounded in-flight work, deadline, termination request and no replacement until exit. Isolate all NAS reads/writes/stat/free-space/cleanup inside worker; API streams use bounded IPC chunks, with no open-ended parent wait. NAS unhealthy opens circuit; scheduler continues locally. Verify mount identity on each health generation and before mutations; deployment must provide stable expected mount identity.
- [ ] Add transfer crash tests at copy/sync/checksum/rename/catalog/local-unlink boundaries. Assert local copy survives uncertain outcomes; re-running job yields exactly one NAS image. Test EACCES, EIO, timeout and wrong mount leave catalog size and image placement intact. Two ENOENT results from distinct successful health tours on correct depot mark missing; one result never does. Lost images retain history/catalog identity.
- [ ] Implement transfer durability, checksum verification, idempotent final paths and lease protection against cleanup. Commit transferred state before unlinking local copy. Availability updates never delete catalog records. NAS cleanup/compaction pause while unhealthy; pending local originals are never capacity victims.
- [ ] Repeat test command; expect all cases pass. Include Linux-only integration using a stopped helper and responsiveness assertions; real kernel uninterruptible I/O is a deployment acceptance case, not falsely simulated as cancellable.
- [ ] Stage task files and commit `feat: isolate NAS operations and preserve local capture`.

## Task 7: Maskeli benzerlik ve yedi gün sonrası sadeleştirme

**Files:** Create `src/retention/similarity.js`, `src/retention/compaction.js`, synthetic fixtures `test/helpers/images.js`; test `test/integration/compaction.test.js`.

**Interfaces:** `compareImages(a,b,{masks,sensitivity}) -> Promise<{similar,changedRatio}>`; `compactCamera(cameraId,{repos,store,nas,history,clock})`. Consumes task 6 NAS requests, never direct NAS I/O. Stores policy version and per-camera compaction cursor/reference. Image deletion uses durable batch intent and task 4 summaries.

- [ ] Test changed clock region is ignored only with mask; change outside mask is retained; full mask rejected; resolution mismatch/decode failure preserves candidate; originals remain byte-identical. Test age 168 hours minus 1 ms is protected, age 168 hours is eligible. Assert gradual change compares with last retained image; 3600000 ms anchor limit is honored. Re-running same batch must not delete additional anchors or double-count summaries.
- [ ] Run `rtk proxy node --test test/integration/compaction.test.js`; expect missing-module failure.
- [ ] Implement normalized masks, resize/grayscale/blur and changed-pixel ratio on unmasked pixels only. Use documented sensitivity presets with deterministic synthetic tests; keep uncertain results. Process chronological bounded batches, preserve reference/anchors, guard changes with policy version and image lease, update cursor only on confirmed outcome. Summarize deletion after confirmed delete and catalog transition; retain durable batch intent until summary completion.
- [ ] Repeat test command; expect pass. Prepare a calibration command accepting user-provided day/night images; tune numerical defaults using real examples before enabling destructive compaction in production. Until calibrated, analysis preview works but deletion stays disabled with explicit status.
- [ ] Stage task files and commit `feat: compact old snapshots with masked comparison`.

## Task 8: Kapasite sınırları ve depolama tahmini

**Files:** Create `src/retention/capacity.js`; test `test/integration/capacity.test.js`.

**Interfaces:** `enforceCapacity({repos,store,nas,history,compactor}) -> Result`; `storageStats({repos,clock}) -> Stats`; `canRecord({settings,localSpace,spoolBytes}) -> {allowed,reason}`. Stats include logical archive bytes, local spool/cache bytes, DB bytes, free space with last measurement, oldest/newest and estimated retention.

- [ ] Test 94.9% does not trigger quota cleanup; 95% triggers compaction then oldest-first deletion until at most 90%. Assert young/anchor images can be quota victims, pending sole local copies cannot. Test repeated deletion failure never reduces accounting, unrelated files untouched, missing quota disables capture, full spool preserves existing queue. Assert estimates with no samples are unavailable rather than zero/infinite.
- [ ] Run `rtk proxy node --test test/integration/capacity.test.js`; expect missing-module failure.
- [ ] Implement bounded cleanup with the same durable deletion batches/leases used by task 7; only confirmed deletion affects counters. Do not recurse arbitrary NAS directories. NAS outage pauses remote cleanup and marks remote space measurements stale. Keep archive and spool quotas separate; expose cache/DB usage and local reserve health. Estimate from measured recent capture sizes/rates and observed compaction savings, explicitly approximate.
- [ ] Repeat test command; expect pass with crash/replay assertions and no cross-root deletion.
- [ ] Stage task files and commit `feat: enforce archive and spool storage limits`.

## Task 9: Kimlik doğrulamalı yönetim API'si

**Files:** Create `src/security/auth.js`, `src/web/server.js`, `src/web/routes.js`, `src/web/media.js`; test `test/integration/api.test.js`.

**Interfaces:** `createWebServer({repos,auth,scheduler,store,nas,history,retention}) -> app`. Routes: `POST /api/setup`, `POST /api/login`, `POST /api/logout`, `GET /api/status`, CRUD `/api/nvrs` and `/api/cameras`, `POST /api/nvrs/:id/test`, GET/PUT `/api/settings`, `GET /api/images?cameraId&from&to&cursor`, `GET /api/images/:id/{original,thumbnail}`, `GET /api/history?cameraId&from&to`, `POST /api/cameras/:id/compare`. List response `{items,nextCursor}` with stable capturedAt/id order and maximum 100 items. Config tests cannot access arbitrary filesystem paths through media IDs.

- [ ] Test unauthorized access, one-time local setup, password hashing, login rate limit, CSRF, session expiry/logout, hidden NVR credentials and path traversal. Test Istanbul midnight becomes correct UTC bounds; equal timestamps paginate without duplicates; stale NAS returns explicit unavailable state while local pending image opens. No missing-file decision from HTTP media read timeout.
- [ ] Run `rtk proxy node --test test/integration/api.test.js`; expect missing-module failure.
- [ ] Implement argon2 password hash, random server-side sessions, HttpOnly/SameSite cookies, CSRF checks and bounded JSON inputs. Initial setup requires environment-provided one-time setup token and is disabled after admin creation. Use AES-GCM NVR secret service from task 1. Add camera bulk channel creation/validation, live scheduler refresh, safe archive path update rules and connection preview. Reject path change while pending transfers exist; existing images retain original depot identity, and removing an in-use depot is rejected.
- [ ] Implement media streaming by catalog ID, bounded thumbnail cache and task 6 IPC for remote sources. Thumbnail creation must not bypass NAS supervisor. Return last measurement time in status, coverage precision in history and comparison policy version in preview. Never label per-frame deletion cause from daily summary alone.
- [ ] Repeat test command; expect pass; setup token and credentials absent from all captured logs/responses.
- [ ] Stage task files and commit `feat: expose authenticated camera archive API`.

## Task 10: Türkçe web arayüzü

**Files:** Create `public/index.html`, `public/app.js`, `public/styles.css`, `test/browser/archive.test.js`, `playwright.config.js`; optionally split page modules into `public/pages/{status,archive,settings}.js` and `public/mask-editor.js` as responsibilities grow.

**Interfaces:** Consumes task 9 API exclusively; no database/filesystem access. Views `Genel durum`, `Arşiv`, `Ayarlar`; login and first setup gate access. Mask editor produces normalized task 7 `Mask[]`.

- [ ] Write browser tests: setup/login, 90-camera status list, camera override save, paged date search, previous/next/download, NAS outage vs missing badges, local pending image open, history reasons with approximate/unknown labels, quota-required capture-disabled notice. Mask drag on resized image yields same normalized rectangle; comparison preview does not mutate original or delete files.
- [ ] Run `rtk proxy npx playwright test test/browser/archive.test.js`; expect missing UI failures after browser test dependency installation.
- [ ] Implement responsive usable pages, form validation, error/loading/empty states, accessible labels and keyboard navigation. Archive uses lazy thumbnails and pagination; summary/history is a separate view without fake rows for each similar deleted frame. NAS, spool saturation and unhealthy DB statuses are prominent. Show last verified access and stale measurements.
- [ ] Repeat browser command against local fake services; expect pass. Inspect desktop and narrow viewport screenshots, checking date filters, mask coordinate accuracy and long camera names.
- [ ] Stage task files and commit `feat: add local camera archive management UI`.

## Task 11: Uygulama bileşimi, geçiş ve bütünleşik kabul

**Files:** Create `src/app.js`, `test/integration/system.test.js`, `docs/acceptance.md`; modify `package.json`, `README.md`, `onvif.js`.

**Interfaces:** `createApp(config,deps) -> {start(),stop()}` wires tasks 1–10; start validates local persistence and credentials, reconciles local jobs, starts API/history, then eligible workers. `SIGTERM/SIGINT` invoke bounded stop. Existing `node onvif.js` becomes a compatibility wrapper to the new entry, never legacy mount/delete behavior.

- [ ] Write system tests: two fake NVRs/90 cameras; snapshot, local persistence, transfer, browsing, age advancement, compaction and quota deletion; restart mid-transfer/deletion; full spool; never-returning NAS; DB failure; graceful shutdown. Assert history remains queryable after image eviction and summaries do not double-count after restart.
- [ ] Run `rtk proxy node --test test/integration/system.test.js`; expect missing composition failure.
- [ ] Wire app and task loops with explicit non-overlapping leases; load secrets only from configuration. Remove old hard-coded passwords, mount command and shell `find -delete`. Existing image directories are left untouched; first version does not silently import or clean legacy files. Align package/README licensing only after repository owner selects a license; do not invent permission to relicense. README describes current metadata mismatch if unresolved.
- [ ] Document environment values, UI setup, limits, local-vs-NAS semantics, backup of local DB/key, mask calibration, unknown-history precision, and test/acceptance procedure. No startup/PM2 setup. Explain that SQLite history cannot survive destruction of its only local disk without an external backup.
- [ ] Run `rtk proxy npm test` and `rtk proxy npx playwright test`; expect all tests pass. Run `rtk git diff --check`. On Linux, run native filesystem durability and worker responsiveness acceptance; record runtime/dependency versions. If environment lacks real devices, label those checks pending rather than claiming compatibility.
- [ ] Follow `docs/acceptance.md` with user-provided real NVR/NAS: authenticate each NVR, channel validation, representative image sizes, day/night masks, NAS outage/recovery, spool limit and safely isolated quota tests. Production destructive compaction remains off until calibration is accepted. Never test destructive cleanup on an existing unmanaged archive.
- [ ] Stage task files and commit `feat: integrate reliable camera archive application`.

## Plan self-review

- Spec coverage: configuration/devices (1–2), durable capture (3–5), NAS and missing-state distinction (6), seven-day compaction (7), storage quotas (8), history (4/9/10), security/API (1/9), UI (10), restart/runtime and real-device acceptance (11).
- Review Focus items map to concrete failure assertions in owning tasks; no separate speculative review scope.
- All downstream interfaces use the names above; availability is independent from transfer state. NAS code never executes inside capture, API or SQLite paths.
- Startup and PM2 tasks are absent. The only runtime lifecycle work is in-process start/stop/recovery.
- No product implementation or package installation has been performed while writing this plan. Runtime versions and device-specific authentication are explicitly verified at execution/acceptance, not assumed working.

## Execution handoff

User reviews this plan and chooses native or subagent-driven execution before implementation. Native is recommended: the storage/history interfaces are tightly related, and one implementation context reduces integration overhead; focused tests cover the failure boundaries. Subagent-driven offers an independent review after each task at greater context cost. Preserve this task order in either method.
