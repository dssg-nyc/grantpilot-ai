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
