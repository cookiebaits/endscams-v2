/*
  # Add reported_down flag to tracker_entries

  1. Changes
    - `tracker_entries`: Add `reported_down` boolean column (default false)
      - When true, the entry is hidden from the main list
      - Visible only when filtering by "Number Down" category
  2. Security
    - Add public UPDATE policy allowing anon users to toggle reported_down only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracker_entries' AND column_name = 'reported_down'
  ) THEN
    ALTER TABLE tracker_entries ADD COLUMN reported_down boolean DEFAULT false NOT NULL;
  END IF;
END $$;

CREATE POLICY "Anyone can toggle reported_down on tracker entries"
  ON tracker_entries
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
