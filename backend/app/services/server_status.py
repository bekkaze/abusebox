import socket
import time
from typing import Any
from urllib.parse import urlparse

import requests


def _normalize_url(value: str) -> tuple[str, str]:
    """Return (url_with_scheme, hostname)."""
    target = (value or "").strip()
    if not target:
        return "", ""

    if not target.startswith(("http://", "https://")):
        target = "https://" + target

    parsed = urlparse(target)
    hostname = parsed.hostname or ""
    return target, hostname


def check_server_status(hostname_or_url: str) -> dict[str, Any]:
    url, hostname = _normalize_url(hostname_or_url)
    if not hostname:
        return {"error": "Invalid hostname or URL."}

    result: dict[str, Any] = {
        "query": hostname_or_url,
        "hostname": hostname,
        "url": url,
    }

    # DNS resolution check
    try:
        ip = socket.gethostbyname(hostname)
        result["resolved_ip"] = ip
        result["dns_resolves"] = True
    except (socket.gaierror, socket.timeout):
        result["resolved_ip"] = None
        result["dns_resolves"] = False
        result["is_up"] = False
        result["reason"] = "DNS resolution failed"
        return result

    # TCP port check (80 and 443)
    for port in (443, 80):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            sock.connect((ip, port))
            result[f"port_{port}_open"] = True
        except (socket.timeout, socket.error, OSError):
            result[f"port_{port}_open"] = False
        finally:
            sock.close()

    # HTTP check
    try:
        start = time.monotonic()
        resp = requests.get(url, timeout=10, allow_redirects=True, headers={
            "User-Agent": "AbuseBox-Monitor/1.0",
        })
        elapsed_ms = round((time.monotonic() - start) * 1000)

        result["is_up"] = True
        result["status_code"] = resp.status_code
        result["response_time_ms"] = elapsed_ms
        result["final_url"] = str(resp.url)
        result["content_length"] = len(resp.content)
        result["server_header"] = resp.headers.get("Server")
    except requests.exceptions.SSLError:
        result["is_up"] = False
        result["reason"] = "SSL certificate error"
        # Retry with http
        try:
            http_url = url.replace("https://", "http://", 1)
            start = time.monotonic()
            resp = requests.get(http_url, timeout=10, allow_redirects=True, headers={
                "User-Agent": "AbuseBox-Monitor/1.0",
            })
            elapsed_ms = round((time.monotonic() - start) * 1000)
            result["is_up"] = True
            result["status_code"] = resp.status_code
            result["response_time_ms"] = elapsed_ms
            result["final_url"] = str(resp.url)
            result["ssl_error"] = True
        except requests.exceptions.RequestException:
            pass
    except requests.exceptions.ConnectionError:
        result["is_up"] = False
        result["reason"] = "Connection refused or unreachable"
    except requests.exceptions.Timeout:
        result["is_up"] = False
        result["reason"] = "Request timed out"
    except requests.exceptions.RequestException as exc:
        result["is_up"] = False
        result["reason"] = str(exc)

    return result
