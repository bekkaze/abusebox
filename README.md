<div align="center">

<img src="files/logo.png" alt="AbuseBox Logo" width="120" />

# AbuseBox

**Open-source threat monitoring toolkit for IPs, domains, and servers.**

Check blacklists, query AbuseIPDB, inspect DNS/SSL/DMARC records, scan subnets, and verify server uptime — all from one dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/bekkaze/abusebox)](https://github.com/bekkaze/abusebox/releases)
[![GitHub stars](https://img.shields.io/github/stars/bekkaze/abusebox?style=social)](https://github.com/bekkaze/abusebox/stargazers)

</div>

---

## Screenshots

**Landing Page** — instant blacklist check from the homepage

![Landing page](files/landing.png)

**Dashboard** — monitoring summary with stats and history charts

![Dashboard](files/dashboard.png)

**Assets** — card-based view of all monitored hostnames with check badges

![Assets](files/assets.png)

**Asset Detail** — tabbed results for every enabled check (Blacklist, AbuseIPDB, DNS, SSL, WHOIS, DMARC, Server Status)

![Asset detail](files/asset_details.png)

---

## Why AbuseBox?

Most blacklist tools check one thing at a time. AbuseBox gives you a **single pane of glass** to:

- Scan **60+ DNSBL providers** in seconds
- Get **AbuseIPDB reputation scores** alongside blacklist results
- Run **bulk checks** on up to 300 IPs/domains at once (paste or upload TXT/CSV/XLSX)
- Scan entire **subnets (CIDR /24)** for blacklisted IPs
- Pull **WHOIS**, **DNS records**, and **SSL certificate** details with one click
- Validate **SPF / DKIM / DMARC** email authentication
- Check if a server is **up or down** with DNS, port, and HTTP checks
- **Register assets** and run all checks with configurable toggles
- **Schedule periodic checks** with email and webhook alerts
- Export results to **CSV** and track history with **charts**
- Switch between **light and dark mode**

No vendor lock-in. No paid tiers. Self-host it and own your data.

---

## Features

| Feature | Description | Auth required |
|---|---|---|
| **Blacklist Quick Check** | Scan hostname/IP against 60 DNSBL providers (rate limited for anonymous use) | No |
| **Bulk Check** | Check up to 300 IPs/domains at once, from a list or a TXT/CSV/XLSX file | Yes |
| **Subnet / CIDR Check** | Scan an entire IP range (max /24) against key DNSBL providers | Yes |
| **AbuseIPDB** | IP reputation score, abuse reports, ISP & geolocation | Yes |
| **WHOIS Lookup** | Domain registrar, dates, name servers, registrant info | Yes |
| **DNS Record Viewer** | A, AAAA, MX, TXT, CNAME, NS, SOA, PTR records | Yes |
| **SSL Certificate Checker** | Validity, expiry, issuer, cipher, SAN list | Yes |
| **SPF / DKIM / DMARC** | Email authentication validation with A-F grading, custom DKIM selectors | Yes |
| **Is Server Up?** | DNS resolution, port scan (80/443), HTTP status & response time | Yes |
| **CSV Export** | Download blacklist and subnet results as CSV | - |
| **Bulk Asset Import** | Add up to 300 assets at once from a pasted list or TXT/CSV/XLSX file | Yes |
| **CIDR Import** | Import an IP range (max /24) as monitored assets from the UI | Yes |
| **Assets** | Register domains/IPs, run all checks with per-asset toggles, edit them later | Yes |
| **Asset Detail View** | Tabbed results for every check type with summary cards | Yes |
| **Scheduled Monitoring** | Automatic periodic re-checks with email/webhook alerts | Yes |
| **Historical Charts** | Visual blacklist history per monitored asset | Yes |
| **Re-check Asset** | Re-run all enabled checks on any asset with one click | Yes |
| **Delist Tracking** | Links to each provider's removal page and tracks requested removals | Yes |
| **Search & Filter** | Search assets by hostname/type, filter by clean/listed status | Yes |
| **Auto-refresh** | Configurable auto-refresh (30s/1m/5m) on Dashboard and Assets | Yes |
| **Copy to Clipboard** | One-click copy on IPs, DNS records, WHOIS data, SSL details | - |
| **Relative Timestamps** | "2 hours ago" with full datetime tooltip on hover | - |
| **Dark Mode** | Toggle between light and dark themes, persisted to localStorage | - |
| **Responsive Layout** | Collapsible sidebar with hamburger menu on mobile | - |
| **Favicon Alert** | Red badge on favicon when any asset is blacklisted | - |
| **Accounts** | Change your password in Settings; admins can add users via `POST /user/create/` | Yes |
| **API Documentation** | Swagger UI & ReDoc for all endpoints | No |

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/bekkaze/abusebox
cd abusebox
cp backend/.env.example .env    # configure your settings
docker compose up --build
```

Open `http://localhost:3000` and you're ready to go.

> Default login: `admin` / `password123`. **Change it in Settings right after the first sign-in.**
>
> To open AbuseBox from another machine, add that hostname or IP to `VITE_ALLOWED_HOSTS` and `APP_CORS_ALLOWED_ORIGINS` in `.env`.

### Manual Setup

<details>
<summary>Click to expand</summary>

**Prerequisites:** Python 3.11+, Node.js 20.19+, Yarn

**Backend:**

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

**Frontend** (new terminal):

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

Open `http://localhost:3000`.

</details>

---

## Configuration

Create a `.env` file in the project root (Docker Compose reads it automatically, and values in it override the compose defaults):

```env
# Leave empty to auto-generate a secret (stored next to the database)
APP_SECRET_KEY=
APP_DEBUG=false
APP_CORS_ALLOWED_ORIGINS=http://localhost:3000
VITE_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///./app.db   # ignored by Docker Compose (always uses the data volume)

# Default admin, created on first start only
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=password123
DEFAULT_ADMIN_EMAIL=admin@abusebox.local
DEFAULT_ADMIN_PHONE=11111111

# Optional: AbuseIPDB (free key at https://www.abuseipdb.com/account/api)
ABUSEIPDB_API_KEY=

# Scheduled monitoring
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=360

# Email alerts (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true

# Webhook alerts (optional)
WEBHOOK_URL=
```

| Variable | Description | Required |
|---|---|---|
| `APP_SECRET_KEY` | JWT signing secret. If unset, a random one is generated and saved as `.secret_key` next to the database | No |
| `APP_DEBUG` | Show error tracebacks (development only) | No |
| `APP_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API | No |
| `DATABASE_URL` | Database connection string (SQLite default) | No |
| `ABUSEIPDB_API_KEY` | Enables AbuseIPDB reputation checks | No |
| `SCHEDULER_ENABLED` | Run periodic background checks (default: `true`; can also be changed in Settings) | No |
| `SCHEDULER_INTERVAL_MINUTES` | Check interval in minutes (default: 360) | No |
| `SMTP_HOST` | SMTP server for email alerts | No |
| `WEBHOOK_URL` | Webhook URL for blacklist alert POSTs | No |
| `DNSBL_NAMESERVERS` | Comma-separated DNS resolvers for blacklist lookups. Spamhaus and some others refuse public resolvers; point this at your own recursive resolver for complete results | No |

> DNS Records, SSL Checker, WHOIS, SPF/DKIM/DMARC, and Server Status work out of the box with no API keys.

Frontend config (`frontend/.env`):

| Variable | Description |
|---|---|
| `VITE_BASE_URL` | Backend URL for Vite proxy (default: `http://localhost:8100`) |
| `VITE_ALLOWED_HOSTS` | Hostnames the dev server answers to (default: `localhost,127.0.0.1`) |

---

## API Endpoints

Only the blacklist quick check is public (rate limited to 10 requests per minute per IP). Every other endpoint needs a bearer token from `POST /user/login/`:

```
GET  /blacklist/quick-check/?hostname=example.com      # public
GET  /tools/abuseipdb/?hostname=8.8.8.8
GET  /tools/whois/?hostname=example.com
GET  /tools/dns/?hostname=example.com
GET  /tools/ssl/?hostname=example.com
GET  /tools/email-security/?hostname=example.com&dkim_selectors=s1,s2
GET  /tools/server-status/?hostname=example.com
GET  /tools/subnet/?cidr=203.0.113.0/24
POST /tools/bulk-check/                  # {"hostnames": ["example.com", "8.8.8.8"]}
POST /tools/bulk-check-upload/           # multipart file: .txt, .csv or .xlsx
GET  /tools/export/blacklist/?hostname=example.com
GET  /tools/export/subnet/?cidr=203.0.113.0/24
POST /hostname/bulk/                     # up to 300 assets
POST /hostname/cidr-import/
POST /hostname/{id}/recheck/
POST /user/change-password/
POST /user/create/                       # admin only
```

```bash
TOKEN=$(curl -s -X POST localhost:8100/user/login/ -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}' | jq -r .access)
curl -s -H "Authorization: Bearer $TOKEN" "localhost:8100/tools/dns/?hostname=example.com"
```

Full interactive docs available after startup:

- **Swagger UI:** `http://localhost:8100/swagger/`
- **ReDoc:** `http://localhost:8100/redoc/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, JWT (python-jose), dnspython |
| Frontend | React 18, Vite 6, Tailwind CSS, Mantine, Recharts |
| Database | SQLite (swappable via `DATABASE_URL`) |
| Deployment | Docker + Docker Compose |

---

## Project Structure

```
abusebox/
├── backend/
│   └── app/
│       ├── api/routers/       # auth, blacklist, hostname, tools
│       ├── core/              # config, JWT security
│       ├── db/                # SQLAlchemy session, seed data
│       ├── models/            # ORM models
│       ├── schemas/           # Pydantic schemas
│       └── services/          # dnsbl, abuseipdb, whois, dns, ssl,
│                              # email security, subnet, export,
│                              # check runner, notifications, scheduler
├── frontend/
│   └── src/
│       ├── pages/             # Landing, Login, Assets, AssetDetail,
│       │                      # Dashboard, Check & Lookup tools
│       ├── components/        # Reusable UI (shared: Skeleton, CopyButton,
│       │                      # TimeAgo, AutoRefresh, ErrorBoundary)
│       ├── services/          # API client functions, auth, theme
│       └── routes/            # React Router config
├── docker-compose.yml
└── .env
```

---

## Releases

| Version | Date | Highlights |
|---|---|---|
| **v1.1.3** | October 2026 | Scheduler fix (#20), security hardening (generated JWT secret, SSRF guards, login rate limiting, password change), dependency updates, bulk lists up to 300, asset editing, accessible UI and dark mode fixes |
| **v1.1.2** | March 26, 2026 | Bulk asset import, CIDR import, auto-refresh auth, persistent DB, DNSBL false positive fix, community bug fixes |
| **v1.1.1** | March 25, 2026 | UX polish, responsive mobile layout, asset re-check, code splitting, security fixes |
| **v1.1.0** | March 23, 2026 | Asset management, DNS/SSL/DMARC tools, bulk & subnet check, scheduled monitoring, dark mode, 60+ DNSBL providers |
| **v1.0.1** | March 19, 2026 | AbuseIPDB, WHOIS lookup, server status checker, security hardening |
| **v1.0.0** | March 2, 2026 | Initial release — DNSBL monitoring, dashboard, delist workflow |

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**If AbuseBox helps you, consider giving it a star!**

[![GitHub stars](https://img.shields.io/github/stars/bekkaze/abusebox?style=social)](https://github.com/bekkaze/abusebox/stargazers)

</div>
