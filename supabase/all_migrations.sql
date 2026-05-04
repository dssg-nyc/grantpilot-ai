-- Initial schema (abbreviated MVP scaffold)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'org_admin',
  org_id UUID,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID,
  legal_name TEXT NOT NULL,
  mission_statement TEXT,
  primary_focus_areas TEXT[] DEFAULT '{}',
  service_states TEXT[] DEFAULT '{}',
  annual_budget_range TEXT,
  profile_embedding vector(1024),
  profile_completeness INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  funder_name TEXT NOT NULL,
  funder_type TEXT NOT NULL,
  funding_type TEXT NOT NULL DEFAULT 'grant',
  amount_min INTEGER,
  amount_max INTEGER,
  deadline DATE,
  is_rolling_deadline BOOLEAN DEFAULT FALSE,
  eligibility_types TEXT[] DEFAULT '{}',
  focus_areas TEXT[] DEFAULT '{}',
  geographic_scope TEXT DEFAULT 'national',
  geographic_states TEXT[] DEFAULT '{}',
  source TEXT NOT NULL,
  source_id TEXT,
  source_url TEXT NOT NULL,
  application_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ai_summary TEXT,
  requirements_extracted JSONB DEFAULT '[]',
  embedding vector(1024),
  view_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  trending_score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  UNIQUE(org_id, opportunity_id),
  raw_similarity_score FLOAT NOT NULL DEFAULT 0,
  match_score INTEGER NOT NULL DEFAULT 0,
  success_probability INTEGER DEFAULT 0,
  match_reasons TEXT[] DEFAULT '{}',
  disqualifiers TEXT[] DEFAULT '{}',
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'saved',
  notes TEXT,
  deadline DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE EXTENSION IF NOT EXISTS "vector";
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_items ENABLE ROW LEVEL SECURITY;

-- USERS: only access own record
CREATE POLICY users_self_access ON public.users FOR ALL USING (auth.uid() = id);

-- ORGANIZATIONS: org creator + members can access
CREATE POLICY orgs_member_access ON public.organizations FOR ALL USING (
  created_by = auth.uid()
  OR id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- OPPORTUNITIES: public read for active, admin write
CREATE POLICY opportunities_public_read ON public.opportunities FOR SELECT USING (status = 'active');

CREATE POLICY opportunities_admin_write ON public.opportunities FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- MATCHES: only org members can see their org's matches
CREATE POLICY matches_org_access ON public.matches FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);

-- PIPELINE: only org members
CREATE POLICY pipeline_org_access ON public.pipeline_items FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_fts ON public.opportunities
USING GIN(to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'')));
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding ON public.opportunities
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_organizations_embedding ON public.organizations
USING hnsw (profile_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- Expand organizations table with all PRD fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dba_name TEXT,
  ADD COLUMN IF NOT EXISTS ein TEXT,
  ADD COLUMN IF NOT EXISTS is_501c3 BOOLEAN,
  ADD COLUMN IF NOT EXISTS year_founded INTEGER,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS org_type TEXT NOT NULL DEFAULT 'ngo',
  ADD COLUMN IF NOT EXISTS secondary_focus_areas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_beneficiaries TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS geographic_service_area TEXT NOT NULL DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS service_cities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sdg_alignments INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS staff_full_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_part_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS years_in_operation INTEGER,
  ADD COLUMN IF NOT EXISTS has_received_grants BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avg_grant_size_range TEXT,
  ADD COLUMN IF NOT EXISTS previous_funder_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_active_grants BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS programs JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS min_grant_size INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_grant_size INTEGER DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS preferred_grant_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS match_score_threshold INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Expand opportunities table with all PRD fields
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS description_short TEXT,
  ADD COLUMN IF NOT EXISTS funder_website TEXT,
  ADD COLUMN IF NOT EXISTS funder_description TEXT,
  ADD COLUMN IF NOT EXISTS amount_typical INTEGER,
  ADD COLUMN IF NOT EXISTS amount_notes TEXT,
  ADD COLUMN IF NOT EXISTS deadline_time TIME,
  ADD COLUMN IF NOT EXISTS deadline_notes TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_notes TEXT,
  ADD COLUMN IF NOT EXISTS min_org_budget INTEGER,
  ADD COLUMN IF NOT EXISTS max_org_budget INTEGER,
  ADD COLUMN IF NOT EXISTS geographic_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apply_click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Expand matches table with per-dimension scores
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS focus_area_score FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS eligibility_score FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS geographic_score FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS size_fit_score FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS ai_analysis_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Expand pipeline_items with all PRD fields
ALTER TABLE public.pipeline_items
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_requested INTEGER,
  ADD COLUMN IF NOT EXISTS amount_awarded INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';

-- Alert configs table (new)
CREATE TABLE IF NOT EXISTS public.alert_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE(user_id, org_id),
  new_match_threshold INTEGER DEFAULT 70,
  closing_soon_days INTEGER DEFAULT 7,
  digest_frequency TEXT DEFAULT 'weekly',
  digest_day TEXT DEFAULT 'monday',
  digest_hour INTEGER DEFAULT 9,
  email_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_self_access ON public.alert_configs FOR ALL USING (user_id = auth.uid());

-- Ingestion logs table (new)
CREATE TABLE IF NOT EXISTS public.ingestion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  records_fetched INTEGER DEFAULT 0,
  records_new INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

-- Audit logs table (new)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional indexes for new columns
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON public.opportunities(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_pipeline_deleted ON public.pipeline_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_source ON public.ingestion_logs(source, started_at DESC);
-- RPC function for vector similarity search on opportunities
CREATE OR REPLACE FUNCTION match_opportunities(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  funder_name text,
  funder_type text,
  funding_type text,
  amount_min integer,
  amount_max integer,
  deadline date,
  is_rolling_deadline boolean,
  eligibility_types text[],
  focus_areas text[],
  geographic_scope text,
  geographic_states text[],
  source text,
  source_url text,
  application_url text,
  status text,
  ai_summary text,
  requirements_extracted jsonb,
  view_count integer,
  save_count integer,
  trending_score float,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id, o.title, o.description, o.funder_name, o.funder_type, o.funding_type,
    o.amount_min, o.amount_max, o.deadline, o.is_rolling_deadline,
    o.eligibility_types, o.focus_areas, o.geographic_scope, o.geographic_states,
    o.source, o.source_url, o.application_url, o.status, o.ai_summary,
    o.requirements_extracted, o.view_count, o.save_count, o.trending_score,
    o.created_at, o.updated_at,
    1 - (o.embedding <=> query_embedding) AS similarity
  FROM public.opportunities o
  WHERE
    o.status = 'active'
    AND o.embedding IS NOT NULL
    AND 1 - (o.embedding <=> query_embedding) > match_threshold
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RPC function for vector search on organizations (for admin/matching pipeline use)
CREATE OR REPLACE FUNCTION match_organizations(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  legal_name text,
  mission_statement text,
  primary_focus_areas text[],
  service_states text[],
  annual_budget_range text,
  profile_completeness integer,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id, o.legal_name, o.mission_statement, o.primary_focus_areas,
    o.service_states, o.annual_budget_range, o.profile_completeness,
    1 - (o.profile_embedding <=> query_embedding) AS similarity
  FROM public.organizations o
  WHERE
    o.profile_embedding IS NOT NULL
    AND 1 - (o.profile_embedding <=> query_embedding) > match_threshold
  ORDER BY o.profile_embedding <=> query_embedding
  LIMIT match_count;
$$;
