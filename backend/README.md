# Backend (FastAPI)

Run locally:

```bash
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

Run tests:

```bash
python -m pytest -m "not network"   # offline suite (what CI runs)
python -m pytest -m network         # live DNSBL cross-checks (needs DNS access)
```

Default seeded admin user:

- Username: `admin`
- Email: `admin@abusebox.local`
- Password: `password123` (change it in Settings after the first sign-in)

Project structure:

- `app/main.py`: app factory and startup lifecycle
- `app/api/routers/`: route modules (`auth`, `blacklist`, `dmarc`, `hostname`, `settings`, `tools`)
- `app/core/`: settings, JWT security, outbound-network (SSRF) guards, client IP helper
- `app/db/`: SQLAlchemy engine/session/bootstrap seed
- `app/models/`: ORM models
- `app/schemas/`: request/response schemas
- `app/services/`: DNSBL, AbuseIPDB, DNS, SSL, WHOIS, email security, server status, DMARC parsing, scheduler, notifications
- `tests/`: pytest suite (`network`-marked tests need live DNS)
