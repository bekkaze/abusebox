# Changelog

All notable changes to this project are documented here.

Upgrading is `docker compose pull && docker compose up -d` unless a release says otherwise. Migrations run on start.

## [Unreleased]

## [1.4.0] - 2026-11-09

A risk score on every asset, server-side paging, and a rebuilt navigation and identity.

Adds an empty `owner` column. The score is derived from existing checks; no migration needed.

### Added

- **Risk score, 0-100, per asset.** Six factors out of a fixed 100: blacklists 40, reachability 20, certificate 14, domain 12, email auth 8, reputation 6. Listings weight by the severity the list's return codes decode to, so "listed on 1 of 24" is 34 on a critical list and 10 on a low one. Factors saturate. Unrun checks score nothing rather than scoring healthy. Every factor and its contribution is shown.
- **Owner per asset.** Free text, searchable with hostname, type and description.
- `GET /hostname/page/` returns one page, filtered, sorted and counted by the server. `GET /hostname/list/` is unchanged.
- Account menu in the header holding user, theme toggle and sign-out.

### Changed

- Assets page, filter, sort and search on the server, so page one is the first page of the real order. Ties break on issue count, then name.
- Navigation rebuilt as an icon rail with tools inline instead of in a popup.
- New mark and violet palette. Five hues already carried status meaning; violet clears its nearest at 55 degrees. The mark inherits `currentColor`, so it cannot vanish on the rail.
- The favicon is a tile, which keeps it legible on dark tab strips. The alert favicon matches it again.
- Dashboard panels are one grid, so the bands line up.

### Fixed

- `index.html` revalidates, so an upgrade no longer keeps loading the previous release.
- History tables no longer bleed 20px past their column; the detail pane goes from 334px to 678px at 1024.
- 18 form fields were under 16px and zoomed the page on iOS Safari.
- Settings hid the Security tab on narrow screens; tool counts had a contrast failure.

## [1.3.6] - 2026-11-08

Email security on a mail server's own hostname, and the TLS version in use (#40).

### Fixed

- A host with no DMARC record of its own now uses the organisational domain's `sp` policy (RFC 7489 §6.6.3) and says where it came from. SPF is unchanged: a sending host publishes its own.
- DKIM selectors are searched at the organisational domain when the host publishes none, reported as found there rather than treated as the host's.
- A server on TLS 1.0 returned an SSL error and no verdict. The check now retries with versions relaxed and names the old protocol as the finding. Certificate failures are never retried that way.
- A rejected certificate says which way: expired, wrong hostname, self-signed or untrusted root.
- Check failures read as sentences instead of `[Errno 101]` and `[SSL: ...]`.

### Security

- The generated admin password is no longer logged. **Read it with `docker compose exec backend cat /app/data/initial_admin_password`.** It is deleted once changed. If it cannot be written, no account is created.
- Hostnames are escaped before logging, so a carriage return cannot forge a log line.
- No exception text reaches a check result; `app/core/failures.py` maps failures to fixed phrases. Detail stays in the log.
- 24 of 26 CodeQL alerts fixed. Two accepted and documented rather than suppressed.
- Base images: python 3.11.18-alpine, nginx 1.30.6-alpine.

## [1.3.5] - 2026-11-06

### Fixed

- WHOIS on a mail server hostname looked up the registered domain instead, via the Public Suffix List, sharing one query per domain (#39).
- A WHOIS record kept from an earlier check now says how old it is and why the registry did not answer.

### Security

- follow-redirects 1.16.2 ([GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)). Never shipped: axios' Node adapter is dropped from the build.
- CodeQL analyses backend and frontend on every PR and weekly.

## [1.3.4] - 2026-11-05

### Added

- Commented-out `enable_ipv6` block in `docker-compose.yml`, for registries that block your IPv4.
- Install templates for Unraid, Portainer and CasaOS in `templates/` (#31, #32).
- `WHOIS_TIMEOUT_SECONDS` (30) and `WHOIS_CACHE_MINUTES` (360). Failures are never cached.

### Fixed

- WHOIS now tries IPv6 and IPv4 in system order, splitting the time budget (#36).
- `.nl`, `.it` and similar indented-block records are parsed; contact fields no longer leak into domain fields (#36).
- A refusal serves the last good answer, marked stale with its age, instead of blanking the record.
- Rate-limit replies are reported as failed checks, not empty successes, and stay out of the cache.
- Failed WHOIS checks are reported on the dashboard like every other check.
- Assets could show "Scheduled check overdue" forever from a pre-1.3.2 negative interval.
- Saving scheduler settings mid-cycle threw that cycle's results away.

### Security

- Vite 6.4.5 ([GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj)). Dev-only; the image serves static files.

## [1.3.3] - 2026-10-30

### Added

- **Copy report**, plain text for a ticket or an email to a list operator, on the blacklist check, quick check and an asset's Blacklist tab (#29).

### Fixed

- The activity timeline was drawn in the faintest hairline with identical grey dots; dots now carry severity colour (#30).
- Copying over plain HTTP silently failed; there is a fallback now.

## [1.3.2] - 2026-10-28

A security release, and blacklist lookups that work out of the box.

**Pull the repository too** (`git pull`): compose adds a DNS resolver service.

### Security

From a review of 1.3.1. None reported as exploited.

- Login rate limit could be bypassed with a self-set `X-Forwarded-For`. nginx sets the client address; the API ignores the header.
- New installs get a random admin password instead of the published `password123`.
- Per-asset intervals accepted any number, including negative. Now 15 minutes to 7 days, with `MAX_ASSETS_PER_USER` (1000).
- Asset names went into Slack and Discord as-is, so a user could ping `@everyone`. Names are validated, markup escaped, mentions off.
- Server-status and SSL checks could reach internal hosts via DNS rebinding; they connect to the checked address now.
- dnspython 2.9.0 ([GHSA-45c3-73f7-pv4m](https://github.com/advisories/GHSA-45c3-73f7-pv4m)).
- The public quick check only accepts public addresses.
- PBKDF2 rounds 29,000 to 600,000, upgraded at next sign-in.
- Unknown usernames take as long as known ones.
- WHOIS follows only IANA referrals, only to public servers, stopping at 256 KB.
- Sign-out ends the session server-side, on every device.
- CSP on the UI. Backend runs unprivileged and binds to localhost only.
- `APP_DEBUG` defaults to false outside Docker. `DISABLE_API_DOCS=true` hides the docs.

### Added

- Bundled Unbound resolver, so lists see your IP rather than a public resolver they refuse. Falls back to the system resolver.
- A warning when Spamhaus does not answer your resolver.

### Fixed

- A fresh install could fail once on first dashboard load (two requests creating settings at once).
- Invalid form values show a readable message.

## [1.3.1] - 2026-10-26

Open **Settings → Notifications** afterwards and set a real alert address.

### Security

- certifi 2026.10.23; earlier versions trust compromised emSign intermediates ([GHSA-6q48-6c7w-9gw2](https://github.com/advisories/GHSA-6q48-6c7w-9gw2)).

### Fixed

- Email alerts went to the unreachable `admin@abusebox.local` with no way to change it. Each user sets their own, with a warning while it is a placeholder (#28).
- SMTP on port 465 works; previously only STARTTLS on 587.

## [1.3.0] - 2026-10-26

A redesigned interface, decoded blacklist results, and a production frontend.

`VITE_ALLOWED_HOSTS`, `VITE_BASE_URL` and `VITE_API_DOCS_URL` are no longer used.

### Added

- **New interface.** Every result reads as a mail delivery report: an SMTP-style class (5.x listed, 4.x no answer, 3.x pending, 2.x clear), the reason in words, details as header fields. Covers every page. Fonts self-hosted, so nothing loads from Google Fonts.
- **Listings are decoded** with meaning and severity (Spamhaus SBL spam source vs PBL end-user range), sorted most serious first, exported with both.
- `bl.spameatingmonkey.net` and `bip.virusfree.cz` added, Mailspike moved to `bl.mailspike.net`. 24 lists.
- `SPAMHAUS_DQS_KEY` for Spamhaus Data Query Service. The public mirror is non-commercial only.

### Changed

- The frontend image is a static build served by nginx, which proxies `/api`. No Node.js at runtime; API docs at `/api/swagger/`.
- Schema changes use Alembic. 1.x databases are detected and stamped on first start.
- `:latest` follows stable releases; `main` publishes `:edge`.
- Removed the unused `blacklisted_hostnames` table and `react-typed`.

## [1.2.2] - 2026-10-25

### Fixed

- A list that starts listing everything would have flagged every asset. Each list must now leave 127.0.0.1 unlisted as RFC 5782 requires, or its result is ignored.
- Answers outside 127.0.0.x counted as clean; they count as "No answer" now.
- Subnet scans skip lists failing their test addresses and name them, and mark IPs with unanswered lookups **Incomplete** instead of clean.
- Rate-limit answers were retried immediately, worsening the limit. Only timeouts and server failures retry.

### Changed

- Removed five lists that added only noise (`bogons.cymru.com`, `blackholes.five-ten-sg.com`, `cbl.abuseat.org`, `korea.services.net`, UCEPROTECT levels 2 and 3). 22 lists.
- Lists AbuseBox stops checking no longer count as delistings.

## [1.2.1] - 2026-10-25

### Security

- Frontend on Node 22.23.4, the patched October 2026 release (CVE-2026-111497 among others), base image pinned by digest (#24, #25, thanks @mkaand).
- Dependabot updates for Docker base images and GitHub Actions.

### Fixed

- 36 providers had shut down or stopped answering and always showed "No answer"; removed, and `bl.0spam.org`, `bl.blocklist.de`, `dnsbl.spfbl.net` and `truncate.gbudb.net` added. 28 lists, each verified (#23).
- Spamhaus could silently report clean through some public resolvers. A clean answer only counts if the list also lists 127.0.0.2, rechecked every 30 minutes.
- The subnet check no longer queries the defunct `dnsbl.sorbs.net`.

### Changed

- `DNSBL_NAMESERVERS` accepts hostnames, such as a Compose service name.

## [1.2.0] - 2026-10-07

Monitoring that says what needs attention, plus a security and accessibility overhaul.

**Everyone is signed out once.** `/tools/*` now needs a token and public sign-up is off.

### Added

- **"Needs attention" dashboard**: everything wrong across all assets in one list, with scheduler status.
- **Activity log**: every check compared with the previous one, recorded as events, with severity filters.
- **Smarter alerts** for recoveries, outages and expiry, not only new listings. Slack and Discord get formatted messages; other webhooks get JSON.
- **Assets at scale**: card or table view, sorting, bulk re-check and toggles, CSV export, paging for CIDR imports.
- Check history per asset, showing which lists changed since the previous check.
- User management for admins, and data retention (30/90/180/365 days).
- Command palette (Ctrl/Cmd+K).
- API: `GET /events/`, `GET /hostname/{id}/events/`, `GET /hostname/{id}/checks/{check_id}`, `POST /hostname/bulk-action/`, scheduler and notification settings endpoints, `GET /user/list/`, `PATCH /user/{id}/`.
- Bulk monitoring list and bulk check uploads, up to 300 targets (#22, thanks @lokiee0).
- Custom DKIM selectors (#22). CI running backend tests and frontend lint/build.

### Security

- **Compose hard-coded `APP_SECRET_KEY`, overriding `.env`.** Every default deployment shared the public secret `change-me-in-production`, so anyone could forge an admin token. Compose uses `${VAR:-default}` now and `APP_DEBUG` defaults to false.
- An unset secret generates a random one, saved as `.secret_key` in the volume.
- Public sign-up disabled; `POST /user/create/` needs an admin. Changing a password revokes issued tokens.
- `/tools/*` requires sign-in. Only `/blacklist/quick-check/` stays public, at 10 requests a minute.
- SSRF guards on Server Status and SSL, re-validating every redirect hop.
- Login lockout after 5 failures per client and username for 15 minutes.
- DMARC uploads capped at 10 MB decompressed.
- Replaced `python-jose` (unpatched CVE) with PyJWT. Dependency updates across all open advisories.
- `.dockerignore` files so local databases and secrets are not copied into images.

### Fixed

- Scheduled monitoring stopped after its first run with `can't subtract offset-naive and offset-aware datetimes` (#20).
- A new asset could be checked twice at once, leaving two current results.
- Dashboard "Currently listed" was always 0, so the favicon alert never showed.
- Delist requests from the asset page always failed.
- SPF ignored `redirect=`, grading those domains as having no policy.
- Long TXT records split by DNS were parsed with stray quotes.
- Timestamps carry a UTC offset, so relative times are right outside UTC.
- The asset list loaded every historical result for every asset.

### Changed

- The scheduler is on by default, as is monitoring for new assets.
- Accessibility pass: consistent dark mode, labelled fields, visible focus, skip link, ARIA tabs, `prefers-reduced-motion`.
- Removed unused pages and the `@mantine/*`, `@heroicons/react` and `jwt-decode` dependencies.

## [1.1.2] - 2026-03-26

### Added

- Bulk asset creation (`POST /hostname/bulk/`) and CIDR import (`POST /hostname/cidr-import/`, max /24).
- Automatic token refresh with request queuing.
- DMARC aggregate report parsing (XML/gz/zip).
- Named volume `abusebox-data`, so data survives restarts.

### Fixed

- DNSBL false positives from Spamhaus and CBL; only `127.0.0.x` counts as a listing (#9).
- Session expiry after 30 minutes of inactivity (#11).
- API docs link pointed at the internal `backend:8100` (#12).
- Data loss on restart: the database was inside the container (#13).
- ReDoc pinned to 2.1.5 instead of the unstable `@next` tag (#7).
- `python-multipart` arbitrary file write (0.0.22).

## [1.1.1] - 2026-03-25

### Added

- Re-check button, search and filter on Assets, auto-refresh toggle, copy buttons, relative timestamps.
- Responsive sidebar, favicon badge when listed, loading skeletons, error boundary.

### Changed

- Code splitting cut the main bundle from 806KB to 324KB.
- One toast library; auth token set synchronously, fixing a first-request 401 race.

### Fixed

- Crashes on null `providers`, `detected_on` and AssetDetail API data.
- 5 dependency advisories (flatted, micromatch, requests, js-yaml, nanoid).

## [1.1.0] - 2026-03-23

### Added

- Asset management with per-asset check toggles, and an Asset Detail page with history chart.
- AbuseIPDB, DNS records, SSL checker, SPF/DKIM/DMARC with A-F grading, WHOIS, server-up check.
- Bulk check (20 targets) and subnet/CIDR scanning.
- Scheduled monitoring with email and webhook alerts; CSV export; dark mode.

### Changed

- DNSBL providers expanded from 40 to 60+.
- Default backend port 8000 to 8100.

### Fixed

- `setRequestHeader` ISO-8859-1 crash; `datetime.utcnow()` deprecation; global `socket.setdefaulttimeout()` side effect.
- SSL date parsing crash on `%Z`; crashes on null result data.
- 25 dependency advisories.

## [1.0.1] - 2026-03-19

### Added

- AbuseIPDB, WHOIS and server-up checks; CONTRIBUTING.md.

### Fixed

- Vite hardening (strict fs, CORS, allowed hosts) and frontend dependency updates.

## [1.0.0] - 2026-03-02

### Added

- FastAPI backend, DNSBL monitoring against 40+ providers, JWT auth, dashboard, delist workflow, landing page with quick check, Docker Compose deployment.

### Changed

- Licensed MIT.
