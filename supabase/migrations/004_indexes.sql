CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_fts ON public.opportunities
USING GIN(to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'')));
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding ON public.opportunities
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_organizations_embedding ON public.organizations
USING hnsw (profile_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
