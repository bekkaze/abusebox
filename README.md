# AbuseBox

AbuseBox is an open-source blacklist monitoring platform built with FastAPI and React (Vite).
It helps teams check hostnames/IPs against DNSBL providers, monitor tracked hostnames, and manage blacklist operations.

![AbuseBox landing preview](files/landing.png)

## Project status

As of **March 2, 2026**, AbuseBox is back under active development and maintenance.

- Current release: **v1.0.0**
- Focus: stability, security, and better operator UX

## Features

- Quick blacklist check (public endpoint)
- Authenticated dashboard for monitored hostnames
- Hostname health/report history
- Delist request workflow (provider-specific)
- AbuseIPDB integration — IP reputation scoring and abuse reports
- WHOIS lookup — domain registration data with raw/parsed views
- Server status checker — DNS, port, HTTP reachability and response time
- Swagger/OpenAPI docs for backend endpoints

## Tech stack

- Backend: FastAPI, SQLAlchemy, JWT auth
- Frontend: React 18, Vite, Tailwind CSS
- Default DB: SQLite (configurable via environment variables)
- Containerization: Docker + Docker Compose

## Repository structure

- `backend/`: FastAPI API service
  - `app/api/routers/`: feature routers
  - `app/core/`: config and auth security
  - `app/db/`: DB session and seed init
  - `app/models/`: SQLAlchemy models
  - `app/schemas/`: API schemas
  - `app/services/`: blacklist checker, AbuseIPDB, WHOIS, and server status services
- `frontend/`: React app
- `docker-compose.yml`: local multi-service setup
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`: open-source project standards

## Prerequisites

- Python 3.11+
- Node.js 18+
- Yarn
- Docker (optional)

## Local development

### 1. Backend setup

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

Backend is available at `http://localhost:8100`.

Default admin account (seeded at startup):

- Username: `admin`
- Email: `admin@abusebox.local`
- Password: `password123`

### 2. Frontend setup

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

Frontend is available at `http://localhost:3000`.

## Installation guide

### Option A: Docker (recommended)

```bash
git clone https://github.com/bekkaze/abusebox
cd abusebox
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Backend Swagger: `http://localhost:8100/swagger/`

### Option B: Manual install

1. Clone repository and enter project directory.
2. Start backend:

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

3. Start frontend in a second terminal:

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

4. Open `http://localhost:3000`.

## Usage guide

### 1. Sign in

- Go to `/login`
- Use default local admin credentials:
  - Username: `admin`
  - Password: `password123`

### 2. Run quick blacklist check (public)

- From landing page, enter a domain/IP and click **Run Quick Check**
- Or directly open `/quick-check` via the UI flow

### 3. Use dashboard monitor flow

- Open `/dashboard`
- Go to **Blacklist Monitor**
- Click **Add New**, add hostname/domain/IP, and submit
- Open **View Report** for provider-by-provider blacklist status

### 4. Delist workflow

- In report view, use **Delist** for supported providers
- Current automated provider support is limited; unsupported providers return `Not implemented`

### 5. AbuseIPDB check

- Open **AbuseIPDB** from the dashboard sidebar
- Enter an IP or hostname to see its abuse confidence score, ISP, country, total reports, and more
- Requires an API key (see Environment configuration below)

### 6. WHOIS lookup

- Open **WHOIS Lookup** from the dashboard sidebar
- Enter a domain to retrieve registrar, creation/expiry dates, name servers, and registrant info
- Toggle between parsed table and raw WHOIS output

### 7. Server status check

- Open **Is Server Up?** from the dashboard sidebar
- Enter a hostname or URL to check DNS resolution, TCP port availability (80/443), HTTP status, and response time

## Environment configuration

### Backend (`backend/.env`)

Key variables:

- `APP_SECRET_KEY`
- `APP_DEBUG` (`true`/`false`)
- `APP_CORS_ALLOWED_ORIGINS` (comma-separated)
- `DATABASE_URL` (`sqlite:///./app.db` by default)
- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_PASSWORD`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PHONE`
- `ABUSEIPDB_API_KEY` — API key for AbuseIPDB integration (get one free at [abuseipdb.com](https://www.abuseipdb.com/account/api))

### Frontend (`frontend/.env`)

- `VITE_BASE_URL=http://localhost:8100`

Vite proxies `/api/*` requests to `VITE_BASE_URL` during development.

## Run with Docker Compose

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8100`

## API docs

After backend startup:

- Swagger UI: `http://localhost:8100/swagger/`
- ReDoc: `http://localhost:8100/redoc/`

## Release

- **v1.0.0** released on **March 2, 2026**

## Quality checks

### Frontend

```bash
cd frontend
yarn build
yarn lint
```

### Backend

```bash
cd backend
python -m py_compile $(find app -name '*.py')
```

## License

This project is licensed under the terms in [LICENSE](LICENSE).
