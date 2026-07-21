/*
  # Rebuild Tracker – Full wipe + 31-day retention (scheduler moved off Supabase)

  ## What this migration does
  1. **WIPE**: Deletes ALL existing rows in `tracker_entries`.
  2. **Retention**: Sets default expiry to 31 days (was 30).
  3. **Cleanup helper**: Provides `purge_old_tracker_entries()` so the fetcher
     service (or any operator) can trigger a hard purge with one SQL call.

  ## Scheduling
  Cron is owned by the `tracker-fetcher` docker service (Deno app on Dokploy),
  which reads its secrets from Dokploy's Environment tab and calls Supabase
  via the service-role key. No `pg_cron` / `pg_net` needed anymore.
*/

-- 1. WIPE
TRUNCATE TABLE tracker_entries;

-- 2. Update default expiry to 31 days
ALTER TABLE tracker_entries
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '31 days');

-- 3. Cleanup helper (idempotent, safe re-run)
CREATE OR REPLACE FUNCTION purge_old_tracker_entries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM tracker_entries
  WHERE report_date < (CURRENT_DATE - INTERVAL '31 days')
     OR expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
