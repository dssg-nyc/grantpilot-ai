-- Adapted from supabase/supabase docker/volumes/db/roles.sql (master, 2026-10).
-- Sets the service-role passwords to POSTGRES_PASSWORD. supabase_functions_admin
-- is dropped from the upstream list: it is created by webhooks.sql (Edge
-- Functions), which this stack doesn't mount, and the ALTER would abort init.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
