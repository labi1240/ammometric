#!/usr/bin/env python3
"""
Shared helpers for the AmmoMetric DB loaders (catalog + offers).

Target: the AmmoMetric Neon Postgres DB (project hidden-field-05160309).
Connection is read from $NEON_DATABASE_URL (preferred) or $DATABASE_URL.
Use the DIRECT (non-pooler) endpoint for big loads if you hit pooler limits.

Dependency:  pip install "psycopg[binary]"   (psycopg 3)
"""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlparse

import psycopg  # psycopg 3


def connect():
    dsn = os.environ.get("NEON_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("Set NEON_DATABASE_URL (or DATABASE_URL) to the Neon connection string.")
    # psycopg 3 understands the libpq URI directly (sslmode/channel_binding query args ok).
    return psycopg.connect(dsn, autocommit=False)


_slug_strip = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    s = _slug_strip.sub("-", (text or "").lower()).strip("-")
    return s or "item"


_int_re = re.compile(r"-?\d[\d,]*")


def parse_int(val):
    """Extract a leading integer from messy strings ('1400', '200 Bx', '3 Rnd')."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    m = _int_re.search(str(val))
    return int(m.group(0).replace(",", "")) if m else None


_float_re = re.compile(r"-?\d[\d,]*\.?\d*")


def parse_float(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    m = _float_re.search(str(val))
    return float(m.group(0).replace(",", "")) if m else None


def domain_from_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host or None
    except Exception:
        return None


def batched(iterable, n):
    """Yield lists of up to n items from iterable."""
    buf = []
    for x in iterable:
        buf.append(x)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf


def iter_jsonl(path):
    import json
    with open(path, "r", encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as e:
                print(f"  ! {path}:{ln} bad JSON ({e}); skipped", file=sys.stderr)
