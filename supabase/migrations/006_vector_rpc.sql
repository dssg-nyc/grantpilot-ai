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
