# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (v1.3.0): people who run mail and web servers and watch their own IPs and domains — sysadmins, mail operators, small hosting and MSP teams. They open AbuseBox a few times a day at a desk, in daylight, to see whether anything they own is blacklisted, expiring, down or misconfigured, and what to do about it.

Later (v2 direction, not designed for yet): abuse and NOC teams at small and mid-sized network operators handling reports about their own prefixes and customers.

## Product Purpose

AbuseBox is a self-hosted, MIT-licensed monitor for infrastructure you own. It re-checks IPs and domains on a schedule against DNS blacklists, AbuseIPDB, SSL, WHOIS/domain expiry, DNS, SPF/DKIM/DMARC and server reachability, records every change, and alerts by email, Slack, Discord or webhook. Success: an operator learns about a listing or expiry from AbuseBox before their users or mail logs tell them, understands why, and knows the next step.

## Positioning

Evidence-honest monitoring. Every blacklist answer is verified against the list's RFC 5782 test points, so a list that refuses to answer shows as "No answer", never as a false "clean", and a dead list that starts listing everything is ignored. Listings are decoded (e.g. Spamhaus SBL vs PBL) with a severity, not shown as a bare "listed". It runs on the operator's own server; no data leaves it.

## Operating Context

- Self-hosted with Docker Compose; one admin plus a few users per install.
- Daily rhythm: open the dashboard, scan what needs attention, drill into an asset, re-check, request delisting, check history.
- Public landing page with a rate-limited quick check that needs no account.
- Command palette (Ctrl/Cmd+K) jumps to assets, pages and settings, or checks a typed domain/IP.

## Capabilities and Constraints

- Pages: landing + quick check, dashboard (needs attention, scheduler, recent activity, listing history), assets (card/table, filters, bulk actions), asset detail (tabs per check, history, activity), activity log, blacklist check, bulk check, subnet/CIDR check, AbuseIPDB, WHOIS, DNS records, SSL, SPF/DKIM/DMARC, DMARC reports, server status, settings (scheduler, notifications, users, password).
- 24 DNSBL lists in v1.3.0, each with a severity: critical, high, medium, low, info. Results states: listed, removal requested, no answer, clear; checks can be inconclusive.
- Stack: React 18, Vite 6, Tailwind CSS 3, react-icons, recharts; served by nginx in production.
- Light and dark themes both supported; light leads.

## Brand Commitments

- Name: AbuseBox.
- The shield-and-lock logo artwork (files/logo.png) stays as is.
- Must not look like a generic SaaS template (colourful icon tiles, gradient buttons, cards on cards).

## Evidence on Hand

- A demo GIF (files/demo.gif) and screenshots in files/ (dashboard, dark dashboard, asset report) used by the README and the project site.
- No customer logos, testimonials, user counts or benchmarks exist; none may be invented.

## Product Principles

1. The answer first: what is wrong, how serious, what to do — before any decoration.
2. Never show "clean" when the truth is "we couldn't ask".
3. Explain, don't just flag: every listing carries its meaning and severity.
4. Quiet when healthy, loud only when it matters.
5. Self-hosted trust: nothing implies data leaves the operator's server.

## Accessibility & Inclusion

Status never relies on colour alone (icon + text). Keyboard operable throughout; reduced-motion respected; WCAG AA contrast in both themes.
