#!/usr/bin/env python3
"""
Canonical caliber resolution.

master_config.json is the single source of truth for caliber slugs (seo_name).
Raw caliber strings from the product feeds ("9mm", "308 Win", "223/5.56") are
messy, so we map them to a canonical seo_name via:
  1. an explicit ALIASES table (handles the high-frequency irregular forms), then
  2. a normalized exact match against master_config names + seo_names, then
  3. a "primary caliber" fallback for multi-caliber strings ("357 Mag, 38 Special").

Run standalone to print match-rate stats against the jsonl feeds:
  python3 caliber_resolver.py 1.jsonl 2.jsonl 3.jsonl
"""
from __future__ import annotations

import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
# master_config.json lives at the repo root (two levels up from scripts/db_loaders).
_MASTER = os.path.join(_HERE, "..", "..", "master_config.json")


def _norm(s: str) -> str:
    """Loose normalization: lowercase, drop noise words, strip non-alphanumerics."""
    s = (s or "").lower().strip()
    for noise in ("mm", "nato", "auto", "rimfire"):
        s = s.replace(noise, "")
    return re.sub(r"[^a-z0-9]+", "", s)


# Raw string (lowercased, stripped) -> canonical seo_name. Covers the
# high-frequency forms that normalization alone misses. For multi-caliber
# strings we pick the primary (first / most common) chambering.
ALIASES = {
    "9mm": "9mm-luger",
    "9 mm": "9mm-luger",
    "9mm luger": "9mm-luger",
    "223/5.56": "223-remington",
    "223 / 5.56": "223-remington",
    "5.56": "5.56x45mm-nato",
    "5.56 nato": "5.56x45mm-nato",
    "5.56x45": "5.56x45mm-nato",
    "308 win": "308-winchester",
    "308": "308-winchester",
    "380 acp": "380-auto",
    "380 auto": "380-auto",
    "300 blk": "300aac-blackout",
    "300 blackout": "300aac-blackout",
    "300 aac blackout": "300aac-blackout",
    "22 wmr": "22-magnum",
    "22 mag": "22-magnum",
    "45 long colt": "45-colt",
    "45 lc": "45-colt",
    "7mm-08": "7mm-08-remington",
    "338 lapua": "338-lapua-magnum",
    "357 mag, 38 special": "357-magnum",
    "357 mag": "357-magnum",
    "45-70 gov": "45-70",
    "45-70 govt": "45-70",
    "45-70 government": "45-70",
    "22 lr, 22 wmr": "22lr",
    "500 s&w": "500sw-magnum",
    "300 rem ultra mag": "300rum",
    "6.8 spc": "6.8mm-remington",
    "6.8mm spc": "6.8mm-remington",
    "50 ae": "50-action-express",
    "6.5-300 weatherby": "6.5-300-weatherby-magnum",
    "460 s&w": "460sw-magnum",
    "6.5x55 swedish mauser": "6.5x55mm",
    "6.5x55 swedish": "6.5x55mm",
    "6.5x55 swede": "6.5x55mm",
    "240 wby mag": "240-weatherby-magnum",
    "44-40 wcf": "44-40-winchester",
    "44-40": "44-40-winchester",
    "327 federal": "327-federal-magnum",
    "9x18mm makarov": "9mm-makarov",
    "9x18 makarov": "9mm-makarov",
    "44 mag, 44 special": "44-magnum",
    "44 mag": "44-magnum",
    "280 remington": "280-remington-ackley-improved",
    "270 wby mag": "270-weatherby-magnum",
    "45 long colt, 410 bore": "45-colt",
    "7mm wby mag": "7mm-weatherby-magnum",
    "32 h&r": "32hr-mag",
    "32 h&r mag": "32hr-mag",
    "30-378 wby mag": "30-378-weatherby-magnum",
    "6.5x284 norma": "6.5-284",
    "4.6x30mm h&k": "4.6x30mm",
    "4.6x30 h&k": "4.6x30mm",
    "6.5 wby rpm": "6.5-weatherby-rpm",
    "6.5 rpm": "6.5-weatherby-rpm",
    "38 special+p": "38-special",
    "38 spl": "38-special",
    "38 spl +p": "38-special",
    "9.3x62mm mauser": "9.3x62mm",
    "9.3x62 mauser": "9.3x62mm",
    "38-55 wcf": "38-55-winchester",
    "410 bore, 45 long colt": "410-bore",
    "338-378 wby mag": "338-378-weatherby-magnum",
    "357 mag, 9mm": "357-magnum",
    "338 wby rpm": "338-weatherby-rpm",
    "340 wby mag": "340-weatherby-magnum",
    "378 wby mag": "378-weatherby-magnum",
    "32-20 wcf": "32-20-winchester",
    "20 gauge, 28 gauge": "20-gauge",
    "45 long colt, 45 acp": "45-colt",
    "25-20 wcf": "25-20-winchester",
    "22 tcm, 9mm": "22tcm",
    "9mm, 22 tcm": "9mm-luger",
    "7.62x25mm": "7.62x25mm-tokarev",
    "7.62x25": "7.62x25mm-tokarev",
    "45 acp, 45 long colt": "45acp",
    "38 special, 357 mag": "38-special",
    "22 wmr, 410 bore": "22-magnum",
    "7.7x58mm jap": "7.7x58mm",
    "7.7x58 jap": "7.7x58mm",
    "460 wby mag": "460-weatherby-magnum",
    "375 rem ultra mag": "375rum",
    "416 wby mag": "416-weatherby-magnum",
    "224 wby mag": "224-weatherby-magnum",
    "17 fireball": "17-remington-fireball",
    "7.62 nagant": "7.62x38-nagant-revolver",
    "44 russian": "44sw-russian",
    "38-40": "38-40-winchester",
    "10mm, 40 s&w": "10mm-auto",
    "10mm": "10mm-auto",
    "44 special": "44-special",
    "6.5x57r": "6.5x57mm",
    "224 valkyrie": "224-valkyrie",
    "350 legend": "350-legend",
    "450 bushmaster": "450-bushmaster",
    "6.5 creedmoor": "6.5mm-creedmoor",
    "6.5 grendel": "6.5mm-grendel",
    "7.62x39": "7.62x39mm",
    "7.62x54r": "7.62x54r",
    "30-06": "30-06",
    "30-06 springfield": "30-06",
    "30 carbine": "30-carbine",
    "12 ga": "12-gauge",
    "20 ga": "20-gauge",
    "410 ga": "410-bore",
    "410": "410-bore",
    "28 ga": "28-gauge",
    "16 ga": "16-gauge",
}


class CaliberResolver:
    def __init__(self, master_path: str = _MASTER):
        with open(master_path, encoding="utf-8") as f:
            self.master = json.load(f)
        self.index: dict[str, str] = {}
        self.types: dict[str, str] = {}  # seo_name -> type
        for c in self.master:
            seo = c["seo_name"]
            self.index.setdefault(_norm(c["name"]), seo)
            self.index.setdefault(_norm(seo), seo)
            self.types[seo] = c["type"]
        # Pre-normalize alias keys for robust lookup.
        self.aliases = {k.lower().strip(): v for k, v in ALIASES.items()}

    def resolve(self, raw: str) -> str | None:
        """Return canonical seo_name for a raw caliber string, or None."""
        if not raw:
            return None
        r = raw.lower().strip()
        if r in self.aliases:
            return self.aliases[r]
        n = _norm(r)
        if n in self.index:
            return self.index[n]
        # Multi-caliber string: take the primary (first) chambering.
        parts = re.split(r"[,/]| or ", r)
        if len(parts) > 1:
            first = parts[0].strip()
            if first and first != r:
                return self.resolve(first)
        return None

    def canonical_calibers(self):
        """De-duplicated (seo_name, name, type) rows for seeding the Caliber table.

        master_config has a few duplicate seo_names; keep the first occurrence so
        the unique(slug) constraint is satisfied.
        """
        seen, rows = set(), []
        for c in self.master:
            seo = c["seo_name"]
            if seo in seen:
                continue
            seen.add(seo)
            rows.append((c["name"], seo, c["type"]))
        return rows


def _stats(paths):
    r = CaliberResolver()
    raw = {}
    for p in paths:
        try:
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                specs = obj.get("specs") or {}
                c = (specs.get("caliber") or specs.get("gauge") or "").strip()
                if c:
                    raw[c] = raw.get(c, 0) + 1
        except FileNotFoundError:
            print(f"!! {p} not found")
    total = sum(raw.values())
    matched = sum(n for c, n in raw.items() if r.resolve(c))
    print(f"distinct raw strings : {len(raw)}")
    print(f"products w/ caliber  : {total}")
    print(f"RESOLVED             : {matched} ({100*matched//max(total,1)}%)")
    print(f"canonical calibers   : {len(r.canonical_calibers())}")
    print("\n--- top remaining UNRESOLVED (by product count) ---")
    un = sorted(((n, c) for c, n in raw.items() if not r.resolve(c)), reverse=True)
    for n, c in un[:30]:
        print(f"  {n:6d}  {c!r}")


if __name__ == "__main__":
    _stats(sys.argv[1:] or ["1.jsonl", "2.jsonl", "3.jsonl"])
