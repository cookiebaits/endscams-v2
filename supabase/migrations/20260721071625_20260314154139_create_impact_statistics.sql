/*
  # Create Impact Statistics Table

  1. New Table
    - `impact_statistics` — single-row table of headline stats (money saved, scammer hours wasted, resources shutdown)
  2. Security
    - RLS enabled. Public SELECT. Authenticated INSERT/UPDATE.
  3. Initial Data
    - Seeds one row with starting values.
*/

CREATE TABLE IF NOT EXISTS impact_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  money_saved numeric(12, 2) NOT NULL DEFAULT 0,
  scammer_hours_wasted numeric(10, 2) NOT NULL DEFAULT 0,
  resources_shutdown integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE impact_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to impact statistics" ON impact_statistics;
CREATE POLICY "Public read access to impact statistics"
  ON impact_statistics FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated update access to impact statistics" ON impact_statistics;
CREATE POLICY "Authenticated update access to impact statistics"
  ON impact_statistics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated insert access to impact statistics" ON impact_statistics;
CREATE POLICY "Authenticated insert access to impact statistics"
  ON impact_statistics FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO impact_statistics (money_saved, scammer_hours_wasted, resources_shutdown)
VALUES (1247563.00, 8942.50, 127)
ON CONFLICT DO NOTHING;
