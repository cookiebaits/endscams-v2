/*
  # Add reported_down flag to tracker_entries

  1. Changes
    - tracker_entries: add reported_down boolean (default false). When true, entry is hidden from main list and visible only under "Number Down".
  2. Security
    - Public UPDATE policy allowing anon/authenticated to toggle reported_down.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracker_entries' AND column_name='reported_down') THEN
    ALTER TABLE tracker_entries ADD COLUMN reported_down boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can toggle reported_down on tracker entries" ON tracker_entries;
CREATE POLICY "Anyone can toggle reported_down on tracker entries"
  ON tracker_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
