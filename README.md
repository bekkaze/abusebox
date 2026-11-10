<div align="center">

<img src="files/logo.png" alt="" width="96" />

# AbuseBox

**Know your mail server is blacklisted before your users do.**

Self-hosted monitoring for the IPs and domains you run: 28 DNS blacklists across IPv4, IPv6 and domain names, SSL and domain expiry, SPF/DKIM/DMARC and uptime, with an alert when something changes.

[Website](https://bekkaze.github.io/abusebox/) &nbsp;|&nbsp; [Quick start](#quick-start) &nbsp;|&nbsp; [Documentation](#documentation) &nbsp;|&nbsp; [Changelog](CHANGELOG.md)

[![Release](https://img.shields.io/github/v/release/bekkaze/abusebox)](https://github.com/bekkaze/abusebox/releases)
[![CI](https://github.com/bekkaze/abusebox/actions/workflows/ci.yml/badge.svg)](https://github.com/bekkaze/abusebox/actions/workflows/ci.yml)
[![Docker images](https://img.shields.io/badge/docker-amd64%20%7C%20arm64-942fed?logo=docker&logoColor=white)](https://github.com/bekkaze?tab=packages&repo_name=abusebox)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/bekkaze/abusebox?style=social)](https://github.com/bekkaze/abusebox/stargazers)

</div>

![The dashboard ordered by risk, an asset's report with the factors behind its score, every blacklist with its verdict explained, and dark mode](files/demo.gif)

## Quick start

```bash
git clone https://github.com/bekkaze/abusebox.git && cd abusebox
docker compose up -d
```

Open `http://localhost:3000` and sign in as `admin` with the password the first start generates:

```bash
docker compose exec backend cat /app/data/initial_admin_password
```

Change it in Settings straight away. Unraid, Portainer and CasaOS installs are in [Installation](docs/installation.md).

## Manual setup

Without Docker you run the two halves yourself. **Prerequisites:** Python 3.11+, Node.js 20.19+, Yarn.

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

The first start generates the admin password and saves it next to the database as `initial_admin_password`; the terminal names the exact path.

Then the frontend, in a second terminal:

```bash
cd frontend
cp .env.example .env
yarn install
yarn dev
```

Open `http://localhost:3000`. `frontend/.env` configures the dev server: `VITE_BASE_URL` is the backend it proxies `/api` to (default `http://localhost:8100`), and `VITE_ALLOWED_HOSTS` is the hostnames it answers to (default `localhost,127.0.0.1`). The Docker image uses neither — it serves the built UI with nginx and proxies `/api` to `BACKEND_URL`.

A manual install has no bundled DNS resolver, so blacklist lookups go through whatever the machine uses. If Spamhaus and others come back as **No answer**, point `DNSBL_NAMESERVERS` at a recursive resolver you run: [Blacklists that show "No answer"](docs/troubleshooting.md#blacklists-that-show-no-answer).

## What it checks

- **Blacklists** — 28 lists: 24 for IPv4, 5 answering IPv6, plus Spamhaus DBL, SURBL and URIBL for domain names. Every listing is decoded to what it means and how bad it is
- **Reputation** — AbuseIPDB confidence score, reports, ISP and country
- **Certificates** — validity, issuer, expiry, covered names, and whether the TLS version and cipher are still acceptable
- **Domains** — WHOIS registrar, dates, name servers and abuse contact, with expiry warnings
- **Mail authentication** — SPF, DKIM and DMARC graded A to F, plus DMARC aggregate reports
- **Reachability** — DNS records, ports 80 and 443, HTTP status and response time

Every asset gets a **risk score out of 100**, weighted by the severity each finding decodes to, so one critical listing outranks three cosmetic ones — and the score shows its working, factor by factor. The dashboard opens on what needs action.

Checks re-run on a schedule you set globally or per asset. When something is listed, delisted, goes down or is about to expire, AbuseBox tells you by email, Slack, Discord or webhook, and the activity log keeps what changed between checks, with a listing history per asset.

Add assets one at a time, as a list of up to 300, or a whole /24. Day to day there is delist tracking with a link to each list's removal page, table and card views with search, filters, sorting and paging done on the server, an owner per asset, bulk actions and CSV export, a command palette (Ctrl/Cmd + K), light and dark themes, a mobile layout, multiple users with admin roles, and a REST API with Swagger docs. A public quick-check page needs no account; everything else requires sign-in.

## Results you can trust

Before trusting a blacklist, AbuseBox checks the list against its own test points (RFC 5782): `127.0.0.2` must come back listed, `127.0.0.1` must not. A list that gets either wrong, times out or returns a refusal code is shown as **No answer**, and its verdict is ignored rather than reported as clean.

That matters more than it sounds. Queried through Google DNS, Spamhaus answers "not listed" for everything. Docker Compose ships a recursive resolver so the lists see your own address — if you install another way, read [Blacklists that show "No answer"](docs/troubleshooting.md#blacklists-that-show-no-answer).

Nor is one listing like another. Spamhaus SBL means a spam source and PBL means an end-user range, which are not the same problem, so every listing is reported with its own meaning and severity instead of a bare "listed".

## Documentation

- [Installation](docs/installation.md) — Docker, manual, Unraid, Portainer, CasaOS, and upgrading
- [Configuration](docs/configuration.md) — every environment variable
- [Troubleshooting](docs/troubleshooting.md) — blacklists showing "No answer", WHOIS timeouts
- [API](docs/api.md) — endpoints, tokens and the Swagger docs
- [Architecture](docs/architecture.md) — stack and repository layout
- [Changelog](CHANGELOG.md) — every release, and the [release notes](https://github.com/bekkaze/abusebox/releases)

## Contributing

Issues and pull requests are welcome. [Good first issues](https://github.com/bekkaze/abusebox/labels/good%20first%20issue) are a way in, [CONTRIBUTING.md](CONTRIBUTING.md) has the setup and checks, and questions go to [Discussions](https://github.com/bekkaze/abusebox/discussions).

## Security

Please report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE). Self-hosted, no telemetry, no paid tier — if AbuseBox saves you a bounce, a star helps other mail operators find it.
