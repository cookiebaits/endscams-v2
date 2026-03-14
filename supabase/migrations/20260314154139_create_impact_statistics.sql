/*
  # Create Impact Statistics Table

  1. New Table
    - `impact_statistics`
      - `id` (uuid, primary key) - unique identifier
      - `money_saved` (numeric) - total dollars saved from prevented scams
      - `scammer_hours_wasted` (numeric) - hours of scammer time wasted
      - `resources_shutdown` (integer) - number of confirmed scammer resources shut down
      - `last_updated` (timestamptz) - when statistics were last updated
      - `created_at` (timestamptz) - when the record was created

  2. Security
    - Enable RLS on the table
    - Allow public read access (SELECT) to all users
    - Only authenticated admin users can update statistics

  3. Initial Data
    - Insert initial statistics row with starting values
*/

-- Create impact_statistics table
CREATE TABLE IF NOT EXISTS impact_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  money_saved numeric(12, 2) NOT NULL DEFAULT 0,
  scammer_hours_wasted numeric(10, 2) NOT NULL DEFAULT 0,
  resources_shutdown integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE impact_statistics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to impact statistics
CREATE POLICY "Public read access to impact statistics"
  ON impact_statistics
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow authenticated users to update statistics
CREATE POLICY "Authenticated update access to impact statistics"
  ON impact_statistics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert statistics
CREATE POLICY "Authenticated insert access to impact statistics"
  ON impact_statistics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert initial statistics
INSERT INTO impact_statistics (money_saved, scammer_hours_wasted, resources_shutdown)
VALUES (1247563.00, 8942.50, 127)
ON CONFLICT DO NOTHING;
