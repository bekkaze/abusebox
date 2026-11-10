# Configuration

AbuseBox runs with no configuration. To change anything, copy the full example and edit it:

```bash
cp backend/.env.example .env
```

Docker Compose reads `.env` from the project root automatically, and values in it override the compose defaults. The settings most installs touch:

```env
APP_CORS_ALLOWED_ORIGINS=http://localhost:3000   # the address you open AbuseBox at
DEFAULT_ADMIN_PASSWORD=                          # empty generates a random one
ABUSEIPDB_API_KEY=                               # optional, free key
SPAMHAUS_DQS_KEY=                                # required for commercial use, including ISPs
ABUSIX_API_KEY=                                  # optional: adds Abusix Guardian Mail
SMTP_HOST=                                       # optional, for email alerts
```

Everything available:

| Variable | Description | Default |
|---|---|---|
| `APP_SECRET_KEY` | JWT signing secret. If unset, a random one is generated and saved as `.secret_key` next to the database | generated |
| `APP_DEBUG` | Show error tracebacks (development only) | `false` |
| `APP_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API | `http://localhost:3000` |
| `DATABASE_URL` | Database connection string. Ignored by Docker Compose, which always uses the data volume | SQLite |
| `DEFAULT_ADMIN_USERNAME` | Admin account created on the first start only | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | Password for that account. If empty, a random one is generated and saved as `initial_admin_password` next to the database, readable only by the backend's user | generated |
| `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PHONE` | Contact details for that account. The email is where its alerts go, and each user can change their own in **Settings → Notifications** | `admin@abusebox.local` |
| `ABUSEIPDB_API_KEY` | Enables AbuseIPDB reputation checks ([free key](https://www.abuseipdb.com/account/api)) | unset |
| `SPAMHAUS_DQS_KEY` | Spamhaus [Data Query Service](https://www.spamhaus.com/data-access/free-data-query-service/) key. When set, Spamhaus lookups use your key instead of the public mirror. The free public mirror is for non-commercial use only; ISPs and commercial users need a paid key | unset |
| `ABUSIX_API_KEY` | Abusix Guardian Mail (formerly Mail Intelligence) key. When set, `combined.mail.abusix.zone` is queried as well. Free for low volume; sign up at [abusix.com](https://abusix.com/) | unset |
| `DNSBL_NAMESERVERS` | Comma-separated DNS resolvers for blacklist lookups. Docker Compose sets this to its bundled `unbound`. Spamhaus and some others refuse public resolvers; see [Blacklists that show "No answer"](troubleshooting.md#blacklists-that-show-no-answer) | bundled resolver |
| `SCHEDULER_ENABLED` | Run periodic background checks. Can also be changed in Settings | `true` |
| `SCHEDULER_INTERVAL_MINUTES` | How often the scheduler checks due assets | `360` |
| `WHOIS_TIMEOUT_SECONDS` | Total seconds for one WHOIS lookup, split evenly across IPv6 and IPv4. Some registries block a client on one family and answer it on the other | `30` |
| `WHOIS_CACHE_MINUTES` | How long a successful WHOIS answer is reused before asking again. `0` disables caching | `360` |
| `SMTP_HOST` | SMTP server for email alerts. Alerts go to the email address of the asset's owner; each user sets theirs in **Settings → Notifications** | unset |
| `SMTP_PORT` | `587` uses STARTTLS, `465` uses TLS from the start | `587` |
| `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_USE_TLS` | The rest of the SMTP settings | unset |
| `WEBHOOK_URL` | Webhook for alerts (Slack and Discord URLs get chat messages). A URL set in Settings → Notifications takes precedence | unset |
| `MAX_ASSETS_PER_USER` | How many assets each non-admin user can add | `1000` |
| `DISABLE_API_DOCS` | `true` hides the Swagger and ReDoc pages and the OpenAPI schema | `false` |

> DNS Records, SSL Checker, WHOIS, SPF/DKIM/DMARC, and Server Status work out of the box with no API keys.
