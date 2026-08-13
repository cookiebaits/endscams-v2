/*
  # Create Scam Tracking Database Schema

  1. New Tables
    - `scam_reports` — user-submitted scam reports (phone, category, description, optional file upload, 45-day expiry)
    - `tracker_entries` — fetched scam numbers from external sources (FCC/FTC sheet, Google CSE, BBB), 30-day expiry

  2. Security
    - RLS enabled on both tables.
    - Public (anon) SELECT on active (non-expired) rows.
    - Authenticated SELECT on all rows.
    - Public (anon) INSERT on scam_reports (for the public report form).
    - No public write access to tracker_entries (written by fetcher via service role).

  3. Indexes
    - phone_digits, expires_at, created_at on both tables.
*/

CREATE TABLE IF NOT EXISTS scam_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  how_contacted text NOT NULL,
  incident_date date NOT NULL,
  reporter_name text,
  reporter_email text,
  money_lost numeric(10, 2),
  source text NOT NULL DEFAULT 'user_report',
  source_url text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracker_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  report_date date NOT NULL,
  category text,
  description text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scam_reports_phone_digits_idx ON scam_reports(phone_digits);
CREATE INDEX IF NOT EXISTS scam_reports_expires_at_idx ON scam_reports(expires_at);
CREATE INDEX IF NOT EXISTS scam_reports_created_at_idx ON scam_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS tracker_entries_phone_digits_idx ON tracker_entries(phone_digits);
CREATE INDEX IF NOT EXISTS tracker_entries_expires_at_idx ON tracker_entries(expires_at);
CREATE INDEX IF NOT EXISTS tracker_entries_created_at_idx ON tracker_entries(created_at DESC);

ALTER TABLE scam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to active scam reports" ON scam_reports;
CREATE POLICY "Public read access to active scam reports"
  ON scam_reports FOR SELECT TO anon USING (expires_at > now());

DROP POLICY IF EXISTS "Public read access to active tracker entries" ON tracker_entries;
CREATE POLICY "Public read access to active tracker entries"
  ON tracker_entries FOR SELECT TO anon USING (expires_at > now());

DROP POLICY IF EXISTS "Authenticated read access to scam reports" ON scam_reports;
CREATE POLICY "Authenticated read access to scam reports"
  ON scam_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read access to tracker entries" ON tracker_entries;
CREATE POLICY "Authenticated read access to tracker entries"
  ON tracker_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public insert access to scam reports" ON scam_reports;
CREATE POLICY "Public insert access to scam reports"
  ON scam_reports FOR INSERT TO anon WITH CHECK (true);
