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
