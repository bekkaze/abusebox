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

Required variable:

- `VITE_BASE_URL=http://localhost:8000`

The Vite dev server proxies `/api/*` requests to this backend URL.
