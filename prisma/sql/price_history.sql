-- ============================================================================
-- AmmoMetric · Price-history optimizations (Postgres / Neon)
-- ============================================================================
-- Run order: apply this AFTER the schema (Offer, OfferHistory, Retailer) and
-- data have been migrated into the target database.
--
--   bunx prisma db execute --file prisma/sql/price_history.sql --schema prisma/schema.prisma
--   # or:  psql "$DATABASE_URL" -f prisma/sql/price_history.sql
--
-- It is idempotent — safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. INSERT-ONLY-ON-CHANGE  (enforced at the DB, scraper-agnostic)
-- ----------------------------------------------------------------------------
-- Your scraper upserts/updates Offer rows in place (natural key:
-- itemId+retailerId+unitsCount+currency). This trigger writes an OfferHistory
-- row ONLY when price or stock actually changed — not on every scrape.
--
-- IMPORTANT: if your scraper currently inserts OfferHistory rows itself, REMOVE
-- that code once this trigger is live, or you will double-record every change.

CREATE OR REPLACE FUNCTION record_offer_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR (NEW.price IS DISTINCT FROM OLD.price)
     OR (COALESCE(NEW."inStock", true) IS DISTINCT FROM COALESCE(OLD."inStock", true))
  THEN
    INSERT INTO "OfferHistory" (time, "offerId", price, "unitPrice", "inStock")
    VALUES (now(), NEW.id, NEW.price, NEW."unitPrice", COALESCE(NEW."inStock", true));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS offer_price_change ON "Offer";
CREATE TRIGGER offer_price_change
  AFTER INSERT OR UPDATE ON "Offer"
  FOR EACH ROW
  EXECUTE FUNCTION record_offer_price_change();


-- ----------------------------------------------------------------------------
-- 2. DAILY ROLLUP MATERIALIZED VIEW  (precomputed; refreshed by Vercel Cron)
-- ----------------------------------------------------------------------------
-- Replaces the per-request date_trunc('day') GROUP BY in getPriceHistory().
-- One row per (item, retailer, day) holding that day's lowest price.

DROP MATERIALIZED VIEW IF EXISTS offer_price_daily;
CREATE MATERIALIZED VIEW offer_price_daily AS
SELECT
  o."itemId"                  AS item_id,
  o."retailerId"              AS retailer_id,
  r.name                      AS retailer_name,
  date_trunc('day', oh.time)  AS day,
  MIN(oh.price)               AS min_price,
  MIN(oh."unitPrice")         AS min_unit_price
FROM "OfferHistory" oh
JOIN "Offer"    o ON oh."offerId" = o.id
JOIN "Retailer" r ON o."retailerId" = r.id
GROUP BY o."itemId", o."retailerId", r.name, date_trunc('day', oh.time);

-- REFRESH ... CONCURRENTLY requires a UNIQUE index. (item_id, retailer_id, day)
-- is unique because retailer_name is functionally dependent on retailer_id.
CREATE UNIQUE INDEX IF NOT EXISTS offer_price_daily_pk
  ON offer_price_daily (item_id, retailer_id, day);

-- Read path filters by item_id and orders by day:
CREATE INDEX IF NOT EXISTS offer_price_daily_item_day
  ON offer_price_daily (item_id, day);


-- ----------------------------------------------------------------------------
-- 3. MONTHLY PARTITIONING  (DEFERRED — do NOT run yet)
-- ----------------------------------------------------------------------------
-- Only worth it once OfferHistory grows large (tens of millions of rows). At
-- 63k offers with insert-on-change you are far from this. When you get there,
-- partitioning by month gives O(1) retention (DROP old months) and small,
-- fast indexes. Retrofitting a partitioned table requires a table swap, so the
-- sketch below is the migration shape — left commented on purpose.
--
-- CREATE TABLE "OfferHistory_p" (
--   time      timestamptz NOT NULL DEFAULT now(),
--   "offerId" integer     NOT NULL,
--   price     double precision NOT NULL,
--   "unitPrice" double precision,
--   "inStock" boolean     NOT NULL
-- ) PARTITION BY RANGE (time);
--
-- CREATE INDEX ON "OfferHistory_p" ("offerId", time DESC);
-- -- one partition per month, created ahead of time (or via pg_partman):
-- CREATE TABLE "OfferHistory_2026_06" PARTITION OF "OfferHistory_p"
--   FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- -- ... backfill from old table, then rename swap.
-- -- Retention later is just:  DROP TABLE "OfferHistory_2025_12";
