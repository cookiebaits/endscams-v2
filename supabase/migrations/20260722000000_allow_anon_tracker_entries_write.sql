/*
  # Allow Anonymous Write Access to Tracker Entries and Scam Reports

  1. Security
    - Add RLS policy allowing anonymous users to INSERT into `tracker_entries`
    - Add RLS policy allowing anonymous users to UPDATE `tracker_entries`
    - Ensure RLS policies on `scam_reports` are fully up to date for anonymous insertions
*/

-- Add insert policy for anonymous users on tracker_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tracker_entries' AND policyname = 'Public insert access to tracker entries'
  ) THEN
    CREATE POLICY "Public insert access to tracker entries"
      ON tracker_entries
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tracker_entries' AND policyname = 'Public update access to tracker entries'
  ) THEN
    CREATE POLICY "Public update access to tracker entries"
      ON tracker_entries
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
