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
