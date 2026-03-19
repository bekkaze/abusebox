<div align="center">

# AbuseBox

**Open-source threat monitoring toolkit for IPs, domains, and servers.**

Check blacklists, query AbuseIPDB, run WHOIS lookups, and verify server uptime — all from one dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/bekkaze/abusebox)](https://github.com/bekkaze/abusebox/releases)
[![GitHub stars](https://img.shields.io/github/stars/bekkaze/abusebox?style=social)](https://github.com/bekkaze/abusebox/stargazers)

![AbuseBox landing preview](files/landing.png)

</div>

---

## Why AbuseBox?

Most blacklist tools check one thing at a time. AbuseBox gives you a **single pane of glass** to:

- Scan **40+ DNSBL providers** in seconds
- Get **AbuseIPDB reputation scores** alongside blacklist results
- Pull **WHOIS registration data** with one click
- Check if a server is **up or down** with DNS, port, and HTTP checks

No vendor lock-in. No paid tiers. Self-host it and own your data.

---

## Features

| Feature | Description | Auth required |
|---|---|---|
| **Blacklist Quick Check** | Scan hostname/IP against 40+ DNSBL providers | No |
| **AbuseIPDB** | IP reputation score, abuse reports, ISP & geolocation | No |
| **WHOIS Lookup** | Domain registrar, dates, name servers, registrant info | No |
| **Is Server Up?** | DNS resolution, port scan (80/443), HTTP status & response time | No |
| **Blacklist Monitor** | Track hostnames with persistent check history & alerts | Yes |
| **Delist Workflow** | Request delisting from supported providers | Yes |
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

> Default login: `admin` / `password123`

### Manual Setup

<details>
<summary>Click to expand</summary>

**Prerequisites:** Python 3.11+, Node.js 18+, Yarn

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

Create a `.env` file in the project root (Docker reads it automatically):

```env
APP_SECRET_KEY=replace-this-secret
APP_DEBUG=true
APP_CORS_ALLOWED_ORIGINS=http://localhost:3000
DATABASE_URL=sqlite:///./app.db

# Default admin credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=password123
DEFAULT_ADMIN_EMAIL=admin@abusebox.local
DEFAULT_ADMIN_PHONE=11111111

# Optional: AbuseIPDB (free key at https://www.abuseipdb.com/account/api)
ABUSEIPDB_API_KEY=
```

| Variable | Description | Required |
|---|---|---|
| `APP_SECRET_KEY` | JWT signing secret (change in production) | Yes |
| `APP_DEBUG` | Enable debug mode | No |
| `DATABASE_URL` | Database connection string (SQLite default) | No |
| `ABUSEIPDB_API_KEY` | Enables AbuseIPDB reputation checks | No |

> WHOIS and Server Status work out of the box with no API keys.

Frontend config (`frontend/.env`):

| Variable | Description |
|---|---|
| `VITE_BASE_URL` | Backend URL for Vite proxy (default: `http://localhost:8100`) |

---

## API Endpoints

All tool endpoints are public (no auth required):

```
GET /blacklist/quick-check/?hostname=example.com
GET /tools/abuseipdb/?hostname=8.8.8.8
GET /tools/whois/?hostname=example.com
GET /tools/server-status/?hostname=example.com
```

Full interactive docs available after startup:

- **Swagger UI:** `http://localhost:8100/swagger/`
- **ReDoc:** `http://localhost:8100/redoc/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, JWT (python-jose) |
| Frontend | React 18, Vite, Tailwind CSS, Mantine |
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
│       └── services/          # dnsbl, abuseipdb, whois, server status
├── frontend/
│   └── src/
│       ├── pages/             # Landing, Login, Dashboard views
│       ├── components/        # Reusable UI components
│       ├── services/          # API client functions
│       └── routes/            # React Router config
├── docker-compose.yml
└── .env
```

---

## Releases

| Version | Date | Highlights |
|---|---|---|
| **v1.1.0** | March 19, 2026 | AbuseIPDB, WHOIS lookup, server status checker |
| **v1.0.0** | March 2, 2026 | Initial release — DNSBL monitoring, dashboard, delist workflow |

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## License

MIT - see [LICENSE](LICENSE) for details.

---

<div align="center">

**If AbuseBox helps you, consider giving it a star!**

[![GitHub stars](https://img.shields.io/github/stars/bekkaze/abusebox?style=social)](https://github.com/bekkaze/abusebox/stargazers)

</div>
