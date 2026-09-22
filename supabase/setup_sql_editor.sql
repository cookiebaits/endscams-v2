-- Supabase Schema for EndScams Threat Tracker & Harvester Database
-- Target Database: https://joxeqlgkuvgvjoshmjqu.supabase.co
-- Run this script in the Supabase Dashboard -> SQL Editor to initialize or verify the schema.

-- 1. Create tracker_entries table (Primary Scam Tracker Table)
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  phone_digits TEXT NOT NULL UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT DEFAULT 'General Tech Support & Refund Scams',
  category TEXT DEFAULT 'General Tech Support & Refund Scams',
  impersonated_company TEXT DEFAULT 'N/A',
  invoice_number TEXT DEFAULT 'N/A',
  amount_charged TEXT DEFAULT 'N/A',
  source_platform TEXT DEFAULT 'Tech Support United',
  source_name TEXT DEFAULT 'Tech Support United',
  source_url TEXT DEFAULT '',
  source_domain TEXT DEFAULT '',
  threat_intel TEXT DEFAULT '',
  description TEXT DEFAULT '',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT DEFAULT '',
  post_date TEXT DEFAULT '',
  is_down BOOLEAN DEFAULT FALSE,
  reported_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure reported_down and is_down exist if table was previously created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracker_entries' AND column_name='reported_down') THEN
    ALTER TABLE public.tracker_entries ADD COLUMN reported_down BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracker_entries' AND column_name='is_down') THEN
    ALTER TABLE public.tracker_entries ADD COLUMN is_down BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Indexes for fast deduplication and lookup
CREATE INDEX IF NOT EXISTS idx_tracker_entries_phone_digits ON public.tracker_entries (phone_digits);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_detected_at ON public.tracker_entries (detected_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

-- Set Policies for anon and authenticated roles
DROP POLICY IF EXISTS "Allow anon and auth read tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth read tracker_entries"
  ON public.tracker_entries FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon and auth insert tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth insert tracker_entries"
  ON public.tracker_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth update tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth update tracker_entries"
  ON public.tracker_entries FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth delete tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth delete tracker_entries"
  ON public.tracker_entries FOR DELETE
  TO anon, authenticated
  USING (true);


-- 2. Create scam_reports table (Direct Submissions from /report page)
CREATE TABLE IF NOT EXISTS public.scam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  phone_digits TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  how_contacted TEXT DEFAULT 'Phone Call',
  incident_date TEXT DEFAULT CURRENT_DATE::text,
  reporter_name TEXT,
  reporter_email TEXT,
  money_lost NUMERIC(12,2),
  source TEXT DEFAULT 'user_report',
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scam_reports_phone_digits ON public.scam_reports (phone_digits);
CREATE INDEX IF NOT EXISTS idx_scam_reports_created_at ON public.scam_reports (created_at DESC);

ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth read scam_reports" ON public.scam_reports;
CREATE POLICY "Allow anon and auth read scam_reports"
  ON public.scam_reports FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon and auth insert scam_reports" ON public.scam_reports;
CREATE POLICY "Allow anon and auth insert scam_reports"
  ON public.scam_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth update scam_reports" ON public.scam_reports;
CREATE POLICY "Allow anon and auth update scam_reports"
  ON public.scam_reports FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- 3. Create backup/alias table scam_records with identical columns
CREATE TABLE IF NOT EXISTS public.scam_records (
  id TEXT PRIMARY KEY,
  phone TEXT,
  phone_number TEXT,
  clean_phone TEXT,
  phone_digits TEXT UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT,
  category TEXT,
  impersonated_company TEXT,
  invoice_number TEXT,
  amount_charged TEXT,
  platform TEXT,
  source_platform TEXT,
  source_name TEXT,
  source_url TEXT,
  source_domain TEXT,
  snippet TEXT,
  threat_intel TEXT,
  detailed_summary TEXT,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT,
  post_date TEXT,
  is_down BOOLEAN DEFAULT FALSE,
  is_number_down BOOLEAN DEFAULT FALSE,
  reported_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scam_records_phone_digits ON public.scam_records (phone_digits);
ALTER TABLE public.scam_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth read scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth read scam_records"
  ON public.scam_records FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon and auth insert scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth insert scam_records"
  ON public.scam_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth update scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth update scam_records"
  ON public.scam_records FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- 4. Create storage bucket for evidence screenshots / PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('scam-reports', 'scam-reports', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public uploads to scam-reports" ON storage.objects;
CREATE POLICY "Allow public uploads to scam-reports"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'scam-reports');

DROP POLICY IF EXISTS "Allow public reads from scam-reports" ON storage.objects;
CREATE POLICY "Allow public reads from scam-reports"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'scam-reports');
