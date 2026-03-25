# Changelog

All notable changes to this project will be documented in this file.

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
