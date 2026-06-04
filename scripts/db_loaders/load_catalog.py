#!/usr/bin/env python3
"""
Catalog loader — input product files (1/2/3.jsonl) -> CatalogItem + specs.

Run this BEFORE load_offers.py: offers FK to CatalogItem.id, so the catalog
must exist first. Re-runnable (idempotent upserts); run again whenever the
product list changes (new products, spec corrections).

Each input line:
  {"title","upc","url","image","specs":{...},"offers":[...]}
  - id  = top-level "upc"  (string, leading zeros preserved)
  - kind comes from the file label (AMMO / FIREARM / ACCESSORY)
  - "offers" in these files are IGNORED here; live offers come from load_offers.py

Usage:
  export NEON_DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require'
  python3 load_catalog.py --input 1.jsonl=AMMO 2.jsonl=FIREARM 3.jsonl=FIREARM
  python3 load_catalog.py --input 1.jsonl=AMMO --limit 500   # dry-ish test slice
"""
from __future__ import annotations

import argparse
import sys

from common import (batched, connect, domain_from_url, iter_jsonl, parse_float,
                    parse_int, slugify)

BATCH = 1000


def collect_dimensions(products):
    """First pass: distinct brand names and (slug,name,type) calibers."""
    brands, calibers = set(), {}
    for kind, p in products:
        specs = p.get("specs") or {}
        b = (specs.get("brand") or "").strip()
        if b:
            brands.add(b)
        c = (specs.get("caliber") or specs.get("gauge") or "").strip()
        if c:
            slug = slugify(c)
            ctype = "SHOTGUN" if "gauge" in c.lower() or "ga" in c.lower() else None
            calibers.setdefault(slug, (c, ctype))
    return brands, calibers


def upsert_brands(cur, brands):
    if not brands:
        return {}
    rows = [(b, slugify(b)) for b in brands]
    cur.executemany(
        'INSERT INTO "Brand"(name, slug) VALUES (%s,%s) ON CONFLICT (name) DO NOTHING',
        rows,
    )
    cur.execute('SELECT id, name FROM "Brand" WHERE name = ANY(%s)', (list(brands),))
    return {name: bid for bid, name in cur.fetchall()}


def upsert_calibers(cur, calibers):
    if not calibers:
        return {}
    rows = [(name, slug, ctype) for slug, (name, ctype) in calibers.items()]
    cur.executemany(
        'INSERT INTO "Caliber"(name, slug, type) VALUES (%s,%s,%s) '
        "ON CONFLICT (slug) DO NOTHING",
        rows,
    )
    slugs = list(calibers.keys())
    cur.execute('SELECT id, slug FROM "Caliber" WHERE slug = ANY(%s)', (slugs,))
    return {slug: cid for cid, slug in cur.fetchall()}


def upsert_items(cur, items):
    cur.executemany(
        """
        INSERT INTO "CatalogItem"
          (id, kind, slug, upc, mpn, title, image, "brandId", "updatedAt")
        VALUES (%(id)s, %(kind)s, %(slug)s, %(upc)s, %(mpn)s, %(title)s,
                %(image)s, %(brandId)s, now())
        ON CONFLICT (id) DO UPDATE SET
          kind=EXCLUDED.kind, title=EXCLUDED.title, image=EXCLUDED.image,
          mpn=EXCLUDED.mpn, "brandId"=EXCLUDED."brandId", "updatedAt"=now()
        """,
        items,
    )


def upsert_ammo(cur, rows):
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "AmmoSpecs"
          ("itemId","caliberId",grain,gauge,velocity,casing)
        VALUES (%(itemId)s,%(caliberId)s,%(grain)s,%(gauge)s,%(velocity)s,%(casing)s)
        ON CONFLICT ("itemId") DO UPDATE SET
          "caliberId"=EXCLUDED."caliberId", grain=EXCLUDED.grain,
          gauge=EXCLUDED.gauge, velocity=EXCLUDED.velocity, casing=EXCLUDED.casing
        """,
        rows,
    )


def upsert_firearm(cur, rows):
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "FirearmSpecs"
          ("itemId",manufacturer,model,"actionType","firearmType",capacity,
           finish,weight,"overallLength",sight,safety)
        VALUES (%(itemId)s,%(manufacturer)s,%(model)s,%(actionType)s,%(firearmType)s,
                %(capacity)s,%(finish)s,%(weight)s,%(overallLength)s,%(sight)s,%(safety)s)
        ON CONFLICT ("itemId") DO UPDATE SET
          manufacturer=EXCLUDED.manufacturer, model=EXCLUDED.model,
          "actionType"=EXCLUDED."actionType", "firearmType"=EXCLUDED."firearmType",
          capacity=EXCLUDED.capacity, finish=EXCLUDED.finish, weight=EXCLUDED.weight,
          "overallLength"=EXCLUDED."overallLength", sight=EXCLUDED.sight,
          safety=EXCLUDED.safety
        """,
        rows,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", nargs="+", required=True,
                    help='file=KIND pairs, e.g. 1.jsonl=AMMO 2.jsonl=FIREARM')
    ap.add_argument("--limit", type=int, default=0, help="cap rows per file (testing)")
    args = ap.parse_args()

    files = []
    for spec in args.input:
        path, _, kind = spec.partition("=")
        kind = (kind or "AMMO").upper()
        if kind not in ("AMMO", "FIREARM", "ACCESSORY"):
            sys.exit(f"bad kind '{kind}' for {path}")
        files.append((path, kind))

    # Load all products into memory (63k lines is fine) so we can do the
    # dimension pre-pass, then bulk-insert.
    products = []
    for path, kind in files:
        n = 0
        for p in iter_jsonl(path):
            if not p.get("upc"):
                continue
            products.append((kind, p))
            n += 1
            if args.limit and n >= args.limit:
                break
        print(f"read {n} from {path} ({kind})")

    conn = connect()
    with conn.cursor() as cur:
        brands, calibers = collect_dimensions(products)
        bmap = upsert_brands(cur, brands)
        cmap = upsert_calibers(cur, calibers)
        conn.commit()
        print(f"brands={len(bmap)} calibers={len(cmap)}")

        items, ammo, firearm = [], [], []
        total = 0
        for kind, p in products:
            specs = p.get("specs") or {}
            upc = str(p["upc"])
            brand_name = (specs.get("brand") or "").strip()
            items.append({
                "id": upc, "kind": kind,
                "slug": f"{slugify(p.get('title', upc))}-{upc}",
                "upc": upc, "mpn": specs.get("mpn"),
                "title": p.get("title") or upc, "image": p.get("image"),
                "brandId": bmap.get(brand_name),
            })
            cal = (specs.get("caliber") or specs.get("gauge") or "").strip()
            cid = cmap.get(slugify(cal)) if cal else None
            if kind == "AMMO" and cid:
                ammo.append({
                    "itemId": upc, "caliberId": cid,
                    "grain": parse_int(specs.get("grain")),
                    "gauge": specs.get("gauge"),
                    "velocity": parse_int(specs.get("muzzle_velocity") or specs.get("velocity")),
                    "casing": specs.get("material") or specs.get("casing"),
                })
            elif kind == "FIREARM":
                firearm.append({
                    "itemId": upc, "manufacturer": brand_name or None,
                    "model": specs.get("model"), "actionType": specs.get("action"),
                    "firearmType": (specs.get("type") or "")[:64] or None,
                    "capacity": specs.get("capacity"), "finish": specs.get("finish"),
                    "weight": specs.get("weight"),
                    "overallLength": specs.get("overall_length"),
                    "sight": specs.get("sight"), "safety": specs.get("safety"),
                })
            total += 1

        for chunk in batched(items, BATCH):
            upsert_items(cur, chunk)
        conn.commit()
        for chunk in batched(ammo, BATCH):
            upsert_ammo(cur, chunk)
        for chunk in batched(firearm, BATCH):
            upsert_firearm(cur, chunk)
        conn.commit()
        print(f"DONE items={total} ammo_specs={len(ammo)} firearm_specs={len(firearm)}")

    conn.close()


if __name__ == "__main__":
    main()
