#!/usr/bin/env python3
"""
Catalog loader — product files (1/2/3.jsonl) -> CatalogItem + rich specs.

Run BEFORE load_offers.py (offers FK to CatalogItem.id). Idempotent upserts.

What it does now (vs. the old version):
  - Calibers seeded from master_config.json (canonical seo_name slugs), and raw
    product caliber strings resolved to them via caliber_resolver (~99% match).
  - Captures the FULL cleaned spec object into the new `specs` JSONB column on
    AmmoSpecs/FirearmSpecs (lossless — every SEO field), in addition to the
    typed columns used for filtering.
  - Writes FirearmChamber rows so firearm caliber pages/filters work.

NOTE on kind: kept from the file label (no FIREARM->ACCESSORY reclassification),
because there's no /accessory route yet — flipping kind would orphan those PDPs.

Usage:
  export DATABASE_URL='postgresql://...'        # or NEON_DATABASE_URL
  python3 load_catalog.py --input 1.jsonl=AMMO 2.jsonl=FIREARM 3.jsonl=FIREARM
  python3 load_catalog.py --input 1.jsonl=AMMO --limit 500 --dry-run   # stats only
"""
from __future__ import annotations

import argparse
import sys

from caliber_resolver import CaliberResolver
from common import batched, iter_jsonl, parse_int, slugify

BATCH = 1000


def clean_specs(specs: dict) -> dict:
    """Drop empty values from the raw spec object before storing as JSONB."""
    return {k: v for k, v in (specs or {}).items() if v not in (None, "", [], {})}


def truthy_kw(*vals) -> str:
    return " ".join(str(v) for v in vals if v).lower()


# ---- dimension seeding ------------------------------------------------------

def seed_calibers(cur, resolver: CaliberResolver):
    """Upsert the canonical caliber list; return {seo_name: caliberId}."""
    rows = resolver.canonical_calibers()  # (name, seo_name, type)
    cur.executemany(
        'INSERT INTO "Caliber"(name, slug, type) VALUES (%s,%s,%s) '
        'ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type',
        rows,
    )
    cur.execute('SELECT id, slug FROM "Caliber"')
    return {slug: cid for cid, slug in cur.fetchall()}


def upsert_brands(cur, brands):
    """Upsert brands; return {slug: id}. Keyed by slug because distinct brand
    names can collide on slug (e.g. 'A-Zoom' / 'A Zoom' -> 'a-zoom')."""
    if not brands:
        return {}
    # Dedupe by slug so one name wins per slug, and DO NOTHING catches any
    # remaining name/slug unique conflict.
    rows = list({slugify(b): (b, slugify(b)) for b in sorted(brands)}.values())
    cur.executemany(
        'INSERT INTO "Brand"(name, slug) VALUES (%s,%s) ON CONFLICT DO NOTHING',
        rows,
    )
    cur.execute('SELECT id, slug FROM "Brand"')
    return {slug: bid for bid, slug in cur.fetchall()}


# ---- row builders -----------------------------------------------------------

def build_rows(products, resolver, bmap, cmap):
    """Return (items, ammo, firearm, accessory, chambers, stats)."""
    # Jsonb is only needed for real DB writes; keep dry-run free of psycopg.
    Jsonb = None
    if cmap is not None:
        from psycopg.types.json import Jsonb

    items, ammo, firearm, accessory, chambers = [], [], [], [], []
    stats = {"AMMO": 0, "FIREARM": 0, "ACCESSORY": 0, "caliber_hit": 0, "caliber_miss": 0}

    for kind, p in products:
        specs = p.get("specs") or {}
        upc = str(p["upc"])
        brand_name = (specs.get("brand") or "").strip()
        blob = clean_specs(specs)
        jblob = Jsonb(blob) if cmap is not None else blob  # plain dict in dry-run

        items.append({
            "id": upc, "kind": kind,
            "slug": f"{slugify(p.get('title', upc))}-{upc}",
            "upc": upc, "mpn": specs.get("mpn"),
            "title": p.get("title") or upc, "image": p.get("image"),
            "brandId": bmap.get(slugify(brand_name)) if (bmap is not None and brand_name) else None,
        })

        raw_cal = (specs.get("caliber") or specs.get("gauge") or "").strip()
        seo = resolver.resolve(raw_cal) if raw_cal else None
        if raw_cal:
            stats["caliber_hit" if seo else "caliber_miss"] += 1
        cid = cmap.get(seo) if (cmap is not None and seo) else (seo if cmap is None else None)

        stats[kind] = stats.get(kind, 0) + 1

        if kind == "AMMO":
            casing = specs.get("case_material") or specs.get("material") or specs.get("bullet_casing")
            ammo.append({
                "itemId": upc, "caliberId": (cid if cmap is not None else None),
                "grain": parse_int(specs.get("bullet_weight") or specs.get("grain")),
                "gauge": specs.get("gauge"),
                "velocity": parse_int(specs.get("muzzle_velocity") or specs.get("velocity")),
                "energy": parse_int(specs.get("muzzle_energy")),
                "casing": casing,
                "bulletType": specs.get("bullet_type"),
                "isSteelCase": "steel" in truthy_kw(specs.get("case_material"), specs.get("material")),
                "isRemanufactured": "reman" in truthy_kw(specs.get("condition"), p.get("title")),
                "isSubsonic": "subsonic" in truthy_kw(specs.get("bullet_extra"), specs.get("features"), p.get("title")),
                "specs": jblob,
                "_seo": seo,
            })
        elif kind == "ACCESSORY":
            accessory.append({
                "itemId": upc,
                "material": specs.get("material"),
                "color": specs.get("finish") or specs.get("color"),
                "notes": specs.get("features") or specs.get("description"),
                "specs": jblob,
            })
        else:  # FIREARM
            firearm.append({
                "itemId": upc, "manufacturer": brand_name or None,
                "model": specs.get("model"), "actionType": specs.get("action"),
                "firearmType": (specs.get("type") or "")[:64] or None,
                "capacity": specs.get("capacity"), "finish": specs.get("finish"),
                "weight": specs.get("weight"),
                "overallLength": specs.get("overall_length"),
                "features": specs.get("features"),
                "sight": specs.get("sight"), "safety": specs.get("safety"),
                "isThreaded": "thread" in truthy_kw(specs.get("muzzle")),
                "specs": jblob,
                "_seo": seo,  # for FirearmChamber after we know specId
            })

    return items, ammo, firearm, accessory, chambers, stats


# ---- DB writers -------------------------------------------------------------

def upsert_items(cur, rows):
    cur.executemany(
        """
        INSERT INTO "CatalogItem"
          (id, kind, slug, upc, mpn, title, image, "brandId", "updatedAt")
        VALUES (%(id)s,%(kind)s,%(slug)s,%(upc)s,%(mpn)s,%(title)s,%(image)s,%(brandId)s, now())
        ON CONFLICT (id) DO UPDATE SET
          kind=EXCLUDED.kind, title=EXCLUDED.title, image=EXCLUDED.image,
          mpn=EXCLUDED.mpn, "brandId"=EXCLUDED."brandId", "updatedAt"=now()
        """, rows)


def upsert_ammo(cur, rows):
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "AmmoSpecs"
          ("itemId","caliberId",grain,gauge,velocity,energy,casing,"bulletType",
           "isSteelCase","isRemanufactured","isSubsonic",specs)
        VALUES (%(itemId)s,%(caliberId)s,%(grain)s,%(gauge)s,%(velocity)s,%(energy)s,
                %(casing)s,%(bulletType)s,%(isSteelCase)s,%(isRemanufactured)s,%(isSubsonic)s,%(specs)s)
        ON CONFLICT ("itemId") DO UPDATE SET
          "caliberId"=EXCLUDED."caliberId", grain=EXCLUDED.grain, gauge=EXCLUDED.gauge,
          velocity=EXCLUDED.velocity, energy=EXCLUDED.energy, casing=EXCLUDED.casing,
          "bulletType"=EXCLUDED."bulletType", "isSteelCase"=EXCLUDED."isSteelCase",
          "isRemanufactured"=EXCLUDED."isRemanufactured", "isSubsonic"=EXCLUDED."isSubsonic",
          specs=EXCLUDED.specs
        """, [{k: v for k, v in r.items() if k != "_seo"} for r in rows])


def upsert_firearm(cur, rows):
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "FirearmSpecs"
          ("itemId",manufacturer,model,"actionType","firearmType",capacity,finish,
           weight,"overallLength",features,sight,safety,"isThreaded",specs)
        VALUES (%(itemId)s,%(manufacturer)s,%(model)s,%(actionType)s,%(firearmType)s,
                %(capacity)s,%(finish)s,%(weight)s,%(overallLength)s,%(features)s,
                %(sight)s,%(safety)s,%(isThreaded)s,%(specs)s)
        ON CONFLICT ("itemId") DO UPDATE SET
          manufacturer=EXCLUDED.manufacturer, "actionType"=EXCLUDED."actionType",
          "firearmType"=EXCLUDED."firearmType", capacity=EXCLUDED.capacity,
          finish=EXCLUDED.finish, weight=EXCLUDED.weight, "overallLength"=EXCLUDED."overallLength",
          features=EXCLUDED.features, sight=EXCLUDED.sight, safety=EXCLUDED.safety,
          "isThreaded"=EXCLUDED."isThreaded", specs=EXCLUDED.specs
        """, [{k: v for k, v in r.items() if k != "_seo"} for r in rows])


def upsert_accessory(cur, rows):
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "AccessorySpecs" ("itemId",material,color,notes,specs)
        VALUES (%(itemId)s,%(material)s,%(color)s,%(notes)s,%(specs)s)
        ON CONFLICT ("itemId") DO UPDATE SET
          material=EXCLUDED.material, color=EXCLUDED.color, notes=EXCLUDED.notes,
          specs=EXCLUDED.specs
        """, rows)


def write_firearm_chambers(cur, firearm_rows, cmap):
    """Link firearms to calibers via FirearmChamber (uses FirearmSpecs.id)."""
    want = {r["itemId"]: cmap.get(r["_seo"]) for r in firearm_rows if r.get("_seo") and cmap.get(r["_seo"])}
    if not want:
        return 0
    item_ids = list(want.keys())
    spec_id = {}
    for chunk in batched(item_ids, 5000):
        cur.execute('SELECT id, "itemId" FROM "FirearmSpecs" WHERE "itemId" = ANY(%s)', (chunk,))
        for sid, iid in cur.fetchall():
            spec_id[iid] = sid
    rows = [(spec_id[iid], cid) for iid, cid in want.items() if iid in spec_id]
    for chunk in batched(rows, BATCH):
        cur.executemany(
            'INSERT INTO "FirearmChamber"("firearmSpecsId","caliberId") VALUES (%s,%s) '
            'ON CONFLICT DO NOTHING', chunk)
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", nargs="+", required=True, help='file=KIND, e.g. 1.jsonl=AMMO')
    ap.add_argument("--limit", type=int, default=0, help="cap rows per file (testing)")
    ap.add_argument("--dry-run", action="store_true", help="extract + report, no DB writes")
    args = ap.parse_args()

    files = []
    for spec in args.input:
        path, _, kind = spec.partition("=")
        kind = (kind or "AMMO").upper()
        if kind not in ("AMMO", "FIREARM", "ACCESSORY"):
            sys.exit(f"bad kind '{kind}' for {path}")
        files.append((path, kind))

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

    resolver = CaliberResolver()
    brands = {(p.get("specs") or {}).get("brand", "").strip()
              for _, p in products if (p.get("specs") or {}).get("brand", "").strip()}

    if args.dry_run:
        items, ammo, firearm, accessory, _, stats = build_rows(products, resolver, None, None)
        print(f"\n[DRY-RUN] items={len(items)} ammo={len(ammo)} firearm={len(firearm)} "
              f"accessory={len(accessory)} brands={len(brands)}")
        tot = stats["caliber_hit"] + stats["caliber_miss"]
        print(f"caliber resolved: {stats['caliber_hit']}/{tot} "
              f"({100*stats['caliber_hit']//max(tot,1)}%)")
        _print_samples(ammo, firearm, accessory)
        return

    from common import connect
    conn = connect()
    with conn.cursor() as cur:
        cmap = seed_calibers(cur, resolver)
        bmap = upsert_brands(cur, brands)
        conn.commit()
        print(f"calibers={len(cmap)} brands={len(bmap)}")

        items, ammo, firearm, accessory, _, stats = build_rows(products, resolver, bmap, cmap)
        for chunk in batched(items, BATCH):
            upsert_items(cur, chunk)
        conn.commit()
        for chunk in batched(ammo, BATCH):
            upsert_ammo(cur, chunk)
        for chunk in batched(firearm, BATCH):
            upsert_firearm(cur, chunk)
        for chunk in batched(accessory, BATCH):
            upsert_accessory(cur, chunk)
        conn.commit()
        n_ch = write_firearm_chambers(cur, firearm, cmap)
        conn.commit()
        print(f"DONE items={len(items)} ammo={len(ammo)} firearm={len(firearm)} "
              f"accessory={len(accessory)} chambers={n_ch} "
              f"caliber_resolved={stats['caliber_hit']}/{stats['caliber_hit']+stats['caliber_miss']}")
    conn.close()


def _print_samples(ammo, firearm, accessory):
    import json
    for label, rows in (("AMMO", ammo), ("FIREARM", firearm), ("ACCESSORY", accessory)):
        if not rows:
            continue
        r = dict(rows[0])
        print(f"\n--- sample {label} typed fields ---")
        for k, v in r.items():
            if k == "specs":
                continue
            print(f"  {k}: {v!r}")
        print(f"  specs(JSONB) keys: {sorted((r.get('specs') or {}).keys())}")


if __name__ == "__main__":
    main()
