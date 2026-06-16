-- Opportunities are de-duplicated by (source, source_id). A unique index makes
-- idempotent upserts possible (grants.gov sync, firecrawl ingest, RSS monitor).
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_source_source_id_key
  ON public.opportunities (source, source_id);
