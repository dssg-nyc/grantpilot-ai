-- ============================================================
-- FULL WIPE: clears all app data + auth users
-- Run this in the Supabase SQL Editor to start fresh
-- ============================================================

-- 1. Disable triggers temporarily to avoid FK issues
SET session_replication_role = replica;

-- 2. Truncate all app tables (cascade handles FK deps)
TRUNCATE TABLE
  public.audit_logs,
  public.ingestion_logs,
  public.alert_configs,
  public.pipeline_items,
  public.matches,
  public.opportunities,
  public.organizations,
  public.users
CASCADE;

-- 3. Delete all Supabase Auth users
DELETE FROM auth.users;

-- 4. Re-enable triggers
SET session_replication_role = DEFAULT;

-- Confirm
SELECT 'users' AS tbl, COUNT(*) FROM public.users
UNION ALL SELECT 'organizations', COUNT(*) FROM public.organizations
UNION ALL SELECT 'opportunities', COUNT(*) FROM public.opportunities
UNION ALL SELECT 'matches', COUNT(*) FROM public.matches
UNION ALL SELECT 'pipeline_items', COUNT(*) FROM public.pipeline_items
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users;
