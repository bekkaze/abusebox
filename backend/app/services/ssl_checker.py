import socket
import ssl
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


def check_ssl_certificate(hostname: str) -> dict[str, Any]:
    hostname = (hostname or "").strip()
    if not hostname:
        return {"error": "Please provide a hostname."}

    # Strip protocol/path/port
    if "://" in hostname:
        parsed = urlparse(hostname)
        hostname = parsed.hostname or hostname
    hostname = hostname.split("/")[0].split(":")[0]

    port = 443
    context = ssl.create_default_context()

    try:
        with socket.create_connection((hostname, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()

        if not cert:
            return {"error": "No certificate returned by server."}

        # SSL certs return dates like "Dec 30 23:59:59 2025 GMT".
        # Strip the timezone suffix and assume UTC to avoid %Z parsing issues.
        def _parse_cert_date(s: str) -> datetime:
            s = s.replace(" GMT", "").replace(" UTC", "").strip()
            return datetime.strptime(s, "%b %d %H:%M:%S %Y").replace(tzinfo=timezone.utc)

        not_before = _parse_cert_date(cert["notBefore"])
        not_after = _parse_cert_date(cert["notAfter"])
        now = datetime.now(timezone.utc)
        days_remaining = (not_after - now).days
        is_expired = days_remaining < 0

        subject = dict(x[0] for x in cert.get("subject", ()))
        issuer = dict(x[0] for x in cert.get("issuer", ()))

        san_list = []
        for entry_type, entry_value in cert.get("subjectAltName", ()):
            san_list.append(entry_value)

        return {
            "hostname": hostname,
            "valid": not is_expired,
            "days_remaining": days_remaining,
            "not_before": not_before.isoformat(),
            "not_after": not_after.isoformat(),
            "subject": {
                "common_name": subject.get("commonName", ""),
                "organization": subject.get("organizationName", ""),
            },
            "issuer": {
                "common_name": issuer.get("commonName", ""),
                "organization": issuer.get("organizationName", ""),
            },
            "serial_number": cert.get("serialNumber", ""),
            "version": cert.get("version", ""),
            "san": san_list,
            "cipher": {
                "name": cipher[0] if cipher else "",
                "protocol": cipher[1] if cipher else "",
                "bits": cipher[2] if cipher else 0,
            },
        }

    except ssl.SSLCertVerificationError as exc:
        return {"hostname": hostname, "valid": False, "error": f"SSL verification failed: {exc.reason}"}
    except ssl.SSLError as exc:
        return {"hostname": hostname, "valid": False, "error": f"SSL error: {str(exc)}"}
    except socket.timeout:
        return {"hostname": hostname, "error": "Connection timed out."}
    except socket.gaierror:
        return {"hostname": hostname, "error": "Could not resolve hostname."}
    except ConnectionRefusedError:
        return {"hostname": hostname, "error": "Connection refused on port 443."}
    except OSError as exc:
        return {"hostname": hostname, "error": f"Connection error: {str(exc)}"}
