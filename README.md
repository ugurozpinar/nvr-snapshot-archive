![hero](/public/kare-social-preview-v1.png?raw=true "Optional Title")

# NVR snapshot archive

**Save scheduled JPEG snapshots from a compatible NVR. Browse by camera and date, control storage, and inspect gaps in the archive.**

For developers and Linux operators who want a periodic photo history alongside an existing NVR. Kare is a self-hosted Node.js application with local storage and optional transfer to a mounted NAS; captures are saved locally before transfer.

- **Keep a bounded archive:** per-camera schedules, a storage quota, and optional comparison masks for thinning older similar images.
- **Understand missing coverage:** daily summaries and recorded failure periods remain after images are removed.
- **Try the browser without hardware:** the fixture below includes synthetic images and an example outage.

**Early-stage software.** The adapter currently uses `/cgi-bin/snapshot.cgi?channel=N` with HTTP Digest (MD5). There is no ONVIF discovery or generic camera adapter. The UI is in Turkish. Real NVR/Linux/NAS acceptance and throughput are not yet verified.

## Try it without a camera

Use Node.js **22.13+ on the 22 or 24 LTS line**, npm, and Git. Production targets Linux; this fixture also runs on Windows. Native dependencies (`better-sqlite3`, `argon2`, `sharp`) may need a compiler toolchain if prebuilt binaries are unavailable.

```sh
git clone [https://github.com/ugurozpinar/onvif-snapshot.git](https://github.com/ugurozpinar/onvif-snapshot.git)
cd onvif-snapshot
npm ci
node test/helpers/browser-server.js
```

Open [http://127.0.0.1:3099](http://127.0.0.1:3099). Enter `browser-token` in **Kurulum anahtarı**, choose a password of at least 12 characters in **Yönetici parolası**, then click **Yöneticiyi oluştur**.

1. Open **Arşiv**, choose **Ana giriş**, and set **Tarih** to `2026-10-19`.
2. Click **Görüntüleri getir**. Expect four synthetic, solid-color images; click one to preview or download it.
3. The same view includes **NVR erişim hatası**, an example recorded outage.

This is the existing browser-test fixture: 90 camera records, four generated JPEGs, no running capture scheduler and no real NVR/NAS connections. It uses a fresh OS temporary directory on every launch, ignores `.env`, and listens only on loopback. Stop with Ctrl+C; graceful shutdown removes the fixture data. An interrupted process may leave its temporary directory behind. Restarting creates a new setup. Do not use these fixed demo credentials for deployment.

To exercise capture and restart recovery without hardware as well:

```sh
node --test --test-timeout=60000 test/integration/system.test.js test/integration/nvr-client.test.js
```

The system test saves 90 generated snapshots and reopens their catalog. The adapter test uses a local HTTP challenge fixture. These are functional checks, not camera benchmarks or a full device authentication certification.

## Use it with your NVR

Example workflow: keep one entrance image every 15 minutes, browse a selected day's photos, and inspect recorded errors when coverage is missing. This is an intended use supported by the code, not a customer deployment claim. Snapshots cannot show events between captures.

In the cloned directory, after `npm ci`, create `.env` with two independent random values. This command works in a shell with Node available and refuses to overwrite an existing `.env`:

```sh
node -e "const fs=require('node:fs'),c=require('node:crypto');fs.writeFileSync('.env','ARCHIVE_KEY='+c.randomBytes(32).toString('hex')+'\nSETUP_TOKEN='+c.randomBytes(32).toString('hex')+'\nHOST=127.0.0.1\nPORT=3080\n',{flag:'wx',mode:0o600})"
npm start

```

Open [http://127.0.0.1:3080](http://127.0.0.1:3080). Read `SETUP_TOKEN` from your local `.env` and create the administrator with a new password of at least 12 characters. Keep `ARCHIVE_KEY`: changing it makes stored NVR passwords unreadable.

If startup reports `EADDRINUSE`, choose a free `PORT` in `.env` and open that port instead. An existing `PORT` environment variable takes precedence over `.env`. The demo uses port 3099; stop another demo or browser-test server before starting it.

In **Ayarlar**:

1. Set the archive capacity before enabling capture. Start with local storage and compaction disabled.
2. Add your NVR host, username and password. It must serve JPEGs from the endpoint above; ONVIF support alone is insufficient. The connection test defaults to channel 1.
3. Add the channels you actually use. The default interval is 15 minutes. Check **Genel durum** for capture success, then **Arşiv** for the camera and capture date.

No cameras or device credentials ship with a normal installation. Local images go into `archive/`; catalog, settings and spool go into `data/`. Keep `DATA_DIR` on local disk and run only one application instance per data directory. LAN access requires changing `HOST`; internet deployment is outside the current scope.

For NAS setup, comparison masks, retention details, backups and shutdown behavior, read the [operations guide (Turkish)](https://www.google.com/search?q=docs/operations.md). Before relying on real hardware, complete the [device acceptance checklist](https://www.google.com/search?q=docs/acceptance.md).

## Choose the right tool

| Need | Start here |
| --- | --- |
| Periodic still-image history alongside an existing compatible NVR | Kare: local persistence, optional verified NAS transfer, quota and gap history in one app |
| Live object detection and video recording | [Frigate](https://github.com/blakeblackshear/frigate) |
| A broader Linux surveillance system | [ZoneMinder](https://github.com/ZoneMinder/zoneminder) |
| ONVIF discovery, PTZ or a camera integration library | [agsh/onvif](https://github.com/agsh/onvif) |

Kare's case is the combined archive workflow. There is no measured claim that it is faster, smaller or more reliable than these alternatives. For one camera and a folder of JPEGs, a scheduled script may be enough.

## Know the limits before keeping images

* Capacity cleanup starts at 95% of the configured archive quota and targets 90%; it can override the seven-day and hourly retention protections. Deletion is irreversible.
* Similar-image thinning is disabled by default. Validate masks and day/night samples before enabling it. Comparison masks affect analysis, **not privacy redaction**: original images remain unchanged.
* NAS outages can be buffered only while local space and spool quota permit; otherwise new captures are skipped. A transferred image is not an automatic second backup.
* Gap summaries are aggregate records. Startup outage boundaries are approximate; an unknown cause stays unknown.
* The 90-camera fixture is not evidence of real-device capacity. No real hardware compatibility matrix or storage savings measurements are available yet.
* Back up the local database and encryption key separately. There is no automatic replica, archive migration or import from the old script.

## Help make the next claim verifiable

The most useful contribution now is a sanitized hardware acceptance report: NVR model/firmware, Linux and Node versions, channel behavior, and observed results from the [checklist](https://www.google.com/search?q=docs/acceptance.md). Never attach camera credentials or private images.

For a bug, include the commit, reproduction steps, expected/actual behavior and redacted error codes in a [GitHub issue](https://github.com/ugurozpinar/onvif-snapshot/issues). Small documentation corrections and reproducible fixes are welcome; discuss new device adapters before building them. See [CONTRIBUTING.md](https://www.google.com/search?q=CONTRIBUTING.md) for checks and [the architecture map](https://www.google.com/search?q=docs/architecture.md) for entry points. No response-time commitment is promised.

```sh
npm run check
npx playwright install chromium
npm run test:browser

```
