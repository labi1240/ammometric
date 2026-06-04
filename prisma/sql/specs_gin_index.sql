-- GIN indexes on the specs JSONB columns to accelerate spec-based filtering
-- (e.g. shot_size, shot_material). jsonb_path_ops is compact and fast for the
-- containment/path-equality queries Prisma generates.
--
--   psql "$DATABASE_URL" -f prisma/sql/specs_gin_index.sql
-- (Plain CREATE INDEX works through PgBouncer; add CONCURRENTLY only on a
--  direct connection if the tables are large and write-hot.)

CREATE INDEX IF NOT EXISTS "AmmoSpecs_specs_gin"
  ON "AmmoSpecs" USING gin ("specs" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "FirearmSpecs_specs_gin"
  ON "FirearmSpecs" USING gin ("specs" jsonb_path_ops);
