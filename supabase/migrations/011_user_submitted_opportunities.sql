-- Lets orgs submit a grant URL that gets AI-extracted and shared into the
-- public opportunities pool, tagged with who submitted it for accountability.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS submitted_by_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_submitted_by ON public.opportunities(submitted_by_org_id) WHERE submitted_by_org_id IS NOT NULL;
