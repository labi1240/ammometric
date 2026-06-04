#!/usr/bin/env python3
"""
Daily offers loader — offers_<date>.jsonl  ->  Retailer + Offer.

Pipeline position:
  scrape_offers.py  ->  offers_<date>.jsonl  ->  [THIS]  ->  Offer (upsert)
                                                              │ AFTER trigger
                                                              ▼  (price/stock change only)
                                                         OfferHistory  ->  offer_price_daily (MV)

This loader DOES NOT write OfferHistory. The DB trigger record_offer_price_change
(prisma/sql/price_history.sql) records a history row only when price or stock
actually changes. Inserting history here too would double-count — don't.

Snapshot record shape (change-detection output):
  new / changed:  {"upc": "...", "status": "changed", "fetched_at": "...",
                   "offers": [ {store,url,price,ppr,in_stock,stock_label,
                                shipping_raw,shipping_cost,shipping_free}, ... ]}
  unchanged:      a tiny marker with no offers (status "unchanged") -> skipped

If scrape_offers.py uses different key names, adjust the CONFIG block below —
that's the only place field names are wired.

Usage:
  export NEON_DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require'
  python3 load_offers.py --snapshot offers_2026-06-04.jsonl
  python3 load_offers.py --snapshot offers_2026-06-04.jsonl --no-refresh   # skip MV refresh
"""
from __future__ import annotations

import argparse
import sys

from common import batched, connect, domain_from_url, iter_jsonl, parse_float

# ---- CONFIG: field names from scrape_offers.py output ----------------------
K_UPC = ("upc", "id", "barcode", "key")        # product key (tried in order)
K_OFFERS = "offers"
K_STATUS = ("status", "state", "change")
K_FETCHED = ("fetched_at", "fetchedAt", "ts")
O_STORE, O_URL, O_PRICE, O_PPR = "store", "url", "price", "ppr"
O_INSTOCK = "in_stock"
O_SHIP_COST, O_SHIP_FREE, O_SHIP_RAW = "shipping_cost", "shipping_free", "shipping_raw"
# ---------------------------------------------------------------------------

BATCH = 1000


def first(d, keys):
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def build_offer_rows(snapshot_path):
    """Yield (touched_items, offer_rows, retailer_names). One pass, in memory."""
    touched, rows, retailers = set(), [], set()
    skipped_unchanged = 0
    for line in iter_jsonl(snapshot_path):
        upc = first(line, K_UPC)
        if upc is None:
            continue
        upc = str(upc)
        status = (first(line, K_STATUS) or "").lower()
        offers = line.get(K_OFFERS)
        # Unchanged marker (no authoritative offer set) -> leave existing rows alone.
        if status == "unchanged" or offers is None:
            skipped_unchanged += 1
            continue
        fetched = first(line, K_FETCHED)
        touched.add(upc)  # authoritative: even an empty list means "all gone"
        for o in offers:
            store = (o.get(O_STORE) or "").strip()
            if not store:
                continue
            retailers.add(store)
            price = parse_float(o.get(O_PRICE))
            if price is None:
                continue
            free = bool(o.get(O_SHIP_FREE))
            ship = 0.0 if free else parse_float(o.get(O_SHIP_COST))
            total = price + ship if ship is not None else None
            rows.append({
                "itemId": upc, "store": store, "url": o.get(O_URL),
                "inStock": bool(o.get(O_INSTOCK)), "price": price,
                "shippingCost": parse_float(o.get(O_SHIP_COST)),
                "total": total, "freeShipping": free,
                "shippingNote": o.get(O_SHIP_RAW),
                "fetched": fetched, "unitPrice": parse_float(o.get(O_PPR)),
            })
    return touched, rows, retailers, skipped_unchanged


def upsert_retailers(cur, names):
    if not names:
        return {}
    cur.executemany(
        'INSERT INTO "Retailer"(name) VALUES (%s) ON CONFLICT (name) DO NOTHING',
        [(n,) for n in names],
    )
    cur.execute('SELECT id, name FROM "Retailer" WHERE name = ANY(%s)', (list(names),))
    return {name: rid for rid, name in cur.fetchall()}


OFFER_UPSERT = """
INSERT INTO "Offer"
  ("itemId","retailerId",url,"inStock",price,currency,"shippingCost",total,
   "freeShipping","shippingNote","shippingUpdatedAt","unitsCount","unitLabel",
   "unitPrice","lastSeen")
VALUES (%(itemId)s,%(retailerId)s,%(url)s,%(inStock)s,%(price)s,'USD',
        %(shippingCost)s,%(total)s,%(freeShipping)s,%(shippingNote)s,
        %(fetched)s,1,'each',%(unitPrice)s, COALESCE(%(fetched)s, now()))
ON CONFLICT ("itemId","retailerId","unitsCount","currency") DO UPDATE SET
  url=EXCLUDED.url, price=EXCLUDED.price, "inStock"=EXCLUDED."inStock",
  "shippingCost"=EXCLUDED."shippingCost", total=EXCLUDED.total,
  "freeShipping"=EXCLUDED."freeShipping", "shippingNote"=EXCLUDED."shippingNote",
  "shippingUpdatedAt"=EXCLUDED."shippingUpdatedAt", "unitPrice"=EXCLUDED."unitPrice",
  "lastSeen"=EXCLUDED."lastSeen",
  "lastStockChange"=CASE WHEN "Offer"."inStock" IS DISTINCT FROM EXCLUDED."inStock"
                         THEN now() ELSE "Offer"."lastStockChange" END
"""

# Soft-OOS offers that vanished from a touched item's current snapshot.
SOFT_OOS = """
UPDATE "Offer" o SET "inStock"=false,
  "lastStockChange"=CASE WHEN o."inStock" THEN now() ELSE o."lastStockChange" END
WHERE o."itemId" IN (SELECT item FROM _touched)
  AND o."inStock"=true
  AND NOT EXISTS (SELECT 1 FROM _present p
                  WHERE p.item=o."itemId" AND p.ret=o."retailerId")
"""

# Recompute CatalogItem denormalized best-* / offerCount for touched items.
RECOMPUTE = """
WITH a AS (
  SELECT "itemId" item, count(*) cnt FROM "Offer"
  WHERE "inStock"=true AND "itemId" IN (SELECT item FROM _touched)
  GROUP BY "itemId"
),
b AS (
  SELECT DISTINCT ON (o."itemId")
    o."itemId" item, o.price, o."retailerId" rid, r.name rname, o."unitPrice" cpr,
    CASE WHEN o.total IS NOT NULL AND COALESCE(o."unitsCount",1)>0
         THEN o.total/COALESCE(o."unitsCount",1) ELSE o."unitPrice" END cpr_shipped
  FROM "Offer" o JOIN "Retailer" r ON r.id=o."retailerId"
  WHERE o."inStock"=true AND o."itemId" IN (SELECT item FROM _touched)
  ORDER BY o."itemId", o.price ASC
)
UPDATE "CatalogItem" c SET
  "offerCount"      = COALESCE(a.cnt, 0),
  "bestPrice"       = b.price,
  "bestRetailerId"  = b.rid,
  "bestRetailerName"= b.rname,
  "bestCpr"         = b.cpr,
  "bestCprShipped"  = b.cpr_shipped,
  "updatedAt"       = now()
FROM _touched t
LEFT JOIN a ON a.item = t.item
LEFT JOIN b ON b.item = t.item
WHERE c.id = t.item
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", required=True, help="offers_<date>.jsonl path")
    ap.add_argument("--no-refresh", action="store_true",
                    help="skip REFRESH of offer_price_daily MV")
    args = ap.parse_args()

    touched, rows, retailer_names, skipped = build_offer_rows(args.snapshot)
    print(f"parsed: touched_items={len(touched)} offers={len(rows)} "
          f"retailers={len(retailer_names)} skipped_unchanged={skipped}")
    if not touched:
        print("nothing to load."); return

    conn = connect()
    with conn.cursor() as cur:
        rmap = upsert_retailers(cur, retailer_names)
        conn.commit()

        # Resolve retailer ids; drop offers whose item isn't in the catalog
        # (FK would reject them anyway) and count them.
        cur.execute('SELECT id FROM "CatalogItem" WHERE id = ANY(%s)', (list(touched),))
        known_items = {r[0] for r in cur.fetchall()}
        missing = touched - known_items
        if missing:
            print(f"  ! {len(missing)} items not in catalog (run load_catalog.py first); "
                  f"their offers are skipped")

        ready = [
            {**r, "retailerId": rmap[r["store"]]}
            for r in rows
            if r["itemId"] in known_items and r["store"] in rmap
        ]

        # Stage present (item,retailer) pairs + touched items for OOS/recompute.
        cur.execute('CREATE TEMP TABLE _present(item text, ret int) ON COMMIT DROP')
        cur.execute('CREATE TEMP TABLE _touched(item text PRIMARY KEY) ON COMMIT DROP')
        cur.executemany('INSERT INTO _touched VALUES (%s) ON CONFLICT DO NOTHING',
                        [(i,) for i in known_items])
        cur.executemany('INSERT INTO _present VALUES (%s,%s)',
                        [(r["itemId"], r["retailerId"]) for r in ready])

        for chunk in batched(ready, BATCH):
            cur.executemany(OFFER_UPSERT, chunk)
        print(f"upserted {len(ready)} offers")

        cur.execute(SOFT_OOS)
        print(f"soft-OOS removed offers: {cur.rowcount}")
        cur.execute(RECOMPUTE)
        print(f"recomputed CatalogItem rows: {cur.rowcount}")
        conn.commit()

    if not args.no_refresh:
        conn.autocommit = True
        with conn.cursor() as cur:
            try:
                cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY offer_price_daily")
                print("refreshed offer_price_daily (concurrently)")
            except Exception:
                cur.execute("REFRESH MATERIALIZED VIEW offer_price_daily")
                print("refreshed offer_price_daily")
    conn.close()


if __name__ == "__main__":
    main()
