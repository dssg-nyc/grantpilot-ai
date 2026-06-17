-- Match explainability: store the AI's self-reported confidence so the UI can
-- flag low-confidence analyses instead of presenting every score as certain.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS analysis_confidence TEXT
  CHECK (analysis_confidence IN ('high', 'medium', 'low'));

-- Lock down the operational log tables. They were created without RLS, leaving
-- them world-readable through the public API. Restrict to platform admins.
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingestion_logs_admin_only ON public.ingestion_logs;
CREATE POLICY ingestion_logs_admin_only ON public.ingestion_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
