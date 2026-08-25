-- Funding Scout: a dedicated web-research agent that hunts for funding
-- opportunities on the open web for the whole organization or for one
-- specific project, and returns a RANKED, STRUCTURED result set with a
-- source link for every finding.
--
-- Why this is separate from `opportunities`:
--   `opportunities` is the vetted, embedded, matchable pool that the whole
--   app scores against. A scout finding is an UNVERIFIED LEAD — something the
--   agent read on a funder's website minutes ago. Writing leads straight into
--   `opportunities` would pollute every org's matches with unvetted rows.
--   So findings live here until a human says "yes, track this", at which
--   point importOpportunityFromUrl() promotes the lead into a real
--   opportunity + pipeline item and we backfill imported_opportunity_id.
--
-- Why this is separate from `chat_conversations` (015):
--   The assistant's web_search is conversational and ad-hoc — the answer is
--   prose in a chat bubble that nobody can sort, filter, re-open next week,
--   or hand to a colleague. A scout run is a persisted, re-readable research
--   artifact with one row per opportunity.

CREATE TABLE IF NOT EXISTS public.scout_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- 'organization' = fund the org's general mission.
  -- 'project'      = fund one specific initiative described below.
  scope TEXT NOT NULL DEFAULT 'organization' CHECK (scope IN ('organization', 'project')),
  project_name TEXT,
  project_description TEXT,

  -- Optional search constraints supplied by the user.
  funding_need_min NUMERIC,
  funding_need_max NUMERIC,
  geographic_focus TEXT,
  funder_types TEXT[] NOT NULL DEFAULT '{}',
  target_count INTEGER NOT NULL DEFAULT 8 CHECK (target_count BETWEEN 1 AND 20),

  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  -- The agent's own narrative read on the funding landscape it just surveyed.
  summary TEXT,
  error TEXT,
  finding_count INTEGER NOT NULL DEFAULT 0,
  searches_used INTEGER NOT NULL DEFAULT 0,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scout_runs_org ON public.scout_runs(org_id, started_at DESC);

ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scout_runs_org_access ON public.scout_runs FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.scout_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES public.scout_runs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  funder_name TEXT NOT NULL,
  funder_type TEXT NOT NULL DEFAULT 'other' CHECK (funder_type IN (
    'federal_government', 'state_government', 'local_government',
    'foundation', 'corporate', 'international', 'other'
  )),

  -- source_url is the whole point of the feature: every finding must be
  -- traceable back to the page the agent actually read, so a human can
  -- verify it before spending a week writing an application.
  source_url TEXT NOT NULL,
  application_url TEXT,

  program_summary TEXT,
  amount_min NUMERIC,
  amount_max NUMERIC,
  amount_note TEXT,
  deadline DATE,
  deadline_note TEXT,
  eligibility_summary TEXT,
  geographic_eligibility TEXT,
  focus_areas TEXT[] NOT NULL DEFAULT '{}',

  fit_score INTEGER NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  fit_rationale TEXT NOT NULL DEFAULT '',
  concerns TEXT[] NOT NULL DEFAULT '{}',
  -- How well-evidenced the finding is: 'high' = read the funder's own
  -- program page; 'low' = inferred from a listicle or a stale cache.
  evidence_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (evidence_confidence IN ('high', 'medium', 'low')),
  already_in_database BOOLEAN NOT NULL DEFAULT FALSE,

  -- Set once a human promotes this lead into the real matchable pool.
  imported_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  imported_pipeline_item_id UUID REFERENCES public.pipeline_items(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_findings_run ON public.scout_findings(run_id, fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_scout_findings_org ON public.scout_findings(org_id, created_at DESC);

ALTER TABLE public.scout_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY scout_findings_org_access ON public.scout_findings FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);
