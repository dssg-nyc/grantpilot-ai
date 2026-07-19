-- Billing: plan state lives on organizations, synced from Stripe webhooks.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_status TEXT,
  ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON public.organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- AI drafting assistance: one row per generation, also doubles as the
-- monthly usage counter for the free-tier cap (COUNT WHERE created_at >= start_of_month).
CREATE TABLE IF NOT EXISTS public.draft_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_generations_org_created ON public.draft_generations(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_draft_generations_pipeline_item ON public.draft_generations(pipeline_item_id);

ALTER TABLE public.draft_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY draft_generations_org_access ON public.draft_generations FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);
