/*
  # Rebuild Tracker – 31-day retention (scheduler moved off Supabase)

  ## What this migration does
  1. WIPE: Truncates tracker_entries (fresh start for the new fetcher pipeline).
  2. Retention: Sets default expiry to 31 days (was 30).
  3. Cleanup helper: purge_old_tracker_entries() function for hard purges.

  ## Scheduling
  Cron is owned by the tracker-fetcher docker service (Deno on Dokploy).
*/

TRUNCATE TABLE tracker_entries;

ALTER TABLE tracker_entries
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '31 days');

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
