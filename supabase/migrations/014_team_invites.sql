-- Team / multi-user support for an organization: pending invites + an
-- org-scoped role, plus a locked-down SECURITY DEFINER path for accepting an
-- invite (mirrors the posture 012_prevent_users_self_escalation.sql set up).
--
-- SCHEMA DECISION: no `org_members` join table.
-- ------------------------------------------------------------------------
-- `public.users.org_id` is *already* the org-membership relationship, and it
-- already supports many users per org today — see
-- app/api/account/delete/route.ts, which counts "other org members" with
-- `SELECT ... FROM users WHERE org_id = X AND id <> me` before deciding
-- whether deleting the last user should also delete the org. Every existing
-- org-scoped RLS policy (`matches_org_access`, `pipeline_org_access`,
-- `draft_generations_org_access`, ...) is written as
-- `org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())`,
-- i.e. membership-by-users-row is the established pattern across this schema,
-- not something new this migration introduces.
--
-- A separate `org_members(org_id, user_id, role)` table would duplicate that
-- relationship and require every join/leave/remove/delete-account path to
-- keep two tables in sync — exactly the kind of drift risk the task brief
-- flagged. Since cardinality isn't changing (still one org per user, just
-- like today), a join table buys nothing here and adds a second source of
-- truth for "who is in this org."
--
-- The one thing genuinely missing is an org-scoped role that is NOT the same
-- as `users.role` (that column already means something else — platform-staff
-- access, gating `opportunities_admin_write` / `audit_logs` /
-- `ingestion_logs`; see 003_rls_policies.sql + 010_match_confidence_and_log_rls.sql).
-- Reusing it for "org admin vs. org member" would risk an invited teammate
-- being confused for platform staff. So this migration adds a distinct
-- `users.org_role` column instead, protected by the same trigger that
-- protects `role`/`org_id`.
--
-- The org *owner* is not stored redundantly either — `organizations.created_by`
-- already exists (001_initial_schema.sql) and is treated as the single owner,
-- always distinct from any invited `org_role = 'member' | 'admin'`.
-- `org_invites` is the only new table: pending invites are inherently
-- pre-membership data with no existing home in the schema.

-- ---------------------------------------------------------------------------
-- 1. Org-scoped role, distinct from the platform-staff `role` column.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS org_role TEXT NOT NULL DEFAULT 'member'
    CHECK (org_role IN ('admin', 'member'));
-- NOTE: 'owner' is intentionally not a valid value here — ownership is
-- derived from organizations.created_by = users.id, never stored on the user
-- row, so there is exactly one owner per org by construction and it can never
-- drift out of sync.

COMMENT ON COLUMN public.users.org_role IS
  'Org-scoped role for team features (admin can invite/remove teammates; member cannot). Distinct from users.role, which gates platform-staff access. The org owner is organizations.created_by, not a value of this column.';

-- ---------------------------------------------------------------------------
-- 2. Pending invites.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS org_invites_token_key ON public.org_invites (token);
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON public.org_invites (org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.org_invites (lower(email));
-- At most one live pending invite per (org, email) — re-inviting revokes the
-- old row (see app/api/team/route.ts POST) rather than creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS org_invites_pending_org_email_key
  ON public.org_invites (org_id, lower(email)) WHERE status = 'pending';

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Org members can see all invites (any status) belonging to their own org.
DROP POLICY IF EXISTS org_invites_member_read ON public.org_invites;
CREATE POLICY org_invites_member_read ON public.org_invites FOR SELECT USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);

-- A user can always see an invite addressed to their own email, regardless of
-- which org it's for or whether they belong to it yet — needed so the accept
-- flow can show "You've been invited to <org>" before the user has joined.
DROP POLICY IF EXISTS org_invites_own_email_read ON public.org_invites;
CREATE POLICY org_invites_own_email_read ON public.org_invites FOR SELECT USING (
  lower(email) = lower(COALESCE(auth.email(), ''))
);

-- Only the org owner or an org admin may create invites.
DROP POLICY IF EXISTS org_invites_admin_insert ON public.org_invites;
CREATE POLICY org_invites_admin_insert ON public.org_invites FOR INSERT WITH CHECK (
  org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
  OR org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND org_role = 'admin')
);

-- Only the org owner or an org admin may update (revoke) invites for their org.
DROP POLICY IF EXISTS org_invites_admin_update ON public.org_invites;
CREATE POLICY org_invites_admin_update ON public.org_invites FOR UPDATE USING (
  org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
  OR org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND org_role = 'admin')
);

-- Only the org owner or an org admin may delete invites for their org.
DROP POLICY IF EXISTS org_invites_admin_delete ON public.org_invites;
CREATE POLICY org_invites_admin_delete ON public.org_invites FOR DELETE USING (
  org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
  OR org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND org_role = 'admin')
);

-- ---------------------------------------------------------------------------
-- 3. Extend the self-escalation trigger to also pin org_role, with a narrow,
--    deliberate bypass for the accept-invite path below. Read carefully:
--    this does NOT reopen the hole 012 closed. The bypass is a
--    transaction-local GUC (`app.team_invite_bypass`) that is only ever set
--    by accept_org_invite() immediately before the UPDATE it has already
--    authorized via its own token + email checks. No RPC in this schema
--    exposes `set_config` to clients, so an ordinary authenticated user has
--    no way to set that GUC themselves — they can only reach the org_id/
--    org_role UPDATE path through accept_org_invite()'s own validation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_users_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Deliberate, narrow bypass for public.accept_org_invite() only.
  IF current_setting('app.team_invite_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  IF NEW.org_role IS DISTINCT FROM OLD.org_role THEN
    NEW.org_role := OLD.org_role;
  END IF;

  IF OLD.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    NEW.org_id := OLD.org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- (Trigger itself — trg_prevent_users_self_escalation — already exists from
-- 012 and fires this function; CREATE OR REPLACE FUNCTION above is enough,
-- no need to re-create the trigger.)

-- ---------------------------------------------------------------------------
-- 4. Accept an invite: validate the token, confirm it belongs to the caller,
--    mark it accepted, and join the caller to the org — all atomically,
--    bypassing the self-escalation trigger's org_id/org_role lock ONLY for
--    this legitimately-authorized path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_org_invite(p_token UUID)
RETURNS UUID AS $$
DECLARE
  v_invite public.org_invites%ROWTYPE;
  v_caller_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_caller_email := lower(COALESCE(auth.email(), ''));

  SELECT * INTO v_invite
  FROM public.org_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer valid (status: %)', v_invite.status;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE public.org_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF lower(v_invite.email) <> v_caller_email THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  -- Local to this transaction only; resets automatically on commit/rollback.
  PERFORM set_config('app.team_invite_bypass', 'true', true);

  -- Upsert rather than plain UPDATE: mirrors app/api/profile/route.ts's
  -- onboarding flow, which upserts for the same reason — a public.users row
  -- may not exist yet if the person accepting the invite never completed the
  -- normal signup callback.
  INSERT INTO public.users (id, email, org_id, org_role, onboarding_completed)
  VALUES (auth.uid(), COALESCE(auth.email(), v_invite.email), v_invite.org_id, v_invite.role, TRUE)
  ON CONFLICT (id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        org_role = EXCLUDED.org_role,
        onboarding_completed = TRUE,
        updated_at = NOW();

  UPDATE public.org_invites SET status = 'accepted' WHERE id = v_invite.id;

  RETURN v_invite.org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Defense in depth: this function is security-sensitive (it's the one place
-- allowed to move org_id/org_role around), so be explicit about who may call
-- it rather than relying on Postgres's default PUBLIC execute grant.
REVOKE ALL ON FUNCTION public.accept_org_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(UUID) TO authenticated;
