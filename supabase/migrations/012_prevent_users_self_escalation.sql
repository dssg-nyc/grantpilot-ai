-- users_self_access (FOR ALL USING (auth.uid() = id)) has no WITH CHECK, so
-- Postgres reuses USING as the check clause — which only pins `id`, not other
-- columns. Any authenticated user could UPDATE their own row to set
-- role='admin' (granting themselves opportunities_admin_write) or reassign
-- org_id to another org's UUID (granting themselves matches_org_access /
-- pipeline_org_access on that org's private data via the user's own session).
--
-- Fix via trigger rather than rewriting the RLS policy: role must never change
-- after creation; org_id may only be claimed once (NULL -> a value, the
-- legitimate onboarding flow in app/api/profile/route.ts, which runs under the
-- user's own session) and can never be reassigned once set. supabaseAdmin
-- (service_role) is exempt so ingestion/admin tooling is unaffected.
CREATE OR REPLACE FUNCTION public.prevent_users_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  IF OLD.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    NEW.org_id := OLD.org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_users_self_escalation ON public.users;
CREATE TRIGGER trg_prevent_users_self_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_users_self_escalation();
