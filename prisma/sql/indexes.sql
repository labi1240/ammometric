-- Performance indexes for AmmoMetric hot query paths.
--
-- This project uses the Prisma driver adapter (no `prisma migrate` workflow),
-- so indexes added to schema.prisma are NOT auto-applied. Run this file once
-- against the database after deploying the schema changes.
--
-- CONCURRENTLY avoids locking the tables, so this is safe to run on a live DB.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block — run
-- with psql directly (not wrapped in BEGIN/COMMIT):
--
--   psql "$DATABASE_URL" -f prisma/sql/indexes.sql
--
-- Index names match Prisma's default convention (<table>_<cols>_idx) so a
-- future `prisma db pull` stays consistent with schema.prisma.

-- CatalogItem: getProducts() filters by kind + offerCount and sorts by
-- bestCpr/bestPrice. These cover the two ORDER BY shapes used.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_kind_offerCount_bestCpr_bestPrice_idx"
  ON "CatalogItem" ("kind", "offerCount", "bestCpr", "bestPrice");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_kind_offerCount_bestPrice_idx"
  ON "CatalogItem" ("kind", "offerCount", "bestPrice");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_brandId_idx"
  ON "CatalogItem" ("brandId");

-- Offer: getOffers() filters by itemId and sorts by price.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Offer_itemId_price_idx"
  ON "Offer" ("itemId", "price");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Offer_retailerId_idx"
  ON "Offer" ("retailerId");

-- AmmoSpecs: caliber + grain filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AmmoSpecs_caliberId_idx"
  ON "AmmoSpecs" ("caliberId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AmmoSpecs_grain_idx"
  ON "AmmoSpecs" ("grain");

-- FirearmChamber: caliber filter (composite PK leads with firearmSpecsId).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FirearmChamber_caliberId_idx"
  ON "FirearmChamber" ("caliberId");
