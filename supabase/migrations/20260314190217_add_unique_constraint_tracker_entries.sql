
/*
  # Add unique constraint to tracker_entries for upsert support

  ## Changes
  - Adds a unique constraint on (phone_digits, source_name) in tracker_entries
    so the edge function's upsert with onConflict can work correctly.

  ## Notes
  - First removes any exact duplicate rows (keeping the newest) before adding the constraint
*/

DELETE FROM tracker_entries a
USING tracker_entries b
WHERE a.id < b.id
  AND a.phone_digits = b.phone_digits
  AND a.source_name = b.source_name;

ALTER TABLE tracker_entries
  ADD CONSTRAINT tracker_entries_phone_digits_source_name_key
  UNIQUE (phone_digits, source_name);
