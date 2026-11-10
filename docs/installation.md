# Installation

Every way to run AbuseBox, and what each release needs on upgrade.

## Docker (recommended)

```bash
git clone https://github.com/bekkaze/abusebox.git
cd abusebox
cp backend/.env.example .env    # optional: alerts, API keys, admin account
docker compose up -d            # pulls the prebuilt images (add --build to build from source)
```

Open `http://localhost:3000` and you're ready to go.

> **First sign-in:** the user is `admin`, and the first start generates a random password. Read it with `docker compose exec backend cat /app/data/initial_admin_password`; the backend log names the file but no longer prints the password itself, so a log you share with someone does not hand them the account. **Change it in Settings right after signing in**; the saved copy is deleted when you do. To choose it yourself, set `DEFAULT_ADMIN_PASSWORD` in `.env` before the first start. If the data path is not writable the account is not created at all, and the log says so rather than putting the password in it.
>
> The UI answers on any hostname, so you can open it from another machine right away. Put it behind your own HTTPS reverse proxy before exposing it to a network you don't trust.

## Manual setup

**Prerequisites:** Python 3.11+, Node.js 20.19+, Yarn

**Backend:**

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

The first start generates an admin password and saves it next to the database, as `initial_admin_password`. This terminal names the exact path.

**Frontend** (new terminal):

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

Open `http://localhost:3000`.

`frontend/.env` configures the dev server: `VITE_BASE_URL` is the backend it proxies `/api` to (default `http://localhost:8100`), and `VITE_ALLOWED_HOSTS` is the hostnames it answers to (default `localhost,127.0.0.1`). The Docker image does not use either; it serves the built UI with nginx and proxies `/api` to `BACKEND_URL`.

## Unraid

Templates for Unraid's Community Applications live in [`templates/unraid/`](../templates/unraid/). AbuseBox runs as two containers, so install both:

1. Copy `abusebox-backend.xml` and `abusebox-frontend.xml` into `/boot/config/plugins/dockerMan/templates-user/` on the server (or add this repository under **Docker → Template repositories**).
2. Add **AbuseBox-Backend** first. Set **Data** to a path you back up, such as `/mnt/user/appdata/abusebox`, and set **Allowed browser origins** to the address you will open AbuseBox at, for example `http://192.168.1.10:3000`.
3. Add **AbuseBox-Frontend**. Set **Backend URL** to the server's LAN IP and the backend's port, for example `http://192.168.1.10:8100`. Not `localhost` — that points at the frontend container itself.
4. Open `http://<your-server>:3000`. The admin password is in `initial_admin_password` in the data path you chose; the AbuseBox-Backend log names the file. Read it from **Docker → AbuseBox-Backend → Console** with `cat /app/data/initial_admin_password`, or from the share over SMB.

Unraid has no bundled resolver, so **Blacklist resolvers** is empty by default and the server's own resolver is used. If blacklists show "No answer", see [Blacklists that show "No answer"](troubleshooting.md#blacklists-that-show-no-answer).

## Portainer

[`templates/portainer/`](../templates/portainer/) has an app template and a self-contained compose file (no build contexts, no bind mounts).

- **App template:** in Portainer, **Settings → App Templates**, set the URL to `https://raw.githubusercontent.com/bekkaze/abusebox/main/templates/portainer/template.json`, then deploy **AbuseBox** from **App Templates**.
- **Or as a stack:** **Stacks → Add stack → Repository**, repository URL `https://github.com/bekkaze/abusebox`, compose path `templates/portainer/docker-compose.yml`.

Set **Allowed browser origins** to the address you open AbuseBox at, then go to `http://<your-server>:3000`. For the admin password, open the backend container's **Console** in Portainer and run `cat /app/data/initial_admin_password`.

## CasaOS

[`templates/casaos/docker-compose.yml`](../templates/casaos/docker-compose.yml) is a self-contained CasaOS app.

1. In CasaOS, **App Store → Custom Install** (the `+` in the top right), choose **Import** and paste the file's contents.
2. Install, then open AbuseBox from the dashboard at port 3000.
3. In the app's settings, set `APP_CORS_ALLOWED_ORIGINS` to the address you open AbuseBox at, for example `http://192.168.1.10:3000`, or the browser will block the API calls.

Data lives in `/DATA/AppData/abusebox/data`. The admin password is in `initial_admin_password` in that folder, which you can open in the CasaOS file manager.

## Upgrading

```bash
docker compose pull && docker compose up -d
```

The database is migrated automatically on start, and your data is kept. (Built from source? `git pull && docker compose up -d --build`.)

Most releases need nothing else. The few that do are below, and the [changelog](../CHANGELOG.md) has the full detail for every version.

<details>
<summary>Manual steps for releases before 1.3.5</summary>

<a id="upgrading-to-v130"></a>
<a id="upgrading-from-v11x"></a>

**v1.3.4** — nothing required. Two additions live in the repository rather than the images, so `git pull` as well if you want them: the commented-out **`enable_ipv6`** block at the end of `docker-compose.yml` (see [WHOIS that times out](troubleshooting.md#whois-that-times-out)), and the **install templates** for Unraid, Portainer and CasaOS in `templates/`.

**v1.3.2** — `git pull` as well as pulling the images: `docker-compose.yml` adds a DNS resolver (Unbound) for blacklist lookups, see [Blacklists that show "No answer"](troubleshooting.md#blacklists-that-show-no-answer). The backend's port 8100 now listens on this machine only, so scripts elsewhere should call the API through port 3000. The backend container runs as an unprivileged user and takes ownership of the data volume on first start, so no action is needed. Still on `password123`? It keeps working, with a banner asking you to change it.

**v1.3.0** — the frontend is a production build served by nginx, so `VITE_ALLOWED_HOSTS`, `VITE_BASE_URL` and `VITE_API_DOCS_URL` in `.env` are unused and can be removed; the API docs moved to `http://localhost:3000/api/swagger/`. Migrations moved to Alembic and existing databases are upgraded on first start. ISPs and other commercial users need `SPAMHAUS_DQS_KEY` set, see [Configuration](configuration.md).

**From v1.1.x** — everyone is signed out once, because older Docker setups used a published JWT secret. The admin account probably still uses `password123`; change it in **Settings → Password**. The `/tools/*` API needs a token now, only `/blacklist/quick-check/` stays public. Public sign-up is gone, so admins add users in **Settings → Users**. The scheduler is on by default. Back up first:

```bash
# The volume is named <folder>_abusebox-data; `docker volume ls` shows it.
docker run --rm -v abusebox_abusebox-data:/data -v "$PWD":/backup alpine tar czf /backup/abusebox-data.tgz -C /data .
```

</details>
