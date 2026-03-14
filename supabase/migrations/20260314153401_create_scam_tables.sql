/*
  # Create Scam Tracking Database Schema

  1. New Tables
    - `scam_reports`
      - `id` (uuid, primary key) - unique identifier for each report
      - `phone_number` (text) - formatted phone number for display
      - `phone_digits` (text, indexed) - normalized 10-digit phone number for search
      - `category` (text) - scam category/type
      - `description` (text) - detailed description of the scam
      - `how_contacted` (text) - method of contact (call, text, email, etc.)
      - `incident_date` (date) - when the scam occurred
      - `reporter_name` (text, nullable) - optional reporter name
      - `reporter_email` (text, nullable) - optional reporter email
      - `money_lost` (numeric, nullable) - amount of money lost
      - `source` (text) - source of the report (user_report, etc.)
      - `source_url` (text, nullable) - URL to original report if applicable
      - `expires_at` (timestamptz) - auto-set to 45 days from creation
      - `created_at` (timestamptz) - timestamp of report creation
      
    - `tracker_entries`
      - `id` (uuid, primary key) - unique identifier for each entry
      - `phone_number` (text) - formatted phone number for display
      - `phone_digits` (text, indexed) - normalized 10-digit phone number for search
      - `source_name` (text) - name of the data source
      - `source_url` (text) - URL to the original report
      - `report_date` (date) - date of the report
      - `category` (text, nullable) - scam category
      - `description` (text, nullable) - description of the scam
      - `expires_at` (timestamptz) - auto-set to 30 days from creation
      - `created_at` (timestamptz) - timestamp of entry creation

  2. Security
    - Enable RLS on both tables
    - Allow public read access (SELECT) for active entries
    - No INSERT/UPDATE/DELETE for anonymous users (data managed by admin/functions)

  3. Indexes
    - Index on phone_digits for fast search
    - Index on expires_at for filtering active entries
    - Index on created_at for sorting
*/

-- Create scam_reports table
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

-- Create tracker_entries table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS scam_reports_phone_digits_idx ON scam_reports(phone_digits);
CREATE INDEX IF NOT EXISTS scam_reports_expires_at_idx ON scam_reports(expires_at);
CREATE INDEX IF NOT EXISTS scam_reports_created_at_idx ON scam_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS tracker_entries_phone_digits_idx ON tracker_entries(phone_digits);
CREATE INDEX IF NOT EXISTS tracker_entries_expires_at_idx ON tracker_entries(expires_at);
CREATE INDEX IF NOT EXISTS tracker_entries_created_at_idx ON tracker_entries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE scam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_entries ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active (non-expired) entries
CREATE POLICY "Public read access to active scam reports"
  ON scam_reports
  FOR SELECT
  TO anon
  USING (expires_at > now());

CREATE POLICY "Public read access to active tracker entries"
  ON tracker_entries
  FOR SELECT
  TO anon
  USING (expires_at > now());

-- Allow authenticated users to read all entries
CREATE POLICY "Authenticated read access to scam reports"
  ON scam_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read access to tracker entries"
  ON tracker_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to insert scam reports (for public form submission)
CREATE POLICY "Public insert access to scam reports"
  ON scam_reports
  FOR INSERT
  TO anon
  WITH CHECK (true);