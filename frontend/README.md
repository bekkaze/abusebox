# AbuseBox Frontend

React + Vite frontend for the AbuseBox project.

## Scripts

```bash
yarn dev      # start development server on port 3000
yarn build    # production build
yarn preview  # preview production build
yarn lint     # eslint checks
```

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Requires Node.js 20.19 or newer.

Variables:

- `VITE_BASE_URL=http://localhost:8100` (required): the Vite dev server proxies `/api/*` requests to this backend URL.
- `VITE_ALLOWED_HOSTS=localhost,127.0.0.1`: hostnames the dev server answers to. Add your server's domain or IP to reach it from another machine.
- `VITE_API_DOCS_URL`: link target for "API Docs" in the sidebar (default `http://localhost:8100/swagger/`).
