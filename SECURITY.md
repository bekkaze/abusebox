# Security policy

AbuseBox runs on your own server, holds the list of hosts you monitor and makes outbound connections, so security reports are taken seriously.

## Supported versions

Security fixes go into the latest release. Upgrade with `git pull && docker compose pull && docker compose up -d`.

| Version | Supported |
|---|---|
| 1.3.2 and later | Yes |
| 1.3.1 and earlier | No |

Reports are only accepted for 1.3.2 or later. Please reproduce the issue on the latest release first: 1.3.1 and earlier have known, already-fixed issues ([GHSA-gccc-7w6h-jvhm](https://github.com/bekkaze/abusebox/security/advisories/GHSA-gccc-7w6h-jvhm)).

## Reporting a vulnerability

Please do not open a public issue for security problems.

- Preferred: [report it privately on GitHub](https://github.com/bekkaze/abusebox/security/advisories/new).
- Or email bekkaze7@gmail.com with "AbuseBox security" in the subject.

Include what you found, how to reproduce it, the version you tested, and the impact you expect. You will get a reply within 7 days. Once a fix is released, the advisory credits you unless you prefer otherwise.

## Scope

In scope: the backend API, the web UI, the Docker images and the default `docker-compose.yml`. Examples: authentication or authorization bypass, server-side request forgery through the check tools, injection, secrets exposed in images or logs.

Out of scope: results from third-party blacklists and services AbuseBox queries, deployments exposed to the internet without the HTTPS reverse proxy the README recommends, and reports that only list missing security headers without a demonstrated impact.
