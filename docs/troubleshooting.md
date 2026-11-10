# Troubleshooting

## Blacklists that show "No answer"

Each check also asks every blacklist about its test addresses: 127.0.0.2 must be listed and 127.0.0.1 must not be. A blacklist that gets either wrong, times out or returns a refusal code is shown as **No answer**, and its result (clean or listed) is ignored.

The usual cause is the DNS resolver. Spamhaus (`zen.spamhaus.org`) does not answer large public resolvers honestly: through Google DNS it says "not listed" for everything, and through Cloudflare it returns an error code. Other lists rate limit public resolvers. Resolvers with DNS rebinding protection (dnsmasq's `stop-dns-rebind`, pfSense) drop the `127.0.0.x` answers blacklists use, with the same result. When this happens the dashboard shows a warning.

Test the resolver your mail server or AbuseBox uses; `127.0.0.2` should come back:

```bash
dig +short 2.0.0.127.zen.spamhaus.org
```

**Docker Compose already handles this.** It runs a small recursive resolver ([Unbound](https://nlnetlabs.nl/projects/unbound/about/), the `unbound` service) and sends blacklist lookups through it, so the lists see your server's IP. Some networks block the direct DNS traffic a recursive resolver needs; then AbuseBox falls back to the server's normal resolver and logs that it did.

To use a resolver you already run instead, set it in `.env`:

```env
DNSBL_NAMESERVERS=192.0.2.53
```

For a manual install, point `DNSBL_NAMESERVERS` at a local Unbound or another recursive resolver that isn't a large public one. If you use dnsmasq, add `rebind-localhost-ok`.

**If you can't run a recursive resolver**, which is common on a cloud VPS where outbound port 53 is filtered, a recursive resolver cannot reach the root servers and your provider's resolver is one of the shared ones Spamhaus refuses. Both routes are closed, so ask Spamhaus directly instead: a [free Data Query Service key](https://www.spamhaus.com/data-access/free-data-query-service/) in `SPAMHAUS_DQS_KEY` sends Spamhaus lookups to your own keyed mirror, which answers whatever resolver they arrive through. The other lists are unaffected and keep using `DNSBL_NAMESERVERS`.

A refusal is not a listing. Spamhaus answers a refused query with `127.255.255.254`, or `127.255.255.255` when rate limited, and AbuseBox reads both as **No answer** rather than as a listing or a clean result. If another tool tells you an address is listed on `127.255.255.254`, that tool is misreading a refusal.

<a id="whois-that-times-out"></a>

## WHOIS that times out

Registries sometimes block an individual client's IPv4 address while still answering that same client over IPv6. SIDN (`.nl`) is known to do it. AbuseBox tries both address families and falls back to the other when one does not answer, so this fixes itself wherever IPv6 is available.

Docker containers only get IPv4 by default, whatever the host has. To give them IPv6 as well, uncomment this at the end of `docker-compose.yml` and recreate the stack:

```yaml
networks:
  default:
    enable_ipv6: true
```

It needs Docker Engine 27 or newer; older daemons refuse to create the network unless they were started with `--ipv6` and `fixed-cidr-v6`. Check that it worked:

```bash
docker compose exec backend python -c "import socket; socket.create_connection(('2a00:d78:0:b001:94:198:154:138', 43), timeout=8); print('IPv6 OK')"
```

A WHOIS lookup has one time budget (`WHOIS_TIMEOUT_SECONDS`, default 30) shared across both families, so enabling IPv6 never makes a failing lookup take longer.

Registries also rate limit hard: SIDN refuses a second query made soon after the first, answering `Error: ratelimit exceeded`. AbuseBox reports that as a failed check rather than an empty record, and reuses successful answers for `WHOIS_CACHE_MINUTES` (default 6 hours) so monitoring does not re-ask on every cycle.

If a registry refuses anyway, the last good answer is served for up to four times that window rather than nothing, marked `stale` with the reason and its age. A registration does not change by the hour, so an asset keeps its registrar and expiry date instead of flipping to an error whenever the registry is busy. Once the stale window passes, the failure is reported normally.
