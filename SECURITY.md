# Security Policy

## Supported versions

Security fixes are applied to the latest `main` branch.

## Reporting a vulnerability

Please do not disclose vulnerabilities publicly before a fix is available.

1. Email the maintainers listed in this repository.
2. Include impact, reproduction steps, and affected components.
3. If possible, include a minimal proof of concept.

## Response targets

- Initial acknowledgement: within 72 hours
- Triage and severity assessment: within 7 days
- Fix and disclosure timeline: based on severity and complexity

## Best practices for deployers

- Use a strong, unique `DJANGO_SECRET_KEY`.
- Set `DJANGO_DEBUG=false` in production.
- Restrict `DJANGO_ALLOWED_HOSTS` and `DJANGO_CORS_ALLOWED_ORIGINS`.
- Run behind TLS and a reverse proxy.
- Keep dependencies updated.
