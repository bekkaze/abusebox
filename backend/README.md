# Backend (FastAPI)

Run locally:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Default seeded admin user:

- Username: `admin`
- Email: `admin@abusebox.local`
- Password: `password123`

Project structure:

- `app/main.py`: app factory and startup lifecycle
- `app/api/routers/`: route modules (`auth`, `blacklist`, `hostname`)
- `app/core/`: settings and security
- `app/db/`: SQLAlchemy engine/session/bootstrap seed
- `app/models/`: ORM models
- `app/schemas/`: request/response schemas
- `app/services/`: DNSBL checking logic
