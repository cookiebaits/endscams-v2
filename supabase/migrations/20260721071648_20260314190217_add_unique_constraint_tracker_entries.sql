/*
  # Add unique constraint to tracker_entries for upsert support

  ## Changes
  - Adds UNIQUE (phone_digits, source_name) so the fetcher's upsert onConflict works.
  - Removes exact duplicate rows (keeping newest) before adding the constraint.
  - Idempotent: checks the constraint exists before adding.
*/

DELETE FROM tracker_entries a
USING tracker_entries b
WHERE a.id < b.id
  AND a.phone_digits = b.phone_digits
  AND a.source_name = b.source_name;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tracker_entries_phone_digits_source_name_key'
      AND conrelid = 'tracker_entries'::regclass
  ) THEN
    ALTER TABLE tracker_entries
      ADD CONSTRAINT tracker_entries_phone_digits_source_name_key
      UNIQUE (phone_digits, source_name);
  END IF;
END $$;
