/*
  # Rebuild Tracker – Full wipe + 31-day retention + scheduled refresh

  ## What this migration does
  1. **WIPE**: Deletes ALL existing rows in `tracker_entries`.
  2. **Retention**: Changes default expiry to 31 days (was 30).
  3. **Cleanup helper**: Adds a `purge_old_tracker_entries()` SQL function that removes
     any tracker rows whose `report_date` is older than 31 days OR whose `expires_at`
     has passed. This is called from both the edge function and pg_cron.
  4. **pg_cron schedule**: Runs the `fetch-scam-data` edge function twice daily:
       - 06:00 PST → 14:00 UTC (or 13:00 UTC during PDT)
       - 13:00 PST → 21:00 UTC (or 20:00 UTC during PDT)
     We schedule on the PST-equivalent UTC time and run both branches; the function
     itself is idempotent (dedupe by phone_digits + source_name).

  ## Notes
  - Requires `pg_cron` and `pg_net` extensions (pre-enabled on Supabase).
  - The cron job invokes the edge function via `net.http_post`. You MUST set the
    following database settings (via Supabase dashboard → Database → Config or
    `ALTER DATABASE postgres SET ...`) for the cron to work:
        app.supabase_url         = 'https://<project>.supabase.co'
        app.service_role_key     = '<service-role-JWT>'
    The scheduled call passes the service-role key so the edge function has
    permission to insert rows.
*/

-- 1. WIPE
TRUNCATE TABLE tracker_entries;

-- 2. Update default expiry to 31 days
ALTER TABLE tracker_entries
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '31 days');

-- 3. Cleanup helper
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

-- 4. Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedules of the same name (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN ('tracker-refresh-morning-pst', 'tracker-refresh-afternoon-pst', 'tracker-purge-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule: 6am PST  == 14:00 UTC  (PST is UTC-8; note: this runs one hour "off" during PDT which is fine)
SELECT cron.schedule(
  'tracker-refresh-morning-pst',
  '0 14 * * *',
  $cmd$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fetch-scam-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);

-- Schedule: 1pm PST == 21:00 UTC
SELECT cron.schedule(
  'tracker-refresh-afternoon-pst',
  '0 21 * * *',
  $cmd$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fetch-scam-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);

-- Hourly purge of anything past the 31-day window (belt-and-suspenders)
SELECT cron.schedule(
  'tracker-purge-hourly',
  '5 * * * *',
  $cmd$ SELECT purge_old_tracker_entries(); $cmd$
);
