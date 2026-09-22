/*
  ==============================================================================
  Cyberscam Watchdog Network — Supabase SQL Editor Master Migration Script
  Target Supabase Database: db.joxeqlgkuvgvjoshmjqu.supabase.co

  Copy and paste this script directly into your Supabase Dashboard SQL Editor
  (https://supabase.com/dashboard/project/joxeqlgkuvgvjoshmjqu/sql/new)
  to ensure all tables, indexes, constraints, and public RLS policies exist.
  ==============================================================================
*/

-- 1. Create tracker_entries table
CREATE TABLE IF NOT EXISTS tracker_entries (
  id text PRIMARY KEY,
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  source_name text NOT NULL DEFAULT 'Threat Intelligence',
  source_url text NOT NULL DEFAULT '',
  report_date text NOT NULL,
  category text,
  description text,
  impersonated_company text DEFAULT 'N/A',
  invoice_number text DEFAULT 'N/A',
  amount_charged text DEFAULT 'N/A',
  reported_down boolean DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create scam_reports table
CREATE TABLE IF NOT EXISTS scam_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  how_contacted text NOT NULL DEFAULT 'Phone Call',
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  reporter_name text,
  reporter_email text,
  money_lost numeric(10, 2),
  source text NOT NULL DEFAULT 'user_report',
  source_url text,
  file_url text,
  file_name text,
  file_type text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add performance indexes
CREATE INDEX IF NOT EXISTS tracker_entries_phone_digits_idx ON tracker_entries(phone_digits);
CREATE INDEX IF NOT EXISTS tracker_entries_report_date_idx ON tracker_entries(report_date DESC);
CREATE INDEX IF NOT EXISTS tracker_entries_created_at_idx ON tracker_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS tracker_entries_expires_at_idx ON tracker_entries(expires_at);

CREATE INDEX IF NOT EXISTS scam_reports_phone_digits_idx ON scam_reports(phone_digits);
CREATE INDEX IF NOT EXISTS scam_reports_created_at_idx ON scam_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS scam_reports_expires_at_idx ON scam_reports(expires_at);

-- 4. Add unique constraint on (phone_digits, source_name) for upsert conflict resolution
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracker_entries_phone_digits_source_name_key'
  ) THEN
    -- Delete duplicate rows keeping the latest
    DELETE FROM tracker_entries a
    USING tracker_entries b
    WHERE a.id < b.id
      AND a.phone_digits = b.phone_digits
      AND a.source_name = b.source_name;

    ALTER TABLE tracker_entries
      ADD CONSTRAINT tracker_entries_phone_digits_source_name_key
      UNIQUE (phone_digits, source_name);
  END IF;
END $$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scam_reports ENABLE ROW LEVEL SECURITY;

-- 6. Setup Public & Anon Access RLS Policies for tracker_entries
DROP POLICY IF EXISTS "Public read access to active tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Authenticated read access to tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Public read access to all tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Public insert access to tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Public update access to tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Public delete access to tracker entries" ON tracker_entries;

CREATE POLICY "Public read access to all tracker entries"
  ON tracker_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert access to tracker entries"
  ON tracker_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public update access to tracker entries"
  ON tracker_entries FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete access to tracker entries"
  ON tracker_entries FOR DELETE
  TO anon, authenticated
  USING (true);

-- 7. Setup Public & Anon Access RLS Policies for scam_reports
DROP POLICY IF EXISTS "Public read access to active scam reports" ON scam_reports;
DROP POLICY IF EXISTS "Public insert access to scam reports" ON scam_reports;

CREATE POLICY "Public read access to scam reports"
  ON scam_reports FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public insert access to scam reports"
  ON scam_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 8. Storage bucket for scam-reports evidence uploads (if bucket does not exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('scam-reports', 'scam-reports', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read storage scam-reports" ON storage.objects;
DROP POLICY IF EXISTS "Public insert storage scam-reports" ON storage.objects;

CREATE POLICY "Public read storage scam-reports"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'scam-reports');

CREATE POLICY "Public insert storage scam-reports"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'scam-reports');
