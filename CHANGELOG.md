# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-10-26

A redesigned interface, decoded blacklist results, and a production-grade frontend.

Upgrading: `docker compose pull && docker compose up -d`. The database is migrated automatically. `VITE_ALLOWED_HOSTS`, `VITE_BASE_URL` and `VITE_API_DOCS_URL` in `.env` are no longer used. See [Upgrading to v1.3.0](README.md#upgrading-to-v130).

### Highlights

- **New interface.** Every result now reads like a mail delivery report: a status line with an SMTP-style class (5.x listed, 4.x no answer, 3.x pending, 2.x clear), the reason in plain words, and details as header-style fields. The redesign covers the dashboard, assets (table view first, sortable columns, per-row actions), asset detail, every check tool, settings, sign-in, the command palette and the public landing page. Main regions sit on white panels over a tinted canvas with a soft elevation scale. Light theme leads; dark mode is supported throughout. Fonts are self-hosted (Public Sans, Commit Mono), so the UI no longer loads anything from Google Fonts.
- **Blacklist results say why.** Each listing is decoded with its meaning and a severity (critical, high, medium, low, info), e.g. Spamhaus SBL spam source vs. PBL end-user range. Results are sorted most serious first and exported to CSV with severity and meaning.
- **Two more blacklists.** Added `bl.spameatingmonkey.net` and `bip.virusfree.cz`, and switched Mailspike to `bl.mailspike.net`, which adds graded reputation (its neutral L2 answer is not treated as a listing). AbuseBox now checks 24 blacklists.
- **Spamhaus key support.** Set `SPAMHAUS_DQS_KEY` to query Spamhaus through its Data Query Service. The free public mirror is for non-commercial use only; ISPs and commercial users need a key.

### Changed

- The frontend image is now a static production build served by nginx, which also proxies `/api` to the backend. Node.js is no longer in the runtime image, the UI answers on any hostname, and the API docs are at `/api/swagger/`.
- Database schema changes now use Alembic migrations. Databases from 1.x are detected, brought up to the baseline and stamped on first start.
- Docker images: `:latest` now follows stable releases only, and `main` publishes `:edge`.
- Removed the unused `blacklisted_hostnames` table and the `react-typed` dependency.

## [1.2.2] - 2026-10-25

### Fixed

- A blacklist that starts listing every address would have reported all your assets as listed. This happens when a list shuts down (AHBL did it in 2015) or its domain expires. Each blacklist must now also leave its "never listed" test address (127.0.0.1) unlisted, as RFC 5782 requires; otherwise its result, listed or clean, is ignored and shown as "No answer".
- Answers outside 127.0.0.x (other error codes, or a web server's IP from a parked domain) were counted as clean. They now count as "No answer".
- Subnet scans now skip blacklists that fail their test addresses and show which were skipped, instead of possibly flagging the whole range or reporting it clean.
- Subnet scans counted a failed lookup as clean, so a blacklist that started rate limiting partway through a scan made every remaining IP look clean. IPs with lookups that didn't answer are now marked **Incomplete**, with the lists that didn't answer, in the results and CSV.
- Rate-limit and refusal answers (e.g. Spamhaus 127.255.255.255) were retried immediately, which made the rate limiting worse. Only timeouts and server failures are retried now.

### Changed

- Removed five lists that only added noise. AbuseBox now checks 22 blacklists.
  - `bogons.cymru.com` lists unallocated address space (including 127.0.0.1), not abusers.
  - `blackholes.five-ten-sg.com` is retired and lists nothing, so it always reported "clean".
  - `cbl.abuseat.org` is now Spamhaus XBL, which `zen.spamhaus.org` already includes, so one listing showed twice.
  - `korea.services.net` blocks most Korean address space by country, not for abuse.
  - `dnsbl-2.uceprotect.net` and `dnsbl-3.uceprotect.net` list whole networks and providers' ASNs, mostly innocent neighbours. Level 1 (`dnsbl-1`), which lists individual IPs, is kept.
- Lists AbuseBox stops checking no longer count as delistings. An asset listed only on a removed list is marked clean on its next check without a "No longer listed" alert.

## [1.2.1] - 2026-10-25

### Security

- Frontend image moved to Node.js 22.23.4, the patched 22.x release from the [October 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), which fixes the Brotli decoder out-of-bounds write CVE-2026-111497 among others (#24, #25, thanks @mkaand). The base image is now pinned by digest.
- Added Dependabot version updates for the Docker base images and GitHub Actions, so the pinned image keeps getting patch releases.

### Fixed

- Blacklists that always showed "No answer" (#23). 36 providers had shut down or stopped answering (all SORBS zones, MSRBL, abuse.ch, NiX Spam `ix.dnsbl.manitu.net`, WPBL `db.wpbl.info`, AUPADS, gweep.ca, TransIP, kundenserver.de, nether.net, imp.ch, Lashback, woody.ch, matrix.spfbl.net and others) and were removed. Added `bl.0spam.org`, `bl.blocklist.de`, `dnsbl.spfbl.net` (the current SPFBL zone) and `truncate.gbudb.net`. AbuseBox now checks 28 blacklists, each verified to answer its test address.
- Spamhaus could silently report "clean". Through some public resolvers it answers "not listed" for everything, including its own test address. Each blacklist's clean answer now only counts if it also lists its test address (127.0.0.2, rechecked every 30 minutes); otherwise it is shown as "No answer".
- The subnet check no longer queries the defunct `dnsbl.sorbs.net`.

### Changed

- `DNSBL_NAMESERVERS` accepts hostnames, e.g. a Docker Compose service name. See [Blacklists that show "No answer"](README.md#blacklists-that-show-no-answer) for running your own resolver.

## [1.2.0] - 2026-10-07

Monitoring that tells you what needs attention, plus a security and accessibility overhaul. (Supersedes the unreleased 1.1.3.)

Upgrading from 1.1.x: everyone is signed out once, the `/tools/*` API now needs a token, and public sign-up is off. See [Upgrading from v1.1.x](README.md#upgrading-from-v11x).

### Highlights

- **"Needs attention" dashboard**: one list of everything that's wrong across your assets (listed on blacklists, SSL certificate invalid or expiring, domain registration expiring, server down or returning 5xx, weak SPF/DKIM/DMARC grade, high AbuseIPDB score, overdue scheduled checks), plus scheduler status with a "Check due assets now" button.
- **Activity log**: every check is compared with the previous one and changes are recorded as events (newly listed / delisted / provider changes, server down / recovered, certificate expiring / invalid / renewed, domain expiring). See them on the dashboard, on each asset, and on the new Activity page with severity filters.
- **Smarter alerts**: alerts for recoveries, outages and expiry warnings, not only new listings. A new Notifications settings tab shows which channels are configured, lets admins set a webhook URL (overrides `WEBHOOK_URL`), choose which events alert, and send a test. Slack and Discord webhooks receive formatted chat messages; other webhooks get JSON (the v1.1 `blacklist_detected` fields are kept).
- **Assets at scale**: card or table view, sort by urgency/name/last checked/added, a "Needs attention" filter, per-asset health hints, multi-select with bulk re-check (runs in the background), monitoring/alerts on-off and delete, CSV export, and paging for large CIDR imports.
- **Check history**: browse past checks of an asset and see which blacklists were added or removed compared with the check before.
- **User management**: admins can add users, grant or revoke admin, deactivate accounts and reset passwords from Settings. A banner warns while the default admin password is still in use.
- **Data retention**: optionally delete check history and activity older than 30/90/180/365 days (latest results are always kept).
- **Command palette** (Ctrl/Cmd + K): jump to any asset, page or setting, or type a domain/IP to run a blacklist check.

### Added (API)

- `GET /events/` (filters: `severity`, `before_id`), `GET /hostname/{id}/events/`, `GET /hostname/{id}/checks/{check_id}`.
- `POST /hostname/bulk-action/` (`recheck`, `delete`, `enable_monitoring`, `disable_monitoring`, `enable_alerts`, `disable_alerts`).
- `GET /hostname/list/?include_result=false` for a lighter list; list and detail responses now include `health` (status + issues) and `last_checked`.
- `GET /settings/scheduler/status/`, `POST /settings/scheduler/run/`, `GET|PUT /settings/notifications/`, `POST /settings/notifications/test/`; `history_retention_days` in scheduler settings.
- `GET /user/list/`, `PATCH /user/{id}/` (admin); `/user/me/` reports `using_default_password`. `phone_number` is now optional when creating users.

### Security

- **Docker: `.env` values were silently ignored.** `docker-compose.yml` hard-coded `APP_SECRET_KEY`, `DEFAULT_ADMIN_PASSWORD` and `APP_DEBUG=true`, overriding `.env`. Every default Docker deployment shared the public JWT secret `change-me-in-production`, so anyone could forge an admin token. Compose now uses `${VAR:-default}`, and `APP_DEBUG` defaults to `false`.
- When `APP_SECRET_KEY` is unset (or set to a documented placeholder), a random secret is generated and saved as `.secret_key` next to the database, in the Docker volume.
- Public sign-up is disabled: `POST /user/create/` now requires an admin. Changing scheduler settings is admin-only.
- New `POST /user/change-password/` and a Settings form. Changing the password revokes all previously issued tokens.
- `/tools/*` endpoints now require sign-in (they make outbound connections and use the AbuseIPDB quota). Only `/blacklist/quick-check/` stays public, rate limited to 10 requests per minute per client.
- SSRF guards: Server Status and SSL checks refuse private, loopback, link-local and cloud-metadata addresses, including through redirects (every hop is re-validated).
- Login lockout after 5 failed attempts per client and username for 15 minutes. Rate limits key on the real client IP behind the bundled proxy, so one client can't lock out everyone.
- DMARC uploads: decompressed size is capped at 10 MB (gzip/zip bomb protection).
- Replaced `python-jose` (unpatched CVE, plus `ecdsa`/`pyasn1`) with `PyJWT`. Existing sessions remain valid.
- Dependency updates for all open advisories: FastAPI 0.142 / Starlette 1.7, python-multipart 0.0.32, requests 2.34, axios 1.20, Vite 6.4.4, react-router 7.18, PostCSS 8.5.29, and refreshed transitive packages. Test tools moved to `requirements-dev.txt` so they no longer ship in the image.
- Added `.dockerignore` files so local databases, secrets and `node_modules` aren't copied into images.

### Fixed

- Scheduled monitoring stopped after its first run with `can't subtract offset-naive and offset-aware datetimes` (#20).
- Creating an asset could be checked twice at once by the scheduler, leaving two "current" results.
- Asset detail: the Server Status tab showed blanks and the WHOIS tab showed only raw output (field-name mismatches with the API).
- Dashboard "Currently listed" was always 0, so the favicon alert never showed.
- Delist requests from the asset page always failed (missing check id), and the backend updated the wrong part of the stored result. Requests are now saved reliably.
- SPF check ignored `redirect=` (e.g. Google's `v=spf1 redirect=_spf.google.com`), grading those domains as having no SPF policy. The redirected record is now followed.
- Long TXT records (split into several strings by DNS) were parsed with stray quotes, which could break SPF and DMARC parsing.
- Spamhaus/CBL "refused" answers (`127.255.255.x`, e.g. when queried through public resolvers) were counted as clean. They are now reported as "no answer".
- Results where many providers don't answer are marked inconclusive and don't flip an asset's listed/clean status.
- Timestamps from the API now carry a UTC offset, so "x minutes ago" is correct outside UTC.
- CSV export didn't work for the public quick check and re-ran the whole DNSBL check; it's now generated in the browser from the results on screen.
- Bulk asset creation ignored `check_interval_minutes`.
- Automatic schema migration could fail when adding a non-nullable column to a SQLite table with rows.
- Asset list loaded every historical check result for every asset; it now loads only the latest one.
- Toasts were shown twice on pages with nested toast containers.

### Added

- Edit an asset's checks, monitoring, alerts and interval from its detail page.
- Bulk monitoring list (up to 300 targets, paste or upload TXT/CSV/XLSX) and bulk check uploads, thanks to @lokiee0 (#22).
- Signed-in users opening `/login` are sent to the dashboard instead of a 404.
- Custom DKIM selectors for the SPF/DKIM/DMARC check (#22).
- DMARC reports keep every DKIM/SPF result per record (#22).
- Delist flow links to each provider's removal page and tracks "removal requested" for any listed provider.
- `GET /user/me/`, `POST /tools/bulk-check/` (JSON body for long lists).
- CI workflow running the backend tests (71 offline tests) and frontend lint/build on every PR.
- 404 page.

### Changed

- The scheduler is enabled by default (`SCHEDULER_ENABLED=true`). New assets have scheduled monitoring on by default.
- UI pass across all pages: consistent dark mode (tool pages, tables and dialogs were light-only), labelled form fields, visible keyboard focus, skip link, ARIA tabs on the asset page, `prefers-reduced-motion` support, real API health indicator, and keyboard-accessible asset cards.
- Removed unused pages/components and the unused `@mantine/*`, `@heroicons/react` and `jwt-decode` dependencies.
- Docker frontend image uses Node 22 (react-router 7 needs Node 20+).
- The sidebar and top bar stay in place while scrolling long pages.
- A server whose certificate is rejected is reported as "HTTPS requests fail" instead of "down".

### Known issues

- `braces` (pulled in by Tailwind CSS 3's file watcher) has an advisory with no patched release; it only affects the build tooling.

## [1.1.2] - 2026-03-26

### Added

- Bulk asset creation endpoint (`POST /hostname/bulk/`) — create up to 50 assets in one request.
- CIDR import endpoint (`POST /hostname/cidr-import/`) and UI dialog — import an IP range (max /24) as monitored assets.
- Automatic token refresh — axios interceptor silently refreshes expired access tokens using the refresh token, with request queuing for concurrent calls.
- DMARC aggregate report parsing — upload XML/gz/zip reports, view pass/fail rates per sender, link to monitored domains.
- Persistent database storage — Docker Compose now uses a named volume (`abusebox-data`) so data survives container restarts.

### Fixed

- DNSBL false positives from Spamhaus and CBL — now validates response codes, only `127.0.0.x` counts as a real listing (#9).
- Session expiry after 30 minutes of inactivity — frontend now auto-refreshes tokens in the background (#11).
- API Docs sidebar link pointing to internal Docker hostname `backend:8100` instead of browser-accessible URL (#12).
- Data loss on Docker restart — SQLite database was stored inside the container with no volume mount (#13).
- ReDoc page failing to load due to unstable `@next` CDN tag — pinned to stable v2.1.5 (#7).
- Swagger UI returning "invalid version field" when accessed via Vite proxy — link now opens backend directly.
- `python-multipart` arbitrary file write vulnerability (upgraded to 0.0.22).

## [1.1.1] - 2026-03-25

### Added

- Re-check button on Asset Detail page to re-run all enabled checks on demand.
- Search and filter on Assets page (by hostname/type, clean/listed status).
- Auto-refresh toggle (Off/30s/1m/5m) on Dashboard and Assets pages.
- Copy-to-clipboard buttons on IPs, DNS records, WHOIS data, and SSL details.
- Relative timestamps ("2 hours ago") with full datetime tooltip on hover.
- Responsive sidebar with hamburger menu on mobile.
- Favicon red badge when any monitored asset is blacklisted.
- Loading skeleton placeholders on Dashboard, Assets, and Asset Detail pages.
- React error boundary wrapping dashboard routes.
- Submit button shows spinner during asset creation.

### Changed

- Code splitting via lazy loading — main bundle reduced from 806KB to 324KB.
- Unified toast library: removed react-hot-toast, kept react-toastify.
- Auth token now set synchronously at module load, fixing first-request 401 race condition.
- Backend `int()` env var parsing replaced with safe `parse_int()` helper.
- Docker Compose `.env` file made optional (`required: false`).

### Fixed

- ResultTable/ResultTableQuick crash when `providers` or `detected_on` is null.
- AssetDetail crash on null API response data.
- `VITE_BASE_URL` empty fallback breaking API Docs sidebar link.
- 5 dependency security alerts (flatted, micromatch, requests, js-yaml, nanoid).

## [1.1.0] - 2026-03-23

### Added

- Asset management with per-asset check toggles (Blacklist, AbuseIPDB, DNS, SSL, WHOIS, SPF/DKIM/DMARC, Server Status).
- Asset Detail page with summary cards, history chart, and tabbed results.
- AbuseIPDB integration for IP reputation scores, abuse reports, ISP & geolocation.
- DNS Record Viewer (A, AAAA, MX, TXT, CNAME, NS, SOA, PTR).
- SSL Certificate Checker (validity, expiry, issuer, cipher, SAN list).
- SPF / DKIM / DMARC email authentication validation with A-F grading.
- WHOIS Lookup with parsed table and raw output views.
- Is Server Up? checker (DNS, port scan, HTTP status, response time).
- Bulk Check for up to 20 IPs/domains in a single request.
- Subnet / CIDR Check to scan entire /24 ranges against DNSBL providers.
- Scheduled monitoring with configurable interval and email/webhook alerts.
- Historical charts showing blacklist detection history per asset.
- CSV export for blacklist and subnet results.
- Dark mode toggle persisted to localStorage.

### Changed

- Sidebar reorganized into "Monitor" and "Check & Lookup" sections.
- Assets page redesigned with card-based grid layout.
- DNSBL providers expanded from 40 to 60+.
- Quick check now includes AbuseIPDB data alongside blacklist results.
- Refresh token endpoint validates user exists and is active.
- Docker Compose supports `env_file` for `.env` loading.
- Default backend port changed from 8000 to 8100.
- Logo added to sidebar, navbar, favicon, and README.

### Fixed

- `setRequestHeader` ISO-8859-1 crash on authenticated requests.
- `datetime.utcnow()` deprecation replaced with `datetime.now(timezone.utc)`.
- Global `socket.setdefaulttimeout()` side effect in DNSBL service.
- SSL certificate date parsing crash with `%Z` timezone format.
- ViewReport and HostnameTable crashes on null result data.
- Asset list error on empty state (auth race condition).
- `DelistService` typo and unused variables.
- 25 dependency security alerts (Vite, axios, rollup, react-router-dom, etc.).

## [1.0.1] - 2026-03-19

### Added

- AbuseIPDB integration for IP reputation scores and abuse reports.
- WHOIS Lookup service with parsed and raw output.
- Is Server Up? checker with DNS, port scan, and HTTP status.
- Quick check now fetches AbuseIPDB data alongside DNSBL results.
- CONTRIBUTING.md guide for contributors.
- CONTRIBUTORS.txt with project contributors.

### Changed

- Sidebar expanded with AbuseIPDB, WHOIS, and Server Status links.
- Backend Dockerfile updated for improved build caching.
- README updated with new features and configuration details.

### Fixed

- Vite security hardening (strict fs, CORS, allowed hosts).
- Frontend dependency security updates (package.json resolutions).
- Backend dependency version pinning for passlib and cryptography.

## [1.0.0] - 2026-03-02

### Added

- FastAPI backend architecture with modular routing and services.
- DNSBL blacklist monitoring against 40+ providers.
- JWT-based authentication and seeded default admin account.
- Dashboard with monitoring summary and hostname management.
- Delist workflow for requesting removal from supported providers.
- Landing page with instant blacklist quick check.
- Docker Compose deployment.

### Changed

- Frontend UI/UX overhaul for landing, login, dashboard, and tables.
- Project license migrated to MIT.
- Project marked as actively maintained.
