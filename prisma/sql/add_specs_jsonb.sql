-- Add a JSONB `specs` column to each spec table to losslessly store the full
-- cleaned spec object from the product feeds (every SEO-relevant field), in
-- addition to the typed columns used for filtering/sorting.
--
-- Additive and safe to run on a live DB (no locks of consequence; ADD COLUMN
-- with no default is metadata-only in Postgres). Run once:
--   psql "$DATABASE_URL" -f prisma/sql/add_specs_jsonb.sql
-- (Works through PgBouncer — these are plain ALTERs, not CONCURRENTLY.)

ALTER TABLE "AmmoSpecs"      ADD COLUMN IF NOT EXISTS "specs" jsonb;
ALTER TABLE "FirearmSpecs"   ADD COLUMN IF NOT EXISTS "specs" jsonb;
ALTER TABLE "AccessorySpecs" ADD COLUMN IF NOT EXISTS "specs" jsonb;
