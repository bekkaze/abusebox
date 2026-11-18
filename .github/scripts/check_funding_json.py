#!/usr/bin/env python3
"""Check site/funding.json against the rules FLOSS/Fund's crawler enforces.

The published JSON schema (fundingjson.org v1.1.0) leaves out several of the
limits the FLOSS/Fund portal applies when it crawls a manifest, most notably
the 500 limit on a plan's description. A manifest that passes the schema can
still be rejected, and the listing removed if it stays broken. These rules are
copied from the portal's validator, schemas/v1/schema.go and
common/validations.go in https://github.com/floss-fund/go-funding-json
(commit ecd6af9). Go's len() counts bytes, so lengths here are UTF-8 bytes,
not characters.

Usage: check_funding_json.py [path]   (default: site/funding.json)
"""

import json
import re
import sys

RE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
RE_TAG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

ENTITY_TYPES = {"individual", "group", "organisation", "other"}
ENTITY_ROLES = {"owner", "steward", "maintainer", "contributor", "other"}
CHANNEL_TYPES = {"bank", "payment-provider", "cheque", "cash", "other"}
PLAN_FREQUENCIES = {"one-time", "weekly", "fortnightly", "monthly", "yearly", "other"}
PLAN_STATUSES = {"active", "inactive"}

MAX_URL_LEN = 250

errors = []


def nbytes(value):
    return len((value or "").encode("utf-8"))


def length(tag, value, lo, hi):
    n = nbytes(value)
    if not lo <= n <= hi:
        errors.append(f"`{tag}` should be of length {lo} - {hi} (is {n} bytes)")


def count(tag, items, lo, hi):
    n = len(items or [])
    if not lo <= n <= hi:
        errors.append(f"`{tag}` should have {lo} - {hi} items (has {n})")


def number(tag, value, lo, hi):
    if not isinstance(value, (int, float)) or not lo <= value <= hi:
        errors.append(f"`{tag}` should be a number in {lo} - {hi} (is {value!r})")


def one_of(tag, value, allowed):
    if value not in allowed:
        errors.append(f"`{tag}` should be one of {sorted(allowed)} (is {value!r})")


def ident(tag, value):
    length(tag, value, 3, 32)
    if not RE_ID.match(value or ""):
        errors.append(f"`{tag}` should be lowercase letters, digits and hyphens (is {value!r})")


def url(tag, obj):
    if not obj:
        return
    for key in ("url", "wellKnown"):
        if obj.get(key):
            length(f"{tag}.{key}", obj[key], 1, MAX_URL_LEN)


def unique(tag, ids):
    if len(set(ids)) != len(ids):
        errors.append(f"`{tag}` must be unique")


def check(m):
    e = m.get("entity") or {}
    one_of("entity.type", e.get("type"), ENTITY_TYPES)
    one_of("entity.role", e.get("role"), ENTITY_ROLES)
    length("entity.name", e.get("name"), 2, 250)
    length("entity.email", e.get("email"), 1, 250)
    if not RE_EMAIL.match(e.get("email") or ""):
        errors.append(f"`entity.email` is not an email address (is {e.get('email')!r})")
    length("entity.description", e.get("description"), 5, 2000)
    url("entity.webpageUrl", e.get("webpageUrl"))

    projects = m.get("projects") or []
    count("projects", projects, 1, 30)
    for p in projects:
        g = p.get("guid")
        ident(f"projects[{g}].guid", g)
        length(f"projects[{g}].name", p.get("name"), 1, 250)
        length(f"projects[{g}].description", p.get("description"), 5, 2000)
        url(f"projects[{g}].webpageUrl", p.get("webpageUrl"))
        url(f"projects[{g}].repositoryUrl", p.get("repositoryUrl"))
        licenses = p.get("licenses") or []
        count(f"projects[{g}].licenses", licenses, 1, 5)
        for lic in licenses:
            length(f"projects[{g}].licenses", lic, 2, 64)
        tags = p.get("tags") or []
        count(f"projects[{g}].tags", tags, 1, 10)
        for i, t in enumerate(tags):
            length(f"projects[{g}].tags[{i}]", t, 2, 32)
            if not RE_TAG.match(t or ""):
                errors.append(f"`projects[{g}].tags[{i}]` should be lowercase words joined by hyphens (is {t!r})")
    unique("projects[].guid", [p.get("guid") for p in projects])

    funding = m.get("funding") or {}

    channels = funding.get("channels") or []
    count("funding.channels", channels, 1, 10)
    for c in channels:
        g = c.get("guid")
        ident(f"channels[{g}].guid", g)
        one_of(f"channels[{g}].type", c.get("type"), CHANNEL_TYPES)
        length(f"channels[{g}].address", c.get("address"), 0, 250)
        length(f"channels[{g}].description", c.get("description"), 0, 500)
    channel_ids = [c.get("guid") for c in channels]
    unique("channels[].guid", channel_ids)

    plans = funding.get("plans") or []
    count("funding.plans", plans, 1, 10)
    for p in plans:
        g = p.get("guid")
        ident(f"plans[{g}].guid", g)
        one_of(f"plans[{g}].status", p.get("status"), PLAN_STATUSES)
        length(f"plans[{g}].name", p.get("name"), 3, 250)
        length(f"plans[{g}].description", p.get("description"), 0, 500)
        number(f"plans[{g}].amount", p.get("amount"), 0, 1_000_000_000)
        one_of(f"plans[{g}].frequency", p.get("frequency"), PLAN_FREQUENCIES)
        for ch in p.get("channels") or []:
            if ch not in channel_ids:
                errors.append(f"`plans[{g}].channels` names unknown channel {ch!r}")

    history = funding.get("history") or []
    count("funding.history", history, 0, 50)
    for i, h in enumerate(history):
        number(f"history[{i}].year", h.get("year"), 1970, 2075)
        number(f"history[{i}].income", h.get("income"), 0, 1_000_000_000)
        number(f"history[{i}].expenses", h.get("expenses"), 0, 1_000_000_000)
        length(f"history[{i}].description", h.get("description"), 0, 500)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "site/funding.json"
    try:
        with open(path, encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, ValueError) as exc:
        print(f"{path}: cannot read: {exc}", file=sys.stderr)
        return 1

    check(manifest)
    if errors:
        for err in errors:
            print(f"{path}: {err}", file=sys.stderr)
        print(f"{len(errors)} problem(s); FLOSS/Fund would reject this manifest.", file=sys.stderr)
        return 1
    print(f"{path}: passes FLOSS/Fund's validation rules")
    return 0


if __name__ == "__main__":
    sys.exit(main())
