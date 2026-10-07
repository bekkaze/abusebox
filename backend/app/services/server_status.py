import socket
import time
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from app.core.network_safety import UnsafeDestinationError, resolve_public_ipv4, validate_public_url

_MAX_REDIRECTS = 5
_MAX_BODY_BYTES = 1024 * 1024
_HEADERS = {"User-Agent": "AbuseBox-Monitor/1.0"}


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


def _safe_get(url: str) -> tuple[requests.Response, str, int]:
    """GET *url*, following redirects manually so every hop is re-validated.

    ``requests`` would otherwise follow a redirect from a public host to an
    internal address (e.g. cloud metadata), bypassing the initial check.
    Returns (response, final_url, body_size). The body is read at most up to
    ``_MAX_BODY_BYTES`` so a huge download can't tie up a worker.
    """
    current = url
    for _ in range(_MAX_REDIRECTS + 1):
        validate_public_url(current)
        resp = requests.get(current, timeout=10, allow_redirects=False, stream=True, headers=_HEADERS)
        location = resp.headers.get("Location")
        if resp.is_redirect and location:
            resp.close()
            current = urljoin(current, location)
            continue
        size = 0
        try:
            for chunk in resp.iter_content(chunk_size=65536):
                size += len(chunk)
                if size >= _MAX_BODY_BYTES:
                    break
        finally:
            resp.close()
        return resp, current, size
    raise requests.exceptions.TooManyRedirects(f"Exceeded {_MAX_REDIRECTS} redirects.")


def _record_response(result: dict[str, Any], resp: requests.Response, final_url: str, size: int, start: float) -> None:
    result["is_up"] = True
    result["status_code"] = resp.status_code
    result["response_time_ms"] = round((time.monotonic() - start) * 1000)
    result["final_url"] = final_url
    result["content_length"] = size
    result["server_header"] = resp.headers.get("Server")


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
        socket.getaddrinfo(hostname, None, socket.AF_INET)
    except (socket.gaierror, socket.timeout, UnicodeError):
        result["resolved_ip"] = None
        result["dns_resolves"] = False
        result["is_up"] = False
        result["reason"] = "DNS resolution failed"
        return result

    try:
        validate_public_url(url)
        ip = resolve_public_ipv4(hostname)
    except UnsafeDestinationError as exc:
        result["resolved_ip"] = None
        result["dns_resolves"] = True
        result["is_up"] = False
        result["reason"] = str(exc)
        return result
    result["resolved_ip"] = ip
    result["dns_resolves"] = True

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
        resp, final_url, size = _safe_get(url)
        _record_response(result, resp, final_url, size, start)
    except requests.exceptions.SSLError:
        result["is_up"] = False
        result["reason"] = "SSL certificate error"
        # Retry with http
        try:
            start = time.monotonic()
            resp, final_url, size = _safe_get(url.replace("https://", "http://", 1))
            _record_response(result, resp, final_url, size, start)
            result["ssl_error"] = True
        except (requests.exceptions.RequestException, UnsafeDestinationError):
            pass
    except UnsafeDestinationError as exc:
        # A redirect pointed at a private/reserved destination.
        result["is_up"] = False
        result["reason"] = f"Redirect blocked: {exc}"
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
