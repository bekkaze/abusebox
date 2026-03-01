# AbuseBox

AbuseBox is an open-source blacklist monitoring platform built with Django REST Framework and React (Vite).
It helps teams check hostnames/IPs against DNSBL providers, monitor tracked hostnames, and manage blacklist operations.

## Features

- Quick blacklist check (public endpoint)
- Authenticated dashboard for monitored hostnames
- Hostname health/report history
- Delist request workflow (provider-specific)
- Swagger/OpenAPI docs for backend endpoints

## Tech stack

- Backend: Django 5, Django REST Framework, Simple JWT
- Frontend: React 18, Vite, Tailwind CSS
- Default DB: SQLite (configurable via environment variables)
- Containerization: Docker + Docker Compose

## Repository structure

- `backend/`: Django API service
- `frontend/`: React app
- `docker-compose.yml`: local multi-service setup
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`: open-source project standards

## Prerequisites

- Python 3.10+
- Poetry
- Node.js 18+
- Yarn
- Docker (optional)

## Local development

### 1. Backend setup

```bash
cd backend
cp .env.example .env
poetry install
poetry run python src/manage.py migrate
poetry run python src/manage.py createsuperuser  # optional
poetry run python src/manage.py runserver 0.0.0.0:8000
```

Backend is available at `http://localhost:8000`.

### 2. Frontend setup

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

Frontend is available at `http://localhost:3000`.

## Environment configuration

### Backend (`backend/.env`)

Key variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (`true`/`false`)
- `DJANGO_ALLOWED_HOSTS` (comma-separated)
- `DJANGO_CORS_ALLOWED_ORIGINS` (comma-separated)
- `DJANGO_DB_ENGINE`
- `DJANGO_DB_NAME`
- `DJANGO_DB_USER`
- `DJANGO_DB_PASSWORD`
- `DJANGO_DB_HOST`
- `DJANGO_DB_PORT`

### Frontend (`frontend/.env`)

- `VITE_BASE_URL=http://localhost:8000`

Vite proxies `/api/*` requests to `VITE_BASE_URL` during development.

## Run with Docker Compose

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## API docs

After backend startup:

- Swagger UI: `http://localhost:8000/swagger/`
- ReDoc: `http://localhost:8000/redoc/`

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
poetry run python src/manage.py check
```

## Open source guidelines

- Contribution process: [CONTRIBUTING.md](CONTRIBUTING.md)
- Community standards: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Vulnerability reporting: [SECURITY.md](SECURITY.md)

## License

This project is licensed under the terms in [LICENSE](LICENSE).
